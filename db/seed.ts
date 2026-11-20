/**
 * Демо-сид (только для локальной разработки): очищает базу, заводит здания и сотрудников
 * из data/roster.json, администратора `admin`, всем — пароли (консоль + data/credentials.local.csv)
 * и 12 демо-заявок во всех статусах.
 *
 * Пароли демо фиксированные (DEMO_PASSWORD / ADMIN_PASSWORD, см. ниже), чтобы после
 * `npm run db:reset && npm run db:setup` входы не менялись.
 */
import "dotenv/config";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { sql } from "drizzle-orm";
import { db } from "./index";
import {
  buildings,
  requestCoexecutors,
  requestEvents,
  requests,
  users,
  type EventMeta,
  type EventType,
  type RequestStatus,
  type Urgency,
} from "./schema";
import {
  loadRoster,
  printCredentials,
  syncRoster,
  upsertAdmin,
  writeCredentialsCsv,
  CREDENTIALS_PATH,
} from "../lib/roster";
import { addDays, todayMsk } from "../lib/time";

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "demo-pass-2026";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin-pass-2026";
const APP_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");

if (process.env.DATABASE_URL && process.env.SEED_FORCE !== "1") {
  console.error(
    "DATABASE_URL задан — демо-сид удалит ВСЕ данные. Для прода используйте `npm run roster:init`.\n" +
      "Если действительно нужно засеять эту базу демо-данными: SEED_FORCE=1 npm run db:seed",
  );
  process.exit(1);
}

type DemoEvent = {
  type: EventType;
  /** ФИО автора события. */
  by: string;
  at: Date;
  text?: string;
  meta?: EventMeta;
};

type Demo = {
  author: string;
  building: string;
  location?: string;
  description: string;
  urgency: Urgency;
  status: RequestStatus;
  createdAt: Date;
  executor?: string;
  coexecutors?: string[];
  deadline?: string;
  dispatcherComment?: string;
  acceptedAt?: Date;
  completedAt?: Date;
  completionComment?: string;
  problemOpen?: boolean;
  events: DemoEvent[];
};

async function clearUploads() {
  const dir = path.resolve(process.env.UPLOAD_DIR || "uploads");
  try {
    for (const f of await readdir(dir)) await rm(path.join(dir, f), { force: true, recursive: true });
  } catch {
    // каталога нет — ничего страшного
  }
}

