import {
  guard,
  identity,
  db,
  own,
  decode,
  result,
  json,
  checkOrigin,
  uid,
  scheduleInput,
  requireOccurrence,
  AppError,
} from "../../../lib/server";
export async function POST(req: Request) {
  return guard(async () => {
    checkOrigin(req);
    const u = await identity(),
      s = await scheduleInput(u.userId, await json(req)),
      id = uid();
    await db()
      .prepare(
        "INSERT INTO schedules (id,owner,pet_id,data,version,deleted,source_key) VALUES (?,?,?,?,1,0,?)",
      )
      .bind(id, u.userId, s.petId, JSON.stringify(s), null)
      .run();
    return result({ id });
  });
}
export async function PATCH(req: Request) {
  return guard(async () => {
    checkOrigin(req);
    const u = await identity(),
      i = await json(req),
      old = await own("schedules", i.id, u.userId);
    if (old.version !== i.version)
      throw new AppError("다른 화면에서 변경되었습니다. 새로고침하세요.", 409);
    const s = await scheduleInput(u.userId, i.data),
      statements = [];
    await requireOccurrence(u.userId, old.id, i.at);
    if (i.scope === "one") {
      if (!i.newAt || !Number.isFinite(+new Date(i.newAt)))
        throw new AppError("변경 시각을 입력하세요.");
      if (s.petId !== decode(old).petId)
        throw new AppError("개별 회차의 반려동물은 변경할 수 없습니다.");
      statements.push(
        db()
          .prepare(
            "INSERT INTO instances (id,owner,schedule_id,at,status,override,updated) VALUES (?,?,?,?,'pending',?,?) ON CONFLICT(schedule_id,at) DO UPDATE SET override=excluded.override,snooze=NULL,updated=excluded.updated",
          )
          .bind(
            uid(),
            u.userId,
            old.id,
            i.at,
            JSON.stringify({
              title: s.title,
              kind: s.kind,
              notes: s.notes,
              medication: s.medication,
              at: new Date(i.newAt).toISOString(),
              reminder: s.reminder,
              notify: s.notify,
            }),
            new Date().toISOString(),
          ),
      );
      statements.push(
        db()
          .prepare(
            "DELETE FROM notifications WHERE owner=? AND schedule_id=? AND at=?",
          )
          .bind(u.userId, old.id, i.at),
      );
    } else if (i.scope === "future") {
      statements.push(
        db()
          .prepare(
            "UPDATE schedules SET cutoff=?,version=version+1 WHERE id=? AND owner=?",
          )
          .bind(i.at, old.id, u.userId),
      );
      statements.push(
        db()
          .prepare(
            "INSERT INTO schedules (id,owner,pet_id,data,version,deleted) VALUES (?,?,?,?,1,0)",
          )
          .bind(
            uid(),
            u.userId,
            s.petId,
            JSON.stringify({ ...s, rule: { ...s.rule, notBefore: i.at } }),
          ),
      );
      statements.push(
        db()
          .prepare(
            "UPDATE notifications SET state='cancelled' WHERE owner=? AND schedule_id=? AND at>=?",
          )
          .bind(u.userId, old.id, i.at),
      );
    } else throw new AppError("이번 회차 또는 이후 회차를 선택하세요.");
    await db().batch(statements);
    return result({ ok: true });
  });
}
export async function DELETE(req: Request) {
  return guard(async () => {
    checkOrigin(req);
    const u = await identity(),
      i = await json(req);
    await own("schedules", i.id, u.userId);
    await db().batch([
      db()
        .prepare(
          "UPDATE schedules SET deleted=1,version=version+1 WHERE id=? AND owner=?",
        )
        .bind(i.id, u.userId),
      db()
        .prepare(
          "UPDATE notifications SET state='cancelled' WHERE schedule_id=? AND owner=?",
        )
        .bind(i.id, u.userId),
    ]);
    return result({ ok: true });
  });
}
