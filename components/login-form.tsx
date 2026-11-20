"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff, LockKeyhole, LogIn, UserRound } from "lucide-react";
import { loginAction, type LoginState } from "@/app/login/actions";
import { catchSendErrors } from "@/lib/safe-action";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LogoMark } from "@/components/ui/logo";

// Обрыв связи — ошибкой в форме, а не страницей «Что-то пошло не так».
const safeLoginAction = catchSendErrors<LoginState>(loginAction, (_prev, fd) => ({
  error: "Не удалось войти — нет связи с сервером. Проверьте интернет и попробуйте ещё раз.",
  login: String(fd.get("login") ?? "").slice(0, 32),
}));

/** Иконка внутри поля слева. */
const leadIcon =
  "pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-subtle";

/**
 * Форма входа по логину и паролю. Поле «login» принимает логин (petrov) или фамилию (Петров) —
 * как искать по фамилии, решает app/login/actions.ts.
 */
export function LoginForm({ initialError }: { initialError?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    safeLoginAction,
    { error: initialError },
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Логин или фамилия" htmlFor="login">
        <div className="relative">
          <UserRound aria-hidden className={leadIcon} />
          <Input
            id="login"
            name="login"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            placeholder="например, petrov или Петров"
            defaultValue={state.login}
            className="pl-11"
            required
          />
        </div>
      </Field>

      <Field label="Пароль" htmlFor="password">
        <div className="relative">
          <LockKeyhole aria-hidden className={leadIcon} />
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            className="pr-12 pl-11"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-muted transition-colors hover:text-text focus-visible:ring-4 focus-visible:ring-ring focus-visible:outline-none"
          >
            {showPassword ? (
              <EyeOff aria-hidden className="size-5" />
            ) : (
              <Eye aria-hidden className="size-5" />
            )}
          </button>
        </div>
      </Field>

      {state.error ? (
        <Alert tone="danger" role="alert">
          {state.error}
        </Alert>
      ) : null}

      <Button
        type="submit"
        size="lg"
        loading={pending}
        icon={<LogIn />}
        className="mt-1 w-full"
      >
        {pending ? "Входим…" : "Войти"}
      </Button>
    </form>
  );
}

/** Кнопка «Войти» для входа по личной ссылке (/t/[token]): крутилка, пока идёт вход. */
export function LinkLoginButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="lg"
      loading={pending}
      icon={<LogIn />}
      className="w-full"
    >
      {pending ? "Входим…" : "Войти"}
    </Button>
  );
}

/**
 * Экран входа: мягкий фон с пятнами бренда, знак-логотип, «Заявки · Школа»,
 * под ним — карточка (children) и подсказки (footer). Общий для /login и /t/[token].
 */
export function AuthScreen({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      {/* Фон: два-три размытых пятна бренда, без картинок. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-56 left-1/2 size-[36rem] -translate-x-[78%] rounded-full bg-[radial-gradient(closest-side,var(--primary),transparent)] opacity-[.16]" />
        <div className="absolute -top-40 left-1/2 size-[30rem] -translate-x-[8%] rounded-full bg-[radial-gradient(closest-side,var(--logo-to),transparent)] opacity-[.13]" />
        <div className="absolute -bottom-64 left-1/2 size-[34rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--primary),transparent)] opacity-[.08]" />
      </div>

      <div className="w-full max-w-sm animate-pop-in">
        <div className="mb-7 flex flex-col items-center text-center">
          <LogoMark size="xl" />
          <p className="mt-4 text-[28px] leading-tight font-semibold tracking-tight text-text">
            Заявки
          </p>
          <p className="mt-1 text-[15px] leading-snug text-muted">
            Школа · ремонт и хозяйственные работы
          </p>
        </div>
        {children}
        {footer}
      </div>
    </main>
  );
}
