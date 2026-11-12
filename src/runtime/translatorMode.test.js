// Run: node --test src/runtime/translatorMode.test.js
//
// Every decision the translator makes from its mode, for English (native
// mode), Swedish and German (pack mode with a shipped pack) and Finnish (pack
// mode without one): what may go to the model, what is listed as missing,
// which tier of the book answers, and how the book is made.

import test from "node:test";
import assert from "node:assert/strict";

import { characterTransitionEvents } from "./characterWorld.js";
import { hasShippedPack } from "./i18n.js";
import { createPhraseBook } from "./phraseBook.js";
import { looksSwedish } from "./swedishText.js";
import {
  CHARACTER_EVENT_SOURCE,
  NATIVE_TEXT_SELECTOR,
  SHARED_WITH_INTERFACE,
  bookOptions,
  mayQueueForModel,
  nativeEventProps,
  tierFor,
  translateInTier,
  translateOptions,
  translatorMode,
  unknownTextFate,
  usesModel,
  usesSwedishHistoricalPack,
  isSwedishAuthored,
  skipsNativeContent,
} from "./translatorMode.js";

const ENGLISH = "Declare war on France";
const SWEDISH = "Hovet saknar silver.";
const SWEDISH_WORD = "Mål";
const CHINESE = "中国向日本宣战";

const fateIn = (language, text) => unknownTextFate(translatorMode(language), text, { packed: hasShippedPack(language), language });

test("English is native mode, every other language is pack mode, no language is off", () => {
  assert.equal(translatorMode("en"), "native");
  assert.equal(translatorMode(" en "), "native");
  for (const language of ["sv", "de", "fi", "zh"]) assert.equal(translatorMode(language), "pack", language);
  for (const language of ["", "  ", null, undefined, 7]) assert.equal(translatorMode(language), "off", String(language));
});

test("only pack mode works with the model, the cache and the server's pack", () => {
  assert.equal(usesModel("pack"), true);
  assert.equal(usesModel("native"), false);
  assert.equal(usesModel("off"), false);
});

test("en: nothing is ever queued for the model", () => {
  const mode = translatorMode("en");
  for (const text of [ENGLISH, SWEDISH, SWEDISH_WORD, CHINESE, "Sändebud"]) {
    assert.equal(mayQueueForModel(mode, text), false, text);
    assert.notEqual(fateIn("en", text), "model", text);
  }
});

test("en: a Swedish string the book lacks is listed as missing, anything else is left alone", () => {
  assert.equal(fateIn("en", SWEDISH), "missing");
  assert.equal(fateIn("en", SWEDISH_WORD), "missing", "a word with no two Latin letters together still counts");
  assert.equal(fateIn("en", ENGLISH), "none", "the English interface is meant to stay");
  assert.equal(fateIn("en", CHINESE), "none");
});

// Catalog entries the detector does not read as Swedish: their only marker is
// a word English shares, or they have none.
const UNMARKED_SWEDISH = ["Till:", "den Store", "Under beskydd", "Fly till landsbygden", "Karl den yngre", "Krig", "Stark"];

test("en: inside a Swedish-native view every string the book lacks is a gap, whatever the detector says", () => {
  const mode = translatorMode("en");
  for (const text of [...UNMARKED_SWEDISH, SWEDISH, SWEDISH_WORD, ENGLISH, CHINESE]) {
    assert.equal(unknownTextFate(mode, text, { tier: tierFor(mode, true) }), "missing", text);
  }
  assert.equal(unknownTextFate(mode, null, { tier: "full" }), "none");
});

test("en: outside the Swedish-native views the detector still decides, and that is the default", () => {
  const mode = translatorMode("en");
  for (const text of [...UNMARKED_SWEDISH, ENGLISH, CHINESE]) {
    assert.equal(looksSwedish(text), false, text);
    assert.equal(unknownTextFate(mode, text, { tier: tierFor(mode, false) }), "none", text);
    assert.equal(unknownTextFate(mode, text), "none", `${text}: no tier given`);
  }
  assert.equal(unknownTextFate(mode, SWEDISH, { tier: "strong" }), "missing");
  assert.equal(unknownTextFate(mode, SWEDISH_WORD, { tier: "strong" }), "missing");
});

