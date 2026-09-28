import { env } from "cloudflare:workers";
import { headers } from "next/headers";

import { occurrences, validateSchedule } from "./recurrence.mjs";
export class AppError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export function db() {
  const b = (env as any).DB as D1Database;
  if (!b) throw new AppError("데이터베이스가 연결되지 않았습니다.", 503);
  return b;
}
export function bucket() {
  const b = (env as any).BUCKET as R2Bucket;
  if (!b) throw new AppError("문서 저장소가 연결되지 않았습니다.", 503);
  return b;
}
export const config = () => env as any;
export async function identity() {
  const host = (await headers()).get("host") || "";
  let hostname = "";
  try { hostname = new URL("http://" + host).hostname; } catch {}
  if (!["127.0.0.1", "localhost", "[::1]"].includes(hostname))
    throw new AppError("This version runs locally. Open Pawday.cmd on your computer.", 403);
  return { userId: "local_pawday_user", displayName: "Pet owner", email: "", fullName: null };
}
export function checkOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin)
    throw new AppError("다른 사이트의 요청은 허용되지 않습니다.", 403);
}
export async function json(req: Request) {
  if (Number(req.headers.get("content-length") || 0) > 100000)
    throw new AppError("입력이 너무 큽니다.", 413);
  const t = await req.text();
  if (t.length > 100000) throw new AppError("입력이 너무 큽니다.", 413);
  try {
    return JSON.parse(t);
  } catch {
    throw new AppError("입력 형식을 확인하세요.");
  }
}
export async function own(table: string, id: string, owner: string) {
  if (
    !["pets", "schedules", "documents", "records", "notifications"].includes(
      table,
    )
  )
    throw Error("Invalid table");
  const r = await db()
    .prepare(`SELECT * FROM ${table} WHERE id=? AND owner=?`)
    .bind(id, owner)
    .first<any>();
  if (!r) throw new AppError("데이터를 찾을 수 없습니다.", 404);
  return r;
}
export async function rows(table: string, owner: string) {
  return (
    await db()
      .prepare(`SELECT * FROM ${table} WHERE owner=?`)
      .bind(owner)
      .all<any>()
  ).results;
}
export const decode = (r: any) => ({ ...r, ...JSON.parse(r.data || "{}") });
export const now = () => new Date().toISOString(),
  uid = () => crypto.randomUUID();
export async function guard(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (e) {
    if (!(e instanceof AppError)) console.error(e);
    return Response.json(
      {
        error: e instanceof Error ? e.message : "처리 중 오류가 발생했습니다.",
      },
      {
        status: e instanceof AppError ? e.status : 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
export function result(data: any, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export async function scheduleInput(owner: string, data: any) {
  try {
    validateSchedule(data);
  } catch (e) {
    throw new AppError((e as Error).message);
  }
  await own("pets", data.petId, owner);
  if (data.documentId) {
    const d = await own("documents", data.documentId, owner);
    if (d.status !== "confirmed" || d.pet_id !== data.petId)
      throw new AppError("같은 반려동물의 확정 문서만 연결할 수 있습니다.");
  }
  return {
    petId: data.petId,
    title: data.title.trim(),
    kind: data.kind,
    rule: data.rule,
    reminder: data.reminder,
    notify: !!data.notify,
    notes: String(data.notes || "").slice(0, 4000),
    medication: data.kind === "medicine" ? data.medication : null,
    documentId: data.documentId || null,
  };
}
export async function listOccurrences(owner: string, from: string, to: string) {
  const schedules = await rows("schedules", owner),
    states = await rows("instances", owner),
    pets = await rows("pets", owner),
    byState = new Map(states.map((s) => [`${s.schedule_id}|${s.at}`, s])),
    output: any[] = [];
  for (const row of schedules.filter((r) => !r.deleted)) {
    const s = decode(row),
      pet = pets.find((p) => p.id === s.petId);
    if (!pet) continue;
    const dates = new Set(occurrences(s.rule, from, to));
    for (const state of states.filter(
      (x) => x.schedule_id === s.id && x.override,
    )) {
      const o = JSON.parse(state.override);
      if (o.at >= from && o.at < to) dates.add(state.at);
    }
    for (const at of dates) {
      if (row.cutoff && at >= row.cutoff) continue;
      const state = byState.get(`${s.id}|${at}`),
        override = state?.override ? JSON.parse(state.override) : {},
        effective = override.at || at;
      if (effective < from || effective >= to) continue;
      output.push({
        ...s,
        ...override,
        id: `${s.id}|${at}`,
        scheduleId: s.id,
        originalAt: at,
        at: effective,
        petName: decode(pet).name,
        status: state?.status || "pending",
        snooze: state?.snooze || null,
        version: row.version,
      });
    }
  }
  return output.sort((a, b) => a.at.localeCompare(b.at));
}
export async function requireOccurrence(
  owner: string,
  scheduleId: string,
  at: string,
) {
  const row = await own("schedules", scheduleId, owner);
  if (row.deleted || (row.cutoff && at >= row.cutoff))
    throw new AppError("취소된 회차입니다.", 409);
  if (
    !occurrences(
      decode(row).rule,
      at,
      new Date(+new Date(at) + 1).toISOString(),
    ).includes(at)
  )
    throw new AppError("유효한 회차가 아닙니다.", 404);
  return row;
}
export async function syncNotifications(owner: string) {
  const timestamp = now(),
    from = new Date(Date.now() - 86400000 * 7).toISOString(),
    to = new Date(Date.now() + 86400000 * 8).toISOString(),
    items = await listOccurrences(owner, from, to),
    statements = [];
  for (const item of items) {
    if (item.status !== "pending" || !item.notify) continue;
    const due =
        item.snooze ||
        new Date(+new Date(item.at) - item.reminder * 60000).toISOString(),
      id = `${item.id}|${item.snooze || ""}`;
    statements.push(
      db()
        .prepare(
          "INSERT INTO notifications (id,owner,schedule_id,at,due,title,state,version) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET due=excluded.due,title=excluded.title,version=excluded.version WHERE notifications.state='pending'",
        )
        .bind(
          id,
          owner,
          item.scheduleId,
          item.originalAt,
          due,
          `${item.petName} · ${item.title}`,
          "pending",
          item.version,
        ),
    );
  }
  for (let i = 0; i < statements.length; i += 80)
    await db().batch(statements.slice(i, i + 80));
  return (
    await db()
      .prepare(
        "SELECT * FROM notifications WHERE owner=? AND state!='cancelled' AND due<=? ORDER BY due DESC LIMIT 100",
      )
      .bind(owner, timestamp)
      .all()
  ).results;
}
