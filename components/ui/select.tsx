import { cn } from "@/lib/utils";
import { fieldClasses } from "./input";

/** Нативный <select> (на телефоне — системный список) в стиле полей; стрелка — из токена --select-chevron. */
export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        fieldClasses,
        "h-12 cursor-pointer appearance-none truncate bg-(image:--select-chevron) bg-size-[18px] bg-position-[right_0.875rem_center] bg-no-repeat pr-10 pl-3.5",
        className,
      )}
      {...props}
    />
  );
}
