"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, homeForRole, verifyPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { isValidLogin, normalizeLoginInput } from "@/lib/roster";

export type LoginState = { error?: string; login?: string };

/** Адрес клиента: первый из X-Forwarded-For (его выставляет Traefik), иначе X-Real-IP. */
async function clientIp(): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";
  return ip.slice(0, 64) || "unknown";
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const typed = String(formData.get("login") ?? "").slice(0, 200).trim();
  const password = String(formData.get("password") ?? "");
  // В поле — то, что человек ввёл (фамилию по-русски не подменяем латиницей).
  const shownLogin = typed.slice(0, 64);

  if (!typed || !password) {
    return { error: "Введите логин (или фамилию) и пароль", login: shownLogin };
  }
  // «Петров» → «petrov» (тот же транслит, что у логинов); латиница — как есть, в нижнем регистре.
  const login = normalizeLoginInput(typed);
  // Заведомо неверный ввод отсекаем до лимита и базы: ключи лимита короткие.
  if (!isValidLogin(login) || password.length > 128) {
    return { error: "Неверный логин или пароль", login: shownLogin };
  }
  // Лимит по паре «логин + адрес»: чужой человек не может заблокировать вход сотруднику;
  // плюс общий лимит на адрес (с запасом: вся школа может выходить в интернет с одного адреса).
  const ip = await clientIp();
  if (!rateLimit(`login-ip:${ip}`, 60) || !rateLimit(`login:${login}:${ip}`)) {
    return { error: "Слишком много попыток. Подождите минуту.", login: shownLogin };
  }

  const rows = await db.select().from(users).where(eq(users.login, login)).limit(1);
  const user = rows[0];

  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    return { error: "Неверный логин или пароль", login: shownLogin };
  }

  await createSession(user.id);
  redirect(homeForRole(user.role));
}
