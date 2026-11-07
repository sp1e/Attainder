import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { transformSync } from "esbuild";
import * as realEvents from "../../runtime/historicalEvents.js";
import * as realDates from "../../runtime/gameDates.js";
import * as realRange from "../../runtime/historicalResearchRange.js";
import { createHookDriver, findAll, settle, textOf } from "../testing/hookDriver.js";

const coverage = JSON.parse(readFileSync(new URL("../../../server/seed/historical/events/coverage.json", import.meta.url), "utf8"));
const compileFile = (name) => transformSync(readFileSync(new URL(`./${name}`, import.meta.url), "utf8"), {
  loader: "jsx", format: "cjs", jsx: "transform",
}).code;
const recordCompiled = compileFile("HistoricalRecordView.jsx");
const requestCompiled = compileFile("historyRecordRequest.js");
const cardCompiled = compileFile("HistoricalEventCard.jsx");

function runModule(code, modules, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: (id) => {
    assert.ok(id in modules, `Unexpected import: ${id}`);
    return modules[id];
  }, console, ...globals });
  return module.exports;
}

const source = { id: "s1", title: "Källa", institution: "Institutet", url: "https://example.org/a", locator: "s. 4", retrievedOn: "2026-11-01", originalChronology: "AD", reuseTerms: "CC0" };
const event = (id, year, patch = {}) => ({
  id, titleSv: `Händelse ${id}`, summarySv: `Sammanfattning ${id}`, geographySv: "Frankrike", category: "politics", importance: 2,
  sourceIds: ["s1"], date: { kind: "exact", startYear: year, endYear: year, displaySv: String(year) }, ...patch,
});

function load({ catalog = { schemaVersion: 1, sources: [source], events: [] }, loadError = null, coverageOverride = coverage } = {}) {
  const driver = createHookDriver();
  const control = { loads: 0, listeners: [], removed: [], writes: [] };
  const modules = {
    react: driver.react,
    "../../runtime/historicalEvents.js": realEvents,
    "../../runtime/gameDates.js": realDates,
    "../../runtime/historicalEventCatalog.js": { loadHistoricalEventCatalog: async () => { control.loads += 1; if (loadError) throw loadError; return catalog; } },
    "../../runtime/historicalResearchRange.js": realRange,
    "../../../server/seed/historical/events/coverage.json": coverageOverride,
    "./characters.css": {},
  };
  modules["./HistoricalEventCard.jsx"] = runModule(cardCompiled, { ...modules });
  const win = {
    addEventListener: (name, listener) => control.listeners.push({ name, listener }),
    removeEventListener: (name, listener) => control.removed.push({ name, listener }),
  };
  const exports = runModule(recordCompiled, modules, { window: win });
  return { exports, driver, control };
}

const mountView = async (props, options) => {
  const m = load(options);
  const render = (next = props) => m.driver.render(React.createElement(m.exports.default, next));
  render();
  await settle();
  return { ...m, render };
};
const headings = (tree) => findAll(tree, (n) => n.type === "h4").map((n) => textOf(n).trim());
const cards = (tree) => findAll(tree, (n) => n.type === "article").map((n) => textOf(findAll(n, (c) => c.type === "h3")[0]).trim());

test("events appear grouped by year, newest year first", async () => {
  const catalog = { sources: [source], events: [event("a", 801), event("b", 802), event("c", 802, { importance: 3 })] };
  const m = await mountView({ startDate: "0800-01-01", gameDate: "0804-01-01" }, { catalog });
  const tree = m.render();
  assert.deepEqual(headings(tree), ["802 e.Kr.", "801 e.Kr."]);
  assert.deepEqual(cards(tree), ["Händelse c", "Händelse b", "Händelse a"]);
});

test("BC years read as f.Kr., newest (closest to AD) first", async () => {
  const catalog = { sources: [source], events: [event("a", -219), event("b", -218)] };
  const m = await mountView({ startDate: "-0220-01-01", gameDate: "-0216-01-01" }, { catalog });
  assert.deepEqual(headings(m.render()), ["218 f.Kr.", "219 f.Kr."]);
});

test("a lower gameDate after an undo drops the later years", async () => {
  const catalog = { sources: [source], events: [event("a", 801), event("b", 802)] };
  const m = await mountView({ startDate: "0800-01-01", gameDate: "0804-01-01" }, { catalog });
  assert.deepEqual(headings(m.render()), ["802 e.Kr.", "801 e.Kr."]);
  assert.deepEqual(headings(m.render({ startDate: "0800-01-01", gameDate: "0802-01-01" })), ["801 e.Kr."]);
  assert.equal(m.control.loads, 1, "the catalog loads once");
});

test("no approved events shows the empty text", async () => {
  const m = await mountView({ startDate: "0800-01-01", gameDate: "0804-01-01" });
  assert.match(textOf(m.render()), /Inga godkända händelser ännu för de år kampanjen har passerat\./);
});

test("a rejected catalog load shows the empty text and does not throw", async () => {
  const m = await mountView({ startDate: "0800-01-01", gameDate: "0804-01-01" }, { loadError: new Error("chunk failed") });
  assert.match(textOf(m.render()), /Inga godkända händelser ännu/);
});

test("the catalog loads when the view is shown, not before", async () => {
  const m = load();
  assert.equal(m.control.loads, 0);
});

