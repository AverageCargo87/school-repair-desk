import { expectServiceError, fakePhoto, makeFixtures, resetDb, setupDb, tomorrow, type Fixtures } from "./helpers/db";
import assert from "node:assert/strict";
import { before, beforeEach, describe, it } from "node:test";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { requestCoexecutors, requestEvents, requestPhotos, requests, users } from "@/db/schema";
import { addDays, todayMsk } from "@/lib/time";
import {
  acceptRequest,
  addComment,
  assignRequest,
  cancelRequest,
  completeRequest,
  createRequest,
  rejectRequest,
  reopenRequest,
  reportProblem,
  resolveProblem,
} from "@/lib/requests/service";

let f: Fixtures;
const today = todayMsk();

async function getReq(id: number) {
  return (await db.select().from(requests).where(eq(requests.id, id)))[0];
}

async function eventTypes(id: number) {
  const rows = await db
    .select({ type: requestEvents.type })
    .from(requestEvents)
    .where(eq(requestEvents.requestId, id))
    .orderBy(asc(requestEvents.id));
  return rows.map((r) => r.type);
}

async function newRequest(author = f.reqA, buildingId = f.b1.id) {
  return (
    await createRequest(author, {
      buildingId,
      description: "Течёт кран",
      location: "каб. 5",
      urgency: "current",
    })
  ).id;
}

async function assigned(executor = f.ex1, co: number[] = []) {
  const id = await newRequest();
  await assignRequest(f.disp, { requestId: id, executorId: executor.id, coexecutorIds: co, deadline: tomorrow(today) });
  return id;
}

async function inProgress(executor = f.ex1, co: number[] = []) {
  const id = await assigned(executor, co);
  await acceptRequest(executor, { requestId: id });
  return id;
}

before(setupDb);
beforeEach(async () => {
  await resetDb();
  f = await makeFixtures();
});

describe("создание", () => {
  it("заявитель создаёт заявку по своему зданию, с фото и событием created", async () => {
    const { id } = await createRequest(f.reqA, {
      buildingId: f.b1.id,
      description: "  Не работает свет  ",
      urgency: "emergency",
      photos: [fakePhoto(), fakePhoto()],
    });
    const r = await getReq(id);
    assert.equal(r.status, "new");
    assert.equal(r.description, "Не работает свет");
    assert.equal(r.location, null);
    assert.deepEqual(await eventTypes(id), ["created"]);
    const photos = await db.select().from(requestPhotos).where(eq(requestPhotos.requestId, id));
    assert.equal(photos.length, 2);
    assert.ok(photos.every((p) => p.kind === "problem" && p.eventId != null));
  });

  it("заявитель не может создать заявку по чужому зданию", async () => {
    await expectServiceError(
      createRequest(f.reqA, { buildingId: f.b2.id, description: "x", urgency: "current" }),
      "validation",
      "buildingId",
    );
  });

  it("нельзя по отключённому зданию, даже если оно закреплено", async () => {
    await expectServiceError(
      createRequest(f.reqB, { buildingId: f.bOff.id, description: "x", urgency: "current" }),
      "validation",
      "buildingId",
    );
  });

  it("распределитель создаёт по любому зданию, исполнитель — не может", async () => {
    const { id } = await createRequest(f.disp, { buildingId: f.b2.id, description: "x", urgency: "purchase" });
    assert.equal((await getReq(id)).authorId, f.disp.id);
    await expectServiceError(
      createRequest(f.ex1, { buildingId: f.b1.id, description: "x", urgency: "current" }),
      "forbidden",
    );
  });

  it("проверка полей: описание, срочность, не больше 5 фото", async () => {
    const e = await expectServiceError(
      createRequest(f.reqA, {
        buildingId: f.b1.id,
        description: "   ",
        urgency: "whatever" as never,
        photos: Array.from({ length: 6 }, fakePhoto),
      }),
      "validation",
    );
    assert.ok(e.fieldErrors?.description);
    assert.ok(e.fieldErrors?.urgency);
    assert.ok(e.fieldErrors?.photos);
  });
});

