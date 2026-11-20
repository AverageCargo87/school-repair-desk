/**
 * Чтение заявок с учётом видимости по ролям. Серверный модуль.
 * Изменения — только через ./service.ts.
 */
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
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
  type RequestStatus,
  type Role,
  type Urgency,
} from "@/db/schema";
import { isDispatcherRole } from "@/lib/roles";
import { addDays, isOverdue, isValidDateStr, mskDayStart, todayMsk } from "@/lib/time";
import { ACTIVE_STATUSES, CLOSED_STATUSES, type StatusGroup } from "./constants";
import { getViewerRelation, visibleRequestsWhere, type Actor } from "./access";
import {
  allowedActions,
  canView,
  type AllowedActions,
  type ViewerRelation,
} from "./rules";

// ─── Типы ────────────────────────────────────────────────────

export type PersonRef = { id: number; fullName: string };

export type RequestSort =
  /** Распределитель: проблема → новые аварийные → новые → просроченные → остальные (новые сверху). */
  | "dispatcher"
  /** Исполнитель: просроченные, затем по сроку (ближайший сверху). */
  | "deadline"
  /** По дате создания, новые сверху. */
  | "created"
  /** По последнему изменению, свежие сверху. */
  | "updated";

export type RequestListFilters = {
  /** Точный статус (или несколько). */
  status?: RequestStatus | RequestStatus[];
  /** active = new/assigned/in_progress, closed = done/rejected/cancelled. */
  statusGroup?: StatusGroup;
  buildingId?: number;
  urgency?: Urgency;
  /** Исполнитель — основной ИЛИ соисполнитель. */
  executorId?: number;
  authorId?: number;
  /** Поиск: номер («17», «№17») или текст (описание, где именно, адрес). */
  q?: string;
  /** Только с открытой проблемой. */
  onlyProblem?: boolean;
  /** Только просроченные (срок < сегодня МСК и assigned|in_progress). */
  onlyOverdue?: boolean;
  /** Только новые (status = new). */
  onlyNew?: boolean;
  /** Дата создания с (включительно), 'YYYY-MM-DD' по Москве. */
  createdFrom?: string;
  /** Дата создания по (включительно), 'YYYY-MM-DD' по Москве. */
  createdTo?: string;
  /** Порядок. По умолчанию: dispatcher/admin → dispatcher; executor → deadline (closed → updated); requester → created. */
  sort?: RequestSort;
  /** Ограничение количества, по умолчанию 500; null — без ограничения. */
  limit?: number | null;
};

export type RequestListRow = {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  status: RequestStatus;
  urgency: Urgency;
  buildingId: number;
  buildingAddress: string;
  location: string | null;
  description: string;
  authorId: number;
  authorName: string;
  executorId: number | null;
  executorName: string | null;
  coexecutors: PersonRef[];
  /** 'YYYY-MM-DD' или null. */
  deadline: string | null;
  dispatcherComment: string | null;
  acceptedAt: Date | null;
  completedAt: Date | null;
  completionComment: string | null;
  problemOpen: boolean;
  /** Всего фото по заявке (всех видов). */
  photoCount: number;
  /** Просрочена (вычислено по Москве). */
  isOverdue: boolean;
  /** Заявку создал текущий пользователь. */
  isMine: boolean;
  /** Роль текущего пользователя-исполнителя в заявке. */
  myRole: "executor" | "coexecutor" | null;
};

export type PhotoRef = {
  id: string;
  kind: PhotoKind;
  fileName: string;
  mime: string;
  size: number;
  createdAt: Date;
  eventId: number | null;
  uploadedBy: number | null;
  /** Адрес для <img src>: /photos/<id>. */
  url: string;
};

export type RequestEventView = {
  id: number;
  type: EventType;
  text: string | null;
  meta: EventMeta | null;
  createdAt: Date;
  actor: (PersonRef & { role: Role }) | null;
  photos: PhotoRef[];
  /** Для assigned/reassigned/reopened: ФИО из meta (исполнитель, соисполнители). */
  executorName: string | null;
  coexecutorNames: string[];
};

export type RequestDetail = {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  status: RequestStatus;
  urgency: Urgency;
  location: string | null;
  description: string;
  deadline: string | null;
  dispatcherComment: string | null;
  acceptedAt: Date | null;
  completedAt: Date | null;
  completionComment: string | null;
  problemOpen: boolean;
  isOverdue: boolean;
  building: { id: number; address: string };
  author: PersonRef & { role: Role };
  executor: PersonRef | null;
  coexecutors: PersonRef[];
  /** Фото по видам: problem — заявителя, result — результата, comment — к комментариям/проблемам. */
  photos: Record<PhotoKind, PhotoRef[]>;
  /** Лента событий в хронологическом порядке (старые сверху). */
  events: RequestEventView[];
  /** Последнее событие «проблема» (для панели распределителя). */
  lastProblem: RequestEventView | null;
  /** Отношение текущего пользователя к заявке. */
  viewer: ViewerRelation;
  /** Какие действия жизненного цикла доступны текущему пользователю. */
  allowed: AllowedActions;
};

