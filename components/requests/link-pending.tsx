"use client";

import { useLinkStatus } from "next/link";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Подсказка «Открываем…» поверх карточки-ссылки, пока идёт переход (медленная сеть).
 * Класть внутрь <Link className="relative …">. Всегда в разметке — меняется только прозрачность.
 */
export function LinkPending({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 flex items-center justify-center gap-2 rounded-[inherit] bg-surface/75 text-sm font-medium text-primary backdrop-blur-[1px] transition-opacity duration-150",
        pending ? "opacity-100" : "opacity-0",
        className,
      )}
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
      Открываем…
    </span>
  );
}
