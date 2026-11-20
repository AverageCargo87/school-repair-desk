export type ClassValue = string | number | false | null | undefined;

export function cn(...parts: ClassValue[]): string {
  return parts.filter(Boolean).join(" ");
}

export function pluralRu(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const n1 = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (n1 > 1 && n1 < 5) return forms[1];
  if (n1 === 1) return forms[0];
  return forms[2];
}

/** «Иванова Мария Петровна» → «Иванова М. П.» */
export function shortName(fullName: string | null | undefined): string {
  if (!fullName) return "";
  const [last, ...rest] = fullName.trim().split(/\s+/);
  const initials = rest
    .filter(Boolean)
    .map((p) => `${p[0].toUpperCase()}.`)
    .join(" ");
  return initials ? `${last} ${initials}` : last;
}

/** Номер заявки для показа: «№ 17». */
export function requestNo(id: number): string {
  return `№ ${id}`;
}
