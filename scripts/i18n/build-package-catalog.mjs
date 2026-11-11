// Writes (or with --check, compares) public/lang/attainder/catalog-packages-sv.json: every
// unique Swedish display string of the four built historical packages that the research
// pairs do not translate. A display string is a text value under a key ending in `Sv`, at
// any depth of server/seed/historical/<package>/scenario.json. A string is translated when
// a native phrase book (src/runtime/phraseBook.js, `native: true`) loaded with
// public/lang/attainder/historical-en.json answers it; run build-historical-pairs.mjs first.
// What is left is what public/lang/attainder/packages-en.json has to translate.
//
//   node scripts/i18n/build-package-catalog.mjs
//   node scripts/i18n/build-package-catalog.mjs --check
//   node scripts/i18n/build-package-catalog.mjs --context <file>
//
// --context writes, for each catalog entry, the packages and the first JSON paths where the
// string occurs, for the translator. The file is a working aid and is not checked.
//
// The first run also creates packages-en.json and en.json as empty objects, so the game
// has all three files of the native pack (src/runtime/nativePack.js) to fetch.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPhraseBook } from "../../src/runtime/phraseBook.js";
import { readJson, serializeJson, writeOrCheck } from "./jsonOutput.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const HISTORICAL = path.join(ROOT, "server/seed/historical");
const LANG = path.join(ROOT, "public/lang/attainder");
const CATALOG = path.join(LANG, "catalog-packages-sv.json");

export const PACKAGE_IDS = ["egypt-3000bc", "charlemagne-800", "john-1200", "world-1500"];
export const PACKAGE_CATALOG_SCHEMA = "attainder-package-catalog-v1";
const CONTEXT_SCHEMA = "attainder-package-catalog-context-v1";
const CONTEXT_PATHS = 3;
// A map feature's geometry is most of a package's bytes and holds no text.
const GEOMETRY_KEYS = new Set(["geometry", "coordinates"]);

const pointerName = (name) => String(name).replace(/~/g, "~0").replace(/\//g, "~1");

// Calls visit(text, jsonPointer) for every text under a key ending in `Sv`. An array under
// such a key is a list of display strings; an object under it starts over with its own keys.
const walkDisplayStrings = (value, pointer, displayKey, visit) => {
  if (typeof value === "string") {
    if (displayKey && value.trim()) visit(value, pointer);
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => walkDisplayStrings(item, `${pointer}/${index}`, displayKey, visit));
  } else if (value && typeof value === "object") {
    for (const [name, child] of Object.entries(value)) {
      if (!GEOMETRY_KEYS.has(name)) walkDisplayStrings(child, `${pointer}/${pointerName(name)}`, name.endsWith("Sv"), visit);
    }
  }
};

// Pure: each unique display string of `packages` ([{ id, scenario }]) with where it occurs:
// Map text → { count, packages: [id…], paths: [{ package, path }…] } (the first paths only).
export function collectPackageStrings(packages) {
  const strings = new Map();
  for (const { id, scenario } of packages) {
    walkDisplayStrings(scenario, "", false, (text, pointer) => {
      if (!strings.has(text)) strings.set(text, { count: 0, packages: [], paths: [] });
      const record = strings.get(text);
      record.count += 1;
      if (!record.packages.includes(id)) record.packages.push(id);
      if (record.paths.length < CONTEXT_PATHS) record.paths.push({ package: id, path: pointer });
    });
  }
  return strings;
}

const nativeBook = (pack) => {
  const book = createPhraseBook({ native: true });
  book.setAll(pack);
  return book;
};

// Pure: the strings a native book of `pack` has no translation for, sorted.
export function untranslatedPackageStrings(strings, pack) {
  const book = nativeBook(pack);
  return [...strings].filter((text) => book.translate(text) == null).sort();
}

// Pure: how much of the built package text a pack translates. `strings` is any iterable of
// unique display strings (the keys of collectPackageStrings); the counts are of strings.
export function packageCoverage(strings, pack) {
  const all = [...strings];
  const missing = untranslatedPackageStrings(all, pack).length;
  return { total: all.length, translated: all.length - missing, missing };
}

export const readPackages = (historicalDir = HISTORICAL) =>
  PACKAGE_IDS.map((id) => ({ id, scenario: readJson(path.join(historicalDir, id, "scenario.json")) }));

// The catalog of the repository's packages and pairs, with the occurrences behind it.
export function buildPackageCatalog({ historicalDir = HISTORICAL, langDir = LANG } = {}) {
  const strings = collectPackageStrings(readPackages(historicalDir));
  const entries = untranslatedPackageStrings(strings.keys(), readJson(path.join(langDir, "historical-en.json")));
  return { strings, catalog: { schema: PACKAGE_CATALOG_SCHEMA, sourceLocale: "sv", entries } };
}

const contextFile = ({ strings, catalog }) => ({
  schema: CONTEXT_SCHEMA,
  entries: catalog.entries.map((text) => ({ text, ...strings.get(text) })),
});

const ensureEmptyPack = (file) => {
  if (!fs.existsSync(file)) fs.writeFileSync(file, serializeJson({}), "utf8");
};

export function runPackageCatalog({ check = false, contextPath = null, catalogPath = CATALOG, langDir = LANG } = {}) {
  const built = buildPackageCatalog({ langDir });
  if (!writeOrCheck({ file: catalogPath, text: serializeJson(built.catalog), check })) {
    throw new Error("catalog-packages-sv.json differs from a fresh build. Run node scripts/i18n/build-package-catalog.mjs and commit the result.");
  }
  if (!check) {
    ensureEmptyPack(path.join(langDir, "packages-en.json"));
    ensureEmptyPack(path.join(langDir, "en.json"));
  }
  if (contextPath) writeOrCheck({ file: contextPath, text: serializeJson(contextFile(built)), check: false });
  return { strings: built.strings.size, entries: built.catalog.entries.length };
}

const contextArgument = (args) => {
  const index = args.indexOf("--context");
  if (index < 0) return null;
  if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error("--context needs a file path.");
  return path.resolve(args[index + 1]);
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    console.log(JSON.stringify(runPackageCatalog({ check: args.includes("--check"), contextPath: contextArgument(args) })));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
