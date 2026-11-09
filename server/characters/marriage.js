// Marriages: spouseId holds the first spouse, otherSpouseIds (optional) the rest in authored order.
// Marriages are reciprocal, so either person's list names the pair.

/** Every spouse id the person lists, living or dead, first spouse first. */
export function spouseIdsOf(person) {
  if (!person) return [];
  return [person.spouseId, ...(person.otherSpouseIds ?? [])].filter(Boolean);
}

/** True when either person lists the other as a spouse. */
export function isMarried(a, b) {
  if (!a || !b || a.id === b.id) return false;
  return spouseIdsOf(a).includes(b.id) || spouseIdsOf(b).includes(a.id);
}

/** True when any spouse the person lists is alive. */
export function hasLivingSpouse(state, person) {
  return spouseIdsOf(person).some((id) => {
    const spouse = Object.hasOwn(state.people, id) ? state.people[id] : null;
    return Boolean(spouse && !spouse.diedAt);
  });
}

/** Null when the optional list is absent or valid; otherwise the Swedish error the save loader throws. */
export function otherSpousesError(state, person) {
  if (!Object.hasOwn(person, 'otherSpouseIds')) return null;
  const ids = person.otherSpouseIds;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || id === person.id || id === person.spouseId) || new Set(ids).size !== ids.length) {
    return 'En person saknar giltiga egenskaper.';
  }
  return ids.every((id) => Object.hasOwn(state.people, id)) ? null : 'Ett släktband hänvisar till en saknad person.';
}
