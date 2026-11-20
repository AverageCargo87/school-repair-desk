import "./env";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";
import { db } from "@/db";
import { buildings, userBuildings, users, type Role } from "@/db/schema";
import type { Actor } from "@/lib/requests/access";
import { ServiceError, type ServiceErrorCode } from "@/lib/requests/service";
import type { PhotoInput } from "@/lib/requests/service";

let migrated = false;

/** Применить миграции к базе в памяти (один раз на процесс). */
export async function setupDb(): Promise<void> {
  if (migrated) return;
  await migrate(db as unknown as Parameters<typeof migrate>[0], { migrationsFolder: "drizzle" });
  migrated = true;
}

/** Очистить все таблицы. */
export async function resetDb(): Promise<void> {
  await db.execute(
    sql`truncate table request_photos, request_events, request_coexecutors, requests, sessions, user_buildings, users, buildings restart identity cascade`,
  );
}

export type Fixtures = Awaited<ReturnType<typeof makeFixtures>>;

/**
 * Здания b1, b2 (+ отключённое bOff); заявители reqA и reqA2 (оба b1), reqB (b2);
 * распределитель disp, админ admin; исполнители ex1, ex2, ex3 и отключённый exOff.
 */
export async function makeFixtures() {
  const [b1, b2, bOff] = await db
    .insert(buildings)
    .values([
      { address: "ул. Первая, д. 1" },
      { address: "ул. Вторая, д. 2" },
      { address: "ул. Закрытая, д. 3", active: false },
    ])
    .returning();

  async function user(login: string, role: Role, active = true): Promise<Actor> {
    const [u] = await db
      .insert(users)
      .values({ login, fullName: `Тестов ${login}`, role, active })
      .returning({ id: users.id, role: users.role });
    return u;
  }

  const reqA = await user("reqa", "requester");
  const reqA2 = await user("reqa2", "requester");
  const reqB = await user("reqb", "requester");
  const disp = await user("disp", "dispatcher");
  const admin = await user("admin", "admin");
  const ex1 = await user("ex1", "executor");
  const ex2 = await user("ex2", "executor");
  const ex3 = await user("ex3", "executor");
  const exOff = await user("exoff", "executor", false);

  await db.insert(userBuildings).values([
    { userId: reqA.id, buildingId: b1.id },
    { userId: reqA2.id, buildingId: b1.id },
    { userId: reqB.id, buildingId: b2.id },
    { userId: reqB.id, buildingId: bOff.id },
  ]);

  return { b1, b2, bOff, reqA, reqA2, reqB, disp, admin, ex1, ex2, ex3, exOff };
}

let photoSeq = 0;

/** Метаданные «сохранённого» фото (файл на диске для сервиса не нужен). */
export function fakePhoto(): PhotoInput {
  photoSeq += 1;
  return {
    id: photoSeq.toString(16).padStart(32, "0"),
    fileName: `photo${photoSeq}.jpg`,
    mime: "image/jpeg",
    size: 1000,
  };
}

/** Ожидать ServiceError с данным кодом. */
export async function expectServiceError(
  promise: Promise<unknown>,
  code: ServiceErrorCode,
  field?: string,
): Promise<ServiceError> {
  try {
    await promise;
  } catch (e) {
    assert.ok(e instanceof ServiceError, `ожидалась ServiceError, получено: ${String(e)}`);
    assert.equal(e.code, code, `код ошибки: ${e.code} (${e.message})`);
    if (field) assert.ok(e.fieldErrors?.[field], `нет fieldErrors.${field}: ${JSON.stringify(e.fieldErrors)}`);
    return e;
  }
  assert.fail(`ожидалась ошибка ${code}, но действие прошло`);
}

export function tomorrow(today: string): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
