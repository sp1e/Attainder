// Attested personal names for generated people in historical campaigns (spec docs/superpowers/specs/2026-11-11-name-pools-design.md).
// A package court may carry { id, male, female }; the campaign keeps a copy as state.namePool. Hadara has none and keeps NAME_POOL.
export const NAME_POOL_LIMITS = Object.freeze({ names: 200, length: 40 });
const KEYS = Object.freeze(['id', 'male', 'female']);
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const validName = (name) => typeof name === 'string' && name.length > 0 && name.length <= NAME_POOL_LIMITS.length && name.trim() === name && !/[()]/.test(name);
const validNames = (names) => Array.isArray(names) && names.length > 0 && names.length <= NAME_POOL_LIMITS.names
  && names.every(validName) && new Set(names).size === names.length;

/** True for { id, male, female } with a lowercase id and one to 200 distinct plain names per sex. */
export const validNamePool = (pool) => plain(pool) && Object.keys(pool).every((key) => KEYS.includes(key))
  && typeof pool.id === 'string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(pool.id) && validNames(pool.male) && validNames(pool.female);

/** A copy of the court's pool, or undefined when the court has none. Reads only. */
export const seedNamePool = (court) => (validNamePool(court?.namePool) ? { id: court.namePool.id, male: [...court.namePool.male], female: [...court.namePool.female] } : undefined);

/** The pool name a roll in [0, 1) picks for a sex, or null without a pool. Draws nothing. */
export function poolName(state, sex, roll) {
  const names = state.namePool?.[sex];
  return Array.isArray(names) && names.length ? names[Math.floor(roll * names.length)] : null;
}

/** The pool name for the n-th staff member, male names first, or null without a pool. */
export function poolStaffName(state, n) {
  if (!state.namePool) return null;
  const names = [...state.namePool.male, ...state.namePool.female];
  return names[n % names.length];
}

/** A save's pool: absent, or valid and only in a historical campaign. */
export function validateNamePool(state) {
  if (!Object.hasOwn(state, 'namePool')) return;
  if (!state.historicalOrigin || !validNamePool(state.namePool)) throw new Error('Sparfilens namnlista är ogiltig.');
}