async function main() {
  const roster = loadRoster();

  console.log("Очищаю базу…");
  await db.execute(
    sql`truncate table request_photos, request_events, request_coexecutors, requests, sessions, user_buildings, users, buildings restart identity cascade`,
  );
  await clearUploads();

  console.log("Завожу здания и сотрудников из data/roster.json…");
  const admin = await upsertAdmin(db, {
    login: "admin",
    password: ADMIN_PASSWORD,
    fullName: "Администратор системы",
    appUrl: APP_URL,
  });
  const sync = await syncRoster(db, roster, { appUrl: APP_URL, passwordFor: () => DEMO_PASSWORD });
  const credentials = [admin, ...sync.created];

  // Справочники: ФИО → id, адрес → id
  const userRows = await db.select({ id: users.id, fullName: users.fullName }).from(users);
  const uid = new Map(userRows.map((u) => [u.fullName, u.id]));
  const buildingRows = await db.select().from(buildings);
  const bid = new Map(buildingRows.map((b) => [b.address, b.id]));
  const id = (name: string) => {
    const v = uid.get(name);
    if (!v) throw new Error(`Нет сотрудника ${name}`);
    return v;
  };

  // Люди из roster.json (по позициям, без ручного переписывания ФИО)
  const R = roster.requesters;
  const E = roster.executors.map((e) => e.fullName);
  const D = roster.dispatchers[0]?.fullName ?? admin.fullName;
  const req = (i: number) => R[i % R.length];
  const ex = (i: number) => E[i % E.length];
  const bld = (i: number, j = 0) => req(i).buildings[j % req(i).buildings.length];
  // Второй заявитель того же здания, что и req(2) (в roster — Корпус 6, ул. Речная, д. 25)
  const shared = R.find((r) => r !== req(2) && r.buildings.includes(bld(2))) ?? req(4);

  const now = Date.now();
  const ago = (days: number, hours = 0) => new Date(now - (days * 24 + hours) * 3_600_000);
  const today = todayMsk();
  const day = (n: number) => addDays(today, n);
  const assignMeta = (executor: string, co: string[], deadline: string): EventMeta => ({
    executorId: id(executor),
    coexecutorIds: co.map(id),
    deadline,
  });

  const demos: Demo[] = [
    {
      author: req(2).fullName,
      building: bld(2),
      location: "2 этаж, туалет у кабинета 21",
      description: "Течёт труба под раковиной, на полу лужа. Перекрыли кран, но капает.",
      urgency: "emergency",
      status: "new",
      createdAt: ago(0, 2),
      events: [{ type: "created", by: req(2).fullName, at: ago(0, 2) }],
    },
    {
      author: shared.fullName,
      building: bld(2),
      location: "Кабинет 305",
      description: "Не закрывается окно: ручка проворачивается, створка не прижимается.",
      urgency: "current",
      status: "new",
      createdAt: ago(1, 3),
      events: [
        { type: "created", by: shared.fullName, at: ago(1, 3) },
        {
          type: "comment",
          by: req(2).fullName,
          at: ago(0, 20),
          text: "В соседнем кабинете 306 такая же проблема с окном.",
        },
      ],
    },
    {
      author: req(0).fullName,
      building: bld(0),
      location: "1 этаж, коридор у гардероба",
      description: "Перегорели 4 лампы в коридоре, нужны новые (светодиодные трубки 120 см).",
      urgency: "purchase",
      status: "new",
      createdAt: ago(0, 5),
      events: [{ type: "created", by: req(0).fullName, at: ago(0, 5) }],
    },
    {
      author: req(1).fullName,
      building: bld(1, 1),
      location: "Кабинет 12",
      description: "Отвалилась дверная ручка, дверь открывается только ключом.",
      urgency: "current",
      status: "assigned",
      createdAt: ago(2),
      executor: ex(7),
      deadline: day(3),
      dispatcherComment: "Новая ручка есть на складе у завхоза.",
      events: [
        { type: "created", by: req(1).fullName, at: ago(2) },
        {
          type: "assigned",
          by: D,
          at: ago(1),
          text: "Новая ручка есть на складе у завхоза.",
          meta: assignMeta(ex(7), [], day(3)),
        },
      ],
    },
    {
      author: req(3).fullName,
      building: bld(3),
      location: "Спортзал",
      description: "Не горит половина светильников в спортзале, темно заниматься.",
      urgency: "emergency",
      status: "in_progress",
      createdAt: ago(1),
      executor: ex(6),
      coexecutors: [ex(10)],
      deadline: day(1),
      acceptedAt: ago(0, 18),
      events: [
        { type: "created", by: req(3).fullName, at: ago(1) },
        { type: "assigned", by: D, at: ago(0, 20), meta: assignMeta(ex(6), [ex(10)], day(1)) },
        { type: "accepted", by: ex(6), at: ago(0, 18) },
        {
          type: "comment",
          by: req(3).fullName,
          at: ago(0, 16),
          text: "С 17:00 в спортзале секция — желательно закончить до этого времени.",
        },
      ],
    },
    {
      author: req(5).fullName,
      building: bld(5),
      location: "Лестница у столовой",
      description: "Отклеилась плитка на двух ступеньках, можно споткнуться.",
      urgency: "current",
      status: "in_progress",
      createdAt: ago(6),
      executor: ex(8),
      deadline: day(-2),
      acceptedAt: ago(4),
      events: [
        { type: "created", by: req(5).fullName, at: ago(6) },
        { type: "assigned", by: D, at: ago(5), meta: assignMeta(ex(8), [], day(-2)) },
        { type: "accepted", by: ex(8), at: ago(4) },
      ],
    },
    {
      author: req(1).fullName,
      building: bld(1, 0),
      location: "1 этаж, туалет для мальчиков",
      description: "Постоянно течёт вода в бачке унитаза.",
      urgency: "current",
      status: "in_progress",
      createdAt: ago(3),
      executor: ex(1),
      coexecutors: [ex(4)],
      deadline: day(2),
      acceptedAt: ago(2),
      problemOpen: true,
      events: [
        { type: "created", by: req(1).fullName, at: ago(3) },
        { type: "assigned", by: D, at: ago(3, -2), meta: assignMeta(ex(1), [ex(4)], day(2)) },
        { type: "accepted", by: ex(1), at: ago(2) },
        {
          type: "problem",
          by: ex(4),
          at: ago(0, 5),
          text: "Нужен новый поплавковый клапан, на складе нет. Без него не починить.",
        },
      ],
    },
    {
      author: req(0).fullName,
      building: bld(0, 1),
      location: "Библиотека",
      description: "Нужно повесить 3 книжные полки на стену у окна.",
      urgency: "purchase",
      status: "assigned",
      createdAt: ago(1),
      executor: ex(4),
      coexecutors: [ex(2)],
      deadline: day(5),
      dispatcherComment: "Полки уже купили, лежат у завхоза.",
      events: [
        { type: "created", by: req(0).fullName, at: ago(1) },
        {
          type: "assigned",
          by: D,
          at: ago(0, 6),
          text: "Полки уже купили, лежат у завхоза.",
          meta: assignMeta(ex(4), [ex(2)], day(5)),
        },
      ],
    },
    {
      author: req(1).fullName,
      building: bld(1, 2),
      location: "Кабинет 7",
      description: "Заедает замок во входной двери кабинета.",
      urgency: "current",
      status: "done",
      createdAt: ago(8),
      executor: ex(9),
      deadline: day(-4),
      acceptedAt: ago(7, -3),
      completedAt: ago(6),
      completionComment: "Замок смазал и подтянул, открывается легко.",
      events: [
        { type: "created", by: req(1).fullName, at: ago(8) },
        { type: "assigned", by: D, at: ago(7), meta: assignMeta(ex(9), [], day(-4)) },
        { type: "accepted", by: ex(9), at: ago(7, -3) },
        {
          type: "completed",
          by: ex(9),
          at: ago(6),
          text: "Замок смазал и подтянул, открывается легко.",
        },
      ],
    },
    {
      author: req(3).fullName,
      building: bld(3),
      description: "Покрасить забор вокруг школы — облупилась краска.",
      urgency: "current",
      status: "rejected",
      createdAt: ago(10),
      events: [
        { type: "created", by: req(3).fullName, at: ago(10) },
        {
          type: "rejected",
          by: D,
          at: ago(9),
          text: "Покраска забора запланирована на весну отдельным договором.",
          meta: { prevStatus: "new" },
        },
      ],
    },
    {
      author: shared.fullName,
      building: bld(2),
      location: "Кабинет 210",
      description: "Не работает розетка у доски.",
      urgency: "current",
      status: "cancelled",
      createdAt: ago(4),
      events: [
        { type: "created", by: shared.fullName, at: ago(4) },
        {
          type: "cancelled",
          by: shared.fullName,
          at: ago(4, -1),
          text: "Розетка заработала — выбило автомат, включили.",
          meta: { prevStatus: "new" },
        },
      ],
    },
    {
      author: req(2).fullName,
      building: bld(2),
      location: "Столовая",
      description: "Входная дверь в столовую скрипит и не закрывается до конца.",
      urgency: "current",
      status: "assigned",
      createdAt: ago(9),
      executor: ex(11),
      deadline: day(2),
      dispatcherComment: "Дверь снова не закрывается — отрегулируйте доводчик.",
      events: [
        { type: "created", by: req(2).fullName, at: ago(9) },
        { type: "assigned", by: D, at: ago(8), meta: assignMeta(ex(11), [], day(-6)) },
        { type: "accepted", by: ex(11), at: ago(8, -2) },
        { type: "completed", by: ex(11), at: ago(7), text: "Смазал петли." },
        {
          type: "reopened",
          by: D,
          at: ago(1),
          text: "Дверь снова не закрывается — отрегулируйте доводчик.",
          meta: {
            executorId: id(ex(11)),
            coexecutorIds: [],
            deadline: day(2),
            prevCoexecutorIds: [],
            prevDeadline: day(-6),
            prevStatus: "done",
          },
        },
      ],
    },
  ];

  console.log("Создаю демо-заявки…");
  for (const d of demos) {
    const last = d.events[d.events.length - 1]?.at ?? d.createdAt;
    const [row] = await db
      .insert(requests)
      .values({
        authorId: id(d.author),
        buildingId: bid.get(d.building)!,
        location: d.location ?? null,
        description: d.description,
        urgency: d.urgency,
        status: d.status,
        executorId: d.executor ? id(d.executor) : null,
        deadline: d.deadline ?? null,
        dispatcherComment: d.dispatcherComment ?? null,
        acceptedAt: d.acceptedAt ?? null,
        completedAt: d.completedAt ?? null,
        completionComment: d.completionComment ?? null,
        problemOpen: d.problemOpen ?? false,
        createdAt: d.createdAt,
        updatedAt: last,
      })
      .returning({ id: requests.id });
    if (d.coexecutors?.length) {
      await db
        .insert(requestCoexecutors)
        .values(d.coexecutors.map((name) => ({ requestId: row.id, userId: id(name) })));
    }
    await db.insert(requestEvents).values(
      d.events.map((e) => ({
        requestId: row.id,
        actorId: id(e.by),
        type: e.type,
        text: e.text ?? null,
        meta: e.meta ?? null,
        createdAt: e.at,
      })),
    );
  }

  writeCredentialsCsv(credentials, "overwrite");

  console.log("\n===============================================");
  console.log("  ГОТОВО. Демо-данные загружены.");
  console.log("===============================================\n");
  console.log(`Зданий: ${buildingRows.length}, сотрудников: ${credentials.length}, заявок: ${demos.length}`);
  console.log(`Пароль всех демо-сотрудников: ${DEMO_PASSWORD}; администратор admin / ${ADMIN_PASSWORD}\n`);
  printCredentials(credentials);
  console.log(`\nЛогины, пароли и ссылки сохранены в ${path.relative(process.cwd(), CREDENTIALS_PATH)}\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
