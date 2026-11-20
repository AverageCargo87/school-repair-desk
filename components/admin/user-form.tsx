"use client";

import { useRef, useState } from "react";
import { Building2, Check, RefreshCw, UserPlus } from "lucide-react";
import type { Role } from "@/db/schema";
import { saveUserAction, suggestLoginAction } from "@/app/admin/actions";
import type { AdminBuildingRef } from "@/app/admin/types";
import { roleLabels } from "@/lib/labels";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { OptionCard } from "@/components/ui/option-card";
import { Spinner } from "@/components/ui/spinner";
import { FieldError, FormError, FormSuccess, SubmitButton } from "@/components/requests/form-bits";
import { RoleIcon } from "./role-badge";
import { useAdminAction } from "./use-admin-action";

const ROLE_OPTIONS: { role: Role; hint: string }[] = [
  { role: "requester", hint: "Сообщает о поломках в своих зданиях" },
  { role: "executor", hint: "Выполняет заявки, отмечает работу" },
  { role: "dispatcher", hint: "Назначает исполнителей и сроки" },
  { role: "admin", hint: "Как распределитель + сотрудники и здания" },
];

export type UserFormProps = {
  /** Нет — создание нового сотрудника. */
  user?: { id: number; fullName: string; login: string; role: Role; buildingIds: number[] };
  /** Все здания (включая отключённые — показываются, только если уже закреплены). */
  buildings: AdminBuildingRef[];
  /** Редактирует сам себя — роль менять нельзя. */
  isSelf?: boolean;
};