test("sv, de and fi: the tier changes nothing about an unknown string", () => {
  for (const language of ["sv", "de", "fi"]) {
    const mode = translatorMode(language);
    const packed = hasShippedPack(language);
    for (const text of [ENGLISH, SWEDISH, SWEDISH_WORD, CHINESE, "Under beskydd"]) {
      assert.equal(unknownTextFate(mode, text, { packed, tier: "full" }), unknownTextFate(mode, text, { packed }), `${language}: ${text}`);
      assert.equal(unknownTextFate(mode, text, { packed, tier: "strong" }), unknownTextFate(mode, text, { packed }), `${language}: ${text}`);
    }
  }
});

// What the detector reads as Swedish and is not: names with å, ä or ö from the
// region catalog, and English with a word the list shares.
const NOT_SWEDISH = ["Kärnten", "Oberösterreich", "Bingöl", "Hövsgöl", "Kung fu fighting", "A night of ska music"];

test("sv: English content may be queued, the court's Swedish never, sentence or label", () => {
  const mode = translatorMode("sv");
  assert.equal(mayQueueForModel(mode, ENGLISH, "sv"), true);
  assert.equal(mayQueueForModel(mode, ENGLISH, " sv "), true);
  for (const text of [SWEDISH, "Krig med Danmark", "Kungen är död", "Riket går i krig vid Karls sida", "Förvaltning", "Sändebud", "Hög", SWEDISH_WORD]) {
    assert.equal(mayQueueForModel(mode, text, "sv"), false, text);
    assert.equal(mayQueueForModel(mode, text, " sv "), false, text);
  }
  // The price of the rule in Swedish: these are kept back too. A name with
  // those letters reads the same in Swedish, and the rest stays English.
  for (const text of NOT_SWEDISH) assert.equal(mayQueueForModel(mode, text, "sv"), false, text);
  assert.equal(mayQueueForModel(mode, CHINESE, "sv"), false, "text in another script is not English content");
  assert.equal(mayQueueForModel(mode, null, "sv"), false);
});

test("de, tr and fi: the Swedish check is not made, so a foreign name and English with a shared word reach the model", () => {
  for (const language of ["de", "tr", "fi"]) {
    const mode = translatorMode(language);
    assert.equal(mayQueueForModel(mode, ENGLISH, language), true, language);
    for (const text of NOT_SWEDISH) {
      assert.equal(looksSwedish(text), true, `${text} is a wrong yes of the detector`);
      assert.equal(mayQueueForModel(mode, text, language), true, `${language}: ${text}`);
    }
    // Swedish that reaches the model in such a language is translated like any
    // other content, as it was before the modes.
    assert.equal(mayQueueForModel(mode, "Krig med Danmark", language), true, language);
    assert.equal(mayQueueForModel(mode, SWEDISH_WORD, language), false, `${language}: no two Latin letters together`);
    assert.equal(mayQueueForModel(mode, CHINESE, language), false, `${language}: text in another script is not English content`);
    assert.equal(mayQueueForModel(mode, null, language), false, language);
  }
  // Without a language the check cannot be Swedish's.
  assert.equal(mayQueueForModel("pack", "Kärnten"), true);
});

test("sv and de: with a shipped pack an unknown English string is listed, as before, and none is queued", () => {
  for (const language of ["sv", "de"]) {
    assert.equal(hasShippedPack(language), true);
    assert.equal(fateIn(language, ENGLISH), "missing", language);
    // The court's Swedish is shown as written in pack mode. It is no gap in a
    // pack keyed by the interface's English, so it stays off the list.
    for (const text of [SWEDISH, "Krig med Danmark", "Kungen är död", "Familjen saknar silver"]) {
      assert.equal(fateIn(language, text), "none", `${language}: ${text}`);
    }
    // As before the wider letter rule: text without two Latin letters together
    // was never looked at, and is still neither listed nor queued.
    assert.equal(fateIn(language, SWEDISH_WORD), "none", language);
    assert.equal(fateIn(language, CHINESE), "none", language);
  }
});

