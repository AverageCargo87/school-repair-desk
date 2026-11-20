"use client";

/* eslint-disable @next/next/no-img-element -- фото отдаёт /photos/[id] с проверкой доступа по cookie */

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";

export type PhotoGridItem = {
  id: string;
  /** /photos/<id> (есть в PhotoRef.url). */
  url: string;
  fileName?: string;
};

/**
 * Сетка миниатюр; по нажатию — просмотр крупно (лайтбокс с листанием, Esc — закрыть).
 * Принимает PhotoRef[] из getRequestDetail (нужны id и url).
 */
export function PhotoGrid({
  photos,
  size = "md",
  className,
}: {
  photos: PhotoGridItem[];
  /** sm — мелкие миниатюры (лента событий), md — обычные. */
  size?: "sm" | "md";
  className?: string;
}) {
  const [open, setOpen] = useState<number | null>(null);

  const close = useCallback(() => setOpen(null), []);
  const step = useCallback(
    (d: number) =>
      setOpen((i) => (i === null ? null : (i + d + photos.length) % photos.length)),
    [photos.length],
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close, step]);

  if (photos.length === 0) return null;
  const current = open === null ? null : photos[open];

  return (
    <>
      <div
        className={cn(
          "grid gap-2",
          size === "sm" ? "max-w-md grid-cols-4 sm:grid-cols-5" : "grid-cols-3 sm:grid-cols-4",
          className,
        )}
      >
        {photos.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpen(i)}
            className={cn(
              "group relative aspect-square overflow-hidden border border-border bg-surface-2 transition-[box-shadow,transform] duration-150 active:scale-[.98]",
              "focus-visible:ring-4 focus-visible:ring-ring focus-visible:outline-none",
              size === "sm" ? "rounded-lg" : "rounded-xl",
            )}
            aria-label={`Открыть фото ${i + 1} из ${photos.length}`}
          >
            <img
              src={p.url}
              alt={p.fileName ?? ""}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
            />
          </button>
        ))}
      </div>

      {current ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Просмотр фото"
          className="fixed inset-0 z-[60] flex animate-fade-in flex-col bg-black/92 pt-safe pb-safe backdrop-blur-sm"
          onClick={close}
        >
          <div className="flex items-center justify-between gap-2 px-2 py-2 text-sm text-white/85">
            <span className="rounded-full bg-white/10 px-3 py-1.5 font-medium tabular-nums">
              {open! + 1} из {photos.length}
            </span>
            <div className="flex items-center gap-1">
              <a
                href={current.url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex min-h-11 items-center gap-2 rounded-full px-3.5 font-medium transition-colors hover:bg-white/10"
              >
                <ExternalLink aria-hidden className="size-4" />
                <span className="max-sm:sr-only">Открыть отдельно</span>
              </a>
              <button
                type="button"
                onClick={close}
                aria-label="Закрыть"
                className="flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <X aria-hidden className="size-6" />
              </button>
            </div>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4">
            <img
              key={current.id}
              src={current.url}
              alt={current.fileName ?? ""}
              className="max-h-full max-w-full animate-fade-in rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            {photos.length > 1 ? (
              <>
                <button
                  type="button"
                  aria-label="Предыдущее фото"
                  onClick={(e) => {
                    e.stopPropagation();
                    step(-1);
                  }}
                  className="absolute top-1/2 left-3 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur transition-colors hover:bg-white/25"
                >
                  <ChevronLeft aria-hidden className="size-6" />
                </button>
                <button
                  type="button"
                  aria-label="Следующее фото"
                  onClick={(e) => {
                    e.stopPropagation();
                    step(1);
                  }}
                  className="absolute top-1/2 right-3 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur transition-colors hover:bg-white/25"
                >
                  <ChevronRight aria-hidden className="size-6" />
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
