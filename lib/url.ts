/** Работа с query-параметрами (чистый модуль). */

export type SearchParamsInput = Record<string, string | string[] | undefined>;

/** Первое значение параметра (Next отдаёт string | string[] | undefined). */
export function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Собрать ссылку: текущие параметры + изменения. Значение undefined/""/null — удалить параметр.
 * withParams("/dispatch", sp, { status: "new", page: undefined }) → "/dispatch?status=new"
 */
export function withParams(
  pathname: string,
  current: SearchParamsInput,
  patch: Record<string, string | number | undefined | null>,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    const val = firstParam(v);
    if (val !== undefined && val !== "") params.set(k, val);
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === null || v === "") params.delete(k);
    else params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
