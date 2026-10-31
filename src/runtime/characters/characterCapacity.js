import { astronomicalYear, compareGameDates, normalizeGameDate, parseGameDate } from '../gameDates.js';
import { ADULT_AGE } from './content.js';
import { healthStageAt } from './portraitState.js';

const PHYSICAL_CONDITIONS = new Set(['smallpox', 'fever', 'injury']);

export function getCharacterAge(person, date) {
  const birth = parseGameDate(person?.bornAt), now = parseGameDate(date);
  if (!birth || !now) return 0;
  const beforeBirthday = now.month < birth.month || (now.month === birth.month && now.day < birth.day);
  return Math.max(0, astronomicalYear(now.year) - astronomicalYear(birth.year) - (beforeBirthday ? 1 : 0));
}

// Adulthood remains a life/age rule. Illness must never change inheritance age.
export function isAdultCharacter(person, date) {
  return Boolean(person && !person.diedAt && getCharacterAge(person, date) >= ADULT_AGE);
}

export function getIncapacityCauseIds(person, date) {
  if (!person || person.diedAt || !normalizeGameDate(date)) return [];
  return (person.healthConditions || [])
    .filter((condition) => PHYSICAL_CONDITIONS.has(condition.kind) && condition.severity === 3 &&
      ['active', 'recovering'].includes(healthStageAt(condition, date)))
    .map((condition) => condition.id).sort();
}

export function canExerciseMandate(person, date) {
  return isAdultCharacter(person, date) && getIncapacityCauseIds(person, date).length === 0;
}

// Selection proposes a representative; it does not transfer office or property.
// Existing minority access rules remain unchanged apart from capacity.
export function selectMandateRegent(state, { principalId, scope, basis }) {
  const principal = state.people[principalId];
  if (!principal || principal.diedAt || !['royal', 'family'].includes(scope) || !['minority', 'incapacity'].includes(basis)) return null;
  const candidates = Object.values(state.people).filter((person) => {
    if (person.id === principalId || !canExerciseMandate(person, state.date)) return false;
    const family = state.families[person.familyId];
    if (!family) return false;
    if (basis === 'minority') return true;
    return !family.exiled || (scope === 'family' && person.familyId === principal.familyId);
  });
  candidates.sort((a, b) => Number(b.familyId === principal.familyId) - Number(a.familyId === principal.familyId) ||
    compareGameDates(a.bornAt, b.bornAt) || a.id.localeCompare(b.id));
  return candidates[0]?.id || null;
}