test("a language without a pack sends what the page shows in Latin letters to the model, as before the modes", () => {
  assert.equal(hasShippedPack("fi"), false);
  assert.equal(fateIn("fi", ENGLISH), "model");
  for (const text of [...NOT_SWEDISH, SWEDISH, "Krig med Danmark"]) assert.equal(fateIn("fi", text), "model", text);
  assert.equal(fateIn("fi", SWEDISH_WORD), "none");
  assert.equal(fateIn("fi", CHINESE), "none");
});

test("Swedish without a shipped pack would still keep its own text from the model", () => {
  const fate = (text) => unknownTextFate("pack", text, { packed: false, language: "sv" });
  assert.equal(fate(ENGLISH), "model");
  assert.equal(fate(SWEDISH), "none");
  assert.equal(fate("Krig med Danmark"), "none");
});

test("off: nothing happens to anything", () => {
  for (const text of [ENGLISH, SWEDISH, CHINESE]) {
    assert.equal(unknownTextFate("off", text, { packed: true }), "none");
    assert.equal(mayQueueForModel("off", text), false);
  }
  assert.equal(unknownTextFate("native", null), "none");
});

test("en: the whole book inside a Swedish-native view, the strong tier outside", () => {
  assert.equal(tierFor("native", true), "full");
  assert.equal(tierFor("native", false), "strong");
  assert.deepEqual(translateOptions("strong"), { strongOnly: true });
  assert.equal(translateOptions("full"), undefined);
  assert.equal(NATIVE_TEXT_SELECTOR, "[data-native-text]");
});

test("en: outside the Swedish views, a Swedish entry the English interface also writes is left alone", () => {
  const book = createPhraseBook(bookOptions("en"));
  book.setAll({ stat: "state", "Sändebud": "Envoy", "Riket blir en {{kind}} igen": "The realm is a {{kind}} again" });
  assert.deepEqual([...SHARED_WITH_INTERFACE], ["stat"]);
  assert.equal(translateInTier(book, "stat", "full"), "state", "inside a Swedish view it is the Swedish word");
  assert.equal(translateInTier(book, "stat", "strong"), null, "outside one it is the interface's own word");
  assert.equal(translateInTier(book, " stat ", "strong"), null, "whitespace around it changes nothing");
  assert.equal(translateInTier(book, "Sändebud", "strong"), "Envoy", "any other entry answers in both tiers");
  assert.equal(translateInTier(book, "Riket blir en stat igen", "strong"), "The realm is a state again", "and the word still translates as a value of a Swedish sentence");
  assert.equal(translateInTier(book, "Okänt", "strong"), null);
  assert.equal(translateInTier(book, null, "strong"), null);
});

test("a world event the character system wrote is marked as Swedish-native text, any other event is not", () => {
  assert.equal(CHARACTER_EVENT_SOURCE, "character-system");
  const marked = nativeEventProps({ source: CHARACTER_EVENT_SOURCE, title: "Karl föds" });
  assert.deepEqual(marked, { "data-native-text": "" });
  assert.equal(`[${Object.keys(marked)[0]}]`, NATIVE_TEXT_SELECTOR, "the attribute the translator looks for");
  for (const event of [{ source: "ai" }, { source: "scenario" }, { source: "fallback" }, { source: "game-master" }, { title: "No source" }, null, undefined, "character-system"]) {
    assert.deepEqual(nativeEventProps(event), {}, JSON.stringify(event));
  }
});

test("the events the character system adds to the world's stream carry the marked source", () => {
  const state = { date: "0800-01-01", revision: 0 };
  const engine = [{ title: "Karl föds", description: "Ett barn föds vid hovet.", type: "birth" }, { title: "Dold", public: false }];
  const written = characterTransitionEvents(null, { ok: true, state, events: engine }, "op-1");
  assert.deepEqual(written.map((event) => event.title), ["Karl föds"]);
  assert.deepEqual(nativeEventProps(written[0]), { "data-native-text": "" });
  // A transition without a public event still writes one card, in Swedish.
  const [card] = characterTransitionEvents(null, { ok: true, state, events: [] }, "op-2");
  assert.equal(card.title, "En ny dynastisk kampanj");
  assert.deepEqual(nativeEventProps(card), { "data-native-text": "" });
});

