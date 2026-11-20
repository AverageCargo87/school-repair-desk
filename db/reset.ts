import { existsSync, rmSync } from "node:fs";

if (process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL задан — сброс запрещён. db:reset работает только для локальной PGlite-базы разработки.",
  );
  process.exit(1);
}

const path = process.env.PGLITE_PATH || ".pgdata";

if (existsSync(path)) {
  rmSync(path, { recursive: true, force: true });
  console.log(`Локальная база удалена: ${path}`);
} else {
  console.log(`Нечего удалять: ${path} не существует`);
}
