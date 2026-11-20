import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, UserPlus } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { firstParam, type SearchParamsInput } from "@/lib/url";
import { pluralRu } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { UsersDirectory, type DirectoryUser } from "@/components/admin/users-directory";
import { parseDirectoryFilter } from "@/components/admin/users-filter";
import { listUsersForAdmin } from "../queries";

export const metadata: Metadata = { title: "Сотрудники" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const me = await requireRole(["admin"]);
  const sp = await searchParams;
  const all = await listUsersForAdmin();
  const activeCount = all.filter((u) => u.active).length;
  const inactiveCount = all.length - activeCount;
  const noPassword = all.filter((u) => u.active && !u.hasPassword).length;
  const filter = parseDirectoryFilter(firstParam(sp.role));
  const query = (firstParam(sp.q) ?? "").slice(0, 100);

  const users: DirectoryUser[] = all.map((u) => ({
    id: u.id,
    fullName: u.fullName,
    login: u.login,
    role: u.role,
    active: u.active,
    hasPassword: u.hasPassword,
    hasLink: u.hasLink,
    isSelf: u.id === me.id,
    buildings: u.buildings,
    activeWork: u.activeWork,
  }));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Сотрудники"
        subtitle={
          <span className="tabular-nums">
            Работают {activeCount}
            {inactiveCount ? ` · отключены ${inactiveCount}` : ""}. Нажмите на сотрудника, чтобы
            изменить данные или выдать доступ.
          </span>
        }
        actions={
          <>
            <Link href="/admin/access" className={buttonClasses("soft", "lg", "w-full sm:w-auto")}>
              <KeyRound aria-hidden className="size-5" />
              Выдать доступы
            </Link>
            <Link href="/admin/users/new" className={buttonClasses("primary", "lg", "w-full sm:w-auto")}>
              <UserPlus aria-hidden className="size-5" />
              Добавить сотрудника
            </Link>
          </>
        }
      />

      {noPassword > 0 ? (
        <Alert
          tone="warning"
          title={`${noPassword} ${pluralRu(noPassword, ["сотрудник", "сотрудника", "сотрудников"])} без пароля`}
          action={
            <Link
              href="/admin/access"
              className={buttonClasses("outline", "sm", "w-full sm:w-auto")}
            >
              Выдать доступы
            </Link>
          }
        >
          Они могут войти только по личной ссылке, если она есть. Выдайте карточки с логином и
          паролем.
        </Alert>
      ) : null}

      <UsersDirectory
        // Переход по ссылке с другими ?role/?q — начать с них заново.
        key={`${filter}|${query}`}
        users={users}
        initialFilter={filter}
        initialQuery={query}
      />
    </div>
  );
}
