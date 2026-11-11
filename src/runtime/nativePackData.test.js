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
import { mergeNativePack } from "./nativePack.js";
import { createPhraseBook } from "./phraseBook.js";

// Sidecar entries whose source text changed after they were translated. The
// research session owns the sidecars (PR #201 corrects this one); empty the
// list when the branch has that correction.
const KNOWN_STALE = [
  "record/server/seed/historical/ad800-review.json/settlements/@settlementId=rome/noteSv",
];

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
  const catalogSize = readLang("catalog-packages-sv.json").entries.length;
  // The catalog is what the research pairs leave. Until the translations
  // arrive, that is what is missing. When packages-en.json is complete this
  // becomes: assert.equal(coverage.missing, 0).
  if (!Object.keys(packages).length && !Object.keys(code).length) assert.equal(coverage.missing, catalogSize);
  else assert.ok(coverage.missing <= catalogSize, `${coverage.missing} missing of ${catalogSize} catalog entries`);
});

test("outside the Swedish views, no English interface string is rewritten", () => {
  const book = createPhraseBook({ native: true });
  book.setAll(readLang("historical-en.json"));
  book.setAll({
    "{{name}} dog {{date}}": "{{name}} died {{date}}",
    "{{a}} i {{b}}": "{{a}} in {{b}}",
    "{{name}} föds": "{{name}} is born",
    "Riket går i krig vid {{name}}s sida": "The realm goes to war at {{name}}'s side",
  });
  assert.equal(book.translate("Karl dog 814"), "Charles died 814", "the book works in the full tier");
  assert.equal(book.translate("Karl dog 814", { strongOnly: true }), null);
  assert.equal(book.translate("Riket går i krig vid Romarrikets sida", { strongOnly: true }), "The realm goes to war at Roman Empire's side");
  const catalog = readJson("public/lang/catalog-en.json");
  assert.ok(catalog.length > 5000, "the interface catalog is there");
  const rewritten = catalog.filter((english) => book.translate(english, { strongOnly: true }) != null);
  assert.deepEqual(rewritten, []);
});
