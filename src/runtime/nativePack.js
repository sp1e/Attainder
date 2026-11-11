// The native pack: Swedish source text → English, for the book the translator
// holds in English mode (createPhraseBook({ native: true }), phraseBook.js).
// It is three static files under public/lang/attainder/:
//
//   en.json             the Swedish text in code (catalog-sv.json), by hand;
//   packages-en.json    the built package text the other two do not reach
//                       (catalog-packages-sv.json);
//   historical-en.json  the research sidecar's pairs
//                       (scripts/i18n/build-historical-pairs.mjs).
//
// Pure apart from the fetch the caller passes in, so the tests load it as it is.

// Only a Vite build defines import.meta.env. The website is served under
// /play/, so the files sit under the build's base, as the prompt packs do
// (promptTranslations.js).
const BASE = String(import.meta.env?.BASE_URL || "/").replace(/\/?$/, "/");

export const NATIVE_PACK_PATHS = {
  code: `${BASE}lang/attainder/en.json`,
  packages: `${BASE}lang/attainder/packages-en.json`,
  historical: `${BASE}lang/attainder/historical-en.json`,
};

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

// One flat object. The same Swedish text can sit in more than one file: the
// translation written for the code wins over the one written for a package,
// which wins over the research pair, the most general of the three. A value
// that is not text, or is empty, is no translation and hides nothing.
export const mergeNativePack = ({ code = {}, packages = {}, historical = {} } = {}) => {
  const merged = {};
  for (const layer of [historical, packages, code]) {
    if (!isPlainObject(layer)) continue;
    for (const [source, translated] of Object.entries(layer)) {
      if (typeof translated === "string" && translated.trim()) merged[source] = translated;
    }
  }
  return merged;
};

// The other direction, for Swedish mode: the research's English source
// locators and institutions → Swedish (scripts/i18n/build-historical-pairs.mjs).
// The Swedish book takes it beside public/lang/sv.json.
export const SWEDISH_HISTORICAL_PATH = `${BASE}lang/attainder/historical-sv.json`;

// One file as an object. `fetchJson(path)` resolves to the parsed file or
// rejects. A file that is missing or is not an object costs its own
// translations only: the game still starts, and the warning names the file.
const readLayer = async (fetchJson, path, book) => {
  try {
    const value = await fetchJson(path);
    if (isPlainObject(value)) return value;
    console.warn(`[i18n] ${path} is not a JSON object; the ${book} goes without it.`);
  } catch (error) {
    console.warn(`[i18n] ${path} could not be loaded (${error?.message ?? error}); the ${book} goes without it.`);
  }
  return {};
};

export const loadNativePack = async (fetchJson) => {
  const [code, packages, historical] = await Promise.all([
    readLayer(fetchJson, NATIVE_PACK_PATHS.code, "native pack"),
    readLayer(fetchJson, NATIVE_PACK_PATHS.packages, "native pack"),
    readLayer(fetchJson, NATIVE_PACK_PATHS.historical, "native pack"),
  ]);
  return mergeNativePack({ code, packages, historical });
};

// The pairs of historical-sv.json that are text, as one flat object; empty
// when the file cannot be read.
export const loadSwedishHistoricalPack = async (fetchJson) =>
  mergeNativePack({ historical: await readLayer(fetchJson, SWEDISH_HISTORICAL_PATH, "Swedish book") });
