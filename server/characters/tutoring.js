// A tutor whose trait opposes the child's may replace that trait when the child comes of age.
// Spec: docs/superpowers/specs/2026-11-09-tutor-trait-correction-design.md. Draws nothing: the yearly
// step passes in the one draw it already makes at adulthood.
import { OPPOSITE_TRAITS, TRAITS } from './content.js';

export const CORRECTION_CHANCE = 0.6;
const MENTOR_TRAIT_CHANCE = 0.4;

const opposite = (trait) => {
  const pair = OPPOSITE_TRAITS.find((entry) => entry.includes(trait));
  return pair ? pair.find((entry) => entry !== trait) : null;
};
const traitName = (trait) => TRAITS[trait]?.name || trait;

/** The first trait in the mentor's own order whose opposite the child holds, as { from, to }, or null. */
export function traitCorrection(child, mentor) {
  const held = new Set(child?.traits || []);
  for (const trait of mentor?.traits || []) {
    const from = opposite(trait);
    if (from && held.has(from)) return { from, to: trait };
  }
  return null;
}

/** The child's traits at adulthood for a draw in [0, 1), as { traits, corrected }, or null when they stay. */
export function traitsAtAdulthood(child, mentor, draw) {
  const correction = traitCorrection(child, mentor);
  if (correction) {
    if (draw >= CORRECTION_CHANCE) return null;
    return { traits: [...new Set(child.traits.map((trait) => (trait === correction.from ? correction.to : trait)))], corrected: correction };
  }
  if (draw >= MENTOR_TRAIT_CHANCE) return null;
  return { traits: [...new Set([child.traits[0], mentor.traits[0]])], corrected: null };
}

/** The sentence the educate event adds when the mentor may correct a trait, or ''. */
export function tutorProspect(child, mentor) {
  const correction = traitCorrection(child, mentor);
  if (!correction) return '';
  const to = traitName(correction.to);
  return ` Läraren är ${to.toLowerCase()}: vid myndigheten byter ${child.name} draget ${traitName(correction.from)} mot ${to} med ${Math.round(CORRECTION_CHANCE * 100)} % chans.`;
}

/** The sentence the adulthood event adds when a correction took, or ''. */
export function correctionNote(person, corrected) {
  return corrected ? ` ${person.name} har lagt bort draget ${traitName(corrected.from)} och är nu ${traitName(corrected.to).toLowerCase()}.` : '';
}
