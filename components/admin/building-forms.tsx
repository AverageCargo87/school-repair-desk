"use client";

import { useState } from "react";
import { Building2, ClipboardList, Pencil, Plus, Power, PowerOff, TriangleAlert, Users } from "lucide-react";
import { saveBuildingAction, setBuildingActiveAction } from "@/app/admin/actions";
import type { AdminBuildingRow } from "@/app/admin/types";
import { cn, pluralRu, shortName } from "@/lib/utils";
import { AvatarStack } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FormError, FormSuccess, SubmitButton } from "@/components/requests/form-bits";
import { useAdminAction } from "./use-admin-action";

/** «Добавить здание». */
export function BuildingAddForm() {
  const { state, pending, formRef, onSubmit, fieldError } = useAdminAction(saveBuildingAction, {
    resetOnSuccess: true,
  });
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3">
      <Field
        label="Адрес нового здания"
        htmlFor="new-building-address"
        hint="Пишите так, как адрес привыкли называть в школе."
        error={fieldError("address")}
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="new-building-address"
            name="address"
            placeholder="ул. Садовая, д. 12"
            autoComplete="off"
            maxLength={200}
            required
            aria-invalid={fieldError("address") ? true : undefined}
          />
          <SubmitButton
            pending={pending}
            pendingText="Добавляем…"
            icon={<Plus />}
            className="shrink-0"
          >
            Добавить
          </SubmitButton>
        </div>
      </Field>
      {fieldError("address") ? null : <FormError result={state} />}
      <FormSuccess result={state} />
    </form>
  );
}

/** Карточка здания: адрес, заявители, заявки, «Переименовать», «Отключить/Включить». */
export function BuildingRow({ building }: { building: AdminBuildingRow }) {
  const [editing, setEditing] = useState(false);
  const {
    state: saveState,
    pending: savePending,
    formRef: saveFormRef,
    onSubmit: onSave,
    fieldError: saveFieldError,
  } = useAdminAction(saveBuildingAction, { onSuccess: () => setEditing(false) });
  const {
    state: toggleState,
    pending: togglePending,
    formRef: toggleFormRef,
    onSubmit: onToggle,
  } = useAdminAction(setBuildingActiveAction);
  const b = building;

  return (
    <li
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-border p-4 shadow-card sm:p-5",
        b.active ? "bg-surface" : "bg-surface-2",
      )}
    >
      {editing ? (
        <form ref={saveFormRef} onSubmit={onSave} className="flex flex-col gap-3">
          <input type="hidden" name="buildingId" value={b.id} />
          <Field
            label="Новый адрес"
            htmlFor={`building-${b.id}`}
            hint="Адрес поменяется и во всех старых заявках этого здания."
            error={saveFieldError("address")}
          >
            <Input
              id={`building-${b.id}`}
              name="address"
              defaultValue={b.address}
              autoComplete="off"
              maxLength={200}
              required
              autoFocus
              aria-invalid={saveFieldError("address") ? true : undefined}
            />
          </Field>
          {saveFieldError("address") ? null : <FormError result={saveState} />}
          <div className="flex flex-col gap-2 sm:flex-row">
            <SubmitButton pending={savePending} pendingText="Сохраняем…">
              Сохранить
            </SubmitButton>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => setEditing(false)}
              className="w-full sm:w-auto"
            >
              Отмена
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className={cn(
              "inline-flex size-10 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5",
              b.active ? "bg-primary-soft text-primary" : "bg-surface-3 text-muted",
            )}
          >
            <Building2 />
          </span>
          <div className="min-w-0 flex-1 self-center">
            <div
              className={cn(
                "text-[16px] leading-snug font-semibold tracking-tight wrap-anywhere",
                b.active ? "text-text" : "text-muted",
              )}
            >
              {b.address}
            </div>
          </div>
          {!b.active ? <Badge className="mt-1">Отключено</Badge> : null}
        </div>
      )}

      <div className="grid gap-2.5 text-sm">
        <div className="flex items-start gap-2.5">
          <Users aria-hidden className="mt-0.5 size-4 shrink-0 text-subtle" />
          <div className="min-w-0 flex-1">
            <span className="sr-only">Заявители: </span>
            {b.requesters.length ? (
              <span className="flex flex-wrap items-center gap-2">
                <span aria-hidden className="inline-flex">
                  <AvatarStack names={b.requesters.map((r) => r.fullName)} size="sm" max={4} />
                </span>
                <span className="text-text">
                  {b.requesters.map((r) => shortName(r.fullName)).join(", ")}
                </span>
              </span>
            ) : (
              <span className={cn("flex items-center gap-1.5", b.active ? "text-danger" : "text-muted")}>
                {b.active ? <TriangleAlert aria-hidden className="size-4 shrink-0" /> : null}
                Заявители не закреплены
              </span>
            )}
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <ClipboardList aria-hidden className="mt-0.5 size-4 shrink-0 text-subtle" />
          <div className="flex flex-wrap items-center gap-2 text-muted tabular-nums">
            <span className="sr-only">Заявки: </span>
            {b.totalRequests
              ? `${b.totalRequests} ${pluralRu(b.totalRequests, ["заявка", "заявки", "заявок"])}`
              : "Заявок пока не было"}
            {b.activeRequests ? (
              <Badge variant="info" size="sm">
                {b.activeRequests} {pluralRu(b.activeRequests, ["активная", "активные", "активных"])}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      {!editing ? (
        <form
          ref={toggleFormRef}
          onSubmit={onToggle}
          className="mt-auto flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center"
        >
          <input type="hidden" name="buildingId" value={b.id} />
          <input type="hidden" name="active" value={b.active ? "0" : "1"} />
          <Button
            type="button"
            variant="ghost"
            icon={<Pencil />}
            onClick={() => setEditing(true)}
            className="w-full sm:w-auto"
          >
            Переименовать
          </Button>
          {b.active ? (
            <ConfirmButton
              tone="danger"
              variant="danger-ghost"
              buttonIcon={<PowerOff />}
              loading={togglePending}
              icon={<PowerOff />}
              title="Отключить здание?"
              description={`${b.address}: новые заявки по нему подать будет нельзя. Старые заявки и история останутся, включить можно обратно.`}
              confirmText="Да, отключить"
              className="w-full sm:ml-auto sm:w-auto"
            >
              Отключить
            </ConfirmButton>
          ) : (
            <Button
              type="submit"
              variant="soft"
              icon={<Power />}
              loading={togglePending}
              className="w-full sm:ml-auto sm:w-auto"
            >
              Включить
            </Button>
          )}
        </form>
      ) : null}
      {!editing ? <FormError result={toggleState} /> : null}
      {!editing && toggleState.ok ? <FormSuccess result={toggleState} /> : null}
      {!editing && saveState.ok ? <FormSuccess result={saveState} /> : null}
    </li>
  );
}
