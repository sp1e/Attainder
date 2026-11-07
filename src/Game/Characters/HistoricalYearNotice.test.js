import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformSync } from "esbuild";
import * as realEvents from "../../runtime/historicalEvents.js";
import * as realDates from "../../runtime/gameDates.js";
import { createHistoricalYearSeen } from "../../runtime/historicalYearSeen.js";
import { createMemoryStorage } from "../../runtime/unseenEvents.js";
import { buttonNamed, createHookDriver, findAll, settle, textOf } from "../testing/hookDriver.js";

// Compile the real JSX; the runtime, catalog and storage are stubs or in-memory
// instances, so nothing here touches a model, the network or a save.
const compileFile = (name) => transformSync(readFileSync(new URL(`./${name}`, import.meta.url), "utf8"), {
  loader: "jsx", format: "cjs", jsx: "transform",
}).code;
const noticeCompiled = compileFile("HistoricalYearNotice.jsx");
const cardCompiled = compileFile("HistoricalEventCard.jsx");

function runModule(code, modules, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: (id) => {
    assert.ok(id in modules, `Unexpected import: ${id}`);
    return modules[id];
  }, console, ...globals });
  return module.exports;
}

const source = (id, url = "https://example.org/a") => ({
  id, title: `Källa ${id}`, institution: "Institutet", url, locator: "s. 4", retrievedOn: "2026-11-01", originalChronology: "AD", reuseTerms: "CC0",
});
const event = (id, patch = {}) => ({
  id, titleSv: `Händelse ${id}`, summarySv: `Sammanfattning ${id}`, geographySv: "Frankrike", category: "politics", importance: 2,
  sourceIds: ["s1"], date: { kind: "exact", startYear: 801, endYear: 801, displaySv: "801" }, ...patch,
});
const catalogOf = (events, sources = [source("s1")]) => ({ schemaVersion: 1, sources, events });

// A mounted notice with the game at `gameDate` and everything else stubbed.
function mount({ startDate = "0800-01-01", gameDate = "0802-01-01", busy = false, unseen = [], catalog = catalogOf([event("e1")]),
  loadError = null, hidden = false, gameId = "g1", storage = createMemoryStorage(), turnKey = "" } = {}) {
  const driver = createHookDriver();
  const control = { busy, unseen, listeners: [], idle: [], loads: 0, fetches: 0, writes: [], cleanups: [], deferred: null, doc: { activeElement: { focus: () => { control.returned = true; } } } };
  const seen = createHistoricalYearSeen({ storage });
  // The player has been shown history through the campaign start, as on a fresh campaign.
  seen.seenThrough(gameId, { startDate, gameDate: startDate });
  // Every write to a runtime slice is recorded; the notice must make none.
  const watch = (target) => new Proxy(target, {
    set: (_, key) => { control.writes.push(String(key)); return false; },
    defineProperty: (_, key) => { control.writes.push(String(key)); return false; },
    deleteProperty: (_, key) => { control.writes.push(String(key)); return false; },
  });
  const live = { startDate, gameDate };
  const docs = { game: watch(live), world: watch({}) };
  // The hook driver drops effect cleanups; keep them so a test can unmount.
  const react = { ...driver.react, useEffect: (effect, deps) => driver.react.useEffect(() => {
    const cleanup = effect();
    if (typeof cleanup === "function") control.cleanups.push(cleanup);
  }, deps) };
  const modules = {
    react,
    "../../runtime/useRuntimeState.js": { useRuntimeState: (key, select) => (key === "world" ? turnKey : select ? select(docs[key]) : docs[key]) },
    "../../runtime/unseenEvents.js": {
      UNSEEN_EVENTS_CHANGED: "oh:unseen-events-changed",
      latestTurnEventIds: () => [],
      unseenEvents: { unseenInTurn: () => control.unseen },
    },
    "../../runtime/historicalYearSeen.js": { historicalYearSeen: seen },
    "../../runtime/historicalEvents.js": realEvents,
    "../../runtime/gameDates.js": realDates,
    "../../runtime/historicalEventCatalog.js": { loadHistoricalEventCatalog: async () => { control.loads += 1; if (control.deferred) await new Promise((resolve) => { control.deferred.push(resolve); }); if (loadError) throw loadError; return catalog; } },
    "../AI/simulationStatus.js": {
      isSimulationBusy: () => control.busy,
      subscribeSimulationIdle: (listener) => { control.idle.push(listener); return () => {}; },
    },
    "./characters.css": {},
  };
  modules["./HistoricalEventCard.jsx"] = runModule(cardCompiled, { ...modules });
  const win = {
    matchMedia: () => ({ matches: false }),
    addEventListener: (name, listener, options) => control.listeners.push({ name, listener, capture: options === true || Boolean(options?.capture) }),
    removeEventListener: (name, listener) => { control.listeners = control.listeners.filter((entry) => entry.listener !== listener || entry.name !== name); },
    dispatchEvent: (e) => { control.dispatched = [...(control.dispatched ?? []), e.type]; return true; },
  };
  const exports = runModule(noticeCompiled, modules, {
    window: win, document: control.doc, localStorage: { getItem: () => null },
    CustomEvent: class { constructor(type) { this.type = type; } },
    fetch: () => { control.fetches += 1; throw new Error("no network in these tests"); },
  });
  const Notice = exports.default;
  const render = () => driver.render(React.createElement(Notice, { gameId, hidden }));
  const fire = (name, event = {}) => { for (const entry of [...control.listeners]) if (entry.name === name) entry.listener(event); };
  const unmount = () => { for (const cleanup of control.cleanups.splice(0)) cleanup(); };
  const release = () => { for (const resolve of control.deferred.splice(0)) resolve(); };
  return { render, control, seen, storage, driver, docs, live, fire, unmount, release, dates: { startDate, gameDate } };
}

