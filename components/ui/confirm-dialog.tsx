"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { CircleHelp, TriangleAlert } from "lucide-react";
import { Button, type ButtonSize, type ButtonVariant } from "./button";
import { Dialog } from "./dialog";

export type ConfirmTone = "danger" | "primary";

export type ConfirmOptions = {
  /** Вопрос: «Отклонить заявку № 7?» */
  title: React.ReactNode;
  /** Что произойдёт, простыми словами. */
  description?: React.ReactNode;
  /** Текст кнопки подтверждения: «Да, отклонить». По умолчанию «Подтвердить». */
  confirmText?: string;
  /** Текст кнопки отмены. По умолчанию «Отмена». */
  cancelText?: string;
  /** danger — красная кнопка и иконка-предупреждение (необратимые действия). */
  tone?: ConfirmTone;
  /** Своя иконка в кружке (элемент lucide-react); null — без иконки. */
  icon?: React.ReactNode | null;
};

export type ConfirmDialogProps = ConfirmOptions & {
  open: boolean;
  onClose: () => void;
  /**
   * Что сделать по «Подтвердить». Может быть async — окно покажет крутилку и закроется,
   * когда промис завершится. Верните false, чтобы окно осталось открытым.
   */
  onConfirm?: () => unknown | Promise<unknown>;
  /**
   * Server action: кнопка подтверждения отправит собственную <form action={formAction}>
   * (с полями hiddenFields). Удобно для действий с redirect, например «Выйти».
   */
  formAction?: (formData: FormData) => void | Promise<void>;
  hiddenFields?: Record<string, string | number>;
  /** Внешний признак отправки (крутилка на кнопке, окно не закрывается). */
  pending?: boolean;
  /** Доп. содержимое между текстом и кнопками (например, поле причины). */
  children?: React.ReactNode;
};

function defaultIcon(tone: ConfirmTone) {
  return tone === "danger" ? <TriangleAlert /> : <CircleHelp />;
}

/** Кнопка подтверждения внутри <form action> — знает о pending через useFormStatus. */
function FormConfirmButton({
  tone,
  children,
  onDone,
}: {
  tone: ConfirmTone;
  children: React.ReactNode;
  onDone: () => void;
}) {
  const { pending } = useFormStatus();
  const was = useRef(false);
  useEffect(() => {
    if (pending) was.current = true;
    else if (was.current) {
      was.current = false;
      onDone();
    }
  }, [pending, onDone]);
  return (
    <Button
      type="submit"
      size="lg"
      variant={tone === "danger" ? "danger" : "primary"}
      loading={pending}
      className="w-full sm:w-auto"
      data-autofocus={tone === "danger" ? undefined : true}
    >
      {children}
    </Button>
  );
}

/**
 * Окно подтверждения (вместо window.confirm). Управляемое: open/onClose.
 *
 *   const [open, setOpen] = useState(false);
 *   <ConfirmDialog open={open} onClose={() => setOpen(false)} tone="danger"
 *     title="Отключить сотрудника?" description="Он сразу выйдет из системы на всех устройствах."
 *     confirmText="Да, отключить" onConfirm={() => formRef.current?.requestSubmit()} />
 *
 * Обычно удобнее ConfirmButton (кнопка + окно) или хук useConfirm().
 */
export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmText = "Подтвердить",
  cancelText = "Отмена",
  tone = "primary",
  icon,
  onConfirm,
  formAction,
  hiddenFields,
  pending: externalPending,
  children,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const pending = busy || Boolean(externalPending);
  const variant: ButtonVariant = tone === "danger" ? "danger" : "primary";

  async function handleConfirm() {
    if (!onConfirm) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      const res = await onConfirm();
      if (res !== false) onClose();
    } finally {
      setBusy(false);
    }
  }

  const cancel = (
    <Button
      type="button"
      variant="ghost"
      size="lg"
      onClick={onClose}
      disabled={pending}
      className="w-full sm:w-auto"
      // Для опасных действий фокус по умолчанию — на «Отмена» (Enter не подтвердит случайно).
      data-autofocus={tone === "danger" ? true : undefined}
    >
      {cancelText}
    </Button>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!pending}
      title={title}
      description={description}
      icon={icon === null ? undefined : (icon ?? defaultIcon(tone))}
      tone={tone === "danger" ? "danger" : "primary"}
      footer={
        formAction ? (
          <>
            {cancel}
            <form
              action={formAction}
              // Не даём submit «всплыть» по дереву React к внешней форме кнопки-источника.
              onSubmit={(e) => e.stopPropagation()}
              className="w-full sm:w-auto"
            >
              {hiddenFields
                ? Object.entries(hiddenFields).map(([k, v]) => (
                    <input key={k} type="hidden" name={k} value={String(v)} />
                  ))
                : null}
              <FormConfirmButton tone={tone} onDone={onClose}>
                {confirmText}
              </FormConfirmButton>
            </form>
          </>
        ) : (
          <>
            {cancel}
            <Button
              type="button"
              size="lg"
              variant={variant}
              loading={pending}
              onClick={handleConfirm}
              className="w-full sm:w-auto"
              data-autofocus={tone === "danger" ? undefined : true}
            >
              {confirmText}
            </Button>
          </>
        )
      }
    >
      {children}
    </Dialog>
  );
}

