import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";

export default async function ExportLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["dispatcher", "admin"]);
  return (
    <AppShell user={user} width="wide">
      {children}
    </AppShell>
  );
}
