import type { Role } from "@/db/schema";
import { NavLinks } from "@/components/nav-link";

export { navItemsForRole, type NavItem } from "@/components/nav-items";

/**
 * Навигация роли.
 *  - variant="pills" — горизонтальные пилюли в шапке (компьютер);
 *  - variant="tabs" — нижняя панель вкладок (телефон, < md). Если пункт один (исполнитель) — не рисуется.
 */
export function RoleNav({ role, variant = "pills" }: { role: Role; variant?: "pills" | "tabs" }) {
  if (variant === "tabs") {
    return (
      <nav
        aria-label="Разделы"
        className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-safe shadow-bar backdrop-blur-md md:hidden"
      >
        <div className="mx-auto flex h-(--tabbar-h) max-w-lg items-stretch gap-1 px-2 py-1.5">
          <NavLinks role={role} variant="tab" />
        </div>
      </nav>
    );
  }
  return <NavLinks role={role} variant="pill" />;
}