export type ConfirmButtonProps = ConfirmOptions &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "title" | "onClick" | "formAction"> & {
    /** Свой обработчик подтверждения (см. ConfirmDialog.onConfirm). */
    onConfirm?: ConfirmDialogProps["onConfirm"];
    /** Server action для отдельной формы окна (см. ConfirmDialog.formAction). */
    formAction?: ConfirmDialogProps["formAction"];
    hiddenFields?: ConfirmDialogProps["hiddenFields"];
    /**
     * Перед открытием окна проверить обязательные поля формы, в которой стоит кнопка
     * (reportValidity). По умолчанию true.
     */
    validate?: boolean;
    /** Вид и размер самой кнопки (не окна). */
    variant?: ButtonVariant;
    size?: ButtonSize;
    /** Иконка слева на кнопке. */
    buttonIcon?: React.ReactNode;
    loading?: boolean;
    /** Доп. содержимое окна. */
    dialogContent?: React.ReactNode;
  };

/**
 * Кнопка, которая сначала спрашивает подтверждение.
 * Без onConfirm/formAction — после «Да» отправляет форму, внутри которой стоит
 * (form.requestSubmit(): срабатывает её onSubmit / action, как от обычной кнопки «Отправить»).
 *
 *   <form ref={formRef} onSubmit={onSubmit}>
 *     …поля…
 *     <ConfirmButton variant="danger" size="lg" tone="danger"
 *       title={`Отклонить заявку ${requestNo(id)}?`}
 *       description="Её больше нельзя будет вернуть в работу. Заявитель увидит причину."
 *       confirmText="Да, отклонить" loading={pending}>
 *       Отклонить заявку
 *     </ConfirmButton>
 *   </form>
 *
 *   // Server action с redirect:
 *   <ConfirmButton formAction={logout} title="Выйти из приложения?" confirmText="Выйти">Выйти</ConfirmButton>
 */
export function ConfirmButton({
  title,
  description,
  confirmText,
  cancelText,
  tone = "danger",
  icon,
  onConfirm,
  formAction,
  hiddenFields,
  validate = true,
  variant,
  size = "md",
  buttonIcon,
  loading,
  dialogContent,
  children,
  disabled,
  ...buttonProps
}: ConfirmButtonProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  function onClick() {
    const form = btnRef.current?.form;
    if (!onConfirm && !formAction && validate && form && !form.reportValidity()) return;
    setOpen(true);
  }

  const confirm =
    onConfirm ??
    (formAction
      ? undefined
      : () => {
          btnRef.current?.form?.requestSubmit();
        });

  return (
    <>
      <Button
        ref={btnRef}
        type="button"
        variant={variant ?? (tone === "danger" ? "danger-outline" : "primary")}
        size={size}
        icon={buttonIcon}
        loading={loading}
        disabled={disabled}
        onClick={onClick}
        {...buttonProps}
      >
        {children}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={close}
        title={title}
        description={description}
        confirmText={confirmText}
        cancelText={cancelText}
        tone={tone}
        icon={icon}
        onConfirm={confirm}
        formAction={formAction}
        hiddenFields={hiddenFields}
      >
        {dialogContent}
      </ConfirmDialog>
    </>
  );
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

/**
 * Подтверждение «в коде» — замена window.confirm:
 *
 *   const { confirm, dialog } = useConfirm();
 *   async function onSubmitWithConfirm(e) {
 *     e.preventDefault();
 *     const form = e.currentTarget;
 *     if (await confirm({ title: "Отклонить заявку?", tone: "danger", confirmText: "Да, отклонить" })) {
 *       …отправить…
 *     }
 *   }
 *   return <>{dialog}<form onSubmit={onSubmitWithConfirm}>…</form></>;
 */
export function useConfirm() {
  const [state, setState] = useState<Pending | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setState({ ...opts, resolve });
      }),
    [],
  );

  const dialog = (
    <ConfirmDialog
      open={state !== null}
      title={state?.title ?? ""}
      description={state?.description}
      confirmText={state?.confirmText}
      cancelText={state?.cancelText}
      tone={state?.tone}
      icon={state?.icon}
      onClose={() => {
        state?.resolve(false);
        setState(null);
      }}
      onConfirm={() => {
        state?.resolve(true);
        setState(null);
      }}
    />
  );

  return { confirm, dialog };
}
