"use client";

/* eslint-disable @next/next/no-img-element -- превью из blob: URL, next/image не нужен */

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  MAX_PHOTO_BYTES,
  PHOTO_CLIENT_JPEG_QUALITY,
  PHOTO_CLIENT_MAX_SIDE,
  PHOTOS_FIELD,
} from "@/lib/requests/constants";
import { cn } from "@/lib/utils";
import { CircleAlert, ImagePlus, LoaderCircle, Plus, X } from "lucide-react";
import { registerPhotos, unregisterPhotos } from "./photo-registry";

/** Общий лимит тела запроса на сервере 30 МБ — оставляем запас. */
const MAX_TOTAL_BYTES = 28 * 1024 * 1024;

type Item = { key: string; file: File; url: string };

export type PhotoPickerProps = {
  /** Имя поля FormData (по умолчанию "photos" — его ждут все actions). */
  name?: string;
  /** Максимум фото (заявка 5, «Выполнено» 5, комментарий/проблема 3). */
  max: number;
  /** Минимум (для «Выполнено» — 1). Только для подписи «обязательно»; проверяет сервер. */
  min?: number;
  /** Заголовок над полем. */
  label?: string;
  /** Подсказка под заголовком. */
  hint?: string;
  /** Ошибка с сервера: fieldErrors.photos. */
  error?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Выбор фото с телефона: камера или галерея, превью, удаление, сжатие на клиенте
 * (длинная сторона ≤ 1600 px, JPEG 0.8 — заодно убирает EXIF/геометку).
 *
 * Как передать файлы в server action — просто положите внутрь <form>:
 *  1) рекомендуемый способ: форма с useActionForm (onSubmit) — он дождётся сжатия
 *     и добавит фото в FormData (buildFormData из ./photo-registry);
 *  2) обычный <form action={...}>: компонент сам заполняет скрытый
 *     <input type="file" name="photos"> через DataTransfer.
 * При сбросе формы (form.reset()) список фото очищается.
 */
