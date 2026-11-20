/**
 * Сервисный слой заявок — ЕДИНСТВЕННОЕ место бизнес-правил жизненного цикла.
 * Каждая функция: (user, input) → проверка роли, доступа и допустимого перехода,
 * изменение заявки + событие в request_events + updated_at, всё в одной транзакции.
 * Ошибки — ServiceError с понятным русским сообщением.
 *
 * Файлы фото здесь не сохраняются: сюда приходят уже сохранённые (lib/photos.ts)
 * метаданные PhotoInput, сервис только пишет строки request_photos.
 */
import { and, eq, inArray } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  buildings,
  requestCoexecutors,
  requestEvents,
  requestPhotos,
  requests,
  userBuildings,
  users,
  type EventMeta,
  type EventType,
  type PhotoKind,
  type RepairRequest,
  type RequestStatus,
  type Urgency,
} from "@/db/schema";
import { isDispatcherRole } from "@/lib/roles";
import { isValidDateStr, todayMsk } from "@/lib/time";
import { PHOTO_LIMITS, TEXT_LIMITS, URGENCIES } from "./constants";
import { getViewerRelation, type Actor } from "./access";
import { canView, type ViewerRelation } from "./rules";

export type { Actor };

// ─── Ошибки ──────────────────────────────────────────────────

export type ServiceErrorCode =
  /** Заявки нет или она не видна пользователю. */
  | "not_found"
  /** Роль/отношение к заявке не позволяет действие. */
  | "forbidden"
  /** Действие недопустимо в текущем статусе. */
  | "invalid_state"
  /** Неверно заполнены поля (см. fieldErrors). */
  | "validation";

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  /** Ошибки по полям формы: имя поля FormData → текст. */
  readonly fieldErrors?: Record<string, string>;

  constructor(code: ServiceErrorCode, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export function isServiceError(e: unknown): e is ServiceError {
  return e instanceof ServiceError;
}

const notFound = () => new ServiceError("not_found", "Заявка не найдена или у вас нет к ней доступа.");
const forbidden = (msg = "Это действие вам недоступно.") => new ServiceError("forbidden", msg);
const invalidState = (msg: string) => new ServiceError("invalid_state", msg);
const validation = (fieldErrors: Record<string, string>, msg?: string) =>
  new ServiceError(
    "validation",
    msg ?? Object.values(fieldErrors)[0] ?? "Проверьте заполнение формы.",
    fieldErrors,
  );

// ─── Входные данные ──────────────────────────────────────────

/** Уже сохранённое на диск фото (см. lib/photos.ts → savePhotoFiles). */
export type PhotoInput = {
  /** Случайный id = имя файла в UPLOAD_DIR. */
  id: string;
  /** Исходное имя файла. */
  fileName: string;
  mime: string;
  size: number;
};

export type CreateRequestInput = {
  buildingId: number;
  location?: string | null;
  description: string;
  urgency: Urgency;
  /** 0..5 фото заявителя (kind = problem). */
  photos?: PhotoInput[];
};

export type AssignRequestInput = {
  requestId: number;
  executorId: number;
  /** 0..N других активных исполнителей; основной исполнитель отсюда отбрасывается. */
  coexecutorIds?: number[];
  /** 'YYYY-MM-DD', не раньше сегодняшнего дня по Москве. */
  deadline: string;
  /** Необязательный комментарий распределителя. Пусто → прежний dispatcher_comment сохраняется. */
  comment?: string | null;
};

export type RequestIdInput = { requestId: number };

export type CancelRequestInput = { requestId: number; reason?: string | null };

export type CompleteRequestInput = {
  requestId: number;
  comment?: string | null;
  /** 1..5 фото результата (kind = result). */
  photos: PhotoInput[];
};

export type TextWithPhotosInput = {
  requestId: number;
  /** Текст обязателен. */
  text: string;
  /** 0..3 фото (kind = comment). */
  photos?: PhotoInput[];
};

export type ResolveProblemInput = { requestId: number; comment?: string | null };

export type RejectRequestInput = { requestId: number; reason: string };

export type ReopenRequestInput = {
  requestId: number;
  /** Обязателен: что не так с выполнением. */
  comment: string;
  /** Новый срок (необязательно), 'YYYY-MM-DD' ≥ сегодня. Пусто → срок прежний. */
  deadline?: string | null;
};

// ─── Внутренние помощники ────────────────────────────────────

function cleanText(value: string | null | undefined): string {
  return (value ?? "").replace(/\r\n/g, "\n").trim();
}

function checkLength(
  fe: Record<string, string>,
  field: string,
  value: string,
  max: number,
): void {
  if (value.length > max) fe[field] = `Слишком длинный текст (больше ${max} символов).`;
}

function checkPhotos(
  fe: Record<string, string>,
  photos: PhotoInput[] | undefined,
  limits: { min: number; max: number },
): PhotoInput[] {
  const list = photos ?? [];
  if (list.length < limits.min) {
    fe.photos =
      limits.min === 1
        ? "Добавьте хотя бы одно фото."
        : `Добавьте не меньше ${limits.min} фото.`;
  } else if (list.length > limits.max) {
    fe.photos = `Можно приложить не больше ${limits.max} фото.`;
  }
  return list;
}

function throwIfErrors(fe: Record<string, string>): void {
  if (Object.keys(fe).length > 0) throw validation(fe);
}

function isPositiveInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n > 0;
}

