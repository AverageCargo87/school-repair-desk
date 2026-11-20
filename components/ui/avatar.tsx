import { cn } from "@/lib/utils";

/** Спокойная палитра аватаров (токены --avN-bg/--avN-fg, есть тёмная тема). */
const TONES = [
  "bg-av1-bg text-av1-fg",
  "bg-av2-bg text-av2-fg",
  "bg-av3-bg text-av3-fg",
  "bg-av4-bg text-av4-fg",
  "bg-av5-bg text-av5-fg",
  "bg-av6-bg text-av6-fg",
  "bg-av7-bg text-av7-fg",
  "bg-av8-bg text-av8-fg",
] as const;

const SIZES = {
  xs: "size-5 text-[9px]",
  sm: "size-6 text-[10px]",
  md: "size-8 text-xs",
  lg: "size-10 text-sm",
  xl: "size-12 text-base",
} as const;

export type AvatarSize = keyof typeof SIZES;

/** «Иванова Мария Петровна» → «ИМ»; одно слово → первые две буквы. */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Классы цвета аватара: один и тот же человек всегда одного цвета. */
export function avatarTone(name: string | null | undefined): string {
  let h = 0;
  for (const ch of name ?? "") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}

/**
 * Кружок с инициалами (ФИО полностью — в подсказке и для экранного диктора).
 *   <Avatar name={user.fullName} size="md" />
 */
export function Avatar({
  name,
  size = "md",
  className,
  ring,
}: {
  name: string;
  size?: AvatarSize;
  className?: string;
  /** Обводка цветом поверхности — для наложения в AvatarStack. */
  ring?: boolean;
}) {
  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full leading-none font-semibold tracking-tight select-none",
        SIZES[size],
        avatarTone(name),
        ring && "ring-2 ring-surface",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

/**
 * Несколько аватаров внахлёст, лишние — кружком «+N».
 *   <AvatarStack names={[executor, ...coexecutors].map((p) => p.fullName)} max={3} size="sm" />
 */
export function AvatarStack({
  names,
  max = 3,
  size = "sm",
  className,
}: {
  names: string[];
  max?: number;
  size?: AvatarSize;
  className?: string;
}) {
  if (names.length === 0) return null;
  const shown = names.length > max ? names.slice(0, max - 1) : names;
  const rest = names.length - shown.length;
  return (
    <span className={cn("inline-flex items-center -space-x-1", className)}>
      {/* Первый (основной исполнитель) — поверх остальных. */}
      {shown.map((n, i) => (
        <span key={`${n}-${i}`} className="relative inline-flex" style={{ zIndex: shown.length - i + 1 }}>
          <Avatar name={n} size={size} ring />
        </span>
      ))}
      {rest > 0 ? (
        <span
          title={names.slice(shown.length).join(", ")}
          className={cn(
            "relative inline-flex shrink-0 items-center justify-center rounded-full bg-surface-3 leading-none font-semibold text-muted ring-2 ring-surface",
            SIZES[size],
          )}
        >
          +{rest}
        </span>
      ) : null}
    </span>
  );
}
