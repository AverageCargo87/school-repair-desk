import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, type Role, type User } from "@/db/schema";
import {
  generateToken,
  hashPassword,
  sha256,
  verifyPassword,
} from "@/lib/crypto";
import { homeForRole, isDispatcherRole } from "@/lib/roles";

export { generateToken, hashPassword, sha256, verifyPassword };
export { homeForRole, isDispatcherRole };

export const SESSION_COOKIE = "zv_session";
export const SESSION_DAYS = 180;

/** Текущий пользователь (без хешей пароля и токена). */
export type SessionUser = Pick<User, "id" | "fullName" | "login" | "role" | "active">;

const sessionUserColumns = {
  id: users.id,
  fullName: users.fullName,
  login: users.login,
  role: users.role,
  active: users.active,
};

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}

export async function createSessionRecord(
  userId: number,
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const id = sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(sessions).values({ id, userId, expiresAt });
  // Попутно чистим истёкшие сессии.
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  return { token, expiresAt };
}

/** Создать сессию и поставить cookie (вызывать из server action / route handler). */
export async function createSession(userId: number): Promise<void> {
  const { token, expiresAt } = await createSessionRecord(userId);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.id, sha256(token)));
  }
  jar.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select(sessionUserColumns)
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const user = rows[0];
  if (!user || !user.active) return null;
  return user;
}

/** Пользователь обязателен: иначе редирект на /login. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Пользователь с одной из ролей; чужая роль → редирект на свою стартовую страницу. */
export async function requireRole(roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(homeForRole(user.role));
  return user;
}

/** Найти активного пользователя по токену персональной ссылки. */
export async function findUserByLoginToken(
  token: string,
): Promise<SessionUser | null> {
  if (!token || token.length > 200) return null;
  const rows = await db
    .select(sessionUserColumns)
    .from(users)
    .where(and(eq(users.loginTokenHash, sha256(token)), eq(users.active, true)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Выпустить новую персональную ссылку (старая перестаёт работать).
 * Возвращает токен — показать один раз как `${APP_URL}/t/${token}`.
 */
export async function issueLoginToken(userId: number): Promise<string> {
  const token = generateToken();
  await db
    .update(users)
    .set({ loginTokenHash: sha256(token) })
    .where(eq(users.id, userId));
  return token;
}

/** Отозвать персональную ссылку. */
export async function revokeLoginToken(userId: number): Promise<void> {
  await db.update(users).set({ loginTokenHash: null }).where(eq(users.id, userId));
}

/** Задать пароль (хеш scrypt). Существующие сессии не трогает. */
export async function setUserPassword(userId: number, password: string): Promise<void> {
  await db
    .update(users)
    .set({ passwordHash: hashPassword(password) })
    .where(eq(users.id, userId));
}

/** Завершить все сессии пользователя (например, при отключении). */
export async function destroyUserSessions(userId: number): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
