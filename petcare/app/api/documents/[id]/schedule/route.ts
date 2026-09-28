import {
  guard,
  identity,
  own,
  db,
  result,
  checkOrigin,
  json,
  uid,
  scheduleInput,
  AppError,
} from "../../../../../lib/server";
export async function POST(req: Request, { params }: any) {
  return guard(async () => {
    checkOrigin(req);
    const u = await identity(),
      { id } = await params,
      d = await own("documents", id, u.userId);
    if (d.status !== "confirmed")
      throw new AppError("먼저 문서를 검토하고 확정하세요.", 409);
    const input = await json(req);
    if (input.reviewed !== true)
      throw new AppError("일정 내용을 직접 확인해야 합니다.");
    const s = await scheduleInput(u.userId, {
      ...input.schedule,
      petId: d.pet_id,
      documentId: id,
    });
    const sourceKey = `document:${id}:${s.kind}:${s.kind === "medicine" ? s.medication.name.trim() : s.title.trim()}:${s.rule.start}`;
    const previous = await db()
      .prepare("SELECT id FROM schedules WHERE owner=? AND source_key=?")
      .bind(u.userId, sourceKey)
      .first();
    if (previous) return result({ ...previous, duplicate: true });
    const sid = uid();
    await db()
      .prepare(
        "INSERT OR IGNORE INTO schedules (id,owner,pet_id,data,version,deleted,source_key) VALUES (?,?,?,?,1,0,?)",
      )
      .bind(sid, u.userId, d.pet_id, JSON.stringify(s), sourceKey)
      .run();
    const saved = await db()
      .prepare("SELECT id FROM schedules WHERE owner=? AND source_key=?")
      .bind(u.userId, sourceKey)
      .first();
    return result({ ...saved, duplicate: saved?.id !== sid });
  });
}
