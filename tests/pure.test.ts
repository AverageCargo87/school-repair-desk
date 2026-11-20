import "./helpers/env";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import {
  addDays,
  deadlineHint,
  formatDateMsk,
  formatDateTimeMsk,
  isOverdue,
  isValidDateStr,
  monthRangeMsk,
  mskDayStart,
  todayMsk,
} from "@/lib/time";
import { generatePassword, loadRoster, rosterPeople, translit, uniqueLogin } from "@/lib/roster";
import { allowedActions, buildRelation, canView } from "@/lib/requests/rules";
import { deletePhotoFiles, savePhotoFiles, sniffImageMime, validatePhotoFiles } from "@/lib/photos";
import { shortName } from "@/lib/utils";
import ExcelJS from "exceljs";
import type { RequestExportRow } from "@/lib/requests/queries";
import { buildRequestsWorkbook } from "@/app/export/file/workbook";
import {
  dispatchListFilters,
  isRequestNumberQuery,
  parseDispatchQuery,
  parseExportQuery,
  statusViewFilters,
} from "@/components/dispatcher/dispatch-params";

describe("время по Москве", () => {
  it("todayMsk учитывает UTC+3", () => {
    assert.equal(todayMsk(new Date("2026-10-10T20:59:00Z")), "2026-10-10");
    assert.equal(todayMsk(new Date("2026-10-10T21:30:00Z")), "2026-10-11");
  });

  it("просрочка — по московскому «сегодня»", () => {
    const nowUtc = new Date("2026-10-10T21:30:00Z"); // в Москве уже 11.10 00:30
    const today = todayMsk(nowUtc);
    assert.equal(isOverdue("2026-10-10", "in_progress", today), true);
    assert.equal(isOverdue("2026-10-11", "in_progress", today), false);
    assert.equal(isOverdue("2026-10-10", "assigned", today), true);
    assert.equal(isOverdue("2026-10-10", "done", today), false);
    assert.equal(isOverdue("2026-10-10", "new", today), false);
    assert.equal(isOverdue(null, "assigned", today), false);
  });

  it("форматирование и даты", () => {
    assert.equal(formatDateMsk("2026-10-05"), "05.10.2026");
    assert.equal(formatDateMsk(new Date("2026-10-10T21:30:00Z")), "11.10.2026");
    assert.equal(formatDateTimeMsk(new Date("2026-10-10T21:30:00Z")), "11.10.2026, 00:30");
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.deepEqual(monthRangeMsk("2026-02-14"), { from: "2026-02-01", to: "2026-02-28" });
    assert.equal(mskDayStart("2026-10-11").toISOString(), "2026-10-10T21:00:00.000Z");
    assert.equal(isValidDateStr("2026-02-30"), false);
    assert.equal(isValidDateStr("2026-02-28"), true);
    assert.equal(deadlineHint("2026-10-12", "2026-10-10"), "через 2 дн.");
    assert.equal(deadlineHint("2026-10-08", "2026-10-10"), "просрочен на 2 дн.");
  });
});

describe("логины и пароли", () => {
  it("транслит фамилий", () => {
    const cases: Record<string, string> = {
      Мухина: "mukhina",
      Широких: "shirokikh",
      Холодов: "kholodov",
      Авакян: "avakyan",
      Кравец: "kravets",
      Ахметзянов: "akhmetzyanov",
      Сергеева: "sergeeva",
      Смирнов: "smirnov",
      Щукин: "shchukin",
      Чайкин: "chaykin",
      Дерябин: "deryabin",
      Петухова: "petukhova",
    };
    for (const [ru, en] of Object.entries(cases)) assert.equal(translit(ru), en, ru);
  });

  it("уникальный логин: фамилия → фамилия.инициал → фамилия.инициалы → фамилия2", () => {
    const taken = new Set<string>();
    const a = uniqueLogin("Иванова Мария Петровна", taken);
    taken.add(a);
    const b = uniqueLogin("Иванова Анна Сергеевна", taken);
    taken.add(b);
    const c = uniqueLogin("Иванова Анна Олеговна", taken);
    taken.add(c);
    const d = uniqueLogin("Иванова Анна Олеговна", taken);
    assert.deepEqual([a, b, c, d], ["ivanova", "ivanova.a", "ivanova.ao", "ivanova2"]);
  });

  it("пароль: 8 символов, без похожих символов, есть буквы и цифры", () => {
    for (let i = 0; i < 200; i++) {
      const p = generatePassword();
      assert.equal(p.length, 8);
      assert.match(p, /^[a-hjkmnp-z2-9]+$/);
      assert.match(p, /[a-z]/);
      assert.match(p, /[0-9]/);
    }
  });

  it("roster.json читается, логины уникальны", () => {
    const roster = loadRoster();
    const people = rosterPeople(roster);
    assert.ok(people.length >= 19);
    const taken = new Set<string>();
    for (const p of people) {
      const login = uniqueLogin(p.fullName, taken);
      assert.ok(!taken.has(login));
      taken.add(login);
    }
    assert.ok(taken.has("mukhina"));
    assert.ok(taken.has("smirnov"));
  });

  it("shortName", () => {
    assert.equal(shortName("Иванова Мария Петровна"), "Иванова М. П.");
    assert.equal(shortName("Администратор"), "Администратор");
  });
});

