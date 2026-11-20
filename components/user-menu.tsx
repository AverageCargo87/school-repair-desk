"use client";

import { useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { logout } from "@/app/actions";
import type { Role } from "@/db/schema";
import { roleLabels } from "@/lib/labels";
import { shortName } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Menu, MenuHeader, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { LOGOUT_CONFIRM } from "@/components/logout-button";

/** Аватар-меню в шапке: ФИО, роль, «Выйти» (с подтверждением). */
export function UserMenu({ fullName, role }: { fullName: string; role: Role }) {
  const [confirmLogout, setConfirmLogout] = useState(false);
  return (
    <>
      <Menu
        label={`Меню пользователя: ${fullName}`}
        align="end"
        triggerClassName="flex min-h-11 items-center gap-2.5 rounded-full p-1.5 text-left transition-colors hover:bg-surface-2 focus-visible:ring-4 focus-visible:ring-ring focus-visible:outline-none md:py-1 md:pr-3 md:pl-1"
        trigger={
          <>
            <Avatar name={fullName} size="md" />
            <span className="hidden min-w-0 leading-tight md:block">
              <span className="block max-w-44 truncate text-sm font-medium text-text">
                {shortName(fullName)}
              </span>
              <span className="block text-xs text-muted">{roleLabels[role]}</span>
            </span>
            <ChevronDown aria-hidden className="hidden size-4 text-muted md:block" />
          </>
        }
      >
        <MenuHeader
          leading={<Avatar name={fullName} size="lg" />}
          title={fullName}
          subtitle={roleLabels[role]}
        />
        <MenuSeparator />
        <MenuItem icon={<LogOut />} tone="danger" onSelect={() => setConfirmLogout(true)}>
          Выйти
        </MenuItem>
      </Menu>
      <ConfirmDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        {...LOGOUT_CONFIRM}
        tone="danger"
        icon={<LogOut />}
        formAction={logout}
      />
    </>
  );
}
