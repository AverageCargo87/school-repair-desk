"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { urgencyLabels } from "@/lib/labels";
import { URGENCIES } from "@/lib/requests/constants";
import { withParams } from "@/lib/url";
import { cn, shortName } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { chipClasses, CountBubble } from "@/components/ui/chip";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { fieldClasses } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  DISPATCH_DEFAULT_STATUS,
  STATUS_VIEWS,
  statusViewLabel,
  type StatusView,
} from "./dispatch-params";

export type DispatchFilterValues = {
  status: StatusView;
  building: string;
  urgency: string;
  executor: string;
  q: string;
};

type Draft = Omit<DispatchFilterValues, "q">;
type Building = { id: number; address: string; active: boolean };
type Executor = { id: number; fullName: string; active: boolean };

/** Чистая ссылка на список: без пустых параметров и без статуса по умолчанию. */
function dispatchHref(v: Partial<DispatchFilterValues>): string {
  return withParams(
    "/dispatch",
    {},
    {
      status: v.status && v.status !== DISPATCH_DEFAULT_STATUS ? v.status : undefined,
      building: v.building,
      urgency: v.urgency,
      executor: v.executor,
      q: v.q?.trim(),
    },
  );
}

function valuesFromForm(form: HTMLFormElement): Partial<DispatchFilterValues> {
  const fd = new FormData(form);
  const get = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" ? v : undefined;
  };
  return {
    status: get("status") as StatusView | undefined,
    building: get("building"),
    urgency: get("urgency"),
    executor: get("executor"),
    q: get("q"),
  };
}

function StatusOptions() {
  return STATUS_VIEWS.map((v) => (
    <option key={v.value} value={v.value}>
      {v.label}
    </option>
  ));
}

function BuildingOptions({ buildings }: { buildings: Building[] }) {
  return (
    <>
      <option value="">Все здания</option>
      {buildings.map((b) => (
        <option key={b.id} value={String(b.id)}>
          {b.address}
          {b.active ? "" : " (отключено)"}
        </option>
      ))}
    </>
  );
}

function UrgencyOptions() {
  return (
    <>
      <option value="">Любая срочность</option>
      {URGENCIES.map((u) => (
        <option key={u} value={u}>
          {urgencyLabels[u]}
        </option>
      ))}
    </>
  );
}

function ExecutorOptions({ executors }: { executors: Executor[] }) {
  return (
    <>
      <option value="">Все исполнители</option>
      {executors.map((e) => (
        <option key={e.id} value={String(e.id)}>
          {e.fullName}
          {e.active ? "" : " (отключён)"}
        </option>
      ))}
    </>
  );
}

/** Выбранный фильтр в строке (компьютер) — подсвечен цветом бренда. */
const appliedSelect =
  "[&>select]:border-primary [&>select]:bg-primary-soft [&>select]:font-medium [&>select]:text-primary-soft-fg";

/**
 * Поиск и фильтры списка распределителя.
 * Компьютер (lg+): одна строка — поиск и четыре списка; выбор в списке сразу применяет фильтр.
 * Телефон: поиск + кнопка «Фильтры» со счётчиком → нижний лист со списками и кнопкой «Показать»;
 * выбранные фильтры видны чипами под поиском (× — убрать один).
 * Без JS форма работает как обычная GET-форма.
 */
