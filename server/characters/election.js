import { compareGameDates, formatGameDate, gameDateYear, shiftGameYear } from '../gameDates.js';
import { SKILL_LABELS, SUCCESSION_LAWS, publicPersonOrigin } from './content.js';
import { isAdultCharacter } from './characterCapacity.js';
import { ensurePortraitIdentity } from './portraitState.js';
import { childIndex, descendantLine, houseMarriedIn } from './succession.js';

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
 * then every other adult by merit. The old ruler's descendants at any depth count as the house
 * whatever their family. Married-in persons stand with the outsiders: the old ruler's partners
 * and every house member who married a member of the ruler's blood line. Draws nothing.
 */
export function electiveCandidates(state, oldRuler, people, score) {
  const children = childIndex(state);
  const outside = new Set([...marriedIn(state, oldRuler), ...houseMarriedIn(state, oldRuler, children)]);
  const line = new Set(oldRuler ? descendantLine(state, oldRuler, children).map((p) => p.id) : []);
  const byScore = (a, b) => score(b) - score(a) || a.id.localeCompare(b.id);
  const byAge = (a, b) => compareGameDates(a.bornAt, b.bornAt) || a.id.localeCompare(b.id);
  const isKin = (p) => line.has(p.id) || (p.familyId === oldRuler.familyId && !outside.has(p.id));
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

/** A generated adult with no kin, every skill at `skill`. Writes nothing to state and draws nothing. */
export function generatedAdultRecord(state, { id, name, familyId, bornAt, sex, culture, religionId, archetype, skill }) {
  return {
    id, name, familyId, bornAt, diedAt: null, sex, culture, religionId,
    originLabelSv: 'Genererad person', traits: ['dutiful'], archetype,
    skills: Object.fromEntries(Object.keys(SKILL_LABELS).map((key) => [key, skill])),
    stress: 0, health: 100, wealth: 30, loyalty: 60, fear: 0,
    biologicalParentIds: [], legalParentIds: [], spouseId: null, mentorId: null, education: null,
    goal: { type: 'security', since: state.date, progress: 0 }, lastBirthAt: null, lastDecision: null, cooldowns: {},
    healthConditions: [],
  };
}

/** On a historical state, marks every claim about the person as generated with `noteSv`. A Hadara person is left as it is. */
export function markGeneratedOrigin(state, person, noteSv) {
  if (!state.historicalOrigin) return person;
  person.identityOrigin = 'generated';
  const claim = { status: 'generated', noteSv, sourceIds: [] };
  person.historicalOrigin = publicPersonOrigin({ identityOrigin: 'generated', originLabelSv: person.originLabelSv, claims: { identity: claim, bornAt: claim, kinship: claim, mechanics: claim } });
  return person;
}

function electeeRecord(state, id, familyId, n, oldRuler) {
  return generatedAdultRecord(state, {
    id, name: `Vald härskare ${n} (genererad)`, familyId,
    bornAt: formatGameDate({ year: shiftGameYear(gameDateYear(state.date), -40), month: 1, day: 1 }),
    sex: oldRuler?.sex || 'male', culture: oldRuler?.culture, religionId: oldRuler?.religionId,
    archetype: 'steward', skill: 5,
  });
}

/** Writes one generated person and one family for an election with nobody at court. No events, no draws. */
export function electOutsider(state, oldRuler) {
  const n = electionCount(state);
  const id = `person-${++state.sequence}`, familyId = `family-${++state.sequence}`;
  const person = markGeneratedOrigin(state, electeeRecord(state, id, familyId, n, oldRuler), ELECTION_NOTE_SV);
  state.families[familyId] = {
    id: familyId, name: `Valt hus ${n} (genererat)`, color: '#8b7961', religionId: person.religionId, headId: id,
    guardianId: null, treasury: 110, estates: 2, influence: 45, grievance: 0, exiled: false,
    hostFamilyId: null, claims: [], cooldowns: {},
  };
  ensurePortraitIdentity(person, state.people);
  state.people[id] = person;
  return person;
}
