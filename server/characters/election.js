import { compareGameDates, formatGameDate, gameDateYear, shiftGameYear } from '../gameDates.js';
import { SKILL_LABELS, SUCCESSION_LAWS, publicPersonOrigin } from './content.js';
import { isAdultCharacter } from './characterCapacity.js';
import { ensurePortraitIdentity } from './portraitState.js';

export const ELECTION_REASON_SV = 'Valet föll på en person utanför hovet';
const ELECTION_NOTE_SV = 'Personen valdes i simuleringen när hovet saknade behöriga vuxna.';

/** Children the ruler adopted, from the adoption memory (participants: adopter, child). */
function adoptedBy(state, rulerId) {
  return new Set((state.memories || []).filter((m) => m.type === 'adoption' && m.participants?.[0] === rulerId).map((m) => m.participants[1]));
}

/**
 * The old ruler's spouse and every other legal parent of the old ruler's legal children, living or dead.
 * A child the ruler adopted adds nobody: the adoption does not marry its parents into the house.
 */
export function marriedIn(state, oldRuler) {
  const ids = new Set();
  if (!oldRuler) return ids;
  if (oldRuler.spouseId) ids.add(oldRuler.spouseId);
  const adopted = adoptedBy(state, oldRuler.id);
  for (const person of Object.values(state.people || {})) {
    if (person.legalParentIds?.includes(oldRuler.id) && !adopted.has(person.id)) for (const id of person.legalParentIds) ids.add(id);
  }
  ids.delete(oldRuler.id);
  return ids;
}

/**
 * Elective order: adults of the old ruler's house by merit, then its minors eldest first,
 * then every other adult by merit. The old ruler's legal children count as the house whatever
 * their family. Married-in persons stand with the outsiders. Draws nothing.
 */
export function electiveCandidates(state, oldRuler, people, score) {
  const outside = marriedIn(state, oldRuler);
  const byScore = (a, b) => score(b) - score(a) || a.id.localeCompare(b.id);
  const byAge = (a, b) => compareGameDates(a.bornAt, b.bornAt) || a.id.localeCompare(b.id);
  const isKin = (p) => p.legalParentIds?.includes(oldRuler.id) || (p.familyId === oldRuler.familyId && !outside.has(p.id));
  const kin = oldRuler ? people.filter(isKin) : [];
  const kinIds = new Set(kin.map((p) => p.id));
  const adults = kin.filter((p) => isAdultCharacter(p, state.date));
  const minors = kin.filter((p) => !isAdultCharacter(p, state.date));
  const others = people.filter((p) => !kinIds.has(p.id) && isAdultCharacter(p, state.date));
  return [...adults.sort(byScore), ...minors.sort(byAge), ...others.sort(byScore)];
}

/** The legislator's reform cycle; an unknown law restarts at primogeniture. */
export function nextSuccessionLaw(law) {
  const index = SUCCESSION_LAWS.indexOf(law);
  return index < 0 ? 'primogeniture' : SUCCESSION_LAWS[(index + 1) % SUCCESSION_LAWS.length];
}

const electionCount = (state) => (state.offices.ruler?.history || []).filter((entry) => entry.reason === ELECTION_REASON_SV).length + 1;

function electeeRecord(state, id, familyId, n, oldRuler) {
  const date = state.date;
  return {
    id, name: `Vald härskare ${n} (genererad)`, familyId,
    bornAt: formatGameDate({ year: shiftGameYear(gameDateYear(date), -40), month: 1, day: 1 }), diedAt: null,
    sex: oldRuler?.sex || 'male', culture: oldRuler?.culture, religionId: oldRuler?.religionId,
    originLabelSv: 'Genererad person', traits: ['dutiful'], archetype: 'steward',
    skills: Object.fromEntries(Object.keys(SKILL_LABELS).map((key) => [key, 5])),
    stress: 0, health: 100, wealth: 30, loyalty: 60, fear: 0,
    biologicalParentIds: [], legalParentIds: [], spouseId: null, mentorId: null, education: null,
    goal: { type: 'security', since: date, progress: 0 }, lastBirthAt: null, lastDecision: null, cooldowns: {},
    healthConditions: [],
  };
}

/** Writes one generated person and one family for an election with nobody at court. No events, no draws. */
export function electOutsider(state, oldRuler) {
  const n = electionCount(state);
  const id = `person-${++state.sequence}`, familyId = `family-${++state.sequence}`;
  const person = electeeRecord(state, id, familyId, n, oldRuler);
  if (state.historicalOrigin) {
    person.identityOrigin = 'generated';
    const claim = { status: 'generated', noteSv: ELECTION_NOTE_SV, sourceIds: [] };
    person.historicalOrigin = publicPersonOrigin({ identityOrigin: 'generated', originLabelSv: person.originLabelSv, claims: { identity: claim, bornAt: claim, kinship: claim, mechanics: claim } });
  }
  state.families[familyId] = {
    id: familyId, name: `Valt hus ${n} (genererat)`, color: '#8b7961', religionId: person.religionId, headId: id,
    guardianId: null, treasury: 110, estates: 2, influence: 45, grievance: 0, exiled: false,
    hostFamilyId: null, claims: [], cooldowns: {},
  };
  ensurePortraitIdentity(person, state.people);
  state.people[id] = person;
  return person;
}
