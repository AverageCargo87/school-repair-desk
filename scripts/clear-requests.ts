/**
 * npm run requests:clear -- --yes
 * Удаляет ВСЕ заявки (с историей, соисполнителями и фото) и файлы фото из UPLOAD_DIR.
 * Сотрудники, здания и доступы остаются. Нумерация заявок начинается снова с № 1.
 * Без --yes только показывает, сколько будет удалено.
 * На проде: docker compose exec app node tools/clear-requests.mjs --yes
 */
import "dotenv/config";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { count, sql } from "drizzle-orm";
import { db } from "../db/index";
import { requestEvents, requestPhotos, requests } from "../db/schema";

function uploadDir(): string {
  return process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(process.cwd(), "uploads");
}

async function main() {
  const yes = process.argv.includes("--yes");
  const [r] = await db.select({ n: count() }).from(requests);
  const [e] = await db.select({ n: count() }).from(requestEvents);
  const photos = await db.select({ id: requestPhotos.id }).from(requestPhotos);
  console.log(`Заявок: ${r.n}, событий: ${e.n}, фото: ${photos.length} (каталог ${uploadDir()})`);

  if (!yes) {
    console.log("Ничего не удалено. Чтобы удалить всё перечисленное, запустите с флагом --yes.");
    process.exit(0);
  }

  await db.execute(
    sql`TRUNCATE TABLE request_photos, request_events, request_coexecutors, requests RESTART IDENTITY CASCADE`,
  );

  // Удаляем все файлы фото (имена — 32 hex; посторонние файлы не трогаем).
  let removed = 0;
  try {
    for (const name of await readdir(uploadDir())) {
      if (!/^[a-f0-9]{32}$/.test(name)) continue;
      await rm(path.join(uploadDir(), name), { force: true });
      removed += 1;
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  console.log(`Готово: заявки удалены, файлов фото удалено: ${removed}. Сотрудники и здания на месте.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
