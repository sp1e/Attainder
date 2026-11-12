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
  assert.equal(book.translate("Rom, Aten, Sparta"), "Rome, Athens, Sparta", "an unknown item with the shape of a name stays as it is");
  assert.equal(book.translate("Rom, Aten, kom hem"), null, "one unknown item in lower case and it is prose with commas");
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

// ---- a native book: text the views assemble without words of their own ----

const courtBook = () => {
  const book = createPhraseBook({ native: true });
  book.setAll({
    "Tronföljd": "Succession", "Guvernör": "Governor", "Vakant": "Vacant", "Sorg": "Grief",
    "uppnådda regeringsmål": "reign goals met", "ryktbarhet": "prestige", "månader på tronen": "months on the throne",
    "{{label}} {{number}} av {{number2}}": "{{label}} {{number}} of {{number2}}",
  });
  return book;
};

test("native: a label and its value are read around the colon", () => {
  const book = courtBook();
  assert.equal(book.translate("Tronföljd: +65"), "Succession: +65", "a value without words is kept");
  assert.equal(book.translate("Guvernör: Vakant"), "Governor: Vacant");
  assert.equal(book.translate("Kelan Namar: sorg"), "Kelan Namar: grief", "a full name before a lowercased label");
  assert.equal(book.translate("Tronföljd: okänd text"), null, "an unknown value with words would hide the gap");
  assert.equal(book.translate("Gisela: sorg"), "Gisela: grief", "a name of one word before an entry");
  assert.equal(book.translate("al-Hakam I: sorg"), "al-Hakam I: grief", "a name may open with a prefix hyphened to a capital");
  assert.equal(book.translate("Arvsrätt: sorg"), null, "one unknown word with å, ä or ö is as likely a label the book lacks");
  assert.equal(book.translate("Chans: okänd text"), null, "one unknown word before an unknown value");
  assert.equal(book.translate("Tronföljd: +65", { strongOnly: true }), null, "not outside the Swedish views");
});

test("native: a count against its threshold takes a label of several words", () => {
  const book = courtBook();
  assert.equal(book.translate("månader på tronen 12 av 48"), "months on the throne 12 of 48");
  assert.equal(book.translate("uppnådda regeringsmål 0 av 2 eller ryktbarhet 10 av 40"), "reign goals met 0 of 2 or prestige 10 of 40");
  assert.equal(book.translate("okänd rad 1 av 2"), null, "the label must be known");
  assert.equal(book.translate("uppnådda regeringsmål 0 av 2 eller okänd rad 1 av 2"), null, "every joined part must be known");
});

test("a book that is not native reads none of these", () => {
  const book = createPhraseBook();
  book.setAll({ "Tronföljd": "Succession", "ryktbarhet": "prestige" });
  for (const text of ["Tronföljd: +65", "ryktbarhet 10 av 40", "Tronföljd eller ryktbarhet"]) assert.equal(book.translate(text), null, text);
});

const storyBook = () => {
  const book = createPhraseBook({ native: true });
  book.setAll({
    "Avböj bidraget": "Decline the contribution", "Personlig åsikt −8.": "Personal opinion −8.", "Kostnad:": "Cost:", "0 silver": "0 silver",
    "Kostnad: {{cost}}": "Cost: {{cost}}", "Hovhus {{k}} (genererat)": "Court house {{k}} (generated)",
    "{{name}} kräver {{name2}}": "{{name}} demands {{name2}}", "Årets förvaltning är avslutad": "The year’s administration is concluded",
    "Karls rike": "Charles’s realm", "800 e.Kr.": "AD 800", "Riket": "The realm",
    "Om du avstår till tidsgränsen: {{choice}}": "If you make no choice by the deadline: {{choice}}",
  });
  return book;
};

test("native: sentences set one after another are read one by one", () => {
  const book = storyBook();
  assert.equal(book.translate("Avböj bidraget. Personlig åsikt −8. Kostnad: 0 silver."), "Decline the contribution. Personal opinion −8. Cost: 0 silver.");
  assert.equal(book.translate("Om du avstår till tidsgränsen: Avböj bidraget. Personlig åsikt −8. Kostnad: 0 silver."),
    "If you make no choice by the deadline: Decline the contribution. Personal opinion −8. Cost: 0 silver.", "also as a value in a pattern");
  assert.equal(book.translate("Avböj bidraget. En okänd mening."), null, "every sentence must be known");
  assert.equal(book.translate("Avböj bidraget. Personlig åsikt −8.", { strongOnly: true }), null, "not outside the Swedish views");
});

