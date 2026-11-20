"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Download, Printer, Scissors, TriangleAlert } from "lucide-react";
import type { AccessCardData } from "@/app/admin/types";
import { roleLabels } from "@/lib/labels";
import { todayMsk } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/ui/logo";

/** Карточек на листе A4: 2 колонки × 3 ряда. */
const PER_PAGE = 6;

/** Цвета (логотип) печатаются, даже если в браузере выключена «печать фона». */
const PRINT_EXACT = "[-webkit-print-color-adjust:exact] [print-color-adjust:exact]";

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** «https://zayavki.example.ru» → «zayavki.example.ru» (для подписи на карточке). */
function siteLabel(siteUrl: string): string {
  return siteUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

// ─── CSV ─────────────────────────────────────────────────────

function csvCell(v: string): string {
  // Защита от формул Excel: значение не должно начинаться с = + @ и т. п.
  const safe = /^[=+@\t\r]/.test(v) ? `'${v}` : v;
  return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV для Excel: разделитель «;», UTF-8 с BOM, строки CRLF. */
export function accessCsv(cards: AccessCardData[], siteUrl: string): string {
  const header = ["ФИО", "Роль", "Логин", "Пароль", "Ссылка для входа", "Адрес сайта"];
  const rows = cards.map((c) => [c.fullName, roleLabels[c.role], c.login, c.password, c.link, siteUrl]);
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";
}

function downloadText(text: string, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ─── Карточка и лист ─────────────────────────────────────────

/** Одна карточка доступа (≈ 95 × 80 мм при печати). */
function AccessCard({ card, siteUrl }: { card: AccessCardData; siteUrl: string }) {
  const site = siteLabel(siteUrl);
  return (
    <article className="flex min-w-0 break-inside-avoid flex-col gap-3 border-r border-b border-dashed border-border-strong bg-surface p-[5mm] text-text print:border-muted">
      <header className="flex items-center gap-2">
        <LogoMark size="sm" />
        <span className="text-[13px] leading-tight font-semibold tracking-tight">
          Заявки <span className="font-normal text-muted">· Школа</span>
        </span>
      </header>

      <div className="min-w-0">
        <div className="text-[17px] leading-snug font-semibold tracking-tight wrap-anywhere">
          {card.fullName}
        </div>
        <div className="text-[13px] text-muted">{roleLabels[card.role]}</div>
      </div>

      <div className="flex items-center gap-[4mm]">
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL QR-кода, оптимизация не нужна */}
        <img
          src={card.qr}
          alt={`QR-код для входа: ${card.fullName}`}
          width={113}
          height={113}
          className="size-[30mm] shrink-0 rounded-md"
        />
        <dl className="flex min-w-0 flex-1 flex-col gap-2">
          <div>
            <dt className="text-[11px] leading-none text-muted">Логин</dt>
            <dd className="mt-1 font-mono text-[17px] leading-none font-semibold break-all">
              {card.login}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] leading-none text-muted">Пароль</dt>
            <dd className="mt-1 font-mono text-[19px] leading-none font-bold tracking-wider break-all">
              {card.password}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] leading-none text-muted">Сайт</dt>
            <dd className="mt-1 text-[12px] leading-tight font-medium break-all">{site}</dd>
          </div>
        </dl>
      </div>

      <div className="text-[11px] leading-snug text-muted">
        <ol className="list-decimal pl-4">
          <li>Наведите камеру телефона на QR-код и откройте ссылку.</li>
          <li>Нажмите «Войти».</li>
          <li>Добавьте страницу на экран «Домой».</li>
        </ol>
        <p className="mt-1">
          Без QR: откройте <span className="font-medium text-text">{site}</span> и введите логин и
          пароль.
        </p>
      </div>
    </article>
  );
}

/**
 * Лист карточек для печати: A4, 2 колонки, пунктир для разрезания, по 6 карточек на лист.
 * На экране — «бумажные» листы шириной A4; одна карточка — шириной в пол-листа.
 */
