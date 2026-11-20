import { CalendarX, ShoppingCart, Siren, TriangleAlert, Wrench } from "lucide-react";
import type { RequestStatus, Urgency } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import {
  OVERDUE_LABEL,
  PROBLEM_LABEL,
  statusBadgeVariant,
  statusLabels,
  urgencyBadgeVariant,
  urgencyLabels,
} from "@/lib/labels";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

/** Иконка срочности (Аварийная — сирена, Текущая — ключ, Закупка — тележка). */
export function UrgencyIcon({ urgency, className }: { urgency: Urgency; className?: string }) {
  const Icon = urgency === "emergency" ? Siren : urgency === "purchase" ? ShoppingCart : Wrench;
  return <Icon aria-hidden className={className} />;
}

/** Пилюля статуса с точкой слева: «● Новая», «● В работе»… */
export function StatusBadge({
  status,
  size = "md",
  className,
}: {
  status: RequestStatus;
  size?: Size;
  className?: string;
}) {
  return (
    <Badge variant={statusBadgeVariant[status]} size={size} dot className={className}>
      {statusLabels[status]}
    </Badge>
  );
}

/** То же, что StatusBadge (имя из DESIGN.md). */
export const StatusPill = StatusBadge;

/** Срочность: иконка + подпись. Аварийная — красная, Закупка — оранжевая, Текущая — серая. */
export function UrgencyBadge({
  urgency,
  size = "md",
  className,
}: {
  urgency: Urgency;
  size?: Size;
  className?: string;
}) {
  return (
    <Badge
      variant={urgencyBadgeVariant[urgency]}
      size={size}
      icon={<UrgencyIcon urgency={urgency} />}
      className={className}
    >
      {urgencyLabels[urgency]}
    </Badge>
  );
}

/** Красная метка «Просрочена». */
export function OverdueBadge({ size = "md", className }: { size?: Size; className?: string }) {
  return (
    <Badge variant="danger" size={size} icon={<CalendarX aria-hidden />} className={className}>
      {OVERDUE_LABEL}
    </Badge>
  );
}

/** Метка «Проблема» (открытая проблема от исполнителя). */
export function ProblemBadge({ size = "md", className }: { size?: Size; className?: string }) {
  return (
    <Badge
      variant="danger"
      size={size}
      icon={<TriangleAlert aria-hidden />}
      className={cn("font-semibold", className)}
    >
      {PROBLEM_LABEL}
    </Badge>
  );
}

/** Все метки заявки в строку: статус, срочность, просрочка, проблема. */
export function RequestBadges({
  status,
  urgency,
  isOverdue,
  problemOpen,
  hideStatus,
  hideCurrentUrgency,
  size = "md",
  className,
}: {
  status: RequestStatus;
  urgency: Urgency;
  isOverdue?: boolean;
  problemOpen?: boolean;
  hideStatus?: boolean;
  /** Не показывать «Текущая» (обычная срочность) — меньше шума в списках. */
  hideCurrentUrgency?: boolean;
  size?: Size;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {hideStatus ? null : <StatusBadge status={status} size={size} />}
      {hideCurrentUrgency && urgency === "current" ? null : (
        <UrgencyBadge urgency={urgency} size={size} />
      )}
      {isOverdue ? <OverdueBadge size={size} /> : null}
      {problemOpen ? <ProblemBadge size={size} /> : null}
    </div>
  );
}
