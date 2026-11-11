// Run: node --test src/runtime/nativeCatalog.test.js
//
// The character and dynasty system is written in Swedish, and the English mode
// translates it at display time with the phrase book, keyed by the Swedish source
// string. Those keys are public/lang/attainder/catalog-sv.json, which
// scripts/i18n/build-native-catalog.mjs reads out of the source. These pin that the
// committed catalog is current, that every pattern compiles, and that the patterns
// match what the engine really writes.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import {
  NATIVE_CATALOG_PATH, NATIVE_CATALOG_SCHEMA, extractNativeCatalog, extractNativeFromSource, nativeCatalogProblems,
  readNativeExclusions, renderNativeCatalog,
} from "../../scripts/i18n/build-native-catalog.mjs";
import { SWEDISH_WORDS as EXTRACTOR_WORDS, looksSwedish as extractorLooksSwedish } from "../../scripts/i18n/extractNativeStrings.mjs";
import { borderLand } from "./characters/claims.js";
import { advanceCharacters, createCharacterSystem } from "./characters/index.js";
import { addGameMonths } from "./gameDates.js";
import { compilePattern, createPhraseBook } from "./phraseBook.js";
import { SHARED_WITH_ENGLISH, SWEDISH_WORDS as RUNTIME_WORDS } from "./swedishText.js";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const COMMITTED = fs.readFileSync(new URL(`../../${NATIVE_CATALOG_PATH}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const CATALOG = JSON.parse(COMMITTED);
const ENTRIES = new Set(CATALOG.entries);

// The English pack will map each Swedish entry to English. Mapping each entry to
// itself asks the same question of the phrase book: does it find the entry?
const identityBook = () => {
  const book = createPhraseBook();
  book.setAll(Object.fromEntries(CATALOG.entries.map((entry) => [entry, entry])));
  return book;
};

const extract = (code, file = "server/characters/probe.js", excluded) => {
  const { taken, skipped } = extractNativeFromSource(code, file, excluded);
  return { texts: [...new Set(taken.map((item) => item.text))].sort(), taken, skipped };
};

test("the committed catalog is what the source gives today", () => {
  const exclusions = readNativeExclusions(ROOT);
  const extraction = extractNativeCatalog(ROOT, exclusions);
  assert.deepEqual(nativeCatalogProblems(extraction, exclusions), []);
  const fresh = new Set(extraction.entries.keys());
  const hint = "run node scripts/i18n/build-native-catalog.mjs and commit the catalog";
  assert.deepEqual(CATALOG.entries.filter((entry) => !fresh.has(entry)), [], `the catalog holds entries the source no longer has; ${hint}`);
  assert.deepEqual([...fresh].filter((entry) => !ENTRIES.has(entry)).sort(), [], `the source has entries the catalog lacks; ${hint}`);
  assert.equal(COMMITTED === renderNativeCatalog(extraction.entries), true, `the catalog file is not as the script writes it; ${hint}`);
});

test("the catalog is sorted, unique Swedish source strings under its schema", () => {
  assert.equal(CATALOG.schema, NATIVE_CATALOG_SCHEMA);
  assert.equal(CATALOG.sourceLocale, "sv");
  assert.deepEqual(CATALOG.entries, [...ENTRIES].sort());
  for (const entry of CATALOG.entries) assert.equal(entry, entry.replace(/\s+/g, " ").trim(), `whitespace in ${JSON.stringify(entry)}`);
});

test("every pattern entry compiles for the phrase book", () => {
  const patterns = CATALOG.entries.filter((entry) => entry.includes("{{"));
  assert.ok(patterns.length > 300, `only ${patterns.length} patterns`);
  for (const entry of patterns) assert.notEqual(compilePattern(entry, entry), null, `does not compile: ${entry}`);
});

test("real text of every kind is in the catalog", () => {
  const pinned = [
    "Riket går i krig vid {{name}}s sida", // server/characters/alliances.js: a genitive around a slot
    "Fältherren", // server/characters/content.js: a label with a marker
    "Girig", // the same table: a label taken for the Swedish beside it
    "Sändebud", // src/Game/Characters/EnvoyView.jsx: JSX text
    "Sändebud till {{name}}", // the same file: a run of JSX text around a value
    "Allianser genom giftermål finns bara i historiska kampanjer.", // a refusal
    "Hovman {{m}} (genererad)", // server/characters/renewal.js: a generated person's name
    "Barn {{id}}",
    "De extra lektionerna har gett {{child}} mer att arbeta med. {{mentor}} ber om tid att följa upp frågorna.", // eventChainContent.js: {roles}
  ];
  for (const entry of pinned) assert.ok(ENTRIES.has(entry), `missing: ${entry}`);
  // server/characters/envoys.js: one template with two choices of words is four sentences.
  for (const about of ["om fred", "om försoning"]) {
    for (const answer of ["och fick ja.", "men fick nej."]) {
      assert.ok(ENTRIES.has(`{{name}} sände bud till {{name2}} ${about} ${answer}`), `missing the variant ${about} ${answer}`);
    }
  }
  assert.equal(ENTRIES.has("om fred"), false, "a word of a choice is part of its sentence, not an entry");
});

test("the patterns match what the engine writes", () => {
  const book = identityBook();
  const start = "-0300-01-01";
  let state = createCharacterSystem({ mode: "family", polityId: "Hadara", date: start, seed: 321 });
  const written = new Set();
  for (let year = 1; year <= 8; year += 1) {
    const result = advanceCharacters(state, addGameMonths(start, 12 * year), { id: `native-catalog-${year}` });
    assert.equal(result.ok, true, result.error);
    state = result.state;
    for (const event of result.events) [event.title, event.description].filter(Boolean).forEach((text) => written.add(text));
  }
  const found = [...written].filter((text) => book.translate(text) != null);
  const byPattern = found.filter((text) => !ENTRIES.has(text));
  assert.ok(byPattern.length >= 6, `only ${byPattern.length} engine sentences matched a pattern`);
  assert.ok(found.length >= written.size * 0.6, `${found.length} of ${written.size} engine sentences were found`);

  // Sentences built here from the engine's own code and templates.
  const sentences = [
    borderLand({ name: "Juda" }),
    advanceCharacters(null, "x").error,
    "Riket går i krig vid Judas sida",
    "Riket sviker Juda",
    "Sera Arel sände bud till Juda om försoning men fick nej.",
    "Hovdam 4 (genererad)",
    "Sändebud till Juda",
  ];
  for (const sentence of sentences) assert.equal(book.translate(sentence), sentence, `no match: ${sentence}`);
  assert.equal(book.translate("Detta står inte i katalogen alls"), null);
});

test("a template is one pattern per choice of words, and its words are not entries", () => {
  const { texts } = extract("export const line = (a, ok) => `${a.name} sände bud ${ok ? 'och fick ja.' : 'men fick nej.'}`;");
  assert.deepEqual(texts, ["{{name}} sände bud men fick nej.", "{{name}} sände bud och fick ja."]);
});

test("a template keeps every variant, past the eight the English catalog stops at", () => {
  const code = "export const caption = (r) => `${r.km} km${r.near ? ' · granne' : ''}${r.ally ? ' · allierad' : ''}${r.war ? ' · i krig' : ''}${r.faith ? ' · annan tro' : ''} · hållning ${r.opinion}`;";
  const { texts } = extract(code);
  assert.equal(texts.length, 16);
  assert.ok(texts.includes("{{km}} km · hållning {{opinion}}"));
  assert.ok(texts.includes("{{km}} km · granne · allierad · i krig · annan tro · hållning {{opinion}}"));
  // src/Game/Characters/CourtSections.jsx: 24 variants of one caption, the usual one among them.
  assert.ok(ENTRIES.has("{{value}} · {{number}} km · granne{{claimText}} · hållning {{number2}}"));
});

test("two slots in a row become one, so the pattern compiles", () => {
  const { texts } = extract("export const title = (first, last) => `${first}${last} går i krig för riket`;");
  assert.deepEqual(texts, ["{{first_last}} går i krig för riket"]);
  assert.equal(compilePattern(texts[0], "x").regex.test("Sera Arel går i krig för riket"), true);
});

test("a role in single braces is a slot: the engine fills it before the player reads the text", () => {
  const { texts } = extract("export const STEP = { text: '{steward} frågar hur {regent}s år ska sammanfattas.' };");
  assert.deepEqual(texts, ["{{steward}} frågar hur {{regent}}s år ska sammanfattas."]);
  assert.equal(compilePattern(texts[0], "x").regex.test("Sera Arel frågar hur Tarek Arels år ska sammanfattas."), true);
});

test("labels beside Swedish text are taken with it", () => {
  const map = extract("export const SKILL_LABELS = { war: 'Krig', food: 'Mat', lore: 'Lärdom' };\nexport const ROWS = [['a', 'Stark'], ['b', 'Svår']];");
  assert.deepEqual(map.texts, ["Krig", "Lärdom", "Mat", "Stark", "Svår"]);
  const table = extract("export const TRAITS = { greedy: { id: 'greedy', name: 'Girig' }, brave: { id: 'brave', name: 'Ståndaktig' } };");
  assert.deepEqual(table.texts, ["Girig", "Ståndaktig"]);
});

test("a Swedish component's text is taken whole, markers or not", () => {
  const code = [
    "export function Card({ name, onSend }) {",
    "  return <section className=\"char-card\" aria-label=\"Bekräfta sändebudet\">",
    "    <li>Till: {name}</li>",
    "    <button type=\"button\" onClick={onSend}>Skicka</button><button type=\"button\">Avbryt</button>",
    "    <p>Riket tar emot nästa sändebud om ett år.</p>",
    "  </section>;",
    "}",
  ].join("\n");
  const { texts, taken } = extract(code, "src/Game/Characters/Card.jsx");
  assert.deepEqual(texts, ["Avbryt", "Bekräfta sändebudet", "Riket tar emot nästa sändebud om ett år.", "Skicka", "Till:", "Till: {{name}}"]);
  assert.ok(taken.every((item) => item.ref.role === "ui"));
});

test("technical positions give no entry and are reported", () => {
  const code = [
    "export const shown = (error) => error.includes('Läs färdigt');",
    "export const warn = (id) => console.warn(`Kampanjen ${id} kunde inte läsas.`);",
    "export const refuse = () => { throw new Error('Riket saknar en härskare.'); };",
  ].join("\n");
  const { texts, taken, skipped } = extract(code);
  assert.deepEqual(texts, ["Riket saknar en härskare."]);
  assert.equal(taken[0].ref.role, "refusal");
  assert.equal(taken[0].ref.enclosingFunction, "refuse");
  assert.deepEqual(skipped.map((item) => [item.text, item.why]), [["Läs färdigt", "technical"], ["Kampanjen ${id} kunde inte läsas.", "developer-only"]]);
});

test("English that a Swedish word also spells is named in the exclusions, and a build fails without them", () => {
  const code = "export const STATUS_LABEL = { planned: 'Planned', building: 'Under construction' };";
  const file = "src/runtime/probe.js";
  assert.deepEqual(extract(code, file).texts, ["Under construction"]);
  const named = extract(code, file, new Set(["Under construction"]));
  assert.deepEqual(named.texts, []);
  assert.deepEqual(named.skipped.map((item) => item.why), ["excluded"]);
  const extraction = { entries: new Map(), skipped: named.skipped };
  assert.equal(nativeCatalogProblems(extraction, []).length, 1);
  assert.deepEqual(nativeCatalogProblems(extraction, [{ file, text: "Under construction", reason: "not-swedish" }]), []);
  assert.equal(nativeCatalogProblems({ entries: new Map(), skipped: [] }, [{ file, text: "Under construction", reason: "not-swedish" }]).length, 1);
});

// A Swedish file takes its unmarked labels with it (rule 3), English ones too: characterWorld.js
// stamps the upstream tag "Politics" on its Swedish event cards.
test("English with no Swedish word in it, taken with its Swedish file, can be named in the exclusions too", () => {
  const code = "export const card = (title) => ({ title: title || 'Familjerna och riket', description: 'Förvaltningen har uppdaterats.', tags: ['Politics', 'Ekonomi'] });";
  const file = "src/runtime/probe.js";
  assert.deepEqual(extract(code, file).texts, ["Ekonomi", "Familjerna och riket", "Förvaltningen har uppdaterats.", "Politics"]);
  const named = extract(code, file, new Set(["Politics"]));
  assert.deepEqual(named.texts, ["Ekonomi", "Familjerna och riket", "Förvaltningen har uppdaterats."]);
  assert.deepEqual(named.skipped.map((item) => [item.text, item.why]), [["Politics", "excluded"]], "reported, so the exclusion is seen to name something");
  const extraction = { entries: new Map(named.texts.map((text) => [text, { kind: "string", refs: [] }])), skipped: named.skipped };
  assert.deepEqual(nativeCatalogProblems(extraction, [{ file, text: "Politics", reason: "not-swedish" }]), []);
});

// The extractor and the translator once kept their own word lists, and each knew words the other
// did not. The extractor now reads the translator's (swedishText.js).
test("the extractor knows Swedish by the translator's words, plus six that English shares", () => {
  for (const word of RUNTIME_WORDS) assert.ok(EXTRACTOR_WORDS.includes(word), `the extractor lacks ${word}`);
  const extra = EXTRACTOR_WORDS.filter((word) => !RUNTIME_WORDS.includes(word)).sort();
  assert.deepEqual(extra, ["den", "en", "finns", "sin", "till", "under"]);
  for (const word of extra) assert.ok(SHARED_WITH_ENGLISH.includes(word), `${word} is a word the translator leaves out as shared with English`);
  assert.equal(new Set(EXTRACTOR_WORDS).size, EXTRACTOR_WORDS.length);
  // Words only the translator had.
  for (const text of ["Arv enligt testamentet", "Kungen abdikerar", "Arvet efter deras far"]) assert.equal(extractorLooksSwedish(text), true, text);
  // The extractor's own rules stay on top: the English veto, and a shared word as a weak marker.
  assert.equal(extractorLooksSwedish("Under the old law"), false);
  assert.equal(extractorLooksSwedish("Till: Karl"), true);
});

test("the upstream tag Politics is not in the catalog, and the Swedish word for a state is", () => {
  assert.equal(ENTRIES.has("Politics"), false);
  assert.ok(readNativeExclusions(ROOT).some((item) => item.file === "src/runtime/characterWorld.js" && item.text === "Politics" && item.reason === "not-swedish"));
  assert.equal(ENTRIES.has("stat"), true, "POLITY_KIND_LABELS_SV.state is player text");
});
