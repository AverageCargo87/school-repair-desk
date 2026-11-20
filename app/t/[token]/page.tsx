import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Link2Off, LogIn, ShieldCheck } from "lucide-react";
import { findUserByLoginToken, getCurrentUser, homeForRole } from "@/lib/auth";
import { roleLabels } from "@/lib/labels";
import { shortName } from "@/lib/utils";
import { AuthScreen, LinkLoginButton } from "@/components/login-form";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { loginByLinkAction } from "./actions";

export const metadata: Metadata = {
  title: "Вход по ссылке",
  // Не индексировать и не показывать превью персональных ссылок.
  robots: { index: false, follow: false },
};

export default async function LinkLoginPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await findUserByLoginToken(token);

  if (!user) {
    return (
      <AuthScreen>
        <Card className="p-6 text-center shadow-raised sm:p-7">
          <span
            aria-hidden
            className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-danger-bg text-danger"
          >
            <Link2Off className="size-7" />
          </span>
          <h1 className="mt-4 text-xl leading-tight font-semibold tracking-tight text-text">
            Ссылка не работает
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            Ссылка устарела или её отозвали. Попросите у администратора новую или войдите по
            логину и паролю.
          </p>
          <Link href="/login" className={buttonClasses("primary", "lg", "mt-6 w-full")}>
            <LogIn aria-hidden className="size-5" />
            Войти по логину
          </Link>
        </Card>
      </AuthScreen>
    );
  }

  const current = await getCurrentUser();
  const name = shortName(user.fullName);

  return (
    <AuthScreen
      footer={
        <p className="mt-6 flex items-start justify-center gap-2 px-2 text-center text-sm leading-snug text-muted">
          <ShieldCheck aria-hidden className="mt-px size-4 shrink-0" />
          Личная ссылка — не пересылайте её другим.
        </p>
      }
    >
      <Card className="flex flex-col items-center p-6 text-center shadow-raised sm:p-7">
        <Avatar name={user.fullName} size="xl" />
        <h1 className="mt-4 text-2xl leading-tight font-semibold tracking-tight wrap-anywhere text-text">
          Здравствуйте, {name}
        </h1>
        <Badge variant="primary" size="lg" className="mt-2.5">
          {roleLabels[user.role]}
        </Badge>

        {current && current.id !== user.id ? (
          <Alert tone="warning" className="mt-5 w-full text-left">
            Сейчас выполнен вход под именем «{shortName(current.fullName)}». Кнопка «Войти»
            переключит на «{name}».
          </Alert>
        ) : null}

        <form action={loginByLinkAction} className="mt-6 w-full">
          <input type="hidden" name="token" value={token} />
          <LinkLoginButton />
        </form>

        {current && current.id === user.id ? (
          <Link
            href={homeForRole(user.role)}
            className={buttonClasses("soft", "lg", "mt-2 w-full")}
          >
            Вы уже вошли — к заявкам
            <ArrowRight aria-hidden className="size-5" />
          </Link>
        ) : null}

        <p className="mt-4 text-sm leading-snug text-muted">
          Пароль вводить не нужно. Вход сохранится на этом телефоне.
        </p>
      </Card>
    </AuthScreen>
  );
}
