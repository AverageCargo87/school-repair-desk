/**
 * Сборка .xlsx для выгрузки заявок (exceljs). Серверный модуль.
 */
import ExcelJS from "exceljs";
import { APP_NAME } from "@/lib/app";
import { statusLabels, urgencyLabels } from "@/lib/labels";
import type { RequestExportRow } from "@/lib/requests/queries";
import { MSK_TZ, formatDateMsk, formatDateTimeMsk } from "@/lib/time";

/** Части даты-времени по Москве. */
const mskParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: MSK_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/**
 * Excel не знает часовых поясов: exceljs пишет Date как UTC. Чтобы в ячейке было
 * московское время, передаём Date, у которого UTC-компоненты = московскому времени.
 */
function excelDateTimeMsk(d: Date | null): Date | null {
  if (!d) return null;
  const p: Record<string, number> = {};
  for (const part of mskParts.formatToParts(d)) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  return new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second));
}

/** Дата 'YYYY-MM-DD' → Date для Excel (полночь UTC = эта календарная дата). */
function excelDate(ymd: string | null): Date | null {
  return ymd ? new Date(`${ymd}T00:00:00Z`) : null;
}

const DATE_TIME_FMT = "dd.mm.yyyy hh:mm";
const DATE_FMT = "dd.mm.yyyy";

type ColumnDef = {
  header: string;
  key: string;
  width: number;
  numFmt?: string;
  wrap?: boolean;
  value: (r: RequestExportRow) => string | number | Date | null;
};

const COLUMNS: ColumnDef[] = [
  { header: "№", key: "id", width: 7, value: (r) => r.id },
  {
    header: "Создана",
    key: "createdAt",
    width: 17,
    numFmt: DATE_TIME_FMT,
    value: (r) => excelDateTimeMsk(r.createdAt),
  },
  { header: "Здание", key: "building", width: 28, wrap: true, value: (r) => r.buildingAddress },
  { header: "Где именно", key: "location", width: 22, wrap: true, value: (r) => r.location },
  { header: "Заявитель", key: "author", width: 28, wrap: true, value: (r) => r.authorName },
  { header: "Описание", key: "description", width: 60, wrap: true, value: (r) => r.description },
  { header: "Срочность", key: "urgency", width: 17, value: (r) => urgencyLabels[r.urgency] },
  { header: "Статус", key: "status", width: 13, value: (r) => statusLabels[r.status] },
  { header: "Исполнитель", key: "executor", width: 28, wrap: true, value: (r) => r.executorName },
  {
    header: "Соисполнители",
    key: "coexecutors",
    width: 32,
    wrap: true,
    value: (r) => (r.coexecutors.length ? r.coexecutors.map((c) => c.fullName).join(", ") : null),
  },
  {
    header: "Срок",
    key: "deadline",
    width: 12,
    numFmt: DATE_FMT,
    value: (r) => excelDate(r.deadline),
  },
  {
    header: "Принята",
    key: "acceptedAt",
    width: 17,
    numFmt: DATE_TIME_FMT,
    value: (r) => excelDateTimeMsk(r.acceptedAt),
  },
  {
    header: "Выполнена",
    key: "completedAt",
    width: 17,
    numFmt: DATE_TIME_FMT,
    value: (r) => excelDateTimeMsk(r.completedAt),
  },
  { header: "Просрочена", key: "overdue", width: 12, value: (r) => (r.isOverdue ? "да" : "нет") },
  {
    header: "Комментарий распределителя",
    key: "dispatcherComment",
    width: 40,
    wrap: true,
    value: (r) => r.dispatcherComment,
  },
  {
    header: "Комментарий исполнителя",
    key: "completionComment",
    width: 40,
    wrap: true,
    value: (r) => r.completionComment,
  },
  {
    header: "Последняя проблема",
    key: "lastProblem",
    width: 40,
    wrap: true,
    value: (r) => r.lastProblem,
  },
];

export type ExportParams = {
  from: string;
  to: string;
  buildingLabel: string;
  statusLabel: string;
  userName: string;
};

/** Книга: лист «Заявки» (шапка жирная и закреплена, автофильтр) + лист «Условия выгрузки». */
export async function buildRequestsWorkbook(
  rows: RequestExportRow[],
  params: ExportParams,
): Promise<Uint8Array<ArrayBuffer>> {
  const wb = new ExcelJS.Workbook();
  wb.creator = APP_NAME;
  wb.created = new Date();

  const ws = wb.addWorksheet("Заявки", {
    views: [{ state: "frozen", xSplit: 1, ySplit: 1 }],
  });
  ws.columns = COLUMNS.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width,
    style: {
      ...(c.numFmt ? { numFmt: c.numFmt } : {}),
      alignment: { vertical: "top" as const, wrapText: c.wrap ?? false },
    },
  }));

  const header = ws.getRow(1);
  header.height = 32;
  header.eachCell((cell) => {
    cell.font = { bold: true };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEF5" } };
    cell.border = { bottom: { style: "thin", color: { argb: "FF9AA5B1" } } };
  });

  const overdueCol = COLUMNS.findIndex((c) => c.key === "overdue") + 1;
  for (const r of rows) {
    const values: Record<string, string | number | Date | null> = {};
    for (const c of COLUMNS) values[c.key] = c.value(r);
    const row = ws.addRow(values);
    if (r.isOverdue) {
      row.getCell(overdueCol).font = { bold: true, color: { argb: "FFB42318" } };
    }
  }

  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: COLUMNS.length },
  };

  // Второй лист — с какими условиями сделана выгрузка.
  const info = wb.addWorksheet("Условия выгрузки");
  info.columns = [
    { key: "k", width: 26 },
    { key: "v", width: 50 },
  ];
  const infoRows: [string, string][] = [
    ["Период (дата создания)", `с ${formatDateMsk(params.from)} по ${formatDateMsk(params.to)}`],
    ["Здание", params.buildingLabel],
    ["Статус", params.statusLabel],
    ["Заявок в выгрузке", String(rows.length)],
    ["Сформировано", `${formatDateTimeMsk(new Date())} (МСК)`],
    ["Кем", params.userName],
  ];
  for (const [k, v] of infoRows) {
    const row = info.addRow({ k, v });
    row.getCell(1).font = { bold: true };
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}
