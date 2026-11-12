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

/** The names a character view puts in a prompt: every person's and family's name and the realm's, then `extra`. */
export const viewNames = (view, extra = []) => [
  ...(view?.people || []).map((person) => person?.name),
  ...(view?.families || []).map((family) => family?.name),
  view?.identity?.realmName,
  ...extra,
];

/** `{ englishNames }` to spread into a prompt's data when the map has an entry, otherwise `{}`. */
export function englishNameData(names, language, readName = nativeReading) {
  const map = englishNames(names, language, readName);
  return Object.keys(map).length ? { englishNames: map } : {};
}
