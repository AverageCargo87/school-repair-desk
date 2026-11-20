"use client";

import { useState, type FormEvent } from "react";
import { Building2, CalendarDays, Send, ShoppingCart, Siren, Wrench } from "lucide-react";
import { createRequestAction } from "@/app/r/actions";
import type { Urgency } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { urgencyHints, urgencyLabels } from "@/lib/labels";
import { PHOTO_LIMITS, TEXT_LIMITS, URGENCIES } from "@/lib/requests/constants";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { OptionCard, type OptionTone } from "@/components/ui/option-card";
import { Select } from "@/components/ui/select";
import { StickyActions } from "@/components/ui/sticky-actions";
import { Textarea } from "@/components/ui/textarea";
import { FieldError, FormError, SubmitButton } from "@/components/requests/form-bits";
import { PhotoPicker } from "@/components/requests/photo-picker";
import { useActionForm } from "@/components/requests/use-action-form";

export type NewRequestFormProps = {
  /** ФИО того, кто подаёт заявку (показывается, не редактируется). */
  authorName: string;
  /** Сегодняшняя дата по Москве, уже в виде подписи («10 октября 2026 г.»). */
  todayLabel: string;
  /** Здания, по которым можно подать заявку (заявителю — закреплённые, распределителю — все активные). */
  buildings: { id: number; address: string }[];
};

/** Обязательные поля в порядке на экране — для фокуса на первой ошибке. */
const REQUIRED_ORDER = ["buildingId", "description", "urgency"] as const;

/** Больше стольких зданий — выбор списком (у распределителя), а не карточками. */
const MAX_BUILDING_CARDS = 6;

/** Вид карточек срочности (DESIGN.md): аварийная — красная, закупка — оранжевая. */
const URGENCY_VIEW: Record<Urgency, { icon: React.ReactNode; tone: OptionTone }> = {
  emergency: { icon: <Siren />, tone: "danger" },
  current: { icon: <Wrench />, tone: "neutral" },
  purchase: { icon: <ShoppingCart />, tone: "warning" },
};

/** Красная рамка у карточек-вариантов при ошибке (важность — чтобы перебить рамку по умолчанию). */
const INVALID_OPTION = "border-danger/70!";

/** Проверка на клиенте (те же правила повторно проверяет сервер). */
function validate(form: HTMLFormElement): Record<string, string> {
  const fd = new FormData(form);
  const errors: Record<string, string> = {};
  if (!String(fd.get("buildingId") ?? "").trim()) errors.buildingId = "Выберите здание.";
  if (!String(fd.get("description") ?? "").trim()) errors.description = "Опишите, что случилось.";
  if (!String(fd.get("urgency") ?? "").trim()) errors.urgency = "Выберите срочность.";
  return errors;
}

