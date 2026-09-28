import { boundedFormData } from "../../../lib/request-body";
import {
  guard,
  identity,
  own,
  db,
  bucket,
  result,
  checkOrigin,
  uid,
  now,
  AppError,
} from "../../../lib/server";
import { detectMime, emptyExtraction } from "../../../lib/documents";
export async function POST(req: Request) {
  return guard(async () => {
    checkOrigin(req);
    const u = await identity();
    if (Number(req.headers.get("content-length") || 0) > 11 * 1024 * 1024)
      throw new AppError("파일은 최대 10MB입니다.", 413);
    const form = await boundedFormData(req),
      file = form.get("file"),
      petId = String(form.get("petId") || ""),
      purpose = form.get("purpose") === "photo" ? "photo" : "document";
    await own("pets", petId, u.userId);
    if (
      !(file instanceof File) ||
      file.size === 0 ||
      file.size > 10 * 1024 * 1024
    )
      throw new AppError("1바이트~10MB 파일을 선택하세요.", 413);
    const bytes = await file.arrayBuffer(),
      mime = detectMime(new Uint8Array(bytes));
    if (purpose === "photo" && mime === "application/pdf")
      throw new AppError("사진은 이미지 파일을 선택하세요.");
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    )
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const existing = await db()
      .prepare(
        "SELECT id FROM documents WHERE owner=? AND pet_id=? AND hash=? AND purpose=?",
      )
      .bind(u.userId, petId, hash, purpose)
      .first();
    if (existing) return result({ ...existing, duplicate: true });
    const id = uid(),
      key = `${u.userId}/${id}`;
    await bucket().put(key, bytes, { httpMetadata: { contentType: mime } });
    try {
      await db()
        .prepare(
          "INSERT INTO documents (id,owner,pet_id,name,mime,hash,object_key,purpose,status,data,created) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          u.userId,
          petId,
          file.name.slice(0, 200),
          mime,
          hash,
          key,
          purpose,
          purpose === "photo" ? "confirmed" : "uploaded",
          JSON.stringify({ fields: emptyExtraction(), mode: "manual" }),
          now(),
        )
        .run();
    } catch (e) {
      await bucket().delete(key);
      const race = await db()
        .prepare(
          "SELECT id FROM documents WHERE owner=? AND pet_id=? AND hash=? AND purpose=?",
        )
        .bind(u.userId, petId, hash, purpose)
        .first();
      if (race) return result({ ...race, duplicate: true });
      throw e;
    }
    return result({ id, duplicate: false });
  });
}
