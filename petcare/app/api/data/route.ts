import {
  guard,
  identity,
  db,
  rows,
  decode,
  result,
  json,
  checkOrigin,
  now,
} from "../../../lib/server";
export async function GET() {
  return guard(async () => {
    const u = await identity(),
      profile = await db()
        .prepare("SELECT * FROM profiles WHERE id=?")
        .bind(u.userId)
        .first();
    return result({
      user: { name: u.displayName, email: u.email },
      profile,
      pets: (await rows("pets", u.userId)).map(decode),
      schedules: (await rows("schedules", u.userId))
        .filter((x) => !x.deleted)
        .map(decode),
      documents: (await rows("documents", u.userId))
        .filter((x) => x.purpose === "document")
        .map(decode),
      records: (await rows("records", u.userId)).map(decode),
    });
  });
}
export async function POST(req: Request) {
  return guard(async () => {
    checkOrigin(req);
    const u = await identity(),
      d = await json(req);
    new Intl.DateTimeFormat("ko", { timeZone: d.timezone }).format();
    await db()
      .prepare(
        "INSERT INTO profiles (id,name,timezone,created) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,timezone=excluded.timezone",
      )
      .bind(
        u.userId,
        String(d.name || u.displayName).slice(0, 100),
        d.timezone,
        now(),
      )
      .run();
    return result({ ok: true });
  });
}
