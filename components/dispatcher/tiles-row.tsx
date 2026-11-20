"use client";

import { useEffect, useRef } from "react";

/**
 * Ряд плиток-счётчиков: на телефоне — одна строка с горизонтальной прокруткой
 * (страница при этом не скроллится вбок), на компьютере — сетка в 5 колонок.
 * Если выбрана плитка не по умолчанию (`revealKey` задан), прокручиваем ряд так, чтобы она была видна.
 */
export function TilesRow({
  label,
  revealKey,
  children,
}: {
  label: string;
  /** Ключ выбранной плитки; undefined — ничего не прокручивать (выбрано «по умолчанию»). */
  revealKey?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const row = ref.current;
    if (!row || !revealKey || row.scrollWidth <= row.clientWidth) return;
    const active = row.querySelector<HTMLElement>('[aria-current="page"]');
    if (!active) return;
    const r = row.getBoundingClientRect();
    const t = active.getBoundingClientRect();
    if (t.left < r.left || t.right > r.right) row.scrollLeft += t.left - r.left - 16;
  }, [revealKey]);

  return (
    <nav
      ref={ref}
      aria-label={label}
      className="scrollbar-none -mx-4 grid snap-x snap-mandatory scroll-px-4 auto-cols-[minmax(9.25rem,1fr)] grid-flow-col gap-3 -my-1 overflow-x-auto px-4 py-1 md:mx-0 md:my-0 md:py-0 md:snap-none md:grid-flow-row md:grid-cols-5 md:overflow-visible md:px-0 [&>*]:snap-start"
    >
      {children}
    </nav>
  );
}
