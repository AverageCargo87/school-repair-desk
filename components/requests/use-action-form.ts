"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { INITIAL_ACTION_RESULT, type ActionResult } from "@/lib/action-result";
import { catchSendErrors, SEND_FAILED_MESSAGE } from "@/lib/safe-action";
import { buildFormData, waitForPhotos } from "./photo-registry";

type FormAction = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

/**
 * Обёртка над useActionState для форм с server action из app/r/actions.ts.
 *
 * - Отправляет форму через onSubmit (без автоматического сброса React 19 при ошибке —
 *   введённый текст и фото не пропадают).
 * - Ждёт окончания сжатия фото и кладёт их в FormData (см. PhotoPicker).
 * - Обрыв связи показывается ошибкой над кнопкой, а не страницей «Что-то пошло не так».
 * - При успехе (ok: true) сбрасывает форму (PhotoPicker очищается сам) и вызывает onSuccess.
 *
 * Пример:
 *   const { state, pending, formRef, onSubmit, fieldError } = useActionForm(addCommentAction);
 *   <form ref={formRef} onSubmit={onSubmit}>…<PhotoPicker max={3} error={fieldError("photos")} />…</form>
 */
export function useActionForm(
  action: FormAction,
  opts: { resetOnSuccess?: boolean; onSuccess?: () => void } = {},
) {
  const { resetOnSuccess = true, onSuccess } = opts;
  const safeAction = useMemo(
    () =>
      catchSendErrors<ActionResult>(action, () => ({ ok: false, error: SEND_FAILED_MESSAGE })),
    [action],
  );
  const [state, formAction, actionPending] = useActionState<ActionResult, FormData>(
    safeAction,
    INITIAL_ACTION_RESULT,
  );
  const [preparing, setPreparing] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const onSuccessRef = useRef(onSuccess);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    if (!state.ok) return;
    if (resetOnSuccess) formRef.current?.reset();
    onSuccessRef.current?.();
  }, [state, resetOnSuccess]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setPreparing(true);
    waitForPhotos(form)
      .then(() => {
        const fd = buildFormData(form);
        startTransition(() => formAction(fd));
      })
      .finally(() => setPreparing(false));
  }

  return {
    /** Последний результат действия. */
    state,
    /** Идёт отправка (или подготовка фото). */
    pending: actionPending || preparing,
    /** Повесить на <form ref={formRef}>. */
    formRef,
    /** Повесить на <form onSubmit={onSubmit}>. */
    onSubmit,
    /** Ошибка конкретного поля из state.fieldErrors. */
    fieldError: (name: string): string | undefined => state.fieldErrors?.[name],
  };
}
