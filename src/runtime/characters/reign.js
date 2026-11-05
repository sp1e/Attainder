import { addGameMonths, astronomicalYear, compareGameDates, normalizeGameDate, parseGameDate } from '../gameDates.js';
import { ARCHETYPES } from './content.js';

// The reign record: who rules, since when and what the reign has added up to. It lives in state.reign as { rulerId, startedAt, lawful, deeds, goals, sources, lostOrders } and starts over at each accession (beginReign).
// realm.legitimacy stays one number with all its writers. `sources` counts what accession, goals and prestige added; legitimacySources shows the rest as `Styre och händelser`, so the rows always add up.
// A reign sets at most two goals at a time and tries each goal once (REIGN_GOALS). A goal is the ruler's: its deed and its stress follow state.reign.rulerId, also during a regency. A new reign starts with no goals.
// This module imports only gameDates.js and content.js, so extensions.js can fill the record without joining the cycle of actionResolution.js, npcPlots.js and schemes.js. The goals that read the council and the dread get their values through `hooks`. Nothing here draws randomness.

export const DEED_KEYS = Object.freeze(['cruel', 'betrayal', 'generous', 'risky', 'surrender', 'executions', 'breakdowns', 'goalsMet']);
const GRANT_SOURCES = Object.freeze(['goals', 'prestige']);
const SOURCE_KEYS = Object.freeze(['accession', ...GRANT_SOURCES]);
const SOURCE_LABELS = Object.freeze({ accession: 'Tronföljd', goals: 'Uppnådda mål', prestige: 'Ryktbarhet' });
const OTHER_SOURCES_LABEL = 'Styre och händelser';
const INVALID = Object.freeze({
  reign: 'Regeringens uppgifter i sparfilen är ogiltiga.',
  prestige: 'Rikets ryktbarhet är ogiltig.',
});
const GOAL_REFUSALS = Object.freeze({
  unknown: 'Målet finns inte.',
  full: 'Två mål är redan utlysta.',
  tried: 'Målet har redan prövats under denna regering.',
  noBuilder: 'Härskaren kan inte bygga ett sådant verk.',
});
const STATUS_LABELS = Object.freeze({ active: 'Pågår', met: 'Uppnått', failed: 'Förfelat' });
const GOAL_KEYS = Object.freeze(['id', 'type', 'baseline', 'setAt', 'dueAt', 'status', 'closedAt']);
const GOAL_ID = /^goal-([1-9]\d*)$/;
const GOAL_REWARD = Object.freeze({ prestige: 10, stress: -10 });
const GOAL_PENALTY = Object.freeze({ legitimacy: -3, stress: 10 });
const PRESTIGE = Object.freeze({ floor: 10, perLegitimacy: 20, decay: 1 });
const LASTING_WORKS = Object.freeze(['academy', 'aqueduct']);
const GOOD_SERVICE = 50;
export const MAX_ACTIVE_GOALS = 2;