export function DispatchFilters({
  values,
  activeCount,
  buildings,
  executors,
}: {
  values: DispatchFilterValues;
  /** Сколько фильтров выбрано (кроме поиска и статуса по умолчанию). */
  activeCount: number;
  buildings: Building[];
  executors: Executor[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  // Текст поиска — свой; при смене адреса (счётчик, «Сбросить») подтягиваем значение из URL.
  const [text, setText] = useState(values.q);
  const [syncedQ, setSyncedQ] = useState(values.q);
  if (syncedQ !== values.q) {
    setSyncedQ(values.q);
    setText(values.q);
  }

  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(values);

  // Пересоздаём форму при смене параметров, чтобы списки показали новые значения.
  const formKey = JSON.stringify(values);

  function go(href: string) {
    startTransition(() => router.push(href, { scroll: false }));
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    searchRef.current?.blur();
    go(dispatchHref(valuesFromForm(e.currentTarget)));
  }

  function autoSubmit(e: React.ChangeEvent<HTMLSelectElement>) {
    const form = e.currentTarget.form;
    if (form) go(dispatchHref(valuesFromForm(form)));
  }

  function clearSearch() {
    setText("");
    if (values.q) go(dispatchHref({ ...values, q: "" }));
    searchRef.current?.focus();
  }

  function openSheet() {
    setDraft({
      status: values.status,
      building: values.building,
      urgency: values.urgency,
      executor: values.executor,
    });
    setSheetOpen(true);
  }

  function applySheet(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSheetOpen(false);
    go(dispatchHref({ ...draft, q: text }));
  }

  const draftDirty =
    draft.status !== DISPATCH_DEFAULT_STATUS || Boolean(draft.building || draft.urgency || draft.executor);

  // Чипы выбранных фильтров (телефон/планшет).
  const building = buildings.find((b) => String(b.id) === values.building);
  const executor = executors.find((x) => String(x.id) === values.executor);
  const applied: { key: string; label: string; href: string }[] = [];
  if (values.status !== DISPATCH_DEFAULT_STATUS) {
    applied.push({
      key: "status",
      label: statusViewLabel(values.status),
      href: dispatchHref({ ...values, status: DISPATCH_DEFAULT_STATUS }),
    });
  }
  if (building) {
    applied.push({ key: "building", label: building.address, href: dispatchHref({ ...values, building: "" }) });
  }
  if (values.urgency && values.urgency in urgencyLabels) {
    applied.push({
      key: "urgency",
      label: urgencyLabels[values.urgency as keyof typeof urgencyLabels],
      href: dispatchHref({ ...values, urgency: "" }),
    });
  }
  if (executor) {
    applied.push({
      key: "executor",
      label: shortName(executor.fullName),
      href: dispatchHref({ ...values, executor: "" }),
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        key={formKey}
        action="/dispatch"
        role="search"
        onSubmit={onSubmit}
        className="flex items-stretch gap-2 lg:grid lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))] lg:gap-3"
      >
        <div className="relative min-w-0 flex-1">
          <label htmlFor="dispatch-q" className="sr-only">
            Поиск по номеру или тексту
          </label>
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 inline-flex -translate-y-1/2 text-subtle"
          >
            {isPending ? <Spinner className="size-5 text-primary" /> : <Search className="size-5" />}
          </span>
          <input
            ref={searchRef}
            id="dispatch-q"
            type="search"
            name="q"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Номер или текст"
            enterKeyHint="search"
            autoComplete="off"
            maxLength={100}
            className={cn(
              fieldClasses,
              "h-12 pl-11 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-cancel-button]:appearance-none",
              text ? "pr-12" : "pr-3",
            )}
          />
          {text ? (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Очистить поиск"
              className="absolute top-0.5 right-0.5 inline-flex size-11 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:ring-4 focus-visible:ring-ring focus-visible:outline-none"
            >
              <X className="size-5" aria-hidden />
            </button>
          ) : null}
        </div>

        {/* Фильтры в строку — на большом экране. На телефоне скрыты, но уходят вместе с поиском,
            чтобы поиск не сбрасывал выбранные фильтры. */}
        <div className={cn("hidden min-w-0 lg:block", values.status !== DISPATCH_DEFAULT_STATUS && appliedSelect)}>
          <label htmlFor="dispatch-status" className="sr-only">
            Статус
          </label>
          <Select id="dispatch-status" name="status" defaultValue={values.status} onChange={autoSubmit} title="Статус">
            <StatusOptions />
          </Select>
        </div>
        <div className={cn("hidden min-w-0 lg:block", values.building && appliedSelect)}>
          <label htmlFor="dispatch-building" className="sr-only">
            Здание
          </label>
          <Select id="dispatch-building" name="building" defaultValue={values.building} onChange={autoSubmit} title="Здание">
            <BuildingOptions buildings={buildings} />
          </Select>
        </div>
        <div className={cn("hidden min-w-0 lg:block", values.urgency && appliedSelect)}>
          <label htmlFor="dispatch-urgency" className="sr-only">
            Срочность
          </label>
          <Select id="dispatch-urgency" name="urgency" defaultValue={values.urgency} onChange={autoSubmit} title="Срочность">
            <UrgencyOptions />
          </Select>
        </div>
        <div className={cn("hidden min-w-0 lg:block", values.executor && appliedSelect)}>
          <label htmlFor="dispatch-executor" className="sr-only">
            Исполнитель
          </label>
          <Select id="dispatch-executor" name="executor" defaultValue={values.executor} onChange={autoSubmit} title="Исполнитель">
            <ExecutorOptions executors={executors} />
          </Select>
        </div>

        <Button
          type="button"
          variant={activeCount > 0 ? "soft" : "outline"}
          size="lg"
          icon={<SlidersHorizontal />}
          onClick={openSheet}
          aria-haspopup="dialog"
          aria-label={activeCount > 0 ? `Фильтры, выбрано: ${activeCount}` : "Фильтры"}
          className="shrink-0 px-3.5 lg:hidden"
        >
          <span className="max-[359px]:sr-only">Фильтры</span>
          {activeCount > 0 ? <CountBubble value={activeCount} active /> : null}
        </Button>
      </form>

      {applied.length ? (
        <ul aria-label="Выбранные фильтры" className="flex flex-wrap gap-2 lg:hidden">
          {applied.map((f) => (
            <li key={f.key} className="min-w-0 max-w-full">
              <Link
                href={f.href}
                scroll={false}
                aria-label={`Убрать фильтр: ${f.label}`}
                className={chipClasses(true, "min-h-11 max-w-full pr-2.5")}
              >
                <span className="truncate">{f.label}</span>
                <X aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <Dialog
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Фильтры"
        showClose
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              disabled={!draftDirty}
              onClick={() =>
                setDraft({ status: DISPATCH_DEFAULT_STATUS, building: "", urgency: "", executor: "" })
              }
            >
              Сбросить
            </Button>
            <Button type="submit" form="dispatch-sheet" size="lg">
              Показать заявки
            </Button>
          </>
        }
      >
        <form id="dispatch-sheet" action="/dispatch" onSubmit={applySheet} className="flex flex-col gap-4">
          <input type="hidden" name="q" value={text} />
          <Field label="Статус" htmlFor="sheet-status">
            <Select
              id="sheet-status"
              name="status"
              value={draft.status}
              onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as StatusView }))}
            >
              <StatusOptions />
            </Select>
          </Field>
          <Field label="Здание" htmlFor="sheet-building">
            <Select
              id="sheet-building"
              name="building"
              value={draft.building}
              onChange={(e) => setDraft((d) => ({ ...d, building: e.target.value }))}
            >
              <BuildingOptions buildings={buildings} />
            </Select>
          </Field>
          <Field label="Срочность" htmlFor="sheet-urgency">
            <Select
              id="sheet-urgency"
              name="urgency"
              value={draft.urgency}
              onChange={(e) => setDraft((d) => ({ ...d, urgency: e.target.value }))}
            >
              <UrgencyOptions />
            </Select>
          </Field>
          <Field label="Исполнитель" htmlFor="sheet-executor">
            <Select
              id="sheet-executor"
              name="executor"
              value={draft.executor}
              onChange={(e) => setDraft((d) => ({ ...d, executor: e.target.value }))}
            >
              <ExecutorOptions executors={executors} />
            </Select>
          </Field>
        </form>
      </Dialog>
    </div>
  );
}
