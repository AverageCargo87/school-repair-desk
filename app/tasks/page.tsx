import type { Metadata } from "next";
import { CheckCheck, ClipboardCheck, ListTodo } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { listRequests, requestCounters } from "@/lib/requests/queries";
import { firstParam, withParams, type SearchParamsInput } from "@/lib/url";
import { MSK_TZ } from "@/lib/time";
import { PageHeader } from "@/components/ui/page-header";
import { AutoRefresh } from "@/components/requests/auto-refresh";
import { EmptyState } from "@/components/requests/empty-state";
import { RequestList } from "@/components/requests/request-list-item";
import { TabLinks } from "@/components/requests/tab-links";
import { TasksSummary } from "@/components/executor/tasks-summary";

export const metadata: Metadata = { title: "Мои задачи" };

type Tab = "active" | "done";

const hourFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: MSK_TZ,
  hour: "numeric",
  hourCycle: "h23",
});

/** «Добрый день, Денис Валерьевич» — по московскому времени. */
function greeting(fullName: string, now: Date = new Date()): string {
  const h = Number.parseInt(hourFormatter.format(now), 10);
  const hour = Number.isFinite(h) ? h : 12;
  const hello =
    hour >= 5 && hour < 12
      ? "Доброе утро"
      : hour >= 12 && hour < 18
        ? "Добрый день"
        : hour >= 18 && hour < 23
          ? "Добрый вечер"
          : "Доброй ночи";
  // ФИО: «Фамилия Имя Отчество» → «Имя Отчество».
  const [last, ...rest] = fullName.trim().split(/\s+/);
  const name = rest.join(" ") || last;
  return name ? `${hello}, ${name}` : hello;
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  // Проверка роли и в layout, и здесь: страница не должна зависеть только от layout.
  const user = await requireRole(["executor"]);
  const sp = await searchParams;
  const tab: Tab = firstParam(sp.tab) === "done" ? "done" : "active";

  const [rows, counters] = await Promise.all([
    // Сортировка по умолчанию для исполнителя: активные — просроченные, затем по сроку;
    // завершённые — по последнему изменению.
    listRequests(user, { statusGroup: tab === "done" ? "closed" : "active" }),
    requestCounters(user),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <AutoRefresh seconds={60} />

      {/* «Мои задачи» уже написано в верхней панели телефона — здесь приветствие. */}
      <PageHeader
        title={greeting(user.fullName)}
        subtitle="Здесь заявки, где вы исполнитель или соисполнитель. Список обновляется сам."
      />

      <TabLinks
        items={[
          {
            href: withParams("/tasks", sp, { tab: undefined }),
            label: "Активные",
            icon: <ListTodo aria-hidden />,
            active: tab === "active",
            count: counters.inWork,
            alert: counters.overdue > 0 || counters.problem > 0,
          },
          {
            href: withParams("/tasks", sp, { tab: "done" }),
            label: "Выполненные",
            icon: <CheckCheck aria-hidden />,
            active: tab === "done",
          },
        ]}
      />

      {tab === "active" ? <TasksSummary rows={rows} /> : null}

      {rows.length === 0 ? (
        tab === "active" ? (
          <EmptyState
            icon={<CheckCheck />}
            tone="success"
            title="Активных заявок нет"
            description="Когда распределитель назначит вам заявку, она появится здесь. Страница обновляется сама раз в минуту."
          />
        ) : (
          <EmptyState
            icon={<ClipboardCheck />}
            tone="neutral"
            title="Выполненных заявок пока нет"
            description="Здесь будут заявки, которые вы отметили «Выполнено», и заявки, отклонённые распределителем."
          />
        )
      ) : (
        <RequestList rows={rows} showCoexecutor showAuthor />
      )}
    </div>
  );
}
