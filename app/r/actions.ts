"use server";

/**
 * Server actions жизненного цикла заявки — тонкие обёртки над lib/requests/service.ts.
 *
 * Все (кроме createRequestAction) имеют сигнатуру для useActionState:
 *   (prev: ActionResult, formData: FormData) => Promise<ActionResult>
 * и возвращают { ok: true } или { ok: false, error, fieldErrors }.
 * createRequestAction при успехе делает redirect на /r/[id].
 *
 * Фото во всех формах — поле FormData `photos` (несколько File; пустые игнорируются).
 * Используйте <PhotoPicker/> из components/requests/photo-picker.tsx.
 */

import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import type { ActionResult } from "@/lib/action-result";
import {
  deletePhotoFiles,
  getPhotoFiles,
  PhotoError,
  savePhotoFiles,
  validatePhotoFiles,
} from "@/lib/photos";
import { PHOTO_LIMITS } from "@/lib/requests/constants";
import {
  acceptRequest,
  addComment,
  assignRequest,
  cancelRequest,
  completeRequest,
  createRequest,
  isServiceError,
  rejectRequest,
  reopenRequest,
  reportProblem,
  resolveProblem,
  type PhotoInput,
} from "@/lib/requests/service";
import type { Urgency } from "@/db/schema";

// ─── Помощники ───────────────────────────────────────────────

const SESSION_EXPIRED: ActionResult = {
  ok: false,
  error: "Вы не вошли в систему или сессия закончилась. Обновите страницу и войдите снова.",
};

function str(fd: FormData, name: string): string {
  const v = fd.get(name);
  return typeof v === "string" ? v : "";
}

function int(fd: FormData, name: string): number {
  const s = str(fd, name).trim();
  return /^\d+$/.test(s) ? Number(s) : NaN;
}

function intList(fd: FormData, name: string): number[] {
  return fd
    .getAll(name)
    .flatMap((v) => (typeof v === "string" ? v.split(",") : []))
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s))
    .map(Number);
}

function flag(fd: FormData, name: string): boolean {
  const v = str(fd, name);
  return v === "1" || v === "on" || v === "true";
}

function toErrorResult(e: unknown): ActionResult {
  if (isServiceError(e)) {
    return { ok: false, error: e.message, fieldErrors: e.fieldErrors };
  }
  if (e instanceof PhotoError) {
    return { ok: false, error: e.message, fieldErrors: { photos: e.message } };
  }
  console.error("[actions]", e);
  return { ok: false, error: "Не удалось сохранить. Попробуйте ещё раз." };
}

/** Проверить и сохранить фото, выполнить действие; при ошибке удалить сохранённые файлы. */
async function withPhotos(
  fd: FormData,
  limits: { min: number; max: number },
  run: (photos: PhotoInput[]) => Promise<unknown>,
): Promise<ActionResult> {
  const files = getPhotoFiles(fd);
  const photoError = validatePhotoFiles(files, limits);
  if (photoError) return { ok: false, error: photoError, fieldErrors: { photos: photoError } };
  let saved: PhotoInput[] = [];
  try {
    saved = await savePhotoFiles(files);
    await run(saved);
  } catch (e) {
    await deletePhotoFiles(saved.map((p) => p.id));
    return toErrorResult(e);
  }
  return { ok: true };
}

async function simple(run: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await run();
  } catch (e) {
    return toErrorResult(e);
  }
  return { ok: true };
}

function done(result: ActionResult): ActionResult {
  // Обновляем все страницы: карточку и списки (/my, /dispatch, /tasks).
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

// ─── Действия ────────────────────────────────────────────────

/**
 * Новая заявка (заявитель — по своему зданию, распределитель/админ — по любому).
 * FormData: `buildingId` (число), `location` (необяз.), `description`,
 * `urgency` ("emergency" | "current" | "purchase"), `photos` (0..5 файлов).
 * Успех → redirect(`/r/${id}`); ошибка → ActionResult (fieldErrors по тем же именам).
 */
export async function createRequestAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return SESSION_EXPIRED;
  let newId = 0;
  const result = await withPhotos(formData, PHOTO_LIMITS.create, async (photos) => {
    const { id } = await createRequest(user, {
      buildingId: int(formData, "buildingId"),
      location: str(formData, "location"),
      description: str(formData, "description"),
      urgency: str(formData, "urgency") as Urgency,
      photos,
    });
    newId = id;
  });
  if (!result.ok) return result;
  revalidatePath("/", "layout");
  // replace: «Назад» с карточки ведёт к списку, а не на пустую форму (иначе легко подать повторно).
  redirect(`/r/${newId}`, RedirectType.replace);
}

