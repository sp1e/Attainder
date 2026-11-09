import { formatGameDate, gameDateYear, shiftGameYear } from '../gameDates.js';
import { ARCHETYPES } from './content.js';
import { getCharacterAge } from './characterCapacity.js';
import { ensurePortraitIdentity } from './portraitState.js';
import { generatedAdultRecord, markGeneratedOrigin } from './election.js';
import { hasLivingSpouse } from './marriage.js';

const GENERATED_HOUSE = /^Hovhus (\d+) \(genererat\)$/;

function seeded(value) { let n = 2166136261; for (const c of value) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return n >>> 0 || 1; }
const count = (value) => Number.isInteger(value) && value >= 0;

function highestGeneratedHouse(state) {
  let highest = 0;
  for (const family of Object.values(state.families || {})) {
    const match = GENERATED_HOUSE.exec(family?.name ?? '');
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return highest;
}

/** Neutral migration for historical courts: derives the lineage stream from the main stream and draws nothing. */
export function ensureLineageState(state) {
  if (!state.historicalOrigin) return state;
  if (!Object.hasOwn(state, 'lineageRngState')) state.lineageRngState = seeded(`${state.rngState}:${state.identity.polityId}:lineage-v1`);
  if (!Object.hasOwn(state, 'courtRenewal')) state.courtRenewal = { newcomers: 0, spouses: 0, houses: highestGeneratedHouse(state) };
  return state;
}

export function validateLineageState(state) {
  if (Object.hasOwn(state, 'lineageRngState')) {
    const value = state.lineageRngState;
    if (!Number.isInteger(value) || value < 1 || value > 0xffffffff) throw new Error('Släktlinjernas slumptillstånd är ogiltigt.');
  }
  if (Object.hasOwn(state, 'courtRenewal')) {
    const counters = state.courtRenewal;
    const plainObject = counters !== null && typeof counters === 'object' && Object.getPrototypeOf(counters) === Object.prototype;
    if (!plainObject || !count(counters.newcomers) || !count(counters.spouses) || !count(counters.houses)) throw new Error('Hovets förnyelseräknare är ogiltiga.');
  }
}

/** Separate xorshift stream for court renewal. Same algorithm as plotRandom but it only ever touches state.lineageRngState. */
export function lineageRandom(state) { let n = state.lineageRngState | 0; n ^= n << 13; n ^= n >>> 17; n ^= n << 5; state.lineageRngState = n >>> 0 || 1; return state.lineageRngState / 4294967296; }

export const COURT_FLOOR = 6;
const NEWCOMER_ARCHETYPES = Object.keys(ARCHETYPES).filter((key) => key !== 'legislator');
// The generated-house palette of server/seed/historical/dossier-courts.mjs, copied.
const HOUSE_COLORS = ['#93594d', '#567b82', '#776c91'];
const NEWCOMER_NOTE_SV = 'Spelet skapade personen när hovet behövde fler vuxna.';
const HOUSE_DEFAULTS = { treasury: 110, estates: 2, influence: 45 };

/** Living persons aged 18 or more whose family is not in exile, by id. */
export function courtAdults(state) {
  return Object.values(state.people || {})
    .filter((person) => !person.diedAt && getCharacterAge(person, state.date) >= 18 && !state.families[person.familyId]?.exiled)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function courtReligion(state) {
  const ruler = state.people[state.offices.ruler?.holderId];
  return ruler && !ruler.diedAt ? ruler.religionId : Object.keys(state.religions).sort()[0];
}

/** The smallest treasury, estates and influence among families at court; the defaults when every family is in exile. */
function poorestHouse(state) {
  const present = Object.values(state.families).filter((family) => !family.exiled);
  if (!present.length) return { ...HOUSE_DEFAULTS };
  return Object.fromEntries(Object.keys(HOUSE_DEFAULTS).map((key) => [key, Math.min(...present.map((family) => family[key]))]));
}

/** One generated adult heading a new house. Deterministic: draws nothing. */
function addNewcomer(state, events, hooks) {
  const m = ++state.courtRenewal.newcomers, k = ++state.courtRenewal.houses;
  const id = `person-${++state.sequence}`, familyId = `family-${++state.sequence}`;
  const religionId = courtReligion(state), resources = poorestHouse(state);
  const person = markGeneratedOrigin(state, generatedAdultRecord(state, {
    id, name: m % 2 ? `Hovman ${m} (genererad)` : `Hovdam ${m} (genererad)`, familyId,
    bornAt: formatGameDate({ year: shiftGameYear(gameDateYear(state.date), -25), month: 1, day: 1 }),
    sex: m % 2 ? 'male' : 'female', culture: 'Ej belagd', religionId,
    archetype: NEWCOMER_ARCHETYPES[(m - 1) % NEWCOMER_ARCHETYPES.length], skill: 5,
  }), NEWCOMER_NOTE_SV);
  ensurePortraitIdentity(person, state.people);
  const family = {
    id: familyId, name: `Hovhus ${k} (genererat)`, color: HOUSE_COLORS[(k - 1) % HOUSE_COLORS.length], religionId, headId: id,
    guardianId: null, ...resources, grievance: 0, exiled: false, hostFamilyId: null, claims: [], cooldowns: {},
  };
  state.families[familyId] = family;
  state.people[id] = person;
  hooks.logEvent(events, 'arrival', 'Ny person vid hovet', `${person.name} kommer till hovet som huvud för ${family.name}.`, [person.id]);
}

export const SPOUSE_CEILING = 12;
const SPOUSE_NOTE_SV = 'Spelet skapade personen som make eller maka.';
const SPOUSELESS_OFFICES = new Set(['ruler', 'priest']);

/** True when matchmaking could pair the person at court: a living single of the other sex aged 18 to 39 who is neither the representative nor close kin. */
function hasPartner(state, person, hooks, representativeId) {
  return Object.values(state.people).some((other) => {
    if (other.diedAt || other.id === person.id || other.id === representativeId || other.sex === person.sex) return false;
    const age = getCharacterAge(other, state.date);
    return age >= 18 && age <= 39 && !hasLivingSpouse(state, other) && !hooks.closeKin(person, other);
  });
}

/** A generated single aged 18 to 35, not the representative, outside the ruler and priest offices, with no partner at court. Draws nothing. */
function qualifiesForSpouse(state, person, hooks) {
  const age = getCharacterAge(person, state.date), representativeId = hooks.activeRepresentative()?.id;
  if (age < 18 || age > 35 || hasLivingSpouse(state, person) || person.id === representativeId) return false;
  if (Object.values(state.offices).some((office) => office.holderId === person.id && SPOUSELESS_OFFICES.has(office.kind))) return false;
  return !hasPartner(state, person, hooks, representativeId);
}

/** A generated spouse joining the person's family, married as matchmaking marries. Draws nothing. */
function addSpouse(state, person, events, hooks) {
  const g = ++state.courtRenewal.spouses, age = getCharacterAge(person, state.date);
  const wife = person.sex !== 'female', spouseAge = wife ? Math.max(18, age - 3) : age + 3;
  const spouse = markGeneratedOrigin(state, generatedAdultRecord(state, {
    id: `person-${++state.sequence}`, name: `Gemål ${g} (genererad)`, familyId: person.familyId,
    bornAt: formatGameDate({ year: shiftGameYear(gameDateYear(state.date), -spouseAge), month: 1, day: 1 }),
    sex: wife ? 'female' : 'male', culture: person.culture, religionId: person.religionId, archetype: 'steward', skill: 4,
  }), SPOUSE_NOTE_SV);
  ensurePortraitIdentity(spouse, state.people);
  state.people[spouse.id] = spouse;
  person.spouseId = spouse.id; spouse.spouseId = person.id;
  hooks.addBond(person.id, spouse.id, 'partner');
  hooks.logEvent(events, 'marriage', 'En ny familjeförbindelse', `${person.name} och ${spouse.name} gifter sig.`, [person.id, spouse.id]);
  hooks.memory('marriage', 'Äktenskap mellan familjer', [person.id, spouse.id]);
}

/** Each qualifying generated adult spends one lineage draw; below 0.25 a generated spouse arrives. Stops at SPOUSE_CEILING court adults. */
function spouseWalk(state, events, hooks) {
  const generated = Object.values(state.people).filter((person) => !person.diedAt && person.identityOrigin === 'generated').sort((a, b) => a.id.localeCompare(b.id));
  for (const person of generated) {
    if (courtAdults(state).length >= SPOUSE_CEILING) return;
    if (qualifiesForSpouse(state, person, hooks) && lineageRandom(state) < 0.25) addSpouse(state, person, events, hooks);
  }
}

export const COURT_BIRTH_CAP = 48;

/** True when a historical state has COURT_BIRTH_CAP or more living people, of any family and age. Hadara states never close. Draws nothing. */
export function birthsClosed(state) {
  if (!state.historicalOrigin) return false;
  let living = 0;
  for (const person of Object.values(state.people)) if (!person.diedAt) living++;
  return living >= COURT_BIRTH_CAP;
}

/** Yearly court renewal on a historical campaign: one newcomer when fewer than COURT_FLOOR adults remain at court, then generated spouses. */
export function courtRenewalStep(state, events, hooks) {
  if (!state.historicalOrigin || state.status.ended) return;
  if (courtAdults(state).length < COURT_FLOOR) addNewcomer(state, events, hooks);
  spouseWalk(state, events, hooks);
}
