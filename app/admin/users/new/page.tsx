import type { Metadata } from "next";
import { UserPlus } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { UserForm } from "@/components/admin/user-form";
import { listAllBuildings } from "../../queries";

export const metadata: Metadata = { title: "Новый сотрудник" };

export default async function NewUserPage() {
  await requireRole(["admin"]);
  const buildings = await listAllBuildings();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <PageHeader
        back={{ href: "/admin/users", label: "Все сотрудники" }}
        title="Новый сотрудник"
        subtitle="После сохранения откроется карточка сотрудника — там можно сразу выдать доступ: логин, пароль и QR-код."
      />
      <SectionCard icon={<UserPlus />} title="Данные сотрудника">
        <UserForm buildings={buildings} />
      </SectionCard>
    </div>
  );
}
