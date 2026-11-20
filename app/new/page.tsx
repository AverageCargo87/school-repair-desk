import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { listBuildingsForUser } from "@/lib/requests/queries";
import { homeForRole } from "@/lib/roles";
import { formatDateLongMsk, todayMsk } from "@/lib/time";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/requests/empty-state";
import { NewRequestForm } from "@/components/requester/new-request-form";

export const metadata: Metadata = { title: "Новая заявка" };

export default async function NewRequestPage() {
  const user = await requireRole(["requester", "dispatcher", "admin"]);
  // Заявителю — только закреплённые за ним активные здания; распределителю и админу — все активные.
  // Отключённые загружаем, чтобы объяснить заявителю, почему выбрать нечего.
  const allBuildings = await listBuildingsForUser(user, { includeInactive: true });
  const buildings = allBuildings.filter((b) => b.active);
  const backHref = homeForRole(user.role);
  const isRequester = user.role === "requester";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        back={{ href: backHref, label: "К списку" }}
        title="Новая заявка"
        subtitle={
          isRequester
            ? "Опишите, что случилось, — распределитель назначит исполнителя и срок."
            : "По любому зданию. Исполнителя и срок можно назначить сразу после отправки."
        }
      />

      {buildings.length === 0 ? (
        <EmptyState
          icon={<Building2 />}
          tone="neutral"
          title="Нет зданий для заявки"
          description={
            isRequester
              ? allBuildings.length === 0
                ? "За вами пока не закреплено ни одного здания. Обратитесь к администратору."
                : allBuildings.length === 1
                  ? "Ваше здание отключено администратором — новые заявки по нему подать нельзя. Если это ошибка, обратитесь к администратору."
                  : "Ваши здания отключены администратором — новые заявки по ним подать нельзя. Если это ошибка, обратитесь к администратору."
              : user.role === "admin"
                ? "Нет ни одного действующего здания. Добавьте здание в разделе «Здания»."
                : "Нет ни одного действующего здания. Обратитесь к администратору."
          }
          action={
            user.role === "admin" ? (
              <Link href="/admin/buildings" className={buttonClasses("outline", "lg")}>
                <Building2 aria-hidden className="size-5" />
                Перейти к зданиям
              </Link>
            ) : undefined
          }
        />
      ) : (
        <NewRequestForm
          authorName={user.fullName}
          todayLabel={formatDateLongMsk(todayMsk())}
          buildings={buildings.map((b) => ({ id: b.id, address: b.address }))}
        />
      )}
    </div>
  );
}
