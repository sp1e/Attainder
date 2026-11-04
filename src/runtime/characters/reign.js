import { addGameMonths, astronomicalYear, compareGameDates, normalizeGameDate, parseGameDate } from '../gameDates.js';

// The reign record: who rules, since when and what the reign has added up to. It lives in state.reign as { rulerId, startedAt, lawful, deeds, goals, sources, lostOrders } and starts over at each accession (beginReign).
// realm.legitimacy stays one number with all its writers. `sources` counts what accession, goals and prestige added; legitimacySources shows the rest as `Styre och händelser`, so the rows always add up.
// This module imports only gameDates.js, so extensions.js can fill the record without joining the cycle of actionResolution.js, npcPlots.js and schemes.js. Nothing here draws randomness.

export const DEED_KEYS = Object.freeze(['cruel', 'betrayal', 'generous', 'risky', 'surrender', 'executions', 'breakdowns', 'goalsMet']);
const GRANT_SOURCES = Object.freeze(['goals', 'prestige']);
const SOURCE_KEYS = Object.freeze(['accession', ...GRANT_SOURCES]);
const SOURCE_LABELS = Object.freeze({ accession: 'Tronföljd', goals: 'Uppnådda mål', prestige: 'Ryktbarhet' });
const OTHER_SOURCES_LABEL = 'Styre och händelser';
const INVALID = Object.freeze({
  reign: 'Regeringens uppgifter i sparfilen är ogiltiga.',
  prestige: 'Rikets ryktbarhet är ogiltig.',
});

const clamp = (value) => Math.max(0, Math.min(100, value));
const plainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const canonical = (date) => typeof date === 'string' && normalizeGameDate(date) === date;
const count = (value) => Number.isInteger(value) && value >= 0;
const exactKeys = (value, keys) => plainObject(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

const openReign = (rulerId, date, lawful, legitimacy) => ({
  rulerId, startedAt: date, lawful, deeds: Object.fromEntries(DEED_KEYS.map((key) => [key, 0])), goals: [], sources: { accession: legitimacy, goals: 0, prestige: 0 }, lostOrders: 0,
});

/** The record of a save that has none: the sitting ruler, counted from today, with today's legitimacy as the accession. */
export function defaultReign(state) {
  return openReign(state.offices.ruler.holderId ?? null, state.date, true, state.realm.legitimacy);
}

/** Closes the active goals of the old reign and writes a fresh record. `person` is null when nobody takes the throne. */
export function beginReign(state, person, { lawful, legitimacy }) {
  for (const goal of state.reign.goals) if (goal.status === 'active') Object.assign(goal, { status: 'abandoned', closedAt: state.date });
  state.reign = openReign(person?.id ?? null, state.date, lawful, legitimacy);
}

/** Counts a deed of the reigning ruler. An unknown key, such as the tag `duty`, is no deed. */
export function recordDeed(state, key) {
  if (DEED_KEYS.includes(key)) state.reign.deeds[key]++;
}

/** Whole months since the reign began. A month ends where addGameMonths lands, also on a shorter month's last day. */
export function reignMonths(state) {
  const { startedAt } = state.reign, from = parseGameDate(startedAt), to = parseGameDate(state.date);
  const months = (astronomicalYear(to.year) - astronomicalYear(from.year)) * 12 + to.month - from.month;
  return compareGameDates(addGameMonths(startedAt, months), state.date) > 0 ? months - 1 : months;
}

/** Moves realm legitimacy within 0..100, books the change actually applied under `goals` or `prestige`, and returns it. Any other source changes nothing. */
export function grantLegitimacy(state, source, amount) {
  if (!GRANT_SOURCES.includes(source)) return 0;
  const before = state.realm.legitimacy;
  state.realm.legitimacy = clamp(before + amount);
  const applied = state.realm.legitimacy - before;
  state.reign.sources[source] += applied;
  return applied;
}

/** Moves realm prestige within 0..100. */
export function addPrestige(state, amount) {
  state.realm.prestige = clamp(state.realm.prestige + amount);
}

/** Integer rows `{ label, value }` that sum to the rounded legitimacy. The last row carries whatever the ledger does not explain; zero rows are left out. */
export function legitimacySources(state) {
  const rows = SOURCE_KEYS.map((key) => ({ label: SOURCE_LABELS[key], value: Math.round(state.reign.sources[key]) }));
  const explained = rows.reduce((sum, row) => sum + row.value, 0);
  return [...rows, { label: OTHER_SOURCES_LABEL, value: Math.round(state.realm.legitimacy) - explained }].filter((row) => row.value !== 0);
}

function validRecord(state, reign) {
  if (!plainObject(reign) || typeof reign.lawful !== 'boolean' || !count(reign.lostOrders)) return false;
  if (reign.rulerId !== null && !(typeof reign.rulerId === 'string' && Object.hasOwn(state.people, reign.rulerId))) return false;
  if (!canonical(reign.startedAt) || compareGameDates(reign.startedAt, state.date) > 0) return false;
  if (!exactKeys(reign.deeds, DEED_KEYS) || !DEED_KEYS.every((key) => count(reign.deeds[key]))) return false;
  if (!exactKeys(reign.sources, SOURCE_KEYS) || !SOURCE_KEYS.every((key) => Number.isFinite(reign.sources[key]))) return false;
  return Array.isArray(reign.goals) && reign.goals.every(plainObject);
}

/** Refuses a forged reign record or a prestige outside 0..100. */
export function validateReign(state) {
  const { prestige } = state.realm;
  if (!Number.isFinite(prestige) || prestige < 0 || prestige > 100) throw new Error(INVALID.prestige);
  if (!validRecord(state, state.reign)) throw new Error(INVALID.reign);
}
