/**
 * Разбор query-параметров экранов распределителя (/dispatch, /export, /export/file).
 * Чистый модуль (без БД) — можно в клиентских компонентах.
 */
import type { RequestStatus, Urgency } from "@/db/schema";
import type { RequestListFilters } from "@/lib/requests/queries";
import { URGENCIES } from "@/lib/requests/constants";
import { isValidDateStr, monthRangeMsk } from "@/lib/time";
import { firstParam, type SearchParamsInput } from "@/lib/url";

/** Варианты фильтра «Статус» (общие для списка и выгрузки). */
export const STATUS_VIEWS = [
  { value: "active", label: "Все активные" },
  { value: "problem", label: "С проблемой" },
  { value: "overdue", label: "Просроченные" },
  { value: "new", label: "Новые (не назначены)" },
  { value: "work", label: "У исполнителей (назначены и в работе)" },
  { value: "assigned", label: "Назначены, ещё не приняты" },
  { value: "in_progress", label: "Приняты, в работе" },
  { value: "done", label: "Выполнены" },
  { value: "rejected", label: "Отклонены" },
  { value: "cancelled", label: "Отменены" },
  { value: "closed", label: "Все завершённые" },
  { value: "all", label: "Все заявки" },
] as const;

export type StatusView = (typeof STATUS_VIEWS)[number]["value"];

const STATUS_VIEW_SET = new Set<string>(STATUS_VIEWS.map((v) => v.value));

/** Статус по умолчанию на /dispatch. */
export const DISPATCH_DEFAULT_STATUS: StatusView = "active";
/** Статус по умолчанию в выгрузке. */
export const EXPORT_DEFAULT_STATUS: StatusView = "all";

export function parseStatusView(raw: string | undefined, fallback: StatusView): StatusView {
  return raw && STATUS_VIEW_SET.has(raw) ? (raw as StatusView) : fallback;
}

/** Фильтры listRequests для варианта «Статус». */
export function statusViewFilters(
  view: StatusView,
): Pick<RequestListFilters, "status" | "statusGroup" | "onlyProblem" | "onlyOverdue"> {
  switch (view) {
    case "active":
      return { statusGroup: "active" };
    case "closed":
      return { statusGroup: "closed" };
    case "problem":
      return { onlyProblem: true };
    case "overdue":
      return { onlyOverdue: true };
    case "work":
      return { status: ["assigned", "in_progress"] satisfies RequestStatus[] };
    case "all":
      return {};
    default:
      return { status: view };
  }
}

export function statusViewLabel(view: StatusView): string {
  return STATUS_VIEWS.find((v) => v.value === view)?.label ?? "";
}

/** Положительное целое из строки (id), иначе undefined. */
export function parseId(raw: string | undefined): number | undefined {
  if (!raw || !/^\d{1,9}$/.test(raw)) return undefined;
  const n = Number(raw);
  return n > 0 ? n : undefined;
}

export function parseUrgency(raw: string | undefined): Urgency | undefined {
  return raw && (URGENCIES as readonly string[]).includes(raw) ? (raw as Urgency) : undefined;
}

// ─── /dispatch ───────────────────────────────────────────────

export type DispatchQuery = {
  status: StatusView;
  buildingId?: number;
  urgency?: Urgency;
  executorId?: number;
  q: string;
};

export function parseDispatchQuery(sp: SearchParamsInput): DispatchQuery {
  return {
    status: parseStatusView(firstParam(sp.status), DISPATCH_DEFAULT_STATUS),
    buildingId: parseId(firstParam(sp.building)),
    urgency: parseUrgency(firstParam(sp.urgency)),
    executorId: parseId(firstParam(sp.executor)),
    q: (firstParam(sp.q) ?? "").trim().slice(0, 100),
  };
}

/** Поиск похож на номер заявки: «17», «№ 17», «#17». */
export function isRequestNumberQuery(q: string): boolean {
  return /^(№|#|n)?\s*\d{1,9}$/i.test(q.trim());
}

/**
 * Фильтры списка /dispatch. Поиск по номеру ищет среди всех заявок без учёта статуса:
 * номер уникален, а нужная заявка может быть уже выполнена или отклонена.
 */
export function dispatchListFilters(q: DispatchQuery): RequestListFilters {
  return {
    ...(isRequestNumberQuery(q.q) ? {} : statusViewFilters(q.status)),
    buildingId: q.buildingId,
    urgency: q.urgency,
    executorId: q.executorId,
    q: q.q || undefined,
  };
}

/** Сколько фильтров выбрано помимо статуса по умолчанию и поиска. */
export function countDispatchFilters(q: DispatchQuery): number {
  return (
    (q.status !== DISPATCH_DEFAULT_STATUS ? 1 : 0) +
    (q.buildingId ? 1 : 0) +
    (q.urgency ? 1 : 0) +
    (q.executorId ? 1 : 0)
  );
}

// ─── /export ─────────────────────────────────────────────────

export type ExportQuery = {
  /** 'YYYY-MM-DD' (МСК), включительно. */
  from: string;
  /** 'YYYY-MM-DD' (МСК), включительно. */
  to: string;
  status: StatusView;
  buildingId?: number;
};

/** Период по умолчанию — с 1-го числа текущего месяца по сегодня (МСК). */
export function defaultExportPeriod(today: string): { from: string; to: string } {
  return { from: monthRangeMsk(today).from, to: today };
}

export function parseExportQuery(sp: SearchParamsInput, today: string): ExportQuery {
  const def = defaultExportPeriod(today);
  const rawFrom = firstParam(sp.from);
  const rawTo = firstParam(sp.to);
  let from = isValidDateStr(rawFrom) ? rawFrom : def.from;
  let to = isValidDateStr(rawTo) ? rawTo : def.to;
  if (from > to) [from, to] = [to, from];
  return {
    from,
    to,
    status: parseStatusView(firstParam(sp.status), EXPORT_DEFAULT_STATUS),
    buildingId: parseId(firstParam(sp.building)),
  };
}

export function exportListFilters(q: ExportQuery): Omit<RequestListFilters, "limit"> {
  return {
    ...statusViewFilters(q.status),
    buildingId: q.buildingId,
    createdFrom: q.from,
    createdTo: q.to,
  };
}