/** Загрузить заявку с блокировкой строки и проверить, что пользователь её видит. */
async function loadForUpdate(
  tx: Tx,
  user: Actor,
  requestId: number,
): Promise<{ req: RepairRequest; rel: ViewerRelation }> {
  if (!isPositiveInt(requestId)) throw notFound();
  const req = (
    await tx.select().from(requests).where(eq(requests.id, requestId)).for("update").limit(1)
  )[0];
  if (!req) throw notFound();
  const rel = await getViewerRelation(user, req, tx);
  if (!canView(rel)) throw notFound();
  return { req, rel };
}

async function addEvent(
  tx: Tx,
  input: {
    requestId: number;
    actorId: number;
    type: EventType;
    text?: string | null;
    meta?: EventMeta | null;
    at: Date;
  },
): Promise<number> {
  const [ev] = await tx
    .insert(requestEvents)
    .values({
      requestId: input.requestId,
      actorId: input.actorId,
      type: input.type,
      text: input.text || null,
      meta: input.meta ?? null,
      createdAt: input.at,
    })
    .returning({ id: requestEvents.id });
  return ev.id;
}

async function addPhotos(
  tx: Tx,
  input: {
    requestId: number;
    eventId: number;
    kind: PhotoKind;
    uploadedBy: number;
    photos: PhotoInput[];
    at: Date;
  },
): Promise<void> {
  if (input.photos.length === 0) return;
  await tx.insert(requestPhotos).values(
    input.photos.map((p) => ({
      id: p.id,
      requestId: input.requestId,
      kind: input.kind,
      fileName: p.fileName.slice(0, 200) || "photo.jpg",
      mime: p.mime,
      size: p.size,
      uploadedBy: input.uploadedBy,
      createdAt: input.at,
      eventId: input.eventId,
    })),
  );
}

async function updateRequest(
  tx: Tx,
  requestId: number,
  patch: Partial<typeof requests.$inferInsert>,
  at: Date,
): Promise<void> {
  await tx
    .update(requests)
    .set({ ...patch, updatedAt: at })
    .where(eq(requests.id, requestId));
}

const ACTIVE: readonly RequestStatus[] = ["new", "assigned", "in_progress"];
const WORK: readonly RequestStatus[] = ["assigned", "in_progress"];

// ─── Создание ────────────────────────────────────────────────

/**
 * Новая заявка. Заявитель — только по закреплённому зданию;
 * распределитель/админ — по любому активному зданию; исполнитель — нельзя.
 */
