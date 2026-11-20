"use server";

/**
 * Server actions админки: сотрудники, доступы и здания.
 * Каждое действие начинается с requireRole(["admin"]) и проверяет ввод (zod).
 * Сигнатура для useActionState: (prev: AdminResult, formData: FormData) => Promise<AdminResult>.
 */

import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { toString as qrToString } from "qrcode";
import { z } from "zod";
import { db } from "@/db";
import {
  buildings,
  requestCoexecutors,
  requests,
  roleEnum,
  userBuildings,
  users,
} from "@/db/schema";
import {
  destroyUserSessions,
  issueLoginToken,
  requireRole,
  revokeLoginToken,
  setUserPassword,
} from "@/lib/auth";
import { appUrl } from "@/lib/app";
import { generatePassword, isValidLogin, uniqueLogin } from "@/lib/roster";
import { pluralRu } from "@/lib/utils";
import type { AccessCardData, AdminResult } from "./types";

// ─── Помощники ───────────────────────────────────────────────

async function requireAdmin() {
  return requireRole(["admin"]);
}

function str(fd: FormData, name: string): string {
  const v = fd.get(name);
  return typeof v === "string" ? v : "";
}

function positiveInt(raw: string): number | null {
  const s = raw.trim();
  return /^\d{1,9}$/.test(s) && Number(s) > 0 ? Number(s) : null;
}

function fail(error: string, fieldErrors?: Record<string, string>): AdminResult {
  return { ok: false, error, fieldErrors };
}

function zodFail(error: z.ZodError): AdminResult {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fail(error.issues[0]?.message ?? "Проверьте заполнение формы.", fieldErrors);
}

function isUniqueViolation(e: unknown): boolean {
  const code =
    (e as { code?: unknown })?.code ?? (e as { cause?: { code?: unknown } })?.cause?.code;
  return code === "23505";
}

function collapseSpaces(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Обновить всё: админку и экраны, где видны ФИО/здания. */
function revalidateAll() {
  revalidatePath("/", "layout");
}

/**
 * База для ссылок: APP_URL, если задан явно; иначе — из заголовков запроса
 * (X-Forwarded-Host/Proto от Traefik или Host); в крайнем случае appUrl().
 */
async function linkBase(): Promise<string> {
  if (process.env.APP_URL) return appUrl();
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim();
  if (!host || !/^[a-z0-9.-]+(:\d{1,5})?$|^\[[0-9a-f:]+\](:\d{1,5})?$/i.test(host)) {
    return appUrl();
  }
  const fwdProto = (h.get("x-forwarded-proto") ?? "").split(",")[0].trim().toLowerCase();
  const proto =
    fwdProto === "https" || fwdProto === "http"
      ? fwdProto
      : /^(localhost|127\.|\[::1\]|10\.|192\.168\.)/.test(host)
        ? "http"
        : "https";
  return `${proto}://${host}`;
}

async function activeAdminCount(): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.active, true)));
  return Number(rows[0]?.n ?? 0);
}

/** Активные заявки (Назначена/В работе), где сотрудник исполнитель или соисполнитель. */
async function activeWorkCount(userId: number): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(requests)
    .where(
      and(
        inArray(requests.status, ["assigned", "in_progress"]),
        sql`(${requests.executorId} = ${userId} or exists (select 1 from ${requestCoexecutors} where ${requestCoexecutors.requestId} = ${requests.id} and ${requestCoexecutors.userId} = ${userId}))`,
      ),
    );
  return Number(rows[0]?.n ?? 0);
}

function activeWorkWarning(n: number): string {
  return n > 0
    ? ` Внимание: у сотрудника ${n} ${pluralRu(n, ["активная заявка", "активные заявки", "активных заявок"])} — распределителю нужно их переназначить.`
    : "";
}

async function loadUser(id: number | null) {
  if (!id) return null;
  const rows = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      login: users.login,
      role: users.role,
      active: users.active,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return rows[0] ?? null;
}