/** Создание / изменение сотрудника: ФИО, логин (автоподбор по фамилии), роль, здания. */
export function UserForm({ user, buildings, isSelf = false }: UserFormProps) {
  const editing = Boolean(user);
  const { state, pending, formRef, onSubmit, fieldError } = useAdminAction(saveUserAction);

  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [login, setLogin] = useState(user?.login ?? "");
  // При создании логин подбирается по ФИО, пока его не поправили руками.
  const [loginManual, setLoginManual] = useState(editing);
  const [suggesting, setSuggesting] = useState(false);
  const [role, setRole] = useState<Role | "">(user?.role ?? "");
  const [selected, setSelected] = useState<Set<number>>(() => new Set(user?.buildingIds ?? []));

  const timer = useRef<number | undefined>(undefined);
  const seq = useRef(0);

  async function suggest(name: string): Promise<string | null> {
    const my = ++seq.current;
    setSuggesting(true);
    try {
      const value = await suggestLoginAction(name, user?.id ?? null);
      return my === seq.current ? value : null;
    } catch {
      return null;
    } finally {
      if (my === seq.current) setSuggesting(false);
    }
  }

  function onNameChange(value: string) {
    setFullName(value);
    if (loginManual) return;
    window.clearTimeout(timer.current);
    if (!value.trim()) {
      seq.current++;
      setLogin("");
      setSuggesting(false);
      return;
    }
    timer.current = window.setTimeout(async () => {
      const next = await suggest(value);
      if (next !== null) setLogin(next);
    }, 400);
  }

  async function pickLoginFromName() {
    if (!fullName.trim()) return;
    const next = await suggest(fullName);
    if (next !== null) {
      setLogin(next);
      setLoginManual(editing);
    }
  }

  function toggleBuilding(id: number, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const visibleBuildings = buildings.filter((b) => b.active || selected.has(b.id));
  const idp = user ? `u${user.id}` : "new";
  // Ошибка уже видна под полем — общую плашку с тем же текстом не дублируем.
  const shownFieldError = ["fullName", "login", "role", "buildingIds"].some((k) => fieldError(k));

  const loginHint = suggesting ? (
    <span className="inline-flex items-center gap-1.5">
      <Spinner className="size-3.5" /> Подбираем логин…
    </span>
  ) : editing ? (
    "Латинские буквы без пробелов. «По ФИО» — подобрать заново по фамилии."
  ) : loginManual ? (
    "Латинские буквы без пробелов. Сотрудник вводит его при входе (или просто фамилию по-русски)."
  ) : (
    "Подставляется по фамилии автоматически — можно поменять."
  );

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-5">
      {user ? <input type="hidden" name="userId" value={user.id} /> : null}

      <Field label="ФИО" htmlFor={`${idp}-fullName`} required error={fieldError("fullName")}>
        <Input
          id={`${idp}-fullName`}
          name="fullName"
          value={fullName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Иванова Мария Петровна"
          autoComplete="off"
          maxLength={120}
          required
          aria-invalid={fieldError("fullName") ? true : undefined}
        />
      </Field>

      <Field label="Логин" htmlFor={`${idp}-login`} hint={loginHint} error={fieldError("login")}>
        <div className="flex gap-2">
          <Input
            id={`${idp}-login`}
            name="login"
            value={login}
            onChange={(e) => {
              setLogin(e.target.value.toLowerCase());
              setLoginManual(true);
            }}
            placeholder={editing ? "" : "подберётся по фамилии"}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={32}
            className="font-mono"
            required={editing}
            aria-invalid={fieldError("login") ? true : undefined}
          />
          {editing ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              icon={<RefreshCw />}
              onClick={pickLoginFromName}
              disabled={suggesting || !fullName.trim()}
              className="shrink-0 px-4"
            >
              По ФИО
            </Button>
          ) : null}
        </div>
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium text-text">
          Роль{isSelf ? null : <span className="text-danger"> *</span>}
        </legend>
        {isSelf ? (
          <>
            <input type="hidden" name="role" value={role} />
            <Alert tone="neutral" icon={role ? <RoleIcon role={role} /> : null}>
              {role ? roleLabels[role] : ""} — свою роль поменять нельзя.
            </Alert>
          </>
        ) : (
          <div role="radiogroup" aria-label="Роль" className="grid gap-2.5 sm:grid-cols-2">
            {ROLE_OPTIONS.map((o) => (
              <OptionCard
                key={o.role}
                name="role"
                value={o.role}
                checked={role === o.role}
                onChange={() => setRole(o.role)}
                required
                icon={<RoleIcon role={o.role} />}
                title={roleLabels[o.role]}
                description={o.hint}
              />
            ))}
          </div>
        )}
        <FieldError message={fieldError("role")} />
      </fieldset>

      {role === "requester" ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-text">
            Здания заявителя<span className="text-danger"> *</span>
          </legend>
          <p className="-mt-1 text-[13px] leading-snug text-muted">
            Заявитель видит все заявки отмеченных зданий и может подавать по ним новые.
          </p>
          {visibleBuildings.length === 0 ? (
            <Alert tone="warning">Зданий пока нет — добавьте их в разделе «Здания».</Alert>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {visibleBuildings.map((b) => (
                <label
                  key={b.id}
                  className="group flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 text-[15px] transition-[border-color,background-color] duration-150 select-none hover:border-border-strong has-checked:border-primary has-checked:bg-primary-soft/60 has-focus-visible:ring-4 has-focus-visible:ring-ring"
                >
                  <input
                    type="checkbox"
                    name="buildingIds"
                    value={b.id}
                    checked={selected.has(b.id)}
                    onChange={(e) => toggleBuilding(b.id, e.target.checked)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden
                    className="inline-flex size-5 shrink-0 items-center justify-center rounded-md border-2 border-border-strong text-surface transition-colors group-has-checked:border-primary group-has-checked:bg-primary"
                  >
                    <Check className="size-3.5 opacity-0 group-has-checked:opacity-100" strokeWidth={3.5} />
                  </span>
                  <Building2 aria-hidden className="size-[18px] shrink-0 text-subtle" />
                  <span className="min-w-0 leading-snug text-text">
                    {b.address}
                    {!b.active ? <span className="text-muted"> (отключено)</span> : null}
                  </span>
                </label>
              ))}
            </div>
          )}
          <FieldError message={fieldError("buildingIds")} />
        </fieldset>
      ) : null}

      {shownFieldError ? null : <FormError result={state} />}
      <FormSuccess result={state} />
      <div>
        <SubmitButton
          pending={pending}
          pendingText="Сохраняем…"
          icon={editing ? <Check /> : <UserPlus />}
        >
          {editing ? "Сохранить" : "Добавить сотрудника"}
        </SubmitButton>
      </div>
    </form>
  );
}