export async function createRequest(
  user: Actor,
  input: CreateRequestInput,
): Promise<{ id: number }> {
  if (user.role === "executor") {
    throw forbidden("Исполнители не создают заявки. Напишите распределителю.");
  }
  const fe: Record<string, string> = {};
  const description = cleanText(input.description);
  const location = cleanText(input.location);
  if (!description) fe.description = "Опишите, что случилось.";
  else checkLength(fe, "description", description, TEXT_LIMITS.description);
  checkLength(fe, "location", location, TEXT_LIMITS.location);
  if (!URGENCIES.includes(input.urgency)) fe.urgency = "Выберите срочность.";
  if (!isPositiveInt(input.buildingId)) fe.buildingId = "Выберите здание.";
  const photos = checkPhotos(fe, input.photos, PHOTO_LIMITS.create);
  throwIfErrors(fe);

  return db.transaction(async (tx) => {
    const building = (
      await tx.select().from(buildings).where(eq(buildings.id, input.buildingId)).limit(1)
    )[0];
    if (!building || !building.active) {
      throw validation({ buildingId: "Здание не найдено или отключено." });
    }
    if (user.role === "requester") {
      const linked = await tx
        .select({ userId: userBuildings.userId })
        .from(userBuildings)
        .where(
          and(eq(userBuildings.userId, user.id), eq(userBuildings.buildingId, building.id)),
        )
        .limit(1);
      if (linked.length === 0) {
        throw validation({ buildingId: "Это здание не закреплено за вами." });
      }
    }
    const at = new Date();
    const [row] = await tx
      .insert(requests)
      .values({
        authorId: user.id,
        buildingId: building.id,
        location: location || null,
        description,
        urgency: input.urgency,
        status: "new",
        createdAt: at,
        updatedAt: at,
      })
      .returning({ id: requests.id });
    const eventId = await addEvent(tx, {
      requestId: row.id,
      actorId: user.id,
      type: "created",
      at,
    });
    await addPhotos(tx, {
      requestId: row.id,
      eventId,
      kind: "problem",
      uploadedBy: user.id,
      photos,
      at,
    });
    return { id: row.id };
  });
}

// ─── Заявитель ───────────────────────────────────────────────

/** «Отменить» — только автор-заявитель, только из new → cancelled. */
export async function cancelRequest(user: Actor, input: CancelRequestInput): Promise<void> {
  const reason = cleanText(input.reason);
  const fe: Record<string, string> = {};
  checkLength(fe, "reason", reason, TEXT_LIMITS.comment);
  throwIfErrors(fe);

  await db.transaction(async (tx) => {
    const { req, rel } = await loadForUpdate(tx, user, input.requestId);
    if (user.role !== "requester" || !rel.isAuthor) {
      throw forbidden("Отменить заявку может только её автор.");
    }
    if (req.status !== "new") {
      throw invalidState(
        "Заявку уже взяли в работу или закрыли — отменить её нельзя. Напишите комментарий распределителю.",
      );
    }
    const at = new Date();
    await updateRequest(tx, req.id, { status: "cancelled", problemOpen: false }, at);
    await addEvent(tx, {
      requestId: req.id,
      actorId: user.id,
      type: "cancelled",
      text: reason || null,
      meta: { prevStatus: req.status },
      at,
    });
  });
}

// ─── Распределитель / админ ─────────────────────────────────

/**
 * Назначить / переназначить (new|assigned|in_progress).
 * new → assigned (событие assigned). Повторно: сменился основной исполнитель → assigned и
 * accepted_at = null, иначе статус прежний (событие reassigned). Всегда снимает problem_open.
 */
