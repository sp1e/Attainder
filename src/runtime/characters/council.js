import { addGameMonths, compareGameDates } from '../gameDates.js';
import { PRECISION_BANDS, precisionFor } from './actionOdds.js';
import { spymasterOf } from './extensions.js';

// The council: chancellor, general and spymaster. Service turns a councillor's hidden loyalty into what the seat gives the realm, and the player reads loyalty only through the spymaster.
// `hooks` are the engine's (actionHooks in index.js). Nothing here draws randomness. Only loyaltyDriftStep, chancellorStep and rewardCouncillor write to the state.
// An NPC's ambition is derived on every read and never stored: { ...copy(p) } copies every person field into view.people.

export const COUNCIL_SEATS = Object.freeze(['chancellor', 'general', 'spymaster']);

const SERVICE = Object.freeze({ opinionWeight: 0.3, dutiful: 10, ambitious: 5, faithful: 70, reliable: 50, reluctant: 30 });
const INTRIGUE_FACTOR = Object.freeze({ reluctant: 0.75, unreliable: 0.5 });
const DRIFT = Object.freeze({ warmOpinion: 20, warm: 1, coldOpinion: -20, cold: -2, grievance: -10, aggrieved: -1 });
const YIELD = Object.freeze({ divisor: 25, max: 12 });
const REWARD = Object.freeze({ silver: 20, orders: 1, tag: 'generous', loyalty: 8, months: 12 });
const THRONE_INFLUENCE = 50;
const SERVICE_DISPLAY = Object.freeze({ min: 5, max: 95 });
const PRECISION_ORDER = Object.freeze(['three', 'five', 'exact']);
const LOYALTY_LABELS = Object.freeze({
  five: Object.freeze(['mycket svag', 'svag', 'jämn', 'stark', 'mycket stark']),
  three: Object.freeze(['svag', 'oviss', 'stark']),
});
const AMBITION_LABELS = Object.freeze({ throne: 'Tronen', office: 'Ett ämbete', city: 'En stad', wealth: 'Rikedom', security: 'Trygghet' });
const REFUSALS = Object.freeze({ seat: 'Välj ett av rådets ämbeten.', vacant: 'Ämbetet är vakant.', ruler: 'Härskaren kan inte belöna sig själv.', recent: 'Rådsmedlemmen belönades nyligen.' });

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value) => (Number.isFinite(value) ? value : 0);
const hasTrait = (person, trait) => Array.isArray(person.traits) && person.traits.includes(trait);

// The living holder of a seat. A dead holder leaves the seat vacant.
function seatHolder(state, officeId) {
  const person = state.people[state.offices[officeId]?.holderId];
  return person && !person.diedAt ? person : null;
}

const isRuler = (person, hooks) => person.id === hooks.ruler()?.id;

// A crowned councillor keeps the seat. The engine's opinion of oneself is 100, which says nothing of how she serves, so the ruler counts 0.
function opinionOfRuler(person, hooks) {
  const ruler = hooks.ruler();
  return ruler && !isRuler(person, hooks) ? hooks.getPersonalOpinion(person.id, ruler.id) : 0;
}

/** How well a seat's holder serves, 0..100, or null when the seat is vacant. */
export function serviceOf(state, officeId, hooks) {
  const person = seatHolder(state, officeId);
  if (!person) return null;
  const temper = (hasTrait(person, 'dutiful') ? SERVICE.dutiful : 0) - (hasTrait(person, 'ambitious') ? SERVICE.ambitious : 0);
  return clamp(Math.round(person.loyalty + opinionOfRuler(person, hooks) * SERVICE.opinionWeight + temper), 0, 100);
}

export function serviceTier(service) {
  if (service >= SERVICE.faithful) return 'trogen';
  if (service >= SERVICE.reliable) return 'pålitlig';
  return service >= SERVICE.reluctant ? 'motvillig' : 'opålitlig';
}

// Service of 50 or more leaves intrigue alone, so Phase 2's numbers hold. So does holding no council seat.
function intrigueFactor(service) {
  if (service === null || service >= SERVICE.reliable) return 1;
  return service >= SERVICE.reluctant ? INTRIGUE_FACTOR.reluctant : INTRIGUE_FACTOR.unreliable;
}

/** The intrigue a person brings to the crown's watch: their own, scaled down when they hold a council seat and serve below 50. */
export function effectiveIntrigue(state, person, hooks) {
  const officeId = COUNCIL_SEATS.find((id) => seatHolder(state, id)?.id === person.id);
  const service = officeId ? serviceOf(state, officeId, hooks) : null;
  return Math.floor(finite(person.skills?.intrigue) * intrigueFactor(service));
}

/** The intrigue behind every reading of loyalty: the spymaster's effective intrigue, else half the representative's, rounded down. */
export function readerIntrigue(state, hooks) {
  const spymaster = spymasterOf(state);
  if (spymaster) return effectiveIntrigue(state, spymaster, hooks);
  return Math.floor(finite(hooks.activeRepresentative()?.skills?.intrigue) / 2);
}

export function loyaltyPrecision(state, hooks) {
  return precisionFor(readerIntrigue(state, hooks));
}

/** Loyalty in words, or as a number at 'exact'. The bands are the odds bands; values above their top of 95 land in the top band, so a band always contains the true value. */
export function loyaltyLabel(value, precision) {
  if (precision === 'exact') return `${value} av 100`;
  const index = PRECISION_BANDS[precision].findIndex((band) => value <= band.max);
  return LOYALTY_LABELS[precision].at(index);
}

/** The coarser of two precisions. */
export function capPrecision(a, b) {
  return PRECISION_ORDER[Math.min(PRECISION_ORDER.indexOf(a), PRECISION_ORDER.indexOf(b))];
}

