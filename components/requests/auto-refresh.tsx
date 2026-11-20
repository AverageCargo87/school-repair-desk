"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Обновляет данные страницы (router.refresh) раз в `seconds` секунд, пока вкладка видна,
 * и сразу при возвращении на вкладку. Состояние клиентских компонентов (введённый текст) сохраняется.
 */
export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    let last = Date.now();
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      last = Date.now();
      router.refresh();
    };
    const timer = window.setInterval(tick, Math.max(10, seconds) * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - last > 15_000) tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, seconds]);

  return null;
}
