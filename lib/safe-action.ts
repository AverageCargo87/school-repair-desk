/**
 * Обёртка server action для useActionState на клиенте: если запрос не дошёл
 * (нет связи, таймаут, сайт обновили и старое действие не найдено), ошибка не уходит
 * в error.tsx (иначе весь экран сменится на «Что-то пошло не так» и введённое пропадёт),
 * а возвращается как обычный результат с текстом ошибки.
 * redirect()/notFound() из action пропускаются дальше (unstable_rethrow).
 */
import { unstable_rethrow } from "next/navigation";

export const SEND_FAILED_MESSAGE =
  "Не удалось отправить — нет связи с сервером. Проверьте интернет и нажмите ещё раз, введённое не пропало.";

export function catchSendErrors<S>(
  action: (prev: S, formData: FormData) => Promise<S>,
  onError: (prev: S, formData: FormData) => S,
): (prev: S, formData: FormData) => Promise<S> {
  return async (prev, formData) => {
    try {
      return await action(prev, formData);
    } catch (e) {
      unstable_rethrow(e);
      console.error("[action]", e);
      return onError(prev, formData);
    }
  };
}
