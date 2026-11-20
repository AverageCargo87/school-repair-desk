import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type OptionTone = "primary" | "danger" | "warning" | "neutral";

const tones: Record<OptionTone, { card: string; icon: string; mark: string }> = {
  primary: {
    card: "has-checked:border-primary has-checked:bg-primary-soft/60 has-checked:ring-primary",
    icon: "bg-primary-soft text-primary",
    mark: "group-has-checked:border-primary group-has-checked:bg-primary",
  },
  danger: {
    card: "has-checked:border-danger has-checked:bg-danger-bg/70 has-checked:ring-danger",
    icon: "bg-danger-bg text-danger",
    mark: "group-has-checked:border-danger group-has-checked:bg-danger",
  },
  warning: {
    card: "has-checked:border-warning has-checked:bg-warning-bg/70 has-checked:ring-warning",
    icon: "bg-warning-bg text-warning",
    mark: "group-has-checked:border-warning group-has-checked:bg-warning",
  },
  neutral: {
    card: "has-checked:border-primary has-checked:bg-primary-soft/60 has-checked:ring-primary",
    icon: "bg-surface-2 text-muted",
    mark: "group-has-checked:border-primary group-has-checked:bg-primary",
  },
};

/**
 * Крупная карточка-вариант для radio/checkbox: иконка, заголовок, пояснение, галочка.
 * Это <label> с настоящим (скрытым) <input>, поэтому работает в обычной форме (FormData),
 * с required, с клавиатурой; выбранное состояние — чистым CSS (:has(:checked)).
 * Все лишние пропсы уходят в <input>: name, value, required, checked/defaultChecked, onChange…
 *
 *   <div role="radiogroup" aria-label="Срочность" className="grid gap-3 sm:grid-cols-3">
 *     <OptionCard name="urgency" value="emergency" required tone="danger" icon={<Siren />}
 *       title="Аварийная" description="Опасно или мешает работе — нужно срочно" />
 *     …
 *   </div>
 */
export function OptionCard({
  type = "radio",
  icon,
  title,
  description,
  tone = "primary",
  className,
  children,
  ...inputProps
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "title"> & {
  type?: "radio" | "checkbox";
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  tone?: OptionTone;
  /** Доп. содержимое под пояснением. */
  children?: React.ReactNode;
}) {
  const t = tones[tone];
  return (
    <label
      className={cn(
        "group relative flex min-h-14 cursor-pointer items-start gap-3 rounded-2xl border border-border bg-surface p-3.5 shadow-card select-none sm:p-4",
        "transition-[border-color,background-color,box-shadow,transform] duration-150 hover:border-border-strong active:scale-[.99]",
        "has-checked:ring-1 has-focus-visible:ring-4 has-focus-visible:ring-ring",
        "has-disabled:cursor-not-allowed has-disabled:opacity-60",
        t.card,
        className,
      )}
    >
      <input type={type} className="sr-only" {...inputProps} />
      {icon ? (
        <span
          aria-hidden
          className={cn(
            "inline-flex size-10 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5",
            t.icon,
          )}
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 self-center">
        <span className="block text-[15px] leading-snug font-semibold text-text">{title}</span>
        {description ? (
          <span className="mt-0.5 block text-sm leading-snug text-muted">{description}</span>
        ) : null}
        {children}
      </span>
      <span
        aria-hidden
        className={cn(
          "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center border-2 border-border-strong text-surface transition-colors",
          type === "radio" ? "rounded-full" : "rounded-md",
          t.mark,
        )}
      >
        <Check className="size-3.5 opacity-0 group-has-checked:opacity-100" strokeWidth={3.5} />
      </span>
    </label>
  );
}
