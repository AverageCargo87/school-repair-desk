"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn, pluralRu } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { fieldClasses } from "@/components/ui/input";

export type ExecutorChoice = { id: number; fullName: string; activeCount: number };

/** «свободен» / «в работе: 2» — сколько активных заявок у исполнителя. */
export function LoadBadge({ count, size = "md" }: { count: number; size?: "sm" | "md" }) {
  if (count === 0) {
    return (
      <Badge variant="success" size={size}>
        свободен
      </Badge>
    );
  }
  return (
    <Badge variant={count >= 4 ? "warning" : "neutral"} size={size} className="tabular-nums">
      в работе: {count}
    </Badge>
  );
}

/**
 * Выбор основного исполнителя: поле-кнопка (аватар, ФИО, загрузка) → нижний лист со списком
 * исполнителей и их загрузкой. Значение уходит в форму скрытым полем `name`.
 */
export function ExecutorPicker({
  id,
  name,
  executors,
  value,
  onChange,
  invalid,
  describedBy,
  ref,
}: {
  id: string;
  name: string;
  executors: ExecutorChoice[];
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
  ref?: React.Ref<HTMLButtonElement>;
}) {
  const [open, setOpen] = useState(false);
  const selected = executors.find((e) => String(e.id) === value) ?? null;

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <button
        ref={ref}
        id={id}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        data-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cn(
          fieldClasses,
          "flex min-h-14 cursor-pointer items-center gap-3 px-3 py-2 text-left data-[invalid=true]:border-danger",
        )}
      >
        {selected ? (
          <>
            <Avatar name={selected.fullName} size="lg" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium text-text">
                {selected.fullName}
              </span>
              <span className="mt-0.5 block text-[13px] text-muted">
                {selected.activeCount === 0
                  ? "Сейчас свободен"
                  : `Сейчас в работе ${selected.activeCount} ${pluralRu(selected.activeCount, ["заявка", "заявки", "заявок"])}`}
              </span>
            </span>
          </>
        ) : (
          <span className="flex-1 text-subtle">Выберите исполнителя</span>
        )}
        <ChevronDown aria-hidden className="size-5 shrink-0 text-muted" />
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Кто будет делать?"
        description="Справа — сколько заявок у человека сейчас в работе."
        showClose
        size="md"
      >
        <ul className="-mx-2 flex flex-col gap-1">
          {executors.map((e) => {
            const active = String(e.id) === value;
            return (
              <li key={e.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  data-autofocus={active ? true : undefined}
                  onClick={() => {
                    onChange(String(e.id));
                    setOpen(false);
                  }}
                  className={cn(
                    "flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors duration-150",
                    "focus-visible:ring-4 focus-visible:ring-ring focus-visible:outline-none",
                    active ? "bg-primary-soft" : "hover:bg-surface-2",
                  )}
                >
                  <Avatar name={e.fullName} size="lg" />
                  <span
                    className={cn(
                      "min-w-0 flex-1 text-[15px] leading-snug",
                      active ? "font-semibold text-primary-soft-fg" : "font-medium text-text",
                    )}
                  >
                    {e.fullName}
                  </span>
                  <LoadBadge count={e.activeCount} />
                  <span aria-hidden className="inline-flex w-5 shrink-0 justify-center text-primary">
                    {active ? <Check className="size-5" strokeWidth={2.5} /> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {executors.length === 0 ? (
          <p className="text-[15px] text-muted">
            Нет активных исполнителей. Добавьте их в разделе «Сотрудники».
          </p>
        ) : null}
      </Dialog>
    </>
  );
}
