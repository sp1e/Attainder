// The engine text sweep (scripts/i18n/sweep-engine-text.mjs) on a sample of the
// starts. The full sweep, every start for 30 years under two seeds, runs from the
// command line: `node scripts/i18n/sweep-engine-text.mjs --check`.
import assert from "node:assert/strict";
import test from "node:test";
import { createPhraseBook } from "./phraseBook.js";
import {
  buildReport, isDisplayText, judge, listCampaigns, loadNativeBook, readAllowList, runSweep, swedishRun, vocabularyOf,
} from "../../scripts/i18n/sweep-engine-text.mjs";

const native = loadNativeBook();
const vocabulary = vocabularyOf(native.pack);

const SAMPLE = Object.freeze([
  "hadara/realm",
  "charlemagne-800/carolingian-realm/family",
  "world-1500/inca-empire/realm",
  "egypt-3000bc/egypt-early-dynastic/realm",
]);

test("the sweep plays every shipped start in both modes, then Hadara", () => {
  const ids = listCampaigns().map((campaign) => campaign.id);
  for (const id of SAMPLE) assert.ok(ids.includes(id), id);
  assert.ok(ids.includes("john-1200/france-capetian/family"));
  assert.deepEqual(ids.slice(-2), ["hadara/realm", "hadara/family"]);
  assert.equal(new Set(ids).size, ids.length);
});

test("codes, ids, dates, colours and links are not text a player reads", () => {
  assert.equal(isDisplayText("id", "person-12"), false);
  assert.equal(isDisplayText("familyId", "Karls hus"), false, "a reference by its key");
  assert.equal(isDisplayText("eventType", "reconciliation"), false, "a code by its key");
  assert.equal(isDisplayText("title", "office:ruler"), false, "an identifier by its shape");
  assert.equal(isDisplayText("title", "0800-12-25"), false);
  assert.equal(isDisplayText("title", "#a0b1c2"), false);
  assert.equal(isDisplayText("title", "https://example.org/"), false);
  assert.equal(isDisplayText("title", "+5"), false, "no word");
  assert.equal(isDisplayText("title", "Karl föds"), true);
});

test("a Swedish run is a side of the book, and a word English shares is no evidence", () => {
  assert.equal(swedishRun("The envoy reaches Bysantinska riket.", vocabulary), "Bysantinska riket");
  assert.equal(swedishRun("The plague takes Huayna Capac.", vocabulary), null);
});

test("each string gets one class", () => {
  const context = { book: native.book, vocabulary, names: new Set(["Huayna Capac", "Barn person-9:s gren av Okänt hus"]), fixtures: new Set(["The harvest failed."]) };
  assert.equal(judge("Pesten tar Huayna Capac", context).class, "translated");
  assert.equal(judge("Huayna Capac", context).class, "name");
  assert.equal(judge("The harvest failed.", context).class, "fixture");
  assert.equal(judge("Helt okänd svensk mening om ingenting", context).class, "untranslated");
  assert.equal(judge("Barn person-9:s gren av Okänt hus", context).class, "partial", "a house the engine names is text, not a name");
  const book = createPhraseBook({ native: true });
  book.setAll({ "{{name}} avslöjas": "{{name}} is exposed" });
  const partial = (vocabularyOfBook) => judge("Gisela avslöjas", { book, vocabulary: vocabularyOfBook, names: new Set(), fixtures: new Set() });
  assert.deepEqual(partial({ swedish: new Set(["Gisela"]), english: new Set() }), { class: "partial", reading: "Gisela is exposed", left: "Gisela" });
  assert.equal(partial({ swedish: new Set(), english: new Set() }).class, "translated");
  assert.equal(judge("Kungen avslöjas", { book, vocabulary, names: new Set(), fixtures: new Set() }).left, "(reads as Swedish)");
});

test("two runs of one configuration collect the same strings", () => {
  const campaigns = listCampaigns().filter((campaign) => campaign.id === "hadara/family");
  const first = runSweep({ years: 3, seeds: 1, campaigns });
  const second = runSweep({ years: 3, seeds: 1, campaigns });
  assert.deepEqual([...second.strings.keys()], [...first.strings.keys()]);
});

test("English mode leaves no engine text Swedish in a sample of the starts", () => {
  const campaigns = listCampaigns().filter((campaign) => SAMPLE.includes(campaign.id));
  assert.equal(campaigns.length, SAMPLE.length);
  const report = buildReport(runSweep({ years: 10, seeds: 1, campaigns }), native, { allow: readAllowList() });
  assert.ok(report.counts.translated.strings > 1500, `${report.counts.translated.strings} strings translated`);
  assert.deepEqual(report.gaps.filter((gap) => !gap.allowed).map((gap) => `${gap.class}: ${gap.text} (${gap.example.path})`), []);
});
