import { Header } from "@/components/header";
import { navItemsForRole } from "@/components/nav-items";
import { RoleNav } from "@/components/role-nav";
import type { SessionUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

export type ShellWidth = "narrow" | "medium" | "wide";

const widths: Record<ShellWidth, string> = {
  narrow: "max-w-2xl",
  medium: "max-w-3xl",
  wide: "max-w-6xl",
};

/**
 * Каркас страницы: шапка, контейнер контента, на телефоне — нижняя панель вкладок.
 * narrow (max-w-2xl) — рабочие экраны (карточка, мои заявки, задачи, новая заявка);
 * medium (max-w-3xl) — формы пошире; wide (max-w-6xl) — список распределителя, выгрузка, админка.
 *
 * Отступы контента: 16px по бокам на телефоне, 24px на компьютере; сверху 16/32px; снизу —
 * запас под панель вкладок. CSS-переменные для экранов:
 *   --shell-bottom — высота нижней панели (0 на компьютере и у исполнителя): «липкие» кнопки
 *                    ставьте на bottom: var(--shell-bottom) (готово: <StickyActions>);
 *   --shell-safe   — нижняя безопасная зона iPhone, если панели вкладок нет.
 *
 * Пример layout раздела:
 *   const user = await requireRole(["requester"]);
 *   return <AppShell user={user} width="narrow">{children}</AppShell>;
 */
export function AppShell({
  user,
  width = "narrow",
  className,
  children,
}: {
  user: SessionUser;
  width?: ShellWidth;
  /** Доп. классы контейнера <main>. */
  className?: string;
  children: React.ReactNode;
}) {
  const hasTabs = navItemsForRole(user.role).length > 1;
  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col",
        hasTabs
          ? "[--shell-bottom:calc(var(--tabbar-h)+env(safe-area-inset-bottom))] [--shell-safe:0px] md:[--shell-bottom:0px] md:[--shell-safe:env(safe-area-inset-bottom)]"
          : "[--shell-bottom:0px] [--shell-safe:env(safe-area-inset-bottom)]",
      )}
    >
      <Header user={user} />
      <main
        className={cn(
          "shell-main mx-auto w-full flex-1 px-4 pt-4 pb-[calc(var(--shell-bottom)+var(--shell-safe)+2rem)] sm:pt-6 md:px-6 md:pt-8 md:pb-16",
          widths[width],
          className,
        )}
      >
        {children}
      </main>
      {hasTabs ? <RoleNav role={user.role} variant="tabs" /> : null}
    </div>
  );
}
