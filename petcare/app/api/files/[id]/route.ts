import { guard, identity, own, bucket, AppError } from "../../../../lib/server";
export async function GET(req: Request, { params }: any) {
  return guard(async () => {
    const u = await identity(),
      { id } = await params,
      d = await own("documents", id, u.userId),
      object = await bucket().get(d.object_key);
    if (!object) throw new AppError("파일을 찾을 수 없습니다.", 404);
    return new Response(object.body as any, {
      headers: {
        "Content-Type": d.mime,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(d.name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  });
}