// ─── Сотрудники ──────────────────────────────────────────────

const userSchema = z.object({
  fullName: z
    .string()
    .transform(collapseSpaces)
    .pipe(
      z
        .string()
        .min(3, "Введите ФИО полностью: фамилия, имя, отчество.")
        .max(120, "Слишком длинное ФИО."),
    ),
  login: z
    .string()
    .transform((s) => s.trim().toLowerCase())
    .pipe(z.string().max(32, "Логин — не длиннее 32 символов.")),
  role: z.enum(roleEnum.enumValues, { error: "Выберите роль." }),
  buildingIds: z.array(z.number().int().positive()).max(200),
});

/**
 * Создать или изменить сотрудника.
 * FormData: `userId` (пусто — новый), `fullName`, `login` (пусто при создании — подобрать по ФИО),
 * `role`, `buildingIds` (повтор чекбоксов; только для заявителя).
 * Создание → redirect на /admin/users/[id]?created=1.
 */
export async function saveUserAction(
  _prev: AdminResult,
  formData: FormData,
): Promise<AdminResult> {
  const me = await requireAdmin();

  const rawId = str(formData, "userId");
  const id = rawId ? positiveInt(rawId) : null;
  if (rawId && !id) return fail("Сотрудник не найден.");

  const parsed = userSchema.safeParse({
    fullName: str(formData, "fullName"),
    login: str(formData, "login"),
    role: str(formData, "role"),
    buildingIds: formData
      .getAll("buildingIds")
      .map((v) => (typeof v === "string" ? positiveInt(v) : null))
      .filter((v): v is number => v !== null),
  });
  if (!parsed.success) return zodFail(parsed.error);
  const input = parsed.data;
  const role = input.role;
  const buildingIds = role === "requester" ? [...new Set(input.buildingIds)] : [];

  const existing = await loadUser(id);
  if (id && !existing) return fail("Сотрудник не найден.");

  // Нельзя лишить себя или последнего администратора прав администратора.
  if (existing && existing.role === "admin" && role !== "admin") {
    if (existing.id === me.id) {
      return fail("Свою роль поменять нельзя.", { role: "Свою роль поменять нельзя." });
    }
    if (existing.active && (await activeAdminCount()) <= 1) {
      const msg = "Это последний администратор — сначала назначьте другого.";
      return fail(msg, { role: msg });
    }
  }

  // Логин: при создании пустой — подбираем по фамилии.
  let login = input.login;
  if (!login) {
    if (existing) return fail("Введите логин.", { login: "Введите логин." });
    const taken = new Set((await db.select({ login: users.login }).from(users)).map((r) => r.login));
    login = uniqueLogin(input.fullName, taken);
  }
  if (!isValidLogin(login)) {
    const msg =
      "Логин: латинские буквы, цифры, точка, дефис или подчёркивание, начинается с буквы, 2–32 символа.";
    return fail(msg, { login: msg });
  }
  const clash = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.login, login), ne(users.id, existing?.id ?? 0)))
    .limit(1);
  if (clash.length) {
    const msg = `Логин «${login}» уже занят — придумайте другой.`;
    return fail(msg, { login: msg });
  }

  if (role === "requester") {
    if (buildingIds.length === 0) {
      const msg = "Отметьте хотя бы одно здание — иначе заявитель не сможет подавать заявки.";
      return fail(msg, { buildingIds: msg });
    }
    const found = await db
      .select({ id: buildings.id })
      .from(buildings)
      .where(inArray(buildings.id, buildingIds));
    if (found.length !== buildingIds.length) {
      const msg = "Одно из зданий не найдено — обновите страницу.";
      return fail(msg, { buildingIds: msg });
    }
  }

  let savedId = existing?.id ?? 0;
  try {
    await db.transaction(async (tx) => {
      if (existing) {
        await tx
          .update(users)
          .set({ fullName: input.fullName, login, role })
          .where(eq(users.id, existing.id));
      } else {
        const [row] = await tx
          .insert(users)
          .values({ fullName: input.fullName, login, role })
          .returning({ id: users.id });
        savedId = row.id;
      }
      await tx.delete(userBuildings).where(eq(userBuildings.userId, savedId));
      if (buildingIds.length) {
        await tx
          .insert(userBuildings)
          .values(buildingIds.map((buildingId) => ({ userId: savedId, buildingId })));
      }
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      const msg = `Логин «${login}» уже занят — придумайте другой.`;
      return fail(msg, { login: msg });
    }
    console.error("[admin] saveUser", e);
    return fail("Не удалось сохранить. Попробуйте ещё раз.");
  }

  revalidateAll();
  if (!existing) redirect(`/admin/users/${savedId}?created=1`);

  let warning = "";
  if (existing.role === "executor" && role !== "executor") {
    warning = activeWorkWarning(await activeWorkCount(existing.id));
  }
  return { ok: true, message: `Сохранено.${warning}` };
}