test("the research note appears only once the game has passed the researched range", async () => {
  const note = /Forskningen sträcker sig till år 999\./;
  const before = await mountView({ startDate: "0990-01-01", gameDate: "0999-06-01" });
  assert.doesNotMatch(textOf(before.render()), note);
  const after = await mountView({ startDate: "0990-01-01", gameDate: "1000-01-01" });
  assert.match(textOf(after.render()), note);
});

test("no research note is shown when no range is researched", async () => {
  const m = await mountView({ startDate: "0990-01-01", gameDate: "1300-01-01" }, { coverageOverride: { ranges: [{ startYear: -3300, endYear: 1530, status: "unresearched" }] } });
  assert.doesNotMatch(textOf(m.render()), /Forskningen/);
});

const loadRequestHook = () => {
  const driver = createHookDriver();
  const listeners = [];
  const win = {
    addEventListener: (name, listener) => listeners.push({ name, listener }),
    removeEventListener: () => {},
  };
  const exports = runModule(requestCompiled, { react: driver.react }, { window: win });
  return { exports, driver, listeners };
};

test("the chronicle request hook calls back once per event and counts them", () => {
  const m = loadRequestHook();
  const seen = [];
  const Probe = ({ gameId }) => { const count = m.exports.useHistoryRecordRequest(gameId, () => seen.push("open")); return React.createElement("i", null, String(count)); };
  const render = (gameId = "A") => m.driver.render(React.createElement(Probe, { gameId }));
  assert.equal(textOf(render()), "0");
  const entry = m.listeners.find((l) => l.name === "oh:open-history-record");
  assert.ok(entry, "listens for the popup's window event");
  entry.listener();
  entry.listener();
  assert.equal(textOf(render()), "2");
  assert.deepEqual(seen, ["open", "open"]);
});

test("a request made in campaign A has no effect in campaign B", () => {
  const m = loadRequestHook();
  const Probe = ({ gameId }) => React.createElement("i", null, String(m.exports.useHistoryRecordRequest(gameId, () => {})));
  const render = (gameId) => m.driver.render(React.createElement(Probe, { gameId }));
  render("A");
  m.listeners.at(-1).listener();
  assert.equal(textOf(render("A")), "1");
  assert.equal(textOf(render("B")), "0", "campaign B starts with no pending request");
  m.listeners.at(-1).listener();
  assert.equal(textOf(render("B")), "1", "a request in B counts from zero");
});

test("the main chunk imports only the request file, which pulls in neither the view nor the card", () => {
  const request = readFileSync(new URL("./historyRecordRequest.js", import.meta.url), "utf8");
  assert.deepEqual([...request.matchAll(/from "([^"]+)"/g)].map((m) => m[1]), ["react"]);
  const main = readFileSync(new URL("../GameUI/main.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(main, /HistoricalRecordView|HistoricalEventCard/);
  assert.match(main, /Characters\/historyRecordRequest\.js/);
});

test("a changed request value selects the segment; an unchanged one does not", () => {
  const m = load();
  const calls = [];
  const Probe = ({ request }) => { m.exports.useChronicleRequest(request, () => calls.push(request)); return null; };
  const render = (request) => m.driver.render(React.createElement(Probe, { request }));
  render(0);
  assert.deepEqual(calls, []);
  render(1);
  render(1);
  render(2);
  assert.deepEqual(calls, [1, 2]);
});

// The hook driver has no DOM: document.activeElement and real focus do not exist,
// so this checks the decision (the panel takes focus when it is outside) on stand-ins.
test("holdFocus moves focus into the panel only when it is outside", () => {
  const m = load();
  const log = [];
  const inside = {};
  const first = { focus: () => log.push("first") };
  const panel = { contains: (node) => node === inside, querySelector: (selector) => (selector === "button" ? first : null) };
  m.exports.holdFocus(panel, inside);
  assert.deepEqual(log, []);
  m.exports.holdFocus(panel, {});
  assert.deepEqual(log, ["first"]);
  m.exports.holdFocus(null, {});
});

test("the view makes no network call and writes nothing to a save", () => {
  const text = readFileSync(new URL("./HistoricalRecordView.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(text, /fetch\(|localStorage|sessionStorage|indexedDB|useRuntimeState|runtime\/(?!historical|gameDates)/);
});

test("the headings across the BC/AD boundary read 1 f.Kr. and 1 e.Kr., with no year zero", async () => {
  const catalog = { sources: [source], events: [event("a", -2), event("b", -1), event("c", 1), event("d", 2)] };
  const m = await mountView({ startDate: "-0002-06-01", gameDate: "0003-06-01" }, { catalog });
  assert.deepEqual(headings(m.render()), ["2 e.Kr.", "1 e.Kr.", "1 f.Kr.", "2 f.Kr."]);
});

test("a date note renders on the card when the catalog gives one, and not otherwise", async () => {
  const noted = event("n", 801, { date: { kind: "approximate", startYear: 801, endYear: 801, displaySv: "omkring 801", noteSv: "Källorna anger 800 eller 802." } });
  const catalog = { sources: [source], events: [noted, event("p", 801)] };
  const m = await mountView({ startDate: "0800-01-01", gameDate: "0803-01-01" }, { catalog });
  const tree = m.render();
  const notes = findAll(tree, (n) => n.type === "p" && n.props?.className === "hist-date-note").map((n) => textOf(n).trim());
  assert.deepEqual(notes, ["Källorna anger 800 eller 802."]);
});
