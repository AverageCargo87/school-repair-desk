import { cn } from "@/lib/utils";

/**
 * Карточка: белая поверхность, rounded-2xl, тонкая рамка и мягкая тень.
 * Внутренние отступы задают CardHeader/CardContent (16px на телефоне, 20px на компьютере)
 * или className="p-4 sm:p-5".
 */
export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-2xl border border-border bg-surface shadow-card", className)}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 pt-4 pb-3 sm:px-5 sm:pt-5", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-base font-semibold tracking-tight text-text", className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1 text-sm text-muted", className)} {...props} />;
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 pb-4 sm:px-5 sm:pb-5", className)} {...props} />;
}

/** Нижняя полоса карточки с действиями (на сером фоне, отделена линией). */
export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-b-2xl border-t border-border bg-surface-2/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-5",
        className,
      )}
      {...props}
    />
  );
}
