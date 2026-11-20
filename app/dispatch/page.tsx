import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarX,
  CircleCheck,
  FilePlus,
  FileSpreadsheet,
  Layers,
  Plus,
  RotateCcw,
  SearchX,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import {
  dispatcherCounters,
  listBuildingsForUser,
  listExecutors,
  listRequests,
} from "@/lib/requests/queries";
import { withParams, type SearchParamsInput } from "@/lib/url";
import { pluralRu } from "@/lib/utils";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile, type StatTone } from "@/components/ui/stat-tile";
import { AutoRefresh } from "@/components/requests/auto-refresh";
import { EmptyState } from "@/components/requests/empty-state";
import { RequestListItem } from "@/components/requests/request-list-item";
import { DispatchFilters } from "@/components/dispatcher/dispatch-filters";
import { TilesRow } from "@/components/dispatcher/tiles-row";
import {
  countDispatchFilters,
  DISPATCH_DEFAULT_STATUS,
  dispatchListFilters,
  isRequestNumberQuery,
  parseDispatchQuery,
  type StatusView,
} from "@/components/dispatcher/dispatch-params";

export const metadata: Metadata = { title: "Все заявки" };

/** Сколько заявок показываем за раз (дальше — уточнить фильтры или выгрузить в Excel). */
const LIST_LIMIT = 200;

/** Заголовок страницы по выбранному статусу (на телефоне вверху и так написано «Все заявки»). */
const VIEW_TITLES: Record<StatusView, string> = {
  active: "Активные заявки",
  problem: "Заявки с проблемой",
  overdue: "Просроченные заявки",
  new: "Новые заявки",
  work: "У исполнителей",
  assigned: "Назначены, ещё не приняты",
  in_progress: "Приняты, в работе",
  done: "Выполненные заявки",
  rejected: "Отклонённые заявки",
  cancelled: "Отменённые заявки",
  closed: "Завершённые заявки",
  all: "Все заявки",
};

/** Пустой список без фильтров и поиска — по выбранному статусу. */
const EMPTY_BY_VIEW: Partial<
  Record<StatusView, { title: string; description: string; tone: "success" | "neutral" }>
> = {
  active: {
    title: "Активных заявок нет",
    description: "Всё сделано. Новые заявки появятся здесь сами — список обновляется каждую минуту.",
    tone: "success",
  },
  new: { title: "Новых заявок нет", description: "Все заявки распределены по исполнителям.", tone: "success" },
  problem: { title: "Проблем нет", description: "Исполнители ни о чём не сообщали.", tone: "success" },
  overdue: { title: "Просроченных нет", description: "Все заявки укладываются в сроки.", tone: "success" },
  work: { title: "У исполнителей пусто", description: "Назначенных и принятых заявок сейчас нет.", tone: "neutral" },
};

