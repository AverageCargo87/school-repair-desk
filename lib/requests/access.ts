/**
 * Доступ к заявкам: SQL-условия видимости по ролям и проверка одной заявки.
 * Серверный модуль.
 */
import { and, eq, or, sql, type SQL } from "drizzle-orm";
import { db, type DbOrTx } from "@/db";
import {
  requestCoexecutors,
  requests,
  userBuildings,
  type Role,
} from "@/db/schema";
import { isDispatcherRole } from "@/lib/roles";
import {
  allowedActions,
  buildRelation,
  canView,
  type AllowedActions,
  type ViewerRelation,
} from "./rules";

/** Минимум о пользователе, который нужен сервису и запросам. */
export type Actor = { id: number; role: Role };

/**
 * SQL-условие видимости заявок (`requests`) для пользователя.
 * dispatcher/admin → undefined (видно всё);
 * requester → здание из user_buildings или автор;
 * executor → основной исполнитель или соисполнитель.
 */
export function visibleRequestsWhere(user: Actor): SQL | undefined {
  if (isDispatcherRole(user.role)) return undefined;
  if (user.role === "requester") {
    return or(
      sql`${requests.buildingId} in (select ${userBuildings.buildingId} from ${userBuildings} where ${userBuildings.userId} = ${user.id})`,
      eq(requests.authorId, user.id),
    );
  }
  if (user.role === "executor") {
    return or(
      eq(requests.executorId, user.id),
      sql`exists (select 1 from ${requestCoexecutors} where ${requestCoexecutors.requestId} = ${requests.id} and ${requestCoexecutors.userId} = ${user.id})`,
    );
  }
  return sql`false`;
}

type RequestKey = {
  id: number;
  authorId: number;
  buildingId: number;
  executorId: number | null;
};

/** Отношение пользователя к заявке (автор / исполнитель / соисполнитель / здание закреплено). */
export async function getViewerRelation(
  user: Actor,
  req: RequestKey,
  dbx: DbOrTx = db,
): Promise<ViewerRelation> {
  let isCoexecutor = false;
  let inMyBuildings = false;
  if (user.role === "executor" && req.executorId !== user.id) {
    const rows = await dbx
      .select({ userId: requestCoexecutors.userId })
      .from(requestCoexecutors)
      .where(
        and(eq(requestCoexecutors.requestId, req.id), eq(requestCoexecutors.userId, user.id)),
      )
      .limit(1);
    isCoexecutor = rows.length > 0;
  }
  if (user.role === "requester") {
    const rows = await dbx
      .select({ userId: userBuildings.userId })
      .from(userBuildings)
      .where(and(eq(userBuildings.userId, user.id), eq(userBuildings.buildingId, req.buildingId)))
      .limit(1);
    inMyBuildings = rows.length > 0;
  }
  return buildRelation(user, req, { isCoexecutor, inMyBuildings });
}

/** Может ли пользователь видеть заявку. */
export async function canViewRequest(
  user: Actor,
  req: RequestKey,
  dbx: DbOrTx = db,
): Promise<boolean> {
  if (isDispatcherRole(user.role)) return true;
  return canView(await getViewerRelation(user, req, dbx));
}

/** Может ли пользователь видеть заявку с данным номером (false, если заявки нет). */
export async function canViewRequestId(
  user: Actor,
  requestId: number,
  dbx: DbOrTx = db,
): Promise<boolean> {
  const row = (
    await dbx
      .select({
        id: requests.id,
        authorId: requests.authorId,
        buildingId: requests.buildingId,
        executorId: requests.executorId,
      })
      .from(requests)
      .where(eq(requests.id, requestId))
      .limit(1)
  )[0];
  if (!row) return false;
  return canViewRequest(user, row, dbx);
}

/** Отношение + доступные действия для заявки. */
export async function getRequestPermissions(
  user: Actor,
  req: RequestKey & { status: Parameters<typeof allowedActions>[1]["status"]; problemOpen: boolean },
  dbx: DbOrTx = db,
): Promise<{ relation: ViewerRelation; canView: boolean; allowed: AllowedActions }> {
  const relation = await getViewerRelation(user, req, dbx);
  return {
    relation,
    canView: canView(relation),
    allowed: allowedActions(relation, req),
  };
}
