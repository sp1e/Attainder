// Run: node --test src/runtime/translatorModes.test.js
//
// English mode end to end, without a browser. First the native book alone,
// made the way the translator makes it from the real files under
// public/lang/attainder/: the full tier against the strong tier on real
// strings. Then startTranslator itself over a page of stand-in nodes (only the
// few members translator.js reads), to pin what native mode must never do:
// ask for the server's pack, queue a string for a model, or write anywhere.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { createMemoryStorage } from "../Game/AI/requestBudget.js";
import { NATIVE_PACK_PATHS, SWEDISH_HISTORICAL_PATH, loadNativePack } from "./nativePack.js";
import { createPhraseBook } from "./phraseBook.js";
import {
  enqueueContentStrings,
  enqueueEventStrings,
  enqueueStrings,
  nativeReading,
  startTranslator,
  stopTranslator,
  translateLabel,
} from "./translator.js";
import { bookOptions, translateInTier } from "./translatorMode.js";

const PUBLIC = new URL("../../public", import.meta.url);
const readPublic = (path) => JSON.parse(fs.readFileSync(new URL(`${PUBLIC.href}${path}`), "utf8"));

// What slice 3 will put in en.json, as far as these tests need it: a weak
// pattern, a strong one and two entries.
const SAMPLE_CODE = {
  "{{name}} dog {{date}}": "{{name}} died {{date}}",
  "Riket går i krig vid {{name}}s sida": "The realm goes to war at {{name}}'s side",
  "Sändebud": "Envoy",
  "Hovet saknar silver": "The court lacks silver",
  "stat": "state",
};

// A real event title and a real name of historical-en.json.
const TITLE = "Hugo Capet kröns till kung";
const TITLE_EN = "Hugh Capet is crowned king";

const fileJson = async (path) => (path === NATIVE_PACK_PATHS.code ? { ...readPublic(path), ...SAMPLE_CODE } : readPublic(path));

// The code layer as it will be when en.json is complete: every entry of
// catalog-sv.json as a key, mapped to itself behind a marker (a pattern keeps
// its slots, so it matches as the real translation will). What en.json
// already has wins.
const MARKER = "EN:";
const markerCodePack = () => ({
  ...Object.fromEntries(readPublic("/lang/attainder/catalog-sv.json").entries.map((entry) => [entry, `${MARKER}${entry}`])),
  ...readPublic(NATIVE_PACK_PATHS.code),
});

// ---- the native book ----

const nativeBook = async () => {
  const book = createPhraseBook(bookOptions("en"));
  book.setAll(await loadNativePack(fileJson));
  return book;
};

test("the native book reads the three real files, and an entry answers in both tiers", async () => {
  const book = await nativeBook();
  assert.ok(book.size() > 4000, `${book.size()} entries`);
  assert.equal(readPublic(NATIVE_PACK_PATHS.historical)[TITLE], TITLE_EN, "the title is a real pair");
  assert.equal(book.translate(TITLE), TITLE_EN);
  assert.equal(book.translate(TITLE, { strongOnly: true }), TITLE_EN);
  assert.equal(book.translate("Sändebud", { strongOnly: true }), "Envoy");
  assert.equal(book.translate("Hovet saknar silver.", { strongOnly: true }), "The court lacks silver.", "a builder's period");
});

test("a weak pattern answers inside a Swedish-native view only", async () => {
  const book = await nativeBook();
  assert.equal(book.translate("Karl dog 814"), "Charles died 814", "the name is a research pair");
  assert.equal(book.translate("Karl dog 814", { strongOnly: true }), null);
  // Why: the same pattern over the English interface.
  assert.equal(book.translate("Hot dog stand"), "Hot died stand");
  assert.equal(book.translate("Hot dog stand", { strongOnly: true }), null);
});

test("a strong pattern answers in both tiers", async () => {
  const book = await nativeBook();
  for (const options of [undefined, { strongOnly: true }]) {
    assert.equal(book.translate("Riket går i krig vid Karls sida", options), "The realm goes to war at Charles's side");
  }
});

test("the strong tier leaves every string of the English interface untouched, with every key of the code catalog in the book", async () => {
  // The book as the translator makes it, with the code layer complete: each
  // entry of catalog-sv.json is a key (markerCodePack), beside the samples.
  const complete = async (path) => (path === NATIVE_PACK_PATHS.code ? { ...markerCodePack(), ...SAMPLE_CODE } : readPublic(path));
  const book = createPhraseBook(bookOptions("en"));
  book.setAll(await loadNativePack(complete));
  assert.ok(book.patternCount() > 600, `${book.patternCount()} patterns`);
  assert.equal(translateInTier(book, "Karl föds", "full"), `${MARKER}Charles föds`, "a real weak pattern of the catalog");
  assert.equal(translateInTier(book, "Karl föds", "strong"), null);
  const catalog = readPublic("/lang/catalog-en.json");
  assert.ok(catalog.length > 5000);
  const touched = catalog.filter((english) => translateInTier(book, english, "strong") != null);
  assert.deepEqual(touched, []);
  for (const english of ["Save game", "Declare war on {{target}}", "Hot dog stand"]) {
    assert.equal(translateInTier(book, english, "strong"), null, english);
  }
});

