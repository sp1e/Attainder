// Partition: under the law of a divided inheritance, a dead ruler's younger children share the house's wealth and found rival houses.
// Spec: docs/superpowers/specs/2026-11-10-partition-design.md. Draws nothing; acts only on a ruler's death under the law 'partition'.
import { getCharacterAge } from './characterCapacity.js';
import { byAge, childrenIndex, foundHouse, lineOf } from './cadetBranches.js';
import { isImprisoned } from './prisoners.js';

export const PARTITION_HEIRS = 3, PARTITION_GRUDGE = -30, PARTITION_YEARS = 20, PARTITION_LABEL = 'Delat arv';

const names = (people) => people.length < 2 ? people[0].name : `${people.slice(0, -1).map((p) => p.name).join(', ')} och ${people.at(-1).name}`;

/** Up to PARTITION_HEIRS of the dead ruler's free adult legal children who stay in the ruler's house, eldest first; the heir and the heir's line excepted. */
export function partitionHeirs(state, oldRuler, heir, hooks, index = childrenIndex(state)) {
  const family = state.families[oldRuler.familyId], heirLine = lineOf(heir.id, index);
  const blocked = new Set([family.guardianId, hooks.householdRepresentative()?.id].filter(Boolean));
  return Object.values(state.people)
    .filter((p) => !p.diedAt && p.familyId === family.id && (p.legalParentIds || []).includes(oldRuler.id) && getCharacterAge(p, state.date) >= 18)
    .filter((p) => !heirLine.has(p.id) && !blocked.has(p.id) && !isImprisoned(state, p.id))
    .sort(byAge).slice(0, PARTITION_HEIRS);
}

/**
 * Each younger child leaves with their line and a spouse of the house, and takes an equal share, rounded down: one share each and
 * one for the heir's house, which keeps the remainder. The guardian and the player's representative stay.
 */
function divide(state, family, children, heir, index, hooks) {
  const shares = children.length + 1, heirLine = lineOf(heir.id, index), moving = new Set(children.map((child) => child.id));
  const take = { treasury: Math.floor(family.treasury / shares), estates: Math.floor(family.estates / shares), influence: Math.floor(family.influence / shares) };
  const stays = new Set([family.guardianId, hooks.householdRepresentative()?.id].filter(Boolean));
  return children.map((child) => {
    const line = lineOf(child.id, index);
    const branch = Object.values(state.people).filter((p) => !p.diedAt && p.familyId === family.id && (line.has(p.id) || p.id === child.spouseId)
      && !heirLine.has(p.id) && !isImprisoned(state, p.id) && (p.id === child.id || !moving.has(p.id)) && !stays.has(p.id));
    return foundHouse(state, family, child, branch, take);
  });
}

/** Called after the crown passes on a ruler's death. Acts when the law is 'partition' and the new ruler is the dead ruler's legal child. */
export function partitionInheritance(state, oldRuler, events, hooks) {
  const heir = hooks.ruler(), family = state.families[oldRuler?.familyId];
  if (state.realm.successionLaw !== 'partition' || !heir || !family || family.exiled || !(heir.legalParentIds || []).includes(oldRuler.id)) return;
  const index = childrenIndex(state), children = partitionHeirs(state, oldRuler, heir, hooks, index);
  if (!children.length) return;
  const houses = divide(state, family, children, heir, index, hooks);
  const description = `${heir.name} ärver tronen. ${names(children)} delar arvet efter ${oldRuler.name} och grundar ${houses.length === 1 ? 'ett eget hus' : 'egna hus'}: ${houses.map((house) => house.name).join(', ')}.`;
  const shared = [heir, ...children], event = hooks.logEvent(events, 'partition', `Arvet efter ${oldRuler.name} delas`, description, shared.map((p) => p.id));
  const note = hooks.memory('partition', event.title, shared.map((p) => p.id), { causeId: event.id }).id;
  for (const a of shared) for (const b of shared) if (a.id !== b.id) hooks.opinionCause(a.id, b.id, PARTITION_GRUDGE, PARTITION_LABEL, note, PARTITION_YEARS);
}
