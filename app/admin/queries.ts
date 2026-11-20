/**
 * Чтение данных для админки (сотрудники, здания). Серверный модуль.
 * Вызывать только после requireRole(["admin"]).
 */
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { buildings, userBuildings, users } from "@/db/schema";
import type { AdminBuildingRef, AdminBuildingRow, AdminUserRow } from "./types";

export type { AdminBuildingRef, AdminBuildingRow, AdminUserRow };

const ACTIVE_WORK_SQL = sql<number>`(
  select count(*)::int from requests r
  where r.status in ('assigned', 'in_progress')
    and (r.executor_id = "users"."id"
      or exists (select 1 from request_coexecutors rc where rc.request_id = r.id and rc.user_id = "users"."id"))
)`;

const userColumns = {
  id: users.id,
  fullName: users.fullName,
  login: users.login,
  role: users.role,
  active: users.active,
  hasPassword: sql<boolean>`(${users.passwordHash} is not null)`,
  hasLink: sql<boolean>`(${users.loginTokenHash} is not null)`,
  createdAt: users.createdAt,
  // Внешняя ссылка "users"."id" написана явно: внутри подзапроса drizzle не квалифицирует колонки.
  activeWork: ACTIVE_WORK_SQL,
};

async function buildingsByUser(userId?: number): Promise<Map<number, AdminBuildingRef[]>> {
  const rows = await db
    .select({
      userId: userBuildings.userId,
      id: buildings.id,
      address: buildings.address,
      active: buildings.active,
    })
    .from(userBuildings)
    .innerJoin(buildings, eq(buildings.id, userBuildings.buildingId))
    .where(userId ? eq(userBuildings.userId, userId) : undefined)
    .orderBy(asc(buildings.address));
  const map = new Map<number, AdminBuildingRef[]>();
  for (const r of rows) {
    const list = map.get(r.userId) ?? [];
    list.push({ id: r.id, address: r.address, active: r.active });
    map.set(r.userId, list);
  }
  return map;
}

function normalizeUser(
  r: Omit<AdminUserRow, "buildings">,
  map: Map<number, AdminBuildingRef[]>,
): AdminUserRow {
  return {
    ...r,
    hasPassword: Boolean(r.hasPassword),
    hasLink: Boolean(r.hasLink),
    activeWork: Number(r.activeWork) || 0,
    buildings: map.get(r.id) ?? [],
  };
}

/** Все сотрудники: сначала активные, по ФИО. */
export async function listUsersForAdmin(): Promise<AdminUserRow[]> {
  const [rows, map] = await Promise.all([
    db.select(userColumns).from(users).orderBy(desc(users.active), asc(users.fullName)),
    buildingsByUser(),
  ]);
  return rows.map((r) => normalizeUser(r, map));
}

/** Один сотрудник (или null). */
export async function getUserForAdmin(id: number): Promise<AdminUserRow | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const [rows, map] = await Promise.all([
    db.select(userColumns).from(users).where(eq(users.id, id)).limit(1),
    buildingsByUser(id),
  ]);
  return rows[0] ? normalizeUser(rows[0], map) : null;
}

/** Все здания (и отключённые) — для чекбоксов в форме сотрудника. */
export async function listAllBuildings(): Promise<AdminBuildingRef[]> {
  return db
    .select({ id: buildings.id, address: buildings.address, active: buildings.active })
    .from(buildings)
    .orderBy(desc(buildings.active), asc(buildings.address));
}

/** Здания со сводкой: заявители, активные и все заявки. */
export async function listBuildingsForAdmin(): Promise<AdminBuildingRow[]> {
  const [rows, links] = await Promise.all([
    db
      .select({
        id: buildings.id,
        address: buildings.address,
        active: buildings.active,
        activeRequests: sql<number>`(select count(*)::int from requests r where r.building_id = "buildings"."id" and r.status in ('new', 'assigned', 'in_progress'))`,
        totalRequests: sql<number>`(select count(*)::int from requests r where r.building_id = "buildings"."id")`,
      })
      .from(buildings)
      .orderBy(desc(buildings.active), asc(buildings.address)),
    db
      .select({
        buildingId: userBuildings.buildingId,
        id: users.id,
        fullName: users.fullName,
      })
      .from(userBuildings)
      .innerJoin(users, eq(users.id, userBuildings.userId))
      .where(and(eq(users.active, true), eq(users.role, "requester")))
      .orderBy(asc(users.fullName)),
  ]);
  const byBuilding = new Map<number, { id: number; fullName: string }[]>();
  for (const l of links) {
    const list = byBuilding.get(l.buildingId) ?? [];
    list.push({ id: l.id, fullName: l.fullName });
    byBuilding.set(l.buildingId, list);
  }
  return rows.map((r) => ({
    ...r,
    activeRequests: Number(r.activeRequests) || 0,
    totalRequests: Number(r.totalRequests) || 0,
    requesters: byBuilding.get(r.id) ?? [],
  }));
}
