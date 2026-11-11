/*! Open Historia — phrase book tests © 2026 Nicholas Krol, AGPL-3.0-or-later (see LICENSE). */
// Run: node --test src/runtime/phraseBook.test.js
//
// The shipped language packs translate the interface by the English the game
// renders: exactly, or by a pattern around a value ("Found {{count}} regions").
// These pin how a rendered string finds its translation, and the guards that
// keep a short pattern from rewriting prose that merely starts with its words.

import test from "node:test";
import assert from "node:assert/strict";

import { compilePattern, createPhraseBook, isPatternKey, slotNames } from "./phraseBook.js";

const bookOf = (entries) => {
  const book = createPhraseBook();
  book.setAll(entries);
  return book;
};

test("an exact string is found as it is, and with its whitespace collapsed", () => {
  const book = bookOf({ "Save game": "Spiel speichern", "Save   the game": "Das Spiel speichern" });
  assert.equal(book.translate("Save game"), "Spiel speichern");
  assert.equal(book.translate("  Save game \n"), "Spiel speichern", "the caller's surrounding whitespace does not matter");
  assert.equal(book.translate("Save\n the game"), "Das Spiel speichern", "a line break where the source had spaces");
  assert.equal(book.translate("Load game"), null);
  assert.equal(book.has("Save game"), true);
});

test("a pattern fills its slots, in the translation's own order", () => {
  const book = bookOf({
    "Found {{count}} regions": "{{count}} Regionen gefunden",
    "{{name}} declared war on {{target}}": "{{target}} wurde von {{name}} der Krieg erklärt",
  });
  assert.equal(book.translate("Found 12 regions"), "12 Regionen gefunden");
  assert.equal(book.translate("Found  1,204\nregions"), "1,204 Regionen gefunden", "any whitespace between the words");
  assert.equal(
    book.translate("The Kingdom of France declared war on Spain"),
    "Spain wurde von The Kingdom of France der Krieg erklärt",
  );
  assert.equal(book.translate("Found regions"), null, "the literal text must all be there");
});

test("a slot's value is translated too when the book knows it", () => {
  const book = bookOf({ "Edit {{label}}": "{{label}} bearbeiten", Borders: "Grenzen" });
  assert.equal(book.translate("Edit Borders"), "Grenzen bearbeiten");
  assert.equal(book.translate("Edit Cities"), "Cities bearbeiten", "an unknown value stays as it is");
});

test("the most specific pattern wins", () => {
  const book = bookOf({
    "{{count}} flags": "{{count}} Flaggen",
    "{{count}} flags · scenario": "{{count}} Flaggen · Szenario",
  });
  assert.equal(book.translate("3 flags · scenario"), "3 Flaggen · Szenario");
  assert.equal(book.translate("3 flags"), "3 Flaggen");
});

test("an exact entry wins over a pattern that also matches", () => {
  const book = bookOf({ "Round {{value}}": "Runde {{value}}", "Round 1": "Erste Runde" });
  assert.equal(book.translate("Round 1"), "Erste Runde");
  assert.equal(book.translate("Round 2"), "Runde 2");
});

test("a weak pattern does not rewrite prose that starts with its words", () => {
  const book = bookOf({ "Our {{label}}": "Unser {{label}}", "by {{author}}": "von {{author}}" });
  assert.equal(book.translate("Our army"), "Unser army", "a short value is what the pattern is for");
  assert.equal(book.translate("by Arkniem"), "von Arkniem");
  assert.equal(book.translate("Our position is clear and we will not yield"), null);
  assert.equal(book.translate("by the way, I think we should talk"), null);
});

test("a weak pattern's value is a number or a name, not words and numbers together", () => {
  const book = createPhraseBook({ localizeValue: (text) => (text === "Jan 1, 2016" ? "1. Jan. 2016" : null) });
  book.setAll({ "{{value}} regions": "{{value}} Regionen", "{{value}} updated": "{{value}} aktualisiert" });
  assert.equal(book.translate("12 regions"), "12 Regionen");
  assert.equal(book.translate("Modern Day updated"), "Modern Day aktualisiert");
  assert.equal(book.translate("Found 12 regions"), null, "the start of another sentence");
  assert.equal(book.translate("Jan 1, 2016 updated"), "1. Jan. 2016 aktualisiert", "a date is known");
});