test("native: a weak pattern takes a value the book reads by another pattern", () => {
  const book = storyBook();
  assert.equal(book.translate("Hovhus 1 (genererat) kräver Aachen"), "Court house 1 (generated) demands Aachen");
  assert.equal(book.translate("Årets förvaltning är avslutad · Hovhus 1 (genererat) kräver Aachen"),
    "The year’s administration is concluded · Court house 1 (generated) demands Aachen", "and as a part of a list");
  assert.equal(book.translate("Found 12 kräver Aachen"), null, "words and a number the book cannot read are still another sentence");
  book.setAll({ "{{year}} e.Kr.": "AD {{year}}", "Bysantinska riket": "Byzantine Empire" });
  assert.equal(book.translate("Bysantinska riket · 800 e.Kr."), "Byzantine Empire · AD 800", "a row is read part by part, not as one year");
});

test("native, strong tier: a part of a list may be a comma list of entries", () => {
  const book = storyBook();
  assert.equal(book.translate("Karls rike, 800 e.Kr. · Riket", { strongOnly: true }), "Charles’s realm, AD 800 · The realm");
  assert.equal(book.translate("Hovhus 1 (genererat) kräver Aachen · Riket", { strongOnly: true }), "Hovhus 1 (genererat) kräver Aachen · The realm", "a weak pattern still stays inside the Swedish views");
});

test("native: a weak pattern takes many words when the book knows every value", () => {
  const book = createPhraseBook({ native: true });
  book.setAll({ "{{name}}, {{age}} år ({{realm}})": "{{name}}, aged {{age}} ({{realm}})", "Karl den yngre": "Charles the Younger", "Karls rike (karolingiska riket)": "Charles’s realm (Carolingian Empire)" });
  assert.equal(book.translate("Karl den yngre, 28 år (Karls rike (karolingiska riket))"), "Charles the Younger, aged 28 (Charles’s realm (Carolingian Empire))");
  assert.equal(book.translate("Gisela, 20 år (Karls rike (karolingiska riket))"), "Gisela, aged 20 (Charles’s realm (Carolingian Empire))", "a short name the languages share");
  assert.equal(book.translate("En okänd lång rad med ord, 28 år (Karls rike (karolingiska riket))"), null, "an unknown value keeps the word limit");
  assert.equal(book.translate("Karl den yngre, 28 år (Karls rike (karolingiska riket))", { strongOnly: true }), null);
});

test("native: a comma list may hold names when the book reads one of its items", () => {
  const book = nativeBookOf({ Rom: "Rome", Aten: "Athens", "{{name}} (genererad)": "{{name}} (generated)", "Pesten tar {{names}}": "The plague takes {{names}}" });
  assert.equal(book.translate("Araua Ocllo, Kuntur Rimaq (genererad), Huayna Capac"), "Araua Ocllo, Kuntur Rimaq (generated), Huayna Capac");
  assert.equal(book.translate("Pesten tar Araua Ocllo, Kuntur Rimaq (genererad), Qori Puma (genererad), Rumi Sunqu (genererad), Huayna Capac"),
    "The plague takes Araua Ocllo, Kuntur Rimaq (generated), Qori Puma (generated), Rumi Sunqu (generated), Huayna Capac");
  assert.equal(book.translate("Araua Ocllo, Huayna Capac"), null, "names alone are not the book's text");
  assert.equal(book.translate("Rom, Aten, Därför"), null, "a capitalised word with å, ä or ö is as likely Swedish the book lacks");
  assert.equal(book.translate("Rom, Aten, Sparta", { strongOnly: true }), null, "the strong tier takes entries alone");
});

