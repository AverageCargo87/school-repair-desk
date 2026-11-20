import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { LogoMark } from "@/components/ui/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-16">
      <div className="flex w-full max-w-sm flex-col items-center rounded-2xl border border-border bg-surface px-6 py-8 text-center shadow-card">
        <span
          aria-hidden
          className="mb-4 inline-flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary"
        >
          <SearchX className="size-7" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight text-text">Страница не найдена</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          Возможно, в ссылке опечатка или у вас нет доступа к этой странице.
        </p>
        <Link href="/" className={buttonClasses("primary", "lg", "mt-6 w-full")}>
          На главную
        </Link>
      </div>
      <div className="mt-6 flex items-center gap-2 text-sm text-muted">
        <LogoMark size="sm" />
        Заявки · Школа
      </div>
    </main>
  );
}