// ---- startTranslator over a stand-in page ----

const SKIP = "[data-no-translate]";
const NATIVE = "[data-native-text]";

const makeElement = ({ native = false, skip = false, attributes = {}, parent = null } = {}) => {
  const self = {
    attributes: { ...attributes },
    childNodes: [],
    isConnected: true,
    nodeType: 1,
    closest(selector) {
      for (let at = self; at; at = at.parent) {
        if (selector === NATIVE ? at.native : selector.includes(SKIP) && at.skip) return at;
      }
      return null;
    },
    getAttribute: (name) => self.attributes[name] ?? null,
    native,
    parent,
    setAttribute: (name, value) => { self.attributes[name] = value; },
    skip,
  };
  return self;
};

const page = { elements: [], observers: [], startupScreen: false, texts: [] };

const addText = (value, options = {}) => {
  const parent = makeElement({ ...options, parent: page.body });
  const node = { nodeType: 3, nodeValue: value, parentElement: parent, parentNode: parent };
  parent.childNodes.push(node);
  page.elements.push(parent);
  page.texts.push(node);
  return node;
};

const installPage = () => {
  page.body = makeElement();
  page.body.style = {};
  page.body.matches = () => false;
  page.body.querySelectorAll = () => page.elements.filter((element) => Object.keys(element.attributes).length);
  globalThis.Node = { ELEMENT_NODE: 1, TEXT_NODE: 3 };
  globalThis.NodeFilter = { FILTER_ACCEPT: 1, FILTER_REJECT: 2, SHOW_TEXT: 4 };
  globalThis.MutationObserver = class {
    constructor() { this.connected = false; page.observers.push(this); }
    observe() { this.connected = true; }
    disconnect() { this.connected = false; }
  };
  globalThis.document = {
    body: page.body,
    createTreeWalker: (_root, _what, { acceptNode }) => {
      const nodes = page.texts.filter((node) => acceptNode(node) === NodeFilter.FILTER_ACCEPT);
      let index = 0;
      return { nextNode: () => nodes[index++] ?? null };
    },
    documentElement: { lang: "" },
    querySelector: (selector) => (selector === "[data-startup-screen]" && page.startupScreen ? {} : null),
    title: "",
  };
  const listeners = new Set();
  globalThis.window = {
    addEventListener: (name) => { listeners.add(name); },
    dispatchEvent: () => true,
    listeners,
    location: { reload: () => { page.reloads = (page.reloads ?? 0) + 1; } },
    removeEventListener: (name) => { listeners.delete(name); },
  };
};

// Every request the page makes, and an answer for each.
const requests = [];
const installFetch = ({ settings, serverPack = {} }) => {
  globalThis.fetch = async (url, init = {}) => {
    const path = String(url);
    requests.push(`${init.method ?? "GET"} ${path}`);
    const answer = (value) => ({ json: async () => value, ok: true, status: 200 });
    if (path === "/api/ui-settings") return answer(settings);
    if (path.startsWith("/api/lang/")) return answer(serverPack);
    if (path === "/api/scenarios" || path === "/api/games") return answer([]);
    if (Object.values(NATIVE_PACK_PATHS).includes(path)) return answer(await fileJson(path));
    if (path === SWEDISH_HISTORICAL_PATH) return answer(readPublic(path));
    return { json: async () => ({}), ok: false, status: 404 };
  };
};

const until = async (condition, what) => {
  const deadline = Date.now() + 10000;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));
const watching = () => page.observers.filter((observer) => observer.connected).length;

// A page of its own for one test: the translator stopped, no node, observer or
// request left from the test before, the language stored on the device and on
// the server, and the translator stopped again when the test ends. Each test
// below starts here, so it passes alone and in any order.
const freshPage = (t, { language, serverPack = {} }) => {
  stopTranslator();
  page.elements.length = 0;
  page.observers.length = 0;
  page.texts.length = 0;
  page.startupScreen = false;
  page.reloads = 0;
  requests.length = 0;
  installPage();
  globalThis.localStorage = createMemoryStorage({ ui_language: language });
  installFetch({ settings: { language }, serverPack });
  t.mock.method(console, "warn", () => {});
  t.after(() => stopTranslator());
};

