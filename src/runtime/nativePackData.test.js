// Run: node --test src/runtime/nativePackData.test.js
//
// The native pack's data is generated: the research pairs from the translation
// sidecars, the package catalog from the built packages. These pin that the
// committed files are what the scripts give today, that the sidecars still
// match the text they translate, and how much of the package text the pack
// covers.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { checkLocaleSidecars } from "../../scripts/check-locale-sidecars.mjs";
import { buildHistoricalPairFiles } from "../../scripts/i18n/build-historical-pairs.mjs";
import { PACKAGE_CATALOG_SCHEMA, buildPackageCatalog, packageCoverage } from "../../scripts/i18n/build-package-catalog.mjs";
import { nativePackReport } from "../../scripts/i18n/check-native-pack.mjs";
import { mergeNativePack } from "./nativePack.js";
import { createPhraseBook } from "./phraseBook.js";
import { SHARED_WITH_INTERFACE, translateInTier } from "./translatorMode.js";

// Sidecar entries whose source text changed after they were translated. The
// research session owns the sidecars and corrects them (PR #201 did for the
// Rome settlement note).
const KNOWN_STALE = [];

// Catalog entries (catalog-sv.json) that en.json does not translate. Every
// entry is translated, so new Swedish text in code needs its English in
// en.json before this passes.
const EXPECTED_MISSING = 0;

const REPO = new URL("../../", import.meta.url);
const readText = (relative) => fs.readFileSync(new URL(relative, REPO), "utf8").replace(/\r\n/g, "\n");
const readJson = (relative) => JSON.parse(readText(relative));
const readLang = (file) => readJson(`public/lang/attainder/${file}`);

const PAIR_FILES = buildHistoricalPairFiles();
const PACKAGES = buildPackageCatalog();

test("the committed pair files are what a fresh build gives", () => {
  for (const file of PAIR_FILES) {
    assert.deepEqual(file.conflicts, [], `${file.output}: every conflict has a ruling`);
    assert.equal(readText(`public/lang/attainder/${file.output}`), file.text, `${file.output}: run node scripts/i18n/build-historical-pairs.mjs`);
    const keys = Object.keys(file.pairs);
    assert.deepEqual(keys, [...keys].sort(), `${file.output}: sorted`);
    assert.ok(Object.entries(file.pairs).every(([source, translated]) => source !== translated), `${file.output}: only pairs whose sides differ`);
  }
});

test("every key of historical-en.json is a Swedish text of the sidecar, with one of its translations", () => {
  const sidecar = readJson("server/seed/historical/locales/en.json");
  const english = new Map();
  for (const entry of sidecar.entries) english.set(entry.sv, [...(english.get(entry.sv) ?? []), entry.en]);
  const pairs = readLang("historical-en.json");
  const strays = Object.entries(pairs).filter(([swedish, translated]) => !english.get(swedish)?.includes(translated));
  assert.deepEqual(strays, []);
  assert.ok(Object.keys(pairs).length > 4000, "the sidecar's differing pairs are there");
});

test("every ruling settles a conflict the sidecars still have, and says why", () => {
  const rulings = readJson("scripts/i18n/historical-pair-rulings.json");
  for (const file of PAIR_FILES) {
    assert.deepEqual(file.unusedRulings, [], `${file.locale}: a ruling for a text that has one translation now`);
    assert.deepEqual(file.usedRulings, Object.keys(rulings[file.locale]).sort());
    for (const source of file.usedRulings) {
      assert.ok(String(rulings.reasons?.[file.locale]?.[source] ?? "").trim(), `${file.locale}: ${source} has no reason`);
    }
  }
});

test("the sidecars match their source text, but for the known stale entries", () => {
  const { checked, mismatches } = checkLocaleSidecars();
  assert.ok(checked > 7000, `${checked} entries checked`);
  assert.deepEqual(mismatches.map((mismatch) => mismatch.id).sort(), [...KNOWN_STALE].sort());
});

test("the committed package catalog is what a fresh build gives", () => {
  assert.equal(readText("public/lang/attainder/catalog-packages-sv.json"), `${JSON.stringify(PACKAGES.catalog, null, 2)}\n`, "run node scripts/i18n/build-package-catalog.mjs");
  assert.equal(PACKAGES.catalog.schema, PACKAGE_CATALOG_SCHEMA);
  assert.equal(PACKAGES.catalog.sourceLocale, "sv");
  assert.deepEqual(PACKAGES.catalog.entries, [...new Set(PACKAGES.catalog.entries)].sort());
});

test("the package text is counted against the merged pack", (t) => {
  const code = readLang("en.json");
  const packages = readLang("packages-en.json");
  const pack = mergeNativePack({ code, packages, historical: readLang("historical-en.json") });
  const coverage = packageCoverage(PACKAGES.strings.keys(), pack);
  t.diagnostic(`package text: ${coverage.translated} of ${coverage.total} strings translated, ${coverage.missing} missing`);
  // The four packages hold 315 unique display strings today (6,638 occurrences).
  assert.ok(coverage.total > 300, `${coverage.total} display strings`);
  assert.equal(coverage.translated + coverage.missing, coverage.total);
  // packages-en.json is complete: every built display string has a translation.
  assert.equal(coverage.missing, 0);
});

