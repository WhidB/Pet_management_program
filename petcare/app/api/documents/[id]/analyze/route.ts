import {
  guard,
  identity,
  own,
  bucket,
  db,
  result,
  checkOrigin,
  AppError,
} from "../../../../../lib/server";
import { extract } from "../../../../../lib/documents";
export async function POST(req: Request, { params }: any) {
  return guard(async () => {
    checkOrigin(req);
    const u = await identity(),
      { id } = await params,
      d = await own("documents", id, u.userId);
    if (d.purpose !== "document" || d.status === "confirmed")
      throw new AppError("이미 확정된 문서이거나 분석 대상이 아닙니다.", 409);
    if (
      d.status === "analyzing" &&
      Date.now() -
        Date.parse(JSON.parse(d.data).analysisStarted || "1970-01-01") <
        90000
    )
      throw new AppError("분석 중입니다. 잠시 후 다시 확인하세요.", 409);
    const lease = await db()
      .prepare(
        "UPDATE documents SET status='analyzing',data=? WHERE id=? AND owner=? AND data=? RETURNING id",
      )
      .bind(
        JSON.stringify({
          ...JSON.parse(d.data),
          analysisStarted: new Date().toISOString(),
        }),
        id,
        u.userId,
        d.data,
      )
      .first();
    if (!lease)
      throw new AppError(
        "다른 분석이 시작되었습니다. 잠시 후 다시 확인하세요.",
        409,
      );
    try {
      const object = await bucket().get(d.object_key);
      if (!object) throw new AppError("원본 파일을 찾을 수 없습니다.", 404);
      const analysis = await extract(await object.arrayBuffer(), d.mime);
      await db()
        .prepare(
          "UPDATE documents SET status='review',data=? WHERE id=? AND owner=?",
        )
        .bind(JSON.stringify(analysis), id, u.userId)
        .run();
      return result(analysis);
    } catch (e) {
      await db()
        .prepare("UPDATE documents SET status='failed' WHERE id=? AND owner=?")
        .bind(id, u.userId)
        .run();
      throw e;
    }
  });
}
