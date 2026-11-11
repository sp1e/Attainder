// Writes (or with --check, compares) the pair files the running game reads:
//
//   public/lang/attainder/historical-en.json  { "<Swedish>": "<English>" } from
//                                             server/seed/historical/locales/en.json
//   public/lang/attainder/historical-sv.json  { "<English>": "<Swedish>" } from
//                                             server/seed/historical/locales/sv.json
//
// Only entries whose two sides differ are kept, without the sidecar's metadata,
// with the keys sorted. The game looks a text up by itself, with no knowledge of
// the record it came from, so one source text can have one translation only.
// Where the sidecar gives a text two (one of them may be "leave it as it is"),
// the build stops and lists each conflict until
// scripts/i18n/historical-pair-rulings.json names the translation to keep:
//
//   { "en": { "<Swedish>": "<chosen English>" }, "sv": { "<English>": "<chosen Swedish>" },
//     "reasons": { "en": { "<Swedish>": "<why>" }, "sv": { … } } }
//
//   node scripts/i18n/build-historical-pairs.mjs
//   node scripts/i18n/build-historical-pairs.mjs --check
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, serializeJson, writeOrCheck } from "./jsonOutput.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const LOCALES = path.join(ROOT, "server/seed/historical/locales");
const OUTPUT = path.join(ROOT, "public/lang/attainder");
const RULINGS = path.join(ROOT, "scripts/i18n/historical-pair-rulings.json");

// `locale` is the sidecar's own: en.json translates Swedish into English.
export const PAIR_FILES = [
  { locale: "en", from: "sv", to: "en", sidecar: "en.json", output: "historical-en.json" },
  { locale: "sv", from: "en", to: "sv", sidecar: "sv.json", output: "historical-sv.json" },
];

// Every translation each source text has in the sidecar, in sidecar order.
const translationsBySource = (entries, from, to) => {
  const bySource = new Map();
  for (const entry of entries) {
    const source = entry?.[from];
    const target = entry?.[to];
    if (typeof source !== "string" || !source || typeof target !== "string" || !target) {
      throw new Error(`Sidecar entry ${entry?.id ?? "(no id)"} lacks its ${from} or ${to} text.`);
    }
    if (!bySource.has(source)) bySource.set(source, new Set());
    bySource.get(source).add(target);
  }
  return bySource;
};

// Pure: the pairs of one sidecar. `conflicts` lists each source text with more
// than one translation and no ruling that names one of them; `usedRulings` and
// `unusedRulings` say which rulings the sidecar still needs.
export function buildHistoricalPairs({ entries, from, to, rulings = {} }) {
  const kept = [];
  const conflicts = [];
  const usedRulings = [];
  for (const [source, translations] of translationsBySource(entries, from, to)) {
    let chosen = [...translations][0];
    if (translations.size > 1) {
      const ruling = rulings[source];
      if (typeof ruling !== "string" || !translations.has(ruling)) {
        conflicts.push({ source, translations: [...translations], ruling: ruling ?? null });
        continue;
      }
      usedRulings.push(source);
      chosen = ruling;
    }
    if (chosen !== source) kept.push([source, chosen]);
  }
  kept.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const unusedRulings = Object.keys(rulings).filter((source) => !usedRulings.includes(source)).sort();
  return { pairs: Object.fromEntries(kept), conflicts, usedRulings: usedRulings.sort(), unusedRulings };
}

// Both pair files from the repository's sidecars and rulings, not yet written.
export function buildHistoricalPairFiles({ localesDir = LOCALES, rulingsPath = RULINGS } = {}) {
  const rulings = readJson(rulingsPath, {});
  return PAIR_FILES.map((spec) => {
    const sidecar = readJson(path.join(localesDir, spec.sidecar));
    const built = buildHistoricalPairs({ entries: sidecar.entries, from: spec.from, to: spec.to, rulings: rulings[spec.locale] ?? {} });
    return { ...spec, ...built, text: serializeJson(built.pairs) };
  });
}

const describeConflict = (locale, { source, translations, ruling }) => {
  const options = translations.map((text) => JSON.stringify(text)).join(" | ");
  const note = ruling === null ? "" : ` (the ruling ${JSON.stringify(ruling)} is not one of them)`;
  return `  ${locale}: ${JSON.stringify(source)} → ${options}${note}`;
};

export function runHistoricalPairs({ check = false, outputDir = OUTPUT } = {}) {
  const files = buildHistoricalPairFiles();
  const conflicts = files.flatMap((file) => file.conflicts.map((conflict) => describeConflict(file.locale, conflict)));
  if (conflicts.length) {
    throw new Error(`A source text has two translations. Name the one to keep in scripts/i18n/historical-pair-rulings.json:\n${conflicts.join("\n")}`);
  }
  const stale = files.filter((file) => !writeOrCheck({ file: path.join(outputDir, file.output), text: file.text, check }));
  if (stale.length) {
    throw new Error(`${stale.map((file) => file.output).join(", ")} differs from a fresh build. Run node scripts/i18n/build-historical-pairs.mjs and commit the result.`);
  }
  return Object.fromEntries(files.map((file) => [file.output, Object.keys(file.pairs).length]));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(runHistoricalPairs({ check: process.argv.includes("--check") })));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
