import {
  guard,
  identity,
  result,
  listOccurrences,
  AppError,
  checkOrigin,
  json,
  requireOccurrence,
  db,
  uid,
  now,
} from "../../../lib/server";
export async function GET(req: Request) {
  return guard(async () => {
    const u = await identity(),
      url = new URL(req.url),
      from = url.searchParams.get("from") || now(),
      to =
        url.searchParams.get("to") ||
        new Date(Date.now() + 86400000).toISOString();
    if (
      !Number.isFinite(+new Date(from)) ||
      !Number.isFinite(+new Date(to)) ||
      +new Date(to) - +new Date(from) > 86400000 * 370
    )
      throw new AppError("조회 기간은 최대 370일입니다.");
    return result(await listOccurrences(u.userId, from, to));
  });
}
export async function POST(req: Request) {
  return guard(async () => {
    checkOrigin(req);
    const u = await identity(),
      i = await json(req);
    await requireOccurrence(u.userId, i.scheduleId, i.at);
    if (!["complete", "skipped", "pending", "snooze"].includes(i.status))
      throw new AppError("수행 상태를 확인하세요.");
    const snooze =
      i.status === "snooze"
        ? new Date(Date.now() + 600000).toISOString()
        : null;
    await db().batch([
      db()
        .prepare(
          "INSERT INTO instances (id,owner,schedule_id,at,status,snooze,updated) VALUES (?,?,?,?,?,?,?) ON CONFLICT(schedule_id,at) DO UPDATE SET status=excluded.status,snooze=excluded.snooze,updated=excluded.updated",
        )
        .bind(
          uid(),
          u.userId,
          i.scheduleId,
          i.at,
          i.status === "snooze" ? "pending" : i.status,
          snooze,
          now(),
        ),
      db()
        .prepare(
          "UPDATE notifications SET state='cancelled' WHERE owner=? AND schedule_id=? AND at=?",
        )
        .bind(u.userId, i.scheduleId, i.at),
    ]);
    return result({ ok: true });
  });
}
