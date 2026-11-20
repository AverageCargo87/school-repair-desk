/**
 * Пункты навигации по ролям и заголовок раздела для верхней панели.
 * Модуль без "use client": можно и на сервере, и в клиентских компонентах.
 * Иконки — компоненты lucide-react: рендерить только в клиентских компонентах
 * (через границу сервер → клиент компонент-иконку передать нельзя).
 */
import {
  Building2,
  ClipboardList,
  FileSpreadsheet,
  Inbox,
  Plus,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/db/schema";

export type NavItem = {
  href: string;
  /** Подпись в меню и на вкладке. */
  label: string;
  /** Заголовок раздела в верхней панели телефона (если отличается от label). */
  title?: string;
  exact?: boolean;
  icon: LucideIcon;
  /** Выделенный пункт («Новая» — кружок бренда с «+»). */
  accent?: boolean;
  /** Доп. префиксы адресов, на которых пункт считается активным. */
  match?: string[];
};

const NEW: NavItem = { href: "/new", label: "Новая", title: "Новая заявка", icon: Plus, accent: true };
const DISPATCH: NavItem = { href: "/dispatch", label: "Заявки", title: "Все заявки", icon: Inbox };
const EXPORT: NavItem = { href: "/export", label: "Выгрузка", title: "Выгрузка в Excel", icon: FileSpreadsheet };

/** Пункты меню по роли. */
export function navItemsForRole(role: Role): NavItem[] {
  switch (role) {
    case "requester":
      return [{ href: "/my", label: "Мои заявки", icon: ClipboardList }, NEW];
    case "executor":
      return [{ href: "/tasks", label: "Мои задачи", icon: Wrench }];
    case "dispatcher":
      return [DISPATCH, NEW, EXPORT];
    case "admin":
      return [
        DISPATCH,
        NEW,
        EXPORT,
        { href: "/admin/users", label: "Сотрудники", icon: Users, match: ["/admin/access"] },
        { href: "/admin/buildings", label: "Здания", icon: Building2 },
      ];
  }
}

function matches(path: string, prefix: string, exact?: boolean): boolean {
  return exact ? path === prefix : path === prefix || path.startsWith(`${prefix}/`);
}

/** Активен ли пункт для адреса. */
export function isNavItemActive(item: Pick<NavItem, "href" | "exact" | "match">, pathname: string): boolean {
  return (
    matches(pathname, item.href, item.exact) || (item.match ?? []).some((p) => matches(pathname, p))
  );
}

/** Заголовок раздела для верхней панели на телефоне. */
export function sectionTitle(pathname: string, role: Role): string {
  const req = /^\/r\/(\d+)/.exec(pathname);
  if (req) return `Заявка № ${req[1]}`;
  if (pathname === "/admin/users/new") return "Новый сотрудник";
  if (/^\/admin\/users\/\d+/.test(pathname)) return "Сотрудник";
  if (pathname.startsWith("/admin/access")) return "Доступы";
  const item = navItemsForRole(role).find((i) => isNavItemActive(i, pathname));
  return item ? (item.title ?? item.label) : "Заявки";
}
