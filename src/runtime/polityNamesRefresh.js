// When the polity-name cache reloads. It reloads every 15 seconds, and sooner when a code it does
// not know is asked for: a game that starts a few seconds after the menu showed another world
// would otherwise show its polity id until the cache expired. A missing code reloads at most once
// a second, and not at all once a reload has already come back without it (missedAt maps a code
// to the refreshedAt of the reload that lacked it), so a code no world names reloads once per expiry.
export const POLITY_NAMES_MAX_AGE_MS = 15000;
export const POLITY_NAMES_MISS_RETRY_MS = 1000;

export function shouldRefreshPolityNames({ now, refreshedAt, code, known, missedAt = new Map() }) {
  const age = now - refreshedAt;
  if (age > POLITY_NAMES_MAX_AGE_MS) return true;
  const key = String(code ?? '').trim();
  if (!key || known.has(key) || missedAt.get(key) === refreshedAt) return false;
  return age > POLITY_NAMES_MISS_RETRY_MS;
}
