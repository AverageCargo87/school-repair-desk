"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, KeyRound, Link2, MapPin, Search, SearchX, Wrench, X } from "lucide-react";
import type { Role } from "@/db/schema";
import { cn, pluralRu } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/ui/chip";
import { fieldClasses } from "@/components/ui/input";
import { EmptyState } from "@/components/requests/empty-state";
import { LinkPending } from "@/components/requests/link-pending";
import { RoleBadge, rolePluralLabels } from "./role-badge";
import { DIRECTORY_FILTERS, type DirectoryFilter } from "./users-filter";

export type DirectoryUser = {
  id: number;
  fullName: string;
  login: string;
  role: Role;
  active: boolean;
  hasPassword: boolean;
  hasLink: boolean;
  isSelf: boolean;
  buildings: { id: number; address: string; active: boolean }[];
  activeWork: number;
};

function filterLabel(f: DirectoryFilter): string {
  if (f === "all") return "Все";
  if (f === "inactive") return "Отключённые";
  return rolePluralLabels[f];
}

function matchesFilter(u: DirectoryUser, f: DirectoryFilter): boolean {
  if (f === "all") return true;
  if (f === "inactive") return !u.active;
  return u.role === f && u.active;
}

function matchesQuery(u: DirectoryUser, q: string): boolean {
  if (!q) return true;
  const s = q.toLowerCase().replace(/ё/g, "е");
  return (
    u.fullName.toLowerCase().replace(/ё/g, "е").includes(s) ||
    u.login.includes(s) ||
    u.buildings.some((b) => b.address.toLowerCase().replace(/ё/g, "е").includes(s))
  );
}

/** Здания заявителя / загрузка исполнителя / «все заявки» — одна строка-сводка. */
function WorkSummary({ u, compact }: { u: DirectoryUser; compact?: boolean }) {
  if (u.role === "requester") {
    if (!u.buildings.length) {
      return <span className="text-danger">Здания не закреплены</span>;
    }
    return (
      <span className="flex min-w-0 items-start gap-1.5">
        <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-subtle" />
        <span className={cn("min-w-0", compact ? "line-clamp-2" : "line-clamp-3")}>
          {u.buildings.map((b) => b.address).join("; ")}
        </span>
      </span>
    );
  }
  if (u.role === "executor") {
    return u.activeWork > 0 ? (
      <span className="flex items-center gap-1.5">
        <Wrench aria-hidden className="size-4 shrink-0 text-subtle" />В работе {u.activeWork}{" "}
        {pluralRu(u.activeWork, ["заявка", "заявки", "заявок"])}
      </span>
    ) : (
      <span className="text-subtle">Свободен</span>
    );
  }
  return <span className="text-subtle">Видит все заявки</span>;
}

/** Есть ли пароль и личная ссылка. Нет пароля — оранжевая метка, иначе спокойный серый текст. */
function AccessMarks({ u }: { u: DirectoryUser }) {
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
      {u.hasPassword ? (
        <span className="inline-flex items-center gap-1">
          <KeyRound aria-hidden className="size-3.5 text-subtle" />
          пароль
        </span>
      ) : (
        <Badge size="sm" variant="warning" icon={<KeyRound />}>
          без пароля
        </Badge>
      )}
      {u.hasLink ? (
        <span className="inline-flex items-center gap-1">
          <Link2 aria-hidden className="size-3.5 text-subtle" />
          ссылка
        </span>
      ) : null}
    </span>
  );
}

function NameBlock({ u }: { u: DirectoryUser }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar name={u.fullName} size="lg" className={u.active ? undefined : "opacity-50 grayscale"} />
      <span className="min-w-0">
        <span
          className={cn(
            "block text-[15px] leading-snug font-medium wrap-anywhere",
            u.active ? "text-text" : "text-muted",
          )}
        >
          {u.fullName}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
          <span className="font-mono">{u.login}</span>
          {u.isSelf ? <Badge size="sm">Это вы</Badge> : null}
          {!u.active ? <Badge size="sm">Отключён</Badge> : null}
        </span>
      </span>
    </span>
  );
}

/**
 * Список сотрудников: поиск, чипы-фильтры по ролям. На компьютере — таблица,
 * на телефоне — карточки. Фильтр и поиск сохраняются в адресе (?role=…&q=…).
 */