export type DispatcherCounters = {
  /** status = new */
  new: number;
  /** problem_open в активных */
  problem: number;
  /** просроченные */
  overdue: number;
  /** status = assigned */
  assigned: number;
  /** status = in_progress */
  inProgress: number;
  /** assigned + in_progress («у исполнителей») */
  inWork: number;
  /** new + assigned + in_progress */
  active: number;
};

export type ExecutorOption = {
  id: number;
  fullName: string;
  active: boolean;
  /** Сколько активных заявок (assigned|in_progress), где он основной исполнитель. */
  activeCount: number;
};

export type BuildingOption = { id: number; address: string; active: boolean };

// ─── Помощники ───────────────────────────────────────────────

const author = alias(users, "author");
const executor = alias(users, "executor");

function overdueExpr(today: string): SQL<boolean> {
  return sql<boolean>`(${requests.deadline} is not null and ${requests.deadline} < ${today} and ${requests.status} in ('assigned', 'in_progress'))`;
}

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

function photoUrl(id: string): string {
  return `/photos/${id}`;
}

function toPhotoRef(p: typeof requestPhotos.$inferSelect): PhotoRef {
  return {
    id: p.id,
    kind: p.kind,
    fileName: p.fileName,
    mime: p.mime,
    size: p.size,
    createdAt: p.createdAt,
    eventId: p.eventId,
    uploadedBy: p.uploadedBy,
    url: photoUrl(p.id),
  };
}

function defaultSort(user: Actor, filters: RequestListFilters): RequestSort {
  if (isDispatcherRole(user.role)) return "dispatcher";
  if (user.role === "executor") return filters.statusGroup === "closed" ? "updated" : "deadline";
  return "created";
}

