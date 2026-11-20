"use client";

import { CircleCheck } from "lucide-react";
import { completeRequestAction } from "@/app/r/actions";
import { PHOTO_LIMITS, TEXT_LIMITS } from "@/lib/requests/constants";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { FormError, SubmitButton } from "@/components/requests/form-bits";
import { PhotoPicker } from "@/components/requests/photo-picker";
import { useActionForm } from "@/components/requests/use-action-form";

/**
 * «Выполнено»: фото результата 1..5 (обязательно) + комментарий (необязательно).
 * Дату выполнения ставит сервер.
 */
export function CompleteForm({ requestId }: { requestId: number }) {
  const { state, pending, formRef, onSubmit, fieldError } = useActionForm(completeRequestAction);
  const hasFieldErrors = Boolean(state.fieldErrors && Object.keys(state.fieldErrors).length);
  const commentError = fieldError("comment");

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="requestId" value={requestId} />

      <PhotoPicker
        min={PHOTO_LIMITS.complete.min}
        max={PHOTO_LIMITS.complete.max}
        label="Фото результата"
        hint="Сфотографируйте, как стало после работы. Нужно хотя бы одно фото."
        error={fieldError("photos")}
      />

      <Field
        label="Комментарий"
        optional
        htmlFor={`completion-${requestId}`}
        error={commentError}
      >
        <Textarea
          id={`completion-${requestId}`}
          name="comment"
          rows={3}
          maxLength={TEXT_LIMITS.comment}
          placeholder="Что сделано, что заменили"
          aria-invalid={commentError ? true : undefined}
        />
      </Field>

      {/* Ошибки полей показаны у полей; здесь — только общие (нет доступа, статус изменился…). */}
      {hasFieldErrors ? null : <FormError result={state} />}

      <SubmitButton pending={pending} pendingText="Отправляем фото…" icon={<CircleCheck />}>
        Выполнено
      </SubmitButton>
    </form>
  );
}
