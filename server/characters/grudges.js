import { compareGameDates } from '../gameDates.js';

// Grudges pass to the children (spec docs/superpowers/specs/2026-11-09-inherited-grudges-design.md). Nothing here draws from a random stream.
export const INHERITED_SHARE = 0.5, INHERITED_MIN = 5, INHERITED_YEARS = 10;
const SUFFIX = / \(ärvt från [^)]*\)$/;

const activeAt = (cause, date) => !cause.expiresAt || compareGameDates(cause.expiresAt, date) > 0;

/** At a death: every active negative cause the deceased held towards a living person passes, halved towards zero, to each living adult legal child. A half under 5 in size does not pass. */
export function inheritGrudges(state, person, hooks) {
  const children = Object.values(state.people).filter((child) => hooks.adult(child) && (child.legalParentIds || []).includes(person.id)).sort((a, b) => a.id.localeCompare(b.id));
  if (!children.length) return;
  for (const relation of Object.values(state.relations)) {
    const target = state.people[relation.toId];
    if (relation.fromId !== person.id || !target || target.diedAt) continue;
    for (const cause of relation.causes.filter((item) => item.amount < 0 && activeAt(item, state.date))) {
      const amount = Math.trunc(cause.amount * INHERITED_SHARE);
      if (-amount < INHERITED_MIN) continue;
      const label = `${cause.label.replace(SUFFIX, '')} (ärvt från ${person.name})`;
      for (const child of children) hooks.opinionCause(child.id, relation.toId, amount, label, cause.causeId, INHERITED_YEARS);
    }
  }
}
