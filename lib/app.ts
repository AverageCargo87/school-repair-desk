/** Общие константы приложения. */
export const APP_NAME = "Заявки · Школа";
export const APP_SHORT_NAME = "Заявки";
export const APP_DESCRIPTION =
  "Заявки на ремонт и хозяйственные работы в зданиях школы";
/** Цвет бренда (совпадает с --primary в светлой теме): манифест, иконки. */
export const THEME_COLOR = "#4f46e5";
/** Фон приложения (--bg в светлой теме): заставка при запуске с экрана «Домой». */
export const BACKGROUND_COLOR = "#f5f6fa";

/** Базовый адрес сайта для ссылок входа (без завершающего «/»). */
export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}
