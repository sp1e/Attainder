import { addGameMonths } from '../gameDates.js';
import { ENGINE_OFFICE_IDS, playablePolityKind, safeId, validateHistoricalCourt } from '../historicalScenarios.js';
import { ADULT_AGE, ARCHETYPES, TRAITS, SKILL_LABELS, SUCCESSION_LAWS, publicHistoricalOrigin, publicPersonOrigin, publicReligionOrigin } from './content.js';
import { completeCharacterState, createCharacterState, getCharacterAge, normalizeCharacterSystem } from './index.js';
import { spouseIdsOf } from './marriage.js';
import { seedForeignRealms } from './foreignRealms.js';
import { seedTribes } from './tribes.js';

const refusal = () => new Error('Det historiska hovets uppgifter kan inte användas av karaktärssystemet.');
const copy = value => JSON.parse(JSON.stringify(value));
const generatedClaim = noteSv => ({ status: 'generated', noteSv, sourceIds: [] });

function validateEngineSeed(court, familyId, polity) {
  // A non-state polity has no court the engine can rule.
  if (!polity || !playablePolityKind(polity)) throw refusal();
  for (const kind of ['people', 'families', 'religions', 'offices', 'cities']) {
    if (!court[kind].every(entry => safeId(entry.id))) throw refusal();
  }
  if (familyId && !court.families.some(family => family.id === familyId)) throw refusal();
  for (const person of court.people) {
    // The unchanged runtime allocator owns person-<number>; authored identities
    // must not be overwritten by a later birth using the shared sequence.
    if (/^person-\d+$/.test(person.id) || typeof person.name !== 'string' || !person.name.trim()
      || (person.sex !== undefined && !['female', 'male'].includes(person.sex))) throw refusal();
    const mechanics = person.mechanics;
    if (mechanics !== undefined && (!mechanics || !ARCHETYPES[mechanics.archetype]
      || !Array.isArray(mechanics.traits) || !mechanics.traits.length || mechanics.traits.some(trait => !TRAITS[trait])
      || Object.keys(SKILL_LABELS).some(key => !Number.isFinite(mechanics.skills?.[key]) || mechanics.skills[key] < 0))) throw refusal();
  }
  const people = new Map(court.people.map(person => [person.id, person]));
  const checked = new Set(), visiting = new Set();
  const checkParents = id => {
    if (visiting.has(id)) throw refusal();
    if (checked.has(id)) return;
    visiting.add(id);
    for (const parentId of people.get(id).legalParentIds) checkParents(parentId);
    visiting.delete(id); checked.add(id);
  };
  for (const person of court.people) checkParents(person.id);
  // Current engine supports its council roles and one generated governor per city.
  if (court.offices.some(office => !ENGINE_OFFICE_IDS.includes(office.id))) throw refusal();
  // The engine knows the laws in SUCCESSION_LAWS; null counts as a present value and is refused like the validator does.
  if (court.successionLaw !== undefined && !SUCCESSION_LAWS.includes(court.successionLaw)) throw refusal();
}

function seedPerson(authored, date) {
  const bornAt = authored.bornAt ?? addGameMonths(date, -30 * 12);
  const claims = { ...authored.claims };
  if (!authored.bornAt) claims.bornAt = generatedClaim('Födelsedatumet är ett genererat spelvärde eftersom en belagd uppgift saknas.');
  if (!authored.sex) claims.sex = generatedClaim('Könsuppgiften är ett genererat spelvärde eftersom en belagd uppgift saknas.');
  const mechanics = authored.mechanics ?? { archetype: 'steward', traits: ['dutiful'], skills: Object.fromEntries(Object.keys(SKILL_LABELS).map(key => [key, 5])) };
  const person = {
    id: authored.id, name: authored.name, familyId: authored.familyId, bornAt, diedAt: null,
    sex: authored.sex ?? 'male', culture: 'Ej belagd', religionId: authored.religionId,
    identityOrigin: authored.identityOrigin, originLabelSv: authored.originLabelSv,
    historicalOrigin: publicPersonOrigin({ ...authored, claims }),
    traits: [...mechanics.traits], archetype: mechanics.archetype, skills: Object.fromEntries(Object.keys(SKILL_LABELS).map(key => [key, mechanics.skills[key]])),
    stress: 0, health: 100, wealth: 30, loyalty: 60, fear: 0,
    biologicalParentIds: [], legalParentIds: [...authored.legalParentIds], spouseId: authored.spouseIds[0] ?? null,
    mentorId: null, education: null, goal: { type: 'security', since: date, progress: 0 },
    lastBirthAt: null, lastDecision: null, cooldowns: {},
  };
  if (authored.spouseIds.length > 1) person.otherSpouseIds = authored.spouseIds.slice(1);
  if (getCharacterAge(person, date) < ADULT_AGE) person.wealth = 0;
  return person;
}

