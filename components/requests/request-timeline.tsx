import {
  Ban,
  CircleCheck,
  CircleX,
  FilePlus,
  MessageSquare,
  Play,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
  UserCog,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import type { EventType } from "@/db/schema";
import type { RequestEventView } from "@/lib/requests/queries";
import { eventTypeLabels, roleLabels } from "@/lib/labels";
import { formatDateMsk, formatWhenMsk } from "@/lib/time";
import { cn, shortName } from "@/lib/utils";
import { PhotoGrid } from "./photo-grid";

/** Иконка и цвет кружка события в ленте. */
const EVENT_STYLE: Record<EventType, { icon: LucideIcon; tone: string }> = {
  created: { icon: FilePlus, tone: "bg-info-bg text-info" },
  assigned: { icon: UserPlus, tone: "bg-aqua-bg text-aqua" },
  reassigned: { icon: UserCog, tone: "bg-aqua-bg text-aqua" },
  accepted: { icon: Play, tone: "bg-primary-soft text-primary" },
  comment: { icon: MessageSquare, tone: "bg-surface-2 text-muted" },
  problem: { icon: TriangleAlert, tone: "bg-danger-bg text-danger" },
  problem_resolved: { icon: ShieldCheck, tone: "bg-success-bg text-success" },
  completed: { icon: CircleCheck, tone: "bg-success-bg text-success" },
  rejected: { icon: Ban, tone: "bg-quiet-bg text-quiet-fg" },
  cancelled: { icon: CircleX, tone: "bg-quiet-bg text-quiet-fg" },
  reopened: { icon: RotateCcw, tone: "bg-warning-bg text-warning" },
};

function EventIcon({ type }: { type: EventType }) {
  const { icon: Icon, tone } = EVENT_STYLE[type];
  return (
    <span
      aria-hidden
      className={cn(
        "relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-surface",
        tone,
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}

function assignmentLine(ev: RequestEventView): string | null {
  if (ev.type !== "assigned" && ev.type !== "reassigned" && ev.type !== "reopened") return null;
  const parts: string[] = [];
  if (ev.executorName) parts.push(`Исполнитель: ${shortName(ev.executorName)}`);
  if (ev.coexecutorNames.length) {
    parts.push(`соисполнители: ${ev.coexecutorNames.map(shortName).join(", ")}`);
  }
  if (ev.meta?.deadline) parts.push(`срок: ${formatDateMsk(ev.meta.deadline)}`);
  return parts.length ? parts.join(" · ") : null;
}

/**
 * Лента истории и комментариев (старые сверху): вертикальная линия, цветные кружки-иконки
 * событий, текст комментария/проблемы — «пузырём». Рассчитана на белую карточку (bg-surface).
 */
export function RequestTimeline({
  events,
  coexecutorIds = [],
  className,
}: {
  events: RequestEventView[];
  /** id соисполнителей заявки — чтобы подписать их «соисполнитель», а не «исполнитель». */
  coexecutorIds?: number[];
  className?: string;
}) {
  const roleOf = (actor: NonNullable<RequestEventView["actor"]>) =>
    actor.role === "executor" && coexecutorIds.includes(actor.id)
      ? "соисполнитель"
      : roleLabels[actor.role].toLowerCase();
  if (events.length === 0) {
    return <p className={cn("text-sm text-muted", className)}>Событий пока нет.</p>;
  }
  return (
    <ol className={cn("flex flex-col", className)}>
      {events.map((ev, i) => {
        const line = assignmentLine(ev);
        const isProblem = ev.type === "problem";
        const isComment = ev.type === "comment";
        const last = i === events.length - 1;
        return (
          <li key={ev.id} className={cn("relative flex gap-3", !last && "pb-5")}>
            {!last ? (
              <span aria-hidden className="absolute top-8 bottom-0 left-[15px] w-0.5 bg-border" />
            ) : null}
            <EventIcon type={ev.type} />
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span
                  className={cn(
                    "text-[15px] leading-snug font-semibold",
                    isProblem ? "text-danger-fg" : "text-text",
                  )}
                >
                  {isComment
                    ? ev.actor
                      ? shortName(ev.actor.fullName)
                      : "Система"
                    : eventTypeLabels[ev.type]}
                </span>
                <span className="text-xs text-muted tabular-nums">{formatWhenMsk(ev.createdAt)}</span>
              </div>
              {ev.actor ? (
                <div className="mt-0.5 text-[13px] text-muted">
                  {isComment ? roleOf(ev.actor) : `${shortName(ev.actor.fullName)} · ${roleOf(ev.actor)}`}
                </div>
              ) : null}
              {line ? <p className="mt-1.5 text-sm leading-snug text-text">{line}</p> : null}
              {ev.text ? (
                <p
                  className={cn(
                    "mt-2 w-fit max-w-full rounded-2xl rounded-tl-md px-3.5 py-2.5 text-[15px] leading-snug whitespace-pre-wrap wrap-anywhere",
                    isProblem ? "bg-danger-bg text-danger-fg" : "bg-surface-2 text-text",
                  )}
                >
                  {ev.text}
                </p>
              ) : null}
              {ev.photos.length ? <PhotoGrid photos={ev.photos} size="sm" className="mt-2" /> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
