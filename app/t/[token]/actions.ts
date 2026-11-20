"use server";

import { redirect } from "next/navigation";
import { createSession, findUserByLoginToken, homeForRole } from "@/lib/auth";

/**
 * Вход по персональной ссылке. Сессия создаётся только здесь (POST),
 * а не при открытии страницы: мессенджеры открывают ссылки для превью.
 * Поле FormData: `token`.
 */
export async function loginByLinkAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const user = await findUserByLoginToken(token);
  if (!user) redirect("/login?error=badlink");
  await createSession(user.id);
  redirect(homeForRole(user.role));
}
