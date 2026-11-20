"use client";

import { useMemo, useState } from "react";
import { Check, KeyRound, ListChecks, SearchX } from "lucide-react";
import type { Role } from "@/db/schema";
import { issueAccessAction } from "@/app/admin/actions";
import type { AdminResult } from "@/app/admin/types";
import { pluralRu } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SectionCard } from "@/components/ui/section-card";
import { StickyActions } from "@/components/ui/sticky-actions";
import { EmptyState } from "@/components/requests/empty-state";
import { FormError } from "@/components/requests/form-bits";
import { AccessResult } from "./access-cards";
import { ROLE_ORDER, RoleBadge, rolePluralLabels } from "./role-badge";
import { useAdminAction } from "./use-admin-action";

export type AccessPerson = {
  id: number;
  fullName: string;
  login: string;
  role: Role;
  hasPassword: boolean;
  hasLink: boolean;
  /** Это текущий администратор (по умолчанию не отмечен). */
  isSelf: boolean;
};

type Filter = Role | "all";

/** Строка-флажок сотрудника. Отмеченная — с рамкой и фоном бренда (как OptionCard). */
function PersonRow({
  person,
  checked,
  onToggle,
}: {
  person: AccessPerson;
  checked: boolean;
  onToggle: (on: boolean) => void;
}) {
  return (
    <label className="group flex min-h-16 min-w-0 cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 transition-[border-color,background-color] duration-150 select-none hover:border-border-strong has-checked:border-primary has-checked:bg-primary-soft/60 has-focus-visible:ring-4 has-focus-visible:ring-ring">
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onToggle(e.target.checked)}
      />
      <span
        aria-hidden
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-md border-2 border-border-strong text-surface transition-colors group-has-checked:border-primary group-has-checked:bg-primary"
      >
        <Check className="size-3.5 opacity-0 group-has-checked:opacity-100" strokeWidth={3.5} />
      </span>
      <Avatar name={person.fullName} size="lg" />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[15px] leading-snug font-medium wrap-anywhere text-text">
          {person.fullName}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
          <span className="font-mono text-text">{person.login}</span>
          <RoleBadge role={person.role} size="sm" />
          {person.isSelf ? <Badge size="sm">Это вы</Badge> : null}
          {!person.hasPassword ? (
            <Badge size="sm" variant="warning">
              без пароля
            </Badge>
          ) : null}
        </span>
      </span>
    </label>
  );
}

/**
 * «Доступы»: выбрать сотрудников (по умолчанию — все активные, кроме себя), фильтр по ролям,
 * «Выдать доступы (N)» → подтверждение → лист карточек для печати.
 */
export function AccessIssuer({ people }: { people: AccessPerson[] }) {
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(people.filter((p) => !p.isSelf).map((p) => p.id)),
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Какой результат уже убрали с экрана («Выдать ещё»).
  const [dismissed, setDismissed] = useState<AdminResult | null>(null);
  const { state, pending, formRef, onSubmit } = useAdminAction(issueAccessAction, {
    onSuccess: () => window.scrollTo({ top: 0, behavior: "smooth" }),
  });

  const roles = ROLE_ORDER.filter((r) => people.some((p) => p.role === r));
  const visible = filter === "all" ? people : people.filter((p) => p.role === filter);
  const allVisibleChecked = visible.length > 0 && visible.every((p) => selected.has(p.id));
  const chosen = useMemo(() => people.filter((p) => selected.has(p.id)), [people, selected]);
  const selfChosen = chosen.some((p) => p.isSelf);

  function toggle(id: number, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of visible) {
        if (allVisibleChecked) next.delete(p.id);
        else next.add(p.id);
      }
      return next;
    });
  }

  if (state.ok && state.cards?.length && state !== dismissed) {
    return (
      <AccessResult
        cards={state.cards}
        siteUrl={state.siteUrl ?? ""}
        issuedAt={state.issuedAt}
        failed={state.failed}
        message={state.message}
        onDone={() => setDismissed(state)}
        doneLabel="Выдать ещё"
      />
    );
  }

  if (people.length === 0) {
    return (
      <EmptyState
        icon={<SearchX />}
        tone="neutral"
        title="Нет активных сотрудников"
        description="Добавьте сотрудников или включите отключённых — потом выдайте им доступы."
      />
    );
  }

  const n = chosen.length;
  const breakdown = ROLE_ORDER.map((r) => ({
    role: r,
    count: chosen.filter((p) => p.role === r).length,
  })).filter((x) => x.count > 0);

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4">
      {chosen.map((p) => (
        <input key={p.id} type="hidden" name="userIds" value={p.id} />
      ))}

      <SectionCard
        title="Кому выдать"
        description={`Отмечено ${n} из ${people.length}`}
        icon={<ListChecks />}
        actions={
          <Button type="button" variant="ghost" size="sm" onClick={toggleVisible}>
            {allVisibleChecked ? "Снять все" : "Отметить всех"}
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <div
            role="group"
            aria-label="Фильтр по ролям"
            className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
          >
            <Chip active={filter === "all"} count={people.length} onClick={() => setFilter("all")}>
              Все
            </Chip>
            {roles.map((r) => (
              <Chip
                key={r}
                active={filter === r}
                count={people.filter((p) => p.role === r).length}
                onClick={() => setFilter(r)}
              >
                {rolePluralLabels[r]}
              </Chip>
            ))}
          </div>

          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {visible.map((p) => (
              <li key={p.id} className="min-w-0">
                <PersonRow person={p} checked={selected.has(p.id)} onToggle={(on) => toggle(p.id, on)} />
              </li>
            ))}
          </ul>
        </div>
      </SectionCard>

      <FormError result={state} />

      <StickyActions>
        <Button
          type="button"
          size="lg"
          icon={<KeyRound />}
          loading={pending}
          disabled={n === 0}
          onClick={() => setConfirmOpen(true)}
          className="w-full sm:w-auto"
        >
          {pending ? "Выдаём…" : `Выдать доступы (${n})`}
        </Button>
        <span className="hidden text-sm text-muted md:inline">
          {n === 0
            ? "Отметьте, кому выдать доступ."
            : `Будут созданы ${n} ${pluralRu(n, ["карточка", "карточки", "карточек"])} для печати.`}
        </span>
      </StickyActions>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        tone="primary"
        icon={<KeyRound />}
        title={`Выдать доступы: ${n} ${pluralRu(n, ["сотрудник", "сотрудника", "сотрудников"])}?`}
        description="Для выбранных будут созданы новые пароли и ссылки, старые перестанут работать. Уже вошедшие на телефоне останутся в системе."
        confirmText="Да, выдать"
        onConfirm={() => {
          formRef.current?.requestSubmit();
        }}
      >
        <div className="flex flex-col gap-3">
          <ul className="flex flex-wrap gap-2">
            {breakdown.map((b) => (
              <li key={b.role}>
                <Badge variant="outline" size="lg">
                  {rolePluralLabels[b.role]}: {b.count}
                </Badge>
              </li>
            ))}
          </ul>
          {selfChosen ? (
            <Alert tone="warning">Ваш пароль тоже сменится — новый будет на вашей карточке.</Alert>
          ) : null}
        </div>
      </ConfirmDialog>
    </form>
  );
}