const clamp = (value) => Math.max(0, Math.min(100, value));
const plainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const canonical = (date) => typeof date === 'string' && normalizeGameDate(date) === date;
const count = (value) => Number.isInteger(value) && value >= 0;
const exactKeys = (value, keys) => plainObject(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

function housesReconciled(state, goal, hooks) {
  const own = state.people[state.reign.rulerId]?.familyId;
  return Object.values(state.families).filter((family) => family.id !== own && !family.exiled).every((family) => hooks.familySupport(family) >= 55);
}

const isWork = (project) => LASTING_WORKS.includes(project.kind);
const workFinished = (state, goal) => state.projects.some((project) => isWork(project) && project.status === 'completed' && compareGameDates(project.dueAt, goal.setAt) >= 0);
const councilServes = (state, goal, hooks) => hooks.councilService().every((service) => (service ?? 0) >= GOOD_SERVICE);

/** What a reign can set out to do. `baseline` reads the value a goal is measured from when it is set, and `met` answers once a year. */
export const REIGN_GOALS = Object.freeze([
  { id: 'fill_treasury', label: 'Fyll statskassan', description: 'Statskassan ska rymma minst 300 silver och 80 mer än när målet sattes.', months: 60, legitimacy: 6, baseline: (state) => state.realm.treasury, met: (state, goal) => state.realm.treasury >= Math.max(300, goal.baseline + 80) },
  { id: 'strong_army', label: 'Stärk hären', description: 'Arméns styrka ska nå minst 70 och stiga med 15.', months: 60, legitimacy: 6, baseline: (state) => state.realm.armyStrength, met: (state, goal) => state.realm.armyStrength >= Math.max(70, goal.baseline + 15) },
  { id: 'reconcile_houses', label: 'Försona de stora husen', description: 'Varje annan familj ska ge kronan minst 55 i politiskt stöd.', months: 60, legitimacy: 10, met: housesReconciled },
  { id: 'lasting_work', label: 'Lämna ett bestående verk', description: 'En akademi eller en vattenledning ska stå färdig.', months: 72, legitimacy: 8, met: workFinished },
  { id: 'full_council', label: 'Fyll rådet med trogna', description: 'Kansler, överbefälhavare och spionmästare ska alla tjäna väl.', months: 36, legitimacy: 5, met: councilServes },
  { id: 'cow_nobles', label: 'Håll adeln i schack', description: 'Adelns rädsla ska nå minst 30.', months: 60, legitimacy: 6, met: (state, goal, hooks) => hooks.dreadOf() >= 30 },
].map((goal) => Object.freeze(goal)));

// A strict find, so an id wrapped in a list is no id.
const goalRow = (type) => REIGN_GOALS.find((goal) => goal.id === type);
const isActive = (goal) => goal.status === 'active';
const moveStress = (person, amount) => { person.stress = Math.max(0, Math.min(200, person.stress + amount)); };

const openReign = (rulerId, date, lawful, legitimacy) => ({
  rulerId, startedAt: date, lawful, deeds: Object.fromEntries(DEED_KEYS.map((key) => [key, 0])), goals: [], sources: { accession: legitimacy, goals: 0, prestige: 0 }, lostOrders: 0,
});

/** The record of a save that has none: the sitting ruler, counted from today, with today's legitimacy as the accession. */
export function defaultReign(state) {
  return openReign(state.offices.ruler.holderId ?? null, state.date, true, state.realm.legitimacy);
}

/** Writes a fresh record, which drops the goals of the old reign with it. `person` is null when nobody takes the throne. */
export function beginReign(state, person, { lawful, legitimacy }) {
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

function canBuildWork(state, hooks) {
  const action = ARCHETYPES[hooks.ruler()?.archetype]?.action;
  return LASTING_WORKS.includes(action) || state.projects.some((project) => isWork(project) && project.status === 'active');
}

/** Why `goalType` cannot be set now, or '' when it can. */
export function goalRefusal(state, goalType, hooks) {
  const { goals } = state.reign;
  if (!goalRow(goalType)) return GOAL_REFUSALS.unknown;
  if (goals.filter(isActive).length >= MAX_ACTIVE_GOALS) return GOAL_REFUSALS.full;
  if (goals.some((goal) => goal.type === goalType)) return GOAL_REFUSALS.tried;
  return goalType === 'lasting_work' && !canBuildWork(state, hooks) ? GOAL_REFUSALS.noBuilder : '';
}

/** The `set_reign_goal` command: one order, no silver. */
export function setReignGoal(state, goalType, hooks) {
  const refusal = goalRefusal(state, goalType, hooks);
  if (refusal) throw new Error(refusal);
  const row = goalRow(goalType);
  hooks.charge(0, { publicFunds: true, orders: 1, tag: 'duty' });
  state.reign.goals.push({ id: `goal-${++state.sequence}`, type: row.id, baseline: row.baseline?.(state) ?? 0, setAt: state.date, dueAt: addGameMonths(state.date, row.months), status: 'active', closedAt: null });
}

/** The goals a ruler can set right now, as options for the command's field. */
export function openGoals(state, hooks) {
  return REIGN_GOALS.filter((goal) => !goalRefusal(state, goal.id, hooks)).map((goal) => ({ id: goal.id, name: goal.label }));
}

/** Why the command is closed, given `openGoals`: with no goal left, every goal gives a refusal, so the first one speaks for them. */
export const goalClosedReason = (state, goals, hooks) => (goals.length ? '' : goalRefusal(state, REIGN_GOALS[0].id, hooks));

function reachGoal(state, row, ruler, events, hooks) {
  grantLegitimacy(state, 'goals', row.legitimacy);
  addPrestige(state, GOAL_REWARD.prestige);
  recordDeed(state, 'goalsMet');
  moveStress(ruler, GOAL_REWARD.stress);
  const event = hooks.logEvent(events, 'reign_goal_met', `Regeringsmålet uppnått: ${row.label}`, `${ruler.name} har nått det mål regeringen satte upp.`, [ruler.id]);
  hooks.memory('reign_goal', event.title, [ruler.id], { causeId: event.id });
}

// The loss goes straight to realm.legitimacy, so the rows show it under `Styre och händelser`.
function missGoal(state, row, ruler, events, hooks) {
  state.realm.legitimacy = clamp(state.realm.legitimacy + GOAL_PENALTY.legitimacy);
  moveStress(ruler, GOAL_PENALTY.stress);
  hooks.logEvent(events, 'reign_goal_failed', `Regeringsmålet förfelat: ${row.label}`, `${ruler.name} nådde inte målet i tid.`, [ruler.id]);
}

/** Yearly, in array order. A goal that holds is met also at the first check past its date, because the calendar only looks once a year. */
export function goalStep(state, events, hooks) {
  const ruler = state.people[state.reign.rulerId];
  for (const goal of state.reign.goals.filter(isActive)) {
    const row = goalRow(goal.type), met = row.met(state, goal, hooks);
    if (!met && compareGameDates(state.date, goal.dueAt) <= 0) continue;
    Object.assign(goal, { status: met ? 'met' : 'failed', closedAt: state.date });
    (met ? reachGoal : missGoal)(state, row, ruler, events, hooks);
  }
}

/** Yearly. Fame past the floor pays legitimacy, one point per 20, and then fades by one. A realm at the floor gains nothing, so a passive campaign keeps today's legitimacy. */
export function prestigeStep(state) {
  const { prestige } = state.realm;
  grantLegitimacy(state, 'prestige', Math.floor(Math.max(0, prestige - PRESTIGE.floor) / PRESTIGE.perLegitimacy));
  state.realm.prestige = Math.max(prestige - PRESTIGE.decay, Math.min(prestige, PRESTIGE.floor));
}

function presentGoal({ id, type, dueAt, status }) {
  const { label, description } = goalRow(type);
  return { id, type, label, description, dueAt, status, statusLabel: STATUS_LABELS[status] };
}

/** The reign as the player sees it. Reads only, and hands out new objects. */
export function presentReign(state, hooks) {
  const { rulerId, startedAt, goals } = state.reign;
  return { rulerId, rulerName: hooks.ruler()?.name ?? null, startedAt, goals: goals.map(presentGoal) };
}

function validGoalDates(state, reign, goal, row) {
  if (!canonical(goal.setAt) || compareGameDates(goal.setAt, reign.startedAt) < 0 || compareGameDates(goal.setAt, state.date) > 0) return false;
  if (goal.dueAt !== addGameMonths(goal.setAt, row.months)) return false;
  if (goal.status === 'active') return goal.closedAt === null;
  return canonical(goal.closedAt) && compareGameDates(goal.closedAt, goal.setAt) >= 0 && compareGameDates(goal.closedAt, state.date) <= 0;
}

function validGoal(state, reign, goal) {
  if (!exactKeys(goal, GOAL_KEYS) || typeof goal.id !== 'string' || !Number.isFinite(goal.baseline)) return false;
  const row = goalRow(goal.type), number = GOAL_ID.exec(goal.id)?.[1];
  if (!row || !number || Number(number) > state.sequence || !Object.keys(STATUS_LABELS).includes(goal.status)) return false;
  return validGoalDates(state, reign, goal, row);
}

function validGoals(state, reign) {
  const { goals, rulerId } = reign;
  if (!Array.isArray(goals) || !goals.every((goal) => validGoal(state, reign, goal))) return false;
  if (rulerId === null && goals.length) return false;
  if (new Set(goals.map((goal) => goal.id)).size !== goals.length || new Set(goals.map((goal) => goal.type)).size !== goals.length) return false;
  return goals.filter(isActive).length <= MAX_ACTIVE_GOALS;
}

function validRecord(state, reign) {
  if (!plainObject(reign) || typeof reign.lawful !== 'boolean' || !count(reign.lostOrders)) return false;
  if (reign.rulerId !== null && !(typeof reign.rulerId === 'string' && Object.hasOwn(state.people, reign.rulerId))) return false;
  // The engine writes the office and the record together, so a difference is a forgery. A vacant office reads as null, as in defaultReign.
  if (reign.rulerId !== (state.offices.ruler?.holderId ?? null)) return false;
  if (!canonical(reign.startedAt) || compareGameDates(reign.startedAt, state.date) > 0) return false;
  if (!exactKeys(reign.deeds, DEED_KEYS) || !DEED_KEYS.every((key) => count(reign.deeds[key]))) return false;
  if (!exactKeys(reign.sources, SOURCE_KEYS) || !SOURCE_KEYS.every((key) => Number.isFinite(reign.sources[key]))) return false;
  return validGoals(state, reign);
}

/** Refuses a forged reign record or a prestige outside 0..100. */
export function validateReign(state) {
  const { prestige } = state.realm;
  if (!Number.isFinite(prestige) || prestige < 0 || prestige > 100) throw new Error(INVALID.prestige);
  if (!validRecord(state, state.reign)) throw new Error(INVALID.reign);
}