test("native: a generated name is read without the mark the engine strips", () => {
  const book = nativeBookOf({
    "Kung Meri (genererad)": "King Meri (generated)", "Gemål {{g}} (genererad)": "Consort {{g}} (generated)",
    "{{name}} (genererad)": "{{name}} (generated)", "{{given}}s lära": "{{given}}’s teaching",
    "{{strength}} grepp över {{value}}": "{{strength}} hook on {{value}}", Starkt: "Strong",
  });
  assert.equal(book.translate("Kung Meris lära"), "King Meri’s teaching");
  assert.equal(book.translate("Starkt grepp över Gemål 1 (genererad)"), "Strong hook on Consort 1 (generated)");
  assert.equal(book.translate("Okänd Person"), null, "the pattern that holds any name before the mark reads nothing");
});

test("native: a note the book has whole may follow a name and a period, however long", () => {
  const note = Array.from({ length: 10 }, (_, index) => `Mening ${index + 1} om spelets regler.`).join(" ");
  const english = Array.from({ length: 10 }, (_, index) => `Sentence ${index + 1} on the game’s rules.`).join(" ");
  const book = nativeBookOf({ "Kungariket Asturien": "Kingdom of Asturias", [note]: english });
  assert.equal(book.translate(`Kungariket Asturien. ${note}`), `Kingdom of Asturias. ${english}`);
  assert.equal(book.translate(`Okänt rike. ${note}`), null, "the head must be read");
});

test("native: a pattern does not split a text inside a parenthesis", () => {
  const book = nativeBookOf({
    "{{name}}, {{age}} år ({{realm}})": "{{name}}, aged {{age}} ({{realm}})",
    "{{relation}} ({{name}}, född {{year}})": "{{relation}} ({{name}}, born {{year}})",
    Dotter: "Daughter", "Bysantinska riket": "Byzantine Empire",
  });
  assert.equal(book.translate("Dotter (Bysantinska riket, född 808), 16 år (Bysantinska riket)"), "Daughter (Byzantine Empire, born 808), aged 16 (Byzantine Empire)");
  assert.equal(book.translate("Gisela, 16 år (Bysantinska riket)"), "Gisela, aged 16 (Byzantine Empire)");
});

test("native: a reading that leaves a value unread gives way to one that reads every part", () => {
  const book = nativeBookOf({ "{{label}} avslöjat": "{{label}} exposed", Förgifta: "Poison", "misslyckat och avslöjat": "failed and exposed" });
  assert.equal(book.translate("Förgifta: misslyckat och avslöjat"), "Poison: failed and exposed");
});

test("native: a label with a signed change, and a list of them", () => {
  const book = nativeBookOf({ statskassan: "the treasury", legitimiteten: "legitimacy" });
  assert.equal(book.translate("statskassan −10"), "the treasury −10");
  assert.equal(book.translate("statskassan −10, legitimiteten +2"), "the treasury −10, legitimacy +2");
  assert.equal(book.translate("okänd post −10"), null, "the label must be known");
});

test("native: a note in parentheses after a name, a label or a record id", () => {
  const book = nativeBookOf({ Kock: "Cook", Försoning: "Reconciliation", "Barn {{id}}": "Child {{id}}", "Hovhus {{i}} (genererat)": "Court house {{i}} (generated)" });
  assert.equal(book.translate("Ciran (Kock)"), "Ciran (Cook)");
  assert.equal(book.translate("Försoning (1516)"), "Reconciliation (1516)");
  assert.equal(book.translate("Barn person-5 (Hovhus 4 (genererat))"), "Child person-5 (Court house 4 (generated))");
  assert.equal(book.translate("Ciran (Okänd)"), null, "one side must be known");
});

test("native: a lowercased label built around a value is read by its pattern", () => {
  const book = nativeBookOf({ "Guvernör: {{city}}": "Governor: {{city}}" });
  assert.equal(book.translate("guvernör: Narim"), "governor: Narim");
});

test("native: the genitive after a name that ends in a digit", () => {
  const book = nativeBookOf({ "Barn {{id}}": "Child {{id}}", "{{genitive}} gren av {{rootHouse}}": "{{genitive}} branch of {{rootHouse}}", "Karls hus": "Charles’s house" });
  assert.equal(book.translate("Barn person-123:s gren av Karls hus"), "Child person-123’s branch of Charles’s house");
  assert.equal(book.translate("Okänd sak 2:s gren av Karls hus"), null, "the book must read the name");
});
