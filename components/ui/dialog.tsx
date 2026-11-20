"use client";

import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

const noopSubscribe = () => () => {};

/** true только в браузере (портал нельзя рендерить на сервере). */
function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export type DialogProps = {
  open: boolean;
  /** Закрыть (Esc, клик по фону, крестик). */
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Иконка в цветном кружке над заголовком (элемент lucide-react). */
  icon?: React.ReactNode;
  /** Цвет кружка иконки. */
  tone?: "primary" | "danger" | "warning" | "success" | "neutral";
  children?: React.ReactNode;
  /** Кнопки внизу (на телефоне — столбиком, на компьютере — в ряд справа). */
  footer?: React.ReactNode;
  /** false — нельзя закрыть Esc/фоном (например, пока идёт отправка). */
  dismissible?: boolean;
  /** Показывать крестик в углу. */
  showClose?: boolean;
  /** Ширина на компьютере. */
  size?: "sm" | "md" | "lg";
  className?: string;
};

const toneIcon: Record<NonNullable<DialogProps["tone"]>, string> = {
  primary: "bg-primary-soft text-primary",
  danger: "bg-danger-bg text-danger",
  warning: "bg-warning-bg text-warning",
  success: "bg-success-bg text-success",
  neutral: "bg-surface-2 text-muted",
};

/**
 * Модальное окно: на телефоне — нижний лист (выезжает снизу), на компьютере — окно по центру.
 * Доступность: role="dialog", фокус переносится внутрь (элемент с data-autofocus или первая кнопка),
 * Tab не выходит за пределы окна, Esc и клик по фону закрывают, фокус возвращается на кнопку-источник.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  icon,
  tone = "primary",
  children,
  footer,
  dismissible = true,
  showClose = false,
  size = "sm",
  className,
}: DialogProps) {
  const isClient = useIsClient();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);

  useEffect(() => {
    onCloseRef.current = onClose;
    dismissibleRef.current = dismissible;
  });

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const previous = document.activeElement as HTMLElement | null;

    // Фокус внутрь окна.
    const target =
      panel?.querySelector<HTMLElement>("[data-autofocus]") ??
      panel?.querySelector<HTMLElement>(FOCUSABLE) ??
      panel;
    target?.focus({ preventScroll: true });

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (dismissibleRef.current) {
          e.stopPropagation();
          onCloseRef.current();
        }
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open || !isClient) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-scrim animate-fade-in sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && dismissible) onClose();
      }}
      // События из портала всплывают по дереву React к предкам кнопки — гасим.
      onClick={(e) => e.stopPropagation()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col overflow-y-auto bg-surface shadow-pop outline-none",
          "rounded-t-3xl px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-sheet-up",
          "sm:rounded-2xl sm:p-6 sm:animate-pop-in",
          size === "sm" ? "sm:max-w-md" : size === "md" ? "sm:max-w-lg" : "sm:max-w-2xl",
          className,
        )}
      >
        {/* «Ручка» нижнего листа */}
        <div aria-hidden className="mx-auto mb-4 h-1.5 w-10 shrink-0 rounded-full bg-border-strong sm:hidden" />

        {showClose && dismissible ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="absolute top-3 right-3 inline-flex size-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:ring-4 focus-visible:ring-ring focus-visible:outline-none"
          >
            <X className="size-5" />
          </button>
        ) : null}

        {icon ? (
          <div
            className={cn(
              "mb-3 inline-flex size-12 shrink-0 items-center justify-center rounded-full [&_svg]:size-6",
              toneIcon[tone],
            )}
          >
            {icon}
          </div>
        ) : null}

        <h2 id={titleId} className="pr-8 text-lg leading-snug font-semibold tracking-tight text-text">
          {title}
        </h2>
        {description ? (
          <div id={descId} className="mt-1.5 text-[15px] leading-relaxed text-muted">
            {description}
          </div>
        ) : null}

        {children ? <div className="mt-4">{children}</div> : null}

        {footer ? (
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end [&>*]:w-full sm:[&>*]:w-auto">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
