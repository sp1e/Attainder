import { addGameMonths, compareGameDates, normalizeGameDate } from '../gameDates.js';
import { ambitionOf } from './council.js';
import { normalizeDifficulty, plotRandom } from './extensions.js';
import { AGGRESSION } from './npcPlots.js';
import { isImprisoned } from './prisoners.js';

// Family demands: a great family asks the crown for a city or an office in public, and every answer costs something. A record is { id: 'demand-<n>', familyId, kind, targetId, storyId, openedAt, dueAt, status, closedAt } and lives in state.familyDemands. Its `family_demand` story carries the answer.
// The yearly step runs only while the player holds the crown. It draws only from the plot stream (plotRandom), and only after every other check passed. Nothing else here draws randomness.
// `hooks` are the engine's (actionHooks in index.js). actionResolution.js, npcPlots.js and schemes.js import each other in a cycle, so AGGRESSION is read only inside a function here.

const TERM_MONTHS = 12;
const QUIET_MONTHS = 24;
const OFFICES = Object.freeze(['chancellor', 'general', 'priest']);
const CHANCE = Object.freeze({ base: 34, influence: 45, ambitious: 10, fearDivisor: 2, min: 5, max: 70 });
const COMPENSATION = 40;
const ANSWER_ORDERS = 1;
const ANSWER_TAG = 'duty';
const GRIEVANCE_MIN = -40;
const GRIEVANCE_MAX = 40;
const REFUSAL_GOODWILL = 1;
// A house this many seats behind the favoured one takes offence.
const SEAT_TILT = 2;
const TILTED = Object.freeze({ grievance: -4, opinion: -5 });
const FORCED = Object.freeze({ grievance: -6, opinion: -8 });

// What each outcome does. `orders` marks an answer the ruler gives; the lapse comes by itself. `label` names the head's cooling toward the ruler.
const OUTCOMES = Object.freeze({
  grant: Object.freeze({ status: 'granted', orders: ANSWER_ORDERS, silver: 0, grievance: 8, opinion: 0 }),
  compensate: Object.freeze({ status: 'compensated', orders: ANSWER_ORDERS, silver: COMPENSATION, grievance: 0, opinion: -3, label: 'Avspisad med silver' }),
  refuse: Object.freeze({ status: 'refused', orders: ANSWER_ORDERS, silver: 0, grievance: -8, opinion: -12, label: 'Avvisat krav' }),
  lapse: Object.freeze({ status: 'lapsed', orders: 0, silver: 0, grievance: -10, opinion: -15, label: 'Obesvarat krav' }),
});

const STATUS_LABELS = Object.freeze({ open: 'Obesvarat', granted: 'Beviljat', compensated: 'Avköpt', refused: 'Avvisat', lapsed: 'Förfallet', void: 'Bortfallet' });
const KIND_LABELS = Object.freeze({ city: 'Stad', office: 'Ämbete' });
const FIELDS = 'closedAt,dueAt,familyId,id,kind,openedAt,status,storyId,targetId';
const CLOSED_SHOWN = 6;
const DEADLINE_TEXT = 'Utan svar räknas kravet som avvisat, och familjen tar det hårdare.';
const INVALID = 'Ett krav i sparfilen är ogiltigt.';
const NO_MANDATE = 'Kräver härskarmandat.';
const NO_ORDERS = 'Årets handlingsutrymme är slut. För tiden framåt.';
const NO_FUNDS = 'Otillräcklig statskassa.';
const NO_CANDIDATE = 'Familjen saknar en behörig kandidat till ämbetet.';
const CLOSED = Object.freeze({ dead: 'Huvudmannen lever inte längre, och kravet faller.', exiled: 'Familjen har lämnat riket, och kravet faller.', held: 'Familjen har redan fått det den krävde.', reign: 'Kravet gällde den förra härskaren och faller med det styret.' });

