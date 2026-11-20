"use client";

import { cn } from "@/lib/utils";

/** Переключатель (вкл/выкл). Нажимаемую область ≥ 44px дайте обёрткой-<label> со строкой текста. */
export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200",
        "focus-visible:ring-4 focus-visible:ring-ring focus-visible:outline-none",
        checked ? "bg-primary" : "bg-border-strong",
        disabled && "opacity-50",
      )}
    >
      <span
        className={cn(
          "inline-block size-5.5 transform rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.25)] transition-transform duration-200",
          checked ? "translate-x-[23px]" : "translate-x-[3px]",
        )}
      />
    </button>
  );
}
