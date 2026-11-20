/**
 * Константы заявок. Модуль чистый (без БД и node:*) — можно импортировать
 * в клиентских компонентах.
 */
import type {
  EventType,
  PhotoKind,
  RequestStatus,
  Role,
  Urgency,
} from "@/db/schema";

export const ROLES: readonly Role[] = ["requester", "dispatcher", "executor", "admin"];

export const URGENCIES: readonly Urgency[] = ["emergency", "current", "purchase"];

export const STATUSES: readonly RequestStatus[] = [
  "new",
  "assigned",
  "in_progress",
  "done",
  "rejected",
  "cancelled",
];

/** «Активные»: new / assigned / in_progress. */
export const ACTIVE_STATUSES: readonly RequestStatus[] = ["new", "assigned", "in_progress"];

/** «Завершённые»: done / rejected / cancelled. */
export const CLOSED_STATUSES: readonly RequestStatus[] = ["done", "rejected", "cancelled"];

/** Статусы, в которых заявка «у исполнителя» (может быть просрочена, можно сообщить о проблеме). */
export const WORK_STATUSES: readonly RequestStatus[] = ["assigned", "in_progress"];

export type StatusGroup = "active" | "closed";

export const EVENT_TYPES: readonly EventType[] = [
  "created",
  "assigned",
  "reassigned",
  "accepted",
  "comment",
  "problem",
  "problem_resolved",
  "completed",
  "rejected",
  "cancelled",
  "reopened",
];

export const PHOTO_KINDS: readonly PhotoKind[] = ["problem", "result", "comment"];

/** Лимиты количества фото по действиям. */
export const PHOTO_LIMITS = {
  /** Новая заявка: 0..5 */
  create: { min: 0, max: 5 },
  /** «Выполнено»: 1..5 */
  complete: { min: 1, max: 5 },
  /** «Сообщить о проблеме»: 0..3 */
  problem: { min: 0, max: 3 },
  /** Комментарий: 0..3 */
  comment: { min: 0, max: 3 },
} as const;

/** Максимальный размер одного фото на сервере. */
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

/** Допустимые типы фото. */
export const PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

/** Сжатие на клиенте: длинная сторона и качество JPEG. */
export const PHOTO_CLIENT_MAX_SIDE = 1600;
export const PHOTO_CLIENT_JPEG_QUALITY = 0.8;

/** Длины текстовых полей. */
export const TEXT_LIMITS = {
  description: 2000,
  location: 200,
  comment: 2000,
} as const;

/** Имя поля FormData для файлов фото во всех формах. */
export const PHOTOS_FIELD = "photos";