test("a value never spans sentences unless the pattern is substantial", () => {
  const book = bookOf({
    "{{name}} saved.": "{{name}} gespeichert.",
    "The editor could not save {{name}}.": "Der Editor konnte {{name}} nicht speichern.",
  });
  assert.equal(book.translate("Map saved."), "Map gespeichert.");
  assert.equal(book.translate("It failed. Then it saved."), null);
  assert.equal(
    book.translate("The editor could not save it. Try again."),
    "Der Editor konnte it. Try again nicht speichern.",
    "a long literal is evidence enough that this is the template",
  );
});

test("two slots with nothing between them are not a pattern", () => {
  assert.equal(compilePattern("{{charAt}}{{slice}} of {{overlord}}", "{{charAt}}{{slice}} von {{overlord}}"), null);
  const book = bookOf({ "{{charAt}}{{slice}} of {{overlord}}": "{{charAt}}{{slice}} von {{overlord}}" });
  assert.equal(book.translate("Kingdom of Spain"), null);
});

test("a pattern without words of its own is never compiled", () => {
  assert.equal(compilePattern("({{count}})", "({{count}})"), null);
  assert.equal(compilePattern("Plain text", "Klartext"), null, "no slot, no pattern");
  assert.equal(isPatternKey("Found {{count}} regions"), true);
  assert.equal(isPatternKey("Braces {{ like this"), false);
});

test("a slot named twice takes its values in order; one the English lacks is dropped", () => {
  const book = bookOf({
    "{{value}} of {{value}} done": "{{value}} von {{value}} erledigt",
    "Moved {{unit}}": "{{unit}} verlegt {{nowhere}}",
  });
  assert.equal(book.translate("3 of 7 done"), "3 von 7 erledigt");
  assert.equal(book.translate("Moved Fleet"), "Fleet verlegt");
});

test("values with dollar signs are inserted literally", () => {
  const book = bookOf({ "Budget: {{amount}}": "Haushalt: {{amount}}", "$5 million": "5 Mio. $" });
  assert.equal(book.translate("Budget: $5 million"), "Haushalt: 5 Mio. $");
  assert.equal(book.translate("Budget: $& $1"), "Haushalt: $& $1");
});

test("a list joined with / or · is translated part by part", () => {
  const book = bookOf({ Japan: "日本", "Round {{value}}": "第{{value}}回合" });
  assert.equal(book.translate("Modern Day Session / Japan / 1453"), "Modern Day Session / 日本 / 1453");
  assert.equal(book.translate("Japan · Round 3"), "日本 · 第3回合", "a part may be a pattern");
  assert.equal(book.translate("Nothing / known here"), null, "unchanged when no part is known");
  assert.equal(book.translate("The war ended — Japan"), null, "a dash is prose, not a list");
});

test("a pattern's last value may be a list, and is translated part by part", () => {
  const book = createPhraseBook({ localizeValue: (text) => (text === "Jan 1, 2016" ? "1. Jan. 2016" : null) });
  book.setAll({ "Playing as {{countryName}}": "Spielt als {{countryName}}", France: "Frankreich" });
  assert.equal(book.translate("Playing as France · Jan 1, 2016"), "Spielt als Frankreich · 1. Jan. 2016");
});

test("a later entry replaces an earlier one, patterns included", () => {
  const book = bookOf({ "Found {{count}} regions": "{{count}} Regionen" });
  assert.equal(book.translate("Found 2 regions"), "2 Regionen");
  book.set("Found {{count}} regions", "{{count}} Regionen gefunden");
  assert.equal(book.translate("Found 2 regions"), "2 Regionen gefunden", "the remembered answer is not reused");
  book.set("Save game", "Speichern");
  book.set("Save game", "Spiel speichern");
  assert.equal(book.translate("Save game"), "Spiel speichern");
});

// The native book: keyed by the game's own Swedish, for English mode. Its three
// extra lookups are for sentences the engine builds from other sentences, and
// a book keyed by English never gets them.

const nativeBookOf = (entries) => {
  const book = createPhraseBook({ native: true });
  book.setAll(entries);
  return book;
};

