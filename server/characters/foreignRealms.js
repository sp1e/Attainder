import { addGameMonths, compareGameDates, gameDateYear, normalizeGameDate } from '../gameDates.js';
import { getCharacterAge } from './characterCapacity.js';
import { hashRoll } from './duels.js';
import { isMarried } from './marriage.js';
import { presentClaim, validClaimFields } from './claims.js';

// Foreign realms live beside the court (spec docs/superpowers/specs/2026-11-10-foreign-realms-design.md). Historical campaigns only.
// Each realm keeps its ruling family from the package court seed. Foreign people never enter state.people. Rolls are hashRoll; nothing draws from a stream.
export const FOREIGN = Object.freeze({ realms: 8, neighborKm: 2500, people: 16, peopleLimit: 64, birth: 0.2, marriage: 0.2, successorAge: 35, opinion: 100 });
const DEATH_BY_AGE = [[16, 0.01], [40, 0.015], [60, 0.03], [70, 0.07], [80, 0.14], [Infinity, 0.3]];
const EARTH_KM = 6371;
const clampOpinion = (value) => Math.max(-FOREIGN.opinion, Math.min(FOREIGN.opinion, value));
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function distanceKm([lon1, lat1], [lon2, lat2]) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return Math.round(2 * EARTH_KM * Math.asin(Math.sqrt(a)));
}

function seedRealm(h, court, home) {
  const polity = h.polities.find((entry) => entry.id === court.polityId);
  const seat = h.settlements.find((entry) => entry.id === court.seatId);
  const house = court.people.find((person) => person.id === court.rulerId).familyId;
  // The ruler always, and the documented members of the ruler's family.
  const members = court.people.filter((person) => person.id === court.rulerId || (person.familyId === house && person.identityOrigin !== 'generated'));
  const ids = new Set(members.map((person) => person.id));
  const people = Object.fromEntries(members.map(({ id, name, sex, bornAt, identityOrigin, legalParentIds = [], spouseIds = [] }) => [id,
    { id, name, sex, bornAt, diedAt: null, parentIds: legalParentIds.filter((other) => ids.has(other)), spouseIds: spouseIds.filter((other) => ids.has(other)),
      origin: identityOrigin === 'generated' ? 'generated' : 'documented' }]));
  return { id: court.polityId, name: polity?.nameSv ?? court.polityId, successionLaw: court.successionLaw ?? 'primogeniture', seatName: seat?.nameSv ?? null,
    distanceKm: home && seat ? distanceKm(home.coordinates, seat.coordinates) : null, rulerId: court.rulerId, people, sequence: 0, memories: [] };
}

/** The eight nearest other courts of the package, as state.foreignRealms. Reads only; called before the package is narrowed. */
export function seedForeignRealms(h, polityId) {
  const homeCourt = h.courtSeeds[polityId];
  const home = h.settlements.find((entry) => entry.id === homeCourt?.seatId);
  return Object.values(h.courtSeeds).filter((court) => court.polityId !== polityId).map((court) => seedRealm(h, court, home))
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || a.id.localeCompare(b.id)).slice(0, FOREIGN.realms);
}

const living = (realm) => Object.values(realm.people).filter((person) => !person.diedAt);
const deathChance = (age) => DEATH_BY_AGE.find(([below]) => age < below)[1];
const livingSpouse = (realm, person) => person.spouseIds.map((id) => realm.people[id]).find((spouse) => spouse && !spouse.diedAt) ?? null;
const byAge = (a, b) => compareGameDates(a.bornAt, b.bornAt) || a.id.localeCompare(b.id);

/** Who takes the crown after `ruler`: by the realm's law, then the eldest living adult man; null when no one qualifies. Reads only. */
export function foreignHeir(realm, ruler, date) {
  const others = living(realm).filter((person) => person.id !== ruler.id).sort(byAge);
  const children = others.filter((person) => person.parentIds.includes(ruler.id));
  const lawful = realm.successionLaw === 'primogeniture' ? [...children.filter((p) => p.sex === 'male'), ...children.filter((p) => p.sex === 'female')] : [];
  return lawful[0] ?? others.find((person) => person.sex === 'male' && getCharacterAge(person, date) >= 16) ?? null;
}

