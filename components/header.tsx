import Link from "next/link";
import { CurrentSectionTitle } from "@/components/nav-link";
import { RoleNav } from "@/components/role-nav";
import { UserMenu } from "@/components/user-menu";
import { LogoMark } from "@/components/ui/logo";
import { homeForRole } from "@/lib/roles";
import type { SessionUser } from "@/lib/auth";

/**
 * Шапка.
 * Телефон (< md): компактная панель 56px — знак-логотип + название текущего раздела, справа аватар-меню.
 * Компьютер (≥ md): логотип «Заявки · Школа», навигация пилюлями, справа аватар-меню.
 */
export function Header({ user }: { user: SessionUser }) {
  return (
    <header className="no-print sticky top-0 z-40 border-b border-border bg-surface/90 pt-safe backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 md:h-16 md:px-6">
        <Link
          href={homeForRole(user.role)}
          aria-label="Заявки · Школа — на главную"
          className="-m-1 inline-flex shrink-0 items-center gap-2.5 rounded-xl p-1 focus-visible:ring-4 focus-visible:ring-ring focus-visible:outline-none"
        >
          <LogoMark />
          <span className="hidden text-[15px] leading-tight font-semibold tracking-tight text-text md:inline">
            Заявки <span className="font-normal text-muted">· Школа</span>
          </span>
        </Link>

        <div className="min-w-0 flex-1 truncate text-[17px] font-semibold tracking-tight text-text md:hidden">
          <CurrentSectionTitle role={user.role} />
        </div>

        <nav aria-label="Разделы" className="ml-4 hidden min-w-0 flex-1 items-center gap-1 md:flex">
          <RoleNav role={user.role} variant="pills" />
        </nav>

        <div className="shrink-0">
          <UserMenu fullName={user.fullName} role={user.role} />
        </div>
      </div>
    </header>
  );
}
