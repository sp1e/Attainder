import { compareGameDates, formatGameDate, parseGameDate } from "./gameDates.js";

export const HISTORICAL_START_RANGE = Object.freeze({ minYear: -3300, maxYear: 1530 });
export const HISTORICAL_START_REFUSAL = "Välj ett giltigt startdatum mellan 3300 f.Kr. och 1530 e.Kr.";

// The shipped starts installed beside the built-in scenario `default`, which holds John.
// Each start has its own marker, so an upgrade adds a new one once and a start the
// player deleted stays deleted. `historical-bookmarks-v1` predates the list.
// `contentVersion` is the built package's `historicalScenario.contentVersion`: an installed
// copy with an older one is replaced in place on the next library read.
export const HISTORICAL_BOOKMARKS = Object.freeze([
  Object.freeze({ id: "egypt-3000bc", marker: "historical-bookmarks-v1", contentVersion: "1.0.0" }),
  Object.freeze({ id: "charlemagne-800", marker: "historical-bookmarks-charlemagne-800", contentVersion: "1.1.0" }),
]);
// Catalog order by scenario id. The first start present is the default.
export const HISTORICAL_START_ORDER = Object.freeze(["charlemagne-800", "default", "egypt-3000bc"]);

const isPlainObject = (value) => value !== null && typeof value === "object"
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

// Dot-separated whole numbers, so 1.10.0 is newer than 1.9.0. Null for anything else.
const versionParts = (value) => typeof value === "string" && /^[0-9]+(\.[0-9]+)*$/.test(value)
  ? value.split(".").map(Number) : null;

const compareVersions = (left, right) => {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
};

// True when a stored scenario ({ meta, data: { world } }) is an older copy of the shipped
// start `entry`. A scenario without historical content, one whose contentId differs (a
// player import that reuses the id), the restore-only copy a restored campaign uses and a
// version that does not read as numbers are the player's own and are never replaced.
export const shippedStartNeedsUpgrade = (storedBundle, entry) => {
  const content = storedBundle?.data?.world?.historicalScenario;
  if (!content || typeof content !== "object" || content.contentId !== entry?.id) return false;
  if (storedBundle.meta?.restoreOnly === true) return false;
  const stored = versionParts(content.contentVersion), shipped = versionParts(entry.contentVersion);
  return Boolean(stored && shipped) && compareVersions(stored, shipped) < 0;
};

const dateRefusal = (code) => ({ ok: false, code, error: HISTORICAL_START_REFUSAL });

export const validateHistoricalStartDate = (value) => {
  if (typeof value !== "string" || !/^-?[0-9]{1,6}-[0-9]{1,2}-[0-9]{1,2}$/.test(value.trim())) {
    return dateRefusal("invalidDate");
  }
  const parts = parseGameDate(value.trim());
  if (!parts) return dateRefusal("invalidDate");
  if (parts.year < HISTORICAL_START_RANGE.minYear || parts.year > HISTORICAL_START_RANGE.maxYear) {
    return dateRefusal("outOfRange");
  }
  return { ok: true, date: formatGameDate(parts), year: parts.year };
};

export const validateHistoricalStartDates = (value) => {
  if (!isPlainObject(value)) return dateRefusal("invalidDate");
  const start = validateHistoricalStartDate(value.startDate);
  if (!start.ok) return start;
  const game = validateHistoricalStartDate(value.gameDate);
  if (!game.ok) return game;
  if (compareGameDates(start.date, game.date) !== 0) {
    return { ok: false, code: "dateMismatch", error: "Startdatum och speldatum måste vara samma dag." };
  }
  return { ok: true, startDate: start.date, gameDate: game.date };
};

// Object key order does not change a JSON value; array order does.
const sameJsonValue = (left, right) => {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length
      && left.every((value, index) => sameJsonValue(value, right[index]));
  }
  if (!isPlainObject(left) || !isPlainObject(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length
    && keys.every((key) => Object.hasOwn(right, key) && sameJsonValue(left[key], right[key]));
};

export const classifyCampaignCreation = (options = {}) => {
  if (!isPlainObject(options)) {
    return { ok: false, code: "invalidOptions", error: "Alternativen för historisk start måste vara ett objekt." };
  }
  const { seedGameId, sourceGame, scenarioId, gamePatch } = options;
  if (seedGameId && (!isPlainObject(sourceGame) || !isPlainObject(sourceGame.game)
    || typeof sourceGame.scenarioId !== "string" || !sourceGame.scenarioId)) {
    return { ok: false, code: "missingCopySource", error: "Det sparade spelet som ska kopieras saknas." };
  }
  if (Object.hasOwn(options, "gamePatch") && !isPlainObject(gamePatch)) {
    return { ok: false, code: "invalidPatch", error: "Speländringarna måste vara ett objekt." };
  }
  const hasHistoricalStart = Object.hasOwn(options, "historicalStart");
  if (hasHistoricalStart && !isPlainObject(options.historicalStart)) {
    return { ok: false, code: "invalidOptions", error: "Alternativen för historisk start måste vara ett objekt." };
  }
  if (!seedGameId || hasHistoricalStart) return { ok: true, kind: "new" };
  if (scenarioId !== undefined && scenarioId !== null && scenarioId !== "" && scenarioId !== sourceGame.scenarioId) {
    return { ok: true, kind: "new" };
  }
  const changed = Object.keys(gamePatch ?? {}).some((key) => !Object.hasOwn(sourceGame.game, key)
    || !sameJsonValue(gamePatch[key], sourceGame.game[key]));
  return { ok: true, kind: changed ? "new" : "copy" };
};
