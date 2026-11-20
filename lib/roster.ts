/**
 * Сотрудники и здания из data/roster.json: транслит логинов, генерация паролей,
 * загрузка файла и идемпотентная синхронизация с БД (для сида и roster:init).
 * Серверный модуль (node:fs, node:crypto) — не импортировать в клиентские компоненты.
 */
import { randomInt } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { DbOrTx } from "@/db";
import { buildings, userBuildings, users, type Role } from "@/db/schema";
import { generateToken, hashPassword, sha256 } from "@/lib/crypto";
import { roleLabels } from "@/lib/labels";

// ─── Транслит ────────────────────────────────────────────────

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

/** Транслит кириллицы в латиницу (ГОСТ-подобный): «Холодов» → «kholodov». */
export function translit(input: string): string {
  let out = "";
  for (const ch of input.toLowerCase()) {
    if (ch in TRANSLIT) out += TRANSLIT[ch];
    else if (/[a-z0-9]/.test(ch)) out += ch;
  }
  return out;
}

/** Допустимый логин: латиница в нижнем регистре, цифры, точка, дефис, подчёркивание. */
export const LOGIN_RE = /^[a-z][a-z0-9._-]{1,31}$/;

export function isValidLogin(login: string): boolean {
  return LOGIN_RE.test(login);
}

/** Логин по фамилии: «Мухина Анна Сергеевна» → «mukhina». */
export function loginBase(fullName: string): string {
  const [surname = ""] = fullName.trim().split(/\s+/);
  const base = translit(surname).slice(0, 24);
  return base && /^[a-z]/.test(base) ? base : "user";
}

/**
 * Что ввели в поле «Логин или фамилия» → логин для поиска в базе.
 * Есть кириллица («Петров», «петров Д. В.») — первое слово транслитом, как логин делает
 * loginBase: «petrov». Иначе — как есть: без пробелов по краям и в нижнем регистре.
 */
export function normalizeLoginInput(raw: string): string {
  const s = raw.normalize("NFC").trim().toLowerCase();
  if (!/[а-яё]/.test(s)) return s;
  const [first = ""] = s.split(/[\s.,;]+/);
  return translit(first).slice(0, 24);
}

/**
 * Уникальный логин: фамилия → фамилия.инициал → фамилия.инициалы → фамилия2, 3…
 * `taken` — уже занятые логины (функция не изменяет набор).
 */
export function uniqueLogin(fullName: string, taken: ReadonlySet<string>): string {
  const base = loginBase(fullName);
  const parts = fullName.trim().split(/\s+/).slice(1);
  const initials = parts.map((p) => translit(p[0] ?? "").slice(0, 1)).filter(Boolean);
  const candidates = [base];
  if (initials[0]) candidates.push(`${base}.${initials[0]}`);
  if (initials.length > 1) candidates.push(`${base}.${initials.join("")}`);
  for (const c of candidates) if (!taken.has(c)) return c;
  for (let n = 2; ; n++) {
    const c = `${base}${n}`;
    if (!taken.has(c)) return c;
  }
}

// ─── Пароли ──────────────────────────────────────────────────

/** Без похожих символов: нет 0/o, 1/l/i. */
const PASSWORD_LETTERS = "abcdefghjkmnpqrstuvwxyz";
const PASSWORD_DIGITS = "23456789";
const PASSWORD_ALPHABET = PASSWORD_LETTERS + PASSWORD_DIGITS;

/** Случайный пароль (по умолчанию 8 символов), есть и буквы, и цифры. */
export function generatePassword(length = 8): string {
  for (;;) {
    let p = "";
    for (let i = 0; i < length; i++) {
      p += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
    }
    if (/[a-z]/.test(p) && /[0-9]/.test(p)) return p;
  }
}

// ─── Файл roster.json ────────────────────────────────────────

const rosterSchema = z.object({
  buildings: z.array(z.string().trim().min(1)),
  requesters: z.array(
    z.object({
      fullName: z.string().trim().min(1),
      buildings: z.array(z.string().trim().min(1)),
    }),
  ),
  dispatchers: z.array(
    z.object({ fullName: z.string().trim().min(1), position: z.string().optional() }),
  ),
  executors: z.array(z.object({ fullName: z.string().trim().min(1) })),
});

export type Roster = z.infer<typeof rosterSchema>;

export type RosterPerson = {
  fullName: string;
  role: Role;
  /** Адреса зданий (только для заявителей). */
  buildings: string[];
};

export const ROSTER_PATH = path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "roster.json");

export function loadRoster(file: string = ROSTER_PATH): Roster {
  const raw = JSON.parse(readFileSync(file, "utf8"));
  const roster = rosterSchema.parse(raw);
  const known = new Set(roster.buildings);
  for (const r of roster.requesters) {
    for (const b of r.buildings) {
      if (!known.has(b)) {
        throw new Error(`roster.json: здание «${b}» у ${r.fullName} нет в списке buildings`);
      }
    }
  }
  return roster;
}

/** Все сотрудники одним списком с ролями. */
export function rosterPeople(roster: Roster): RosterPerson[] {
  return [
    ...roster.dispatchers.map((p) => ({
      fullName: p.fullName,
      role: "dispatcher" as const,
      buildings: [],
    })),
    ...roster.requesters.map((p) => ({
      fullName: p.fullName,
      role: "requester" as const,
      buildings: p.buildings,
    })),
    ...roster.executors.map((p) => ({
      fullName: p.fullName,
      role: "executor" as const,
      buildings: [],
    })),
  ];
}

// ─── Синхронизация с БД ──────────────────────────────────────

export type IssuedCredential = {
  userId: number;
  fullName: string;
  role: Role;
  login: string;
  password: string;
  /** Персональная ссылка входа: `${appUrl}/t/<token>`. */
  link: string;
};