describe("полный цикл", () => {
  it("new → assigned → in_progress → done, с событиями и датами", async () => {
    const id = await newRequest();
    await assignRequest(f.disp, {
      requestId: id,
      executorId: f.ex1.id,
      coexecutorIds: [f.ex2.id, f.ex1.id, f.ex2.id],
      deadline: today,
      comment: "Ключ у вахтёра",
    });
    let r = await getReq(id);
    assert.equal(r.status, "assigned");
    assert.equal(r.executorId, f.ex1.id);
    assert.equal(r.deadline, today);
    assert.equal(r.dispatcherComment, "Ключ у вахтёра");
    const co = await db.select().from(requestCoexecutors).where(eq(requestCoexecutors.requestId, id));
    assert.deepEqual(co.map((c) => c.userId), [f.ex2.id], "основной исполнитель и дубли отброшены");

    await acceptRequest(f.ex1, { requestId: id });
    r = await getReq(id);
    assert.equal(r.status, "in_progress");
    assert.ok(r.acceptedAt);

    await completeRequest(f.ex1, { requestId: id, comment: "Готово", photos: [fakePhoto()] });
    r = await getReq(id);
    assert.equal(r.status, "done");
    assert.ok(r.completedAt, "дата выполнения ставится сервером");
    assert.equal(r.completionComment, "Готово");
    assert.equal(r.problemOpen, false);
    assert.deepEqual(await eventTypes(id), ["created", "assigned", "accepted", "completed"]);
    const photos = await db.select().from(requestPhotos).where(eq(requestPhotos.requestId, id));
    assert.deepEqual(photos.map((p) => p.kind), ["result"]);
  });
});

describe("назначение", () => {
  it("срок раньше сегодняшнего (по Москве) — ошибка", async () => {
    const id = await newRequest();
    await expectServiceError(
      assignRequest(f.disp, { requestId: id, executorId: f.ex1.id, deadline: addDays(today, -1) }),
      "validation",
      "deadline",
    );
  });

  it("исполнитель должен быть активным executor", async () => {
    const id = await newRequest();
    await expectServiceError(
      assignRequest(f.disp, { requestId: id, executorId: f.exOff.id, deadline: today }),
      "validation",
      "executorId",
    );
    await expectServiceError(
      assignRequest(f.disp, { requestId: id, executorId: f.reqA.id, deadline: today }),
      "validation",
      "executorId",
    );
    await expectServiceError(
      assignRequest(f.disp, { requestId: id, executorId: f.ex1.id, coexecutorIds: [f.exOff.id], deadline: today }),
      "validation",
      "coexecutorIds",
    );
  });

  it("назначать может только распределитель/админ", async () => {
    const id = await newRequest();
    await expectServiceError(
      assignRequest(f.reqA, { requestId: id, executorId: f.ex1.id, deadline: today }),
      "forbidden",
    );
    await assignRequest(f.admin, { requestId: id, executorId: f.ex1.id, deadline: today });
    assert.equal((await getReq(id)).status, "assigned");
  });

  it("смена основного исполнителя → снова assigned, accepted_at сброшен, событие reassigned", async () => {
    const id = await inProgress(f.ex1);
    await assignRequest(f.disp, { requestId: id, executorId: f.ex2.id, deadline: today });
    const r = await getReq(id);
    assert.equal(r.status, "assigned");
    assert.equal(r.executorId, f.ex2.id);
    assert.equal(r.acceptedAt, null);
    const types = await eventTypes(id);
    assert.equal(types.at(-1), "reassigned");
  });

  it("тот же исполнитель, другой срок → статус не меняется, комментарий прежний", async () => {
    const id = await inProgress(f.ex1);
    await db.update(requests).set({ dispatcherComment: "старый" }).where(eq(requests.id, id));
    await assignRequest(f.disp, { requestId: id, executorId: f.ex1.id, deadline: addDays(today, 5) });
    const r = await getReq(id);
    assert.equal(r.status, "in_progress");
    assert.ok(r.acceptedAt);
    assert.equal(r.deadline, addDays(today, 5));
    assert.equal(r.dispatcherComment, "старый");
  });

  it("(пере)назначение снимает problem_open", async () => {
    const id = await inProgress(f.ex1, [f.ex2.id]);
    await reportProblem(f.ex2, { requestId: id, text: "Нет запчасти" });
    assert.equal((await getReq(id)).problemOpen, true);
    await assignRequest(f.disp, { requestId: id, executorId: f.ex1.id, coexecutorIds: [f.ex3.id], deadline: today });
    const r = await getReq(id);
    assert.equal(r.problemOpen, false);
    const co = await db.select().from(requestCoexecutors).where(eq(requestCoexecutors.requestId, id));
    assert.deepEqual(co.map((c) => c.userId), [f.ex3.id]);
  });

  it("нельзя назначить в закрытой заявке", async () => {
    const id = await newRequest();
    await cancelRequest(f.reqA, { requestId: id });
    await expectServiceError(
      assignRequest(f.disp, { requestId: id, executorId: f.ex1.id, deadline: today }),
      "invalid_state",
    );
  });
});