/** The choice-free end of a demand, for the dispatch table in court.js. */
export const DEMAND_EXPIRY = Object.freeze({ choiceId: 'lapse', text: 'Ingen svarade i tid. Familjen tappade 10 i stöd, och huvudmannen tycker 15 sämre om härskaren.' });

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const byId = (a, b) => a.id.localeCompare(b.id, 'en', { numeric: true });
const skillSum = (person) => Object.values(person.skills).reduce((sum, value) => sum + value, 0);
const moveGrievance = (family, amount) => { family.grievance = clamp(family.grievance + amount, GRIEVANCE_MIN, GRIEVANCE_MAX); };
const holderFamilyId = (state, officeId) => state.people[state.offices[officeId]?.holderId]?.familyId;
const seatsOf = (state, familyId) => Object.values(state.offices).filter((office) => office.id !== 'ruler' && state.people[office.holderId]?.familyId === familyId).length;
const targetName = (state, { kind, targetId }) => (kind === 'city' ? state.cities[targetId] : state.offices[targetId])?.name ?? targetId;
const demandOf = (state, story) => state.familyDemands.find((demand) => demand.id === story.demandId);
const openDemands = (state) => state.familyDemands.filter((demand) => demand.status === 'open');

// An open demand and any demand from the last 24 months keep the family quiet.
const keptQuiet = (state, demand) => demand.status === 'open' || compareGameDates(addGameMonths(demand.openedAt, QUIET_MONTHS), state.date) > 0;

// hooks.adult is false for the dead and for a head who is missing.
function mayDemand(state, family, hooks) {
  const head = state.people[family.headId];
  if (family.exiled || !hooks.adult(head) || isImprisoned(state, head.id)) return false;
  return !state.familyDemands.some((demand) => demand.familyId === family.id && keptQuiet(state, demand));
}

function cityTarget(state, family) {
  const [city] = Object.values(state.cities).filter((item) => item.familyId !== family.id).sort((a, b) => a.baseRevenue - b.baseRevenue || byId(a, b));
  return city ? { kind: 'city', targetId: city.id } : null;
}

function officeTarget(state, family) {
  const targetId = OFFICES.find((officeId) => holderFamilyId(state, officeId) !== family.id);
  return targetId ? { kind: 'office', targetId } : null;
}

function targetOf(state, family, hooks) {
  return ambitionOf(state, state.people[family.headId], hooks) === 'city' ? cityTarget(state, family) : officeTarget(state, family);
}

function candidateOf(state, family, hooks) {
  const [candidate] = Object.values(state.people).filter((person) => person.familyId === family.id && hooks.adult(person) && !isImprisoned(state, person.id)).sort((a, b) => skillSum(b) - skillSum(a) || byId(a, b));
  return candidate ?? null;
}

function demandChance(state, family) {
  const head = state.people[family.headId];
  const raw = CHANCE.base + (family.influence - CHANCE.influence) + (head.traits.includes('ambitious') ? CHANCE.ambitious : 0) - head.fear / CHANCE.fearDivisor;
  return clamp(raw * AGGRESSION[normalizeDifficulty(state.difficulty)], CHANCE.min, CHANCE.max);
}

function openDemand(state, family, target, events, hooks) {
  const head = state.people[family.headId], name = targetName(state, target);
  const id = `demand-${++state.sequence}`, dueAt = addGameMonths(state.date, TERM_MONTHS);
  const title = `${family.name} kräver ${name}`, description = `${head.name} vill se familjen i ${name}. De andra husen ser vad du svarar.`;
  const story = hooks.openStory({ type: 'family_demand', title, description, actorId: head.id, familyId: family.id, createdAt: state.date, dueAt, knownBy: 'public', demandId: id, deadlineText: DEADLINE_TEXT });
  state.familyDemands.push({ id, familyId: family.id, ...target, storyId: story.id, openedAt: state.date, dueAt, status: 'open', closedAt: null });
  hooks.logEvent(events, 'family_demand', title, description, [head.id]);
}

/** Yearly: at most one family makes a demand. Families draw in id order, and the first success ends the step. */
export function demandStep(state, events, hooks) {
  if (!hooks.canRule()) return;
  const excluded = new Set([hooks.ruler()?.familyId, hooks.controlledFamily()?.id]);
  for (const family of Object.values(state.families).sort(byId)) {
    if (excluded.has(family.id) || !mayDemand(state, family, hooks)) continue;
    const target = targetOf(state, family, hooks);
    if (!target || !candidateOf(state, family, hooks)) continue;
    if (plotRandom(state) * 100 >= demandChance(state, family)) continue;
    openDemand(state, family, target, events, hooks);
    return;
  }
}