test("sv and de: the pack applies whole everywhere, marked view or not", () => {
  for (const language of ["sv", "de", "fi"]) {
    const mode = translatorMode(language);
    assert.equal(tierFor(mode, true), "native-view", language);
    assert.equal(translateOptions(tierFor(mode, true)), undefined, "the pack still applies whole inside a Swedish-native view");
    assert.equal(tierFor(mode, false), "full", language);
  }
});

test("en: the book is a native book that reads Swedish date labels", () => {
  assert.deepEqual(Object.keys(bookOptions("en")), ["native", "localizeValue"]);
  assert.equal(bookOptions("en").native, true);
  assert.equal(bookOptions("en").localizeValue("25/12 800 e.Kr."), "25 December AD 800");
  const book = createPhraseBook(bookOptions("en"));
  book.setAll({ "Hovet flyttar till Aachen": "The court moves to Aachen" });
  assert.equal(book.translate("Hovet flyttar till Aachen."), "The court moves to Aachen.", "the native lookups are on");
  assert.equal(book.translate("Jan 1, 2016"), null, "an English date is left as written");
});

test("sv and de: the book has the language's date rule and no native lookups", () => {
  for (const language of ["sv", "de"]) {
    const options = bookOptions(language);
    assert.deepEqual(Object.keys(options), ["localizeValue"], language);
    assert.equal(typeof options.localizeValue, "function", language);
  }
  const book = createPhraseBook(bookOptions("de"));
  book.setAll({ "Save game": "Spiel speichern" });
  assert.equal(book.translate("Jan 1, 2016"), "1. Jan. 2016");
  assert.equal(book.translate("Save game."), null, "no missing-period lookup outside a native book");
  assert.deepEqual(bookOptions(""), {});
});

test("only Swedish mode reads the research's Swedish pairs", () => {
  assert.equal(usesSwedishHistoricalPack("sv"), true);
  assert.equal(usesSwedishHistoricalPack("en"), false);
  assert.equal(usesSwedishHistoricalPack("de"), false);
  assert.equal(usesSwedishHistoricalPack(""), false);
});

test("in Swedish the content collector leaves a record the game wrote in Swedish alone", () => {
  const start = { name: "Frankrike", historicalStart: { date: "1200-12-31" } };
  const world = { historicalScenario: { contentId: "john-1200" } };
  const campaign = { characterSystem: { date: "1200-12-31" } };
  const hubPost = { name: "Cold War Horizon: 1973", description: "Start in the year 1973." };
  for (const record of [start, world, campaign]) {
    assert.equal(isSwedishAuthored(record), true);
    assert.equal(skipsNativeContent("sv", record), true);
    assert.equal(skipsNativeContent("de", record), false, "another language still sends it to the model");
  }
  assert.equal(isSwedishAuthored(hubPost), false);
  assert.equal(skipsNativeContent("sv", hubPost), false, "a player's English scenario is still translated");
  assert.equal(skipsNativeContent("sv", null), false);
});

test("in Swedish a Swedish-native view holds no gap and nothing for the model", () => {
  const inside = { packed: true, tier: tierFor("pack", true), language: "sv" };
  assert.equal(unknownTextFate("pack", "Kampanjens identitet", inside), "none", "Swedish the detector does not know");
  assert.equal(unknownTextFate("pack", "Kampanjens identitet", { ...inside, packed: false }), "none");
  assert.equal(unknownTextFate("pack", "Kampanjens identitet", { ...inside, tier: tierFor("pack", false) }), "missing", "outside one it is a gap as before");
  assert.equal(unknownTextFate("pack", "Kampanjens identitet", { ...inside, language: "de" }), "missing", "another language keeps today's behaviour");
});
