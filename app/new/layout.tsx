import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";

/** Новая заявка: заявитель (свои здания), распределитель и админ (любое здание). */
export default async function NewRequestLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["requester", "dispatcher", "admin"]);
  return (
    <AppShell user={user} width="narrow">
      {children}
    </AppShell>
  );
}
