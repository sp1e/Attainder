import { nativeReading } from '../../runtime/translator.js';

// The letters a portrait or family badge shows when it has no picture. They come from the name the player reads, so
// English shows "C" for Charles where the Swedish data says Karl, and a parenthesised epithet or label is no part of
// them: "Odo (generated)" gives "O", not "O(".

/** Up to two initials of `name` as `readName` reads it; '?' when it has none. */
export function nameInitials(name, readName = nativeReading) {
  const source = String(name || '');
  const read = readName(source);
  const words = (typeof read === 'string' ? read : source).replace(/\([^)]*\)/g, ' ').split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word.match(/[\p{L}\p{N}]/u)?.[0]).filter(Boolean).join('') || '?';
}
