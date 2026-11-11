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
  if (mode === "native") return { native: true };
  if (mode === "pack") return { localizeValue: createDateLocalizer(language) };
  return {};
};

// May this string be sent to the model as English content? Never Swedish
// text: the court's and the packages' sentences are not English, and a model
// asked to translate them "from English" returns them changed or guessed at.
export const mayQueueForModel = (mode, text) =>
  usesModel(mode) && typeof text === "string" && ENGLISH_WORDS.test(text) && !looksSwedish(text);

// What becomes of a rendered string the book has nothing for:
//   "missing"  listed in window.__ohI18n.missing;
//   "model"    queued for the player's AI model;
//   "none"     left as it is.
// With a shipped pack an English string the pack lacks is listed for the next
// pack, as before. Without one it goes to the model, unless it is Swedish. In
// native mode a Swedish string is a gap in the native book; anything else is
// the English interface, which is meant to stay.
export const unknownTextFate = (mode, text, { packed = false } = {}) => {
  if (typeof text !== "string") return "none";
  if (mode === "native") return looksSwedish(text) ? "missing" : "none";
  if (mode !== "pack" || !ENGLISH_WORDS.test(text)) return "none";
  if (packed) return "missing";
  return mayQueueForModel(mode, text) ? "model" : "none";
};

// Which part of the book answers for a piece of the page. In native mode the
// whole book applies inside a Swedish-native view; outside one only entries
// and strong patterns do, so a short Swedish pattern cannot rewrite the
// English interface ("Hot dog stand" under "{{name}} dog {{date}}"). A pack is
// keyed by the interface's own English and always applies whole.
export const tierFor = (mode, insideNativeText) =>
  mode === "native" && !insideNativeText ? "strong" : "full";

// The options book.translate takes for a tier.
export const translateOptions = (tier) => (tier === "strong" ? { strongOnly: true } : undefined);

// Swedish mode reads the research's Swedish for source locators and
// institutions (historical-sv.json) beside its pack.
export const usesSwedishHistoricalPack = (language) => translatorMode(language) === "pack" && language.trim() === "sv";
