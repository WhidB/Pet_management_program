import {
  guard,
  identity,
  result,
  syncNotifications,
  db,
  checkOrigin,
  json,
  own,
  now,
  config,
} from "../../../lib/server";
export async function GET() {
  return guard(async () => {
    const u = await identity(),
      cfg = config();
    const last = await db()
      .prepare("SELECT value FROM runtime_status WHERE id='last_dispatch'")
      .first<any>();
    return result({
      lastDispatch: last ? JSON.parse(last.value) : null,
      items: await syncNotifications(u.userId),
      aiConfigured: !!cfg.OPENAI_API_KEY,
      pushConfigured:
        !!cfg.VAPID_PUBLIC_KEY && !!cfg.VAPID_PRIVATE_KEY && !!cfg.CRON_SECRET,
      publicKey: cfg.VAPID_PUBLIC_KEY || null,
      backgroundStatus: "정기 발송 서비스 연결 필요",
    });
  });
}
export async function POST(req: Request) {
  return guard(async () => {
    checkOrigin(req);
    const u = await identity(),
      input = await json(req);
    await own("notifications", input.id, u.userId);
    if (input.action === "read") {
      await db()
        .prepare(
          "UPDATE notifications SET state='read' WHERE id=? AND owner=? AND state!='cancelled'",
        )
        .bind(input.id, u.userId)
        .run();
      return result({ ok: true });
    }
    const row = await db()
      .prepare(
        "UPDATE notifications SET device_claim=? WHERE id=? AND owner=? AND device_claim IS NULL AND state='pending' AND due<=? AND EXISTS(SELECT 1 FROM schedules s WHERE s.id=notifications.schedule_id AND s.owner=notifications.owner AND s.deleted=0 AND (s.cutoff IS NULL OR notifications.at<s.cutoff) AND s.version=notifications.version) AND NOT EXISTS(SELECT 1 FROM instances i WHERE i.schedule_id=notifications.schedule_id AND i.at=notifications.at AND i.status!='pending') RETURNING *",
      )
      .bind(now(), input.id, u.userId, now())
      .first();
    return result({ claimed: !!row, item: row });
  });
}
