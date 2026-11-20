import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";

export default async function MyLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["requester"]);
  return (
    <AppShell user={user} width="narrow">
      {children}
    </AppShell>
  );
}