const REALMS = {
  "Spelbara riken: {{list}}": "Playable realms: {{list}}",
  "{{name}} och {{other}}": "{{name}} and {{other}}",
  Frankerriket: "Frankish kingdom",
  Tangriket: "Tang Empire",
};

const NESTED = {
  "Hovet meddelar: {{news}}": "The court announces: {{news}}",
  "Budbäraren säger: {{words}}": "The messenger says: {{words}}",
  "Brevet lyder: {{text}}": "The letter reads: {{text}}",
  "Sigillet visar: {{mark}}": "The seal shows: {{mark}}",
  Lejon: "Lion",
};

test("native: a slot's value is translated by pattern too", () => {
  const book = nativeBookOf(REALMS);
  assert.equal(book.translate("Spelbara riken: Frankerriket och Tangriket"), "Playable realms: Frankish kingdom and Tang Empire");
  assert.equal(book.translate("Spelbara riken: Wessex och Tangriket"), "Playable realms: Wessex and Tang Empire", "an unknown name inside the value stays");
  assert.equal(
    bookOf(REALMS).translate("Spelbara riken: Frankerriket och Tangriket"),
    "Playable realms: Frankerriket och Tangriket",
    "an English-keyed book looks a value up exactly, by rule or as a list, as before",
  );
});

test("native: patterns inside values stop two levels down", () => {
  const book = nativeBookOf(NESTED);
  assert.equal(
    book.translate("Budbäraren säger: Brevet lyder: Sigillet visar: Lejon"),
    "The messenger says: The letter reads: The seal shows: Lion",
    "two patterns inside the first, and an entry inside the last",
  );
  assert.equal(
    book.translate("Hovet meddelar: Budbäraren säger: Brevet lyder: Sigillet visar: Lejon"),
    "The court announces: The messenger says: The letter reads: Sigillet visar: Lejon",
    "the third pattern down is not looked for",
  );
});

test("native: a comma list of entries is translated item by item", () => {
  const cities = { Rom: "Rome", Aten: "Athens", Kairo: "Cairo", "Spelbara riken: {{list}}": "Playable realms: {{list}}" };
  const book = nativeBookOf(cities);
  assert.equal(book.translate("Rom, Aten, Kairo"), "Rome, Athens, Cairo");
  assert.equal(book.translate("Spelbara riken: Rom, Aten"), "Playable realms: Rome, Athens", "as a slot's value too");
  assert.equal(book.translate("Rom, Aten, Sparta"), null, "one unknown item and it is prose with commas");
  assert.equal(book.translate("Rom,Aten"), null, "the separator is a comma and a space");
  assert.equal(book.translate(Array(16).fill("Rom").join(", ")), null, "at most fifteen items");
  assert.equal(book.translate(Array(15).fill("Rom").join(", ")), Array(15).fill("Rome").join(", "));
  const plain = bookOf(cities);
  assert.equal(plain.translate("Rom, Aten, Kairo"), null, "not in an English-keyed book");
  assert.equal(plain.translate("Spelbara riken: Rom, Aten"), "Playable realms: Rom, Aten");
});

test("native: a sentence is found without its final period, and gets it back", () => {
  const court = {
    "Hovet flyttar till Aachen": "The court moves to Aachen",
    "{{name}} kröns i Rom": "{{name}} is crowned in Rome",
    "Källan nämner inget år": "The source gives no year.",
  };
  const book = nativeBookOf(court);
  assert.equal(book.translate("Hovet flyttar till Aachen."), "The court moves to Aachen.");
  assert.equal(book.translate("Karl kröns i Rom."), "Karl is crowned in Rome.", "by pattern when no entry has it");
  assert.equal(book.translate("Källan nämner inget år."), "The source gives no year.", "a translation with its own period keeps one");
  assert.equal(book.translate("Hovet flyttar till Aachen..."), null, "an ellipsis is not a final period");
  assert.equal(book.translate("Hovet flyttar till Aachen!"), null);
  assert.equal(book.translate("Hovet flyttar till Pavia."), null, "the sentence must be known");
  const plain = bookOf(court);
  assert.equal(plain.translate("Hovet flyttar till Aachen."), null, "not in an English-keyed book");
  assert.equal(plain.translate("Karl kröns i Rom."), null);
});