/** A person's loyalty as the player may read it, or null for the representative. Reads only. */
export function presentLoyalty(state, person, hooks) {
  if (person.id === hooks.activeRepresentative()?.id) return null;
  const precision = loyaltyPrecision(state, hooks);
  return { label: loyaltyLabel(person.loyalty, precision), precision };
}

function holdsFewerCities(state, family) {
  const cities = Object.values(state.cities);
  const held = (familyId) => cities.filter((city) => city.familyId === familyId).length;
  return Object.keys(state.families).some((familyId) => held(familyId) > held(family.id));
}

/** What a person wants most, as an id of AMBITION_LABELS: the first match of throne, office, city, wealth and security. Derived on every read. */
export function ambitionOf(state, person, hooks) {
  const family = state.families[person.familyId], ambitious = hasTrait(person, 'ambitious');
  if (ambitious && !isRuler(person, hooks) && finite(family?.influence) >= THRONE_INFLUENCE && opinionOfRuler(person, hooks) <= 0) return 'throne';
  const holdsOffice = Object.values(state.offices).some((office) => office.holderId === person.id);
  if (!holdsOffice && (ambitious || person.goal?.type === 'office')) return 'office';
  if (family?.headId === person.id && holdsFewerCities(state, family)) return 'city';
  return hasTrait(person, 'greedy') ? 'wealth' : 'security';
}

/** The year's drift for each living councillor, once each: warmth toward the ruler raises loyalty; coldness and the family's grievance lower it. */
export function loyaltyDriftStep(state, hooks) {
  const holders = new Set(COUNCIL_SEATS.map((id) => seatHolder(state, id)).filter(Boolean));
  for (const person of holders) {
    const opinion = opinionOfRuler(person, hooks), grievance = finite(state.families[person.familyId]?.grievance);
    const drift = (opinion >= DRIFT.warmOpinion ? DRIFT.warm : opinion <= DRIFT.coldOpinion ? DRIFT.cold : 0) + (grievance <= DRIFT.grievance ? DRIFT.aggrieved : 0);
    person.loyalty = clamp(person.loyalty + drift, 0, 100);
  }
}

/** The year's gain or loss from the chancellor's service, in silver. 0 when the seat is vacant. */
export function chancellorYield(state, hooks) {
  const chancellor = seatHolder(state, 'chancellor');
  if (!chancellor) return 0;
  const amount = Math.round((finite(chancellor.skills?.stewardship) * (serviceOf(state, 'chancellor', hooks) - SERVICE.reliable)) / YIELD.divisor);
  return clamp(amount, -YIELD.max, YIELD.max) + 0; // `+ 0` turns the −0 of a small loss into 0
}

/** Pays the yield into the realm treasury with no event, so no log line reveals its sign. */
export function chancellorStep(state, hooks) {
  state.realm.treasury = Math.round(Math.max(0, state.realm.treasury + chancellorYield(state, hooks)) * 100) / 100;
}

/** The reward_councillor command: realm silver for loyalty, once a year per councillor. The caller has checked the mandate. The public event names the councillor and nothing of the loyalty. */
export function rewardCouncillor(state, officeId, events, hooks) {
  if (!COUNCIL_SEATS.includes(officeId)) throw new Error(REFUSALS.seat);
  const person = seatHolder(state, officeId);
  if (!person) throw new Error(REFUSALS.vacant);
  if (isRuler(person, hooks)) throw new Error(REFUSALS.ruler);
  const cooldown = person.cooldowns.council_reward;
  if (cooldown && compareGameDates(cooldown, state.date) > 0) throw new Error(REFUSALS.recent);
  hooks.charge(REWARD.silver, { publicFunds: true, orders: REWARD.orders, tag: REWARD.tag });
  person.loyalty = clamp(person.loyalty + REWARD.loyalty, 0, 100);
  person.cooldowns.council_reward = addGameMonths(state.date, REWARD.months);
  hooks.logEvent(events, 'councillor_rewarded', `${person.name} belönades`, `${person.name} fick en belöning ur statskassan.`, [person.id, hooks.ruler()?.id]);
}

/** The filled seats as `{ id, name }`, for the reward command's office field. */
export function filledSeats(state) {
  return COUNCIL_SEATS.filter((id) => seatHolder(state, id)).map((id) => ({ id, name: `${state.offices[id].name} · ${seatHolder(state, id).name}` }));
}

function presentSeat(state, officeId, precision, hooks) {
  const holder = seatHolder(state, officeId);
  const service = holder ? clamp(serviceOf(state, officeId, hooks), SERVICE_DISPLAY.min, SERVICE_DISPLAY.max) : null;
  return { officeId, name: state.offices[officeId].name, holderId: holder?.id ?? null, holderName: holder?.name ?? 'Vakant', serviceLabel: holder ? loyaltyLabel(service, precision) : null };
}

function presentAmbitions(state, hooks) {
  const ownFamilyId = hooks.controlledFamily()?.id;
  const heads = Object.values(state.families).filter((family) => family.id !== ownFamilyId).map((family) => state.people[family.headId]);
  return heads.filter((head) => head && !head.diedAt).map((head) => ({ personId: head.id, name: head.name, ambitionLabel: AMBITION_LABELS[ambitionOf(state, head, hooks)] }));
}

/** The council as the player sees it: the seats at the reader's precision, and the ambitions of the other houses' heads at five bands or better. Reads only. */
export function presentCouncil(state, hooks) {
  const precision = loyaltyPrecision(state, hooks);
  return { seats: COUNCIL_SEATS.map((officeId) => presentSeat(state, officeId, precision, hooks)), ambitions: precision === 'three' ? [] : presentAmbitions(state, hooks) };
}
