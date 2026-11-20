import "./helpers/env";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isValidLogin, loadRoster, loginBase, normalizeLoginInput, rosterPeople } from "@/lib/roster";

describe("вход по логину или фамилии: normalizeLoginInput", () => {
  it("латинский логин — как есть, без пробелов по краям, в нижнем регистре", () => {
    assert.equal(normalizeLoginInput("petrov"), "petrov");
    assert.equal(normalizeLoginInput("  Petrov  "), "petrov");
    assert.equal(normalizeLoginInput("MUKHINA.A"), "mukhina.a");
    assert.equal(normalizeLoginInput("admin"), "admin");
  });

  it("фамилия по-русски → транслит, регистр не важен", () => {
    assert.equal(normalizeLoginInput("Петров"), "petrov");
    assert.equal(normalizeLoginInput("петров"), "petrov");
    assert.equal(normalizeLoginInput("ПЕТРОВ"), "petrov");
    assert.equal(normalizeLoginInput("Холодов"), "kholodov");
    assert.equal(normalizeLoginInput("Мухина"), "mukhina");
    assert.equal(normalizeLoginInput("Щукина"), "shchukina");
  });

  it("берётся только первое слово (фамилия)", () => {
    assert.equal(normalizeLoginInput("Петров Денис Валерьевич"), "petrov");
    assert.equal(normalizeLoginInput("  Петров  Д. В. "), "petrov");
    assert.equal(normalizeLoginInput("Петров.Д.В."), "petrov");
    assert.equal(normalizeLoginInput("Петров,Д"), "petrov");
  });

  it("ё и случайная латинская буква в русском слове", () => {
    assert.equal(normalizeLoginInput("Королёв"), "korolev");
    assert.equal(normalizeLoginInput("Королёв"), "korolev"); // «ё» из двух символов
    assert.equal(normalizeLoginInput("Пeтров"), "petrov"); // «e» латинская
  });

  it("пустой ввод и мусор не превращаются в чужой логин", () => {
    assert.equal(normalizeLoginInput(""), "");
    assert.equal(normalizeLoginInput("   "), "");
    assert.equal(normalizeLoginInput("ъь"), "");
    assert.equal(isValidLogin(normalizeLoginInput("ъь")), false);
  });

  it("фамилия из ФИО даёт тот же логин, что выдаётся при создании (loginBase)", () => {
    for (const p of rosterPeople(loadRoster())) {
      assert.equal(normalizeLoginInput(p.fullName), loginBase(p.fullName), p.fullName);
    }
  });
});
