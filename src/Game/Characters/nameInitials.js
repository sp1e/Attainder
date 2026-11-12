import { nativeReading } from '../../runtime/translator.js';

// The letters a portrait or family badge shows when it has no picture. They come from the name the player reads, so
// English shows "C" for Charles where the Swedish data says Karl, and a parenthesised epithet or label is no part of
// them: "Odo (generated)" gives "O", not "O(". A leading English article is skipped and a number in the second or
// third word wins the second place, so "Court house 2 (generated)" gives "C2" and "The royal house" gives "Rh", as
// "Hovhus 2" gave "H2". A number further on belongs to another name: "Child person-193's branch of Court house 5"
// gives "Cp", apart from its parent house's "C5".
const ARTICLE = /^(the|a|an)$/i;

/** Up to two initials of `name` as `readName` reads it, the first one capital; '?' when it has none. */
export function nameInitials(name, readName = nativeReading) {
  const source = String(name || '');
  const read = readName(source);
  const all = (typeof read === 'string' ? read : source).replace(/\([^)]*\)/g, ' ').split(/\s+/).filter(Boolean);
  const words = all.length > 1 && ARTICLE.test(all[0]) ? all.slice(1) : all;
  const number = words.slice(1, 3).find((word) => /^\p{N}/u.test(word));
  const letters = [words[0], number ?? words[1]].map((word) => word?.match(/[\p{L}\p{N}]/u)?.[0]).filter(Boolean);
  return letters.length ? `${letters[0].toUpperCase()}${letters.slice(1).join('')}` : '?';
}
