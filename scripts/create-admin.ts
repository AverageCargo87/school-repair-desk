/**
 * npm run create-admin -- <логин> <пароль> [ФИО]
 * Создаёт администратора или обновляет ему пароль (роль admin, активен). Печатает ссылку для входа.
 * Можно через переменные: ADMIN_LOGIN, ADMIN_PASSWORD, ADMIN_NAME.
 */
import "dotenv/config";
import { db } from "../db/index";
import { isValidLogin, upsertAdmin } from "../lib/roster";

async function main() {
  const login = (process.argv[2] || process.env.ADMIN_LOGIN || "").trim().toLowerCase();
  const password = process.argv[3] || process.env.ADMIN_PASSWORD || "";
  const fullName = process.argv.slice(4).join(" ") || process.env.ADMIN_NAME || undefined;
  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");

  if (!login || !password) {
    console.error(
      "Использование: npm run create-admin -- <логин> <пароль> [ФИО]\n" +
        "или задайте ADMIN_LOGIN и ADMIN_PASSWORD в окружении.",
    );
    process.exit(1);
  }
  if (!isValidLogin(login)) {
    console.error("Логин: латиница в нижнем регистре, цифры, «.», «-», «_», 2–32 символа.");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Пароль должен быть не короче 8 символов.");
    process.exit(1);
  }

  const res = await upsertAdmin(db, { login, password, fullName, appUrl });
  console.log(`${res.existed ? "Обновлён" : "Создан"} администратор: ${res.login} (${res.fullName})`);
  console.log(`Ссылка для входа: ${res.link}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
