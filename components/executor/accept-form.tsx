"use client";

import { ThumbsUp } from "lucide-react";
import { acceptRequestAction } from "@/app/r/actions";
import { FormError, SubmitButton } from "@/components/requests/form-bits";
import { useActionForm } from "@/components/requests/use-action-form";

/** Крупная кнопка «Принял» (основной исполнитель, статус «Назначена» → «В работе»). */
export function AcceptForm({ requestId }: { requestId: number }) {
  const { state, pending, formRef, onSubmit } = useActionForm(acceptRequestAction);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="requestId" value={requestId} />
      <FormError result={state} />
      {/* В колонке flex кнопка растягивается на всю ширину и на телефоне, и на компьютере. */}
      <SubmitButton pending={pending} pendingText="Сохраняем…" icon={<ThumbsUp />}>
        Принял
      </SubmitButton>
    </form>
  );
}