/** Прокрутить к первому полю с ошибкой и поставить в него курсор. */
function focusFirstError(form: HTMLFormElement, errors: Record<string, string>) {
  const name = REQUIRED_ORDER.find((n) => errors[n]);
  if (!name) return;
  form.querySelector(`#field-${name}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  const input = form.querySelector<HTMLElement>(`[name="${name}"]:not([type="hidden"])`);
  input?.focus({ preventScroll: true });
}

/** Подпись группы вариантов (как <Label>, но для <legend>). */
function Legend({ children, invalid }: { children: React.ReactNode; invalid?: boolean }) {
  return (
    <legend className={cn("mb-2 block text-sm font-medium", invalid ? "text-danger" : "text-text")}>
      {children}
      <span className="text-danger"> *</span>
    </legend>
  );
}

/**
 * Форма новой заявки (общая для заявителя, распределителя и админа).
 * Отправка — createRequestAction; при успехе сервер переводит на карточку заявки.
 */
export function NewRequestForm({ authorName, todayLabel, buildings }: NewRequestFormProps) {
  const { state, pending, formRef, onSubmit, fieldError } = useActionForm(createRequestAction, {
    resetOnSuccess: false,
  });
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  // Поля, которые человек поправил после последнего ответа сервера: старую ошибку под ними прячем.
  const [edited, setEdited] = useState<{ result: ActionResult; names: string[] }>({
    result: state,
    names: [],
  });
  const editedNames = edited.result === state ? edited.names : [];

  function errorOf(name: string): string | undefined {
    return clientErrors[name] ?? (editedNames.includes(name) ? undefined : fieldError(name));
  }

  function touch(name: string) {
    setClientErrors((prev) => {
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setEdited((prev) => {
      if (prev.result !== state) return { result: state, names: [name] };
      return prev.names.includes(name) ? prev : { result: state, names: [...prev.names, name] };
    });
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    const errors = validate(e.currentTarget);
    if (Object.keys(errors).length > 0) {
      e.preventDefault();
      setClientErrors(errors);
      focusFirstError(e.currentTarget, errors);
      return;
    }
    setClientErrors({});
    onSubmit(e);
  }

  // Общее сообщение у кнопки: при ошибках полей — короткая подсказка (сами ошибки — под полями).
  const serverFieldErrors = Object.keys(state.fieldErrors ?? {}).filter(
    (n) => !editedNames.includes(n),
  );
  let summary: string | undefined;
  if (Object.keys(clientErrors).length > 0) {
    summary = "Заполните обязательные поля — они отмечены красным.";
  } else if (!state.ok && state.error) {
    if (!state.fieldErrors || Object.keys(state.fieldErrors).length === 0) summary = state.error;
    else if (serverFieldErrors.length > 0) summary = "Проверьте поля, отмеченные красным.";
  }

  const single = buildings.length === 1 ? buildings[0] : null;
  const asSelect = buildings.length > MAX_BUILDING_CARDS;
  const buildingError = errorOf("buildingId");
  const urgencyError = errorOf("urgency");
  const descriptionError = errorOf("description");
  const locationError = errorOf("location");

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      onChange={(e) => {
        const target: EventTarget = e.target;
        if (
          (target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target instanceof HTMLSelectElement) &&
          target.name
        ) {
          touch(target.name);
        }
      }}
      noValidate
      aria-busy={pending}
      className="flex flex-col gap-6"
    >
      {/* Кто и когда — не редактируется */}
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-card">
        <Avatar name={authorName} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] leading-snug font-medium wrap-anywhere text-text">
            <span className="sr-only">Кто подаёт: </span>
            {authorName}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-sm text-muted tabular-nums">
            <CalendarDays aria-hidden className="size-4 shrink-0" />
            <span>
              <span className="sr-only">Дата: </span>
              Сегодня, {todayLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Здание */}
      {single ? (
        <div id="field-buildingId" className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text">Здание</span>
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface-2 p-3.5">
            <span
              aria-hidden
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"
            >
              <Building2 className="size-5" />
            </span>
            <span className="min-w-0 text-[15px] leading-snug font-semibold wrap-anywhere text-text">
              {single.address}
            </span>
          </div>
          <input type="hidden" name="buildingId" value={single.id} />
          <FieldError message={buildingError} />
        </div>
      ) : asSelect ? (
        <div id="field-buildingId">
          <Field label="Здание" htmlFor="new-building" required error={buildingError}>
            <Select
              id="new-building"
              name="buildingId"
              defaultValue=""
              aria-invalid={buildingError ? true : undefined}
            >
              <option value="">Выберите здание</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.address}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      ) : (
        <fieldset id="field-buildingId" className="min-w-0">
          <Legend invalid={Boolean(buildingError)}>Здание</Legend>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {buildings.map((b) => (
              <OptionCard
                key={b.id}
                name="buildingId"
                value={String(b.id)}
                icon={<Building2 />}
                title={<span className="wrap-anywhere">{b.address}</span>}
                className={buildingError ? INVALID_OPTION : undefined}
              />
            ))}
          </div>
          {buildingError ? (
            <div className="mt-2">
              <FieldError message={buildingError} />
            </div>
          ) : null}
        </fieldset>
      )}

      {/* Где именно */}
      <div id="field-location">
        <Field
          label="Где именно"
          htmlFor="new-location"
          optional
          hint="Этаж, кабинет или помещение."
          error={locationError}
        >
          <Input
            id="new-location"
            name="location"
            maxLength={TEXT_LIMITS.location}
            autoComplete="off"
            enterKeyHint="next"
            placeholder="Например: 2 этаж, кабинет 204"
            aria-invalid={locationError ? true : undefined}
          />
        </Field>
      </div>

      {/* Что случилось */}
      <div id="field-description">
        <Field
          label="Что случилось"
          htmlFor="new-description"
          required
          hint="Коротко: что сломалось или что нужно сделать."
          error={descriptionError}
        >
          <Textarea
            id="new-description"
            name="description"
            rows={4}
            maxLength={TEXT_LIMITS.description}
            placeholder="Например: в туалете на 2 этаже течёт кран, вода не перекрывается"
            aria-invalid={descriptionError ? true : undefined}
          />
        </Field>
      </div>

      {/* Фото */}
      <PhotoPicker
        max={PHOTO_LIMITS.create.max}
        label="Фото"
        hint="Необязательно. Сфотографируйте поломку — так быстрее поймут, что нужно сделать."
        error={errorOf("photos")}
        disabled={pending}
      />

      {/* Срочность */}
      <fieldset id="field-urgency" className="min-w-0">
        <Legend invalid={Boolean(urgencyError)}>Срочность</Legend>
        <div className="grid gap-2.5">
          {URGENCIES.map((u) => (
            <OptionCard
              key={u}
              name="urgency"
              value={u}
              icon={URGENCY_VIEW[u].icon}
              tone={URGENCY_VIEW[u].tone}
              title={urgencyLabels[u]}
              description={urgencyHints[u]}
              className={urgencyError ? INVALID_OPTION : undefined}
            />
          ))}
        </div>
        {urgencyError ? (
          <div className="mt-2">
            <FieldError message={urgencyError} />
          </div>
        ) : null}
      </fieldset>

      <StickyActions>
        <div className="flex w-full flex-col gap-2 md:items-start">
          <FormError result={{ ok: false, error: summary }} className="w-full" />
          <SubmitButton pending={pending} pendingText="Отправляем…" icon={<Send />}>
            Отправить заявку
          </SubmitButton>
          {pending ? (
            <p role="status" className="text-center text-sm text-muted md:text-left">
              Отправляем заявку, не закрывайте страницу.
            </p>
          ) : null}
        </div>
      </StickyActions>
    </form>
  );
}
