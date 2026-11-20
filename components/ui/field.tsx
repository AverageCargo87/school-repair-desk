import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

/**
 * Поле формы: подпись над полем, подсказка и ошибка под ним.
 *   <Field label="Где именно" htmlFor="loc" optional hint="Этаж, кабинет">
 *     <Input id="loc" name="location" />
 *   </Field>
 */
export function Field({
  label,
  htmlFor,
  required,
  optional,
  hint,
  error,
  className,
  children,
}: {
  label?: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  optional?: boolean;
  hint?: React.ReactNode;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <Label htmlFor={htmlFor} required={required} optional={optional}>
          {label}
        </Label>
      ) : null}
      {children}
      {hint && !error ? <p className="text-[13px] leading-snug text-muted">{hint}</p> : null}
      {error ? (
        <p className="flex items-start gap-1.5 text-sm text-danger">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
