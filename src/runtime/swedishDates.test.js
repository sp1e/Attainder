import assert from "node:assert/strict";
import test from "node:test";
import { createPhraseBook } from "./phraseBook.js";
import { englishDateLabel, englishDecimal } from "./swedishDates.js";
import { bookOptions } from "./translatorMode.js";

test("a Swedish date label reads as an English date", () => {
  assert.equal(englishDateLabel("25/12 800 e.Kr."), "25 December AD 800");
  assert.equal(englishDateLabel("1/2 300 f.Kr."), "1 February 300 BC");
  assert.equal(englishDateLabel(" 31/1 1201 e.Kr. "), "31 January AD 1201");
});

test("anything else is left to the book", () => {
  for (const text of ["800 e.Kr.", "25/13 800 e.Kr.", "0/12 800 e.Kr.", "12/25/800", "25/12 800", "Karl dog 814", "", null]) {
    assert.equal(englishDateLabel(text), null, String(text));
  }
});

test("the native book reads a date alone and as a value in a sentence", () => {
  const book = createPhraseBook(bookOptions("en"));
  book.setAll({ "{{name}} dör {{dateLabel}}": "{{name}} dies on {{dateLabel}}" });
  assert.equal(book.translate("25/12 800 e.Kr."), "25 December AD 800");
  assert.equal(book.translate("Karl dör 28/1 814 e.Kr."), "Karl dies on 28 January AD 814");
  assert.equal(book.translate("25/12 800 e.Kr.", { strongOnly: true }), null, "outside the Swedish views a date is the interface's own");
});

test("a decimal comma in an engine sentence reads as a decimal point", () => {
  assert.equal(englishDecimal("−13,8"), "−13.8");
  assert.equal(englishDecimal("+0,25"), "+0.25");
  for (const text of ["1,100", "13", "13,8 silver", "a,b", null]) assert.equal(englishDecimal(text), null, String(text));
  const book = createPhraseBook(bookOptions("en"));
  book.setAll({ "Statskassan förändras med {{amount}} silver.": "The treasury changes by {{amount}} silver." });
  assert.equal(book.translate("Statskassan förändras med −13,8 silver."), "The treasury changes by −13.8 silver.");
});
