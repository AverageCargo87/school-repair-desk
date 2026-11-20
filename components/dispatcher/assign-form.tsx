"use client";

import { useRef, useState, type FormEvent } from "react";
import { Check, Pencil, Plus, Send, UserCog } from "lucide-react";
import { assignRequestAction } from "@/app/r/actions";
import { formatDateMsk } from "@/lib/time";
import { shortName } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FieldError,
  FormError,
  FormSuccess,
  SubmitButton,
} from "@/components/requests/form-bits";
import { useActionForm } from "@/components/requests/use-action-form";
import { DeadlineField } from "./deadline-field";
import { ExecutorPicker } from "./executor-picker";

type Person = { id: number; fullName: string };

export type AssignFormProps = {
  requestId: number;
  /** Заявка «Новая» — первое назначение. */
  isFirst: boolean;
  /** Открыта проблема (назначение её снимет). */
  problemOpen: boolean;
  /** Активные исполнители (по ФИО). */
  executors: (Person & { activeCount: number })[];
  /** Текущее назначение. */
  current: {
    executor: Person | null;
    coexecutors: Person[];
    deadline: string | null;
    dispatcherComment: string | null;
  };
  /** Сегодня по Москве. */
  today: string;
};

function sameIds(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

/**
 * Форма назначения / переназначения: исполнитель (обязательно), соисполнители, срок, комментарий.
 * Первое назначение — форма открыта сразу. Если заявка уже назначена — форма свёрнута
 * под кнопку «Изменить назначение» (чтобы карточка не была бесконечной).
 * При повторном назначении поля заполнены текущими значениями; текущий комментарий
 * показывается отдельно (пустое поле — комментарий остаётся прежним).
 */
export function AssignForm({
  requestId,
  isFirst,
  problemOpen,
  executors,
  current,
  today,
}: AssignFormProps) {
  const activeIds = new Set(executors.map((e) => e.id));
  const initialExecutor =
    current.executor && activeIds.has(current.executor.id) ? String(current.executor.id) : "";
  const initialCo = current.coexecutors
    .map((c) => c.id)
    .filter((id) => activeIds.has(id) && String(id) !== initialExecutor);
  const initialDeadline =
    current.deadline && current.deadline >= today ? current.deadline : "";

  const executorInactive = Boolean(current.executor && !activeIds.has(current.executor.id));
  const inactiveCo = current.coexecutors.filter((c) => !activeIds.has(c.id));
  const deadlinePassed = Boolean(current.deadline && current.deadline < today);
  // Если назначение «сломано» (исполнитель отключён, срок прошёл) — сразу показываем форму.
  const needsFix = executorInactive || inactiveCo.length > 0 || deadlinePassed;

  const [expanded, setExpanded] = useState(needsFix);
  const [executorId, setExecutorId] = useState(initialExecutor);
  const [coIds, setCoIds] = useState<number[]>(initialCo);
  const [showAllCo, setShowAllCo] = useState(false);
  const [deadline, setDeadline] = useState(initialDeadline);
  const [comment, setComment] = useState("");
  const [executorMissing, setExecutorMissing] = useState(false);
  const pickerRef = useRef<HTMLButtonElement>(null);
  /** Отправлено первое назначение (для текста «Исполнитель назначен»). */
  const [sentFirst, setSentFirst] = useState(false);

  const { state, pending, formRef, onSubmit, fieldError } = useActionForm(assignRequestAction, {
    resetOnSuccess: false,
    onSuccess: () => {
      setComment("");
      setShowAllCo(false);
      setExpanded(false);
    },
  });

  const mainId = Number(executorId) || null;
  const visibleCo = coIds.filter((id) => id !== mainId);
  const coCandidates = executors.filter((e) => e.id !== mainId);
  const coSelected = coCandidates.filter((e) => visibleCo.includes(e.id));

  // Сравниваем с тем, что сохранено сейчас (а не с начальным состоянием формы).
  const savedExecutor = current.executor ? String(current.executor.id) : "";
  const savedCo = current.coexecutors.map((c) => c.id);
  const changed =
    isFirst ||
    executorId !== savedExecutor ||
    !sameIds(visibleCo, savedCo) ||
    deadline !== (current.deadline ?? "") ||
    comment.trim() !== "";
  const executorChanges = !isFirst && current.executor !== null && executorId !== savedExecutor;

  function toggleCo(id: number) {
    setCoIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  /** «Отмена»: вернуть поля к сохранённому назначению и свернуть форму. */
  function cancel() {
    setExecutorId(initialExecutor);
    setCoIds(initialCo);
    setDeadline(initialDeadline);
    setComment("");
    setShowAllCo(false);
    setExecutorMissing(false);
    setExpanded(false);
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    setSentFirst(isFirst);
    if (!executorId) {
      e.preventDefault();
      setExecutorMissing(true);
      pickerRef.current?.focus();
      return;
    }
    onSubmit(e);
  }

  // Заявка уже назначена: свёрнутый вид с кнопкой «Изменить назначение».
  if (!isFirst && !expanded) {
    return (
      <div className="flex flex-col gap-3">
        <FormSuccess result={state}>
          {sentFirst
            ? "Исполнитель назначен. Заявка появилась у него в «Моих задачах»."
            : "Назначение сохранено."}
        </FormSuccess>
        <Button
          type="button"
          variant="outline"
          size="lg"
          icon={<UserCog />}
          onClick={() => setExpanded(true)}
          aria-expanded={false}
          aria-controls={`assign-form-${requestId}`}
          className="w-full sm:w-auto"
        >
          Изменить назначение
        </Button>
      </div>
    );
  }

  const executorError = executorMissing && !executorId ? "Выберите исполнителя" : fieldError("executorId");
  const executorErrorId = `assign-executor-error-${requestId}`;

  return (
    <form
      id={`assign-form-${requestId}`}
      ref={formRef}
      onSubmit={submit}
      className="flex flex-col gap-5"
    >
      <input type="hidden" name="requestId" value={requestId} />

      {/* Исполнитель */}
      <div className="flex flex-col gap-2">
        <Label htmlFor={`assign-executor-${requestId}`} required>
          Исполнитель
        </Label>
        <ExecutorPicker
          ref={pickerRef}
          id={`assign-executor-${requestId}`}
          name="executorId"
          executors={executors}
          value={executorId}
          onChange={(v) => {
            setExecutorId(v);
            setExecutorMissing(false);
          }}
          invalid={Boolean(executorError)}
          describedBy={executorError ? executorErrorId : undefined}
        />
        {executorInactive && current.executor ? (
          <Alert tone="warning">
            Сейчас назначен {current.executor.fullName}, но он отключён — выберите другого
            исполнителя.
          </Alert>
        ) : null}
        {executorChanges && executorId ? (
          <p className="text-[13px] leading-snug text-muted">
            Исполнитель сменится: новому нужно будет нажать «Принял».
          </p>
        ) : null}
        <div id={executorErrorId}>
          <FieldError message={executorError} />
        </div>
      </div>

      {/* Соисполнители: выбранные — всегда видны, остальные — по кнопке «Добавить». */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span id={`assign-co-label-${requestId}`} className="text-sm font-medium text-text">
            Соисполнители <span className="font-normal text-muted">(необязательно)</span>
          </span>
          {coCandidates.length > 0 ? (
            <Button
              type="button"
              variant={showAllCo ? "ghost" : "soft"}
              size="sm"
              icon={showAllCo ? <Check /> : <Plus />}
              onClick={() => setShowAllCo((v) => !v)}
              aria-expanded={showAllCo}
            >
              {showAllCo ? "Готово" : coSelected.length ? "Изменить" : "Добавить"}
            </Button>
          ) : null}
        </div>
        <p className="-mt-1 text-[13px] leading-snug text-muted">
          Помогают основному исполнителю: видят заявку, пишут комментарии и сообщают о проблеме.
        </p>

        {visibleCo.map((id) => (
          <input key={id} type="hidden" name="coexecutorIds" value={id} />
        ))}

        <div
          role="group"
          aria-labelledby={`assign-co-label-${requestId}`}
          className="flex flex-wrap gap-2"
        >
          {(showAllCo ? coCandidates : coSelected).map((e) => (
            <Chip
              key={e.id}
              active={visibleCo.includes(e.id)}
              onClick={() => toggleCo(e.id)}
              icon={<Avatar name={e.fullName} size="sm" />}
              className="min-h-11 pl-1.5"
              title={e.fullName}
            >
              {shortName(e.fullName)}
              {visibleCo.includes(e.id) ? <Check aria-hidden className="text-primary" /> : null}
            </Chip>
          ))}
          {!showAllCo && coSelected.length === 0 ? (
            <span className="text-sm text-subtle">Не выбраны — работает только основной исполнитель.</span>
          ) : null}
        </div>

        {inactiveCo.length ? (
          <Alert tone="warning">
            Отключены и будут убраны из соисполнителей:{" "}
            {inactiveCo.map((c) => shortName(c.fullName)).join(", ")}.
          </Alert>
        ) : null}
        <FieldError message={fieldError("coexecutorIds")} />
      </div>

      {/* Срок */}
      <DeadlineField
        id={`assign-deadline-${requestId}`}
        label="Срок выполнения"
        value={deadline}
        onChange={setDeadline}
        today={today}
        required
        hint={
          deadlinePassed && current.deadline
            ? `Прежний срок ${formatDateMsk(current.deadline)} уже прошёл — выберите новый.`
            : undefined
        }
        error={fieldError("deadline")}
      />

      {/* Комментарий */}
      <div className="flex flex-col gap-2">
        <Label htmlFor={`assign-comment-${requestId}`} optional>
          Комментарий исполнителю
        </Label>
        {!isFirst && current.dispatcherComment ? (
          <div className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm text-text">
            <div className="text-[13px] text-muted">Сейчас:</div>
            <div className="mt-0.5 whitespace-pre-wrap wrap-anywhere">{current.dispatcherComment}</div>
            <div className="mt-1.5 text-[13px] text-muted">
              Оставьте поле ниже пустым — этот комментарий сохранится.
            </div>
          </div>
        ) : null}
        <Textarea
          id={`assign-comment-${requestId}`}
          name="comment"
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Например: ключ у охраны, взять стремянку"
        />
        <FieldError message={fieldError("comment")} />
      </div>

      {problemOpen ? (
        <Alert tone="neutral">После сохранения отметка «Проблема» снимется.</Alert>
      ) : null}

      <FormError result={state} />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SubmitButton
          pending={pending}
          disabled={!changed}
          icon={isFirst ? <Send /> : <Pencil />}
        >
          {isFirst ? "Отправить исполнителю" : "Сохранить назначение"}
        </SubmitButton>
        {!isFirst ? (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={cancel}
            disabled={pending}
            className="w-full sm:w-auto"
          >
            Отмена
          </Button>
        ) : null}
      </div>
      {!changed && !isFirst ? (
        <p className="-mt-3 text-[13px] text-muted">
          Пока ничего не изменилось: смените исполнителя, соисполнителей, срок или напишите
          комментарий.
        </p>
      ) : null}
    </form>
  );
}
