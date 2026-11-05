import { isImprisoned, livingAdults } from './prisoners.js';
import { recordDeed } from './reign.js';
import { setRelationship } from './secrets.js';

// Dread: the ruler governs by fear. Dread is the mean `person.fear` of the living free adults outside the ruler's family, derived on every read and never stored.
// `hooks` are the engine's (actionHooks in index.js). Nothing here draws randomness. prisoners.js calls onExecution and this file reads prisoners.js, so neither module uses the other at the top level.

const EXECUTION = Object.freeze({ fear: 20, kinFear: 15, grievance: -10, enemyTraits: Object.freeze(['vengeful', 'brave']) });
const FEAR_ROW = Object.freeze({ label: 'Rädsla för härskaren', perPoint: 10, max: 10, actions: Object.freeze(['sway', 'blackmail', 'imprison']) });
const HEAVY = Object.freeze({ dread: 40, legitimacy: -1, grievance: -1 });
const WARY_DREAD = 15;
const LABELS = Object.freeze({ calm: 'Ingen fruktar kronan', wary: 'Adeln är på sin vakt', terror: 'Adeln lever i skräck' });

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const hasTrait = (person, trait) => Array.isArray(person.traits) && person.traits.includes(trait);
const raiseFear = (person, amount) => { person.fear = clamp(person.fear + amount, 0, 100); };
const moveGrievance = (family, amount) => { family.grievance = clamp(family.grievance + amount, -40, 40); };

// The people dread counts. With no ruler every family counts.
function nobles(state, hooks) {
  const rulingFamilyId = hooks.ruler()?.familyId;
  return Object.values(state.people).filter((person) => !person.diedAt && hooks.adult(person) && person.familyId !== rulingFamilyId && !isImprisoned(state, person.id));
}

/** The rounded mean fear of the living free adults outside the ruler's family, 0 with none. */
export function dreadOf(state, hooks) {
  const people = nobles(state, hooks);
  return people.length ? Math.round(people.reduce((sum, person) => sum + person.fear, 0) / people.length) : 0;
}

/** Raises the fear of the people dread counts, within 0..100. */
export function cowNobles(state, amount, hooks) {
  for (const person of nobles(state, hooks)) raiseFear(person, amount);
}

/** What an execution does to the court. executePrisoner calls it after the execution's memory and before the death. The victim's family adults fear more, also those in prison, and the vengeful and the brave among them become the ruler's nemesis. The ruler and the person who ordered the death are left out of that kin. The deed counts only when the ruler ordered it, the rule charge uses. */
export function onExecution(state, person, noteId, hooks) {
  const ruler = hooks.ruler(), acting = hooks.activeRepresentative();
  cowNobles(state, EXECUTION.fear, hooks);
  for (const kin of livingAdults(state, hooks, person.familyId, person.id)) {
    if (kin.id === ruler?.id || kin.id === acting?.id) continue;
    raiseFear(kin, EXECUTION.kinFear);
    if (ruler && EXECUTION.enemyTraits.some((trait) => hasTrait(kin, trait))) setRelationship(state, { kind: 'nemesis', aId: kin.id, bId: ruler.id, causeId: noteId });
  }
  moveGrievance(state.families[person.familyId], EXECUTION.grievance);
  if (acting?.id === state.reign.rulerId) recordDeed(state, 'executions');
}

/** The success row a frightened target gives the player's sway, blackmail and imprison. Empty for any other action and below fear 10, because a row is never 0. */
export function dreadRows(entry, target) {
  const value = Math.min(FEAR_ROW.max, Math.floor(target.fear / FEAR_ROW.perPoint));
  return FEAR_ROW.actions.includes(entry.id) && value > 0 ? [{ label: FEAR_ROW.label, value }] : [];
}

/** The yearly price of heavy dread: legitimacy and the goodwill of every family but the ruler's. */
export function dreadYearStep(state, hooks) {
  if (dreadOf(state, hooks) < HEAVY.dread) return;
  state.realm.legitimacy = clamp(state.realm.legitimacy + HEAVY.legitimacy, 0, 100);
  const rulingFamilyId = hooks.ruler()?.familyId;
  for (const family of Object.values(state.families)) if (family.id !== rulingFamilyId) moveGrievance(family, HEAVY.grievance);
}

/** Dread as the player reads it. Reads only. */
export function presentDread(state, hooks) {
  const value = dreadOf(state, hooks);
  return { value, label: value < WARY_DREAD ? LABELS.calm : value < HEAVY.dread ? LABELS.wary : LABELS.terror };
}
