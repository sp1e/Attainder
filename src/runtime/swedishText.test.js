// Run: node --test src/runtime/swedishText.test.js
//
// looksSwedish decides two things in the translator: which unknown strings are
// listed as gaps in English mode, and which strings are never sent to a model
// as English content. A wrong yes on English text is the costly mistake, so
// the rule is run over the whole English catalog and over the English half of
// the research pairs.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { SHARED_WITH_ENGLISH, SWEDISH_WORDS, looksSwedish } from "./swedishText.js";

const LANG = new URL("../../public/lang/", import.meta.url);
const read = (relative) => JSON.parse(fs.readFileSync(new URL(relative, LANG), "utf8"));
const hasSwedishLetter = (text) => /[åäö]/i.test(text);

test("å, ä or ö is enough, in either case and written with a combining mark", () => {
  for (const text of ["Mål", "Hög", "Kungen är död", "ÅR 800", "Mål", "Ätten Capet"]) {
    assert.equal(looksSwedish(text), true, text);
  }
});

test("a Swedish word between non-letters is enough", () => {
  for (const text of [
    "Krig med Danmark",
    "5 silver och 2 guld",
    "Fred eller vapenvila",
    "Familjen saknar silver",
    "Dotter (av Karl)",
    "Arv enligt testamentet",
    "Ett hus delas",
  ]) {
    assert.equal(looksSwedish(text), true, text);
  }
});

test("with a capital a word counts only as the first word of the text", () => {
  assert.equal(looksSwedish("Hovet saknar silver."), true);
  assert.equal(looksSwedish("Det slog tillbaka"), true);
  assert.equal(looksSwedish("Riket sviker Karl"), true);
  assert.equal(looksSwedish("  Kungen abdikerar"), true, "leading whitespace is not text");
  // Further in, a capital is a name.
  assert.equal(looksSwedish("Ibn Sina"), false);
  assert.equal(looksSwedish("Prince Kung"), false);
  assert.equal(looksSwedish("Request orders, e.g. move to the Med"), false);
  assert.equal(looksSwedish("The AV club"), false);
});

test("a word inside a longer word does not count, whatever letters surround it", () => {
  // \b would end a word at á, é or í and find "kan", "har", "det" and "att".
  for (const text of ["kanál", "harém", "detí", "atténuation", "Kansas", "share", "attack", "format"]) {
    assert.equal(looksSwedish(text), false, text);
  }
});

test("words English shares are not on the list, so English does not match through them", () => {
  for (const word of SHARED_WITH_ENGLISH) {
    assert.equal(SWEDISH_WORDS.includes(word), false, `${word} is on the list`);
  }
  for (const text of [
    "Hot dog stand",
    "Hold the den under siege till dawn",
    "A sin under the law",
    "En route to Paris",
    "Aix-en-Provence",
    "van den Berg",
    "Save game",
    "I am the man; the men agree",
  ]) {
    assert.equal(looksSwedish(text), false, text);
  }
});

test("what is not text, or is empty, is not Swedish", () => {
  for (const value of [null, undefined, 7, "", "   ", {}, ["och"]]) assert.equal(looksSwedish(value), false);
});

test("the list is lower case, without duplicates, and holds the words the design names", () => {
  assert.equal(new Set(SWEDISH_WORDS).size, SWEDISH_WORDS.length);
  for (const word of SWEDISH_WORDS) assert.equal(word, word.toLowerCase(), word);
  for (const word of ["och", "att", "inte", "eller", "från", "hov", "rike", "kung", "drottning"]) {
    assert.ok(SWEDISH_WORDS.includes(word), word);
  }
});

test("no entry of the English catalog matches through a word", () => {
  const catalog = read("catalog-en.json");
  assert.ok(catalog.length > 5000, `only ${catalog.length} catalog entries were read`);
  const hits = catalog.filter(looksSwedish);
  assert.deepEqual(hits.filter((text) => !hasSwedishLetter(text)), []);
  // The one entry left is a Swedish-language place name, matched by its Å.
  assert.deepEqual(hits, ["Åland"]);
});

test("no English half of a research pair matches through a word", () => {
  const english = [
    ...Object.values(read("attainder/historical-en.json")),
    ...Object.keys(read("attainder/historical-sv.json")),
  ];
  assert.ok(english.length > 5000, `only ${english.length} strings were read`);
  // English prose that names Möngke or Strängnäs matches by its letters, which
  // is the rule; no English sentence may match by a word.
  assert.deepEqual(english.filter((text) => looksSwedish(text) && !hasSwedishLetter(text)), []);
});

test("most Swedish research text is recognised", () => {
  const swedish = Object.keys(read("attainder/historical-en.json")).filter((text) => text.trim().split(/\s+/).length >= 3);
  const caught = swedish.filter(looksSwedish).length;
  assert.ok(caught / swedish.length > 0.8, `${caught} of ${swedish.length} Swedish strings of three words or more`);
});
