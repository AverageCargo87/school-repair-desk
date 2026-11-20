"use client";

import { CircleCheck } from "lucide-react";
import { resolveProblemAction } from "@/app/r/actions";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { FormError, SubmitButton } from "@/components/requests/form-bits";
import { useActionForm } from "@/components/requests/use-action-form";

/** «Проблема решена»: снимает отметку «Проблема», комментарий необязателен. */
export function ResolveProblemForm({ requestId }: { requestId: number }) {
  const { state, pending, formRef, onSubmit, fieldError } = useActionForm(resolveProblemAction);
  const commentId = `resolve-comment-${requestId}`;
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="requestId" value={requestId} />
      <Field
        label="Ответ исполнителю"
        htmlFor={commentId}
        optional
        hint="Исполнитель увидит ответ в истории заявки."
        error={fieldError("comment")}
      >
        <Textarea
          id={commentId}
          name="comment"
          rows={2}
          aria-invalid={Boolean(fieldError("comment")) || undefined}
          placeholder="Например: материалы купили, лежат у завхоза"
        />
      </Field>
      <FormError result={state} />
      <SubmitButton pending={pending} icon={<CircleCheck />}>
        Проблема решена
      </SubmitButton>
    </form>
  );
}