describe("правила действий", () => {
  const req = { authorId: 1, executorId: 5 };
  it("заявитель-автор отменяет только new", () => {
    const rel = buildRelation({ id: 1, role: "requester" }, req, { isCoexecutor: false, inMyBuildings: true });
    assert.equal(allowedActions(rel, { status: "new", problemOpen: false }).cancel, true);
    assert.equal(allowedActions(rel, { status: "assigned", problemOpen: false }).cancel, false);
    assert.equal(canView(rel), true);
  });
  it("соисполнитель: только проблема и комментарий", () => {
    const rel = buildRelation({ id: 6, role: "executor" }, req, { isCoexecutor: true, inMyBuildings: false });
    const a = allowedActions(rel, { status: "in_progress", problemOpen: false });
    assert.equal(a.accept, false);
    assert.equal(a.complete, false);
    assert.equal(a.reportProblem, true);
    assert.equal(a.comment, true);
  });
  it("чужой исполнитель не видит заявку", () => {
    const rel = buildRelation({ id: 7, role: "executor" }, req, { isCoexecutor: false, inMyBuildings: false });
    assert.equal(canView(rel), false);
    assert.equal(allowedActions(rel, { status: "assigned", problemOpen: false }).comment, false);
  });
});

describe("фото", () => {
  it("тип определяется по содержимому", () => {
    assert.equal(sniffImageMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0])), "image/jpeg");
    assert.equal(
      sniffImageMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
      "image/png",
    );
    assert.equal(sniffImageMime(new TextEncoder().encode("RIFF1234WEBPVP8 ")), "image/webp");
    assert.equal(sniffImageMime(new TextEncoder().encode("\0\0\0\x18ftypheic")), "image/heic");
    assert.equal(sniffImageMime(new TextEncoder().encode("<html><script>")), null);
  });

  it("лимиты количества и размера", () => {
    const small = new File([new Uint8Array(10)], "a.jpg", { type: "image/jpeg" });
    const big = new File([new Uint8Array(8 * 1024 * 1024 + 1)], "b.jpg", { type: "image/jpeg" });
    assert.equal(validatePhotoFiles([small], { min: 1, max: 5 }), null);
    assert.ok(validatePhotoFiles([], { min: 1, max: 5 }));
    assert.ok(validatePhotoFiles([small, small, small, small], { min: 0, max: 3 }));
    assert.ok(validatePhotoFiles([big], { min: 0, max: 5 }));
  });

  it("сохраняет в UPLOAD_DIR под случайным id и отвергает не-картинки", async () => {
    const jpeg = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], "x.jpg");
    const [saved] = await savePhotoFiles([jpeg]);
    assert.match(saved.id, /^[a-f0-9]{32}$/);
    assert.equal(saved.mime, "image/jpeg");
    const onDisk = await readFile(path.join(process.env.UPLOAD_DIR!, saved.id));
    assert.equal(onDisk.byteLength, 7);
    await deletePhotoFiles([saved.id]);

    const html = new File(["<html>"], "evil.jpg", { type: "image/jpeg" });
    await assert.rejects(savePhotoFiles([html]), /не похож на фото/);
  });
});

