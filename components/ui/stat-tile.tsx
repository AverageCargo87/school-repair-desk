import Link from "next/link";
import { cn } from "@/lib/utils";

export type StatTone = "default" | "primary" | "danger" | "warning" | "success" | "info" | "aqua";

const iconTone: Record<StatTone, string> = {
  default: "bg-surface-2 text-muted",
  primary: "bg-primary-soft text-primary",
  danger: "bg-danger-bg text-danger",
  warning: "bg-warning-bg text-warning",
  success: "bg-success-bg text-success",
  info: "bg-info-bg text-info",
  aqua: "bg-aqua-bg text-aqua",
};

/**
 * Плитка-счётчик: крупное число, подпись, иконка в цветном кружке. С href — ссылка-фильтр.
 * active — выбранная (кольцо бренда); alert — число красным, если > 0.
 *
 *   <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
 *     <StatTile href="/dispatch?status=new" label="Новые" value={5} icon={<Inbox />} tone="info" active />
 *     <StatTile href="/dispatch?status=problem" label="Проблема" value={1} icon={<TriangleAlert />} tone="danger" alert />
 *   </div>
 */
export function StatTile({
  label,
  value,
  icon,
  tone = "default",
  href,
  active,
  alert,
  hint,
  className,
}: {
  label: React.ReactNode;
  value: number | string;
  icon?: React.ReactNode;
  tone?: StatTone;
  href?: string;
  active?: boolean;
  alert?: boolean;
  /** Мелкая подпись под названием. */
  hint?: React.ReactNode;
  className?: string;
}) {
  const hot = alert && Number(value) > 0;
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "text-[28px] leading-none font-semibold tracking-tight tabular-nums",
            hot ? "text-danger" : "text-text",
          )}
        >
          {value}
        </span>
        {icon ? (
          <span
            aria-hidden
            className={cn(
              "inline-flex size-9 shrink-0 items-center justify-center rounded-xl [&_svg]:size-[18px]",
              iconTone[tone],
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <div className="mt-2 text-sm leading-snug font-medium text-text">{label}</div>
      {hint ? <div className="mt-0.5 text-xs text-muted">{hint}</div> : null}
    </>
  );
  const cls = cn(
    "block rounded-2xl border bg-surface p-3.5 shadow-card transition-[border-color,box-shadow,background-color,transform] duration-150",
    active ? "border-primary ring-2 ring-ring" : "border-border",
    href && "hover:border-border-strong hover:shadow-raised active:scale-[.98] focus-visible:ring-4 focus-visible:ring-ring focus-visible:outline-none",
    className,
  );
  if (href) {
    return (
      <Link href={href} aria-current={active ? "page" : undefined} className={cls}>
        {body}
      </Link>
    );
  }
  return <div className={cls}>{body}</div>;
}
