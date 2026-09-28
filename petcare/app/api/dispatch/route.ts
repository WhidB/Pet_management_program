import {
  guard,
  db,
  result,
  syncNotifications,
  config,
  now,
  AppError,
} from "../../../lib/server";
import { wake } from "../../../lib/webpush";
export async function POST(req: Request) {
  return guard(async () => {
    const secret = config().CRON_SECRET;
    if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
      throw new AppError("인증이 필요합니다.", 401);
    const subscribers = (
      await db().prepare("SELECT * FROM subscriptions").all<any>()
    ).results;
    let sent = 0,
      failed = 0;
    for (const owner of new Set(subscribers.map((s) => s.owner))) {
      const items: any[] = await syncNotifications(owner);
      if (
        !items.some(
          (n) =>
            n.state === "pending" &&
            !n.device_claim &&
            Date.now() - Date.parse(n.due) < 15 * 60000,
        )
      )
        continue;
      for (const s of subscribers.filter((s) => s.owner === owner)) {
        try {
          const r = await wake(s.endpoint);
          if (r.status === 404 || r.status === 410)
            await db()
              .prepare("DELETE FROM subscriptions WHERE id=?")
              .bind(s.id)
              .run();
          if (r.ok) sent++;
          else failed++;
        } catch {
          failed++;
        }
      }
    }
    await db()
      .prepare(
        "INSERT INTO runtime_status (id,value) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
      )
      .bind("last_dispatch", JSON.stringify({ at: now(), sent, failed }))
      .run();
    return result({ sent, failed });
  });
}