describe("выгрузка в Excel и параметры списков", () => {
  const baseRow: RequestExportRow = {
    id: 9,
    createdAt: new Date("2026-10-10T20:30:00Z"), // 23:30 МСК того же дня
    updatedAt: new Date("2026-10-10T20:30:00Z"),
    status: "in_progress",
    urgency: "emergency",
    buildingId: 1,
    buildingAddress: "ул. Тестовая, д. 1",
    location: "каб. 5",
    description: "Течёт кран",
    authorId: 1,
    authorName: "Иванова Ирина Ивановна",
    executorId: 2,
    executorName: "Петров Пётр Петрович",
    coexecutors: [
      { id: 3, fullName: "Сидоров Семён Семёнович" },
      { id: 4, fullName: "Кузнецов Кирилл Котович" },
    ],
    deadline: "2026-10-09",
    dispatcherComment: "Срочно",
    acceptedAt: new Date("2026-10-10T06:05:00Z"),
    completedAt: null,
    completionComment: null,
    problemOpen: true,
    photoCount: 0,
    isOverdue: true,
    isMine: false,
    myRole: null,
    lastProblem: "Нет прокладок",
  };

  it("17 колонок по ТЗ, время по Москве, просрочка и последняя проблема", async () => {
    const done: RequestExportRow = {
      ...baseRow,
      id: 10,
      status: "done",
      coexecutors: [],
      isOverdue: false,
      problemOpen: false,
      lastProblem: null,
      completedAt: new Date("2026-10-11T09:00:00Z"),
      completionComment: "Заменил кран",
    };
    const buf = await buildRequestsWorkbook([baseRow, done], {
      from: "2026-10-01",
      to: "2026-10-10",
      buildingLabel: "Все здания",
      statusLabel: "Все заявки",
      userName: "Тест",
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf.buffer);
    const ws = wb.getWorksheet("Заявки");
    assert.ok(ws);
    const headers = (ws.getRow(1).values as unknown[]).slice(1);
    assert.deepEqual(headers, [
      "№",
      "Создана",
      "Здание",
      "Где именно",
      "Заявитель",
      "Описание",
      "Срочность",
      "Статус",
      "Исполнитель",
      "Соисполнители",
      "Срок",
      "Принята",
      "Выполнена",
      "Просрочена",
      "Комментарий распределителя",
      "Комментарий исполнителя",
      "Последняя проблема",
    ]);
    assert.equal(ws.getRow(1).getCell(1).font?.bold, true);
    assert.ok(ws.autoFilter);

    const r = ws.getRow(2);
    assert.equal(r.getCell(1).value, 9);
    // Excel без часовых поясов: в ячейке московские «10.10.2026 23:30».
    assert.equal((r.getCell(2).value as Date).toISOString(), "2026-10-10T23:30:00.000Z");
    assert.equal((r.getCell(11).value as Date).toISOString(), "2026-10-09T00:00:00.000Z");
    assert.equal((r.getCell(12).value as Date).toISOString(), "2026-10-10T09:05:00.000Z");
    assert.equal(r.getCell(7).value, "Аварийная");
    assert.equal(r.getCell(8).value, "В работе");
    assert.equal(r.getCell(10).value, "Сидоров Семён Семёнович, Кузнецов Кирилл Котович");
    assert.equal(r.getCell(13).value, null);
    assert.equal(r.getCell(14).value, "да");
    assert.equal(r.getCell(17).value, "Нет прокладок");

    const r2 = ws.getRow(3);
    assert.equal(r2.getCell(8).value, "Выполнена");
    assert.equal((r2.getCell(13).value as Date).toISOString(), "2026-10-11T12:00:00.000Z");
    assert.equal(r2.getCell(14).value, "нет");
    assert.equal(r2.getCell(16).value, "Заменил кран");
    assert.equal(r2.getCell(17).value, null);
  });

  it("parseExportQuery: по умолчанию текущий месяц, перестановка дат, мусор игнорируется", () => {
    const q = parseExportQuery({}, "2026-10-10");
    assert.deepEqual(q, { from: "2026-10-01", to: "2026-10-10", status: "all", buildingId: undefined });
    const swapped = parseExportQuery(
      { from: "2026-10-20", to: "2026-10-05", status: "done", building: "3" },
      "2026-10-10",
    );
    assert.deepEqual(swapped, { from: "2026-10-05", to: "2026-10-20", status: "done", buildingId: 3 });
    const junk = parseExportQuery({ from: "вчера", status: "constructor", building: "-1" }, "2026-10-10");
    assert.equal(junk.from, "2026-10-01");
    assert.equal(junk.status, "all");
    assert.equal(junk.buildingId, undefined);
  });

  it("statusViewFilters и поиск по номеру на /dispatch", () => {
    assert.deepEqual(statusViewFilters("problem"), { onlyProblem: true });
    assert.deepEqual(statusViewFilters("all"), {});
    assert.deepEqual(statusViewFilters("done"), { status: "done" });

    const byText = dispatchListFilters(parseDispatchQuery({ q: "кран" }));
    assert.equal(byText.statusGroup, "active");
    assert.equal(byText.q, "кран");
    for (const q of ["9", "№ 9", "#9", "N9"]) {
      assert.equal(isRequestNumberQuery(q), true, q);
      const f = dispatchListFilters(parseDispatchQuery({ q, status: "active" }));
      assert.equal(f.statusGroup, undefined, q);
      assert.equal(f.status, undefined, q);
    }
    assert.equal(isRequestNumberQuery("каб. 9"), false);
  });
});