export type SyncRosterResult = {
  createdBuildings: string[];
  created: IssuedCredential[];
  /** ФИО, которые уже были в базе (их не трогали). */
  skipped: string[];
};

function normName(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Идемпотентно заводит здания и сотрудников из roster.json.
 * Существующих (по ФИО, без учёта регистра) не трогает. Новым — логин, пароль, ссылка.
 * `passwordFor` — свой пароль (для демо-сида), по умолчанию случайный.
 */
export async function syncRoster(
  dbx: DbOrTx,
  roster: Roster,
  opts: { appUrl: string; passwordFor?: (person: RosterPerson) => string },
): Promise<SyncRosterResult> {
  const result: SyncRosterResult = { createdBuildings: [], created: [], skipped: [] };

  // Здания
  const existingBuildings = await dbx.select().from(buildings);
  const byAddress = new Map(existingBuildings.map((b) => [b.address, b.id]));
  for (const address of roster.buildings) {
    if (byAddress.has(address)) continue;
    const [row] = await dbx.insert(buildings).values({ address }).returning();
    byAddress.set(address, row.id);
    result.createdBuildings.push(address);
  }

  // Сотрудники
  const existingUsers = await dbx
    .select({ id: users.id, fullName: users.fullName, login: users.login })
    .from(users);
  const takenLogins = new Set(existingUsers.map((u) => u.login));
  const existingNames = new Set(existingUsers.map((u) => normName(u.fullName)));

  for (const person of rosterPeople(roster)) {
    if (existingNames.has(normName(person.fullName))) {
      result.skipped.push(person.fullName);
      continue;
    }
    const login = uniqueLogin(person.fullName, takenLogins);
    takenLogins.add(login);
    const password = opts.passwordFor?.(person) ?? generatePassword();
    const token = generateToken();
    const [user] = await dbx
      .insert(users)
      .values({
        fullName: person.fullName,
        login,
        role: person.role,
        passwordHash: hashPassword(password),
        loginTokenHash: sha256(token),
      })
      .returning({ id: users.id });
    existingNames.add(normName(person.fullName));

    if (person.buildings.length > 0) {
      await dbx.insert(userBuildings).values(
        person.buildings.map((address) => ({
          userId: user.id,
          buildingId: byAddress.get(address)!,
        })),
      );
    }
    result.created.push({
      userId: user.id,
      fullName: person.fullName,
      role: person.role,
      login,
      password,
      link: `${opts.appUrl}/t/${token}`,
    });
  }
  return result;
}

/** Создать администратора или обновить ему пароль/роль. */
export async function upsertAdmin(
  dbx: DbOrTx,
  input: { login: string; password: string; fullName?: string; appUrl: string },
): Promise<IssuedCredential & { existed: boolean }> {
  const login = input.login.trim().toLowerCase();
  if (!isValidLogin(login)) throw new Error(`Недопустимый логин: ${login}`);
  const token = generateToken();
  const existing = (await dbx.select().from(users).where(eq(users.login, login)).limit(1))[0];
  let userId: number;
  let fullName = input.fullName || existing?.fullName || "Администратор";
  if (existing) {
    await dbx
      .update(users)
      .set({
        role: "admin",
        active: true,
        passwordHash: hashPassword(input.password),
        loginTokenHash: sha256(token),
        ...(input.fullName ? { fullName: input.fullName } : {}),
      })
      .where(eq(users.id, existing.id));
    userId = existing.id;
    fullName = input.fullName || existing.fullName;
  } else {
    const [row] = await dbx
      .insert(users)
      .values({
        fullName,
        login,
        role: "admin",
        passwordHash: hashPassword(input.password),
        loginTokenHash: sha256(token),
      })
      .returning({ id: users.id });
    userId = row.id;
  }
  return {
    userId,
    fullName,
    role: "admin",
    login,
    password: input.password,
    link: `${input.appUrl}/t/${token}`,
    existed: Boolean(existing),
  };
}

// ─── Файл с паролями ─────────────────────────────────────────

export const CREDENTIALS_PATH = path.join(
  /*turbopackIgnore: true*/ process.cwd(),
  "data",
  "credentials.local.csv",
);

function csvCell(v: string): string {
  return /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/**
 * Записать логины/пароли/ссылки в CSV (разделитель «;», UTF-8 с BOM — открывается в Excel).
 * mode "overwrite" — переписать файл, "append" — дописать (заголовок — только в новый файл).
 */
export function writeCredentialsCsv(
  rows: IssuedCredential[],
  mode: "overwrite" | "append",
  file: string = CREDENTIALS_PATH,
): void {
  const header = ["ФИО", "Роль", "Логин", "Пароль", "Ссылка для входа", "Создано"];
  const stamp = new Date().toISOString();
  const lines = rows.map((r) =>
    [r.fullName, roleLabels[r.role], r.login, r.password, r.link, stamp].map(csvCell).join(";"),
  );
  if (mode === "append" && existsSync(file)) {
    if (lines.length) appendFileSync(file, lines.join("\r\n") + "\r\n", "utf8");
    return;
  }
  writeFileSync(file, "﻿" + [header.join(";"), ...lines].join("\r\n") + "\r\n", "utf8");
}

/** Печать таблицы учётных данных в консоль. */
export function printCredentials(rows: IssuedCredential[]): void {
  const w = Math.max(...rows.map((r) => r.login.length), 5);
  for (const r of rows) {
    console.log(
      `  ${r.login.padEnd(w)}  ${r.password.padEnd(10)}  ${roleLabels[r.role].padEnd(15)} ${r.fullName}`,
    );
    console.log(`  ${"".padEnd(w)}  ${r.link}`);
  }
}
