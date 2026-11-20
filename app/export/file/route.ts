import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listBuildingsForUser, listRequestsForExport } from "@/lib/requests/queries";
import { isDispatcherRole } from "@/lib/roles";
import { todayMsk } from "@/lib/time";
import {
  exportListFilters,
  parseExportQuery,
  statusViewLabel,
} from "@/components/dispatcher/dispatch-params";
import { buildRequestsWorkbook } from "./workbook";

/**
 * GET /export/file?from=YYYY-MM-DD&to=YYYY-MM-DD&building=<id>&status=<вариант>
 * Выгрузка заявок в .xlsx — только распределитель и админ.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    // Сессия закончилась — на вход (относительный Location, чтобы не зависеть от прокси).
    return new Response(null, { status: 303, headers: { Location: "/login" } });
  }
  if (!isDispatcherRole(user.role)) {
    return new Response("Выгрузка доступна только распределителю.", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const params: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((v, k) => {
    if (!(k in params)) params[k] = v;
  });
  const query = parseExportQuery(params, todayMsk());

  const [rows, buildings] = await Promise.all([
    listRequestsForExport(user, exportListFilters(query)),
    query.buildingId ? listBuildingsForUser(user, { includeInactive: true }) : Promise.resolve([]),
  ]);
  // По порядку номеров — так удобнее читать таблицу.
  rows.sort((a, b) => a.id - b.id);

  const buildingLabel = query.buildingId
    ? (buildings.find((b) => b.id === query.buildingId)?.address ?? `здание #${query.buildingId}`)
    : "Все здания";

  const data = await buildRequestsWorkbook(rows, {
    from: query.from,
    to: query.to,
    buildingLabel,
    statusLabel: statusViewLabel(query.status),
    userName: user.fullName,
  });

  const fileName = `zayavki_${query.from}_${query.to}.xlsx`;
  return new Response(data, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Length": String(data.byteLength),
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
