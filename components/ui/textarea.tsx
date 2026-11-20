import { cn } from "@/lib/utils";
import { fieldClasses } from "./input";

export function Textarea({
  className,
  rows = 4,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      rows={rows}
      className={cn(fieldClasses, "min-h-24 px-3.5 py-3 leading-snug", className)}
      {...props}
    />
  );
}
