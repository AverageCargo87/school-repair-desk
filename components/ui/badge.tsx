import { cn } from "@/lib/utils";

/**
 * Тон метки. Статусы заявок: new → info (синий), assigned → aqua (бирюзовый),
 * in_progress → primary (индиго), done → success (зелёный), rejected/cancelled → neutral (серый).
 * progress — старое имя бирюзового (= aqua); purple — фиолетовый (роли, прочее).
 */
export type BadgeVariant =
  | "neutral"
  | "info"
  | "primary"
  | "aqua"
  | "success"
  | "warning"
  | "danger"
  | "progress"
  | "purple"
  | "outline";

const variants: Record<BadgeVariant, string> = {
  neutral: "bg-quiet-bg text-quiet-fg",
  info: "bg-info-bg text-info-fg",
  primary: "bg-primary-soft text-primary-soft-fg",
  aqua: "bg-aqua-bg text-aqua-fg",
  progress: "bg-aqua-bg text-aqua-fg",
  success: "bg-success-bg text-success-fg",
  warning: "bg-warning-bg text-warning-fg",
  danger: "bg-danger-bg text-danger-fg",
  purple: "bg-purple-bg text-purple-fg",
  outline: "border border-border bg-surface text-muted",
};

const sizes = {
  sm: "h-5 gap-1 px-2 text-[11px] [&_svg]:size-3",
  md: "h-6 gap-1 px-2.5 text-xs [&_svg]:size-3.5",
  lg: "h-7 gap-1.5 px-3 text-[13px] [&_svg]:size-4",
} as const;

/**
 * Метка-пилюля (только показ, не нажимается).
 *   <Badge variant="success" dot>Выполнена</Badge>
 *   <Badge variant="danger" icon={<TriangleAlert />}>Проблема</Badge>
 */
export function Badge({
  variant = "neutral",
  size = "md",
  dot,
  icon,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  size?: keyof typeof sizes;
  /** Точка слева (цвет = цвет текста) — для статусов. */
  dot?: boolean;
  /** Иконка слева (элемент lucide-react; размер подставится сам). */
  icon?: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full font-medium whitespace-nowrap [&_svg]:shrink-0",
        sizes[size],
        variants[variant],
        className,
      )}
      {...props}
    >
      {dot ? <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" /> : null}
      {icon}
      {children}
    </span>
  );
}
