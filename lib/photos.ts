/**
 * Фото заявок на диске: валидация, сохранение под случайным id, чтение, удаление.
 * Каталог — UPLOAD_DIR (по умолчанию ./uploads). Серверный модуль.
 */
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PhotoInput } from "@/lib/requests/service";
import { MAX_PHOTO_BYTES, PHOTOS_FIELD } from "@/lib/requests/constants";

export function uploadDir(): string {
  const fromEnv = process.env.UPLOAD_DIR;
  return fromEnv
    ? path.resolve(/*turbopackIgnore: true*/ fromEnv)
    : path.join(/*turbopackIgnore: true*/ process.cwd(), "uploads");
}

/** Путь к файлу фото (id уже проверен). */
function photoPath(id: string): string {
  return path.join(/*turbopackIgnore: true*/ uploadDir(), id);
}

/** id фото: uuid без дефисов (32 hex). Проверка защищает от обхода путей. */
const PHOTO_ID_RE = /^[a-f0-9]{32}$/;

export function isValidPhotoId(id: string): boolean {
  return PHOTO_ID_RE.test(id);
}

/** Непустые файлы из FormData (пустой <input type=file> даёт File с size 0). */
export function getPhotoFiles(formData: FormData, field: string = PHOTOS_FIELD): File[] {
  return formData
    .getAll(field)
    .filter((v): v is File => typeof v === "object" && v !== null && "arrayBuffer" in v)
    .filter((f) => f.size > 0);
}

/** Тип картинки по сигнатуре файла (не доверяем заголовку из браузера). */
export function sniffImageMime(buf: Uint8Array): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return "image/png";
  }
  const ascii = (from: number, to: number) => String.fromCharCode(...buf.subarray(from, to));
  if (buf.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    return "image/webp";
  }
  if (buf.length >= 12 && ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12);
    if (["heic", "heix", "hevc", "hevx", "heim", "heis"].includes(brand)) return "image/heic";
    if (["mif1", "msf1", "heif"].includes(brand)) return "image/heif";
  }
  return null;
}

/**
 * Проверка количества и размера (до чтения содержимого).
 * Возвращает текст ошибки для пользователя или null.
 */
export function validatePhotoFiles(
  files: File[],
  limits: { min: number; max: number },
): string | null {
  if (files.length < limits.min) {
    return limits.min === 1 ? "Добавьте хотя бы одно фото." : `Добавьте не меньше ${limits.min} фото.`;
  }
  if (files.length > limits.max) return `Можно приложить не больше ${limits.max} фото.`;
  for (const f of files) {
    if (f.size > MAX_PHOTO_BYTES) {
      return `Фото «${f.name || "без имени"}» слишком большое (больше 8 МБ).`;
    }
  }
  return null;
}

export class PhotoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhotoError";
  }
}

/**
 * Сохранить файлы в UPLOAD_DIR. Тип определяется по содержимому
 * (jpeg/png/webp/heic/heif), иначе PhotoError. При ошибке уже записанные файлы удаляются.
 */
export async function savePhotoFiles(files: File[]): Promise<PhotoInput[]> {
  if (files.length === 0) return [];
  const dir = uploadDir();
  await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
  const saved: PhotoInput[] = [];
  try {
    for (const file of files) {
      if (file.size > MAX_PHOTO_BYTES) {
        throw new PhotoError(`Фото «${file.name || "без имени"}» слишком большое (больше 8 МБ).`);
      }
      const buf = new Uint8Array(await file.arrayBuffer());
      const mime = sniffImageMime(buf);
      if (!mime) {
        throw new PhotoError(
          `Файл «${file.name || "без имени"}» не похож на фото. Подходят JPEG, PNG, WebP, HEIC.`,
        );
      }
      const id = randomUUID().replace(/-/g, "");
      await writeFile(/*turbopackIgnore: true*/ photoPath(id), buf);
      saved.push({
        id,
        fileName: (file.name || "photo").slice(0, 200),
        mime,
        size: buf.byteLength,
      });
    }
  } catch (err) {
    await deletePhotoFiles(saved.map((p) => p.id));
    throw err;
  }
  return saved;
}

/** Удалить файлы (например, если сервис отказал после сохранения). Ошибки игнорируются. */
export async function deletePhotoFiles(ids: string[]): Promise<void> {
  await Promise.all(
    ids
      .filter(isValidPhotoId)
      .map((id) =>
        rm(/*turbopackIgnore: true*/ photoPath(id), { force: true }).catch(() => undefined),
      ),
  );
}

/** Прочитать файл фото; null — нет файла или неверный id. */
export async function readPhotoFile(id: string): Promise<Buffer | null> {
  if (!isValidPhotoId(id)) return null;
  try {
    return await readFile(/*turbopackIgnore: true*/ photoPath(id));
  } catch {
    return null;
  }
}
