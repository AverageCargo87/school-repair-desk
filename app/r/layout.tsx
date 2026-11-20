import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";

/**
 * Карточка заявки. Каркас широкий (max-w-6xl), чтобы на большом экране (≥ xl) карточка
 * встала в две колонки; на меньших экранах страница сама держит ширину max-w-2xl по центру.
 */
export default async function RequestLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <AppShell user={user} width="wide">
      {children}
    </AppShell>
  );
}
