import { AppError } from "./server";
export async function boundedFormData(req: Request) {
  const limit = 11 * 1024 * 1024,
    reader = req.body?.getReader();
  if (!reader) throw new AppError("파일을 선택하세요.");
  const parts: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > limit) {
      await reader.cancel();
      throw new AppError("파일은 최대 10MB입니다.", 413);
    }
    parts.push(value);
  }
  const buffer = new Uint8Array(length);
  let offset = 0;
  for (const p of parts) {
    buffer.set(p, offset);
    offset += p.length;
  }
  return new Request(req.url, {
    method: "POST",
    headers: req.headers,
    body: buffer,
  }).formData();
}
