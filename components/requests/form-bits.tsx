import { CircleAlert } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { Alert } from "@/components/ui/alert";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Общая ошибка формы (ActionResult.error) — красная плашка с иконкой. */
export function FormError({ result, className }: { result: ActionResult; className?: string }) {
  if (result.ok || !result.error) return null;
  return (
    <Alert tone="danger" role="alert" className={className}>
      {result.error}
    </Alert>
  );
}

/** Сообщение об успехе (ActionResult.ok) — зелёная плашка. */
export function FormSuccess({
  result,
  children,
  className,
}: {
  result: ActionResult;
  children?: React.ReactNode;
  className?: string;
}) {
  if (!result.ok) return null;
  return (
    <Alert tone="success" role="status" className={className}>
      {children ?? result.message ?? "Сохранено"}
    </Alert>
  );
}

/** Ошибка под полем. */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="flex items-start gap-1.5 text-sm text-danger">
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      {message}
    </p>
  );
}

/** Крупная кнопка отправки (48px, на телефоне — на всю ширину) с крутилкой «Отправка…». */
export function SubmitButton({
  pending,
  children,
  pendingText = "Отправка…",
  variant = "primary",
  icon,
  className,
  disabled,
}: {
  pending: boolean;
  children: React.ReactNode;
  pendingText?: string;
  variant?: ButtonVariant;
  /** Иконка слева (элемент lucide-react). */
  icon?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Button
      type="submit"
      size="lg"
      variant={variant}
      disabled={pending || disabled}
      loading={pending}
      icon={icon}
      className={cn("w-full sm:w-auto", className)}
    >
      {pending ? pendingText : children}
    </Button>
  );
}