export function UsersDirectory({
  users,
  initialFilter,
  initialQuery,
}: {
  users: DirectoryUser[];
  initialFilter: DirectoryFilter;
  initialQuery: string;
}) {
  const [filter, setFilter] = useState<DirectoryFilter>(initialFilter);
  const [query, setQuery] = useState(initialQuery);
  const q = query.trim();

  function syncUrl(nextFilter: DirectoryFilter, nextQuery: string) {
    const params = new URLSearchParams();
    if (nextFilter !== "all") params.set("role", nextFilter);
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }

  function changeFilter(f: DirectoryFilter) {
    setFilter(f);
    syncUrl(f, query);
  }

  function changeQuery(v: string) {
    setQuery(v);
    syncUrl(filter, v);
  }

  const searched = users.filter((u) => matchesQuery(u, q));
  const rows = searched.filter((u) => matchesFilter(u, filter));

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-subtle"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => changeQuery(e.target.value)}
          placeholder="Поиск: фамилия, логин или адрес"
          aria-label="Поиск сотрудника"
          autoComplete="off"
          enterKeyHint="search"
          className={cn(fieldClasses, "h-12 pr-12 pl-11 [&::-webkit-search-cancel-button]:hidden")}
        />
        {query ? (
          <button
            type="button"
            onClick={() => changeQuery("")}
            aria-label="Очистить поиск"
            className="absolute top-1/2 right-1 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:ring-4 focus-visible:ring-ring focus-visible:outline-none"
          >
            <X className="size-[18px]" />
          </button>
        ) : null}
      </div>

      <div
        role="group"
        aria-label="Фильтр по ролям"
        className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
      >
        {DIRECTORY_FILTERS.map((f) => {
          const count = searched.filter((u) => matchesFilter(u, f)).length;
          if (f === "inactive" && count === 0 && filter !== "inactive") return null;
          return (
            <Chip
              key={f}
              active={filter === f}
              count={count}
              onClick={() => changeFilter(f)}
              className="min-h-11"
            >
              {filterLabel(f)}
            </Chip>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<SearchX />}
          tone="neutral"
          title={q ? "Никого не нашли" : "В этой группе никого нет"}
          description={
            q
              ? "Проверьте, как написана фамилия, или поищите по логину."
              : filter === "inactive"
                ? "Отключённых сотрудников нет."
                : "Добавьте сотрудника кнопкой «Добавить сотрудника»."
          }
        />
      ) : (
        <>
          {/* Компьютер: таблица */}
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-surface shadow-card md:block">
            <div
              aria-hidden
              className="grid grid-cols-[minmax(0,2.3fr)_minmax(0,1.1fr)_minmax(0,2.2fr)_minmax(0,1.2fr)_1.5rem] gap-4 border-b border-border bg-surface-2/60 px-5 py-2.5 text-xs font-medium text-muted"
            >
              <span>Сотрудник</span>
              <span>Роль</span>
              <span>Здания и работа</span>
              <span>Вход</span>
              <span />
            </div>
            <ul className="divide-y divide-border">
              {rows.map((u) => (
                <li key={u.id}>
                  <Link
                    href={`/admin/users/${u.id}`}
                    className={cn(
                      "group relative grid grid-cols-[minmax(0,2.3fr)_minmax(0,1.1fr)_minmax(0,2.2fr)_minmax(0,1.2fr)_1.5rem] items-center gap-4 px-5 py-3 transition-colors hover:bg-surface-2/70 focus-visible:bg-surface-2 focus-visible:outline-none",
                      !u.active && "bg-surface-2/40",
                    )}
                  >
                    <NameBlock u={u} />
                    <span>
                      <RoleBadge role={u.role} />
                    </span>
                    <span className="min-w-0 text-sm text-text">
                      <WorkSummary u={u} />
                    </span>
                    <AccessMarks u={u} />
                    <ChevronRight
                      aria-hidden
                      className="size-5 text-subtle transition-transform group-hover:translate-x-0.5"
                    />
                    <LinkPending className="rounded-none" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Телефон: карточки */}
          <ul className="flex flex-col gap-3 md:hidden">
            {rows.map((u) => (
              <li key={u.id}>
                <Link
                  href={`/admin/users/${u.id}`}
                  className={cn(
                    "relative flex flex-col gap-2.5 rounded-2xl border border-border p-4 shadow-card transition-[background-color,box-shadow] active:scale-[.99] focus-visible:ring-4 focus-visible:ring-ring focus-visible:outline-none",
                    u.active ? "bg-surface" : "bg-surface-2",
                  )}
                >
                  <span className="flex items-start gap-2">
                    <span className="min-w-0 flex-1">
                      <NameBlock u={u} />
                    </span>
                    <ChevronRight aria-hidden className="mt-2.5 size-5 shrink-0 text-subtle" />
                  </span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <RoleBadge role={u.role} />
                    <AccessMarks u={u} />
                  </span>
                  <span className="border-t border-border pt-2.5 text-sm text-muted">
                    <WorkSummary u={u} compact />
                  </span>
                  <LinkPending />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
