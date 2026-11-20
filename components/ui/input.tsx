import { cn } from "@/lib/utils";

/** Общие классы полей ввода: 48px, rounded-xl, мягкое кольцо фокуса, красная рамка при aria-invalid. */
export const fieldClasses =
  "w-full rounded-xl border border-border-strong bg-surface text-base text-text shadow-card " +
  "placeholder:text-subtle transition-[border-color,box-shadow] duration-150 " +
  "hover:border-subtle focus:border-primary focus:ring-4 focus:ring-ring focus:outline-none focus-visible:outline-none " +
  "aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/20 " +
  "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-70";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClasses, "h-12 px-3.5", className)} {...props} />;
}
