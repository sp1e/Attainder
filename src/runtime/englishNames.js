import { nativeReading } from './translator.js';

// In English the character prompts still carry the campaign's Swedish data, so a model copies a Swedish name into
// English prose ("Karl gave the order" where the views read "Charles"). The prompts therefore give the model the
// names the player reads, from the native book the views use. Swedish needs no map, and outside native mode
// nativeReading returns each name unchanged, which also leaves the map empty.

/** { swedishName: englishName } for each distinct name that `readName` reads otherwise; {} in Swedish. */
export function englishNames(names, language, readName = nativeReading) {
  const map = {};
  if (language === 'Swedish') return map;
  for (const name of new Set(names)) {
    if (typeof name !== 'string' || !name.trim()) continue;
    const english = readName(name);
    if (typeof english === 'string' && english.trim() && english !== name) map[name] = english;
  }
  return map;
}

/**
 * The names a prompt may hold from a character view: people; families and the polities that host them; the realm;
 * its cities, religions and border tribes; each foreign realm with its seat, ruler, heir and faith; then `extra`.
 */
export const viewNames = (view, extra = []) => [
  ...(view?.people || []).map((person) => person?.name),
  ...(view?.families || []).flatMap((family) => [family?.name, family?.hostPolityName]),
  view?.identity?.realmName,
  ...[view?.cities, view?.religions, view?.tribes].flatMap((list) => (list || []).map((entry) => entry?.name)),
  ...(view?.foreignRealms || []).flatMap((realm) => [realm?.name, realm?.seatName, realm?.rulerName, realm?.heirName, realm?.faithName]),
  ...extra,
];

/** The names in `names` that occur in `within`, a prompt's data or text, as JSON would write them. */
const namesWithin = (names, within) => {
  const text = typeof within === 'string' ? within : JSON.stringify(within) ?? '';
  return names.filter((name) => typeof name === 'string' && name.trim() && text.includes(JSON.stringify(name).slice(1, -1)));
};

/**
 * `{ englishNames }` to spread into a prompt's data when the map has an entry, otherwise `{}`. With `within`, the map
 * keeps only the names that occur there, so it names nobody the prompt itself leaves out.
 */
export function englishNameData(names, language, readName = nativeReading, within) {
  if (language === 'Swedish') return {};
  const map = englishNames(within === undefined ? names : namesWithin(names, within), language, readName);
  return Object.keys(map).length ? { englishNames: map } : {};
}

/** `data` with an englishNames map last, for the names in `names` that `data` holds; `data` itself in Swedish. */
export const withEnglishNames = (data, names, language, readName = nativeReading) => (
  { ...data, ...englishNameData(names, language, readName, data) });
