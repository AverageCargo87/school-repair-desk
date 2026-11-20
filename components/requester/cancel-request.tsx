"use client";

import { useCallback, useState } from "react";
import { CircleX } from "lucide-react";
import { cancelRequestAction } from "@/app/r/actions";
import { TEXT_LIMITS } from "@/lib/requests/constants";
import { requestNo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { SectionCard } from "@/components/ui/section-card";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/components/requests/form-bits";
import { useActionForm } from "@/components/requests/use-action-form";

/**
 * «Отменить заявку»: кнопка → окно подтверждения с необязательной причиной (cancelRequestAction).
 * Окно не закрывается, пока идёт отправка; при ошибке остаётся открытым с сообщением.
 * После успеха страница обновится сама (revalidatePath), и панель пропадёт.
 */
export function CancelRequest({ requestId }: { requestId: number }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const { state, pending, formRef, onSubmit, fieldError } = useActionForm(cancelRequestAction, {
    onSuccess: close,
  });
  const reasonId = `cancel-reason-${requestId}`;

  return (
    <SectionCard
      icon={<CircleX />}
      title="Заявку ещё не взяли в работу"
      description="Если поломку уже устранили или заявку подали по ошибке — её можно отменить."
    >
      <Button
        type="button"
        variant="danger-outline"
        size="lg"
        icon={<CircleX />}
        onClick={() => setOpen(true)}
        className="w-full sm:w-auto"
      >
        Отменить заявку
      </Button>

      <ConfirmDialog
        open={open}
        onClose={close}
        tone="danger"
        title={`Отменить заявку ${requestNo(requestId)}?`}
        description="Отменённую заявку нельзя вернуть. Если поломка появится снова — создайте новую."
        confirmText="Да, отменить"
        cancelText="Не отменять"
        pending={pending}
        onConfirm={() => {
          formRef.current?.requestSubmit();
          // Окно закроется само после успешной отправки (onSuccess).
          return false;
        }}
      >
        <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3">
          <input type="hidden" name="requestId" value={requestId} />
          <Field label="Причина" htmlFor={reasonId} optional error={fieldError("reason")}>
            <Textarea
              id={reasonId}
              name="reason"
              rows={2}
              maxLength={TEXT_LIMITS.comment}
              placeholder="Например: уже починили сами"
              // readOnly, а не disabled: отключённое поле не попало бы в FormData.
              readOnly={pending}
            />
          </Field>
          <FormError result={state} />
        </form>
      </ConfirmDialog>
    </SectionCard>
  );
}
