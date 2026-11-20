import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isValidPhotoId, readPhotoFile } from "@/lib/photos";
import { getPhotoForUser } from "@/lib/requests/queries";

/**
 * GET /photos/[id] — фото заявки. Отдаётся только тем, кто видит заявку.
 * ?download=1 — скачать с исходным именем файла.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Нужно войти", { status: 401 });
  if (!isValidPhotoId(id)) return new Response("Не найдено", { status: 404 });

  const photo = await getPhotoForUser(user, id);
  if (!photo) return new Response("Не найдено", { status: 404 });

  const data = await readPhotoFile(photo.id);
  if (!data) return new Response("Файл не найден", { status: 404 });

  const download = req.nextUrl.searchParams.get("download") === "1";
  const encodedName = encodeURIComponent(photo.fileName);
  return new Response(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": photo.mime,
      "Content-Length": String(data.byteLength),
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodedName}`,
    },
  });
}
