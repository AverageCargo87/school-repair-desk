import { cn } from "@/lib/utils";

/**
 * Чип-фильтр (нажимаемая пилюля, вкл/выкл): фильтры по ролям, быстрые сроки и т. п.
 * Для ссылок — chipClasses(active): <Link className={chipClasses(active)}>…</Link>.
 * Метка «только показать» — это Badge, не Chip.
 */
export function chipClasses(active: boolean, className?: string): string {
  return cn(
    "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap select-none",
    "transition-[background-color,border-color,color] duration-150 active:scale-[.98]",
    "focus-visible:ring-4 focus-visible:ring-ring focus-visible:outline-none [&_svg]:size-4 [&_svg]:shrink-0",
    "disabled:pointer-events-none disabled:opacity-50",
    active
      ? "border-primary bg-primary-soft text-primary-soft-fg"
      : "border-border bg-surface text-text hover:border-border-strong hover:bg-surface-2",
    className,
  );
}

/** Число в чипе/вкладке. alert — красное, если > 0. */
export function CountBubble({
  value,
  alert,
  active,
  className,
}: {
  value: number;
  alert?: boolean;
  active?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums",
        alert && value > 0
          ? "bg-danger text-danger-contrast"
          : active
            ? "bg-primary text-primary-fg"
            : "bg-surface-3 text-muted",
        className,
      )}
    >
      {value}
    </span>
  );
}

/**
 * <Chip active={on} onClick={() => setOn(!on)} icon={<Users />} count={12}>Исполнители</Chip>
 */
export function Chip({
  active = false,
  icon,
  count,
  alert,
  className,
  children,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  icon?: React.ReactNode;
  count?: number;
  alert?: boolean;
}) {
  return (
    <button type={type} aria-pressed={active} className={chipClasses(active, className)} {...props}>
      {icon}
      {children}
      {count !== undefined ? <CountBubble value={count} alert={alert} active={active} /> : null}
    </button>
  );
}
