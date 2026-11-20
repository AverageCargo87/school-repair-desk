"use client";

import { useState } from "react";
import { Check, Copy, TriangleAlert } from "lucide-react";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Копирование без Clipboard API (страница открыта по http, не localhost). */
function fallbackCopy(text: string): boolean {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.top = "-1000px";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

/** Кнопка «Копировать» с отметкой «Скопировано». */
export function CopyButton({
  text,
  label = "Копировать",
  className,
  variant = "primary",
}: {
  text: string;
  label?: string;
  className?: string;
  variant?: ButtonVariant;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      ok = fallbackCopy(text);
    }
    setStatus(ok ? "copied" : "failed");
    window.setTimeout(() => setStatus("idle"), 2500);
  }

  return (
    <Button
      type="button"
      variant={variant}
      onClick={copy}
      icon={status === "copied" ? <Check /> : status === "failed" ? <TriangleAlert /> : <Copy />}
      className={cn("shrink-0", className)}
      aria-live="polite"
    >
      {status === "copied" ? "Скопировано" : status === "failed" ? "Выделите и скопируйте" : label}
    </Button>
  );
}

/**
 * Секрет, который показывается один раз (пароль, ссылка): значение крупно + «Копировать».
 */
export function SecretBox({
  title,
  value,
  copyText,
  note,
}: {
  title: string;
  value: string;
  /** Что копировать (по умолчанию — само значение). */
  copyText?: string;
  note?: React.ReactNode;
}) {
  return (
    <div className="flex animate-pop-in flex-col gap-2.5 rounded-xl border border-success/40 bg-success-bg p-3.5">
      <div className="flex items-center gap-2 text-sm font-semibold text-success-fg">
        <Check aria-hidden className="size-4 shrink-0" />
        {title}
      </div>
      <div className="rounded-lg border border-border bg-surface px-3 py-2.5 font-mono text-base font-medium break-all text-text select-all">
        {value}
      </div>
      <CopyButton text={copyText ?? value} className="w-full sm:w-auto sm:self-start" />
      {note ? <p className="text-[13px] leading-snug text-success-fg">{note}</p> : null}
    </div>
  );
}
