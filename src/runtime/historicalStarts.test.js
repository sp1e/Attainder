import test from "node:test";
import assert from "node:assert/strict";

import { addGameDays } from "./gameDates.js";
import {
  HISTORICAL_START_RANGE,
  HISTORICAL_START_REFUSAL,
  classifyCampaignCreation,
  validateHistoricalStartDate,
  validateHistoricalStartDates,
} from "./historicalStarts.js";

const refusal = (code) => ({ ok: false, code, error: HISTORICAL_START_REFUSAL });

test("exports the inclusive start range and Swedish refusal", () => {
  assert.deepEqual(HISTORICAL_START_RANGE, { minYear: -3300, maxYear: 1200 });
  assert.equal(Object.isFrozen(HISTORICAL_START_RANGE), true);
  assert.equal(HISTORICAL_START_REFUSAL, "Välj ett giltigt startdatum mellan 3300 f.Kr. och 1200 e.Kr.");
});

for (const [value, date, year] of [
  ["-3300-01-01", "-3300-01-01", -3300],
  ["-3300-12-31", "-3300-12-31", -3300],
  ["1200-01-01", "1200-01-01", 1200],
  ["1200-12-31", "1200-12-31", 1200],
  ["-1-1-1", "-0001-01-01", -1],
  ["1-1-1", "0001-01-01", 1],
  [" \t-218-3-1\r\n", "-0218-03-01", -218],
  ["000001-01-01", "0001-01-01", 1],
  ["-1-2-29", "-0001-02-29", -1],
  ["-5-2-29", "-0005-02-29", -5],
  ["-401-2-29", "-0401-02-29", -401],
  ["1200-2-29", "1200-02-29", 1200],
]) {
  test(`accepts and canonicalizes historical start ${JSON.stringify(value)}`, () => {
    assert.deepEqual(validateHistoricalStartDate(value), { ok: true, date, year });
    assert.deepEqual(validateHistoricalStartDates({ startDate: value, gameDate: date }), {
      ok: true, startDate: date, gameDate: date,
    });
  });
}

for (const value of ["-3301-12-31", "1201-01-01", "2016-01-01", "-999999-01-01", "999999-01-01"]) {
  test(`refuses out-of-range start ${value}`, () => {
    assert.deepEqual(validateHistoricalStartDate(value), refusal("outOfRange"));
    assert.deepEqual(validateHistoricalStartDates({ startDate: value, gameDate: "1200-01-01" }), refusal("outOfRange"));
    assert.deepEqual(validateHistoricalStartDates({ startDate: "1200-01-01", gameDate: value }), refusal("outOfRange"));
  });
}

for (const value of [
  undefined, null, "", " \t\r\n", 12000101, 0, -0, true, {}, [], ["1200-01-01"],
  "0-1-1", "0000-01-01", "-0-1-1", "-0000-01-01", "-000000-1-1",
  "1200-0-1", "1200-13-1", "1200-1-0", "1200-1-32", "1200-4-31",
  "1100-2-29", "-2-2-29", "-101-2-29", "-3300-2-29",
  "1200-01-01 trailing", "1200-01-01T00:00:00.000Z", "1200-01-01T",
  "+1200-01-01", "1200-01-01 AD", "1200-01-01 CE", "218-03-01 BC",
  "218-03-01 BCE", "1200 BCE", "1200 -01-01", "1200- 01-01",
  "1200-01- 01", "1200-01-01\ntrailing", "1200/01/01", "1200-001-01",
  "1200-01-001", "0001200-01-01", "１２００-01-01",
]) {
  test(`refuses invalid start ${JSON.stringify(value)}`, () => {
    assert.deepEqual(validateHistoricalStartDate(value), refusal("invalidDate"));
    assert.deepEqual(validateHistoricalStartDates({ startDate: value, gameDate: "1200-01-01" }), refusal("invalidDate"));
    assert.deepEqual(validateHistoricalStartDates({ startDate: "1200-01-01", gameDate: value }), refusal("invalidDate"));
  });
}

test("requires a date-pair object containing both strings without throwing", () => {
  for (const value of [undefined, null, 1, true, "1200-01-01", [], ["1200-01-01", "1200-01-01"], {},
    { startDate: "1200-01-01" }, { gameDate: "1200-01-01" }]) {
    assert.deepEqual(validateHistoricalStartDates(value), refusal("invalidDate"));
  }
  assert.deepEqual(validateHistoricalStartDates(), refusal("invalidDate"));
  assert.deepEqual(validateHistoricalStartDate(), refusal("invalidDate"));
});

test("rejects two valid dates on different days with one Swedish sentence", () => {
  for (const gameDate of ["1200-01-02", "1199-01-01", "-0001-12-31"]) {
    const result = validateHistoricalStartDates({ startDate: "1200-01-01", gameDate });
    assert.equal(result.ok, false);
    assert.equal(result.code, "dateMismatch");
    assert.equal(result.error, "Startdatum och speldatum måste vara samma dag.");
  }
});

test("canonicalizes date pairs without mutating the input", () => {
  const input = Object.freeze({ startDate: " \t-1-2-29 ", gameDate: "-0001-02-29" });
  assert.deepEqual(validateHistoricalStartDates(input), { ok: true, startDate: "-0001-02-29", gameDate: "-0001-02-29" });
  assert.equal(input.startDate, " \t-1-2-29 ");
});

