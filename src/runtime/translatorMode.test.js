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
import {
  CHARACTER_EVENT_SOURCE,
  NATIVE_TEXT_SELECTOR,
  bookOptions,
  mayQueueForModel,
  nativeEventProps,
  tierFor,
  translateOptions,
  translatorMode,
  unknownTextFate,
  usesModel,
  usesSwedishHistoricalPack,
} from "./translatorMode.js";

const ENGLISH = "Declare war on France";
const SWEDISH = "Hovet saknar silver.";
const SWEDISH_WORD = "Mål";
const CHINESE = "中国向日本宣战";

const fateIn = (language, text) => unknownTextFate(translatorMode(language), text, { packed: hasShippedPack(language) });

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

test("sv and de: English content may be queued, Swedish text never", () => {
  for (const language of ["sv", "de", "fi"]) {
    const mode = translatorMode(language);
    assert.equal(mayQueueForModel(mode, ENGLISH), true, language);
    assert.equal(mayQueueForModel(mode, SWEDISH), false, language);
    assert.equal(mayQueueForModel(mode, "Krig med Danmark"), false, language);
    assert.equal(mayQueueForModel(mode, SWEDISH_WORD), false, language);
    assert.equal(mayQueueForModel(mode, CHINESE), false, `${language}: text in another script is not English content`);
    assert.equal(mayQueueForModel(mode, null), false, language);
  }
});

test("sv and de: with a shipped pack an unknown English string is listed, as before, and none is queued", () => {
  for (const language of ["sv", "de"]) {
    assert.equal(hasShippedPack(language), true);
    assert.equal(fateIn(language, ENGLISH), "missing", language);
    // As before the modes: the pack's list takes whatever the page shows with
    // English letters in it, and nothing rendered goes to the model.
    assert.equal(fateIn(language, SWEDISH), "missing", language);
    // As before the wider letter rule: text without two Latin letters together
    // was never looked at, and is still neither listed nor queued.
    assert.equal(fateIn(language, SWEDISH_WORD), "none", language);
    assert.equal(fateIn(language, CHINESE), "none", language);
  }
});

test("a language without a pack sends unknown English to the model and keeps Swedish from it", () => {
  assert.equal(hasShippedPack("fi"), false);
  assert.equal(fateIn("fi", ENGLISH), "model");
  assert.equal(fateIn("fi", SWEDISH), "none");
  assert.equal(fateIn("fi", "Krig med Danmark"), "none");
  assert.equal(fateIn("fi", CHINESE), "none");
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
    assert.equal(tierFor(mode, true), "full", language);
    assert.equal(tierFor(mode, false), "full", language);
  }
});

test("en: the book is a native book without a date rule", () => {
  assert.deepEqual(bookOptions("en"), { native: true });
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
