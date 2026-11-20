import { ClipboardList, Inbox, ShieldCheck, Wrench } from "lucide-react";
import type { Role } from "@/db/schema";
import { roleLabels } from "@/lib/labels";
import { Badge, type BadgeVariant } from "@/components/ui/badge";

/** Порядок ролей в фильтрах и списках. */
export const ROLE_ORDER: Role[] = ["requester", "executor", "dispatcher", "admin"];

/** Подписи ролей во множественном числе — для чипов-фильтров. */
export const rolePluralLabels: Record<Role, string> = {
  requester: "Заявители",
  executor: "Исполнители",
  dispatcher: "Распределители",
  admin: "Админы",
};

export const roleVariant: Record<Role, BadgeVariant> = {
  requester: "info",
  executor: "aqua",
  dispatcher: "warning",
  admin: "purple",
};

/** Иконка роли (элемент lucide-react) — та же, что у раздела этой роли в меню. */
export function RoleIcon({ role, className }: { role: Role; className?: string }) {
  switch (role) {
    case "requester":
      return <ClipboardList aria-hidden className={className} />;
    case "executor":
      return <Wrench aria-hidden className={className} />;
    case "dispatcher":
      return <Inbox aria-hidden className={className} />;
    case "admin":
      return <ShieldCheck aria-hidden className={className} />;
  }
}

/** Пилюля роли сотрудника с иконкой. */
export function RoleBadge({
  role,
  size = "md",
  className,
}: {
  role: Role;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <Badge variant={roleVariant[role]} size={size} icon={<RoleIcon role={role} />} className={className}>
      {roleLabels[role]}
    </Badge>
  );
}
