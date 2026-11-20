import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

/**
 * Варианты кнопки. Цвет меняйте вариантом, а не className: `cn` не сливает конфликтующие
 * классы, а в Tailwind v4 при конфликте (`text-text` и `text-danger`) побеждает порядок в CSS,
 * а не порядок в строке. Для «негромких» красных кнопок — `danger-outline` / `danger-ghost`.
 *
 * primary — главное действие экрана (одно на экран/форму);
 * soft — второстепенное действие в цвете бренда (мягкий фон);
 * secondary — серая заливка; outline — белая с рамкой; ghost — без фона (в меню, «Отмена»);
 * danger / danger-outline / danger-ghost — удаление, отклонение, отключение.
 */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "soft"
  | "danger"
  | "danger-outline"
  | "danger-ghost";
type Variant = ButtonVariant;
/** sm — 40px (плотные места), md — 44px, lg — 48px (основные кнопки на телефоне), icon — квадрат 44px. */
export type ButtonSize = "sm" | "md" | "lg" | "icon";
type Size = ButtonSize;

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap select-none " +
  "transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-150 ease-out " +
  "active:scale-[.98] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 " +
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring [&_svg]:shrink-0";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-fg shadow-brand hover:bg-primary-hover",
  soft: "bg-primary-soft text-primary-soft-fg hover:bg-primary-soft-hover",
  secondary: "bg-surface-2 text-text hover:bg-surface-3",
  outline: "border border-border-strong bg-surface text-text shadow-card hover:bg-surface-2",
  ghost: "text-text hover:bg-surface-2",
  danger: "bg-danger text-danger-contrast hover:bg-danger-hover",
  "danger-outline": "border border-danger/40 bg-surface text-danger hover:bg-danger-bg",
  "danger-ghost": "text-danger hover:bg-danger-bg",
};

const sizes: Record<Size, string> = {
  sm: "h-10 px-3.5 text-sm",
  md: "h-11 px-4 text-[15px]",
  lg: "h-12 px-5 text-base",
  icon: "h-11 w-11 p-0",
};

/** Размер иконки внутри кнопки (для пропа icon). */
const iconSizes: Record<Size, string> = {
  sm: "[&>svg]:size-4",
  md: "[&>svg]:size-[18px]",
  lg: "[&>svg]:size-5",
  icon: "[&>svg]:size-5",
};

/**
 * Классы кнопки — для <Link>/<a>, которые выглядят как кнопка:
 *   <Link href="/new" className={buttonClasses("primary", "lg", "w-full sm:w-auto")}>
 *     <Plus className="size-5" /> Новая заявка
 *   </Link>
 */
export function buttonClasses(
  variant: Variant = "primary",
  size: Size = "md",
  className?: string,
): string {
  return cn(base, variants[variant], sizes[size], className);
}

/**
 * Кнопка. Иконка слева — пропом `icon` (элемент, напр. `icon={<Plus />}`; размер подставится сам)
 * или просто первым ребёнком. `loading` — крутилка вместо иконки и блокировка нажатий.
 */
export function Button({
  variant = "primary",
  size = "md",
  icon,
  loading,
  className,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
  /** Иконка слева (элемент lucide-react). */
  icon?: React.ReactNode;
  /** Идёт действие: крутилка + disabled. */
  loading?: boolean;
}) {
  const lead = loading ? <Spinner className="size-[1.1em]" /> : icon;
  return (
    <button
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {lead ? (
        <span aria-hidden className={cn("inline-flex shrink-0", children ? "-ml-0.5" : null, iconSizes[size])}>
          {lead}
        </span>
      ) : null}
      {children}
    </button>
  );
}
