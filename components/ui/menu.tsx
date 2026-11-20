"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Ctx = { close: () => void };
const MenuContext = createContext<Ctx>({ close: () => {} });

/** Закрыть ближайшее меню/поповер изнутри (например, после действия). */
export function useCloseMenu(): () => void {
  return useContext(MenuContext).close;
}

type PopoverBaseProps = {
  /** Содержимое кнопки-триггера (аватар, иконка, текст). */
  trigger: React.ReactNode;
  /** Подпись для экранного диктора: «Меню пользователя». */
  label: string;
  /** Край, по которому выравнивается панель: start — левый, end — правый. */
  align?: "start" | "end";
  /** Классы кнопки-триггера. */
  triggerClassName?: string;
  /** Классы панели. */
  className?: string;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
};

function usePopover() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return { open, setOpen, close, rootRef, triggerRef };
}

function Panel({
  id,
  role,
  align,
  className,
  children,
  panelRef,
  onKeyDown,
  labelledBy,
}: {
  id: string;
  role?: "menu" | "dialog";
  align: "start" | "end";
  className?: string;
  children: React.ReactNode;
  panelRef?: React.Ref<HTMLDivElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  labelledBy: string;
}) {
  return (
    <div
      id={id}
      ref={panelRef}
      role={role}
      aria-labelledby={labelledBy}
      onKeyDown={onKeyDown}
      className={cn(
        "absolute top-full z-50 mt-2 min-w-60 origin-top rounded-2xl border border-border bg-surface p-1.5 shadow-pop animate-pop-in",
        align === "end" ? "right-0" : "left-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Выпадающая панель с произвольным содержимым (фильтры, подсказка).
 *   <Popover label="Фильтры" trigger={<SlidersHorizontal />}>…</Popover>
 */
export function Popover({
  trigger,
  label,
  align = "end",
  triggerClassName,
  className,
  children,
}: PopoverBaseProps) {
  const { open, setOpen, close, rootRef, triggerRef } = usePopover();
  const id = useId();
  return (
    <MenuContext.Provider value={{ close }}>
      <div ref={rootRef} className="relative">
        <button
          ref={triggerRef}
          id={`${id}-t`}
          type="button"
          aria-label={label}
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          onClick={() => setOpen((v) => !v)}
          className={triggerClassName}
        >
          {trigger}
        </button>
        {open ? (
          <Panel id={id} role="dialog" align={align} className={className} labelledBy={`${id}-t`}>
            {typeof children === "function" ? children(close) : children}
          </Panel>
        ) : null}
      </div>
    </MenuContext.Provider>
  );
}

/**
 * Меню действий (аватар-меню и т. п.). Пункты — MenuItem; шапка — MenuHeader; линия — MenuSeparator.
 * Стрелки ↑/↓ переходят по пунктам, Esc закрывает, клик мимо — тоже.
 *
 *   <Menu label="Меню пользователя" trigger={<Avatar name={user.fullName} />}
 *         triggerClassName="rounded-full …">
 *     <MenuHeader title={user.fullName} subtitle="Распределитель" />
 *     <MenuSeparator />
 *     <MenuItem icon={<LogOut />} tone="danger" onSelect={() => setConfirm(true)}>Выйти</MenuItem>
 *   </Menu>
 */
export function Menu({
  trigger,
  label,
  align = "end",
  triggerClassName,
  className,
  children,
}: PopoverBaseProps) {
  const { open, setOpen, close, rootRef, triggerRef } = usePopover();
  const panelRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (open) menuItems(panelRef.current)[0]?.focus({ preventScroll: true });
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const list = menuItems(panelRef.current);
    if (list.length === 0) return;
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      list[(i + 1) % list.length].focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      list[(i - 1 + list.length) % list.length].focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      list[0].focus();
    } else if (e.key === "End") {
      e.preventDefault();
      list[list.length - 1].focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <MenuContext.Provider value={{ close }}>
      <div ref={rootRef} className="relative">
        <button
          ref={triggerRef}
          id={`${id}-t`}
          type="button"
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          onClick={() => setOpen((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && !open) {
              e.preventDefault();
              setOpen(true);
            }
          }}
          className={triggerClassName}
        >
          {trigger}
        </button>
        {open ? (
          <Panel
            id={id}
            role="menu"
            align={align}
            className={className}
            panelRef={panelRef}
            onKeyDown={onKeyDown}
            labelledBy={`${id}-t`}
          >
            {typeof children === "function" ? children(close) : children}
          </Panel>
        ) : null}
      </div>
    </MenuContext.Provider>
  );
}

function menuItems(panel: HTMLElement | null): HTMLElement[] {
  return Array.from(
    panel?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [],
  );
}

const itemClasses =
  "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-medium transition-colors outline-none " +
  "focus-visible:bg-surface-2 [&_svg]:size-[18px] [&_svg]:shrink-0";

/** Пункт меню: кнопка (onSelect) или ссылка (href). Меню закрывается само. */
export function MenuItem({
  icon,
  href,
  onSelect,
  tone = "default",
  disabled,
  children,
}: {
  icon?: React.ReactNode;
  href?: string;
  onSelect?: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const { close } = useContext(MenuContext);
  const cls = cn(
    itemClasses,
    tone === "danger" ? "text-danger hover:bg-danger-bg focus-visible:bg-danger-bg" : "text-text hover:bg-surface-2",
    disabled && "pointer-events-none opacity-50",
  );
  const iconEl = icon ? (
    <span aria-hidden className={cn("inline-flex", tone === "danger" ? "text-danger" : "text-muted")}>
      {icon}
    </span>
  ) : null;
  if (href) {
    return (
      <Link href={href} role="menuitem" aria-disabled={disabled || undefined} className={cls} onClick={close}>
        {iconEl}
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      role="menuitem"
      aria-disabled={disabled || undefined}
      className={cls}
      onClick={() => {
        close();
        onSelect?.();
      }}
    >
      {iconEl}
      {children}
    </button>
  );
}

/** Шапка меню (не нажимается): например, аватар + ФИО + роль. */
export function MenuHeader({
  title,
  subtitle,
  leading,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  leading?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-3 pt-2 pb-2.5">
      {leading}
      <div className="min-w-0">
        <div className="truncate text-[15px] font-semibold text-text">{title}</div>
        {subtitle ? <div className="truncate text-sm text-muted">{subtitle}</div> : null}
      </div>
    </div>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="-mx-1.5 my-1.5 h-px bg-border" />;
}
