import type { Metadata } from "next";
import { EyeOff, KeyRound, QrCode } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { AccessIssuer, type AccessPerson } from "@/components/admin/access-issuer";
import { listUsersForAdmin } from "../queries";

export const metadata: Metadata = { title: "Доступы" };

/** Как устроен вход — три коротких пункта над списком. */
function HowItWorks() {
  const items = [
    {
      icon: <KeyRound />,
      title: "Логин и пароль",
      text: "Логин — фамилия латиницей (petrov), пароль — 8 символов. Можно войти и по фамилии по-русски.",
    },
    {
      icon: <QrCode />,
      title: "Личная ссылка с QR-кодом",
      text: "Навёл камеру телефона, нажал «Войти» — и готово, без пароля.",
    },
    {
      icon: <EyeOff />,
      title: "Пароль показывается один раз",
      text: "В базе он зашифрован. Потеряли карточку — выдайте доступ заново.",
    },
  ];
  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      {items.map((it) => (
        <li
          key={it.title}
          className="flex gap-3 rounded-2xl border border-border bg-surface p-3.5 shadow-card sm:p-4"
        >
          <span
            aria-hidden
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary [&_svg]:size-[18px]"
          >
            {it.icon}
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] leading-snug font-semibold text-text">{it.title}</span>
            <span className="mt-0.5 block text-sm leading-snug text-muted">{it.text}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function AdminAccessPage() {
  const me = await requireRole(["admin"]);
  const all = await listUsersForAdmin();
  const people: AccessPerson[] = all
    .filter((u) => u.active)
    .map((u) => ({
      id: u.id,
      fullName: u.fullName,
      login: u.login,
      role: u.role,
      hasPassword: u.hasPassword,
      hasLink: u.hasLink,
      isSelf: u.id === me.id,
    }));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        back={{ href: "/admin/users", label: "Сотрудники" }}
        title="Выдать доступы"
        subtitle="Каждому — карточка с логином, паролем и QR-кодом личной ссылки. Распечатайте, разрежьте по пунктиру и раздайте."
      />
      <HowItWorks />
      <AccessIssuer people={people} />
    </div>
  );
}
