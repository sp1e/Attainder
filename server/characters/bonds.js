// Friends and rivals form at court (spec docs/superpowers/specs/2026-11-08-friends-and-rivals-design.md).
// The bonds live in state.relations, written both ways, beside partner and mentor. Nothing here draws from a random stream.

export const FORM_AT = 50, HOLD_AT = 20;
export const BOND_ROWS = Object.freeze({ friend: Object.freeze({ label: 'Vänskap', value: 8 }), rival: Object.freeze({ label: 'Rivalitet', value: -8 }) });

/** The friend or rival bond between two persons, or null. */
export function bondBetween(state, aId, bId) {
  const bonds = state.relations?.[`${aId}:${bId}`]?.bonds || [];
  return bonds.includes('friend') ? 'friend' : bonds.includes('rival') ? 'rival' : null;
}

function dropBond(state, aId, bId, kind) {
  for (const key of [`${aId}:${bId}`, `${bId}:${aId}`]) {
    const relation = state.relations[key];
    if (relation) relation.bonds = relation.bonds.filter((bond) => bond !== kind);
  }
}

// What the pair's two opinions make of it: the bond to form, the bond to end, or nothing.
function verdict(current, high, low) {
  if (current === 'friend') return high < HOLD_AT || low <= -HOLD_AT ? { end: 'friend' } : null;
  if (current === 'rival') return low > -HOLD_AT || high >= HOLD_AT ? { end: 'rival' } : null;
  if (high >= FORM_AT && low > -HOLD_AT) return { form: 'friend' };
  if (low <= -FORM_AT && high < HOLD_AT) return { form: 'rival' };
  return null;
}

/** Yearly: every pair of living adults, in id order, forms or ends a friendship or rivalry from its two personal opinions. A pair with a dead or child member keeps what it has. */
export function bondStep(state, hooks) {
  const adults = Object.values(state.people).filter((person) => hooks.adult(person)).sort((a, b) => a.id.localeCompare(b.id));
  for (const [index, a] of adults.entries()) {
    for (const b of adults.slice(index + 1)) {
      const ab = hooks.getPersonalOpinion(a.id, b.id), ba = hooks.getPersonalOpinion(b.id, a.id);
      const change = verdict(bondBetween(state, a.id, b.id), Math.max(ab, ba), Math.min(ab, ba));
      if (change?.form) hooks.addBond(a.id, b.id, change.form);
      else if (change?.end) dropBond(state, a.id, b.id, change.end);
    }
  }
}
