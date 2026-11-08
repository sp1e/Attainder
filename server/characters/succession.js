import { compareGameDates } from '../gameDates.js';

// Who belongs to the old ruler's line and house when the crown passes.
// Spec: docs/superpowers/specs/2026-11-08-married-in-succession-design.md. Draws nothing.

const byBirth = (a, b) => compareGameDates(a.bornAt, b.bornAt) || a.id.localeCompare(b.id);

/** Each person's legal children, every person in state, living or dead. */
export function childIndex(state) {
  const children = new Map();
  for (const person of Object.values(state.people || {})) {
    for (const parentId of person.legalParentIds || []) {
      if (!children.has(parentId)) children.set(parentId, []);
      children.get(parentId).push(person);
    }
  }
  return children;
}

/** "adopter>child" for every adoption memory (participants: adopter, child). */
function adoptionPairs(state) {
  return new Set((state.memories || []).filter((m) => m.type === 'adoption').map((m) => `${m.participants?.[0]}>${m.participants?.[1]}`));
}

/**
 * The old ruler's descendants through legal-parent links at any depth, eldest child first and each
 * child followed by that child's own line. Dead descendants hold their place and are included.
 */
export function descendantLine(state, oldRuler, children = childIndex(state)) {
  const line = [], seen = new Set();
  const visit = (id) => {
    for (const child of [...(children.get(id) || [])].sort(byBirth)) {
      if (seen.has(child.id) || child.id === oldRuler.id) continue;
      seen.add(child.id);
      line.push(child);
      visit(child.id);
    }
  };
  if (oldRuler) visit(oldRuler.id);
  return line;
}

/** The person's spouses and the other legal parents of the person's legal children, except through an adopted child. */
function partnersOf(state, person, children, adopted) {
  const ids = new Set();
  if (person.spouseId) ids.add(person.spouseId);
  for (const other of Object.values(state.people || {})) if (other.spouseId === person.id) ids.add(other.id);
  for (const child of children.get(person.id) || []) {
    for (const parentId of child.legalParentIds) {
      if (adopted.has(`${person.id}>${child.id}`) || adopted.has(`${parentId}>${child.id}`)) continue;
      ids.add(parentId);
    }
  }
  ids.delete(person.id);
  return ids;
}

/**
 * Members of the old ruler's house who married into it: no legal parent in the house, and a partner
 * who is the old ruler or has a legal parent in the house.
 */
export function houseMarriedIn(state, oldRuler, children = childIndex(state)) {
  const ids = new Set();
  if (!oldRuler) return ids;
  const inHouse = (id) => state.people[id]?.familyId === oldRuler.familyId;
  const rooted = (person) => person.id === oldRuler.id || (person.legalParentIds || []).some(inHouse);
  const adopted = adoptionPairs(state);
  for (const person of Object.values(state.people || {})) {
    if (person.familyId !== oldRuler.familyId || rooted(person)) continue;
    const partners = [...partnersOf(state, person, children, adopted)];
    if (partners.some((id) => inHouse(id) && rooted(state.people[id]))) ids.add(person.id);
  }
  return ids;
}

/**
 * Primogeniture: the old ruler's line depth first, then the house's other members by age, then
 * married-in persons and outsiders, adults only, by age. `people` is the pool of possible successors.
 */
export function primogenitureCandidates(state, oldRuler, people, isAdult) {
  const pool = new Set(people.map((p) => p.id)), children = childIndex(state);
  const line = oldRuler ? descendantLine(state, oldRuler, children).filter((p) => pool.has(p.id)) : [];
  const placed = new Set(line.map((p) => p.id)), marriedIn = houseMarriedIn(state, oldRuler, children);
  const kin = people.filter((p) => !placed.has(p.id) && p.familyId === oldRuler?.familyId && !marriedIn.has(p.id)).sort(byBirth);
  for (const p of kin) placed.add(p.id);
  const rest = people.filter((p) => !placed.has(p.id) && isAdult(p)).sort(byBirth);
  return [...line, ...kin, ...rest];
}