function answerBar(state, hooks) {
  if (!hooks.canRule()) return NO_MANDATE;
  return state.actionPoints < ANSWER_ORDERS ? NO_ORDERS : '';
}

/** The three answers, as new objects. Reads only. */
export function demandChoices(state, story, hooks) {
  const candidate = candidateOf(state, state.families[demandOf(state, story).familyId], hooks);
  const bar = answerBar(state, hooks), stress = String(hooks.stressFor(hooks.activeRepresentative(), ANSWER_TAG)), cost = '1 handling';
  const seated = candidate ? `${candidate.name} får uppdraget och familjens` : 'Familjens';
  return [
    { id: 'grant', label: 'Bevilja kravet', description: `${seated} stöd stiger med 8. Övriga hus tappar 6 i stöd, och deras huvudmän tycker 8 sämre om dig.`, cost, stress, disabledReason: hooks.appointReason() || bar || (candidate ? '' : NO_CANDIDATE) },
    { id: 'compensate', label: 'Köp tid med silver', description: 'Familjen avstår för den här gången. Huvudmannen tycker 3 sämre om dig.', cost: `${COMPENSATION} silver ur statskassan och 1 handling`, stress, disabledReason: bar || (state.realm.treasury < COMPENSATION ? NO_FUNDS : '') },
    { id: 'refuse', label: 'Avvisa kravet', description: 'Familjen tappar 8 i stöd och huvudmannen tycker 12 sämre om dig. Övriga hus vinner 1 i stöd.', cost, stress, disabledReason: bar },
  ];
}

// The appoint command spends a regent's consent by its own type; an answer to a story has to spend it here.
function grantTarget(state, demand, events, hooks) {
  const officeId = demand.kind === 'city' ? state.cities[demand.targetId].governorOfficeId : demand.targetId;
  hooks.assignOffice(state.offices[officeId], candidateOf(state, state.families[demand.familyId], hooks), events, 'Familjen får sin vilja');
  hooks.consumeAppointConsent();
}

// opinionCause drops a cause it already holds, so each answer has a memory of its own.
function headCools(story, outcome, hooks) {
  const note = hooks.memory('family_demand', outcome.label, [story.actorId, hooks.ruler()?.id], { causeId: story.id });
  hooks.opinionCause(story.actorId, hooks.ruler()?.id, outcome.opinion, outcome.label, note.id);
}

/** Pays a choice or the expiry `lapse`, and closes the record. */
export function resolveDemand(state, story, choiceId, events, hooks) {
  const outcome = OUTCOMES[choiceId], demand = demandOf(state, story), family = state.families[demand.familyId];
  if (outcome.orders) hooks.charge(outcome.silver, { publicFunds: true, orders: outcome.orders, tag: ANSWER_TAG });
  if (choiceId === 'grant') grantTarget(state, demand, events, hooks);
  moveGrievance(family, outcome.grievance);
  if (outcome.opinion) headCools(story, outcome, hooks);
  if (choiceId === 'grant') seatReaction(state, family, events, hooks, { force: true });
  if (choiceId === 'refuse') for (const other of Object.values(state.families)) if (other.id !== family.id) moveGrievance(other, REFUSAL_GOODWILL);
  Object.assign(demand, { status: outcome.status, closedAt: state.date });
}

/** The other houses answer a favour. A house two or more seats behind `family` takes offence; under `force` every house in the realm does, and harder. */
export function seatReaction(state, family, events, hooks, { force = false } = {}) {
  const seats = seatsOf(state, family.id), rulerId = hooks.ruler()?.id, { grievance, opinion } = force ? FORCED : TILTED;
  const angered = Object.values(state.families).filter((other) => other.id !== family.id && !other.exiled && (force || seatsOf(state, other.id) <= seats - SEAT_TILT));
  if (!angered.length) return;
  const cause = `Gynnande av ${family.name}`;
  const event = hooks.logEvent(events, 'family_favoured', cause, `De andra husen ser hur ${family.name} gynnas.`, [rulerId, family.headId]);
  const note = hooks.memory('family_favoured', cause, [rulerId, family.headId], { causeId: event.id });
  for (const other of angered) {
    moveGrievance(other, grievance);
    const head = state.people[other.headId];
    if (head && !head.diedAt) hooks.opinionCause(head.id, rulerId, opinion, cause, note.id);
  }
}