export async function assignRequest(user: Actor, input: AssignRequestInput): Promise<void> {
  if (!isDispatcherRole(user.role)) throw forbidden("Назначать исполнителей может только распределитель.");
  const fe: Record<string, string> = {};
  const comment = cleanText(input.comment);
  if (!isPositiveInt(input.executorId)) fe.executorId = "Выберите исполнителя.";
  const today = todayMsk();
  if (!isValidDateStr(input.deadline)) fe.deadline = "Укажите срок.";
  else if (input.deadline < today) fe.deadline = "Срок не может быть раньше сегодняшнего дня.";
  checkLength(fe, "comment", comment, TEXT_LIMITS.comment);
  const rawCo = input.coexecutorIds ?? [];
  if (rawCo.some((id) => !isPositiveInt(id))) fe.coexecutorIds = "Неверный список соисполнителей.";
  throwIfErrors(fe);
  const coexecutorIds = [...new Set(rawCo)].filter((id) => id !== input.executorId);

  await db.transaction(async (tx) => {
    const { req } = await loadForUpdate(tx, user, input.requestId);
    if (!ACTIVE.includes(req.status)) {
      throw invalidState("Назначить исполнителя можно только в активной заявке.");
    }
    const ids = [input.executorId, ...coexecutorIds];
    const found = await tx
      .select({ id: users.id, role: users.role, active: users.active })
      .from(users)
      .where(inArray(users.id, ids));
    const ok = new Set(found.filter((u) => u.role === "executor" && u.active).map((u) => u.id));
    if (!ok.has(input.executorId)) {
      throw validation({ executorId: "Исполнитель не найден или отключён." });
    }
    if (coexecutorIds.some((id) => !ok.has(id))) {
      throw validation({ coexecutorIds: "Среди соисполнителей есть отключённый или неизвестный сотрудник." });
    }

    const prevCo = (
      await tx
        .select({ userId: requestCoexecutors.userId })
        .from(requestCoexecutors)
        .where(eq(requestCoexecutors.requestId, req.id))
    ).map((r) => r.userId);

    const isFirst = req.status === "new";
    const executorChanged = req.executorId !== input.executorId;
    const status: RequestStatus = isFirst || executorChanged ? "assigned" : req.status;
    const acceptedAt = isFirst || executorChanged ? null : req.acceptedAt;
    const at = new Date();

    await updateRequest(
      tx,
      req.id,
      {
        status,
        executorId: input.executorId,
        deadline: input.deadline,
        dispatcherComment: comment || req.dispatcherComment,
        acceptedAt,
        problemOpen: false,
      },
      at,
    );
    await tx.delete(requestCoexecutors).where(eq(requestCoexecutors.requestId, req.id));
    if (coexecutorIds.length > 0) {
      await tx
        .insert(requestCoexecutors)
        .values(coexecutorIds.map((userId) => ({ requestId: req.id, userId })));
    }
    await addEvent(tx, {
      requestId: req.id,
      actorId: user.id,
      type: isFirst ? "assigned" : "reassigned",
      text: comment || null,
      meta: {
        executorId: input.executorId,
        coexecutorIds,
        deadline: input.deadline,
        ...(isFirst
          ? {}
          : {
              prevExecutorId: req.executorId,
              prevCoexecutorIds: prevCo,
              prevDeadline: req.deadline,
              prevStatus: req.status,
            }),
      },
      at,
    });
  });
}

/** «Проблема решена» — распределитель/админ снимает флаг problem_open (можно с комментарием). */
export async function resolveProblem(user: Actor, input: ResolveProblemInput): Promise<void> {
  if (!isDispatcherRole(user.role)) throw forbidden();
  const comment = cleanText(input.comment);
  const fe: Record<string, string> = {};
  checkLength(fe, "comment", comment, TEXT_LIMITS.comment);
  throwIfErrors(fe);

  await db.transaction(async (tx) => {
    const { req } = await loadForUpdate(tx, user, input.requestId);
    if (!req.problemOpen) throw invalidState("Открытой проблемы по заявке нет.");
    const at = new Date();
    await updateRequest(tx, req.id, { problemOpen: false }, at);
    await addEvent(tx, {
      requestId: req.id,
      actorId: user.id,
      type: "problem_resolved",
      text: comment || null,
      at,
    });
  });
}

/** «Отклонить» — распределитель/админ, из new|assigned|in_progress, причина обязательна. */
export async function rejectRequest(user: Actor, input: RejectRequestInput): Promise<void> {
  if (!isDispatcherRole(user.role)) throw forbidden("Отклонить заявку может только распределитель.");
  const reason = cleanText(input.reason);
  const fe: Record<string, string> = {};
  if (!reason) fe.reason = "Укажите причину отклонения.";
  else checkLength(fe, "reason", reason, TEXT_LIMITS.comment);
  throwIfErrors(fe);

  await db.transaction(async (tx) => {
    const { req } = await loadForUpdate(tx, user, input.requestId);
    if (!ACTIVE.includes(req.status)) {
      throw invalidState("Отклонить можно только активную заявку.");
    }
    const at = new Date();
    await updateRequest(tx, req.id, { status: "rejected", problemOpen: false }, at);
    await addEvent(tx, {
      requestId: req.id,
      actorId: user.id,
      type: "rejected",
      text: reason,
      meta: { prevStatus: req.status },
      at,
    });
  });
}

