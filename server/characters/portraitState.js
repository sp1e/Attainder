import { astronomicalYear, compareGameDates, parseGameDate } from '../gameDates.js';
import { FAMILY_SEEDS } from './content.js';

// Atlas order is a public asset contract: two six-column rows per age group.
export const PORTRAIT_STATES = Object.freeze(['healthy', 'smallpox', 'smallpox-recovering', 'smallpox-scars', 'fever', 'wounded', 'injury-recovering', 'injury-scars', 'frail', 'stressed', 'grieving', 'exiled']);
export const PORTRAIT_AGE_GROUPS = Object.freeze(['child', 'adult', 'elder']);
const SEED_IDENTITIES = Array.from({ length: 24 }, (_, index) => `person-${Math.floor(index / 6)}-${index % 6}`);
const PRIORITY = ['smallpox', 'wounded', 'fever', 'smallpox-recovering', 'injury-recovering', 'smallpox-scars', 'injury-scars', 'frail', 'stressed', 'grieving', 'exiled', 'healthy'];
const LABELS = { healthy: 'Inga tydliga hälsobesvär', smallpox: 'Smittkoppor', 'smallpox-recovering': 'Återhämtning efter smittkoppor', 'smallpox-scars': 'Bestående ärr efter smittkoppor', fever: 'Febersjukdom', wounded: 'Skadad', 'injury-recovering': 'Återhämtning efter skada', 'injury-scars': 'Bestående skadeärr', frail: 'Svag hälsa', stressed: 'Hög belastning', grieving: 'Sorg efter en närståendes död', exiled: 'Familjen lever i exil' };

function ageAt(person, date) {
  const birth = parseGameDate(person.bornAt), now = parseGameDate(date);
  if (!birth || !now) return 0;
  return Math.max(0, astronomicalYear(now.year) - astronomicalYear(birth.year) - (now.month < birth.month || (now.month === birth.month && now.day < birth.day) ? 1 : 0));
}
export function getPortraitAgeGroup(person, date) { const age = ageAt(person, person.diedAt || date); return age < 18 ? 'child' : age >= 60 ? 'elder' : 'adult'; }

function stableHash(value) { let hash = 2166136261; for (const char of String(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619); return hash >>> 0; }

export function getSharedPortraitIdentity(person, people = {}, seen = new Set()) {
  if (SEED_IDENTITIES.includes(person.portraitFallbackIdentityId)) return person.portraitFallbackIdentityId;
  if (SEED_IDENTITIES.includes(person.id)) return person.id;
  const familyIndex = FAMILY_SEEDS.findIndex((family) => family.id === person.familyId);
  if (familyIndex >= 0) return `person-${familyIndex}-${person.sex === 'male' ? 5 : 4}`;
  if (!seen.has(person.id)) {
    seen.add(person.id);
    const parent = (person.biologicalParentIds || []).map((id) => people[id]).find((candidate) => candidate?.sex === person.sex && !seen.has(candidate.id));
    if (parent) { const inherited = getSharedPortraitIdentity(parent, people, seen); if (Number(inherited.at(-1)) >= 2) return inherited; }
  }
  const candidates = SEED_IDENTITIES.filter((id) => Number(id.at(-1)) === (person.sex === 'male' ? 5 : 4));
  return candidates[stableHash(person.id) % candidates.length] || 'person-0-0';
}

export function ensurePortraitIdentity(person, people = {}) {
  person.portraitIdentityId ||= person.id;
  person.portraitFallbackIdentityId = getSharedPortraitIdentity(person, people);
  return person;
}

export function healthStageAt(condition, date) {
  if (compareGameDates(condition.startedAt, date) > 0) return null;
  const known = (condition.stageHistory || []).filter((entry) => compareGameDates(entry.date, date) <= 0);
  return known.at(-1)?.stage || condition.stage;
}

function conditionVisualState(condition, date) {
  const stage = healthStageAt(condition, date);
  if (!stage || stage === 'resolved') return null;
  if (condition.kind === 'smallpox') return stage === 'scarred' ? 'smallpox-scars' : stage === 'recovering' ? 'smallpox-recovering' : 'smallpox';
  if (condition.kind === 'injury') return stage === 'scarred' ? 'injury-scars' : stage === 'recovering' ? 'injury-recovering' : 'wounded';
  if (condition.kind === 'fever' && stage !== 'scarred') return 'fever';
  if (condition.kind === 'bereavement' && stage === 'active') return 'grieving';
  return null;
}

/** Pure: saved game facts determine candidates; asset availability is the UI's job. */
export function resolvePortraitState(person, date, { family } = {}) {
  if (!person) return null;
  const identityId = person.portraitIdentityId || person.id;
  const fallbackIdentityId = person.portraitFallbackIdentityId || getSharedPortraitIdentity(person);
  const portraitDate = person.diedAt || date;
  const frozen = person.diedAt && person.deathAppearance;
  const ageGroup = frozen?.ageGroup || getPortraitAgeGroup(person, portraitDate);
  let stateKeys = [];
  let reasons = [];
  if (frozen) { stateKeys = [...frozen.stateKeys]; reasons = [...frozen.reasons]; }
  else {
    for (const condition of person.healthConditions || []) {
      const key = conditionVisualState(condition, portraitDate);
      if (key) { stateKeys.push(key); reasons.push({ key, label: LABELS[key], conditionId: condition.id, since: condition.startedAt }); }
    }
    for (const [key, enabled] of [['frail', person.health <= 35], ['stressed', person.stress >= 60], ['exiled', family?.exiled]]) if (enabled) {
      stateKeys.push(key); reasons.push({ key, label: LABELS[key] });
    }
    if (!stateKeys.length) { stateKeys.push('healthy'); reasons.push({ key: 'healthy', label: LABELS.healthy }); }
  }
  stateKeys = [...new Set(stateKeys)].sort((a, b) => PRIORITY.indexOf(a) - PRIORITY.indexOf(b));
  const visualState = frozen?.visualState || stateKeys[0] || 'healthy';
  const expression = frozen?.expression || (stateKeys.includes('grieving') ? 'grieving' : stateKeys.includes('stressed') ? 'stressed' : stateKeys.some((key) => ['smallpox', 'wounded', 'fever', 'frail'].includes(key)) ? 'unwell' : 'composed');
  const context = frozen?.context || (family?.exiled ? 'exiled' : 'established');
  const variantKey = `${identityId}__${ageGroup}__${visualState}`;
  const candidateStates = [...new Set([visualState, ...stateKeys, 'healthy'])];
  const variantCandidates = [...new Set([identityId, fallbackIdentityId])].flatMap((id) => candidateStates.map((key) => `${id}__${ageGroup}__${key}`));
  return { identityId, fallbackIdentityId, usesSharedFallback: identityId !== fallbackIdentityId, ageGroup, visualState, stateKeys, expression, context, lifeStatus: person.diedAt ? 'deceased' : 'alive', variantKey, variantCandidates, reasons };
}

export function freezeDeathAppearance(person, date, family) {
  const { ageGroup, visualState, stateKeys, expression, context, reasons } = resolvePortraitState(person, date, { family });
  person.deathAppearance = { ageGroup, visualState, stateKeys, expression, context, reasons };
}