function buildConditions(user: Actor, f: RequestListFilters, today: string): SQL[] {
  const conds: SQL[] = [];
  const vis = visibleRequestsWhere(user);
  if (vis) conds.push(vis);

  if (f.status) {
    const list = Array.isArray(f.status) ? f.status : [f.status];
    if (list.length) conds.push(inArray(requests.status, list));
  }
  if (f.statusGroup === "active") conds.push(inArray(requests.status, [...ACTIVE_STATUSES]));
  if (f.statusGroup === "closed") conds.push(inArray(requests.status, [...CLOSED_STATUSES]));
  if (f.buildingId) conds.push(eq(requests.buildingId, f.buildingId));
  if (f.urgency) conds.push(eq(requests.urgency, f.urgency));
  if (f.authorId) conds.push(eq(requests.authorId, f.authorId));
  if (f.executorId) {
    conds.push(
      or(
        eq(requests.executorId, f.executorId),
        sql`exists (select 1 from ${requestCoexecutors} where ${requestCoexecutors.requestId} = ${requests.id} and ${requestCoexecutors.userId} = ${f.executorId})`,
      )!,
    );
  }
  if (f.onlyProblem) {
    conds.push(eq(requests.problemOpen, true));
    conds.push(inArray(requests.status, [...ACTIVE_STATUSES]));
  }
  if (f.onlyOverdue) conds.push(overdueExpr(today));
  if (f.onlyNew) conds.push(eq(requests.status, "new"));
  if (f.createdFrom && isValidDateStr(f.createdFrom)) {
    conds.push(gte(requests.createdAt, mskDayStart(f.createdFrom)));
  }
  if (f.createdTo && isValidDateStr(f.createdTo)) {
    conds.push(lt(requests.createdAt, mskDayStart(addDays(f.createdTo, 1))));
  }
  const q = (f.q ?? "").trim();
  if (q) {
    const num = q.replace(/^(№|#|n)\s*/i, "");
    const pattern = `%${escapeLike(q)}%`;
    const textCond = or(
      ilike(requests.description, pattern),
      ilike(requests.location, pattern),
      ilike(buildings.address, pattern),
      ilike(author.fullName, pattern),
    )!;
    if (/^\d{1,9}$/.test(num)) {
      conds.push(or(eq(requests.id, Number(num)), textCond)!);
    } else {
      conds.push(textCond);
    }
  }
  return conds;
}

function orderFor(sort: RequestSort, today: string): SQL[] {
  const overdue = overdueExpr(today);
  switch (sort) {
    case "dispatcher":
      return [
        sql`(${requests.problemOpen} and ${requests.status} in ('new', 'assigned', 'in_progress')) desc`,
        sql`(${requests.status} = 'new' and ${requests.urgency} = 'emergency') desc`,
        sql`(${requests.status} = 'new') desc`,
        sql`${overdue} desc`,
        desc(requests.createdAt),
        desc(requests.id),
      ];
    case "deadline":
      return [
        sql`${overdue} desc`,
        sql`${requests.deadline} asc nulls last`,
        desc(requests.id),
      ];
    case "updated":
      return [desc(requests.updatedAt), desc(requests.id)];
    case "created":
    default:
      return [desc(requests.createdAt), desc(requests.id)];
  }
}

async function coexecutorsByRequest(ids: number[]): Promise<Map<number, PersonRef[]>> {
  const map = new Map<number, PersonRef[]>();
  if (ids.length === 0) return map;
  const rows = await db
    .select({
      requestId: requestCoexecutors.requestId,
      id: users.id,
      fullName: users.fullName,
    })
    .from(requestCoexecutors)
    .innerJoin(users, eq(users.id, requestCoexecutors.userId))
    .where(inArray(requestCoexecutors.requestId, ids))
    .orderBy(asc(users.fullName));
  for (const r of rows) {
    const list = map.get(r.requestId) ?? [];
    list.push({ id: r.id, fullName: r.fullName });
    map.set(r.requestId, list);
  }
  return map;
}

// ─── Списки ──────────────────────────────────────────────────

/** Список заявок с учётом видимости пользователя и фильтров. */
export async function listRequests(
  user: Actor,
  filters: RequestListFilters = {},
): Promise<RequestListRow[]> {
  const today = todayMsk();
  const conds = buildConditions(user, filters, today);
  const sort = filters.sort ?? defaultSort(user, filters);
  const limit = filters.limit === undefined ? 500 : filters.limit;

  const base = db
    .select({
      id: requests.id,
      createdAt: requests.createdAt,
      updatedAt: requests.updatedAt,
      status: requests.status,
      urgency: requests.urgency,
      buildingId: requests.buildingId,
      buildingAddress: buildings.address,
      location: requests.location,
      description: requests.description,
      authorId: requests.authorId,
      authorName: author.fullName,
      executorId: requests.executorId,
      executorName: executor.fullName,
      deadline: requests.deadline,
      dispatcherComment: requests.dispatcherComment,
      acceptedAt: requests.acceptedAt,
      completedAt: requests.completedAt,
      completionComment: requests.completionComment,
      problemOpen: requests.problemOpen,
      // Внешняя ссылка написана явно: в полях select drizzle может не квалифицировать колонки.
      photoCount: sql<number>`(select count(*)::int from request_photos p where p.request_id = "requests"."id")`,
    })
    .from(requests)
    .innerJoin(buildings, eq(buildings.id, requests.buildingId))
    .innerJoin(author, eq(author.id, requests.authorId))
    .leftJoin(executor, eq(executor.id, requests.executorId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(...orderFor(sort, today));

  const rows = limit === null ? await base : await base.limit(limit);
  const co = await coexecutorsByRequest(rows.map((r) => r.id));

  return rows.map((r) => {
    const coexecutors = co.get(r.id) ?? [];
    return {
      ...r,
      photoCount: Number(r.photoCount) || 0,
      coexecutors,
      isOverdue: isOverdue(r.deadline, r.status, today),
      isMine: r.authorId === user.id,
      myRole:
        r.executorId === user.id
          ? "executor"
          : coexecutors.some((c) => c.id === user.id)
            ? "coexecutor"
            : null,
    };
  });
}

export type RequestExportRow = RequestListRow & {
  /** Текст последней проблемы от исполнителя/соисполнителя. */
  lastProblem: string | null;
};

/** Для выгрузки в Excel: список без ограничения + текст последней проблемы. */
export async function listRequestsForExport(
  user: Actor,
  filters: Omit<RequestListFilters, "limit"> = {},
): Promise<RequestExportRow[]> {
  const rows = await listRequests(user, { sort: "created", ...filters, limit: null });
  const ids = rows.map((r) => r.id);
  const last = new Map<number, string | null>();
  if (ids.length) {
    const problems = await db
      .selectDistinctOn([requestEvents.requestId], {
        requestId: requestEvents.requestId,
        text: requestEvents.text,
      })
      .from(requestEvents)
      .where(and(inArray(requestEvents.requestId, ids), eq(requestEvents.type, "problem")))
      .orderBy(requestEvents.requestId, desc(requestEvents.createdAt), desc(requestEvents.id));
    for (const p of problems) last.set(p.requestId, p.text);
  }
  return rows.map((r) => ({ ...r, lastProblem: last.get(r.id) ?? null }));
}

// ─── Карточка ────────────────────────────────────────────────

/** Всё для карточки заявки. null — заявки нет или пользователь её не видит. */
export async function getRequestDetail(
  user: Actor,
  id: number,
): Promise<RequestDetail | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const today = todayMsk();
  const row = (
    await db
      .select({
        req: requests,
        buildingAddress: buildings.address,
        authorName: author.fullName,
        authorRole: author.role,
        executorName: executor.fullName,
      })
      .from(requests)
      .innerJoin(buildings, eq(buildings.id, requests.buildingId))
      .innerJoin(author, eq(author.id, requests.authorId))
      .leftJoin(executor, eq(executor.id, requests.executorId))
      .where(eq(requests.id, id))
      .limit(1)
  )[0];
  if (!row) return null;
  const req = row.req;

  const viewer = await getViewerRelation(user, req);
  if (!canView(viewer)) return null;

  const [coRows, photoRows, eventRows] = await Promise.all([
    db
      .select({ id: users.id, fullName: users.fullName })
      .from(requestCoexecutors)
      .innerJoin(users, eq(users.id, requestCoexecutors.userId))
      .where(eq(requestCoexecutors.requestId, id))
      .orderBy(asc(users.fullName)),
    db
      .select()
      .from(requestPhotos)
      .where(eq(requestPhotos.requestId, id))
      .orderBy(asc(requestPhotos.createdAt), asc(requestPhotos.id)),
    db
      .select({
        ev: requestEvents,
        actorName: users.fullName,
        actorRole: users.role,
      })
      .from(requestEvents)
      .leftJoin(users, eq(users.id, requestEvents.actorId))
      .where(eq(requestEvents.requestId, id))
      .orderBy(asc(requestEvents.createdAt), asc(requestEvents.id)),
  ]);

  const photos: Record<PhotoKind, PhotoRef[]> = { problem: [], result: [], comment: [] };
  const photosByEvent = new Map<number, PhotoRef[]>();
  for (const p of photoRows) {
    const ref = toPhotoRef(p);
    photos[p.kind].push(ref);
    if (p.eventId != null) {
      const list = photosByEvent.get(p.eventId) ?? [];
      list.push(ref);
      photosByEvent.set(p.eventId, list);
    }
  }

  // ФИО исполнителей, упомянутых в meta событий назначения.
  const metaIds = new Set<number>();
  for (const { ev } of eventRows) {
    if (ev.meta?.executorId) metaIds.add(ev.meta.executorId);
    for (const cid of ev.meta?.coexecutorIds ?? []) metaIds.add(cid);
  }
  const names = new Map<number, string>();
  if (metaIds.size) {
    const rows = await db
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(inArray(users.id, [...metaIds]));
    for (const r of rows) names.set(r.id, r.fullName);
  }

  const events: RequestEventView[] = eventRows.map(({ ev, actorName, actorRole }) => ({
    id: ev.id,
    type: ev.type,
    text: ev.text,
    meta: ev.meta ?? null,
    createdAt: ev.createdAt,
    actor:
      ev.actorId != null && actorName != null && actorRole != null
        ? { id: ev.actorId, fullName: actorName, role: actorRole }
        : null,
    photos: photosByEvent.get(ev.id) ?? [],
    executorName: ev.meta?.executorId ? (names.get(ev.meta.executorId) ?? null) : null,
    coexecutorNames: (ev.meta?.coexecutorIds ?? [])
      .map((cid) => names.get(cid))
      .filter((n): n is string => Boolean(n)),
  }));

  const lastProblem = [...events].reverse().find((e) => e.type === "problem") ?? null;

  return {
    id: req.id,
    createdAt: req.createdAt,
    updatedAt: req.updatedAt,
    status: req.status,
    urgency: req.urgency,
    location: req.location,
    description: req.description,
    deadline: req.deadline,
    dispatcherComment: req.dispatcherComment,
    acceptedAt: req.acceptedAt,
    completedAt: req.completedAt,
    completionComment: req.completionComment,
    problemOpen: req.problemOpen,
    isOverdue: isOverdue(req.deadline, req.status, today),
    building: { id: req.buildingId, address: row.buildingAddress },
    author: { id: req.authorId, fullName: row.authorName, role: row.authorRole },
    executor:
      req.executorId != null && row.executorName != null
        ? { id: req.executorId, fullName: row.executorName }
        : null,
    coexecutors: coRows,
    photos,
    events,
    lastProblem,
    viewer,
    allowed: allowedActions(viewer, req),
  };
}

// ─── Счётчики и справочники ──────────────────────────────────

function countersSelect(today: string) {
  const overdue = overdueExpr(today);
  return {
    new: sql<number>`count(*) filter (where ${requests.status} = 'new')::int`,
    problem: sql<number>`count(*) filter (where ${requests.problemOpen} and ${requests.status} in ('new', 'assigned', 'in_progress'))::int`,
    overdue: sql<number>`count(*) filter (where ${overdue})::int`,
    assigned: sql<number>`count(*) filter (where ${requests.status} = 'assigned')::int`,
    inProgress: sql<number>`count(*) filter (where ${requests.status} = 'in_progress')::int`,
    inWork: sql<number>`count(*) filter (where ${requests.status} in ('assigned', 'in_progress'))::int`,
    active: sql<number>`count(*) filter (where ${requests.status} in ('new', 'assigned', 'in_progress'))::int`,
  };
}

function normalizeCounters(r: Record<keyof DispatcherCounters, unknown> | undefined): DispatcherCounters {
  return {
    new: Number(r?.new ?? 0),
    problem: Number(r?.problem ?? 0),
    overdue: Number(r?.overdue ?? 0),
    assigned: Number(r?.assigned ?? 0),
    inProgress: Number(r?.inProgress ?? 0),
    inWork: Number(r?.inWork ?? 0),
    active: Number(r?.active ?? 0),
  };
}

/** Счётчики по ВСЕМ заявкам (для экрана распределителя; вызывать только для dispatcher/admin). */
export async function dispatcherCounters(): Promise<DispatcherCounters> {
  const rows = await db.select(countersSelect(todayMsk())).from(requests);
  return normalizeCounters(rows[0]);
}

/** Те же счётчики, но только по заявкам, видимым пользователю (для вкладок любой роли). */
export async function requestCounters(user: Actor): Promise<DispatcherCounters> {
  const vis = visibleRequestsWhere(user);
  const rows = await db.select(countersSelect(todayMsk())).from(requests).where(vis);
  return normalizeCounters(rows[0]);
}

/** Исполнители для выбора (по ФИО). По умолчанию только активные. */
export async function listExecutors(
  opts: { includeInactive?: boolean } = {},
): Promise<ExecutorOption[]> {
  const conds: SQL[] = [eq(users.role, "executor")];
  if (!opts.includeInactive) conds.push(eq(users.active, true));
  const rows = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      active: users.active,
      // Внешняя ссылка написана явно: в полях select drizzle не квалифицирует колонки одной таблицы.
      activeCount: sql<number>`(select count(*)::int from requests r where r.executor_id = "users"."id" and r.status in ('assigned', 'in_progress'))`,
    })
    .from(users)
    .where(and(...conds))
    .orderBy(asc(users.fullName));
  return rows.map((r) => ({ ...r, activeCount: Number(r.activeCount) || 0 }));
}

/**
 * Здания, доступные пользователю для создания заявки и фильтров:
 * requester — закреплённые за ним; dispatcher/admin — все; executor — пусто.
 * По умолчанию только активные.
 */
export async function listBuildingsForUser(
  user: Actor,
  opts: { includeInactive?: boolean } = {},
): Promise<BuildingOption[]> {
  if (user.role === "executor") return [];
  const conds: SQL[] = [];
  if (!opts.includeInactive) conds.push(eq(buildings.active, true));
  if (user.role === "requester") {
    conds.push(
      sql`${buildings.id} in (select ${userBuildings.buildingId} from ${userBuildings} where ${userBuildings.userId} = ${user.id})`,
    );
  }
  return db
    .select({ id: buildings.id, address: buildings.address, active: buildings.active })
    .from(buildings)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(buildings.address));
}

/** Фото + заявка, если пользователь её видит (для GET /photos/[id]); иначе null. */
export async function getPhotoForUser(
  user: Actor,
  photoId: string,
): Promise<(typeof requestPhotos.$inferSelect) | null> {
  const row = (
    await db
      .select({
        photo: requestPhotos,
        req: {
          id: requests.id,
          authorId: requests.authorId,
          buildingId: requests.buildingId,
          executorId: requests.executorId,
        },
      })
      .from(requestPhotos)
      .innerJoin(requests, eq(requests.id, requestPhotos.requestId))
      .where(eq(requestPhotos.id, photoId))
      .limit(1)
  )[0];
  if (!row) return null;
  const rel = await getViewerRelation(user, row.req);
  return canView(rel) ? row.photo : null;
}
