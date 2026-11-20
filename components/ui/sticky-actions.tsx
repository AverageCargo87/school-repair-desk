import { cn } from "@/lib/utils";

/**
 * Полоса с основной кнопкой, «прилипшая» к низу экрана на телефоне (над панелью вкладок),
 * на компьютере — обычный блок. Кладите в конец формы:
 *   <StickyActions><SubmitButton pending={pending}>Отправить</SubmitButton></StickyActions>
 * Работает внутри AppShell (он задаёт --shell-bottom и --shell-safe).
 */
export function StickyActions({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-[var(--shell-bottom,0px)] z-20 -mx-4 flex flex-col gap-2 border-t border-border bg-bg/85 px-4 pt-3 pb-[calc(0.75rem+var(--shell-safe,0px))] backdrop-blur-md",
        "md:static md:mx-0 md:flex-row md:items-center md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
