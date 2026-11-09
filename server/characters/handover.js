// What changed when a new ruler took the throne, shown on the reign card during the reign's first year.
// Spec: docs/superpowers/specs/2026-11-09-reign-handover-design.md. Reads only: draws nothing, writes nothing and keeps no state.
import { ARCHETYPES, SKILL_LABELS, TRAITS } from './content.js';
import { reignMonths } from './reign.js';

export const HANDOVER_MONTHS = 12;
const SKILL_MOVE = 2;
const MAX_SKILLS = 3;

const traitName = (trait) => TRAITS[trait]?.name || trait;
const ability = (archetype) => ({ name: ARCHETYPES[archetype]?.name ?? archetype, ability: ARCHETYPES[archetype]?.ability ?? '' });

// The person in the entry before the sitting ruler's accession, skipping vacancies. null at the campaign start, when the ruler
// held the throne just before (a dissolution writes the holder once more), or when the last entry is not this reign's accession,
// as in an old save whose reign record defaultReign dated to the day it loaded.
function predecessorOf(state, rulerId) {
  const history = state.offices.ruler?.history || [], last = history.at(-1);
  if (last?.personId !== rulerId || last.date !== state.reign.startedAt) return null;
  for (let index = history.length - 2; index >= 0; index--) {
    const { personId } = history[index];
    if (personId) return personId === rulerId ? null : state.people[personId] ?? null;
  }
  return null;
}

function skillMoves(before, after) {
  return Object.keys(SKILL_LABELS)
    .filter((key) => Number.isFinite(before.skills?.[key]) && Number.isFinite(after.skills?.[key]))
    .map((key, order) => ({ key, order, from: before.skills[key], to: after.skills[key] }))
    .filter((row) => Math.abs(row.to - row.from) >= SKILL_MOVE)
    .sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from) || a.order - b.order)
    .slice(0, MAX_SKILLS)
    .map(({ key, from, to }) => ({ label: SKILL_LABELS[key], from, to }));
}

/** The handover from the previous ruler, or null when there is none to show. */
export function reignHandover(state, hooks) {
  const ruler = hooks.ruler(), months = reignMonths(state);
  if (!ruler || ruler.id !== state.reign.rulerId || months >= HANDOVER_MONTHS) return null;
  const before = predecessorOf(state, ruler.id);
  if (!before) return null;
  const old = before.traits || [], now = ruler.traits || [];
  const traitsGone = old.filter((trait) => !now.includes(trait)).map(traitName);
  const traitsNew = now.filter((trait) => !old.includes(trait)).map(traitName);
  const archetype = before.archetype === ruler.archetype ? null : { from: ability(before.archetype), to: ability(ruler.archetype) };
  const skills = skillMoves(before, ruler);
  if (!archetype && !traitsGone.length && !traitsNew.length && !skills.length) return null;
  return { rulerName: ruler.name, predecessorName: before.name, monthsLeft: HANDOVER_MONTHS - months, archetype, traitsGone, traitsNew, skills };
}