/**
 * Подобрать логин по ФИО (транслит фамилии, уникальный).
 * `userId` — не считать занятым логин этого сотрудника (при редактировании).
 */
export async function suggestLoginAction(fullName: string, userId?: number | null): Promise<string> {
  await requireAdmin();
  if (typeof fullName !== "string") return "";
  const name = collapseSpaces(fullName).slice(0, 120);
  if (!name) return "";
  const rows = await db
    .select({ id: users.id, login: users.login })
    .from(users);
  const exclude = typeof userId === "number" ? userId : 0;
  const taken = new Set(rows.filter((r) => r.id !== exclude).map((r) => r.login));
  return uniqueLogin(name, taken);
}

const passwordSchema = z
  .string()
  .min(6, "Пароль — не короче 6 символов.")
  .max(64, "Пароль — не длиннее 64 символов.")
  .regex(/^\S+$/, "В пароле не должно быть пробелов.");

/**
 * Задать пароль. FormData: `userId`, `mode` ("generate" — придумать автоматически,
 * иначе взять `password`), `signOut` ("1" — завершить все его входы, например телефон потерян).
 * Возвращает пароль — показать один раз.
 */
export async function setPasswordAction(
  _prev: AdminResult,
  formData: FormData,
): Promise<AdminResult> {
  await requireAdmin();
  const user = await loadUser(positiveInt(str(formData, "userId")));
  if (!user) return fail("Сотрудник не найден.");

  let password: string;
  if (str(formData, "mode") === "generate") {
    password = generatePassword();
  } else {
    const parsed = passwordSchema.safeParse(str(formData, "password").trim());
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Неподходящий пароль.";
      return fail(msg, { password: msg });
    }
    password = parsed.data;
  }

  const signOut = str(formData, "signOut") === "1";
  await setUserPassword(user.id, password);
  if (signOut) await destroyUserSessions(user.id);
  revalidateAll();
  const base = await linkBase();
  const signedOut = signOut ? " Все прежние входы завершены." : "";
  return {
    ok: true,
    password,
    login: user.login,
    loginUrl: `${base}/login`,
    message: user.active
      ? `Пароль сохранён.${signedOut} Передайте его сотруднику — больше он показан не будет.`
      : "Пароль сохранён, но сотрудник отключён — войти он сможет только после включения.",
  };
}

/**
 * Создать новую персональную ссылку входа (старая перестаёт работать).
 * FormData: `userId`. Возвращает полную ссылку — показать один раз.
 */
export async function issueLinkAction(
  _prev: AdminResult,
  formData: FormData,
): Promise<AdminResult> {
  await requireAdmin();
  const user = await loadUser(positiveInt(str(formData, "userId")));
  if (!user) return fail("Сотрудник не найден.");
  if (!user.active) return fail("Сотрудник отключён — сначала включите его.");

  const token = await issueLoginToken(user.id);
  revalidateAll();
  const base = await linkBase();
  return {
    ok: true,
    link: `${base}/t/${token}`,
    login: user.login,
    message: "Новая ссылка создана. Прежняя ссылка больше не работает.",
  };
}

