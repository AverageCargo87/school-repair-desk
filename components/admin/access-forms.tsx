"use client";

import { useState } from "react";
import { KeyRound, Link2, Link2Off, LogOut, Sparkles, UserCheck, UserX } from "lucide-react";
import {
  issueAccessAction,
  issueLinkAction,
  revokeLinkAction,
  setPasswordAction,
  setUserActiveAction,
} from "@/app/admin/actions";
import type { AdminResult } from "@/app/admin/types";
import { APP_NAME } from "@/lib/app";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FormError, FormSuccess } from "@/components/requests/form-bits";
import { AccessResult } from "./access-cards";
import { SecretBox } from "./copy-button";
import { useAdminAction } from "./use-admin-action";

// ─── Выдать доступ (карточка: логин, новый пароль, QR) ───────

/**
 * «Выдать доступ» одному сотруднику: новый пароль и новая ссылка (старые перестают работать,
 * уже открытые входы остаются) → карточка для печати и CSV, как в разделе «Доступы».
 */
export function IssueAccessForm({
  userId,
  fullName,
  active,
}: {
  userId: number;
  fullName: string;
  active: boolean;
}) {
  const { state, pending, formRef, onSubmit } = useAdminAction(issueAccessAction);
  // Какой результат уже убрали с экрана («Скрыть»).
  const [dismissed, setDismissed] = useState<AdminResult | null>(null);
  const shown = state.ok && state.cards?.length && state !== dismissed ? state : null;

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="userIds" value={userId} />
      {shown?.cards ? (
        <AccessResult
          cards={shown.cards}
          siteUrl={shown.siteUrl ?? ""}
          issuedAt={shown.issuedAt}
          failed={shown.failed}
          onDone={() => setDismissed(shown)}
          doneLabel="Скрыть карточку"
        />
      ) : (
        <>
          {active ? (
            <ConfirmButton
              tone="primary"
              variant="primary"
              size="lg"
              buttonIcon={<KeyRound />}
              loading={pending}
              icon={<KeyRound />}
              title="Выдать новый доступ?"
              description={`${fullName} получит новый пароль и новую ссылку для входа — старые перестанут работать. Если он уже вошёл на телефоне, то останется в системе.`}
              confirmText="Да, выдать"
              className="w-full sm:w-auto sm:self-start"
            >
              {pending ? "Выдаём…" : "Выдать доступ"}
            </ConfirmButton>
          ) : (
            <Alert tone="neutral">Сотрудник отключён — сначала включите его.</Alert>
          )}
          <FormError result={state} />
        </>
      )}
    </form>
  );
}

// ─── Пароль ──────────────────────────────────────────────────

/** «Задать пароль»: ввести свой или сгенерировать; новый пароль показывается один раз. */
export function PasswordForm({ userId, hasPassword }: { userId: number; hasPassword: boolean }) {
  const { state, pending, formRef, onSubmit, fieldError } = useAdminAction(setPasswordAction, {
    resetOnSuccess: true,
  });
  const [signOut, setSignOut] = useState(true);
  const copyText =
    state.ok && state.password
      ? [
          APP_NAME,
          state.loginUrl ? `Вход: ${state.loginUrl}` : null,
          `Логин: ${state.login}`,
          `Пароль: ${state.password}`,
        ]
          .filter(Boolean)
          .join("\n")
      : "";

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="signOut" value={signOut ? "1" : ""} />
      <Field
        label={hasPassword ? "Новый пароль" : "Пароль"}
        htmlFor={`pwd-${userId}`}
        hint={
          hasPassword
            ? "Старый пароль перестанет подходить."
            : "Пароля пока нет — сотрудник может войти только по ссылке."
        }
        error={fieldError("password")}
      >
        <Input
          id={`pwd-${userId}`}
          name="password"
          type="text"
          autoComplete="new-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="не короче 6 символов"
          maxLength={64}
          className="font-mono"
          aria-invalid={fieldError("password") ? true : undefined}
        />
      </Field>

      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
        <LogOut aria-hidden className="size-[18px] shrink-0 text-muted" />
        <span className="min-w-0 flex-1 text-sm leading-snug text-text">
          Выйти на всех устройствах
          <span className="block text-[13px] text-muted">
            Если телефон потерян или пароль узнали чужие
          </span>
        </span>
        <Switch checked={signOut} onCheckedChange={setSignOut} label="Выйти на всех устройствах" />
      </label>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          type="submit"
          name="mode"
          value="manual"
          size="lg"
          variant="secondary"
          disabled={pending}
          className="w-full sm:w-auto"
        >
          Сохранить пароль
        </Button>
        <Button
          type="submit"
          name="mode"
          value="generate"
          size="lg"
          variant="outline"
          icon={<Sparkles />}
          disabled={pending}
          className="w-full sm:w-auto"
        >
          Придумать автоматически
        </Button>
      </div>
      {state.ok && state.password ? (
        <SecretBox
          title={`Новый пароль (логин ${state.login})`}
          value={state.password}
          copyText={copyText}
          note="Показывается один раз. «Копировать» скопирует адрес сайта, логин и пароль — можно сразу отправить сотруднику."
        />
      ) : fieldError("password") ? null : (
        <FormError result={state} />
      )}
    </form>
  );
}

