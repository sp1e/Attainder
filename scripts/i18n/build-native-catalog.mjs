// Writes (or with --check, compares) public/lang/attainder/catalog-sv.json: every Swedish
// source string of the character and dynasty system, read out of the source by
// extractNativeStrings.mjs. The English mode translates these at display time with the
// phrase book (src/runtime/phraseBook.js), keyed by the Swedish string; a string built
// around values is a pattern with {{slots}}.
//
//   node scripts/i18n/build-native-catalog.mjs                      write the catalog
//   node scripts/i18n/build-native-catalog.mjs --check              fail when the committed catalog is stale
//   node scripts/i18n/build-native-catalog.mjs --context <file>     also write where every entry comes from
//
// The run fails when a Swedish-looking literal is outside the catalog and
// native-catalog-exclusions.json does not name it, when an exclusion names nothing, or
// when a pattern would not compile, so new Swedish text cannot silently miss the catalog.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compilePattern } from "../../src/runtime/phraseBook.js";
import { extractNativeCatalog } from "./extractNativeStrings.mjs";

export { extractNativeCatalog, extractNativeFromSource, looksSwedish, nativeSourceFiles } from "./extractNativeStrings.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const NATIVE_CATALOG_PATH = "public/lang/attainder/catalog-sv.json";
export const NATIVE_EXCLUSIONS_PATH = "scripts/i18n/native-catalog-exclusions.json";
export const NATIVE_CATALOG_SCHEMA = "attainder-native-catalog-v1";
// Why a Swedish-looking literal is not an entry. `not-swedish` is English text or a code
// that a Swedish function word also spells ("Under construction", the locale "en").
export const EXCLUSION_REASONS = ["developer-only", "technical", "non-display", "uncompilable-template", "not-swedish"];

const lf = (text) => text.replace(/\r\n/g, "\n");
const exclusionKey = (item) => `${item.file}\u0000${item.text}`;
// The file's text, or null when it does not exist; any other read error is real and propagates.
const readIfPresent = (file) => {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
};

// The catalog file's text: the entries sorted by code unit, so the order is the same on
// every machine.
export const renderNativeCatalog = (entries) =>
  `${JSON.stringify({ schema: NATIVE_CATALOG_SCHEMA, sourceLocale: "sv", entries: [...entries.keys()].sort() }, null, 2)}\n`;

// For translators: each entry with the places it comes from.
export const renderNativeContext = (entries) =>
  `${JSON.stringify([...entries.keys()].sort().map((entry) => ({ entry, ...entries.get(entry) })), null, 2)}\n`;

// What stops a build, as lines of text. A skipped literal whose text is an entry anyway
// (the count word 'en' against the locale 'en') is covered and needs no exclusion.
export const nativeCatalogProblems = ({ entries, skipped }, exclusions) => {
  const problems = [];
  for (const item of exclusions) {
    if (typeof item?.file !== "string" || typeof item?.text !== "string" || !EXCLUSION_REASONS.includes(item?.reason)) {
      problems.push(`Invalid exclusion (file, text and a known reason are required): ${JSON.stringify(item)}`);
    }
  }
  const outside = skipped.filter((item) => !entries.has(item.text));
  const named = new Set(exclusions.map(exclusionKey));
  for (const item of outside) {
    if (!named.has(exclusionKey(item))) problems.push(`Swedish-looking text outside the catalog (${item.why}): ${item.file}:${item.line} ${JSON.stringify(item.text)}`);
  }
  const seen = new Set(outside.map(exclusionKey));
  for (const item of exclusions) {
    if (!seen.has(exclusionKey(item))) problems.push(`Exclusion names no literal outside the catalog: ${item.file} ${JSON.stringify(item.text)}`);
  }
  for (const text of entries.keys()) {
    if (text.includes("{{") && !compilePattern(text, text)) problems.push(`Pattern does not compile: ${JSON.stringify(text)} (${entries.get(text).refs[0].file})`);
  }
  return problems;
};

export const readNativeExclusions = (root = ROOT) => JSON.parse(readIfPresent(path.join(root, NATIVE_EXCLUSIONS_PATH)) ?? "[]");

// `root` defaults to this repo. Returns the counts it prints.
export function buildNativeCatalog({ root = ROOT, check = false, contextPath = null } = {}) {
  const exclusions = readNativeExclusions(root);
  const extraction = extractNativeCatalog(root, exclusions);
  const problems = nativeCatalogProblems(extraction, exclusions);
  if (problems.length) {
    throw new Error(`${problems.join("\n")}\n${problems.length} problem(s). Fix the source or the extractor, or name the literal in ${NATIVE_EXCLUSIONS_PATH}.`);
  }
  const rendered = renderNativeCatalog(extraction.entries);
  const catalogFile = path.join(root, NATIVE_CATALOG_PATH);
  if (check) {
    const committed = readIfPresent(catalogFile);
    if (committed === null || lf(committed) !== rendered) {
      throw new Error(`The native catalog differs from the committed file. Run node scripts/i18n/build-native-catalog.mjs and commit ${NATIVE_CATALOG_PATH}.`);
    }
  } else {
    fs.mkdirSync(path.dirname(catalogFile), { recursive: true });
    fs.writeFileSync(catalogFile, rendered, "utf8");
  }
  if (contextPath) fs.writeFileSync(contextPath, renderNativeContext(extraction.entries), "utf8");
  const patterns = [...extraction.entries.keys()].filter((text) => text.includes("{{")).length;
  return { entries: extraction.entries.size, strings: extraction.entries.size - patterns, patterns, excluded: exclusions.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const contextAt = args.indexOf("--context");
  try {
    if (contextAt >= 0 && !args[contextAt + 1]) throw new Error("--context needs a file path.");
    console.log(JSON.stringify(buildNativeCatalog({ check: args.includes("--check"), contextPath: contextAt >= 0 ? path.resolve(args[contextAt + 1]) : null })));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