test("English mode: the native book translates the page in two tiers and asks no one else", async (t) => {
  freshPage(t, { language: "en" });

  const inside = addText("Karl dog 814", { native: true });
  const outside = addText("Karl dog 814");
  const interfaceText = addText("Hot dog stand");
  const title = addText(TITLE);
  const strong = addText("Riket går i krig vid Karls sida");
  const gap = addText("Hovet har inget silver kvar");
  addText("Mål", { native: true });
  // Swedish the detector does not recognise: a gap inside a native view, the
  // English interface for all the translator knows outside one.
  const unmarked = addText("Under beskydd", { native: true });
  addText("Fly till landsbygden");
  // A Swedish entry the English interface also writes.
  const stateInside = addText("stat", { native: true });
  const statOutside = addText("stat");
  const free = addText("Sändebud", { skip: true });
  const hinted = addText("Sändebud", { native: true, attributes: { title: "Karl dog 814" } }).parentElement;
  const plain = addText("Envoy", { attributes: { title: "Karl dog 814", "aria-label": "Sändebud" } }).parentElement;
  document.title = TITLE;

  startTranslator();
  await until(() => watching() === 1, "the page to be watched");

  assert.equal(inside.nodeValue, "Charles died 814", "the whole book inside a native view");
  assert.equal(outside.nodeValue, "Karl dog 814", "no weak pattern outside one");
  assert.equal(interfaceText.nodeValue, "Hot dog stand");
  assert.equal(title.nodeValue, TITLE_EN, "an entry applies everywhere");
  assert.equal(strong.nodeValue, "The realm goes to war at Charles's side", "and so does a strong pattern");
  assert.equal(gap.nodeValue, "Hovet har inget silver kvar", "what the book lacks stays Swedish");
  assert.equal(unmarked.nodeValue, "Under beskydd");
  assert.equal(stateInside.nodeValue, "state", "the Swedish word inside a native view");
  assert.equal(statOutside.nodeValue, "stat", "the interface's own word outside one");
  assert.equal(free.nodeValue, "Sändebud", "data-no-translate is still skipped");
  assert.equal(hinted.attributes.title, "Charles died 814", "an attribute takes its element's tier");
  assert.equal(plain.attributes.title, "Karl dog 814");
  assert.equal(plain.attributes["aria-label"], "Envoy");
  assert.equal(document.title, TITLE_EN, "the title is read in the strong tier");
  assert.equal(document.documentElement.lang, "en");

  const state = window.__ohI18n;
  assert.deepEqual([state.language, state.mode, state.packed], ["en", "native", false]);
  assert.equal(typeof state.rescan, "function");
  assert.deepEqual([...state.missing].sort(), ["Hovet har inget silver kvar", "Mål", "Under beskydd"],
    "outside a native view only text the detector reads as Swedish is a gap; inside one every unknown string is");
  assert.equal(state.pending.size, 0);

  // The map's labels, and the calls that queue content in pack mode.
  assert.equal(translateLabel("Karl"), "Charles");
  assert.equal(translateLabel("Rome"), "Rome");
  assert.equal(translateLabel("Kungen av Asturien"), "Kungen av Asturien");
  assert.ok(state.missing.has("Kungen av Asturien"), "a Swedish label the book lacks is a gap too");
  // What a Swedish-native view searches without rendering: the whole book's
  // reading, weak patterns included, and nothing listed for what it lacks.
  assert.equal(nativeReading("Karl dog 814"), "Charles died 814");
  assert.equal(nativeReading("Sändebud"), "Envoy");
  assert.equal(nativeReading("Drottningen av Navarra"), "Drottningen av Navarra");
  assert.equal(state.missing.has("Drottningen av Navarra"), false, "a searched field is not a rendered gap");
  assert.equal(nativeReading(null), null);
  enqueueStrings(["Declare war on France", "A new scenario"]);
  enqueueContentStrings({ name: "The Long Peace", description: "A scenario about a long peace." });
  enqueueEventStrings([{ title: "A war begins", description: "It begins in spring." }]);
  state.rescan();
  await settle();
  assert.equal(state.pending.size, 0, "nothing is ever queued for a model");

  assert.deepEqual([...requests].sort(), [
    "GET /api/ui-settings",
    `GET ${NATIVE_PACK_PATHS.code}`,
    `GET ${NATIVE_PACK_PATHS.historical}`,
    `GET ${NATIVE_PACK_PATHS.packages}`,
  ].sort(), "three static files and the language setting: no pack, no cache, no model, no write");
  assert.equal(localStorage.getItem("i18n_v2_en"), null);
  assert.equal(window.listeners.has("oh:active-game-changed"), false, "no content is collected on a switch of save");
  assert.equal(page.reloads ?? 0, 0);
});