// The engine writes a label into a sentence in lower case (label.toLowerCase()
// in crimes.js, health.js, conversation.js and others), and the catalog has
// the label as it is declared, with its capital.
const LABELS = {
  "{{name}} har avslöjats för {{crime}}. Du avgör hur brottet ska straffas.": "{{name}} has been exposed for {{crime}}. You decide how the crime is punished.",
  "Personen är {{trait}}": "The person is {{trait}}",
  "{{name}} lider av {{condition}}": "{{name}} suffers from {{condition}}",
  "{{name}} använder {{archetype}}s särskilda möjlighet.": "{{name}} uses {{archetype}}'s special opportunity.",
  Mord: "Murder",
  Girig: "Greedy",
  "Svår sjukdom": "Serious illness",
  "Fältherren": "The commander",
  HIV: "HIV",
  "Silla": "Silla",
  "Tang-sändebud": "Tang envoy",
  Karl: "Charles",
  dygdig: "virtuous",
  Dygdig: "The Virtuous",
};

test("native: a lowercased label in a slot is found by its capital, and the translation gets the lower case back", () => {
  const book = nativeBookOf(LABELS);
  assert.equal(book.translate("Karl har avslöjats för mord. Du avgör hur brottet ska straffas."), "Charles has been exposed for murder. You decide how the crime is punished.");
  assert.equal(book.translate("Personen är girig"), "The person is greedy");
  assert.equal(book.translate("Karl lider av svår sjukdom"), "Charles suffers from serious illness", "a label of several words");
  assert.equal(book.translate("Karl använder fältherrens särskilda möjlighet."), "Charles uses the commander's special opportunity.");
  assert.equal(book.translate("Personen är Girig"), "The person is Greedy", "a value written with its capital is the entry itself");
  assert.equal(book.translate("Personen är dygdig"), "The person is virtuous", "an entry for the lower case wins over the fallback");
});

test("native: a whole string in lower case is found by its capital too", () => {
  const book = nativeBookOf(LABELS);
  assert.equal(book.translate("mord"), "murder");
  assert.equal(book.translate("svår sjukdom"), "serious illness");
  assert.equal(book.translate("  mord "), "murder");
  assert.equal(book.translate("dygdig"), "virtuous");
});

test("native: the lower case is not forced on an acronym or on a name both languages write alike", () => {
  const book = nativeBookOf(LABELS);
  assert.equal(book.translate("Personen är hIV"), "The person is HIV", "the translation's second letter is a capital");
  assert.equal(book.translate("Personen är silla"), "The person is Silla", "the same word opens the Swedish and the English");
  assert.equal(book.translate("Personen är tang-sändebud"), "The person is Tang envoy");
  assert.equal(book.translate("Personen är karl"), "The person is charles", "a name the languages write differently cannot be told from a label");
});

test("native: a lowercased value the book knows in neither case stays as it is", () => {
  const book = nativeBookOf(LABELS);
  assert.equal(book.translate("Personen är feg"), "The person is feg");
  assert.equal(book.translate("feg"), null);
  assert.equal(book.translate("mORD"), null, "only the first letter is put back");
  assert.equal(book.translate("7 mord"), null, "a string that does not start with a lowercase letter is not tried");
  assert.equal(book.translate("mord."), null, "the fallback is for a label, not for a sentence");
});

test("native: outside the Swedish views the fallback answers for a value in a strong pattern, never for a whole string", () => {
  const book = nativeBookOf(LABELS);
  assert.equal(book.translate("Karl har avslöjats för mord. Du avgör hur brottet ska straffas.", { strongOnly: true }),
    "Charles has been exposed for murder. You decide how the crime is punished.");
  assert.equal(book.translate("mord", { strongOnly: true }), null, "a lowercase word of the English interface is not capitalised into a Swedish entry");
  assert.equal(book.translate("mord"), "murder", "and the full tier's answer is still its own");
});

test("a book that is not native has no lowercase fallback", () => {
  const book = bookOf({ "Edit {{label}}": "{{label}} bearbeiten", Borders: "Grenzen", War: "Krieg" });
  assert.equal(book.translate("Edit Borders"), "Grenzen bearbeiten");
  assert.equal(book.translate("Edit borders"), "borders bearbeiten", "the value is left as written");
  assert.equal(book.translate("war"), null);
  assert.equal(book.translate("borders"), null);
});

