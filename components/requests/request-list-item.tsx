import Link from "next/link";
import { CalendarClock, CalendarX, CircleCheck, Image as ImageIcon, MapPin } from "lucide-react";
import type { RequestListRow } from "@/lib/requests/queries";
import { deadlineHint, formatDateMsk, formatDateShortMsk, formatWhenMsk } from "@/lib/time";
import { cn, requestNo, shortName } from "@/lib/utils";
import { AvatarStack } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ProblemBadge, StatusBadge, UrgencyBadge } from "./badges";
import { LinkPending } from "./link-pending";

export type RequestListItemProps = {
  row: RequestListRow;
  /** Пометка «моя» на заявках, созданных текущим пользователем (экран заявителя). */
  showMine?: boolean;
  /** Пометка «соисполнитель», если текущий пользователь — соисполнитель (экран исполнителя). */
  showCoexecutor?: boolean;
  /** Показать исполнителя с ФИО (экран распределителя); без него — только кружки-инициалы. */
  showExecutor?: boolean;
  /** Показать автора заявки (экраны распределителя/исполнителя). */
  showAuthor?: boolean;
  className?: string;
};

/**
 * Карточка заявки в списке (ссылка на /r/[id]).
 * Верх: «№ 17 · вчера, 12:51», пометки «моя»/«соисполнитель», справа — статус.
 * Описание (2 строки), адрес · где именно; низ — срочность, срок (красный, если просрочен),
 * «Проблема», число фото, исполнители кружками. У аварийной — красная полоса слева.
 */
export function RequestListItem({
  row,
  showMine,
  showCoexecutor,
  showExecutor,
  showAuthor,
  className,
}: RequestListItemProps) {
  const closed = row.status === "done" || row.status === "rejected" || row.status === "cancelled";
  const emergency = row.urgency === "emergency" && !closed;
  const people = [row.executorName, ...row.coexecutors.map((c) => c.fullName)].filter(
    (n): n is string => Boolean(n),
  );
  const problem = row.problemOpen && !closed;

  return (
    <Link
      href={`/r/${row.id}`}
      className={cn(
        "group relative block overflow-hidden rounded-2xl border bg-surface p-4 shadow-card",
        "transition-[border-color,box-shadow,transform] duration-150 hover:border-border-strong hover:shadow-raised active:scale-[.99]",
        "focus-visible:ring-4 focus-visible:ring-ring focus-visible:outline-none",
        problem ? "border-danger/45" : "border-border",
        className,
      )}
    >
      {emergency ? (
        <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-danger" />
      ) : null}

      {/* Верх: номер, когда создана, пометки, статус */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          <span className="font-semibold text-text tabular-nums">{requestNo(row.id)}</span>
          <span className="tabular-nums">{formatWhenMsk(row.createdAt)}</span>
          {showMine && row.isMine ? (
            <Badge variant="outline" size="sm">
              моя
            </Badge>
          ) : null}
          {showCoexecutor && row.myRole === "coexecutor" ? (
            <Badge variant="outline" size="sm">
              соисполнитель
            </Badge>
          ) : null}
        </div>
        <StatusBadge status={row.status} className="shrink-0" />
      </div>

      {/* Описание */}
      <p className="mt-2 line-clamp-2 text-[15px] leading-snug font-medium wrap-anywhere text-text">
        {row.description}
      </p>

      {/* Адрес */}
      <div className="mt-1.5 flex items-start gap-1.5 text-sm text-muted">
        <MapPin aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span className="min-w-0 wrap-anywhere">
          {row.buildingAddress}
          {row.location ? <span> · {row.location}</span> : null}
        </span>
      </div>

      {showAuthor ? (
        <div className="mt-1 text-sm text-muted">от {shortName(row.authorName)}</div>
      ) : null}

      {/* Низ: срочность, срок, проблема, фото | исполнители */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] whitespace-nowrap text-muted">
          <UrgencyBadge urgency={row.urgency} />
          {problem ? <ProblemBadge /> : null}
          {row.deadline && !closed ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 tabular-nums",
                row.isOverdue && "font-semibold text-danger",
              )}
              title={`Срок: ${formatDateMsk(row.deadline)}`}
            >
              {row.isOverdue ? (
                <CalendarX aria-hidden className="size-4" />
              ) : (
                <CalendarClock aria-hidden className="size-4" />
              )}
              {row.isOverdue ? "Просрочена · " : "до "}
              {formatDateShortMsk(row.deadline)}
              {!row.isOverdue ? (
                <span className="text-subtle"> ({deadlineHint(row.deadline)})</span>
              ) : null}
            </span>
          ) : null}
          {row.status === "done" && row.completedAt ? (
            <span className="inline-flex items-center gap-1 text-success-fg tabular-nums">
              <CircleCheck aria-hidden className="size-4" />
              {formatDateShortMsk(row.completedAt)}
            </span>
          ) : null}
          {row.photoCount > 0 ? (
            <span className="inline-flex items-center gap-1 tabular-nums" title="Фото">
              <ImageIcon aria-hidden className="size-4" />
              {row.photoCount}
            </span>
          ) : null}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {showExecutor ? (
            <span
              className={cn(
                "max-w-32 truncate text-[13px] sm:max-w-44",
                row.executorName ? "text-text" : "text-subtle",
              )}
            >
              {row.executorName ? shortName(row.executorName) : "не назначен"}
            </span>
          ) : null}
          {people.length ? <AvatarStack names={people} max={3} size="sm" /> : null}
        </div>
      </div>

      <LinkPending />
    </Link>
  );
}

/** Список карточек заявок (без пустого состояния — его показывайте через EmptyState). */
export function RequestList({
  rows,
  ...itemProps
}: { rows: RequestListRow[] } & Omit<RequestListItemProps, "row" | "className">) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.id}>
          <RequestListItem row={row} {...itemProps} />
        </li>
      ))}
    </ul>
  );
}
