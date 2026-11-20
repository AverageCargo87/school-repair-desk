import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepItem = { label: string; hint?: string };

/**
 * Горизонтальный степпер: пройденные шаги — с галочкой, текущий подсвечен, будущие — серые.
 * complete — все шаги пройдены (например, заявка «Выполнена»): последний шаг зелёный.
 *
 *   <Stepper steps={["Новая", "Назначена", "В работе", "Выполнена"]} current={1} />
 */
export function Stepper({
  steps,
  current,
  complete,
  className,
}: {
  steps: (string | StepItem)[];
  /** Индекс текущего шага (с нуля). */
  current: number;
  complete?: boolean;
  className?: string;
}) {
  const items = steps.map((s) => (typeof s === "string" ? { label: s } : s));
  return (
    <ol className={cn("flex w-full items-start", className)} aria-label="Ход выполнения">
      {items.map((step, i) => {
        const done = i < current || (complete && i <= current);
        const isCurrent = i === current && !complete;
        const isLastDone = complete && i === current;
        const lineDone = i <= current;
        return (
          <li
            key={step.label}
            aria-current={isCurrent ? "step" : undefined}
            className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center"
          >
            {i > 0 ? (
              <span
                aria-hidden
                className={cn(
                  "absolute top-[13px] right-[calc(50%+18px)] left-[calc(-50%+18px)] h-0.5 rounded-full",
                  lineDone ? (complete ? "bg-success" : "bg-primary") : "bg-border-strong",
                )}
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 inline-flex size-7 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-colors",
                isLastDone
                  ? "bg-success text-surface"
                  : done
                    ? complete
                      ? "bg-success text-surface"
                      : "bg-primary text-primary-fg"
                    : isCurrent
                      ? "bg-primary-soft text-primary ring-2 ring-primary"
                      : "border border-border-strong bg-surface text-subtle",
              )}
            >
              {done ? (
                <Check className="size-4" strokeWidth={3} aria-hidden />
              ) : isCurrent ? (
                <span aria-hidden className="size-2.5 rounded-full bg-primary" />
              ) : (
                i + 1
              )}
            </span>
            <span
              className={cn(
                "w-full truncate px-0.5 text-xs leading-tight",
                isCurrent || isLastDone ? "font-semibold text-text" : done ? "text-text" : "text-muted",
              )}
            >
              {step.label}
            </span>
            {step.hint ? (
              <span className="-mt-1 w-full truncate px-0.5 text-[11px] text-muted tabular-nums">{step.hint}</span>
            ) : null}
            <span className="sr-only">
              {done ? " — пройдено" : isCurrent ? " — сейчас" : " — впереди"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