const shown = async (m) => { m.render(); await settle(); return m.render(); };
const dialogOf = (tree) => findAll(tree, (n) => n.props?.role === "dialog")[0];

test("renders the heading, intro, a card and a source link with rel noreferrer", async () => {
  const m = mount();
  const tree = await shown(m);
  const text = textOf(tree);
  assert.match(text, /I verklighetens historia/);
  assert.match(text, /Det här hände i den verkliga världen\. Din kampanj kan ha tagit en annan väg\./);
  assert.match(text, /Händelse e1/);
  const link = findAll(tree, (n) => n.type === "a")[0];
  assert.equal(link.props.href, "https://example.org/a");
  assert.equal(link.props.rel, "noreferrer");
  const dialog = dialogOf(tree);
  assert.equal(dialog.props["aria-modal"], "true");
  assert.ok(buttonNamed(tree, "Stäng"));
});

test("an approximate card shows displaySv and Ungefärligt datum, never a bare year heading", async () => {
  const approx = event("e2", { date: { kind: "approximate", startYear: 801, endYear: 801, displaySv: "omkring 801" } });
  const m = mount({ catalog: catalogOf([approx]) });
  const tree = await shown(m);
  const text = textOf(tree);
  assert.match(text, /omkring 801/);
  assert.match(text, /Ungefärligt datum/);
  const headings = findAll(tree, (n) => /^h[1-6]$/.test(n.type)).map((n) => textOf(n).trim());
  assert.ok(headings.every((h) => !/^-?\d+$/.test(h)), `bare year heading in ${headings}`);
});

test("only http and https source links are rendered", () => {
  const { default: Card } = runModule(cardCompiled, { react: React, "../../runtime/historicalEvents.js": realEvents }, {});
  const html = renderToStaticMarkup(React.createElement(Card, {
    event: event("e3", { sourceIds: ["s1", "s2"] }),
    sources: [source("s1", "javascript:alert(1)"), source("s2", "http://example.org/b")],
  }));
  assert.doesNotMatch(html, /javascript:/);
  assert.match(html, /href="http:\/\/example\.org\/b"/);
  assert.match(html, /Källa s1/);
});

test("nothing renders while a simulation is busy, and the idle signal brings it", async () => {
  const m = mount({ busy: true });
  assert.equal(await shown(m), null);
  m.control.busy = false;
  for (const listener of m.control.idle) listener();
  await settle();
  assert.match(textOf(m.render()), /Händelse e1/);
});

test("nothing renders while unseen events remain, and the unseen signal brings it", async () => {
  const m = mount({ unseen: ["x"] });
  assert.equal(await shown(m), null);
  m.control.unseen = [];
  for (const { name, listener } of m.control.listeners) if (name === "oh:unseen-events-changed") listener();
  await settle();
  assert.match(textOf(m.render()), /Händelse e1/);
});

test("a window with no events renders nothing and still moves the watermark", async () => {
  const m = mount({ catalog: catalogOf([]) });
  assert.equal(await shown(m), null);
  assert.equal(m.seen.seenThrough("g1", m.dates), "0802-01-01");
});

