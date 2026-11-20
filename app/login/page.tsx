import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KeyRound, QrCode } from "lucide-react";
import { getCurrentUser, homeForRole } from "@/lib/auth";
import { AuthScreen, LoginForm } from "@/components/login-form";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Вход" };

const errorMessages: Record<string, string> = {
  badlink: "Ссылка недействительна или отозвана. Попросите у администратора новую.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(homeForRole(user.role));

  const { error } = await searchParams;
  const initialError =
    typeof error === "string" && Object.hasOwn(errorMessages, error) ? errorMessages[error] : undefined;

  return (
    <AuthScreen
      footer={
        <ul className="mt-6 flex flex-col gap-3 px-1 text-sm leading-snug text-muted">
          <li className="flex items-start gap-3">
            <QrCode aria-hidden className="mt-px size-[18px] shrink-0 text-primary" />
            <span>
              Есть карточка с QR-кодом? Наведите на него камеру телефона — войдёте без пароля.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <KeyRound aria-hidden className="mt-px size-[18px] shrink-0 text-primary" />
            <span>Забыли пароль? Обратитесь к администратору — он выдаст новый.</span>
          </li>
        </ul>
      }
    >
      <Card className="p-5 shadow-raised sm:p-6">
        <h1 className="text-xl leading-tight font-semibold tracking-tight text-text">Вход</h1>
        <p className="mt-1 text-sm leading-snug text-muted">
          Логин и пароль — на карточке, которую выдаёт администратор.
        </p>
        <div className="mt-5">
          <LoginForm initialError={initialError} />
        </div>
      </Card>
    </AuthScreen>
  );
}
