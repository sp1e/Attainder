// What the translator (translator.js) does in each language, as decisions that
// need no DOM, so translatorMode.test.js can ask every one of them.
//
// The game has two layers of text. The upstream interface is written in
// English; the character system is written in Swedish. So:
//
//   pack    any language but English. The English interface is swapped for
//           the language's pack, and what the pack lacks may go to the
//           player's AI model (translator.js, top). Swedish court text is
//           shown as written.
//   native  English. The interface is shown as written, and the Swedish text
//           is swapped for English from the native book (nativePack.js). No
//           model, no cache, nothing written to the server.
//   off     no language to work in.

import { DEFAULT_LANGUAGE } from "./i18n.js";
import { createDateLocalizer } from "./localDates.js";
import { englishValue } from "./swedishDates.js";
import { looksSwedish } from "./swedishText.js";

// The roots of the views written in Swedish carry this attribute.
export const NATIVE_TEXT_SELECTOR = "[data-native-text]";

// The source the character system stamps on the public events it adds to the
// world's event stream (characterTransitionEvents in characterWorld.js).
export const CHARACTER_EVENT_SOURCE = "character-system";

const NATIVE_TEXT_PROPS = Object.freeze({ "data-native-text": "" });
const NO_PROPS = Object.freeze({});

// The props for an element of an upstream view (the event log, a country's
// history) that shows one world event's title or description. The character
// system writes its events in Swedish, and most of their titles are short
// patterns ("{{name}} föds") that the strong tier never applies, so such an
// element is marked as Swedish-native and gets the whole book. Every other
// event is the model's or the scenario author's text and stays unmarked.
export const nativeEventProps = (event) =>
  (event && typeof event === "object" && event.source === CHARACTER_EVENT_SOURCE ? NATIVE_TEXT_PROPS : NO_PROPS);

// English as the interface writes it: two Latin letters side by side. Only
// such text is English source that a pack or a model could translate. What a
// model wrote in the player's own script (Chinese, Russian, Arabic) and a
// Swedish word like "Mål" may be looked up in the book, but are never queued
// or listed as missing from a pack.
const ENGLISH_WORDS = /[A-Za-z]{2}/;

export const translatorMode = (language) => {
  if (typeof language !== "string" || !language.trim()) return "off";
  return language.trim() === DEFAULT_LANGUAGE ? "native" : "pack";
};

// Only pack mode ever talks to the model, reads the device's cache or writes
// to the server's pack.
export const usesModel = (mode) => mode === "pack";

// The book for a mode. The native book gets the lookups Swedish text needs
// (phraseBook.js) and no date rule: its dates are entries and pattern values
// written in Swedish, and the English ones on the page are already English.
export const bookOptions = (language) => {
  const mode = translatorMode(language);
  if (mode === "native") return { native: true, localizeValue: englishValue };
  if (mode === "pack") return { localizeValue: createDateLocalizer(language) };
  return {};
};

const isSwedish = (language) => typeof language === "string" && language.trim() === "sv";

// May this string be sent to the model as English content?
//
// In Swedish, never a string that reads as Swedish, sentence or label: the
// court's and the packages' text would be sent off to be put "from English"
// into the language it is already in, and come back changed or guessed at.
//
// In every other language the Swedish check is not made. looksSwedish knows
// Swedish by å, ä, ö and a short word list, and English content is full of
// both: region names (Kärnten, Oberösterreich, Bingöl, Hövsgöl) and words the
// list shares ("kung fu", "ska"). Held back, such a string would never be
// translated for a player in German or Turkish. Swedish text that reaches the
// model there is translated like any other content, as it was before the
// modes (the design keeps those languages "as today").
//
// In Swedish the same wrong yes costs little: a name with those letters reads
// the same in Swedish, and a sentence held back stays English.
export const mayQueueForModel = (mode, text, language) =>
  usesModel(mode) && typeof text === "string" && ENGLISH_WORDS.test(text) && !(isSwedish(language) && looksSwedish(text));