/**
 * «Вернуть в работу» — распределитель/админ, done → assigned (исполнители прежние),
 * комментарий обязателен, срок можно поменять. completed_at, accepted_at и комментарий
 * исполнителя сбрасываются (прежний текст остаётся в событии completed).
 * Отключённые (или сменившие роль) соисполнители не возвращаются. Если отключён основной
 * исполнитель — заявка всё равно возвращается (иначе из «Выполнена» её не вывести), а
 * распределитель сразу переназначает её формой назначения (интерфейс об этом предупреждает).
 */
export async function reopenRequest(user: Actor, input: ReopenRequestInput): Promise<void> {
  if (!isDispatcherRole(user.role)) throw forbidden("Вернуть заявку в работу может только распределитель.");
  const comment = cleanText(input.comment);
  const deadline = cleanText(input.deadline);
  const fe: Record<string, string> = {};
  if (!comment) fe.comment = "Напишите, что нужно доделать.";
  else checkLength(fe, "comment", comment, TEXT_LIMITS.comment);
  if (deadline) {
    if (!isValidDateStr(deadline)) fe.deadline = "Неверная дата срока.";
    else if (deadline < todayMsk()) fe.deadline = "Срок не может быть раньше сегодняшнего дня.";
  }
  throwIfErrors(fe);

  await db.transaction(async (tx) => {
    const { req } = await loadForUpdate(tx, user, input.requestId);
    if (req.status !== "done") throw invalidState("Вернуть в работу можно только выполненную заявку.");
    const prevCo = (
      await tx
        .select({ userId: requestCoexecutors.userId })
        .from(requestCoexecutors)
        .where(eq(requestCoexecutors.requestId, req.id))
    ).map((r) => r.userId);
    const activeExecutors = prevCo.length
      ? new Set(
          (
            await tx
              .select({ id: users.id })
              .from(users)
              .where(and(inArray(users.id, prevCo), eq(users.role, "executor"), eq(users.active, true)))
          ).map((u) => u.id),
        )
      : new Set<number>();
    const coexecutorIds = prevCo.filter((id) => activeExecutors.has(id));
    const droppedCo = prevCo.filter((id) => !activeExecutors.has(id));
    const at = new Date();
    const newDeadline = deadline || req.deadline;
    await updateRequest(
      tx,
      req.id,
      {
        status: "assigned",
        completedAt: null,
        acceptedAt: null,
        completionComment: null,
        problemOpen: false,
        dispatcherComment: comment,
        deadline: newDeadline,
      },
      at,
    );
    if (droppedCo.length > 0) {
      await tx
        .delete(requestCoexecutors)
        .where(and(eq(requestCoexecutors.requestId, req.id), inArray(requestCoexecutors.userId, droppedCo)));
    }
    await addEvent(tx, {
      requestId: req.id,
      actorId: user.id,
      type: "reopened",
      text: comment,
      meta: {
        executorId: req.executorId,
        coexecutorIds,
        deadline: newDeadline,
        prevCoexecutorIds: prevCo,
        prevDeadline: req.deadline,
        prevStatus: req.status,
      },
      at,
    });
  });
}

// ─── Исполнитель ─────────────────────────────────────────────

/** «Принял» — только основной исполнитель, assigned → in_progress. */
export async function acceptRequest(user: Actor, input: RequestIdInput): Promise<void> {
  await db.transaction(async (tx) => {
    const { req, rel } = await loadForUpdate(tx, user, input.requestId);
    if (!rel.isExecutor) throw forbidden("Принять заявку может только основной исполнитель.");
    if (req.status !== "assigned") {
      throw invalidState(
        req.status === "in_progress" ? "Заявка уже принята." : "Сейчас эту заявку нельзя принять.",
      );
    }
    const at = new Date();
    await updateRequest(tx, req.id, { status: "in_progress", acceptedAt: at }, at);
    await addEvent(tx, { requestId: req.id, actorId: user.id, type: "accepted", at });
  });
}