test("reuses the no-year-zero calendar while running games can pass AD 1200", () => {
  const bcEnd = validateHistoricalStartDate("-1-12-31").date;
  assert.equal(addGameDays(bcEnd, 1), "0001-01-01");
  assert.equal(addGameDays("0001-01-01", -1), bcEnd);
  assert.equal(addGameDays(validateHistoricalStartDate("1200-12-31").date, 1), "1201-01-01");
});

const sourceGame = Object.freeze({
  scenarioId: "hadara",
  game: Object.freeze({
    startDate: "2016-01-01", gameDate: "2016-02-01", name: "Stored name",
    world: Object.freeze({ polities: Object.freeze([Object.freeze({ id: "hadara", treasury: 50 })]), historical: false }),
    characterSystem: Object.freeze({ rulerId: "ruler", seed: 23 }),
    optional: null,
  }),
});
const copyRequest = (overrides = {}) => ({ seedGameId: "saved-game", sourceGame, ...overrides });
const assertKind = (request, kind) => assert.deepEqual(classifyCampaignCreation(request), { ok: true, kind });

test("classifies scenario starts as new even with caller-controlled restoration labels", () => {
  assertKind({}, "new");
  assertKind({ scenarioId: "bronze-age" }, "new");
  assertKind({ scenarioId: "hadara", kind: "copy", restore: true, historical: true }, "new");
});

test("preserves an unchanged modern/Hadara save copy and display metadata changes", () => {
  assertKind(copyRequest(), "copy");
  assertKind(copyRequest({ scenarioId: "hadara" }), "copy");
  assertKind(copyRequest({ scenarioId: "" }), "copy");
  assertKind(copyRequest({ scenarioId: null }), "copy");
  assertKind(copyRequest({ name: "Renamed", description: "Another display description", setActive: false }), "copy");
  assertKind(copyRequest({ gamePatch: {} }), "copy");
});

test("compares supplied patch fields structurally with object key order ignored", () => {
  const gamePatch = Object.freeze({
    gameDate: "2016-02-01",
    characterSystem: Object.freeze({ seed: 23, rulerId: "ruler" }),
    world: Object.freeze({ historical: false, polities: Object.freeze([Object.freeze({ treasury: 50, id: "hadara" })]) }),
    optional: null,
  });
  const request = Object.freeze(copyRequest({ gamePatch }));
  assertKind(request, "copy");
  assert.equal(request.gamePatch, gamePatch);
  assert.equal(sourceGame.game.world.polities[0].treasury, 50);
});

test("treats any changed game field, added field or explicit different scenario as new", () => {
  for (const gamePatch of [
    { gameDate: "-218-03-01" }, { startDate: "-218-03-01" },
    { gameDate: "2016-2-1" }, { name: "Renamed inside the game" },
    { newField: null }, { world: { ...sourceGame.game.world, historical: true } },
    { characterSystem: { ...sourceGame.game.characterSystem, seed: 24 } },
    { world: { polities: [], historical: false } },
  ]) assertKind(copyRequest({ gamePatch, kind: "copy", restore: true }), "new");
  assertKind(copyRequest({ scenarioId: "bronze-age" }), "new");
  assertKind(copyRequest({ scenarioId: false }), "new");
  assertKind(copyRequest({ scenarioId: 0 }), "new");
});

test("structural equality preserves array order and distinguishes arrays from objects", () => {
  const stored = { scenarioId: "scenario", game: { values: [1, { a: 2 }, 3], object: {} } };
  const request = { seedGameId: "source", sourceGame: stored };
  assertKind({ ...request, gamePatch: { values: [1, { a: 2 }, 3] } }, "copy");
  assertKind({ ...request, gamePatch: { values: [3, { a: 2 }, 1] } }, "new");
  assertKind({ ...request, gamePatch: { object: [] } }, "new");
});

test("explicit plain historical-start options request a new campaign", () => {
  for (const historicalStart of [{}, { date: "-3300-01-01" }]) {
    assertKind(copyRequest({ historicalStart }), "new");
    assertKind({ scenarioId: "bronze-age", historicalStart }, "new");
  }
});

test("rejects supplied malformed patches and historical-start options", () => {
  for (const value of [undefined, null, [], "", 1, false, new Date(0)]) {
    for (const request of [{}, copyRequest()]) {
      const patch = classifyCampaignCreation({ ...request, gamePatch: value });
      assert.deepEqual(patch, { ok: false, code: "invalidPatch", error: "Speländringarna måste vara ett objekt." });
      const options = classifyCampaignCreation({ ...request, historicalStart: value });
      assert.deepEqual(options, { ok: false, code: "invalidOptions", error: "Alternativen för historisk start måste vara ett objekt." });
    }
  }
});

test("fails a missing or malformed copy source before considering changes", () => {
  for (const source of [undefined, null, {}, [], { game: {} }, { scenarioId: "", game: {} },
    { scenarioId: "hadara" }, { scenarioId: "hadara", game: null },
    { scenarioId: "hadara", game: [] }]) {
    for (const changes of [{}, { scenarioId: "bronze-age" }, { historicalStart: {} },
      { gamePatch: { gameDate: "1200-01-01" } }, { gamePatch: null }, { historicalStart: null }]) {
      assert.deepEqual(classifyCampaignCreation(copyRequest({ sourceGame: source, ...changes })), {
        ok: false, code: "missingCopySource", error: "Det sparade spelet som ska kopieras saknas.",
      });
    }
  }
});