/** Отозвать персональную ссылку. FormData: `userId`. */
export async function revokeLinkAction(
  _prev: AdminResult,
  formData: FormData,
): Promise<AdminResult> {
  await requireAdmin();
  const user = await loadUser(positiveInt(str(formData, "userId")));
  if (!user) return fail("Сотрудник не найден.");
  await revokeLoginToken(user.id);
  revalidateAll();
  return { ok: true, message: "Ссылка отозвана — по ней больше нельзя войти." };
}

/**
 * Отключить / включить сотрудника. FormData: `userId`, `active` ("1" — включить, "0" — отключить).
 * Отключение сразу завершает все его сессии и отзывает ссылку для входа (после включения старая
 * ссылка не должна снова заработать — выдаётся новая). Нельзя отключить себя и последнего администратора.
 */
export async function setUserActiveAction(
  _prev: AdminResult,
  formData: FormData,
): Promise<AdminResult> {
  const me = await requireAdmin();
  const user = await loadUser(positiveInt(str(formData, "userId")));
  if (!user) return fail("Сотрудник не найден.");
  const active = str(formData, "active") === "1";

  if (!active) {
    if (user.id === me.id) return fail("Нельзя отключить самого себя.");
    if (user.role === "admin" && user.active && (await activeAdminCount()) <= 1) {
      return fail("Нельзя отключить последнего администратора.");
    }
  }

  await db
    .update(users)
    .set(active ? { active } : { active, loginTokenHash: null })
    .where(eq(users.id, user.id));
  if (!active) await destroyUserSessions(user.id);
  revalidateAll();

  if (active) {
    return {
      ok: true,
      message:
        "Сотрудник включён. Войти он может по паролю; если нужна ссылка для входа — создайте новую.",
    };
  }
  const warning = user.role === "executor" ? activeWorkWarning(await activeWorkCount(user.id)) : "";
  return {
    ok: true,
    message: `Сотрудник отключён и вышел из системы на всех устройствах, ссылка для входа отозвана.${warning}`,
  };
}

// ─── Доступы (пароль + ссылка + QR) ──────────────────────────

