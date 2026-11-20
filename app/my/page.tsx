import type { Metadata } from "next";
import Link from "next/link";
import { Archive, CircleCheck, ClipboardList, MapPin, Plus } from "lucide-react";
import { requireRole } from "@/lib/auth";
import {
  listBuildingsForUser,
  listRequests,
  requestCounters,
} from "@/lib/requests/queries";
import { firstParam, withParams, type SearchParamsInput } from "@/lib/url";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { AutoRefresh } from "@/components/requests/auto-refresh";
import { EmptyState } from "@/components/requests/empty-state";
import { RequestListItem } from "@/components/requests/request-list-item";
import { TabLinks } from "@/components/requests/tab-links";

export const metadata: Metadata = { title: "Мои заявки" };

/** Сколько завершённых заявок показываем (свежие сверху). */
const CLOSED_LIMIT = 200;

export default async function MyRequestsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const user = await requireRole(["requester"]);
  const sp = await searchParams;
  const tab: "active" | "closed" = firstParam(sp.tab) === "closed" ? "closed" : "active";

  const [rows, counters, allBuildings] = await Promise.all([
    listRequests(user, {
      statusGroup: tab,
      // Активные — новые сверху; завершённые — недавно закрытые сверху.
      sort: tab === "closed" ? "updated" : "created",
      limit: tab === "closed" ? CLOSED_LIMIT : undefined,
    }),
    requestCounters(user),
    // С отключёнными: чтобы отличить «здание отключено» от «зданий нет».
    listBuildingsForUser(user, { includeInactive: true }),
  ]);

  const canCreate = allBuildings.some((b) => b.active);
  const activeEmpty = tab === "active" && rows.length === 0;
  const newButton = (
    <Link href="/new" className={buttonClasses("primary", "lg", "w-full sm:w-auto")}>
      <Plus aria-hidden className="size-5" />
      Новая заявка
    </Link>
  );

  return (
    <div className="flex flex-col gap-5">
      <AutoRefresh seconds={60} />

      <PageHeader
        title="Заявки моих зданий"
        subtitle={
          allBuildings.length > 0 ? (
            <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1" aria-label="Мои здания">
              {allBuildings.map((b) => (
                <li
                  key={b.id}
                  className={cn(
                    "inline-flex max-w-full min-w-0 items-start gap-1.5 text-sm leading-snug",
                    b.active ? "text-muted" : "text-subtle",
                  )}
                >
                  <MapPin aria-hidden className="mt-px size-4 shrink-0" />
                  <span className="min-w-0 wrap-anywhere">
                    {b.address}
                    {b.active ? null : " · отключено"}
                  </span>
                </li>
              ))}
            </ul>
          ) : null
        }
        // Пустой список «Активные» сам предлагает создать заявку — вторую кнопку не показываем.
        actions={canCreate && !activeEmpty ? newButton : undefined}
      />

      {!canCreate ? (
        <Alert tone="warning" role="status" title="Новую заявку подать нельзя">
          {allBuildings.length === 0
            ? "За вами пока не закреплено ни одного здания. Обратитесь к администратору."
            : allBuildings.length === 1
              ? "Ваше здание отключено администратором. Старые заявки видны ниже."
              : "Ваши здания отключены администратором. Старые заявки видны ниже."}
        </Alert>
      ) : null}

      <TabLinks
        items={[
          {
            href: withParams("/my", sp, { tab: undefined }),
            label: "Активные",
            active: tab === "active",
            count: counters.active,
          },
          {
            href: withParams("/my", sp, { tab: "closed" }),
            label: "Завершённые",
            active: tab === "closed",
          },
        ]}
      />

      {rows.length === 0 ? (
        tab === "active" ? (
          canCreate ? (
            <EmptyState
              icon={<CircleCheck />}
              tone="success"
              title="Активных заявок нет"
              description="Если что-то сломалось или нужен ремонт — создайте заявку, распределитель назначит исполнителя."
              action={newButton}
            />
          ) : (
            <EmptyState
              icon={<ClipboardList />}
              tone="neutral"
              title="Активных заявок нет"
              description="Здесь появятся заявки по вашим зданиям."
            />
          )
        ) : (
          <EmptyState
            icon={<Archive />}
            tone="neutral"
            title="Завершённых заявок пока нет"
            description="Здесь будут выполненные, отклонённые и отменённые заявки."
          />
        )
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.id}>
              {/* У чужих заявок (общее здание) показываем, кто подал. */}
              <RequestListItem row={row} showMine showAuthor={!row.isMine} />
            </li>
          ))}
        </ul>
      )}

      {tab === "closed" && rows.length >= CLOSED_LIMIT ? (
        <p className="text-center text-sm text-muted">
          Показаны последние {CLOSED_LIMIT} завершённых заявок.
        </p>
      ) : null}
    </div>
  );
}
