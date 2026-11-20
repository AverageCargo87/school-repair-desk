"use client";

import { useState } from "react";
import { CalendarRange, ListFilter } from "lucide-react";
import { diffDays, formatDateLongMsk, isValidDateStr } from "@/lib/time";
import { pluralRu } from "@/lib/utils";
import { Chip } from "@/components/ui/chip";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { Select } from "@/components/ui/select";
import { StickyActions } from "@/components/ui/sticky-actions";
import { ExportSubmitButton } from "./export-button";

export type ExportPreset = { label: string; from: string; to: string };

/**
 * Форма выгрузки: период (быстрые кнопки + две даты), здание, статус → GET /export/file (.xlsx).
 * Обычная GET-форма: без JS тоже работает, браузер просто скачает файл.
 */
export function ExportForm({
  today,
  initial,
  presets,
  buildings,
  statuses,
}: {
  /** Сегодня по Москве, 'YYYY-MM-DD'. */
  today: string;
  initial: { from: string; to: string; status: string; building: string };
  presets: ExportPreset[];
  buildings: { id: number; address: string; active: boolean }[];
  statuses: { value: string; label: string }[];
}) {
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const validRange = isValidDateStr(from) && isValidDateStr(to) && from <= to;
  const days = validRange ? diffDays(from, to) + 1 : 0;

  return (
    <form method="get" action="/export/file" className="flex flex-col gap-4">
      <SectionCard
        icon={<CalendarRange />}
        title="Период"
        description="Попадут заявки, созданные в эти дни (включительно)."
      >
        <div className="flex flex-col gap-4">
          <div role="group" aria-label="Быстрый выбор периода" className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <Chip
                key={p.label}
                active={p.from === from && p.to === to}
                onClick={() => {
                  setFrom(p.from);
                  setTo(p.to);
                }}
                className="min-h-11"
              >
                {p.label}
              </Chip>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="С" htmlFor="export-from" className="min-w-0">
              <Input
                id="export-from"
                type="date"
                name="from"
                required
                max={today}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="tabular-nums"
              />
            </Field>
            <Field label="По" htmlFor="export-to" className="min-w-0">
              <Input
                id="export-to"
                type="date"
                name="to"
                required
                min={isValidDateStr(from) ? from : undefined}
                value={to}
                onChange={(e) => setTo(e.target.value)}
                aria-invalid={(isValidDateStr(from) && isValidDateStr(to) && to < from) || undefined}
                className="tabular-nums"
              />
            </Field>
          </div>

          {validRange ? (
            <p className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm text-muted tabular-nums">
              С <span className="font-medium text-text">{formatDateLongMsk(from)}</span> по{" "}
              <span className="font-medium text-text">{formatDateLongMsk(to)}</span> — {days}{" "}
              {pluralRu(days, ["день", "дня", "дней"])}
            </p>
          ) : isValidDateStr(from) && isValidDateStr(to) ? (
            <p className="text-sm text-danger">Дата «По» не может быть раньше даты «С».</p>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard icon={<ListFilter />} title="Какие заявки" description="Можно оставить всё как есть — выгрузятся все.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Здание" htmlFor="export-building" className="min-w-0">
            <Select id="export-building" name="building" defaultValue={initial.building}>
              <option value="">Все здания</option>
              {buildings.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.address}
                  {b.active ? "" : " (отключено)"}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Статус" htmlFor="export-status" className="min-w-0">
            <Select id="export-status" name="status" defaultValue={initial.status}>
              {statuses.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </SectionCard>

      <StickyActions>
        <ExportSubmitButton />
      </StickyActions>
    </form>
  );
}