/** QR-код ссылки как data URL (SVG): чёткий при печати, показывается через <img>. */
async function qrDataUrl(text: string): Promise<string> {
  const svg = await qrToString(text, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

const accessIdsSchema = z
  .array(z.number().int().positive())
  .min(1, "Отметьте хотя бы одного сотрудника.")
  .max(500, "Слишком много сотрудников за один раз.");

/**
 * Выдать доступы: каждому выбранному активному сотруднику — новый пароль (generatePassword)
 * и новая личная ссылка (старые перестают работать). Уже открытые входы НЕ завершаются.
 * FormData: `userIds` (повтор). Возвращает карточки с паролями и QR — показать один раз.
 * Пароли нигде не логируются.
 */
export async function issueAccessAction(
  _prev: AdminResult,
  formData: FormData,
): Promise<AdminResult> {
  await requireAdmin();
  const parsed = accessIdsSchema.safeParse([
    ...new Set(
      formData
        .getAll("userIds")
        .map((v) => (typeof v === "string" ? positiveInt(v) : null))
        .filter((v): v is number => v !== null),
    ),
  ]);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Отметьте сотрудников.");

  const rows = await db
    .select({ id: users.id, fullName: users.fullName, login: users.login, role: users.role })
    .from(users)
    .where(and(inArray(users.id, parsed.data), eq(users.active, true)))
    .orderBy(users.fullName);
  if (rows.length === 0) {
    return fail("Выбранные сотрудники не найдены или отключены — обновите страницу.");
  }

  const base = await linkBase();
  const cards: AccessCardData[] = [];
  const failed: string[] = [];
  // По одному: если на ком-то сбой, уже выданные карточки не теряются.
  for (const u of rows) {
    try {
      const password = generatePassword();
      await setUserPassword(u.id, password);
      const token = await issueLoginToken(u.id);
      const link = `${base}/t/${token}`;
      cards.push({ userId: u.id, fullName: u.fullName, role: u.role, login: u.login, password, link, qr: await qrDataUrl(link) });
    } catch (e) {
      console.error("[admin] issueAccess: user", u.id, e instanceof Error ? e.message : "error");
      failed.push(u.fullName);
    }
  }
  revalidateAll();

  if (cards.length === 0) {
    return fail("Не удалось выдать доступы. Попробуйте ещё раз.");
  }
  const skipped = parsed.data.length - rows.length;
  const notes = [
    `Выдано: ${cards.length} ${pluralRu(cards.length, ["сотрудник", "сотрудника", "сотрудников"])}.`,
    skipped > 0
      ? `${skipped} ${pluralRu(skipped, ["отключённый пропущен", "отключённых пропущено", "отключённых пропущено"])}.`
      : "",
  ].filter(Boolean);
  return {
    ok: true,
    message: notes.join(" "),
    cards,
    siteUrl: base,
    issuedAt: new Date().toISOString(),
    failed: failed.length ? failed : undefined,
  };
}

// ─── Здания ──────────────────────────────────────────────────

const addressSchema = z
  .string()
  .transform(collapseSpaces)
  .pipe(
    z
      .string()
      .min(3, "Введите адрес здания.")
      .max(200, "Слишком длинный адрес (больше 200 символов)."),
  );

/**
 * Добавить или переименовать здание. FormData: `buildingId` (пусто — новое), `address`.
 */
export async function saveBuildingAction(
  _prev: AdminResult,
  formData: FormData,
): Promise<AdminResult> {
  await requireAdmin();
  const rawId = str(formData, "buildingId");
  const id = rawId ? positiveInt(rawId) : null;
  if (rawId && !id) return fail("Здание не найдено.");

  const parsed = addressSchema.safeParse(str(formData, "address"));
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Проверьте адрес.";
    return fail(msg, { address: msg });
  }
  const address = parsed.data;

  if (id) {
    const found = await db.select({ id: buildings.id }).from(buildings).where(eq(buildings.id, id));
    if (!found.length) return fail("Здание не найдено.");
  }
  const clash = await db
    .select({ id: buildings.id })
    .from(buildings)
    .where(and(sql`lower(${buildings.address}) = lower(${address})`, ne(buildings.id, id ?? 0)))
    .limit(1);
  if (clash.length) {
    const msg = "Здание с таким адресом уже есть.";
    return fail(msg, { address: msg });
  }

  try {
    if (id) {
      await db.update(buildings).set({ address }).where(eq(buildings.id, id));
    } else {
      await db.insert(buildings).values({ address });
    }
  } catch (e) {
    if (isUniqueViolation(e)) {
      const msg = "Здание с таким адресом уже есть.";
      return fail(msg, { address: msg });
    }
    console.error("[admin] saveBuilding", e);
    return fail("Не удалось сохранить. Попробуйте ещё раз.");
  }

  revalidateAll();
  return { ok: true, message: id ? "Адрес изменён." : "Здание добавлено." };
}

/**
 * Отключить / включить здание. FormData: `buildingId`, `active` ("1" / "0").
 * Отключённое здание нельзя выбрать в новой заявке; старые заявки остаются.
 */
export async function setBuildingActiveAction(
  _prev: AdminResult,
  formData: FormData,
): Promise<AdminResult> {
  await requireAdmin();
  const id = positiveInt(str(formData, "buildingId"));
  if (!id) return fail("Здание не найдено.");
  const active = str(formData, "active") === "1";
  const updated = await db
    .update(buildings)
    .set({ active })
    .where(eq(buildings.id, id))
    .returning({ id: buildings.id });
  if (!updated.length) return fail("Здание не найдено.");
  revalidateAll();
  return {
    ok: true,
    message: active
      ? "Здание включено — по нему снова можно подавать заявки."
      : "Здание отключено — новые заявки по нему подать нельзя, старые остались.",
  };
}
