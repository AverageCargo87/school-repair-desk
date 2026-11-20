import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Пустой список: иконка в мягком круге, заголовок, пояснение и (необязательно) кнопка/ссылка.
 *   <EmptyState icon={<ClipboardList />} title="Активных заявок нет"
 *     description="Если что-то сломалось — создайте заявку." action={<Link …>Новая заявка</Link>} />
 */
export function EmptyState({
  title,
  description,
  action,
  icon,
  tone = "primary",
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** Иконка (элемент lucide-react). По умолчанию — «входящие». */
  icon?: React.ReactNode;
  /** Цвет кружка: primary — бренд, success — «всё сделано», neutral — серый. */
  tone?: "primary" | "success" | "neutral";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl border border-dashed border-border-strong bg-surface/60 px-6 py-10 text-center sm:py-12",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mb-4 inline-flex size-14 items-center justify-center rounded-full [&_svg]:size-7",
          tone === "success"
            ? "bg-success-bg text-success"
            : tone === "neutral"
              ? "bg-surface-2 text-muted"
              : "bg-primary-soft text-primary",
        )}
      >
        {icon ?? <Inbox />}
      </span>
      <div className="text-[17px] font-semibold tracking-tight text-text">{title}</div>
      {description ? (
        <div className="mt-1.5 max-w-sm text-[15px] leading-relaxed text-muted">{description}</div>
      ) : null}
      {action ? <div className="mt-5 flex w-full justify-center [&>*]:max-sm:w-full">{action}</div> : null}
    </div>
  );
}
