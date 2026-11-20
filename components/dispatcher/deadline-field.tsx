"use client";

import { CalendarClock, CalendarX } from "lucide-react";
import { addDays, deadlineHint, formatDateLongMsk, isValidDateStr } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/requests/form-bits";

const QUICK = [
  { label: "Сегодня", days: 0 },
  { label: "Завтра", days: 1 },
  { label: "Через 3 дня", days: 3 },
  { label: "Через неделю", days: 7 },
] as const;

/**
 * Поле срока: быстрые чипы («Сегодня», «Завтра», «Через 3 дня», «Через неделю») + календарь.
 * Управляемое: value — 'YYYY-MM-DD' или "". min — сегодня по Москве.
 */
export function DeadlineField({
  id,
  name = "deadline",
  label,
  value,
  onChange,
  today,
  required,
  optional,
  hint,
  error,
}: {
  id: string;
  name?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Сегодня по Москве, 'YYYY-MM-DD'. */
  today: string;
  required?: boolean;
  /** Подпись «(необязательно)» у названия. */
  optional?: boolean;
  hint?: React.ReactNode;
  error?: string;
}) {
  const valid = isValidDateStr(value);
  const past = valid && value < today;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} required={required} optional={optional}>
        {label}
      </Label>
      {hint ? <p className="-mt-1 text-[13px] leading-snug text-muted">{hint}</p> : null}

      <div role="group" aria-label="Быстрый выбор срока" className="flex flex-wrap gap-2">
        {QUICK.map((q) => {
          const v = addDays(today, q.days);
          return (
            <Chip key={q.label} active={value === v} onClick={() => onChange(v)} className="min-h-11">
              {q.label}
            </Chip>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="date"
          name={name}
          min={today}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={past || Boolean(error) || undefined}
          className="min-w-0 flex-1 tabular-nums sm:max-w-60"
        />
        {!required && value ? (
          <Button type="button" variant="ghost" size="md" onClick={() => onChange("")} className="shrink-0">
            Очистить
          </Button>
        ) : null}
      </div>

      {valid ? (
        past ? (
          <p className="flex items-center gap-1.5 text-sm text-danger">
            <CalendarX aria-hidden className="size-4 shrink-0" />
            Срок не может быть раньше сегодняшнего дня.
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-sm text-muted tabular-nums">
            <CalendarClock aria-hidden className="size-4 shrink-0" />
            <span>
              <span className="font-medium text-text">{formatDateLongMsk(value)}</span> —{" "}
              {deadlineHint(value, today)}
            </span>
          </p>
        )
      ) : null}
      <FieldError message={error} />
    </div>
  );
}
