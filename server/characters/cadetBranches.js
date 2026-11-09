// A family that grows large loses a branch: a collateral line leaves and founds a rival house.
// Spec: docs/superpowers/specs/2026-11-10-cadet-branch-design.md. Historical campaigns only, as court renewal; draws nothing.
import { compareGameDates } from '../gameDates.js';
import { getCharacterAge } from './characterCapacity.js';
import { isImprisoned } from './prisoners.js';

export const CADET_SIZE = 10, CADET_GRUDGE = -25, CADET_YEARS = 30, CADET_LABEL = 'Husets splittring';

const compareIds = (a, b) => a.localeCompare(b, 'en', { numeric: true });
const byAge = (a, b) => compareGameDates(a.bornAt, b.bornAt) || compareIds(a.id, b.id);
// A name without its trailing notes in parentheses; a house name without the branches it has come through.
const plainName = (name) => name.split(' (')[0];
const rootHouse = (name) => { const parts = plainName(name).split(' gren av '); return parts.length > 1 ? parts.at(-1).replace(/ \d+$/, '') : parts[0]; };
const genitive = (name) => (/\d$/.test(name) ? `${name}:s` : /[sxz]$/i.test(name) ? name : `${name}s`);

/** Legal parent id → ids of that parent's legal children, over every person alive or dead. */
function childrenIndex(state) {
  const index = new Map();
  for (const person of Object.values(state.people)) for (const parentId of person.legalParentIds || []) {
    if (!index.has(parentId)) index.set(parentId, []);
    index.get(parentId).push(person.id);
  }
  return index;
}

/** The person and every legal descendant, traced through the dead. */
function lineOf(rootId, index) {
  const line = new Set([rootId]), queue = [rootId];
  while (queue.length) for (const id of index.get(queue.shift()) || []) if (!line.has(id)) { line.add(id); queue.push(id); }
  return line;
}

/** True when a legal parent belonged to the house: a spouse who married in founds no branch. */
const bornInto = (state, person, family) => (person.legalParentIds || []).some((id) => state.people[id]?.familyId === family.id);

/** The eldest free adult born into the house, outside the head's line and below no living collateral parent, with a descendant who would leave with them, or null. */
export function cadetBranchOf(state, family, hooks, index = childrenIndex(state)) {
  const living = Object.values(state.people).filter((p) => !p.diedAt && p.familyId === family.id).sort(byAge);
  if (living.length < CADET_SIZE) return null;
  const headLine = lineOf(family.headId, index);
  const blocked = new Set([family.headId, family.guardianId, hooks.ruler()?.id, hooks.householdRepresentative()?.id].filter(Boolean));
  const stays = (p) => headLine.has(p.id) || blocked.has(p.id) || isImprisoned(state, p.id);
  // A living parent outside the head's line heads this line: the parent founds the branch or nobody does.
  const underCollateral = (p) => (p.legalParentIds || []).some((id) => { const parent = state.people[id]; return parent && !parent.diedAt && parent.familyId === family.id && !headLine.has(id); });
  for (const founder of living) {
    if (stays(founder) || getCharacterAge(founder, state.date) < 18 || !bornInto(state, founder, family) || underCollateral(founder)) continue;
    const line = lineOf(founder.id, index);
    const branch = living.filter((p) => (line.has(p.id) || p.id === founder.spouseId) && !stays(p));
    if (branch.some((p) => p.id !== founder.id && line.has(p.id)) && living.length - branch.length >= CADET_SIZE / 2) return { founder, branch, size: living.length };
  }
  return null;
}

function branchName(state, family, founder) {
  const base = `${genitive(plainName(founder.name))} gren av ${rootHouse(family.name)}`;
  let name = base;
  for (let n = 2; Object.values(state.families).some((other) => other.name === name); n++) name = `${base} ${n}`;
  return name;
}

/** Moves the branch into a new house that takes its share of the silver, estates and influence. Both heads resent each other. */
function splitHouse(state, family, { founder, branch, size }, events, hooks) {
  const familyId = `family-${++state.sequence}`, share = branch.length / size, headId = family.headId;
  const estates = Math.min(Math.floor(family.estates * share), Math.max(0, family.estates - 1));
  const treasury = Math.round(family.treasury * share), influence = Math.round(family.influence * share);
  Object.assign(family, { estates: family.estates - estates, treasury: family.treasury - treasury, influence: family.influence - influence });
  const name = branchName(state, family, founder);
  state.families[familyId] = {
    id: familyId, name, color: family.color, religionId: founder.religionId, headId: founder.id, guardianId: null,
    treasury, estates, influence, grievance: 0, exiled: false, hostFamilyId: null, claims: [], cooldowns: {},
  };
  for (const person of branch) person.familyId = familyId;
  const others = branch.length - 1, kin = others === 1 ? 'en anhörig' : `${others} anhöriga`;
  const event = hooks.logEvent(events, 'cadet_branch', 'Ett hus delas', `${founder.name} lämnar ${family.name} med ${kin} och grundar ${name}.`, [founder.id, headId]);
  const note = hooks.memory('cadet_branch', 'Ett hus delas', [founder.id, headId], { causeId: event.id }).id;
  hooks.opinionCause(founder.id, headId, CADET_GRUDGE, CADET_LABEL, note, CADET_YEARS);
  hooks.opinionCause(headId, founder.id, CADET_GRUDGE, CADET_LABEL, note, CADET_YEARS);
}

/** Yearly, on a historical campaign: the first family in id order with a branch to lose splits. One split a year. */
export function cadetBranchStep(state, events, hooks) {
  if (!state.historicalOrigin || state.status.ended) return;
  const index = childrenIndex(state);
  for (const family of Object.values(state.families).filter((f) => !f.exiled).sort((a, b) => compareIds(a.id, b.id))) {
    const found = cadetBranchOf(state, family, hooks, index);
    if (found) return splitHouse(state, family, found, events, hooks);
  }
}