/**
 * «Отменить» (автор-заявитель, только «Новая»).
 * FormData: `requestId`, `reason` (необяз.).
 */
export async function cancelRequestAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return SESSION_EXPIRED;
  return done(
    await simple(() =>
      cancelRequest(user, {
        requestId: int(formData, "requestId"),
        reason: str(formData, "reason"),
      }),
    ),
  );
}

/**
 * Назначить / переназначить (распределитель/админ).
 * FormData: `requestId`, `executorId`, `coexecutorIds` (повторяющееся поле — чекбоксы
 * с одинаковым name, либо "1,2,3"), `deadline` ('YYYY-MM-DD'), `comment` (необяз.).
 */
export async function assignRequestAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return SESSION_EXPIRED;
  return done(
    await simple(() =>
      assignRequest(user, {
        requestId: int(formData, "requestId"),
        executorId: int(formData, "executorId"),
        coexecutorIds: intList(formData, "coexecutorIds"),
        deadline: str(formData, "deadline").trim(),
        comment: str(formData, "comment"),
      }),
    ),
  );
}

/**
 * «Принял» (основной исполнитель, «Назначена» → «В работе»).
 * FormData: `requestId`.
 */
export async function acceptRequestAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return SESSION_EXPIRED;
  return done(
    await simple(() => acceptRequest(user, { requestId: int(formData, "requestId") })),
  );
}

/**
 * «Выполнено» (основной исполнитель, из «В работе»).
 * FormData: `requestId`, `comment` (необяз.), `photos` (1..5 файлов, обязательно).
 */
export async function completeRequestAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return SESSION_EXPIRED;
  return done(
    await withPhotos(formData, PHOTO_LIMITS.complete, (photos) =>
      completeRequest(user, {
        requestId: int(formData, "requestId"),
        comment: str(formData, "comment"),
        photos,
      }),
    ),
  );
}

/**
 * «Сообщить о проблеме» (исполнитель или соисполнитель, «Назначена»/«В работе»).
 * FormData: `requestId`, `text` (обязательно), `photos` (0..3).
 */
export async function reportProblemAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return SESSION_EXPIRED;
  return done(
    await withPhotos(formData, PHOTO_LIMITS.problem, (photos) =>
      reportProblem(user, {
        requestId: int(formData, "requestId"),
        text: str(formData, "text"),
        photos,
      }),
    ),
  );
}

/**
 * Комментарий (любой, кто видит заявку).
 * FormData: `requestId`, `text` (обязательно), `photos` (0..3),
 * `asProblem` ("1"/"on" — отправить как «Сообщить о проблеме», см. reportProblemAction).
 */
export async function addCommentAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return SESSION_EXPIRED;
  const asProblem = flag(formData, "asProblem");
  return done(
    await withPhotos(
      formData,
      asProblem ? PHOTO_LIMITS.problem : PHOTO_LIMITS.comment,
      (photos) => {
        const input = {
          requestId: int(formData, "requestId"),
          text: str(formData, "text"),
          photos,
        };
        return asProblem ? reportProblem(user, input) : addComment(user, input);
      },
    ),
  );
}

/**
 * «Проблема решена» (распределитель/админ).
 * FormData: `requestId`, `comment` (необяз.).
 */
export async function resolveProblemAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return SESSION_EXPIRED;
  return done(
    await simple(() =>
      resolveProblem(user, {
        requestId: int(formData, "requestId"),
        comment: str(formData, "comment"),
      }),
    ),
  );
}

/**
 * «Отклонить» (распределитель/админ, из активных статусов).
 * FormData: `requestId`, `reason` (обязательно).
 */
export async function rejectRequestAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return SESSION_EXPIRED;
  return done(
    await simple(() =>
      rejectRequest(user, {
        requestId: int(formData, "requestId"),
        reason: str(formData, "reason"),
      }),
    ),
  );
}

/**
 * «Вернуть в работу» (распределитель/админ, из «Выполнена»).
 * FormData: `requestId`, `comment` (обязательно), `deadline` (необяз., 'YYYY-MM-DD').
 */
export async function reopenRequestAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return SESSION_EXPIRED;
  return done(
    await simple(() =>
      reopenRequest(user, {
        requestId: int(formData, "requestId"),
        comment: str(formData, "comment"),
        deadline: str(formData, "deadline").trim() || null,
      }),
    ),
  );
}