// A generated name points at a documented person only, so names never nest: "Dotter till Harun ar-Rashid", "Dotter (Kyrkostaten, född 842)".
const relationName = (relation, anchor, realm, bornAt) => (anchor?.origin === 'documented' ? `${relation} till ${anchor.name}` : `${relation} (${realm.name}, född ${gameDateYear(bornAt)})`);

function born(realm, { relation, anchor, ...fields }) {
  const person = { id: `${realm.id}-born-${++realm.sequence}`, name: relationName(relation, anchor, realm, fields.bornAt), diedAt: null, parentIds: [], spouseIds: [], origin: 'generated', ...fields };
  realm.people[person.id] = person;
  return person;
}

function marry(realm, ruler) {
  const spouse = born(realm, { relation: 'Gemål', anchor: ruler, sex: ruler.sex === 'male' ? 'female' : 'male', bornAt: addGameMonths(ruler.bornAt, ruler.sex === 'male' ? 60 : -24), spouseIds: [ruler.id] });
  ruler.spouseIds.push(spouse.id);
}

function birth(state, realm, mother) {
  const father = livingSpouse(realm, mother), roll = hashRoll(`${state.plotRngState}|${state.date}|foreign|${realm.id}|${mother.id}|sex`);
  const sex = roll < 0.5 ? 'female' : 'male', parent = realm.people[realm.rulerId]?.id === mother.id ? mother : father;
  born(realm, { relation: sex === 'female' ? 'Dotter' : 'Son', anchor: parent, sex, bornAt: state.date, parentIds: [mother.id, father.id] });
}

function succeed(state, realm, events, hooks) {
  const dead = realm.people[realm.rulerId];
  const heir = foreignHeir(realm, dead, state.date) ?? born(realm, { relation: 'Efterträdare', anchor: dead, sex: 'male', bornAt: addGameMonths(state.date, -12 * FOREIGN.successorAge) });
  realm.rulerId = heir.id;
  hooks.logEvent(events, 'foreign_succession', `${heir.name} tar makten i ${realm.name}`, `${dead.name} är död. ${heir.name} styr nu ${realm.name}.`, []);
}

function prune(realm) {
  const parents = new Set(living(realm).flatMap((person) => person.parentIds));
  const gone = Object.values(realm.people).filter((person) => person.diedAt && person.id !== realm.rulerId && !parents.has(person.id))
    .sort((a, b) => compareGameDates(a.diedAt, b.diedAt) || a.id.localeCompare(b.id));
  while (Object.keys(realm.people).length > FOREIGN.people && gone.length) delete realm.people[gone.shift().id];
}

function realmYear(state, realm, events, hooks) {
  const roll = (person, what) => hashRoll(`${state.plotRngState}|${state.date}|foreign|${realm.id}|${person.id}|${what}`);
  const age = (person) => getCharacterAge(person, state.date);
  for (const person of living(realm)) if (roll(person, 'death') < deathChance(age(person))) person.diedAt = state.date;
  const ruler = realm.people[realm.rulerId];
  if (!ruler.diedAt && realm.successionLaw !== 'elective' && age(ruler) >= 16 && age(ruler) <= 50 && !livingSpouse(realm, ruler) && roll(ruler, 'marriage') < FOREIGN.marriage) marry(realm, ruler);
  const mothers = living(realm).filter((person) => person.sex === 'female' && age(person) >= 16 && age(person) <= 44 && livingSpouse(realm, person));
  for (const mother of mothers) if (Object.keys(realm.people).length < FOREIGN.people && roll(mother, 'birth') < FOREIGN.birth) birth(state, realm, mother);
  if (ruler.diedAt) succeed(state, realm, events, hooks);
  prune(realm);
}

