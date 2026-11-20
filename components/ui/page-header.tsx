import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Заголовок страницы: «назад» (необязательно), h1, приглушённый подзаголовок, действия справа
 * (на телефоне — под заголовком на всю ширину).
 *
 *   <PageHeader title="Заявки моих зданий" subtitle="ул. Садовая, д. 12"
 *     back={{ href: "/my", label: "К списку" }}
 *     actions={<Link href="/new" className={buttonClasses("primary", "lg", "w-full sm:w-auto")}>…</Link>} />
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  back,
  meta,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label?: string };
  /** Строка над заголовком (например, «№ 17 · 12.10.2026») — мелко и приглушённо. */
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {back ? (
        <Link
          href={back.href}
          className="-my-1.5 -ml-2 inline-flex min-h-10 w-fit items-center gap-1 rounded-xl pr-3 pl-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          <ChevronLeft className="size-[18px]" aria-hidden />
          {back.label ?? "Назад"}
        </Link>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0">
          {meta ? <div className="mb-1 text-sm text-muted tabular-nums">{meta}</div> : null}
          <h1 className="text-2xl leading-tight font-semibold tracking-tight wrap-anywhere text-text">
            {title}
          </h1>
          {subtitle ? <div className="mt-1 text-[15px] leading-snug text-muted">{subtitle}</div> : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
