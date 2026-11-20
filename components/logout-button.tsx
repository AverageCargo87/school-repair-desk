"use client";

import { LogOut } from "lucide-react";
import { logout } from "@/app/actions";
import { ConfirmButton } from "@/components/ui/confirm-dialog";
import type { ButtonSize, ButtonVariant } from "@/components/ui/button";

export const LOGOUT_CONFIRM = {
  title: "Выйти из приложения?",
  description: "Чтобы войти снова, понадобится ваша ссылка для входа или логин и пароль.",
  confirmText: "Выйти",
  cancelText: "Остаться",
} as const;

/** «Выйти» с подтверждением: случайное нажатие на телефоне не должно выкидывать из приложения. */
export function LogoutButton({
  variant = "outline",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return (
    <ConfirmButton
      {...LOGOUT_CONFIRM}
      tone="danger"
      icon={<LogOut />}
      formAction={logout}
      variant={variant}
      size={size}
      className={className}
      buttonIcon={<LogOut />}
    >
      Выйти
    </ConfirmButton>
  );
}