/**
 * «Выполнено» — только основной исполнитель, in_progress → done.
 * 1..5 фото результата обязательно, комментарий необязателен. completed_at ставит сервер.
 */
export async function completeRequest(user: Actor, input: CompleteRequestInput): Promise<void> {
  await db.transaction(async (tx) => {
    const { req, rel } = await loadForUpdate(tx, user, input.requestId);
    if (!rel.isExecutor) throw forbidden("Отметить выполнение может только основной исполнитель.");
    if (req.status !== "in_progress") {
      throw invalidState(
        req.status === "assigned"
          ? "Сначала нажмите «Принял»."
          : "Сейчас эту заявку нельзя отметить выполненной.",
      );
    }
    const fe: Record<string, string> = {};
    const comment = cleanText(input.comment);
    checkLength(fe, "comment", comment, TEXT_LIMITS.comment);
    const photos = checkPhotos(fe, input.photos, PHOTO_LIMITS.complete);
    if (fe.photos && photos.length === 0) fe.photos = "Добавьте хотя бы одно фото результата.";
    throwIfErrors(fe);

    const at = new Date();
    await updateRequest(
      tx,
      req.id,
      {
        status: "done",
        completedAt: at,
        completionComment: comment || null,
        problemOpen: false,
      },
      at,
    );
    const eventId = await addEvent(tx, {
      requestId: req.id,
      actorId: user.id,
      type: "completed",
      text: comment || null,
      at,
    });
    await addPhotos(tx, {
      requestId: req.id,
      eventId,
      kind: "result",
      uploadedBy: user.id,
      photos,
      at,
    });
  });
}

/**
 * «Сообщить о проблеме» — основной исполнитель или соисполнитель, в assigned|in_progress.
 * Текст обязателен, до 3 фото. Ставит problem_open = true, статус не меняет.
 */
export async function reportProblem(user: Actor, input: TextWithPhotosInput): Promise<void> {
  await db.transaction(async (tx) => {
    const { req, rel } = await loadForUpdate(tx, user, input.requestId);
    if (!rel.isExecutor && !rel.isCoexecutor) {
      throw forbidden("Сообщить о проблеме может исполнитель или соисполнитель заявки.");
    }
    if (!WORK.includes(req.status)) {
      throw invalidState("Сообщить о проблеме можно только по заявке в работе.");
    }
    const fe: Record<string, string> = {};
    const text = cleanText(input.text);
    if (!text) fe.text = "Опишите проблему: чего не хватает или что мешает.";
    else checkLength(fe, "text", text, TEXT_LIMITS.comment);
    const photos = checkPhotos(fe, input.photos, PHOTO_LIMITS.problem);
    throwIfErrors(fe);

    const at = new Date();
    await updateRequest(tx, req.id, { problemOpen: true }, at);
    const eventId = await addEvent(tx, {
      requestId: req.id,
      actorId: user.id,
      type: "problem",
      text,
      at,
    });
    await addPhotos(tx, {
      requestId: req.id,
      eventId,
      kind: "comment",
      uploadedBy: user.id,
      photos,
      at,
    });
  });
}

// ─── Все ─────────────────────────────────────────────────────

/** Комментарий — любой, кто видит заявку, в любом статусе. Текст обязателен, до 3 фото. */
export async function addComment(user: Actor, input: TextWithPhotosInput): Promise<void> {
  await db.transaction(async (tx) => {
    const { req } = await loadForUpdate(tx, user, input.requestId);
    const fe: Record<string, string> = {};
    const text = cleanText(input.text);
    if (!text) fe.text = "Напишите комментарий.";
    else checkLength(fe, "text", text, TEXT_LIMITS.comment);
    const photos = checkPhotos(fe, input.photos, PHOTO_LIMITS.comment);
    throwIfErrors(fe);

    const at = new Date();
    await updateRequest(tx, req.id, {}, at);
    const eventId = await addEvent(tx, {
      requestId: req.id,
      actorId: user.id,
      type: "comment",
      text,
      at,
    });
    await addPhotos(tx, {
      requestId: req.id,
      eventId,
      kind: "comment",
      uploadedBy: user.id,
      photos,
      at,
    });
  });
}
