import { db, guard, result, checkOrigin, json, now, identity } from "../../../lib/server";
export async function POST(req: Request) {
  return guard(async () => {
    checkOrigin(req);
    const user = await identity();
    const input = await json(req);
    let zone = "Asia/Seoul";
    try { if (typeof input.timezone === "string") { new Intl.DateTimeFormat("en", { timeZone: input.timezone }).format(); zone = input.timezone; } } catch {}
    await db().prepare("INSERT OR IGNORE INTO profiles (id,name,timezone,created) VALUES (?,?,?,?)").bind(user.userId, user.displayName, zone, now()).run();
    return result({ ok: true });
  });
}
