"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/**
 * Кнопка «Скачать Excel»: файл собирается на сервере несколько секунд, а браузер
 * в это время ничего не показывает — поэтому на время пишем «Готовим файл…» с крутилкой.
 * Кнопка не блокируется (иначе форма не отправится) — только меняет вид.
 */
export function ExportSubmitButton() {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!busy) return;
    const t = window.setTimeout(() => setBusy(false), 6000);
    return () => window.clearTimeout(t);
  }, [busy]);

  return (
    <Button
      type="submit"
      size="lg"
      icon={busy ? <Spinner /> : <Download />}
      aria-busy={busy || undefined}
      className="w-full md:w-auto md:min-w-56"
      onClick={(e) => {
        if (busy) {
          e.preventDefault();
          return;
        }
        if (e.currentTarget.form?.checkValidity() !== false) setBusy(true);
      }}
    >
      {busy ? "Готовим файл…" : "Скачать Excel"}
    </Button>
  );
}