test("a second start changes nothing; a start after a stop watches the page again", async (t) => {
  freshPage(t, { language: "en" });
  const early = addText("Sändebud");
  startTranslator();
  await until(() => watching() === 1, "the page to be watched");
  assert.equal(early.nodeValue, "Envoy");

  const before = requests.length;
  assert.ok(before > 0, "the first start asked for its files");
  startTranslator();
  await settle();
  assert.equal(page.observers.length, 1);
  assert.equal(requests.length, before, "not even the language setting is asked for again");

  stopTranslator();
  assert.equal(watching(), 0);
  assert.equal(translateLabel("Karl"), "Karl", "a stopped translator translates nothing");
  assert.equal(nativeReading("Sändebud"), "Sändebud");

  const late = addText("Sändebud");
  startTranslator();
  await until(() => watching() === 1, "the page to be watched again");
  assert.equal(page.observers.length, 2);
  assert.equal(late.nodeValue, "Envoy");
  assert.equal(window.__ohI18n.mode, "native");
  stopTranslator();
});

test("Swedish mode: the pack, then the research's Swedish under it, and no Swedish text for the model", async (t) => {
  const locators = Object.entries(readPublic(SWEDISH_HISTORICAL_PATH));
  const [locator, locatorSv] = locators[0];
  const [claimed] = locators[1];
  freshPage(t, { language: "sv", serverPack: { "Save game": "Spara spelet", [claimed]: "Packens egen text" } });

  const button = addText("Save game", { native: true });
  const court = addText("Karl dog 814", { native: true });
  const source = addText(locator);
  // Court text the pack was never meant to hold, and interface text it lacks.
  addText("Hovet saknar silver.", { native: true });
  addText("Kungen är död");
  addText("Declare war on Mars");

  startTranslator();
  await until(() => watching() === 1, "the page to be watched");

  assert.deepEqual([window.__ohI18n.language, window.__ohI18n.mode, window.__ohI18n.packed], ["sv", "pack", true]);
  assert.equal(document.documentElement.lang, "sv");
  assert.ok(requests.indexOf("GET /api/lang/sv") >= 0, "the server's pack is read");
  assert.ok(requests.indexOf(`GET ${SWEDISH_HISTORICAL_PATH}`) > requests.indexOf("GET /api/lang/sv"), "and the research pairs after it");
  assert.equal(requests.some((request) => Object.values(NATIVE_PACK_PATHS).some((path) => request.endsWith(path))), false, "the native pack is English mode's");

  assert.equal(button.nodeValue, "Spara spelet");
  assert.equal(court.nodeValue, "Karl dog 814", "data-native-text means nothing in pack mode");
  assert.equal(source.nodeValue, locatorSv, "a source locator reads Swedish");
  assert.equal(translateLabel(claimed), "Packens egen text", "the pack's entry is not replaced by a research pair");

  const { missing, pending } = window.__ohI18n;
  assert.ok(missing.has("Declare war on Mars"), "English the pack lacks is a gap in the pack");
  assert.equal(missing.has("Hovet saknar silver."), false, "the court's Swedish is not");
  assert.equal(missing.has("Kungen är död"), false);
  assert.equal(translateLabel("Hovet saknar silver"), "Hovet saknar silver");
  enqueueStrings(["Krig med Danmark", "Kungen är död"]);
  assert.equal(pending.size, 0, "Swedish text is never queued for the model");
  assert.equal(nativeReading("Save game"), "Save game", "the native reading is English mode's: the pack is not asked");
  assert.equal(nativeReading("Frankrike"), "Frankrike");
  assert.equal(pending.size, 0, "and a searched field is never queued");
  assert.equal(translateLabel("The Long Peace"), "The Long Peace");
  assert.deepEqual([...pending], ["The Long Peace"], "English content still is");
  stopTranslator();
  assert.equal(watching(), 0);
});

test("German mode: a name with ä or ö and English with a word Swedish shares are content for the model", async (t) => {
  freshPage(t, { language: "de", serverPack: { "Save game": "Spiel speichern" } });
  const button = addText("Save game");
  startTranslator();
  await until(() => watching() === 1, "the page to be watched");
  assert.deepEqual([window.__ohI18n.language, window.__ohI18n.mode, window.__ohI18n.packed], ["de", "pack", true]);
  assert.equal(button.nodeValue, "Spiel speichern");

  // translateLabel queues a name the book lacks, as the map's labels do.
  const { pending } = window.__ohI18n;
  for (const name of ["Kärnten", "Oberösterreich", "Bingöl", "Hövsgöl", "Kung fu fighting"]) assert.equal(translateLabel(name), name);
  assert.deepEqual([...pending], ["Kärnten", "Oberösterreich", "Bingöl", "Hövsgöl", "Kung fu fighting"], "only Swedish mode holds text back for looking Swedish");
  stopTranslator();
});
