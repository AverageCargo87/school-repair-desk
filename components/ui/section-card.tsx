import { cn } from "@/lib/utils";

export type SectionTone = "default" | "brand" | "danger" | "success" | "warning";

const toneCard: Record<SectionTone, string> = {
  default: "border-border",
  brand: "border-primary/45 ring-1 ring-primary/15",
  danger: "border-danger/40 ring-1 ring-danger/10",
  success: "border-success/40",
  warning: "border-warning/40",
};

const toneIcon: Record<SectionTone, string> = {
  default: "bg-surface-2 text-muted",
  brand: "bg-primary-soft text-primary",
  danger: "bg-danger-bg text-danger",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
};

/**
 * Карточка-секция с заголовком: «Назначение», «Результат», «История»…
 * tone="brand" — выделенная (панель действий), danger — проблема, success — результат.
 *
 *   <SectionCard title="Назначение" icon={<UserCheck />} actions={<Button size="sm" variant="ghost">…</Button>}>
 *     …
 *   </SectionCard>
 */
export function SectionCard({
  title,
  description,
  icon,
  actions,
  tone = "default",
  id,
  className,
  contentClassName,
  children,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Иконка в цветном квадратике слева от заголовка (элемент lucide-react). */
  icon?: React.ReactNode;
  /** Кнопки/ссылки справа от заголовка. */
  actions?: React.ReactNode;
  tone?: SectionTone;
  id?: string;
  className?: string;
  contentClassName?: string;
  children?: React.ReactNode;
}) {
  const hasHeader = Boolean(title || actions);
  return (
    <section
      id={id}
      className={cn("scroll-mt-20 rounded-2xl border bg-surface shadow-card", toneCard[tone], className)}
    >
      {hasHeader ? (
        <div className="flex items-start gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
          {icon ? (
            <span
              aria-hidden
              className={cn(
                "inline-flex size-9 shrink-0 items-center justify-center rounded-xl [&_svg]:size-[18px]",
                toneIcon[tone],
              )}
            >
              {icon}
            </span>
          ) : null}
          <div className="min-w-0 flex-1 self-center">
            {title ? (
              <h2 className="text-base leading-snug font-semibold tracking-tight text-text">{title}</h2>
            ) : null}
            {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children ? (
        <div
          className={cn(
            "px-4 pb-4 sm:px-5 sm:pb-5",
            hasHeader ? "pt-3.5" : "pt-4 sm:pt-5",
            contentClassName,
          )}
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}