test("the pack report counts what a pack lacks and what it gets wrong", () => {
  const catalog = { entries: ["Sändebud", "{{name}} föds", "{{a}} gifter sig med {{b}}", "{{a}} och {{a}}", "Krig", "Mat", "Hov"] };
  const pack = {
    "Sändebud": "Envoy",
    "{{name}} föds": "A child is born",
    "{{a}} gifter sig med {{b}}": "{{b}} is married to {{a}}",
    "{{a}} och {{a}}": "{{a}} and {{b}}",
    "Krig": "  ",
    "Mat": "Food for {{name}}",
    "Gammal nyckel": "Old key",
  };
  const report = nativePackReport({ catalog, pack });
  assert.equal(report.total, 7);
  assert.deepEqual(report.missing, ["Hov"]);
  assert.deepEqual(report.empty, ["Krig"]);
  assert.deepEqual(report.unknownKeys, ["Gammal nyckel"]);
  assert.deepEqual(report.slotErrors, [
    { entry: "{{name}} föds", expected: ["name"], actual: [] },
    { entry: "{{a}} och {{a}}", expected: ["a", "a"], actual: ["a", "b"] },
    { entry: "Mat", expected: [], actual: ["name"] },
  ], "a dropped slot, a slot named once too few, an invented slot; slots in another order are fine");
  assert.equal(report.translated, 5, "every entry with a text, right or wrong");
  assert.equal(report.translated + report.missing.length + report.empty.length, report.total);

  const none = nativePackReport({ catalog: ["Sändebud"], pack: {} });
  assert.deepEqual([none.total, none.translated, none.missing], [1, 0, ["Sändebud"]], "a bare list of entries is a catalog too");
  assert.deepEqual(nativePackReport({ catalog: ["Sändebud"], pack: { "Sändebud": null } }).empty, ["Sändebud"], "a value that is no text counts as empty");
});

test("en.json has no wrong slot, no empty text and no key outside the catalog, and the gap is the known one", (t) => {
  const report = nativePackReport({ catalog: readLang("catalog-sv.json"), pack: readLang("en.json") });
  t.diagnostic(`code text: ${report.translated} of ${report.total} catalog entries translated, ${report.missing.length} missing`);
  assert.deepEqual(report.slotErrors, []);
  assert.deepEqual(report.empty, []);
  assert.deepEqual(report.unknownKeys, []);
  assert.equal(report.missing.length, EXPECTED_MISSING);
  assert.equal(report.translated + report.missing.length, report.total);
});

// The code layer of the native pack by its keys alone. "Which Swedish keys
// answer for this text?" should not depend on the English wording: every entry
// of catalog-sv.json is a key here, mapped to itself behind a marker
// ("EN:{{name}} föds"). A pattern keeps its slots, so it compiles and matches
// as the real translation does. The marker wins over en.json.
const MARKER = "EN:";
const markerCodePack = () => ({
  ...readLang("en.json"),
  ...Object.fromEntries(readLang("catalog-sv.json").entries.map((entry) => [entry, `${MARKER}${entry}`])),
});

// The whole native book: the research pairs, the package text and every key of
// the code catalog.
const wholeNativeBook = () => {
  const book = createPhraseBook({ native: true });
  book.setAll(mergeNativePack({ code: markerCodePack(), packages: readLang("packages-en.json"), historical: readLang("historical-en.json") }));
  return book;
};

test("outside the Swedish views, no English interface string is rewritten by any key of the real catalogs", () => {
  const book = wholeNativeBook();
  assert.ok(book.patternCount() > 600, `${book.patternCount()} patterns: the code catalog's are loaded`);
  // Real keys of catalog-sv.json: a weak pattern, a strong one, an entry.
  assert.equal(book.translate("Karl föds"), `${MARKER}Charles föds`, "the book works in the full tier");
  assert.equal(translateInTier(book, "Karl föds", "strong"), null, "a weak pattern stays inside the Swedish views");
  assert.equal(translateInTier(book, "Riket går i krig vid Romarrikets sida", "strong"), `${MARKER}Riket går i krig vid Roman Empires sida`);
  assert.equal(translateInTier(book, "Sändebud", "strong"), `${MARKER}Sändebud`);
  const catalog = readJson("public/lang/catalog-en.json");
  assert.ok(catalog.length > 5000, "the interface catalog is there");
  const rewritten = catalog.filter((english) => translateInTier(book, english, "strong") != null);
  assert.deepEqual(rewritten, []);
});

test("the Swedish keys the English interface also writes are exactly the ones the strong tier is told to skip", () => {
  const swedish = new Set([...readLang("catalog-sv.json").entries, ...Object.keys(readLang("packages-en.json")), ...Object.keys(readLang("historical-en.json"))]);
  const shared = readJson("public/lang/catalog-en.json").filter((english) => swedish.has(english)).sort();
  assert.deepEqual([...SHARED_WITH_INTERFACE].sort(), shared, "list a new shared string in translatorMode.js, or keep it out of the Swedish catalog");
  // The Swedish reading still applies where the text is Swedish.
  const book = wholeNativeBook();
  for (const word of shared) {
    assert.notEqual(translateInTier(book, word, "full"), null, word);
    assert.equal(translateInTier(book, word, "strong"), null, word);
  }
});
