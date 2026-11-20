import type { Metadata } from "next";
import { Building2, Plus } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { EmptyState } from "@/components/requests/empty-state";
import { BuildingAddForm, BuildingRow } from "@/components/admin/building-forms";
import { listBuildingsForAdmin } from "../queries";

export const metadata: Metadata = { title: "Здания" };

export default async function AdminBuildingsPage() {
  await requireRole(["admin"]);
  const rows = await listBuildingsForAdmin();
  const active = rows.filter((b) => b.active).length;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Здания"
        subtitle={
          <span className="tabular-nums">
            Действуют {active}
            {rows.length > active ? ` · отключены ${rows.length - active}` : ""}. Закрепить здание
            за заявителем — в карточке сотрудника.
          </span>
        }
      />

      <SectionCard
        icon={<Plus />}
        title="Добавить здание"
        description="Отключённое здание нельзя выбрать в новой заявке — старые заявки остаются."
      >
        <BuildingAddForm />
      </SectionCard>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Building2 />}
          title="Зданий пока нет"
          description="Добавьте первое здание формой выше."
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {rows.map((b) => (
            <BuildingRow key={b.id} building={b} />
          ))}
        </ul>
      )}
    </div>
  );
}
