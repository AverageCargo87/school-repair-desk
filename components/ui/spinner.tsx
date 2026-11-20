import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Крутилка загрузки (цвет — currentColor). По умолчанию 16px. */
export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <LoaderCircle
      className={cn("size-4 animate-spin", className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "status" : undefined}
    />
  );
}