// What becomes of a rendered string the book has nothing for:
//   "missing"  listed in window.__ohI18n.missing;
//   "model"    queued for the player's AI model;
//   "none"     left as it is.
// With a shipped pack an English string the pack lacks is listed for the next
// pack, as before. A string that reads as Swedish is not: pack mode shows the
// court's text as written, and a pack keyed by the interface's English has no
// gap where the page holds Swedish. Without a shipped pack the string goes to
// the model, unless the language is Swedish and so is the string
// (mayQueueForModel; `language` is the translator's).
//
// In native mode it depends on where the string is (`tier`, from tierFor).
// Inside a Swedish-native view ("full") everything is written in Swedish, so
// every string the book lacks is a gap. The detector is not asked there: it
// knows Swedish by å, ä, ö and a short word list, and misses a fifth of the
// catalog ("Till:", "den Store", "Krig"). Outside such a view ("strong", and
// the default) the page is the English interface, which is meant to stay, and
// only a string the detector reads as Swedish is a gap.
export const unknownTextFate = (mode, text, { packed = false, tier = "strong", language } = {}) => {
  if (typeof text !== "string") return "none";
  if (mode === "native") return tier === "full" || looksSwedish(text) ? "missing" : "none";
  if (mode !== "pack" || !ENGLISH_WORDS.test(text)) return "none";
  // In Swedish a Swedish-native view holds no gap of the pack and nothing for
  // the model: its text is already the player's language, with or without a
  // letter the detector knows ("Kampanjens identitet").
  if (tier === "native-view" && isSwedish(language)) return "none";
  if (packed) return looksSwedish(text) ? "none" : "missing";
  return mayQueueForModel(mode, text, language) ? "model" : "none";
};

// Which part of the book answers for a piece of the page. In native mode the
// whole book applies inside a Swedish-native view; outside one only entries
// and strong patterns do, so a short Swedish pattern cannot rewrite the
// English interface ("Hot dog stand" under "{{name}} dog {{date}}"). A pack is
// keyed by the interface's own English and always applies whole.
export const tierFor = (mode, insideNativeText) => {
  if (mode === "native") return insideNativeText ? "full" : "strong";
  return mode === "pack" && insideNativeText ? "native-view" : "full";
};

// The options book.translate takes for a tier.
export const translateOptions = (tier) => (tier === "strong" ? { strongOnly: true } : undefined);

// Entries of the native book that the English interface writes too, with
// another meaning: "stat" is the Swedish for a state (a kind of polity,
// POLITY_KIND_LABELS_SV) and the interface's word for a statistic. Outside the
// Swedish-native views such a string is the interface's own, so the strong
// tier leaves it alone; inside one, and as a value of a Swedish sentence, it
// is translated like any other entry.
//
// The interface catalog (public/lang/catalog-en.json) is not loaded at run
// time, so the shared strings are named here. nativePackData.test.js compares
// this list with the real overlap of the catalogs and fails when they differ.
export const SHARED_WITH_INTERFACE = Object.freeze(["stat"]);
const SHARED = new Set(SHARED_WITH_INTERFACE);

// The book's answer for a string under a tier, or null.
export const translateInTier = (book, text, tier) => {
  if (typeof text !== "string") return null;
  if (tier === "strong" && SHARED.has(text.trim())) return null;
  return book.translate(text, translateOptions(tier));
};

// Swedish mode reads the research's Swedish for source locators and
// institutions (historical-sv.json) beside its pack.
export const usesSwedishHistoricalPack = (language) => translatorMode(language) === "pack" && language.trim() === "sv";

// A record the game wrote in Swedish itself: a shipped historical start, a
// campaign started from one, or a world that carries a historical scenario or
// a character system. In Swedish its names are already the player's language,
// and many of them ("Frankrike", "Khmerriket") have no letter or word the
// detector knows, so the content collector leaves the whole record alone.
export const isSwedishAuthored = (record) =>
  Boolean(record && typeof record === "object"
    && (record.historicalStart || record.historicalSummary || record.historicalScenario || record.characterSystem));

export const skipsNativeContent = (language, record) => isSwedish(language) && isSwedishAuthored(record);
