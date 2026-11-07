// When the polity-name cache reloads. It reloads every 15 seconds, and sooner when a code it does
// not know is asked for: a game that starts a few seconds after the menu showed another world
// would otherwise show its polity id until the cache expired. A missing code reloads at most once
// a second, so a code no world names cannot loop.
export const POLITY_NAMES_MAX_AGE_MS = 15000;
export const POLITY_NAMES_MISS_RETRY_MS = 1000;

export function shouldRefreshPolityNames({ now, refreshedAt, code, known }) {
  const age = now - refreshedAt;
  if (age > POLITY_NAMES_MAX_AGE_MS) return true;
  const key = String(code ?? '').trim();
  return Boolean(key) && !known.has(key) && age > POLITY_NAMES_MISS_RETRY_MS;
}