test("a reload before dismissal shows the card again; dismissal moves the watermark and a remount shows nothing", async () => {
  const storage = createMemoryStorage();
  const first = mount({ storage });
  await shown(first);
  // The first look stored the watermark; a fresh mount on the same storage is a reload.
  const second = mount({ storage });
  const tree = await shown(second);
  assert.match(textOf(tree), /Händelse e1/);
  buttonNamed(tree, "Stäng").props.onClick();
  assert.equal(second.seen.seenThrough("g1", second.dates), "0802-01-01");
  assert.equal(second.render(), null);
  assert.equal(await shown(mount({ storage })), null);
});

test("13 events show 12; the chronicle link closes the dialog, moves the watermark and dispatches its window event", async () => {
  const events = Array.from({ length: 13 }, (_, i) => event(`e${String(i).padStart(2, "0")}`));
  const m = mount({ catalog: catalogOf(events) });
  const tree = await shown(m);
  assert.equal(findAll(tree, (n) => n.type === "article").length, 12);
  buttonNamed(tree, "Visa alla i krönikan").props.onClick();
  assert.deepEqual(m.control.dispatched, ["oh:open-history-record"]);
  assert.equal(m.render(), null);
  assert.equal(m.seen.seenThrough("g1", m.dates), "0802-01-01");
});

test("12 events show no chronicle link", async () => {
  const events = Array.from({ length: 12 }, (_, i) => event(`e${String(i).padStart(2, "0")}`));
  const tree = await shown(mount({ catalog: catalogOf(events) }));
  assert.equal(findAll(tree, (n) => n.type === "button" && /krönikan/.test(textOf(n))).length, 0);
});

test("a rejected catalog load renders nothing and keeps the watermark", async () => {
  const m = mount({ loadError: new Error("chunk failed") });
  assert.equal(await shown(m), null);
  assert.equal(m.seen.seenThrough("g1", { startDate: "0800-01-01", gameDate: "0802-01-01" }), "0800-01-01");
});

test("hidden renders nothing and does not load the catalog", async () => {
  const m = mount({ hidden: true });
  assert.equal(await shown(m), null);
  assert.equal(m.control.loads, 0);
});

const keydown = (key, extra = {}) => ({ key, defaultPrevented: false, shiftKey: false, preventDefault() { this.defaultPrevented = true; }, ...extra });

test("the dialog element receives focus when it opens", async () => {
  const m = mount();
  const tree = await shown(m);
  assert.ok(m.driver.focused.some((host) => host.props.role === "dialog"));
  assert.ok(dialogOf(tree));
});

test("Escape is taken in the capture phase, closes the dialog with focus on body, and returns focus to the opener", async () => {
  const m = mount();
  await shown(m);
  const entry = m.control.listeners.find((l) => l.name === "keydown");
  assert.ok(entry?.capture, "the popup must see Escape before the panel underneath");
  m.control.doc.activeElement = { tagName: "BODY" };
  const event = keydown("Escape");
  m.fire("keydown", event);
  assert.equal(event.defaultPrevented, true, "preventDefault keeps the panel underneath open");
  assert.equal(m.render(), null);
  assert.equal(m.control.returned, true);
});

test("an Escape another handler already took is ignored", async () => {
  const m = mount();
  await shown(m);
  m.fire("keydown", keydown("Escape", { defaultPrevented: true }));
  assert.ok(dialogOf(m.render()));
});

// Two focusable stand-ins inside the dialog, with focus() recorded.
const withItems = async (m) => {
  const tree = await shown(m);
  const node = dialogOf(tree).props.ref.current;
  const log = [];
  const item = (name) => ({ name, tagName: "BUTTON", closest: () => null, focus() { log.push(name); m.control.doc.activeElement = this; } });
  const first = item("first");
  const last = item("last");
  node.querySelectorAll = () => [first, last];
  node.contains = (target) => target === first || target === last || target === node;
  return { node, first, last, log };
};

test("Tab on the last item wraps to the first, Shift+Tab on the first wraps to the last", async () => {
  const m = mount();
  const { first, last, log } = await withItems(m);
  m.control.doc.activeElement = last;
  const forward = keydown("Tab");
  m.fire("keydown", forward);
  assert.equal(forward.defaultPrevented, true);
  assert.deepEqual(log, ["first"]);
  const backward = keydown("Tab", { shiftKey: true });
  m.fire("keydown", backward);
  assert.equal(backward.defaultPrevented, true);
  assert.deepEqual(log, ["first", "last"]);
  // Tab between the two ends is left to the browser.
  m.control.doc.activeElement = first;
  const inside = keydown("Tab");
  m.fire("keydown", inside);
  assert.equal(inside.defaultPrevented, false);
});

