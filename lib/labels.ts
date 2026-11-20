/** Подписи для интерфейса и выгрузки. Модуль чистый — можно в клиентских компонентах. */
import type {
  EventType,
  PhotoKind,
  RequestStatus,
  Role,
  Urgency,
} from "@/db/schema";
import type { BadgeVariant } from "@/components/ui/badge";

export const roleLabels: Record<Role, string> = {
  requester: "Заявитель",
  dispatcher: "Распределитель",
  executor: "Исполнитель",
  admin: "Администратор",
};

export const statusLabels: Record<RequestStatus, string> = {
  new: "Новая",
  assigned: "Назначена",
  in_progress: "В работе",
  done: "Выполнена",
  rejected: "Отклонена",
  cancelled: "Отменена",
};

/** Цвет пилюли статуса (DESIGN.md): синий, бирюзовый, индиго, зелёный, серый. */
export const statusBadgeVariant: Record<RequestStatus, BadgeVariant> = {
  new: "info",
  assigned: "aqua",
  in_progress: "primary",
  done: "success",
  rejected: "neutral",
  cancelled: "neutral",
};

export const urgencyLabels: Record<Urgency, string> = {
  emergency: "Аварийная",
  current: "Текущая",
  purchase: "Требует закупки",
};

/** Короткое пояснение под кнопкой выбора срочности. */
export const urgencyHints: Record<Urgency, string> = {
  emergency: "Опасно или мешает работе — нужно срочно",
  current: "Обычная поломка, можно в плановом порядке",
  purchase: "Нужно что-то купить или заменить",
};

export const urgencyBadgeVariant: Record<Urgency, BadgeVariant> = {
  emergency: "danger",
  current: "neutral",
  purchase: "warning",
};

/** Подпись события в ленте истории. */
export const eventTypeLabels: Record<EventType, string> = {
  created: "Заявка создана",
  assigned: "Назначен исполнитель",
  reassigned: "Назначение изменено",
  accepted: "Исполнитель принял заявку",
  comment: "Комментарий",
  problem: "Проблема",
  problem_resolved: "Проблема решена",
  completed: "Выполнено",
  rejected: "Заявка отклонена",
  cancelled: "Заявка отменена",
  reopened: "Возвращена в работу",
};

export const eventTypeBadgeVariant: Record<EventType, BadgeVariant> = {
  created: "info",
  assigned: "aqua",
  reassigned: "aqua",
  accepted: "primary",
  comment: "neutral",
  problem: "danger",
  problem_resolved: "success",
  completed: "success",
  rejected: "neutral",
  cancelled: "neutral",
  reopened: "warning",
};

export const photoKindLabels: Record<PhotoKind, string> = {
  problem: "Фото заявителя",
  result: "Фото результата",
  comment: "Фото к комментарию",
};

export const OVERDUE_LABEL = "Просрочена";
export const PROBLEM_LABEL = "Проблема";