function seedCourt(state, court) {
  for (const authored of court.people) state.people[authored.id] = seedPerson(authored, state.date);
  for (const family of court.families) state.families[family.id] = {
    id: family.id, name: family.name || family.id, color: family.color || '#8b7961',
    religionId: family.religionId ?? state.people[family.headId].religionId, headId: family.headId,
    guardianId: null, treasury: 110, estates: 2, influence: 45, grievance: 0, exiled: false,
    hostFamilyId: null, claims: [], cooldowns: {},
  };
  for (const religion of court.religions) state.religions[religion.id] = { id: religion.id, name: religion.name || religion.id, support: 55, leaderId: religion.leaderId ?? null, historicalOrigin: publicReligionOrigin(religion),
    ...(typeof religion.tradition === 'string' && religion.tradition ? { tradition: religion.tradition } : {}) };
  for (const [id, name] of [['ruler', 'Härskare'], ['general', 'Överbefälhavare'], ['chancellor', 'Kansler'], ['priest', 'Religiös företrädare']]) {
    state.offices[id] = { id, name, kind: id, holderId: null, regentId: null, history: [], publicBudget: 30 };
  }
  for (const office of court.offices) state.offices[office.id] = {
    id: office.id, name: office.name || state.offices[office.id]?.name || 'Spionmästare', kind: office.id,
    holderId: office.holderId, regentId: null, history: [{ personId: office.holderId, date: state.date, reason: 'Kampanjstart' }], publicBudget: 30,
  };
  for (const city of court.cities) {
    const governorOfficeId = `governor:${city.id}`;
    if (!safeId(governorOfficeId)) throw refusal();
    state.cities[city.id] = { id: city.id, name: city.name || city.id, regionId: city.regionId, familyId: city.familyId, baseRevenue: 18, infrastructure: 0, unrest: 12, governorOfficeId };
    state.offices[governorOfficeId] = { id: governorOfficeId, name: `Guvernör: ${city.name || city.id}`, kind: 'governor', holderId: null, cityId: city.id, regentId: null, history: [], publicBudget: 30 };
  }
  for (const person of Object.values(state.people)) for (const spouseId of spouseIdsOf(person)) state.relations[`${person.id}:${spouseId}`] = { fromId: person.id, toId: spouseId, bonds: ['partner'], causes: [] };
}

/** Pure conversion of validated authored content; never reads assets or starts a game. */
export function createHistoricalCharacterSystem({ historicalScenario, date, polityId, mode = 'realm', familyId, seed, difficulty } = {}) {
  try {
    const checked = validateHistoricalCourt(historicalScenario, { date, polityId });
    if (!checked.ok || !safeId(polityId) || !['realm', 'family'].includes(mode)) throw refusal();
    const h = historicalScenario, court = h.courtSeeds[polityId];
    const polity = h.polities.find(entry => entry.id === polityId);
    validateEngineSeed(court, familyId, polity);
    // A family start without a choice takes the family the start card preselects, the first one listed.
    const chosenFamily = familyId ?? (mode === 'family' ? court.families[0].id : court.people.find(person => person.id === court.rulerId).familyId);
    const state = createCharacterState({ date, polityId, polityName: polity.nameSv, mode, seed }, { familyId: chosenFamily, religions: {} });
    // Set before completeCharacterState so the opening heir claims follow the authored law; draws no randomness.
    state.realm.successionLaw = court.successionLaw ?? 'primogeniture';
    state.realm.kind = polity.kind ?? 'state';
    state.historicalOrigin = publicHistoricalOrigin({ ...h, polityNoteSv: polity.noteSv, mechanicsNoteSv: court.mechanics.noteSv });
    seedCourt(state, court);
    // Read before the package is narrowed to the chosen court; draws no randomness.
    state.foreignRealms = seedForeignRealms(h, polityId);
    state.tribes = seedTribes(h, polityId);
    completeCharacterState(state, difficulty);
    state.log.push({ id: `event-${++state.sequence}`, date, type: 'foundation', title: 'Det historiska hovet tar form',
      description: `${state.realm.name}. ${court.mechanics.noteSv}`, participants: [court.rulerId], public: true });
    return normalizeCharacterSystem(copy(state));
  } catch { throw refusal(); }
}
