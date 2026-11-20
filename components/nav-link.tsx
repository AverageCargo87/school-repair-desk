"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/db/schema";
import { cn } from "@/lib/utils";
import { isNavItemActive, navItemsForRole, sectionTitle } from "./nav-items";

/**
 * Ссылка навигации. variant:
 *  - pill — пилюля в шапке компьютера;
 *  - tab — вкладка нижней панели телефона (иконка + подпись); accent — кружок бренда.
 */
export function NavLink({
  href,
  exact,
  match,
  icon,
  accent,
  variant = "pill",
  children,
}: {
  href: string;
  exact?: boolean;
  match?: string[];
  icon?: React.ReactNode;
  accent?: boolean;
  variant?: "pill" | "tab";
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = isNavItemActive({ href, exact, match }, pathname);

  if (variant === "tab") {
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] leading-tight font-medium transition-colors select-none",
          "focus-visible:ring-4 focus-visible:ring-ring focus-visible:outline-none",
          active ? "text-primary" : "text-muted active:text-text",
        )}
      >
        {accent ? (
          <span
            aria-hidden
            className={cn(
              "inline-flex size-9 items-center justify-center rounded-full bg-primary text-primary-fg shadow-brand transition-transform group-active:scale-95 [&_svg]:size-5",
              active && "ring-4 ring-primary-soft",
            )}
          >
            {icon}
          </span>
        ) : (
          <span
            aria-hidden
            className={cn(
              "inline-flex h-8 w-14 items-center justify-center rounded-full transition-colors [&_svg]:size-[22px]",
              active ? "bg-primary-soft" : "group-active:bg-surface-2",
            )}
          >
            {icon}
          </span>
        )}
        <span className="max-w-full truncate px-0.5">{children}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition-colors",
        "focus-visible:ring-4 focus-visible:ring-ring focus-visible:outline-none [&_svg]:size-[18px]",
        active
          ? "bg-primary-soft text-primary-soft-fg"
          : "text-muted hover:bg-surface-2 hover:text-text",
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

/** Все пункты навигации роли (шапка компьютера или нижняя панель телефона). */
export function NavLinks({ role, variant }: { role: Role; variant: "pill" | "tab" }) {
  return (
    <>
      {navItemsForRole(role).map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.href}
            href={item.href}
            exact={item.exact}
            match={item.match}
            accent={variant === "tab" && item.accent}
            variant={variant}
            icon={<Icon strokeWidth={variant === "tab" && item.accent ? 2.5 : 2} />}
          >
            {item.label}
          </NavLink>
        );
      })}
    </>
  );
}

/** Название текущего раздела (верхняя панель телефона) — по адресу страницы. */
export function CurrentSectionTitle({ role }: { role: Role }) {
  const pathname = usePathname();
  return <>{sectionTitle(pathname, role)}</>;
}
