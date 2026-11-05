import { addGameMonths, compareGameDates } from '../gameDates.js';
import { cowNobles } from './dread.js';
import { addPrestige, recordDeed } from './reign.js';

// Stress breakdowns: sustained stress turns into a public court story with a real cost. The first crossing of stress 80 opens the existing `stress_crisis` (annualStep); a second crossing within 60 months, or stress 100, opens `stress_breakdown` here.
// `hooks` are the engine's (actionHooks in index.js). Nothing here draws randomness.

export const CRISIS_STRESS = 80;
export const BREAKDOWN_STRESS = 100;
export const CRISIS_MEMORY_MONTHS = 60;

// Tag, then trait, then the stress the trait adds to the tag.
const NATURE_COSTS = Object.freeze({
  cruel: Object.freeze({ just: 8 }),
  betrayal: Object.freeze({ honest: 12, just: 6 }),
  risky: Object.freeze({ craven: 12, paranoid: 6 }),
  surrender: Object.freeze({ brave: 8 }),
});
const FITTING_TRAIT = Object.freeze({ cruel: 'cruel', betrayal: 'deceitful' });
const PRESSURE = Object.freeze({ demand: 4, faction: 6, goal: 4, lowTreasury: 3, treasuryBelow: 20, yearlyCap: 15, months: 12 });
const STRESS_MAX = 200;
const DUE_MONTHS = 6;
const LOST_ORDERS = 2;
const PRESTIGE_LOSS = -5;
const RAGE = Object.freeze({ fear: 10, opinion: -15, label: 'Vredesutbrott vid hovet' });
const DEADLINE_TEXT = 'Utan ett val kostar sammanbrottet 20 hälsa, 8 legitimitet och årets alla handlingar.';
const CLOSED = Object.freeze({ dead: 'Personens liv har avslutats.', replaced: 'Personen företräder inte längre familjen eller riket.' });

// What each path costs. `orders` empties the year and takes LOST_ORDERS from the next one.
const PATHS = Object.freeze({
  withdraw: Object.freeze({ stress: -50, legitimacy: -4, orders: true }),
  rage: Object.freeze({ stress: -40, legitimacy: -2 }),
  vice: Object.freeze({ stress: -35, health: -15, silver: -30 }),
  collapse: Object.freeze({ stress: -30, health: -20, legitimacy: -8, orders: true }),
});
const CHOICES = Object.freeze([
  { id: 'withdraw', label: 'Dra dig undan hovet', description: 'Minska stress med 50 och avstå årets återstående handlingar. Nästa år ger 2 handlingar färre.', cost: '4 legitimitet, 5 ryktbarhet, årets handlingar och 2 handlingar nästa år', stress: '−50', disabledReason: '' },
  { id: 'rage', label: 'Släpp lös vreden', description: 'Minska stress med 40 och skräm adeln. De andra familjernas huvudmän tycker 15 sämre om dig.', cost: '2 legitimitet och 5 ryktbarhet', stress: '−40', disabledReason: '' },
  { id: 'vice', label: 'Sök tröst i vinet', description: 'Minska stress med 35 på bekostnad av hälsan och familjekassan.', cost: '15 hälsa, 30 familjesilver och 5 ryktbarhet', stress: '−35', disabledReason: '' },
].map((choice) => Object.freeze(choice)));

/** The choice-free end of a breakdown, for the dispatch table in court.js. */
export const BREAKDOWN_EXPIRY = Object.freeze({ choiceId: 'collapse', text: 'Ingen valde i tid. Sammanbrottet kostade 20 hälsa, 8 legitimitet, 5 ryktbarhet, årets handlingar och 2 handlingar nästa år.' });

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const has = (person, trait) => Boolean(person?.traits?.includes(trait));
const moveStress = (person, amount) => { person.stress = clamp(person.stress + amount, 0, STRESS_MAX); };
const isCrisisOf = (story, actor) => story.type === 'stress_crisis' && story.actorId === actor.id;
const crisisRemembered = (state, story) => compareGameDates(addGameMonths(story.createdAt, CRISIS_MEMORY_MONTHS), state.date) >= 0;
// The engine closes a goal or a lapsed demand on a year turn, before the pressure step, so the turn 12 months later leaves it out and it counts once.
const closedThisYear = (state, date) => compareGameDates(addGameMonths(date, PRESSURE.months), state.date) > 0;
// A player refuses after that day's year turn, so a refusal from 12 months back has not counted yet.
const refusedThisYear = (state, date) => compareGameDates(addGameMonths(date, PRESSURE.months), state.date) >= 0;

/** Whether the deed comes naturally to the person, who then pays no stress for it. */
export const fitsNature = (person, tag) => has(person, FITTING_TRAIT[tag]);

/** The stress a person's nature adds to a deed's tag. */
export function natureStress(person, tag) {
  return Object.entries(NATURE_COSTS[tag] ?? {}).reduce((sum, [trait, cost]) => (has(person, trait) ? sum + cost : sum), 0);
}

