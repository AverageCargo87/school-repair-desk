import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  KeyRound,
  Link2,
  RectangleEllipsis,
  UserCheck,
  UserCog,
  UserX,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { formatDateMsk } from "@/lib/time";
import { pluralRu } from "@/lib/utils";
import { firstParam, type SearchParamsInput } from "@/lib/url";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/ui/section-card";
import {
  IssueAccessForm,
  LoginLinkForm,
  PasswordForm,
  UserActiveForm,
} from "@/components/admin/access-forms";
import { RoleBadge } from "@/components/admin/role-badge";
import { UserForm } from "@/components/admin/user-form";
import { getUserForAdmin, listAllBuildings, listUsersForAdmin } from "../../queries";

export const metadata: Metadata = { title: "Сотрудник" };

function parseId(raw: string): number | null {
  return /^\d{1,9}$/.test(raw) ? Number(raw) : null;
}

export default async function AdminUserPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const me = await requireRole(["admin"]);
  const [{ id: rawId }, sp] = await Promise.all([params, searchParams]);
  const id = parseId(rawId);
  if (!id) notFound();

  const [user, buildings, allUsers] = await Promise.all([
    getUserForAdmin(id),
    listAllBuildings(),
    listUsersForAdmin(),
  ]);
  if (!user) notFound();

  const created = firstParam(sp.created) === "1";
  const isSelf = user.id === me.id;
  const activeAdmins = allUsers.filter((u) => u.role === "admin" && u.active).length;
  const blockedReason = isSelf
    ? "Это вы — себя отключить нельзя."
    : user.role === "admin" && user.active && activeAdmins <= 1
      ? "Это последний администратор — его нельзя отключить."
      : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Шапка: аватар, ФИО, роль, логин */}
      <div className="flex flex-col gap-3">
        <Link
          href="/admin/users"
          className="-my-1.5 -ml-2 inline-flex min-h-10 w-fit items-center gap-1 rounded-xl pr-3 pl-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          <ChevronLeft aria-hidden className="size-[18px]" />
          Все сотрудники
        </Link>
        <div className="flex items-center gap-4">
          <span aria-hidden className={user.active ? undefined : "opacity-50 grayscale"}>
            <Avatar name={user.fullName} size="xl" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl leading-tight font-semibold tracking-tight wrap-anywhere text-text">
              {user.fullName}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <RoleBadge role={user.role} />
              {!user.active ? <Badge>Отключён</Badge> : null}
              {isSelf ? <Badge variant="outline">Это вы</Badge> : null}
            </div>
            <p className="mt-1.5 text-sm text-muted tabular-nums">
              логин <span className="font-mono font-medium text-text">{user.login}</span>
              {" · "}добавлен {formatDateMsk(user.createdAt)}
              {user.role === "executor" && user.activeWork > 0
                ? ` · в работе ${user.activeWork} ${pluralRu(user.activeWork, ["заявка", "заявки", "заявок"])}`
                : null}
            </p>
          </div>
        </div>
      </div>

      {created ? (
        <Alert tone="success" title="Сотрудник добавлен" role="status">
          Теперь выдайте ему доступ: кнопка «Выдать доступ» — карточка с логином, паролем и
          QR-кодом для входа.
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:items-start">
        {/* На телефоне — первым: самое частое действие. */}
        <SectionCard
          tone="brand"
          icon={<KeyRound />}
          title="Доступ для входа"
          description="Карточка с логином, новым паролем и QR-кодом личной ссылки — распечатать или скачать."
          className="lg:col-start-2 lg:row-start-1"
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
              Сейчас:
              {user.hasPassword ? (
                <Badge variant="outline" icon={<KeyRound />}>
                  пароль задан
                </Badge>
              ) : (
                <Badge variant="warning" icon={<KeyRound />}>
                  пароля нет
                </Badge>
              )}
              {user.hasLink ? (
                <Badge variant="outline" icon={<Link2 />}>
                  ссылка есть
                </Badge>
              ) : (
                <Badge variant="outline">ссылки нет</Badge>
              )}
            </div>
            <IssueAccessForm userId={user.id} fullName={user.fullName} active={user.active} />
          </div>
        </SectionCard>

        <SectionCard
          icon={<UserCog />}
          title="Данные сотрудника"
          className="lg:col-start-1 lg:row-span-2 lg:row-start-1"
        >
          <UserForm
            key={user.id}
            user={{
              id: user.id,
              fullName: user.fullName,
              login: user.login,
              role: user.role,
              buildingIds: user.buildings.map((b) => b.id),
            }}
            buildings={buildings}
            isSelf={isSelf}
          />
        </SectionCard>

        <div className="flex flex-col gap-4 lg:col-start-2 lg:row-start-2">
          <SectionCard
            icon={<RectangleEllipsis />}
            title="Пароль вручную"
            description="Задать свой пароль или срочно выйти на всех устройствах."
          >
            <PasswordForm userId={user.id} hasPassword={user.hasPassword} />
          </SectionCard>
          <SectionCard icon={<Link2 />} title="Ссылка для входа">
            <LoginLinkForm userId={user.id} hasLink={user.hasLink} active={user.active} />
          </SectionCard>
          <SectionCard
            tone={user.active && !blockedReason ? "danger" : "default"}
            icon={user.active ? <UserX /> : <UserCheck />}
            title={user.active ? "Отключить" : "Включить"}
          >
            <UserActiveForm
              userId={user.id}
              fullName={user.fullName}
              active={user.active}
              blockedReason={blockedReason}
            />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