/** The yearly life of the foreign realms: deaths, marriages, births and successions. */
export function foreignRealmStep(state, events, hooks) {
  if (!state.historicalOrigin) return;
  for (const realm of state.foreignRealms) realmYear(state, realm, events, hooks);
}

/** The realm's opinion of the player's realm: its live memories summed, held to -100..100. Reads only. */
export function foreignOpinion(state, realmId) {
  const realm = state.foreignRealms?.find((entry) => entry.id === realmId);
  if (!realm) return 0;
  return clampOpinion(realm.memories.filter((entry) => compareGameDates(entry.until, state.date) > 0).reduce((sum, entry) => sum + entry.amount, 0));
}

/** The neighbors as the court tab shows them. Reads only. */
export function presentForeignRealms(state) {
  if (!state.historicalOrigin) return [];
  return state.foreignRealms.map((realm) => {
    const ruler = realm.people[realm.rulerId], heir = foreignHeir(realm, ruler, state.date);
    return { id: realm.id, name: realm.name, seatName: realm.seatName, distanceKm: realm.distanceKm, neighbor: realm.distanceKm != null && realm.distanceKm <= FOREIGN.neighborKm,
      rulerName: ruler.name, rulerAge: getCharacterAge(ruler, state.date), heirName: heir?.name ?? null, opinion: foreignOpinion(state, realm.id), allied: Boolean(realm.alliance), ...presentClaim(realm) };
  });
}

/** Saves from before foreign realms: an empty list in historical campaigns, nothing in Hadara. */
export function ensureForeignRealms(state) {
  if (state.historicalOrigin && !Object.hasOwn(state, 'foreignRealms')) state.foreignRealms = [];
}

function validPerson(person, id) {
  return plain(person) && person.id === id && typeof person.name === 'string' && ['male', 'female'].includes(person.sex) && normalizeGameDate(person.bornAt) === person.bornAt
    && (person.diedAt === null || normalizeGameDate(person.diedAt) === person.diedAt) && Array.isArray(person.parentIds) && Array.isArray(person.spouseIds);
}

const bornNumber = (realm, id) => (id.startsWith(`${realm.id}-born-`) ? Number(id.slice(realm.id.length + 6)) : 0);

function validRealm(realm) {
  if (!plain(realm) || typeof realm.id !== 'string' || typeof realm.name !== 'string' || typeof realm.successionLaw !== 'string' || !plain(realm.people) || !Array.isArray(realm.memories)) return false;
  if ((realm.seatName !== null && typeof realm.seatName !== 'string') || (realm.distanceKm !== null && !Number.isFinite(realm.distanceKm)) || !Number.isInteger(realm.sequence) || realm.sequence < 0) return false;
  const people = Object.entries(realm.people);
  return people.length <= FOREIGN.peopleLimit && people.every(([id, person]) => validPerson(person, id) && !(bornNumber(realm, id) > realm.sequence)) && plain(realm.people[realm.rulerId])
    && realm.memories.every((entry) => plain(entry) && typeof entry.label === 'string' && Number.isFinite(entry.amount) && normalizeGameDate(entry.until) === entry.until);
}

// An alliance (marriage-alliance spec) names a married couple at court and its start.
const validAlliance = (state, alliance) => alliance == null || (plain(alliance) && normalizeGameDate(alliance.since) === alliance.since
  && [alliance.personId, alliance.spouseId].every((id) => typeof id === 'string' && Object.hasOwn(state.people, id))
  && isMarried(state.people[alliance.personId], state.people[alliance.spouseId]));

export function validateForeignRealms(state) {
  if (!Object.hasOwn(state, 'foreignRealms')) return;
  const realms = state.foreignRealms;
  if (!state.historicalOrigin || !Array.isArray(realms) || realms.length > FOREIGN.realms || !realms.every(validRealm)
    || !realms.every((realm) => validAlliance(state, realm.alliance) && validClaimFields(realm)) || new Set(realms.map((realm) => realm.id)).size !== realms.length) throw new Error('Sparfilens grannriken är ogiltiga.');
}
