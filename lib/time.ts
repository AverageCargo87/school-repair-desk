/**
 * Всё время приложения — по Москве (Europe/Moscow).
 * Даты без времени (срок, «сегодня») — строки 'YYYY-MM-DD'.
 * Моменты времени (created_at и т. п.) — Date (timestamptz в БД).
 * Модуль чистый: можно использовать и на сервере, и в клиентских компонентах.
 */

export const MSK_TZ = "Europe/Moscow";

const ymdFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: MSK_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dateRuFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: MSK_TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeRuFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: MSK_TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const timeRuFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: MSK_TZ,
  hour: "2-digit",
  minute: "2-digit",
});

const longDateRuFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "UTC",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const shortDateRuFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "UTC",
  day: "numeric",
  month: "long",
});

/** Проверка строки 'YYYY-MM-DD' (и что такая дата существует). */
export function isValidDateStr(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Календарная дата момента `d` по Москве: 'YYYY-MM-DD'. */
export function dateMsk(d: Date): string {
  return ymdFormatter.format(d);
}

/** Сегодня по Москве: 'YYYY-MM-DD'. */
export function todayMsk(now: Date = new Date()): string {
  return dateMsk(now);
}

/** Сдвиг даты 'YYYY-MM-DD' на n дней (может быть отрицательным). */
export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Разница в днях: b − a (обе 'YYYY-MM-DD'). */
export function diffDays(a: string, b: string): number {
  const ta = Date.parse(`${a}T00:00:00Z`);
  const tb = Date.parse(`${b}T00:00:00Z`);
  return Math.round((tb - ta) / 86_400_000);
}

/**
 * Момент начала суток по Москве для даты 'YYYY-MM-DD'.
 * Удобно для фильтра по created_at: [mskDayStart(from), mskDayStart(addDays(to, 1))).
 */
export function mskDayStart(dateStr: string): Date {
  // С 2014 года в Москве UTC+3 без перехода на летнее время.
  return new Date(`${dateStr}T00:00:00+03:00`);
}

/** Первый и последний день месяца (по Москве), в который попадает `today`. */
export function monthRangeMsk(today: string = todayMsk()): {
  from: string;
  to: string;
} {
  const [y, m] = today.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { from, to: addDays(next, -1) };
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * «12.10.2026». Принимает дату 'YYYY-MM-DD' (выводится как есть)
 * или момент времени Date (переводится в московскую дату).
 */
export function formatDateMsk(value: Date | string | null | undefined): string {
  if (value == null) return "";
  if (typeof value === "string" && isValidDateStr(value)) {
    const [y, m, d] = value.split("-");
    return `${d}.${m}.${y}`;
  }
  return dateRuFormatter.format(toDate(value));
}

/** «12.10.2026, 14:05» по Москве. */
export function formatDateTimeMsk(value: Date | string | null | undefined): string {
  if (value == null) return "";
  return dateTimeRuFormatter.format(toDate(value));
}

/** «14:05» по Москве. */
export function formatTimeMsk(value: Date | string | null | undefined): string {
  if (value == null) return "";
  return timeRuFormatter.format(toDate(value));
}

/** «12 октября 2026 г.» — для дат 'YYYY-MM-DD' или Date (по Москве). */
export function formatDateLongMsk(value: Date | string | null | undefined): string {
  if (value == null) return "";
  const ymd = typeof value === "string" && isValidDateStr(value) ? value : dateMsk(toDate(value));
  return longDateRuFormatter.format(new Date(`${ymd}T00:00:00Z`));
}

/** «12 октября» — для дат 'YYYY-MM-DD' или Date (по Москве). */
export function formatDateShortMsk(value: Date | string | null | undefined): string {
  if (value == null) return "";
  const ymd = typeof value === "string" && isValidDateStr(value) ? value : dateMsk(toDate(value));
  return shortDateRuFormatter.format(new Date(`${ymd}T00:00:00Z`));
}

/**
 * Понятная подпись момента: «сегодня, 14:05», «вчера, 09:10» или «12.10.2026, 14:05».
 */
export function formatWhenMsk(
  value: Date | string | null | undefined,
  now: Date = new Date(),
): string {
  if (value == null) return "";
  const d = toDate(value);
  const day = dateMsk(d);
  const today = dateMsk(now);
  if (day === today) return `сегодня, ${formatTimeMsk(d)}`;
  if (day === addDays(today, -1)) return `вчера, ${formatTimeMsk(d)}`;
  return formatDateTimeMsk(d);
}

/** Статусы, в которых заявка может быть просрочена. */
const OVERDUE_STATUSES = new Set(["assigned", "in_progress"]);

/**
 * Просрочка — не статус, а признак: срок < сегодня (МСК) и статус assigned|in_progress.
 */
export function isOverdue(
  deadline: string | null | undefined,
  status: string,
  today: string = todayMsk(),
): boolean {
  if (!deadline) return false;
  return OVERDUE_STATUSES.has(status) && deadline < today;
}

/**
 * Подпись срока относительно сегодня: «сегодня», «завтра», «через 3 дн.»,
 * «просрочен на 2 дн.». Для пустого срока — пустая строка.
 */
export function deadlineHint(
  deadline: string | null | undefined,
  today: string = todayMsk(),
): string {
  if (!deadline) return "";
  const days = diffDays(today, deadline);
  if (days === 0) return "сегодня";
  if (days === 1) return "завтра";
  if (days > 1) return `через ${days} дн.`;
  return `просрочен на ${-days} дн.`;
}
