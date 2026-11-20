"use client";

import { startTransition, useActionState, useEffect, useMemo, useRef, type FormEvent } from "react";
import { INITIAL_ADMIN_RESULT, type AdminResult } from "@/app/admin/types";
import { catchSendErrors, SEND_FAILED_MESSAGE } from "@/lib/safe-action";

type AdminAction = (prev: AdminResult, formData: FormData) => Promise<AdminResult>;

/** FormData формы вместе с нажатой кнопкой (name/value кнопки-отправителя). */
function formDataWithSubmitter(form: HTMLFormElement, submitter: HTMLElement | null): FormData {
  try {
    return new FormData(form, submitter);
  } catch {
    // Старый браузер без второго аргумента FormData.
    const fd = new FormData(form);
    if (submitter instanceof HTMLButtonElement && submitter.name) {
      fd.append(submitter.name, submitter.value);
    }
    return fd;
  }
}

/**
 * useActionState для форм админки: отправка через onSubmit (без автосброса React 19 при ошибке —
 * введённое не пропадает), учитывает, какая кнопка нажата (name/value), при успехе может
 * сбросить форму и вызвать onSuccess.
 */
export function useAdminAction(
  action: AdminAction,
  opts: { resetOnSuccess?: boolean; onSuccess?: (result: AdminResult) => void } = {},
) {
  const { resetOnSuccess = false, onSuccess } = opts;
  // Обрыв связи — ошибкой над кнопкой, а не страницей «Что-то пошло не так».
  const safeAction = useMemo(
    () => catchSendErrors<AdminResult>(action, () => ({ ok: false, error: SEND_FAILED_MESSAGE })),
    [action],
  );
  const [state, formAction, pending] = useActionState<AdminResult, FormData>(
    safeAction,
    INITIAL_ADMIN_RESULT,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const onSuccessRef = useRef(onSuccess);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    if (!state.ok) return;
    if (resetOnSuccess) formRef.current?.reset();
    onSuccessRef.current?.(state);
  }, [state, resetOnSuccess]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter ?? null;
    const fd = formDataWithSubmitter(e.currentTarget, submitter);
    startTransition(() => formAction(fd));
  }

  return {
    state,
    pending,
    formRef,
    onSubmit,
    fieldError: (name: string): string | undefined => state.fieldErrors?.[name],
  };
}
