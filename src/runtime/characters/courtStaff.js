import { addGameMonths, compareGameDates, normalizeGameDate } from '../gameDates.js';
import { NAME_POOL, SKILL_LABELS, TRAITS } from './content.js';

// Minor court staff (cook, guard captain, physician, steward, servant) live in state.courtStaff, keyed by their own id, and never in state.people. Succession, marriage, birth, death and the annual AI only walk state.people, so they cannot see staff. Nothing here draws from a random stream; the only counter spent is state.sequence, for the id.
export const STAFF_ROLES = Object.freeze({ cook: 'Kock', guard_captain: 'Vaktchef', physician: 'Läkare', steward: 'Hovmästare', servant: 'Tjänare' });

const STAFF_AGE_YEARS = 30;
const STAFF_LOYALTY = 55;
const BASE_SKILL = 3;
const SKILL_MAX = 20;
const SKILL_KEYS = Object.freeze(Object.keys(SKILL_LABELS));
// The one skill that stands out for each role, and the fixed trait list. Every other skill is BASE_SKILL.
const PROFILES = Object.freeze({
  cook: { skill: 'intrigue', value: 4, traits: ['greedy'] },
  guard_captain: { skill: 'prowess', value: 10, traits: ['brave'] },
  physician: { skill: 'learning', value: 10, traits: ['diligent'] },
  steward: { skill: 'stewardship', value: 9, traits: ['honest'] },
  servant: { skill: 'intrigue', value: 3, traits: ['craven'] },
});

// One Swedish sentence per failure class. ensureStaff and validateCourtStaff throw the same sentences.
const MESSAGES = {
  id: 'En hovtjänares id är ogiltigt eller stämmer inte med sin nyckel.',
  role: 'Hovtjänstens roll är okänd.',
  family: 'Hovtjänstens hushåll finns inte.',
  name: 'En hovtjänare saknar namn.',
  skills: 'En hovtjänare har ogiltiga färdigheter.',
  traits: 'En hovtjänare har ogiltiga egenskaper.',
  loyalty: 'En hovtjänare har ogiltig lojalitet.',
  date: 'En hovtjänares livsdatum är ogiltiga.',
  dup: 'Ett hushåll har två levande hovtjänare i samma roll.',
  collection: 'Karaktärstilläggens samlingar är ogiltiga.',
};

const plainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
// Own keys of a string only: a number, an array or an inherited name such as toString is never a role or household.
const ownKey = (table, key) => typeof key === 'string' && plainObject(table) && Object.hasOwn(table, key);
const inRange = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const canonical = (date) => typeof date === 'string' && Boolean(date) && normalizeGameDate(date) === date;
const onOrBefore = (date, limit) => canonical(date) && compareGameDates(date, limit) <= 0;
const alive = (staff) => !staff.diedAt;
const staffNumber = (id) => { const match = typeof id === 'string' ? /^staff-([1-9]\d*)$/.exec(id) : null; return match ? Number(match[1]) : null; };

/** Living staff of one household, in the order they were created. Unknown households have none. */
export function staffOf(state, familyId) {
  return plainObject(state.courtStaff) ? Object.values(state.courtStaff).filter((staff) => plainObject(staff) && staff.familyId === familyId && alive(staff)) : [];
}

/** The living staff member of that role in that household, or a new one. A new one spends one sequence number and no randomness. An unknown role or household throws before anything is spent. */
export function ensureStaff(state, familyId, role) {
  if (!ownKey(STAFF_ROLES, role)) throw new Error(MESSAGES.role);
  if (!ownKey(state.families, familyId)) throw new Error(MESSAGES.family);
  if (!plainObject(state.courtStaff)) throw new Error(MESSAGES.collection);
  const existing = staffOf(state, familyId).find((staff) => staff.role === role);
  if (existing) return existing;
  const { skill, value, traits } = PROFILES[role];
  const n = ++state.sequence;
  const staff = {
    id: `staff-${n}`,
    name: `${NAME_POOL[n % NAME_POOL.length]} (${STAFF_ROLES[role]})`,
    familyId,
    role,
    skills: Object.fromEntries(SKILL_KEYS.map((key) => [key, key === skill ? value : BASE_SKILL])),
    traits: [...traits],
    loyalty: STAFF_LOYALTY,
    bornAt: addGameMonths(state.date, -STAFF_AGE_YEARS * 12),
    diedAt: null,
  };
  state.courtStaff[staff.id] = staff;
  return staff;
}

function checkStaff(state, key, staff) {
  const number = staffNumber(key);
  if (!plainObject(staff) || staff.id !== key || number === null || !(number <= state.sequence)) throw new Error(MESSAGES.id);
  if (!ownKey(STAFF_ROLES, staff.role)) throw new Error(MESSAGES.role);
  if (!ownKey(state.families, staff.familyId)) throw new Error(MESSAGES.family);
  if (typeof staff.name !== 'string' || !staff.name.trim()) throw new Error(MESSAGES.name);
  if (!plainObject(staff.skills) || SKILL_KEYS.some((skill) => !Object.hasOwn(staff.skills, skill) || !inRange(staff.skills[skill], 0, SKILL_MAX))) throw new Error(MESSAGES.skills);
  if (!Array.isArray(staff.traits) || staff.traits.some((trait) => !ownKey(TRAITS, trait))) throw new Error(MESSAGES.traits);
  if (!inRange(staff.loyalty, 0, 100)) throw new Error(MESSAGES.loyalty);
  const born = onOrBefore(staff.bornAt, state.date);
  if (!born || (staff.diedAt !== null && !(onOrBefore(staff.diedAt, state.date) && compareGameDates(staff.diedAt, staff.bornAt) >= 0))) throw new Error(MESSAGES.date);
}

/** Validates every staff member: id equal to its key and not beyond state.sequence, known role, existing household, a name, the six skills in 0-20, known traits, loyalty 0-100, canonical dates not in the future, and at most one living member per household and role. */
export function validateCourtStaff(state) {
  if (!plainObject(state.courtStaff)) throw new Error(MESSAGES.collection);
  const living = new Set();
  for (const [key, staff] of Object.entries(state.courtStaff)) {
    checkStaff(state, key, staff);
    if (!alive(staff)) continue;
    const slot = JSON.stringify([staff.familyId, staff.role]);
    if (living.has(slot)) throw new Error(MESSAGES.dup);
    living.add(slot);
  }
}
