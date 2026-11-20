import { CalendarX, Camera, Hand, TriangleAlert, Wrench } from "lucide-react";
import type { RequestListRow } from "@/lib/requests/queries";
import { cn, pluralRu } from "@/lib/utils";

type Tone = "aqua" | "primary" | "danger";

const toneIcon: Record<Tone, string> = {
  aqua: "bg-aqua-bg text-aqua",
  primary: "bg-primary-soft text-primary",
  danger: "bg-danger-bg text-danger",
};

/** Одна ячейка сводки: иконка в кружке, крупное число, подпись. */
function Stat({
  label,
  value,
  icon,
  tone,
  alert,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: Tone;
  /** Число красным, если > 0. */
  alert?: boolean;
}) {
  return (
    <li className="flex min-w-0 flex-col gap-2 px-3 py-3.5 sm:px-4">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={cn(
            "inline-flex size-8 shrink-0 items-center justify-center rounded-full [&_svg]:size-4",
            value > 0 ? toneIcon[tone] : "bg-surface-2 text-subtle",
          )}
        >
          {icon}
        </span>
        <span
          className={cn(
            "text-2xl leading-none font-semibold tracking-tight tabular-nums",
            alert && value > 0 ? "text-danger" : value > 0 ? "text-text" : "text-subtle",
          )}
        >
          {value}
        </span>
      </div>
      <span className="text-[13px] leading-tight text-muted">{label}</span>
    </li>
  );
}

/** Строка подсказки под счётчиками. */
function Hint({
  icon,
  tone = "default",
  children,
}: {
  icon: React.ReactNode;
  tone?: "default" | "danger";
  children: React.ReactNode;
}) {
  return (
    <li className={cn("flex items-start gap-2.5", tone === "danger" ? "text-danger-fg" : "text-text")}>
      <span
        aria-hidden
        className={cn("mt-px inline-flex shrink-0 [&_svg]:size-4", tone === "danger" ? "text-danger" : "text-muted")}
      >
        {icon}
      </span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}

/**
 * Сводка над списком «Мои задачи» (вкладка «Активные»): одна карточка-плашка
 * с тремя счётчиками (ждут «Принял», в работе, просрочены) и короткими подсказками,
 * что делать дальше. Пустой список — ничего не показывает (там EmptyState).
 */
export function TasksSummary({ rows }: { rows: RequestListRow[] }) {
  if (rows.length === 0) return null;

  const toAccept = rows.filter((r) => r.myRole === "executor" && r.status === "assigned").length;
  const inWork = rows.filter((r) => r.status === "in_progress").length;
  const overdue = rows.filter((r) => r.isOverdue).length;
  const problems = rows.filter((r) => r.problemOpen).length;
  const myInWork = rows.filter((r) => r.myRole === "executor" && r.status === "in_progress").length;

  const hints: React.ReactNode[] = [];
  if (overdue) {
    hints.push(
      <Hint key="overdue" tone="danger" icon={<TriangleAlert />}>
        <b className="font-semibold">
          {overdue} {pluralRu(overdue, ["заявка просрочена", "заявки просрочены", "заявок просрочено"])}.
        </b>{" "}
        Не успеваете — сообщите о проблеме в заявке, распределитель перенесёт срок.
      </Hint>,
    );
  }
  if (toAccept) {
    hints.push(
      <Hint key="accept" icon={<Hand />}>
        Откройте {pluralRu(toAccept, ["новую заявку", "новые заявки", "новые заявки"])} и нажмите
        «Принял».
      </Hint>,
    );
  }
  if (problems) {
    hints.push(
      <Hint key="problem" icon={<TriangleAlert />}>
        «Проблема» в {problems} {pluralRu(problems, ["заявке", "заявках", "заявках"])} —
        распределитель уже разбирается.
      </Hint>,
    );
  }
  if (!overdue && !toAccept && myInWork) {
    hints.push(
      <Hint key="done" icon={<Camera />}>
        Закончили работу? Откройте заявку, сфотографируйте результат и нажмите «Выполнено».
      </Hint>,
    );
  }

  return (
    <section
      aria-label="Сводка по задачам"
      className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card"
    >
      <ul className="grid grid-cols-3 divide-x divide-border">
        <Stat label="Ждут «Принял»" value={toAccept} icon={<Hand />} tone="aqua" />
        <Stat label="В работе" value={inWork} icon={<Wrench />} tone="primary" />
        <Stat label="Просрочены" value={overdue} icon={<CalendarX />} tone="danger" alert />
      </ul>
      {hints.length ? (
        <ul className="flex flex-col gap-2 border-t border-border bg-surface-2/60 px-4 py-3 text-[13px] leading-snug sm:text-sm">
          {hints}
        </ul>
      ) : null}
    </section>
  );
}
