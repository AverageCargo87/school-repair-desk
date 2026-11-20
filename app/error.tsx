"use client";

import { RefreshCw, WifiOff } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { LogoMark } from "@/components/ui/logo";

export default function Error({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-16">
      <div className="flex w-full max-w-sm flex-col items-center rounded-2xl border border-border bg-surface px-6 py-8 text-center shadow-card">
        <span
          aria-hidden
          className="mb-4 inline-flex size-14 items-center justify-center rounded-full bg-warning-bg text-warning"
        >
          <WifiOff className="size-7" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight text-text">Что-то пошло не так</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          Проверьте интернет и нажмите «Повторить» или вернитесь на главную.
        </p>
        <div className="mt-6 flex w-full flex-col gap-2">
          {/* unstable_retry заново запрашивает данные с сервера (reset только перерисовывает). */}
          <Button size="lg" icon={<RefreshCw />} onClick={() => unstable_retry()}>
            Повторить
          </Button>
          {/* Полная перезагрузка, а не Link: после ошибки клиентский роутер может быть в плохом
              состоянии, а с экрана «Домой» нет кнопки «Назад». */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- нужна полная перезагрузка */}
          <a href="/" className={buttonClasses("ghost", "lg")}>
            На главную
          </a>
        </div>
      </div>
      <div className="mt-6 flex items-center gap-2 text-sm text-muted">
        <LogoMark size="sm" />
        Заявки · Школа
      </div>
    </main>
  );
}