/** Stress 100 or more, or stress 80 or more with a resolved crisis of `actor` from the last 60 months. A crisis still open does not count. */
export function breakdownDue(state, actor) {
  if (actor.stress >= BREAKDOWN_STRESS) return true;
  return actor.stress >= CRISIS_STRESS && state.stories.some((story) => isCrisisOf(story, actor) && story.status === 'resolved' && crisisRemembered(state, story));
}

// Task 6 fills this list with its demand records.
function demandPressure(state) {
  return (state.familyDemands ?? []).filter((demand) => (demand.status === 'refused' && refusedThisYear(state, demand.closedAt)) || (demand.status === 'lapsed' && closedThisYear(state, demand.closedAt))).length * PRESSURE.demand;
}

// Task 7 counts presentFactions here, so an undiscovered faction adds no stress.
function factionPressure(state) {
  return (state.factions ?? []).length * PRESSURE.faction;
}

function goalPressure(state) {
  return state.reign.goals.filter((goal) => goal.status === 'failed' && closedThisYear(state, goal.closedAt)).length * PRESSURE.goal;
}

const treasuryPressure = (state) => (state.realm.treasury < PRESSURE.treasuryBelow ? PRESSURE.lowTreasury : 0);

/** Yearly: what the court lays on the representative, at most 15. */
export function stressPressureStep(state, hooks) {
  const actor = hooks.activeRepresentative();
  if (!actor) return;
  moveStress(actor, Math.min(PRESSURE.yearlyCap, demandPressure(state) + factionPressure(state) + goalPressure(state) + treasuryPressure(state)));
}

/** Yearly: the orders a breakdown took from this year. */
export function lostOrdersStep(state) {
  state.actionPoints = Math.max(0, state.actionPoints - state.reign.lostOrders);
  state.reign.lostOrders = 0;
}

/** Yearly, after the pressure. The pressure can carry stress past 100 on the day annualStep opened a crisis; that year turn keeps the crisis alone, so one turn never opens both. */
export function breakdownStep(state, events, hooks) {
  const actor = hooks.activeRepresentative();
  if (!actor || !breakdownDue(state, actor)) return;
  if (state.stories.some((story) => (story.type === 'stress_breakdown' && story.status === 'open') || (isCrisisOf(story, actor) && story.createdAt === state.date))) return;
  hooks.openStory({ type: 'stress_breakdown', title: `${actor.name} bryter samman`, description: `${actor.name} orkar inte bära ansvaret längre, och hela hovet ser det.`, actorId: actor.id, createdAt: state.date, dueAt: addGameMonths(state.date, DUE_MONTHS), knownBy: 'public', deadlineText: DEADLINE_TEXT });
  hooks.logEvent(events, 'stress_breakdown', 'Sammanbrott vid hovet', `${actor.name} bryter samman inför hovet.`, [actor.id]);
}

/** The three ways out, as new objects. */
export function breakdownChoices() {
  return CHOICES.map((choice) => ({ ...choice }));
}

function payPath(state, actor, path, hooks) {
  moveStress(actor, path.stress);
  if (path.health) actor.health = Math.max(1, actor.health + path.health);
  // The loss goes straight to realm.legitimacy, as a failed goal's does, so the rows show it under `Styre och händelser`.
  if (path.legitimacy) state.realm.legitimacy = clamp(state.realm.legitimacy + path.legitimacy, 0, 100);
  const family = hooks.controlledFamily();
  if (path.silver && family) family.treasury = Math.max(0, family.treasury + path.silver);
  if (path.orders) { state.actionPoints = 0; state.reign.lostOrders = LOST_ORDERS; }
}

// The other houses remember the outburst. opinionCause drops a cause it already holds, so each outburst has a memory of its own.
function lashOut(state, actor, story, hooks) {
  cowNobles(state, RAGE.fear, hooks);
  const note = hooks.memory('breakdown_rage', 'Ett vredesutbrott vid hovet', [actor.id], { causeId: story.id });
  for (const family of Object.values(state.families)) {
    const head = state.people[family.headId];
    if (family.id !== actor.familyId && !family.exiled && head && !head.diedAt) hooks.opinionCause(head.id, actor.id, RAGE.opinion, RAGE.label, note.id);
  }
}

/** Pays a choice or the expiry `collapse`. The ruler alone carries the deed, the rule `charge` uses, so a regent's or a family head's breakdown names no ruler `den Bräcklige`. */
export function resolveBreakdown(state, story, choiceId, events, hooks) {
  const actor = state.people[story.actorId];
  payPath(state, actor, PATHS[choiceId], hooks);
  if (choiceId === 'rage') lashOut(state, actor, story, hooks);
  addPrestige(state, PRESTIGE_LOSS);
  if (actor.id === state.reign.rulerId) recordDeed(state, 'breakdowns');
}

/** Why an open breakdown no longer stands, or '' while it does. Such a story closes with no cost. */
export function breakdownClosedReason(state, story, hooks) {
  const actor = state.people[story.actorId];
  if (!actor || actor.diedAt) return CLOSED.dead;
  return hooks.activeRepresentative()?.id === actor.id ? '' : CLOSED.replaced;
}
