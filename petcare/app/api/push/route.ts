import {
  guard,
  identity,
  db,
  result,
  checkOrigin,
  json,
  uid,
  now,
  config,
  AppError,
} from "../../../lib/server";
import { validEndpoint } from "../../../lib/webpush";
export async function POST(req: Request) {
  return guard(async () => {
    checkOrigin(req);
    const u = await identity(),
      i = await json(req);
    if (
      !config().VAPID_PUBLIC_KEY ||
      !config().VAPID_PRIVATE_KEY ||
      !config().CRON_SECRET
    )
      throw new AppError("서버 웹 푸시 설정이 필요합니다.", 503);
    if (!validEndpoint(i.endpoint))
      throw new AppError("지원하지 않는 알림 서버입니다.");
    await db()
      .prepare(
        "INSERT INTO subscriptions (id,owner,endpoint,created) VALUES (?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET owner=excluded.owner",
      )
      .bind(uid(), u.userId, i.endpoint, now())
      .run();
    return result({ ok: true });
  });
}
export async function DELETE(req: Request) {
  return guard(async () => {
    checkOrigin(req);
    const u = await identity(),
      i = await json(req);
    await db()
      .prepare("DELETE FROM subscriptions WHERE owner=? AND endpoint=?")
      .bind(u.userId, i.endpoint)
      .run();
    return result({ ok: true });
  });
}
