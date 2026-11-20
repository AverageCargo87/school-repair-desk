import { cn } from "@/lib/utils";

/**
 * Подпись поля (над полем). Обязательное поле: <Label required>…</Label> — красная звёздочка;
 * необязательное: <Label optional>…</Label> — приглушённое «(необязательно)».
 */
export function Label({
  className,
  required,
  optional,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & {
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <label
      className={cn("block text-sm font-medium text-text", className)}
      {...props}
    >
      {children}
      {required ? <span className="text-danger"> *</span> : null}
      {optional ? <span className="font-normal text-muted"> (необязательно)</span> : null}
    </label>
  );
}