test("Tab with focus outside the dialog pulls it back in", async () => {
  const m = mount();
  const { log } = await withItems(m);
  m.control.doc.activeElement = { tagName: "BODY" };
  const event = keydown("Tab");
  m.fire("keydown", event);
  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(log, ["first"]);
});

test("focus landing outside the dialog is pulled back in", async () => {
  const m = mount();
  const { log } = await withItems(m);
  m.fire("focusin", { target: { tagName: "BODY" } });
  assert.deepEqual(log, ["first"]);
});

test("a gameDate change during the catalog load drops the stale result and shows the newer window", async () => {
  const m = mount();
  m.control.deferred = [];
  m.render();
  await settle();
  m.live.gameDate = "0803-01-01";
  m.render();
  await settle();
  assert.equal(m.control.loads, 2);
  m.release();
  await settle();
  const tree = m.render();
  assert.equal(findAll(tree, (n) => n.type === "article").length, 1);
  buttonNamed(tree, "Stäng").props.onClick();
  assert.equal(m.seen.seenThrough("g1", { startDate: "0800-01-01", gameDate: "0803-01-01" }), "0803-01-01");
});

test("unseen events that appear during the catalog load keep the dialog away", async () => {
  const m = mount();
  m.control.deferred = [];
  m.render();
  await settle();
  m.control.unseen = ["x"];
  m.release();
  await settle();
  assert.equal(m.render(), null);
});

test("an unmount during the catalog load shows nothing and moves nothing", async () => {
  const m = mount();
  m.control.deferred = [];
  m.render();
  await settle();
  m.unmount();
  m.release();
  await settle();
  assert.equal(m.render(), null);
  assert.equal(m.seen.seenThrough("g1", m.dates), "0800-01-01");
});

test("the opener is the element focused before the catalog load, not after", async () => {
  const m = mount();
  const opener = { focus: () => { m.control.returnedTo = "opener"; } };
  m.control.doc.activeElement = opener;
  m.control.deferred = [];
  m.render();
  await settle();
  m.control.doc.activeElement = { focus: () => { m.control.returnedTo = "other"; } };
  m.release();
  await settle();
  buttonNamed(m.render(), "Stäng").props.onClick();
  assert.equal(m.control.returnedTo, "opener");
});

test("the theme comes from the character panel key", async () => {
  const tree = await shown(mount());
  const backdrop = findAll(tree, (n) => n.props?.["data-char-theme"])[0];
  assert.equal(backdrop.props["data-char-theme"], "light");
  assert.match(backdrop.props.className, /char-backdrop/);
});

test("rendering and dismissing make no network call and write to no runtime slice", async () => {
  const m = mount();
  // The recorder works: a write through a watched slice is seen.
  try { m.docs.game.gameDate = "x"; } catch { /* a refused write throws in strict mode */ }
  assert.deepEqual(m.control.writes, ["gameDate"]);
  m.control.writes.length = 0;
  const tree = await shown(m);
  buttonNamed(tree, "Stäng").props.onClick();
  assert.equal(m.control.fetches, 0);
  assert.deepEqual(m.control.writes, []);
  assert.equal(m.live.gameDate, "0802-01-01");
});

// A real browser fires focusin synchronously inside focus(); the dialog's own
// listener must not pull focus back from the opener it is returning to.
for (const [name, close] of [
  ["Stäng", (m, tree) => buttonNamed(tree, "Stäng").props.onClick()],
  ["Escape", (m) => m.fire("keydown", keydown("Escape"))],
  ["the chronicle link", (m, tree) => buttonNamed(tree, "Visa alla i krönikan").props.onClick()],
]) {
  test(`the opener keeps focus after ${name} closes the dialog`, async () => {
    const events = Array.from({ length: 13 }, (_, i) => event(`e${String(i).padStart(2, "0")}`));
    const m = mount({ catalog: catalogOf(events) });
    const opener = { name: "opener", focus() { m.control.doc.activeElement = this; m.fire("focusin", { target: this }); } };
    m.control.doc.activeElement = opener;
    const tree = await shown(m);
    const pulled = m.driver.focused.length;
    close(m, tree);
    assert.equal(m.control.doc.activeElement, opener);
    assert.equal(m.driver.focused.length, pulled, "nothing pulled focus back into the dialog");
    assert.equal(m.render(), null);
  });
}
