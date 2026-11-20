/** Типы админки (чистый модуль — можно в клиентских компонентах). */
import type { Role } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";

/**
 * Карточка доступа сотрудника (раздел «Доступы»): выдаётся один раз — пароль в базе
 * хранится только хешем, повторно его не показать.
 */
export type AccessCardData = {
  userId: number;
  fullName: string;
  role: Role;
  login: string;
  password: string;
  /** Личная ссылка входа `${base}/t/<token>`. */
  link: string;
  /** QR-код ссылки: data URL (SVG) — показывать через <img>. */
  qr: string;
};

/** Результат server action админки. Секреты (пароль, ссылка) показываются один раз. */
export type AdminResult = ActionResult & {
  /** Новый пароль — показать один раз. */
  password?: string;
  /** Логин сотрудника (для текста «логин + пароль»). */
  login?: string;
  /** Полная персональная ссылка входа — показать один раз. */
  link?: string;
  /** Адрес страницы входа по логину (`${base}/login`). */
  loginUrl?: string;
  /** «Выдать доступы»: карточки выданных (пароли — один раз). */
  cards?: AccessCardData[];
  /** Адрес сайта для карточек (без «/» в конце). */
  siteUrl?: string;
  /** Когда выдано (ISO) — для имени CSV и подписи. */
  issuedAt?: string;
  /** ФИО тех, кому выдать не удалось (их старые пароль и ссылка остались). */
  failed?: string[];
};

export const INITIAL_ADMIN_RESULT: AdminResult = { ok: false };

/** Здание в админке (чекбоксы заявителя, списки). */
export type AdminBuildingRef = { id: number; address: string; active: boolean };

export type AdminUserRow = {
  id: number;
  fullName: string;
  login: string;
  role: Role;
  active: boolean;
  hasPassword: boolean;
  hasLink: boolean;
  createdAt: Date;
  /** Закреплённые здания (для заявителя). */
  buildings: AdminBuildingRef[];
  /** Активные заявки (Назначена/В работе), где он основной исполнитель или соисполнитель. */
  activeWork: number;
};

export type AdminBuildingRow = AdminBuildingRef & {
  /** Активные заявители, за которыми закреплено здание. */
  requesters: { id: number; fullName: string }[];
  /** Заявки в статусах Новая/Назначена/В работе. */
  activeRequests: number;
  totalRequests: number;
};
