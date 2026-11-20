/**
 * Результат server action для useActionState. Чистый модуль (можно в клиенте).
 */
export type ActionResult = {
  ok: boolean;
  /** Общая ошибка для показа над кнопкой. */
  error?: string;
  /** Ошибки по полям: имя поля FormData → текст. */
  fieldErrors?: Record<string, string>;
  /** Сообщение об успехе (необязательно). */
  message?: string;
};

/** Начальное состояние для useActionState. */
export const INITIAL_ACTION_RESULT: ActionResult = { ok: false };