describe("исполнитель: «Принял» и «Выполнено»", () => {
  it("соисполнитель не может «Принял» и «Выполнено»", async () => {
    const id = await assigned(f.ex1, [f.ex2.id]);
    await expectServiceError(acceptRequest(f.ex2, { requestId: id }), "forbidden");
    await acceptRequest(f.ex1, { requestId: id });
    await expectServiceError(
      completeRequest(f.ex2, { requestId: id, photos: [fakePhoto()] }),
      "forbidden",
    );
  });

  it("чужой исполнитель не видит заявку (not_found) и не может «Выполнено»", async () => {
    const id = await inProgress(f.ex1);
    await expectServiceError(
      completeRequest(f.ex3, { requestId: id, photos: [fakePhoto()] }),
      "not_found",
    );
    await expectServiceError(acceptRequest(f.ex3, { requestId: id }), "not_found");
  });

  it("нельзя «Выполнено» без фото и больше 5 фото", async () => {
    const id = await inProgress(f.ex1);
    await expectServiceError(completeRequest(f.ex1, { requestId: id, photos: [] }), "validation", "photos");
    await expectServiceError(
      completeRequest(f.ex1, { requestId: id, photos: Array.from({ length: 6 }, fakePhoto) }),
      "validation",
      "photos",
    );
    assert.equal((await getReq(id)).status, "in_progress");
  });

  it("«Выполнено» только из in_progress, «Принял» только из assigned", async () => {
    const id = await assigned(f.ex1);
    await expectServiceError(
      completeRequest(f.ex1, { requestId: id, photos: [fakePhoto()] }),
      "invalid_state",
    );
    await acceptRequest(f.ex1, { requestId: id });
    await expectServiceError(acceptRequest(f.ex1, { requestId: id }), "invalid_state");
  });
});

describe("проблема", () => {
  it("исполнитель и соисполнитель сообщают; распределитель снимает «Проблема решена»", async () => {
    const id = await assigned(f.ex1, [f.ex2.id]);
    await reportProblem(f.ex2, { requestId: id, text: "Нужен клапан", photos: [fakePhoto()] });
    let r = await getReq(id);
    assert.equal(r.problemOpen, true);
    assert.equal(r.status, "assigned", "статус не меняется");
    await reportProblem(f.ex1, { requestId: id, text: "Подтверждаю" });

    await expectServiceError(resolveProblem(f.ex1, { requestId: id }), "forbidden");
    await resolveProblem(f.disp, { requestId: id, comment: "Купим завтра" });
    r = await getReq(id);
    assert.equal(r.problemOpen, false);
    assert.deepEqual(await eventTypes(id), ["created", "assigned", "problem", "problem", "problem_resolved"]);
    await expectServiceError(resolveProblem(f.disp, { requestId: id }), "invalid_state");
  });

  it("текст обязателен, не больше 3 фото; заявитель сообщить о проблеме не может", async () => {
    const id = await inProgress(f.ex1);
    await expectServiceError(reportProblem(f.ex1, { requestId: id, text: " " }), "validation", "text");
    await expectServiceError(
      reportProblem(f.ex1, { requestId: id, text: "x", photos: Array.from({ length: 4 }, fakePhoto) }),
      "validation",
      "photos",
    );
    await expectServiceError(reportProblem(f.reqA, { requestId: id, text: "x" }), "forbidden");
  });

  it("выполнение снимает проблему", async () => {
    const id = await inProgress(f.ex1);
    await reportProblem(f.ex1, { requestId: id, text: "Мешают" });
    await completeRequest(f.ex1, { requestId: id, photos: [fakePhoto()] });
    assert.equal((await getReq(id)).problemOpen, false);
  });

  it("нельзя сообщить о проблеме в выполненной заявке", async () => {
    const id = await inProgress(f.ex1);
    await completeRequest(f.ex1, { requestId: id, photos: [fakePhoto()] });
    await expectServiceError(reportProblem(f.ex1, { requestId: id, text: "x" }), "invalid_state");
  });
});