export default async function DispatchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const user = await requireRole(["dispatcher", "admin"]);
  const sp = await searchParams;
  const query = parseDispatchQuery(sp);

  const [counters, rows, buildings, executors] = await Promise.all([
    dispatcherCounters(),
    listRequests(user, { ...dispatchListFilters(query), sort: "dispatcher", limit: LIST_LIMIT }),
    listBuildingsForUser(user, { includeInactive: true }),
    listExecutors({ includeInactive: true }),
  ]);

  const byNumber = isRequestNumberQuery(query.q);

  // Плитки-счётчики: меняют только статус, остальные фильтры и поиск сохраняются.
  const tiles: {
    view: StatusView;
    label: string;
    value: number;
    icon: React.ReactNode;
    tone: StatTone;
    hint: string;
    alert?: boolean;
  }[] = [
    { view: "new", label: "Новые", value: counters.new, icon: <FilePlus />, tone: "info", hint: "ждут исполнителя" },
    {
      view: "problem",
      label: "Проблема",
      value: counters.problem,
      icon: <TriangleAlert />,
      tone: "danger",
      hint: "пишут исполнители",
      alert: true,
    },
    {
      view: "overdue",
      label: "Просрочены",
      value: counters.overdue,
      icon: <CalendarX />,
      tone: "danger",
      hint: "срок уже прошёл",
      alert: true,
    },
    { view: "work", label: "В работе", value: counters.inWork, icon: <Wrench />, tone: "primary", hint: "у исполнителей" },
    {
      view: "active",
      label: "Все активные",
      value: counters.active,
      icon: <Layers />,
      tone: "default",
      hint: "ещё не завершены",
    },
  ];

  const activeFilters = countDispatchFilters(query);
  const filtered = activeFilters > 0 || query.q !== "";
  // Есть фильтры кроме статуса (или поиск) — пустой список значит «ничего не нашли».
  const narrowed = filtered && !(activeFilters === 1 && query.status !== DISPATCH_DEFAULT_STATUS && !query.q);
  const exportHref = withParams("/export", {}, {
    building: query.buildingId,
    status: query.status === DISPATCH_DEFAULT_STATUS ? undefined : query.status,
  });

  const title = byNumber ? "Поиск по номеру" : VIEW_TITLES[query.status];
  const emptyView = !narrowed ? EMPTY_BY_VIEW[query.status] : undefined;
  const dispatcherOrder = ["active", "work", "all"].includes(query.status) && !byNumber;

  return (
    <div className="flex flex-col gap-5">
      <AutoRefresh seconds={60} />

      <div className="flex items-end justify-between gap-6">
        <PageHeader title={title} className="min-w-0 flex-1" />
        {/* На телефоне «Новая» и «Выгрузка» есть в нижней панели. */}
        <div className="hidden shrink-0 gap-2 md:flex">
          <Link href="/new" className={buttonClasses("primary", "md")}>
            <Plus className="size-[18px]" aria-hidden />
            Новая заявка
          </Link>
          <Link href={exportHref} className={buttonClasses("outline", "md")}>
            <FileSpreadsheet className="size-[18px]" aria-hidden />
            Выгрузка в Excel
          </Link>
        </div>
      </div>

      <TilesRow
        label="Быстрые фильтры"
        revealKey={query.status !== DISPATCH_DEFAULT_STATUS ? query.status : undefined}
      >
        {tiles.map((t) => (
          <StatTile
            key={t.view}
            href={withParams("/dispatch", sp, {
              status: t.view === DISPATCH_DEFAULT_STATUS ? undefined : t.view,
            })}
            label={t.label}
            value={t.value}
            icon={t.icon}
            tone={t.tone}
            hint={t.hint}
            alert={t.alert}
            active={!byNumber && query.status === t.view}
          />
        ))}
      </TilesRow>

      <DispatchFilters
        values={{
          status: query.status,
          building: query.buildingId ? String(query.buildingId) : "",
          urgency: query.urgency ?? "",
          executor: query.executorId ? String(query.executorId) : "",
          q: query.q,
        }}
        activeCount={activeFilters}
        buildings={buildings}
        executors={executors.map((e) => ({ id: e.id, fullName: e.fullName, active: e.active }))}
      />

      {rows.length === 0 ? (
        emptyView ? (
          <EmptyState
            icon={emptyView.tone === "success" ? <CircleCheck /> : undefined}
            tone={emptyView.tone}
            title={emptyView.title}
            description={emptyView.description}
          />
        ) : (
          <EmptyState
            icon={<SearchX />}
            tone="neutral"
            title="Ничего не найдено"
            description={
              byNumber
                ? `Заявки с номером ${query.q.replace(/\D/g, "")} нет. Проверьте номер.`
                : "Попробуйте изменить фильтры или поиск."
            }
            action={
              <Link href="/dispatch" className={buttonClasses("outline", "lg")}>
                <RotateCcw className="size-5" aria-hidden />
                Сбросить фильтры
              </Link>
            }
          />
        )
      ) : (
        <section aria-label="Список заявок" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <p className="text-sm text-muted">
              <span className="font-semibold text-text tabular-nums">
                {rows.length >= LIST_LIMIT ? `Первые ${LIST_LIMIT}` : rows.length}{" "}
                {pluralRu(rows.length, ["заявка", "заявки", "заявок"])}
              </span>
              {rows.length >= LIST_LIMIT
                ? " — уточните фильтры или сделайте выгрузку в Excel"
                : byNumber
                  ? " · поиск по номеру идёт среди всех заявок, включая завершённые"
                  : dispatcherOrder
                    ? " · сверху — с проблемой, затем новые и просроченные"
                    : null}
            </p>
            {filtered ? (
              <Link
                href="/dispatch"
                scroll={false}
                className="-mx-2 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-medium text-primary transition-colors hover:bg-primary-soft focus-visible:ring-4 focus-visible:ring-ring focus-visible:outline-none"
              >
                <RotateCcw className="size-4" aria-hidden />
                Сбросить фильтры
              </Link>
            ) : null}
          </div>
          <ul className="grid gap-3 lg:grid-cols-2">
            {rows.map((row) => (
              <li key={row.id} className="min-w-0">
                <RequestListItem row={row} showExecutor showAuthor className="h-full" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
