/** Чистые хелперы ролей (без БД) — можно использовать и в клиентских компонентах. */
import type { Role } from "@/db/schema";

/** Распределитель или админ (админ может всё, что распределитель). */
export function isDispatcherRole(role: Role): boolean {
  return role === "dispatcher" || role === "admin";
}

/** Стартовая страница роли: requester → /my, dispatcher|admin → /dispatch, executor → /tasks. */
export function homeForRole(role: Role): string {
  if (role === "requester") return "/my";
  if (role === "executor") return "/tasks";
  return "/dispatch";
}
