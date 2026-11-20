import { fakePhoto, makeFixtures, resetDb, setupDb, type Fixtures } from "./helpers/db";
import assert from "node:assert/strict";
import { before, beforeEach, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { requests } from "@/db/schema";
import { addDays, todayMsk } from "@/lib/time";
import { canViewRequestId } from "@/lib/requests/access";
import {
  acceptRequest,
  addComment,
  assignRequest,
  createRequest,
  rejectRequest,
  reportProblem,
} from "@/lib/requests/service";
import { dispatchListFilters, parseDispatchQuery } from "@/components/dispatcher/dispatch-params";
import {
  dispatcherCounters,
  getPhotoForUser,
  getRequestDetail,
  listBuildingsForUser,
  listExecutors,
  listRequests,
  listRequestsForExport,
  requestCounters,
} from "@/lib/requests/queries";

let f: Fixtures;
const today = todayMsk();

async function create(author = f.reqA, buildingId = f.b1.id, urgency: "emergency" | "current" | "purchase" = "current", description = "Поломка") {
  return (await createRequest(author, { buildingId, description, urgency })).id;
}

before(setupDb);
beforeEach(async () => {
  await resetDb();
  f = await makeFixtures();
});

describe("видимость", () => {
  it("заявитель видит все заявки своих зданий (и чужие в них), но не другие здания", async () => {
    const a = await create(f.reqA, f.b1.id);
    const a2 = await create(f.reqA2, f.b1.id);
    const b = await create(f.reqB, f.b2.id);

    const forA = await listRequests(f.reqA);
    assert.deepEqual(forA.map((r) => r.id).sort(), [a, a2].sort());
    assert.equal(forA.find((r) => r.id === a)?.isMine, true);
    assert.equal(forA.find((r) => r.id === a2)?.isMine, false);

    assert.deepEqual((await listRequests(f.reqB)).map((r) => r.id), [b]);
    assert.equal(await getRequestDetail(f.reqB, a), null, "чужое здание — нет карточки");
    assert.ok(await getRequestDetail(f.reqA2, a), "второй заявитель того же здания видит");
    assert.equal(await canViewRequestId(f.reqB, a), false);
    assert.equal(await canViewRequestId(f.reqA2, a), true);
  });

  it("исполнитель видит только заявки, где он основной или соисполнитель", async () => {
    const a = await create();
    const b = await create();
    const c = await create();
    await assignRequest(f.disp, { requestId: a, executorId: f.ex1.id, deadline: today });
    await assignRequest(f.disp, { requestId: b, executorId: f.ex2.id, coexecutorIds: [f.ex1.id], deadline: today });

    const rows = await listRequests(f.ex1);
    assert.deepEqual(rows.map((r) => r.id).sort(), [a, b].sort());
    assert.equal(rows.find((r) => r.id === a)?.myRole, "executor");
    assert.equal(rows.find((r) => r.id === b)?.myRole, "coexecutor");
    assert.equal(await getRequestDetail(f.ex1, c), null);
    assert.equal((await listRequests(f.ex3)).length, 0);
  });

  it("распределитель и админ видят всё", async () => {
    await create(f.reqA, f.b1.id);
    await create(f.reqB, f.b2.id);
    assert.equal((await listRequests(f.disp)).length, 2);
    assert.equal((await listRequests(f.admin)).length, 2);
  });
});

describe("карточка", () => {
  it("getRequestDetail: исполнители, фото по видам, события с ФИО, доступные действия", async () => {
    const id = (
      await createRequest(f.reqA, {
        buildingId: f.b1.id,
        description: "Течёт",
        urgency: "emergency",
        photos: [fakePhoto()],
      })
    ).id;
    await assignRequest(f.disp, {
      requestId: id,
      executorId: f.ex1.id,
      coexecutorIds: [f.ex2.id],
      deadline: today,
      comment: "Срочно",
    });
    await reportProblem(f.ex2, { requestId: id, text: "Нет ключа", photos: [fakePhoto()] });
    await addComment(f.reqA, { requestId: id, text: "Ключ у охраны" });

    const d = await getRequestDetail(f.ex1, id);
    assert.ok(d);
    assert.equal(d.building.address, f.b1.address);
    assert.equal(d.author.id, f.reqA.id);
    assert.equal(d.executor?.id, f.ex1.id);
    assert.deepEqual(d.coexecutors.map((c) => c.id), [f.ex2.id]);
    assert.equal(d.photos.problem.length, 1);
    assert.equal(d.photos.comment.length, 1);
    assert.match(d.photos.problem[0].url, /^\/photos\//);
    assert.deepEqual(d.events.map((e) => e.type), ["created", "assigned", "problem", "comment"]);
    assert.equal(d.events[1].executorName, "Тестов ex1");
    assert.deepEqual(d.events[1].coexecutorNames, ["Тестов ex2"]);
    assert.equal(d.events[2].photos.length, 1);
    assert.equal(d.lastProblem?.text, "Нет ключа");
    assert.equal(d.problemOpen, true);
    assert.equal(d.viewer.isExecutor, true);
    assert.equal(d.allowed.accept, true);
    assert.equal(d.allowed.complete, false);
    assert.equal(d.allowed.reportProblem, true);
    assert.equal(d.allowed.assign, false);

    const forCo = await getRequestDetail(f.ex2, id);
    assert.equal(forCo?.allowed.accept, false);
    assert.equal(forCo?.allowed.reportProblem, true);

    const forDisp = await getRequestDetail(f.disp, id);
    assert.equal(forDisp?.allowed.assign, true);
    assert.equal(forDisp?.allowed.resolveProblem, true);
    assert.equal(forDisp?.allowed.cancel, false);

    const forAuthor = await getRequestDetail(f.reqA, id);
    assert.equal(forAuthor?.allowed.cancel, false, "после назначения отменить нельзя");
    assert.equal(forAuthor?.allowed.comment, true);
  });

  it("фото отдаются только тем, кто видит заявку", async () => {
    const photo = fakePhoto();
    await createRequest(f.reqA, { buildingId: f.b1.id, description: "x", urgency: "current", photos: [photo] });
    assert.ok(await getPhotoForUser(f.reqA2, photo.id));
    assert.ok(await getPhotoForUser(f.disp, photo.id));
    assert.equal(await getPhotoForUser(f.reqB, photo.id), null);
    assert.equal(await getPhotoForUser(f.ex1, photo.id), null);
    assert.equal(await getPhotoForUser(f.disp, "0".repeat(32)), null);
  });
});

describe("просрочка, фильтры и сортировка", () => {
  it("просрочка: срок < сегодня по Москве и статус assigned|in_progress", async () => {
    const late = await create();
    const fine = await create();
    await assignRequest(f.disp, { requestId: late, executorId: f.ex1.id, deadline: today });
    await assignRequest(f.disp, { requestId: fine, executorId: f.ex1.id, deadline: today });
    // Срок в прошлом можно получить только «задним числом».
    await db.update(requests).set({ deadline: addDays(today, -1) }).where(eq(requests.id, late));

    const rows = await listRequests(f.disp, { onlyOverdue: true });
    assert.deepEqual(rows.map((r) => r.id), [late]);
    assert.equal(rows[0].isOverdue, true);
    const d = await getRequestDetail(f.ex1, late);
    assert.equal(d?.isOverdue, true);
    assert.equal((await getRequestDetail(f.ex1, fine))?.isOverdue, false, "срок сегодня — ещё не просрочена");

    // У исполнителя просроченные сверху
    const tasks = await listRequests(f.ex1, { statusGroup: "active" });
    assert.equal(tasks[0].id, late);
    assert.equal((await dispatcherCounters()).overdue, 1);
  });

  it("порядок распределителя: проблема → новые аварийные → новые → просроченные → остальные", async () => {
    const plain = await create(f.reqA, f.b1.id, "current", "обычная назначенная");
    await assignRequest(f.disp, { requestId: plain, executorId: f.ex1.id, deadline: addDays(today, 3) });
    const overdue = await create(f.reqA, f.b1.id, "current", "просроченная");
    await assignRequest(f.disp, { requestId: overdue, executorId: f.ex1.id, deadline: today });
    await db.update(requests).set({ deadline: addDays(today, -2) }).where(eq(requests.id, overdue));
    const problem = await create(f.reqA, f.b1.id, "current", "с проблемой");
    await assignRequest(f.disp, { requestId: problem, executorId: f.ex2.id, deadline: today });
    await acceptRequest(f.ex2, { requestId: problem });
    await reportProblem(f.ex2, { requestId: problem, text: "нет деталей" });
    const fresh = await create(f.reqA, f.b1.id, "current", "новая");
    const emergency = await create(f.reqA, f.b1.id, "emergency", "новая аварийная");
    // Делаем «новую» более свежей, чем аварийная, чтобы проверить приоритет срочности.
    await db.update(requests).set({ createdAt: new Date(Date.now() - 3_600_000) }).where(eq(requests.id, emergency));

    const ids = (await listRequests(f.disp)).map((r) => r.id);
    assert.deepEqual(ids, [problem, emergency, fresh, overdue, plain]);

    const c = await dispatcherCounters();
    assert.deepEqual(c, { new: 2, problem: 1, overdue: 1, assigned: 2, inProgress: 1, inWork: 3, active: 5 });
  });

  it("фильтры: статус, группа, здание, срочность, исполнитель (в т. ч. соисполнитель), поиск", async () => {
    const a = await create(f.reqA, f.b1.id, "emergency", "Протечка в спортзале");
    const b = await create(f.reqB, f.b2.id, "purchase", "Купить лампы");
    await assignRequest(f.disp, { requestId: b, executorId: f.ex1.id, coexecutorIds: [f.ex2.id], deadline: today });

    assert.deepEqual((await listRequests(f.disp, { status: "new" })).map((r) => r.id), [a]);
    assert.deepEqual((await listRequests(f.disp, { statusGroup: "closed" })).length, 0);
    assert.deepEqual((await listRequests(f.disp, { buildingId: f.b2.id })).map((r) => r.id), [b]);
    assert.deepEqual((await listRequests(f.disp, { urgency: "emergency" })).map((r) => r.id), [a]);
    assert.deepEqual((await listRequests(f.disp, { executorId: f.ex2.id })).map((r) => r.id), [b]);
    assert.deepEqual((await listRequests(f.disp, { q: "спортзал" })).map((r) => r.id), [a]);
    assert.deepEqual((await listRequests(f.disp, { q: `№${b}` })).map((r) => r.id), [b]);
    assert.deepEqual((await listRequests(f.disp, { q: "100%_" })).length, 0);
    assert.deepEqual((await listRequests(f.disp, { onlyNew: true })).map((r) => r.id), [a]);
    assert.deepEqual((await listRequests(f.disp, { createdFrom: today, createdTo: today })).length, 2);
    assert.deepEqual((await listRequests(f.disp, { createdFrom: addDays(today, 1) })).length, 0);

    await reportProblem(f.ex2, { requestId: b, text: "Первая проблема" });
    await reportProblem(f.ex1, { requestId: b, text: "Нет ламп на складе" });
    const exp = await listRequestsForExport(f.disp, {});
    assert.equal(exp.length, 2);
    assert.equal(exp.find((r) => r.id === b)?.coexecutors[0].id, f.ex2.id);
    assert.equal(exp.find((r) => r.id === b)?.lastProblem, "Нет ламп на складе");
    assert.equal(exp.find((r) => r.id === a)?.lastProblem, null);

    // Поиск по номеру на /dispatch находит и закрытую заявку, хотя выбран статус «Все активные».
    await rejectRequest(f.disp, { requestId: a, reason: "Дубль" });
    const byNumber = dispatchListFilters(parseDispatchQuery({ q: String(a), status: "active" }));
    assert.deepEqual((await listRequests(f.disp, byNumber)).map((r) => r.id), [a]);
    const byText = dispatchListFilters(parseDispatchQuery({ q: "спортзал" }));
    assert.equal((await listRequests(f.disp, byText)).length, 0);

    const counters = await requestCounters(f.reqB);
    assert.equal(counters.active, 1);
  });
});

describe("справочники", () => {
  it("исполнители (активные, с нагрузкой) и здания по роли", async () => {
    const a = await create();
    await assignRequest(f.disp, { requestId: a, executorId: f.ex1.id, deadline: today });
    const ex = await listExecutors();
    assert.deepEqual(ex.map((e) => e.id), [f.ex1.id, f.ex2.id, f.ex3.id]);
    assert.equal(ex[0].activeCount, 1);
    assert.equal((await listExecutors({ includeInactive: true })).length, 4);

    assert.deepEqual((await listBuildingsForUser(f.reqB)).map((b) => b.id), [f.b2.id]);
    assert.equal((await listBuildingsForUser(f.disp)).length, 2);
    assert.equal((await listBuildingsForUser(f.ex1)).length, 0);
  });
});