/** Why an open demand no longer stands, or '' while it does. Such a story closes with no cost. */
export function demandClosedReason(state, story) {
  const head = state.people[story.actorId], demand = demandOf(state, story);
  if (!head || head.diedAt) return CLOSED.dead;
  if (state.families[demand.familyId].exiled) return CLOSED.exiled;
  const holder = demand.kind === 'city' ? state.cities[demand.targetId]?.familyId : holderFamilyId(state, demand.targetId);
  return holder === demand.familyId ? CLOSED.held : '';
}

/** Closes the record of a story that fell away, for the dispatch table in court.js. */
export function voidDemand(state, story) {
  Object.assign(demandOf(state, story), { status: 'void', closedAt: state.date });
}

/** Every open demand falls with the reign it was made to. */
export function voidOpenDemands(state) {
  for (const demand of openDemands(state)) {
    Object.assign(demand, { status: 'void', closedAt: state.date });
    const story = state.stories.find((item) => item.id === demand.storyId);
    Object.assign(story, { status: 'closed', resolvedAt: state.date, resolution: CLOSED.reign });
  }
}

/** The open demands and the last six closed, as the court shows them. Reads only. */
export function presentDemands(state) {
  const closed = state.familyDemands.filter((demand) => demand.status !== 'open').slice(-CLOSED_SHOWN);
  return [...openDemands(state), ...closed].map((demand) => ({ id: demand.id, familyName: state.families[demand.familyId].name, kindLabel: KIND_LABELS[demand.kind], targetName: targetName(state, demand), statusLabel: STATUS_LABELS[demand.status], dueAt: demand.dueAt }));
}

const canonical = (date) => typeof date === 'string' && normalizeGameDate(date) === date;
const ownKey = (map, key) => typeof key === 'string' && Object.hasOwn(map, key);
const numberOf = (id) => Number(/^demand-([1-9]\d*)$/.exec(id)?.[1] ?? Number.NaN);
const validTarget = (state, { kind, targetId }) => (kind === 'city' ? ownKey(state.cities, targetId) : kind === 'office' && OFFICES.includes(targetId));

function validDates(state, { openedAt, dueAt, status, closedAt }) {
  if (!canonical(openedAt) || compareGameDates(openedAt, state.date) > 0 || dueAt !== addGameMonths(openedAt, TERM_MONTHS)) return false;
  if (status === 'open') return closedAt === null;
  return canonical(closedAt) && compareGameDates(closedAt, openedAt) >= 0 && compareGameDates(closedAt, state.date) <= 0;
}

function validStory(state, demand) {
  const story = state.stories.find((item) => item.id === demand.storyId);
  return story?.type === 'family_demand' && story.demandId === demand.id && story.dueAt === demand.dueAt && (story.status === 'open') === (demand.status === 'open');
}

function validDemand(state, demand) {
  if (!demand || typeof demand !== 'object' || Object.keys(demand).sort().join() !== FIELDS) return false;
  if (!(numberOf(demand.id) <= state.sequence) || !ownKey(state.families, demand.familyId)) return false;
  return validTarget(state, demand) && ownKey(STATUS_LABELS, demand.status) && validDates(state, demand) && validStory(state, demand);
}

/** Refuses a forged record, a second open demand in a family, and a demand story with no record. Called from validateCourt when a save loads. */
export function validateFamilyDemands(state) {
  if (!state.familyDemands.every((demand) => validDemand(state, demand))) throw new Error(INVALID);
  const ids = new Set(state.familyDemands.map((demand) => demand.id)), open = openDemands(state);
  const unique = ids.size === state.familyDemands.length && new Set(open.map((demand) => demand.familyId)).size === open.length;
  const told = state.stories.every((story) => story.type !== 'family_demand' || ids.has(story.demandId));
  if (!unique || !told) throw new Error(INVALID);
}
