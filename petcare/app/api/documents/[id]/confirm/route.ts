import {
  guard,
  identity,
  own,
  db,
  result,
  checkOrigin,
  json,
  uid,
  now,
  AppError,
} from "../../../../../lib/server";
import { sanitizeExtraction } from "../../../../../lib/documents";
export async function POST(req: Request, { params }: any) {
  return guard(async () => {
    checkOrigin(req);
    const u = await identity(),
      { id } = await params,
      d = await own("documents", id, u.userId),
      input = await json(req);
    if (input.reviewed !== true)
      throw new AppError("원본 확인에 동의해야 저장할 수 있습니다.");
    if (d.purpose !== "document") throw new AppError("처방 문서를 선택하세요.");
    if (d.status === "analyzing")
      throw new AppError("분석 완료 후 다시 시도하세요.", 409);
    const fields = sanitizeExtraction(input.fields),
      rid = uid();
    await db().batch([
      db()
        .prepare(
          "INSERT INTO records (id,owner,pet_id,document_id,data,created) VALUES (?,?,?,?,?,?) ON CONFLICT(owner,document_id) DO UPDATE SET data=excluded.data",
        )
        .bind(rid, u.userId, d.pet_id, id, JSON.stringify({ fields }), now()),
      db()
        .prepare(
          "UPDATE documents SET status='confirmed',data=? WHERE id=? AND owner=?",
        )
        .bind(
          JSON.stringify({ ...JSON.parse(d.data), fields, confirmedAt: now() }),
          id,
          u.userId,
        ),
    ]);
    return result({ ok: true });
  });
}
