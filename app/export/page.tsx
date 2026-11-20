import type { Metadata } from "next";
import { FileSpreadsheet } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { listBuildingsForUser } from "@/lib/requests/queries";
import { addDays, monthRangeMsk, todayMsk } from "@/lib/time";
import type { SearchParamsInput } from "@/lib/url";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { ExportForm, type ExportPreset } from "@/components/dispatcher/export-form";
import {
  defaultExportPeriod,
  parseExportQuery,
  STATUS_VIEWS,
} from "@/components/dispatcher/dispatch-params";

export const metadata: Metadata = { title: "Выгрузка в Excel" };

/** Быстрые периоды: этот месяц (по сегодня), прошлый месяц, последние 7 дней, учебный год. */
function periodPresets(today: string): ExportPreset[] {
  const current = defaultExportPeriod(today);
  const prev = monthRangeMsk(addDays(current.from, -1));
  const [y, m] = today.split("-").map(Number);
  const schoolYearFrom = `${m >= 9 ? y : y - 1}-09-01`;
  return [
    { label: "Этот месяц", ...current },
    { label: "Прошлый месяц", ...prev },
    { label: "Неделя", from: addDays(today, -6), to: today },
    { label: "Учебный год", from: schoolYearFrom, to: today },
  ];
}

export default async function ExportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const user = await requireRole(["dispatcher", "admin"]);
  const sp = await searchParams;
  const today = todayMsk();
  const query = parseExportQuery(sp, today);
  const buildings = await listBuildingsForUser(user, { includeInactive: true });
  // «Все заявки» — первым пунктом (это вариант по умолчанию в выгрузке).
  const statuses = [...STATUS_VIEWS]
    .sort((a, b) => (a.value === "all" ? -1 : b.value === "all" ? 1 : 0))
    .map((v) => ({ value: v.value, label: v.label }));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <PageHeader
        title="Скачать таблицу заявок"
        subtitle="Выберите период — получите файл Excel для отчёта или проверки сроков."
      />

      <ExportForm
        today={today}
        initial={{
          from: query.from,
          to: query.to,
          status: query.status,
          building: query.buildingId ? String(query.buildingId) : "",
        }}
        presets={periodPresets(today)}
        buildings={buildings}
        statuses={statuses}
      />

      <Alert tone="neutral" icon={<FileSpreadsheet />} title="Что будет в файле">
        Номер, даты создания, принятия и выполнения, здание, заявитель, описание, срочность,
        статус, исполнители, срок и просрочка, комментарии. Даты — по московскому времени. Файл
        сохранится в «Загрузки» — откройте его в Excel или Google Таблицах.
      </Alert>
    </div>
  );
}