test("slotNames lists a text's slots in order, each as often as it is written", () => {
  assert.deepEqual(slotNames("{{a}} gifter sig med {{ b }} och {{a}}"), ["a", "b", "a"]);
  assert.deepEqual(slotNames("Sändebud"), []);
  assert.deepEqual(slotNames(null), []);
});

// The strong tier is what the translator uses outside the views written in the
// book's language, where the text is someone else's.

const COURT = {
  "{{name}} dog {{date}}": "{{name}} died {{date}}",
  "Riket går i krig vid {{name}}s sida": "The realm goes to war at {{name}}'s side",
  "Hovet flyttar till Aachen": "The court moves to Aachen",
  "{{name}} kröns i Rom": "{{name}} is crowned in Rome",
  Karl: "Charles",
  Rom: "Rome",
};

test("strongOnly: a weak pattern answers in the full tier only", () => {
  const book = nativeBookOf(COURT);
  assert.equal(book.translate("Karl dog 814"), "Charles died 814");
  assert.equal(book.translate("Karl dog 814", { strongOnly: true }), null);
  assert.equal(book.translate("Hot dog stand"), "Hot died stand", "what the weak pattern does to text that is not Swedish");
  assert.equal(book.translate("Hot dog stand", { strongOnly: true }), null);
  assert.equal(book.translate("Karl dog 814"), "Charles died 814", "the strong tier's answer is not remembered for the full tier");
  assert.equal(book.translate("Erik dog 1160", { strongOnly: true }), null);
  assert.equal(book.translate("Erik dog 1160"), "Erik died 1160", "nor the other way round");
  assert.equal(book.translate("Erik dog 1160", { strongOnly: true }), null);
});

test("strongOnly: entries and patterns with eight letters of their own still answer", () => {
  const book = nativeBookOf(COURT);
  assert.equal(book.translate("Rom", { strongOnly: true }), "Rome");
  assert.equal(book.translate("Riket går i krig vid Karls sida", { strongOnly: true }), "The realm goes to war at Charles's side");
  assert.equal(book.translate("Riket går i krig vid Karl dog 814s sida", { strongOnly: true }), "The realm goes to war at Karl dog 814's side", "no weak pattern inside a strong one");
  assert.equal(book.translate("Riket går i krig vid Karl dog 814s sida"), "The realm goes to war at Charles died 814's side");
});

test("strongOnly: a list or a missing period is resolved through entries alone", () => {
  const book = nativeBookOf(COURT);
  assert.equal(book.translate("Rom · Karl dog 814"), "Rome · Charles died 814");
  assert.equal(book.translate("Rom · Karl dog 814", { strongOnly: true }), "Rome · Karl dog 814");
  assert.equal(book.translate("Paris · Karl dog 814", { strongOnly: true }), null);
  assert.equal(book.translate("Rom, Karl", { strongOnly: true }), "Rome, Charles");
  assert.equal(book.translate("Hovet flyttar till Aachen.", { strongOnly: true }), "The court moves to Aachen.");
  assert.equal(book.translate("Karl kröns i Rom", { strongOnly: true }), "Charles is crowned in Rome");
  assert.equal(book.translate("Karl kröns i Rom."), "Charles is crowned in Rome.");
  assert.equal(book.translate("Karl kröns i Rom.", { strongOnly: true }), null, "the sentence without its period is no entry");
});

test("strongOnly: the rule answers for a value inside a strong pattern, not for a whole string", () => {
  const book = createPhraseBook({ localizeValue: (text) => (text === "Jan 1, 2016" ? "1. Jan. 2016" : null) });
  book.setAll({ "Last saved on {{date}}": "Zuletzt gespeichert am {{date}}", "by {{author}}": "von {{author}}" });
  assert.equal(book.translate("Jan 1, 2016"), "1. Jan. 2016");
  assert.equal(book.translate("Jan 1, 2016", { strongOnly: true }), null);
  assert.equal(book.translate("Last saved on Jan 1, 2016", { strongOnly: true }), "Zuletzt gespeichert am 1. Jan. 2016");
  assert.equal(book.translate("by Arkniem", { strongOnly: true }), null, "the tiers are the same in an English-keyed book");
  assert.equal(book.translate("by Arkniem"), "von Arkniem");
});
