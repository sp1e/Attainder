// Counts public/lang/attainder/en.json against public/lang/attainder/catalog-sv.json: is
// every Swedish source string of the code translated, and is each translation usable?
// en.json is written by hand (by translation sessions), so nothing else in the build
// notices an entry that is missing, empty, carries the wrong slots or has outlived its
// catalog entry.
//
//   node scripts/i18n/check-native-pack.mjs           print the counts
//   node scripts/i18n/check-native-pack.mjs --check   also fail when anything is wrong
//
// With --check the run exits non-zero when an entry is missing or empty, when a
// translation does not carry exactly its pattern's slots, or when en.json holds a key
// that is no catalog entry, and prints the first of each.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { slotNames } from "../../src/runtime/phraseBook.js";
import { readJson } from "./jsonOutput.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const LANG = path.join(ROOT, "public/lang/attainder");
// How many of each kind of problem --check prints.
const SHOWN = 20;

const sameList = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);

// Pure. `catalog` is catalog-sv.json ({ entries }) or its list of entries; `pack` is
// en.json ({ "<Swedish>": "<English>" }). Returns:
//   total        the number of catalog entries;
//   translated   the entries the pack has a text for, right or wrong;
//   missing      the entries the pack has no key for;
//   empty        the entries whose value is blank or is not a string;
//   slotErrors   { entry, expected, actual } for each translation that does not carry
//                exactly its entry's {{slot}} names, each as often as the entry writes
//                it (both lists sorted). The phrase book fills a translation's slots
//                from the Swedish match, so a dropped slot loses a value and an
//                invented one renders as nothing. The order is free: English grammar
//                may move a slot;
//   unknownKeys  the keys of the pack that are no catalog entry: the Swedish text was
//                changed or removed, and the translation no longer applies to anything.
export function nativePackReport({ catalog, pack }) {
  const entries = Array.isArray(catalog) ? catalog : catalog?.entries ?? [];
  const translations = pack && typeof pack === "object" ? pack : {};
  const report = { total: entries.length, translated: 0, missing: [], slotErrors: [], empty: [], unknownKeys: [] };
  for (const entry of entries) {
    if (!Object.hasOwn(translations, entry)) {
      report.missing.push(entry);
      continue;
    }
    const english = translations[entry];
    if (typeof english !== "string" || !english.trim()) {
      report.empty.push(entry);
      continue;
    }
    report.translated += 1;
    const expected = slotNames(entry).sort();
    const actual = slotNames(english).sort();
    if (!sameList(expected, actual)) report.slotErrors.push({ entry, expected, actual });
  }
  const known = new Set(entries);
  report.unknownKeys = Object.keys(translations).filter((key) => !known.has(key));
  return report;
}

// The report for the repository's files.
export const checkNativePack = ({ langDir = LANG } = {}) =>
  nativePackReport({ catalog: readJson(path.join(langDir, "catalog-sv.json")), pack: readJson(path.join(langDir, "en.json"), {}) });

export const nativePackCounts = (report) => ({
  total: report.total,
  translated: report.translated,
  missing: report.missing.length,
  slotErrors: report.slotErrors.length,
  empty: report.empty.length,
  unknownKeys: report.unknownKeys.length,
});

// What --check prints for a report with problems: a heading and the first of each kind.
export const nativePackProblems = (report) => {
  const lines = [];
  const list = (title, items, show = JSON.stringify) => {
    if (!items.length) return;
    lines.push(`${title} (${items.length}):`);
    for (const item of items.slice(0, SHOWN)) lines.push(`  ${show(item)}`);
    if (items.length > SHOWN) lines.push(`  … and ${items.length - SHOWN} more`);
  };
  list("Catalog entries without a translation", report.missing);
  list("Empty translations", report.empty);
  list("Translations whose slots differ from the entry's", report.slotErrors,
    ({ entry, expected, actual }) => `${JSON.stringify(entry)}: expected {${expected.join(", ")}}, found {${actual.join(", ")}}`);
  list("Keys of en.json that are no catalog entry", report.unknownKeys);
  return lines;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = checkNativePack();
    console.log(JSON.stringify(nativePackCounts(report)));
    const problems = process.argv.includes("--check") ? nativePackProblems(report) : [];
    if (problems.length) {
      console.error(problems.join("\n"));
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
