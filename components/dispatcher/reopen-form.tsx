"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { reopenRequestAction } from "@/app/r/actions";
import { formatDateMsk } from "@/lib/time";
import { shortName } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { FormError, SubmitButton } from "@/components/requests/form-bits";
import { useActionForm } from "@/components/requests/use-action-form";
import { DeadlineField } from "./deadline-field";

/**
 * «Вернуть в работу» (для выполненной заявки): что доделать (обязательно), новый срок (необязательно).
 * Заявка возвращается прежнему исполнителю и соисполнителям в статус «Назначена».
 * Если исполнитель отключён — предупреждаем: после возврата нужно выбрать нового в форме назначения.
 */
export function ReopenForm({
  requestId,
  executorName,
  executorActive,
  currentDeadline,
  today,
}: {
  requestId: number;
  executorName: string | null;
  /** Прежний исполнитель всё ещё активный исполнитель. */
  executorActive: boolean;
  currentDeadline: string | null;
  today: string;
}) {
  const inactiveNote = !executorActive ? (
    <Alert tone="warning">
      {executorName ? `${shortName(executorName)} отключён` : "Исполнитель отключён"} — после
      возврата сразу выберите нового исполнителя в «Изменить назначение».
    </Alert>
  ) : null;

  const [open, setOpen] = useState(false);
  const [deadline, setDeadline] = useState("");
  const { state, pending, formRef, onSubmit, fieldError } = useActionForm(reopenRequestAction, {
    onSuccess: () => {
      setDeadline("");
      setOpen(false);
    },
  });

  if (!open) {
    return (
      <div className="flex flex-col gap-3">
        {inactiveNote}
        <Button
          type="button"
          variant="outline"
          size="lg"
          icon={<RotateCcw />}
          onClick={() => setOpen(true)}
          aria-expanded={false}
          className="w-full sm:w-auto"
        >
          Вернуть в работу
        </Button>
      </div>
    );
  }

  const oldPassed = Boolean(currentDeadline && currentDeadline < today);
  const commentId = `reopen-comment-${requestId}`;

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-5">
      <input type="hidden" name="requestId" value={requestId} />
      <Alert tone="primary" icon={<RotateCcw />}>
        {`Заявка вернётся прежнему исполнителю${executorName ? ` (${shortName(executorName)})` : ""} и соисполнителям со статусом «Назначена» — исполнителю нужно будет снова нажать «Принял».`}
      </Alert>
      {inactiveNote}

      <Field label="Что нужно доделать" htmlFor={commentId} required error={fieldError("comment")}>
        <Textarea
          id={commentId}
          name="comment"
          rows={3}
          required
          autoFocus
          aria-invalid={Boolean(fieldError("comment")) || undefined}
          placeholder="Например: кран всё ещё капает"
        />
      </Field>

      <DeadlineField
        id={`reopen-deadline-${requestId}`}
        label="Новый срок"
        optional
        value={deadline}
        onChange={setDeadline}
        today={today}
        hint={
          currentDeadline
            ? oldPassed
              ? `Прежний срок ${formatDateMsk(currentDeadline)} уже прошёл — без нового срока заявка сразу станет просроченной.`
              : `Сейчас срок ${formatDateMsk(currentDeadline)}. Оставьте пустым, чтобы не менять.`
            : "Оставьте пустым, чтобы не менять."
        }
        error={fieldError("deadline")}
      />

      <FormError result={state} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <SubmitButton pending={pending} icon={<RotateCcw />}>
          Вернуть в работу
        </SubmitButton>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="w-full sm:w-auto"
        >
          Отмена
        </Button>
      </div>
    </form>
  );
}
