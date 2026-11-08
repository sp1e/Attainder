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
