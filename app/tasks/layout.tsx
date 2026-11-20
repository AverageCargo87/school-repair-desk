import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";

export default async function TasksLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["executor"]);
  return (
    <AppShell user={user} width="narrow">
      {children}
    </AppShell>
  );
}