describe("отмена, отклонение, возврат в работу", () => {
  it("автор отменяет только «Новую»; другой заявитель того же здания — нет", async () => {
    const id = await newRequest(f.reqA);
    await expectServiceError(cancelRequest(f.reqA2, { requestId: id }), "forbidden");
    await expectServiceError(cancelRequest(f.disp, { requestId: id }), "forbidden");
    await cancelRequest(f.reqA, { requestId: id, reason: "Сами починили" });
    assert.equal((await getReq(id)).status, "cancelled");

    const id2 = await assigned(f.ex1);
    await expectServiceError(cancelRequest(f.reqA, { requestId: id2 }), "invalid_state");
  });

  it("отклонить: причина обязательна, снимает проблему, только из активных", async () => {
    const id = await inProgress(f.ex1);
    await reportProblem(f.ex1, { requestId: id, text: "x" });
    await expectServiceError(rejectRequest(f.disp, { requestId: id, reason: "" }), "validation", "reason");
    await expectServiceError(rejectRequest(f.reqA, { requestId: id, reason: "x" }), "forbidden");
    await rejectRequest(f.disp, { requestId: id, reason: "Не наша зона" });
    const r = await getReq(id);
    assert.equal(r.status, "rejected");
    assert.equal(r.problemOpen, false);
    await expectServiceError(rejectRequest(f.disp, { requestId: id, reason: "x" }), "invalid_state");
  });

  it("вернуть в работу: done → assigned, исполнители прежние, даты сброшены", async () => {
    const id = await inProgress(f.ex1, [f.ex2.id]);
    await expectServiceError(
      reopenRequest(f.disp, { requestId: id, comment: "x" }),
      "invalid_state",
    );
    await completeRequest(f.ex1, { requestId: id, comment: "Смазал петли.", photos: [fakePhoto()] });
    assert.equal((await getReq(id)).completionComment, "Смазал петли.");
    await expectServiceError(reopenRequest(f.disp, { requestId: id, comment: " " }), "validation", "comment");
    await expectServiceError(
      reopenRequest(f.disp, { requestId: id, comment: "x", deadline: addDays(today, -1) }),
      "validation",
      "deadline",
    );
    await reopenRequest(f.disp, { requestId: id, comment: "Снова течёт", deadline: addDays(today, 3) });
    const r = await getReq(id);
    assert.equal(r.status, "assigned");
    assert.equal(r.executorId, f.ex1.id);
    assert.equal(r.completedAt, null);
    assert.equal(r.acceptedAt, null);
    assert.equal(r.deadline, addDays(today, 3));
    assert.equal(r.dispatcherComment, "Снова течёт");
    assert.equal(r.completionComment, null);
    const co = await db.select().from(requestCoexecutors).where(eq(requestCoexecutors.requestId, id));
    assert.deepEqual(co.map((c) => c.userId), [f.ex2.id]);
    assert.equal((await eventTypes(id)).at(-1), "reopened");
    const [ev] = await db
      .select({ meta: requestEvents.meta })
      .from(requestEvents)
      .where(and(eq(requestEvents.requestId, id), eq(requestEvents.type, "reopened")));
    assert.equal(ev.meta?.executorId, f.ex1.id);
    assert.deepEqual(ev.meta?.coexecutorIds, [f.ex2.id]);
    // и цикл продолжается
    await acceptRequest(f.ex1, { requestId: id });
    await completeRequest(f.ex1, { requestId: id, photos: [fakePhoto()] });
    assert.equal((await getReq(id)).status, "done");
  });

  it("вернуть в работу: отключённые соисполнители не возвращаются", async () => {
    const id = await inProgress(f.ex1, [f.ex2.id, f.ex3.id]);
    await completeRequest(f.ex1, { requestId: id, photos: [fakePhoto()] });
    await db.update(users).set({ active: false }).where(eq(users.id, f.ex2.id));
    await reopenRequest(f.disp, { requestId: id, comment: "Доделать" });
    const co = await db.select().from(requestCoexecutors).where(eq(requestCoexecutors.requestId, id));
    assert.deepEqual(co.map((c) => c.userId), [f.ex3.id]);
    const [ev] = await db
      .select({ meta: requestEvents.meta })
      .from(requestEvents)
      .where(and(eq(requestEvents.requestId, id), eq(requestEvents.type, "reopened")));
    assert.deepEqual(ev.meta?.coexecutorIds, [f.ex3.id]);
    assert.deepEqual([...(ev.meta?.prevCoexecutorIds ?? [])].sort((a, b) => a - b), [f.ex2.id, f.ex3.id].sort((a, b) => a - b));
  });
});

describe("комментарии", () => {
  it("любой, кто видит заявку, в любом статусе; текст обязателен; до 3 фото", async () => {
    const id = await newRequest(f.reqA);
    await cancelRequest(f.reqA, { requestId: id });
    await addComment(f.reqA2, { requestId: id, text: "Ок", photos: [fakePhoto()] });
    await addComment(f.disp, { requestId: id, text: "Принято" });
    await expectServiceError(addComment(f.reqB, { requestId: id, text: "x" }), "not_found");
    await expectServiceError(addComment(f.ex1, { requestId: id, text: "x" }), "not_found");
    await expectServiceError(addComment(f.reqA, { requestId: id, text: "" }), "validation", "text");
    await expectServiceError(
      addComment(f.reqA, { requestId: id, text: "x", photos: Array.from({ length: 4 }, fakePhoto) }),
      "validation",
      "photos",
    );
    assert.deepEqual(await eventTypes(id), ["created", "cancelled", "comment", "comment"]);
  });

  it("несуществующая заявка → not_found", async () => {
    await expectServiceError(addComment(f.disp, { requestId: 9999, text: "x" }), "not_found");
    await expectServiceError(addComment(f.disp, { requestId: Number.NaN, text: "x" }), "not_found");
  });
});
