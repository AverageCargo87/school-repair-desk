"use client";

import { useState } from "react";
import { Ban } from "lucide-react";
import { rejectRequestAction } from "@/app/r/actions";
import { requestNo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/components/requests/form-bits";
import { useActionForm } from "@/components/requests/use-action-form";

/**
 * «Отклонить»: кнопка → окно подтверждения с полем причины (обязательно).
 * Окно не закрывается, пока идёт отправка; при ошибке показывает её внутри.
 */
export function RejectForm({ requestId }: { requestId: number }) {
  const [open, setOpen] = useState(false);
  const { state, pending, formRef, onSubmit, fieldError } = useActionForm(rejectRequestAction, {
    onSuccess: () => setOpen(false),
  });
  const reasonId = `reject-reason-${requestId}`;

  return (
    <>
      <Button
        type="button"
        variant="danger-ghost"
        size="lg"
        icon={<Ban />}
        onClick={() => setOpen(true)}
        className="w-full sm:w-auto"
      >
        Отклонить заявку
      </Button>

      <ConfirmDialog
        open={open}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        tone="danger"
        icon={<Ban />}
        title={`Отклонить заявку ${requestNo(requestId)}?`}
        description="Заявка закроется, вернуть её в работу будет нельзя. Заявитель увидит причину."
        confirmText="Да, отклонить"
        cancelText="Не отклонять"
        pending={pending}
        onConfirm={() => {
          const form = formRef.current;
          if (form && form.reportValidity()) form.requestSubmit();
          // Окно закроется само после успешной отправки (onSuccess).
          return false;
        }}
      >
        <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3">
          <input type="hidden" name="requestId" value={requestId} />
          <Field label="Причина" htmlFor={reasonId} required error={fieldError("reason")}>
            <Textarea
              id={reasonId}
              name="reason"
              rows={3}
              required
              data-autofocus
              aria-invalid={Boolean(fieldError("reason")) || undefined}
              placeholder="Например: дубль заявки № 12, или это не ремонт, а закупка мебели"
            />
          </Field>
          <FormError result={state} />
        </form>
      </ConfirmDialog>
    </>
  );
}
