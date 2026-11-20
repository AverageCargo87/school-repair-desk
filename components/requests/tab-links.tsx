import Link from "next/link";
import { chipClasses, CountBubble } from "@/components/ui/chip";
import { cn } from "@/lib/utils";

export type TabLinkItem = {
  href: string;
  label: string;
  active: boolean;
  /** Число в кружке (необязательно). */
  count?: number;
  /** Выделить число красным (например, «Проблема», «Просрочены»). */
  alert?: boolean;
  /** Иконка слева (элемент lucide-react). */
  icon?: React.ReactNode;
};

/**
 * Вкладки-ссылки по searchParams.
 * Ссылки строите сами, например withParams("/my", sp, { tab: "closed" }) из lib/url.ts.
 *
 *   <TabLinks items={[
 *     { href: "/my", label: "Активные", active: tab !== "closed", count: 3 },
 *     { href: "/my?tab=closed", label: "Завершённые", active: tab === "closed" },
 *   ]} />
 */
export function TabLinks({
  items,
  className,
  variant = "segmented",
}: {
  items: TabLinkItem[];
  className?: string;
  /**
   * segmented — сегменты на всю ширину (вкладки «Активные / Завершённые»);
   * chips — чипы-фильтры; на телефоне — одна строка с горизонтальной прокруткой.
   */
  variant?: "segmented" | "chips";
}) {
  if (variant === "chips") {
    return (
      <nav
        className={cn(
          "scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0",
          className,
        )}
      >
        {items.map((it) => (
          <Link
            key={it.href + it.label}
            href={it.href}
            aria-current={it.active ? "page" : undefined}
            className={chipClasses(it.active, "min-h-11")}
          >
            {it.icon}
            {it.label}
            {it.count !== undefined ? (
              <CountBubble value={it.count} alert={it.alert} active={it.active} />
            ) : null}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav
      className={cn(
        "flex w-full gap-1 rounded-2xl border border-border bg-surface-2 p-1",
        className,
      )}
    >
      {items.map((it) => (
        <Link
          key={it.href + it.label}
          href={it.href}
          aria-current={it.active ? "page" : undefined}
          className={cn(
            "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-[15px] font-medium transition-[background-color,color,box-shadow] duration-150 [&_svg]:size-[18px]",
            "focus-visible:ring-4 focus-visible:ring-ring focus-visible:outline-none",
            it.active
              ? "bg-surface text-text shadow-card"
              : "text-muted hover:text-text",
          )}
        >
          {it.icon}
          {it.label}
          {it.count !== undefined ? (
            <CountBubble value={it.count} alert={it.alert} active={it.active} />
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