export function PhotoPicker({
  name = PHOTOS_FIELD,
  max,
  min = 0,
  label = "Фото",
  hint,
  error,
  disabled,
  className,
}: PhotoPickerProps) {
  const fieldRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [processing, setProcessing] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const busyRef = useRef<Promise<void> | null>(null);
  const itemsRef = useRef<Item[]>([]);

  // Синхронизация со скрытым input и реестром формы.
  useEffect(() => {
    itemsRef.current = items;
    const input = fieldRef.current;
    if (!input) return;
    const files = items.map((i) => i.file);
    try {
      const dt = new DataTransfer();
      for (const f of files) dt.items.add(f);
      input.files = dt.files;
    } catch {
      // Старый браузер: остаётся реестр (buildFormData).
    }
    if (input.form) registerPhotos(input.form, name, files, busyRef.current);
  }, [items, name, processing]);

  // Сброс формы → очистить фото; при размонтировании — убрать из реестра.
  useEffect(() => {
    const form = fieldRef.current?.form;
    if (!form) return;
    const onReset = () => {
      for (const i of itemsRef.current) URL.revokeObjectURL(i.url);
      itemsRef.current = [];
      setItems([]);
      setLocalError(null);
    };
    form.addEventListener("reset", onReset);
    return () => {
      form.removeEventListener("reset", onReset);
      unregisterPhotos(form, name);
    };
  }, [name]);

  useEffect(() => {
    return () => {
      for (const i of itemsRef.current) URL.revokeObjectURL(i.url);
    };
  }, []);

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.length === 0) return;
    const room = max - itemsRef.current.length - processing;
    const toAdd = picked.slice(0, Math.max(0, room));
    setLocalError(
      picked.length > toAdd.length ? `Можно не больше ${max} фото — лишние не добавлены.` : null,
    );
    if (toAdd.length === 0) return;

    setProcessing((n) => n + toAdd.length);
    const job = (async () => {
      const ready: Item[] = [];
      for (const file of toAdd) {
        try {
          const prepared = await prepareImage(file);
          ready.push({
            key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            file: prepared,
            url: URL.createObjectURL(prepared),
          });
        } catch (err) {
          setLocalError(err instanceof Error ? err.message : "Не удалось добавить фото.");
        }
      }
      const current = itemsRef.current;
      let total = current.reduce((s, i) => s + i.file.size, 0);
      const accepted: Item[] = [];
      for (const item of ready) {
        if (current.length + accepted.length >= max || total + item.file.size > MAX_TOTAL_BYTES) {
          URL.revokeObjectURL(item.url);
          setLocalError("Слишком много или слишком большие фото — часть не добавлена.");
          continue;
        }
        total += item.file.size;
        accepted.push(item);
      }
      if (accepted.length) {
        // Реестр формы обновляем сразу, а не в useEffect после перерисовки: onSubmit
        // (useActionForm) собирает FormData сразу после окончания сжатия — иначе фото,
        // которое сжималось в момент нажатия «Отправить», не попало бы на сервер.
        const next = [...itemsRef.current, ...accepted];
        itemsRef.current = next;
        const f = fieldRef.current?.form;
        if (f) registerPhotos(f, name, next.map((i) => i.file), busyRef.current);
        setItems(next);
      }
    })();
    const prev = busyRef.current;
    const busy = Promise.all([prev, job]).then(() => undefined);
    busyRef.current = busy;
    const form = fieldRef.current?.form;
    if (form) registerPhotos(form, name, itemsRef.current.map((i) => i.file), busy);
    job.finally(() => {
      if (busyRef.current === busy) busyRef.current = null;
      setProcessing((n) => n - toAdd.length);
    });
  }

  function remove(key: string) {
    const item = itemsRef.current.find((i) => i.key === key);
    if (item) URL.revokeObjectURL(item.url);
    const next = itemsRef.current.filter((i) => i.key !== key);
    itemsRef.current = next;
    setItems(next);
    setLocalError(null);
  }

  const count = items.length;
  const canAdd = !disabled && count + processing < max;
  const message = localError || error;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-text">
          {label}
          {min > 0 ? <span className="text-danger"> *</span> : null}
        </span>
        <span className="text-xs text-muted tabular-nums">
          {count} из {max}
        </span>
      </div>
      {hint ? <p className="-mt-1 text-[13px] text-muted">{hint}</p> : null}

      {count === 0 && processing === 0 ? (
        <label
          className={cn(
            "group flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-border-strong bg-surface px-4 py-3 transition-colors",
            "hover:border-primary/60 hover:bg-primary-soft/40 has-focus-visible:ring-4 has-focus-visible:ring-ring",
            disabled && "pointer-events-none opacity-50",
          )}
        >
          <span
            aria-hidden
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"
          >
            <ImagePlus className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold text-primary">Добавить фото</span>
            <span className="block text-[13px] text-muted">Сфотографировать или выбрать из галереи</span>
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={onPick}
            disabled={disabled}
          />
        </label>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {items.map((item) => (
            <div
              key={item.key}
              className="relative aspect-square animate-pop-in overflow-hidden rounded-xl border border-border bg-surface-2"
            >
              <img src={item.url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => remove(item.key)}
                disabled={disabled}
                aria-label="Убрать фото"
                className="absolute top-0 right-0 flex size-11 items-start justify-end p-1.5"
              >
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80">
                  <X aria-hidden className="size-4" />
                </span>
              </button>
            </div>
          ))}
          {Array.from({ length: processing }, (_, i) => (
            <div
              key={`p${i}`}
              className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-surface-2 text-xs text-muted"
            >
              <LoaderCircle aria-hidden className="size-5 animate-spin text-primary" />
              Обработка…
            </div>
          ))}
          {canAdd ? (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border-strong text-primary transition-colors hover:border-primary/60 hover:bg-primary-soft/40 has-focus-visible:ring-4 has-focus-visible:ring-ring">
              <Plus aria-hidden className="size-6" />
              <span className="text-xs font-semibold">Фото</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={onPick}
              />
            </label>
          ) : null}
        </div>
      )}

      {/* Поле, которое уходит в FormData (заполняется программно). */}
      <input ref={fieldRef} type="file" name={name} multiple hidden tabIndex={-1} aria-hidden />

      {message ? (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-danger">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {message}
        </p>
      ) : null}
    </div>
  );
}

// ─── Сжатие ──────────────────────────────────────────────────

/** Сжать фото; если не получилось — оригинал (если ≤ 8 МБ). */
export async function prepareImage(file: File): Promise<File> {
  try {
    return await compressImage(file);
  } catch {
    if (file.size <= MAX_PHOTO_BYTES) return file;
    throw new Error(
      `Фото «${file.name || "без имени"}» не удалось обработать, а оригинал больше 8 МБ.`,
    );
  }
}

async function compressImage(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    let source: CanvasImageSource;
    let width: number;
    let height: number;
    let close: (() => void) | undefined;
    try {
      const bmp = await createImageBitmap(file);
      source = bmp;
      width = bmp.width;
      height = bmp.height;
      close = () => bmp.close();
    } catch {
      const img = new Image();
      img.src = url;
      await img.decode();
      source = img;
      width = img.naturalWidth;
      height = img.naturalHeight;
    }
    if (!width || !height) throw new Error("empty image");
    const scale = Math.min(1, PHOTO_CLIENT_MAX_SIDE / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.fillStyle = "#ffffff"; // прозрачный PNG → белый фон
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(source, 0, 0, w, h);
    close?.();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", PHOTO_CLIENT_JPEG_QUALITY),
    );
    if (!blob) throw new Error("toBlob failed");
    const base = (file.name || "photo").replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(url);
  }
}
