"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, TriangleAlert } from "lucide-react";
import { addCommentAction } from "@/app/r/actions";
import { PHOTO_LIMITS } from "@/lib/requests/constants";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FormError, SubmitButton } from "./form-bits";
import { PhotoPicker } from "./photo-picker";
import { useActionForm } from "./use-action-form";

/** Событие «открыть форму комментария в режиме проблемы» (см. openProblemForm). */
const OPEN_PROBLEM_EVENT = "request:open-problem";

/** Якорь в адресе, по которому форма открывается в режиме проблемы: /r/17#problem. */
export const PROBLEM_HASH = "problem";

/** id формы комментария на карточке (стабильный, можно ссылаться). */
export function commentFormId(requestId: number): string {
  return `comment-form-${requestId}`;
}

/**
 * Открыть форму комментария карточки в режиме «Это проблема»: включить переключатель,
 * прокрутить к форме и поставить курсор в поле. Возвращает false, если формы на странице
 * нет или проблему в этой заявке сообщить нельзя.
 */
export function openProblemForm(requestId: number): boolean {
  const ev = new CustomEvent(OPEN_PROBLEM_EVENT, { detail: { requestId }, cancelable: true });
  // Форма вызывает preventDefault(), если обработала событие.
  return !window.dispatchEvent(ev);
}

/**
 * Форма комментария (текст + до 3 фото). Для исполнителя/соисполнителя в активной заявке
 * (canReportProblem) — переключатель «Это проблема — нужна помощь распределителя»:
 * тогда уходит как «Сообщить о проблеме» (addCommentAction с asProblem=1 → reportProblem).
 *
 * Открыть сразу в режиме проблемы: проп defaultProblem, openProblemForm(requestId)
 * или ссылка с якорем #problem.
 */
export function CommentForm({
  requestId,
  canReportProblem = false,
  defaultProblem = false,
  hint,
  className,
}: {
  requestId: number;
  /** = request.allowed.reportProblem */
  canReportProblem?: boolean;
  /** Открыть сразу в режиме «Это проблема» (действует, только если canReportProblem). */
  defaultProblem?: boolean;
  /** Подсказка под полем: кто и когда увидит комментарий (уведомлений нет). */
  hint?: React.ReactNode;
  className?: string;
}) {
  const [asProblem, setAsProblem] = useState(defaultProblem);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const { state, pending, formRef, onSubmit } = useActionForm(addCommentAction, {
    onSuccess: () => setAsProblem(false),
  });
  const problem = canReportProblem && asProblem;

  useEffect(() => {
    if (!canReportProblem) return;

    function focusText() {
      const el = textRef.current;
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus({ preventScroll: true });
    }
    function onOpen(e: Event) {
      const detail = (e as CustomEvent<{ requestId: number }>).detail;
      if (detail?.requestId !== requestId) return;
      e.preventDefault();
      setAsProblem(true);
      focusText();
    }
    function onHash() {
      if (window.location.hash !== `#${PROBLEM_HASH}`) return;
      setAsProblem(true);
      focusText();
    }

    window.addEventListener(OPEN_PROBLEM_EVENT, onOpen);
    window.addEventListener("hashchange", onHash);
    // Пришли по ссылке /r/17#problem — откладываем до следующего кадра (после отрисовки).
    const raf = window.requestAnimationFrame(onHash);
    return () => {
      window.removeEventListener(OPEN_PROBLEM_EVENT, onOpen);
      window.removeEventListener("hashchange", onHash);
      window.cancelAnimationFrame(raf);
    };
  }, [canReportProblem, requestId]);

  return (
    <form
      id={commentFormId(requestId)}
      ref={formRef}
      onSubmit={onSubmit}
      className={cn(
        "flex scroll-mt-20 flex-col gap-4 rounded-2xl border bg-surface p-4 shadow-card transition-colors sm:p-5",
        problem ? "border-danger/50 ring-1 ring-danger/15" : "border-border",
        className,
      )}
    >
      <input type="hidden" name="requestId" value={requestId} />
      {problem ? <input type="hidden" name="asProblem" value="1" /> : null}

      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor={`comment-${requestId}`}
          className="flex items-center gap-2 text-base font-semibold tracking-tight"
        >
          <span
            aria-hidden
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-lg",
              problem ? "bg-danger-bg text-danger" : "bg-surface-2 text-muted",
            )}
          >
            {problem ? <TriangleAlert className="size-4" /> : <MessageSquare className="size-4" />}
          </span>
          {problem ? "Опишите проблему" : "Комментарий"}
        </Label>
        <Textarea
          ref={textRef}
          id={`comment-${requestId}`}
          name="text"
          rows={3}
          required
          placeholder={
            problem
              ? "Чего не хватает или что мешает выполнить работу"
              : "Напишите комментарий"
          }
        />
        {hint && !problem ? <p className="text-[13px] leading-snug text-muted">{hint}</p> : null}
      </div>

      {canReportProblem ? (
        <label
          className={cn(
            "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-colors",
            asProblem ? "border-danger/40 bg-danger-bg text-danger-fg" : "border-border bg-surface-2/60 text-text",
          )}
        >
          <Switch
            checked={asProblem}
            onCheckedChange={setAsProblem}
            label="Это проблема — нужна помощь распределителя"
          />
          <span className="leading-snug">
            <span className="block font-medium">Это проблема</span>
            <span className={cn("block text-[13px]", asProblem ? "opacity-90" : "text-muted")}>
              Нужна помощь распределителя — заявка поднимется у него наверх
            </span>
          </span>
        </label>
      ) : null}

      <PhotoPicker
        max={problem ? PHOTO_LIMITS.problem.max : PHOTO_LIMITS.comment.max}
        label="Фото (необязательно)"
      />

      {/* Ошибки полей здесь не дублируем: общее сообщение = первая ошибка поля. */}
      <FormError result={state} />
      <SubmitButton
        pending={pending}
        variant={problem ? "danger" : "primary"}
        icon={problem ? <TriangleAlert /> : <Send />}
      >
        {problem ? "Сообщить о проблеме" : "Отправить комментарий"}
      </SubmitButton>
    </form>
  );
}