export function AccessCards({
  cards,
  siteUrl,
  className,
}: {
  cards: AccessCardData[];
  siteUrl: string;
  className?: string;
}) {
  const single = cards.length === 1;
  return (
    <div className={cn("flex flex-col gap-6 print:block", PRINT_EXACT, className)}>
      {chunk(cards, PER_PAGE).map((page, i) => (
        <section
          key={i}
          aria-label={`Лист ${i + 1}`}
          className={cn(
            "relative w-full print:break-after-page print:pt-[3mm] print:last:break-after-auto",
            single ? "max-w-[95mm]" : "mx-auto max-w-[190mm]",
          )}
        >
          <Scissors
            aria-hidden
            className="absolute top-0 left-4 z-10 size-4 -translate-y-1/2 text-subtle print:top-[3mm] print:text-muted"
          />
          <div
            className={cn(
              "grid border-t border-l border-dashed border-border-strong bg-surface shadow-card print:border-muted print:shadow-none",
              single ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 print:grid-cols-2",
            )}
          >
            {page.map((c) => (
              <AccessCard key={c.userId} card={c} siteUrl={siteUrl} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ─── Печать: только карточки ─────────────────────────────────

const noopSubscribe = () => () => {};

function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * Копия листа прямо в <body>, видна только при печати. Пока она есть на странице,
 * печать прячет всё остальное (шапку, меню, формы) — на бумагу попадают только карточки.
 */
function PrintOnlySheet({ cards, siteUrl }: { cards: AccessCardData[]; siteUrl: string }) {
  const isClient = useIsClient();
  if (!isClient) return null;
  return createPortal(
    <div data-access-print="" className="hidden bg-surface print:block">
      <style>{"@media print { body > :not([data-access-print]) { display: none !important; } }"}</style>
      <AccessCards cards={cards} siteUrl={siteUrl} />
    </div>,
    document.body,
  );
}

/**
 * Результат выдачи доступов: предупреждение «пароли показываются один раз», «Печать»,
 * «Скачать CSV», лист карточек. Для печати — только карточки.
 */
export function AccessResult({
  cards,
  siteUrl,
  issuedAt,
  failed,
  message,
  onDone,
  doneLabel = "Готово",
  className,
}: {
  cards: AccessCardData[];
  siteUrl: string;
  issuedAt?: string;
  failed?: string[];
  message?: string;
  /** «Выдать ещё» / «Скрыть» — убрать карточки с экрана. */
  onDone?: () => void;
  doneLabel?: string;
  className?: string;
}) {
  const date = todayMsk(issuedAt ? new Date(issuedAt) : new Date());
  const fileName =
    cards.length === 1 ? `dostup-${cards[0].login}-${date}.csv` : `dostupy-${date}.csv`;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <Alert tone="warning" title="Пароли показываются один раз" role="status">
        {message ? `${message} ` : null}
        Распечатайте карточки или скачайте CSV сейчас: в базе пароль хранится в зашифрованном виде,
        потом его уже не посмотреть — только выдать заново.
      </Alert>
      {failed?.length ? (
        <Alert tone="danger" title={`Не удалось выдать: ${failed.join(", ")}`} role="alert">
          У них остались прежние пароль и ссылка. Попробуйте выдать им доступ ещё раз.
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Button
          type="button"
          size="lg"
          icon={<Printer />}
          onClick={() => window.print()}
          className="w-full sm:w-auto"
        >
          Печать
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          icon={<Download />}
          onClick={() => downloadText(accessCsv(cards, siteUrl), fileName, "text/csv;charset=utf-8")}
          className="w-full sm:w-auto"
        >
          Скачать CSV
        </Button>
        {onDone ? (
          <Button
            type="button"
            size="lg"
            variant="ghost"
            onClick={onDone}
            className="w-full sm:ml-auto sm:w-auto"
          >
            {doneLabel}
          </Button>
        ) : null}
      </div>

      <p className="flex items-start gap-2 text-[13px] leading-snug text-muted">
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
        Карточку отдавайте лично в руки: по QR-коду входят без пароля.
      </p>

      <AccessCards cards={cards} siteUrl={siteUrl} />
      <PrintOnlySheet cards={cards} siteUrl={siteUrl} />
    </div>
  );
}