// ─── Ссылка для входа ────────────────────────────────────────

/**
 * «Создать ссылку для входа»: новая ссылка (старая перестаёт работать) показывается один раз
 * с кнопкой «Копировать». «Отозвать ссылку» — с подтверждением.
 */
export function LoginLinkForm({
  userId,
  hasLink,
  active,
}: {
  userId: number;
  hasLink: boolean;
  active: boolean;
}) {
  const {
    state: issueState,
    pending: issuePending,
    formRef: issueFormRef,
    onSubmit: onIssue,
  } = useAdminAction(issueLinkAction);
  const {
    state: revokeState,
    pending: revokePending,
    formRef: revokeFormRef,
    onSubmit: onRevoke,
  } = useAdminAction(revokeLinkAction);
  const pending = issuePending || revokePending;
  // Показываем ссылку, пока после неё не отозвали.
  const link = issueState.ok && issueState.link && hasLink ? issueState.link : null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-snug text-muted">
        {hasLink
          ? "Ссылка есть, но показать её повторно нельзя. Можно создать новую (старая перестанет работать) или отозвать."
          : "По личной ссылке сотрудник входит без пароля: открывает её на телефоне и нажимает «Войти»."}
      </p>

      <form ref={issueFormRef} onSubmit={onIssue} className="flex flex-col gap-3">
        <input type="hidden" name="userId" value={userId} />
        <Button
          type="submit"
          size="lg"
          variant="secondary"
          icon={<Link2 />}
          loading={issuePending}
          disabled={pending || !active}
          className="w-full sm:w-auto sm:self-start"
        >
          {issuePending ? "Создаём…" : hasLink ? "Создать новую ссылку" : "Создать ссылку"}
        </Button>
        {!active ? (
          <p className="text-[13px] text-muted">Сотрудник отключён — сначала включите его.</p>
        ) : null}
        {link ? (
          <SecretBox
            title="Ссылка для входа"
            value={link}
            note="Показывается один раз. Отправьте её лично этому сотруднику — по ней входят без пароля."
          />
        ) : (
          <FormError result={issueState} />
        )}
      </form>

      {hasLink ? (
        <form ref={revokeFormRef} onSubmit={onRevoke} className="flex flex-col gap-2">
          <input type="hidden" name="userId" value={userId} />
          <ConfirmButton
            tone="danger"
            variant="danger-ghost"
            size="md"
            buttonIcon={<Link2Off />}
            loading={revokePending}
            disabled={pending}
            icon={<Link2Off />}
            title="Отозвать ссылку?"
            description="По ней больше нельзя будет войти. Кто уже вошёл на телефоне, останется в системе."
            confirmText="Да, отозвать"
            className="w-full sm:w-fit"
          >
            Отозвать ссылку
          </ConfirmButton>
          <FormError result={revokeState} />
        </form>
      ) : revokeState.ok ? (
        <FormSuccess result={revokeState} />
      ) : null}
    </div>
  );
}

// ─── Отключить / включить ────────────────────────────────────

/** «Отключить» (с подтверждением; сразу завершает его входы) / «Включить». */
export function UserActiveForm({
  userId,
  fullName,
  active,
  blockedReason,
}: {
  userId: number;
  fullName: string;
  active: boolean;
  /** Почему отключить нельзя (сам себя / последний админ). */
  blockedReason?: string | null;
}) {
  const { state, pending, formRef, onSubmit } = useAdminAction(setUserActiveAction);

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="active" value={active ? "0" : "1"} />

      {active ? (
        blockedReason ? (
          <Alert tone="neutral">{blockedReason}</Alert>
        ) : (
          <>
            <p className="text-sm leading-snug text-muted">
              Если сотрудник уволился или больше не работает с заявками — отключите его. Данные
              не удаляются, включить можно обратно.
            </p>
            <ConfirmButton
              tone="danger"
              variant="danger-outline"
              size="lg"
              buttonIcon={<UserX />}
              loading={pending}
              icon={<UserX />}
              title="Отключить сотрудника?"
              description={`${fullName} сразу выйдет из системы на всех устройствах и не сможет войти ни по паролю, ни по ссылке. Ссылка будет отозвана — после включения выдайте новую. Заявки и история сохранятся.`}
              confirmText="Да, отключить"
              className="w-full sm:w-fit"
            >
              Отключить сотрудника
            </ConfirmButton>
          </>
        )
      ) : (
        <>
          <p className="text-sm leading-snug text-muted">
            Сотрудник отключён: войти не может, в списках выбора его нет.
          </p>
          <Button
            type="submit"
            size="lg"
            icon={<UserCheck />}
            loading={pending}
            className="w-full sm:w-fit"
          >
            {pending ? "Включаем…" : "Включить сотрудника"}
          </Button>
        </>
      )}

      <FormError result={state} />
      <FormSuccess result={state} />
    </form>
  );
}
