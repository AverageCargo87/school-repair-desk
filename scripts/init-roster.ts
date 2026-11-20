/**
 * npm run roster:init — для прода: идемпотентно заводит здания и сотрудников из data/roster.json.
 * Существующих (по ФИО) не трогает. Новым — логин, случайный пароль и ссылка для входа,
 * они дописываются в data/credentials.local.csv и печатаются в консоль.
 *
 * Аргументы: [путь к roster.json] (по умолчанию data/roster.json)
 *            [--passwords <csv>] — заранее выданные пароли: «ФИО;Роль;Логин;Пароль» (разделитель «;»).
 *            Новым сотрудникам ставится пароль из файла (по ФИО), остальным — случайный.
 * Переменные: DATABASE_URL (прод) или PGLITE_PATH (локально), APP_URL — адрес сайта для ссылок.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { db } from "../db/index";
import {
  CREDENTIALS_PATH,
  generatePassword,
  loadRoster,
  printCredentials,
  ROSTER_PATH,
  syncRoster,
  writeCredentialsCsv,
} from "../lib/roster";

const normName = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/** ФИО → {логин, пароль} из CSV «ФИО;Роль;Логин;Пароль». */
function loadPasswords(file: string): Map<string, { login: string; password: string }> {
  const lines = readFileSync(file, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
  const map = new Map<string, { login: string; password: string }>();
  for (const line of lines.slice(1)) {
    const [fullName, , login, password] = line.split(";").map((s) => s.trim());
    if (fullName && password) map.set(normName(fullName), { login, password });
  }
  return map;
}

async function main() {
  const args = process.argv.slice(2);
  const pwIdx = args.indexOf("--passwords");
  const pwFile = pwIdx >= 0 ? args[pwIdx + 1] : undefined;
  if (pwIdx >= 0 && !pwFile) throw new Error("После --passwords укажите путь к CSV");
  const positional = args.filter((_, i) => i !== pwIdx && i !== pwIdx + 1);
  const file = positional[0] ? path.resolve(positional[0]) : ROSTER_PATH;
  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  const roster = loadRoster(file);
  const given = pwFile ? loadPasswords(path.resolve(pwFile)) : new Map();
  if (pwFile) console.log(`Пароли из файла: ${given.size}`);

  const result = await db.transaction((tx) =>
    syncRoster(tx, roster, {
      appUrl,
      passwordFor: (person) => given.get(normName(person.fullName))?.password ?? generatePassword(),
    }),
  );

  // Сверка: логины, которые получились, должны совпасть с выданными в файле.
  for (const c of result.created) {
    const g = given.get(normName(c.fullName));
    if (g && g.login && g.login !== c.login) {
      console.warn(`ВНИМАНИЕ: у «${c.fullName}» логин ${c.login}, а в файле ${g.login}`);
    }
    if (pwFile && !g) console.warn(`Нет пароля в файле для «${c.fullName}» — выдан случайный`);
  }

  console.log(`Файл: ${file}`);
  console.log(
    `Новых зданий: ${result.createdBuildings.length}` +
      (result.createdBuildings.length ? ` (${result.createdBuildings.join("; ")})` : ""),
  );
  console.log(`Новых сотрудников: ${result.created.length}, уже были: ${result.skipped.length}`);
  if (result.created.length) {
    console.log("");
    printCredentials(result.created);
    writeCredentialsCsv(result.created, "append");
    console.log(`\nДописано в ${path.relative(process.cwd(), CREDENTIALS_PATH)}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
