import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type AlertTone = "info" | "primary" | "warning" | "danger" | "success" | "neutral";

const tones: Record<AlertTone, string> = {
  info: "bg-info-bg text-info-fg",
  primary: "bg-primary-soft text-primary-soft-fg",
  warning: "bg-warning-bg text-warning-fg",
  danger: "bg-danger-bg text-danger-fg",
  success: "bg-success-bg text-success-fg",
  neutral: "bg-surface-2 text-text",
};

function defaultIcon(tone: AlertTone) {
  if (tone === "danger") return <CircleAlert />;
  if (tone === "warning") return <TriangleAlert />;
  if (tone === "success") return <CircleCheck />;
  return <Info />;
}

/**
 * Плашка-сообщение с иконкой: предупреждение, ошибка, успех, пояснение.
 *   <Alert tone="warning" title="Здание отключено">Новые заявки по нему подать нельзя.</Alert>
 */
export function Alert({
  tone = "info",
  title,
  icon,
  action,
  className,
  children,
  role,
}: {
  tone?: AlertTone;
  title?: React.ReactNode;
  /** Своя иконка; null — без иконки. */
  icon?: React.ReactNode | null;
  /** Кнопка/ссылка справа (на телефоне — снизу). */
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
  role?: "alert" | "status";
}) {
  const ic = icon === null ? null : (icon ?? defaultIcon(tone));
  return (
    <div
      role={role}
      className={cn("flex gap-3 rounded-xl px-3.5 py-3 text-sm leading-snug", tones[tone], className)}
    >
      {ic ? (
        <span aria-hidden className="mt-px inline-flex shrink-0 [&_svg]:size-[18px]">
          {ic}
        </span>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {title ? <div className="font-semibold">{title}</div> : null}
          {children ? <div className={title ? "mt-0.5 opacity-90" : undefined}>{children}</div> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
