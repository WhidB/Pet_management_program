import {
  guard,
  identity,
  db,
  own,
  result,
  json,
  checkOrigin,
  uid,
  AppError,
} from "../../../lib/server";
export async function POST(req: Request) {
  return guard(async () => {
    checkOrigin(req);
    const u = await identity(),
      p = await json(req);
    if (!p.name?.trim() || p.name.length > 60)
      throw new AppError("이름은 1~60자로 입력하세요.");
    if (
      p.weight !== "" &&
      (!Number.isFinite(Number(p.weight)) || Number(p.weight) < 0)
    )
      throw new AppError("체중을 확인하세요.");
    if (p.id) await own("pets", p.id, u.userId);
    if (p.photoId) {
      const d = await own("documents", p.photoId, u.userId);
      if (d.purpose !== "photo" || d.pet_id !== p.id)
        throw new AppError("이 반려동물의 사진을 선택하세요.");
    }
    const id = p.id || uid(),
      data = {
        name: p.name,
        species: p.species,
        breed: p.breed || "",
        birthday: p.birthday || "",
        sex: p.sex || "unknown",
        weight: p.weight || "",
        notes: String(p.notes || "").slice(0, 4000),
        photoId: p.photoId || null,
      };
    await db()
      .prepare(
        "INSERT INTO pets (id,owner,data) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data WHERE pets.owner=excluded.owner",
      )
      .bind(id, u.userId, JSON.stringify(data))
      .run();
    return result({ id, ...data });
  });
}
