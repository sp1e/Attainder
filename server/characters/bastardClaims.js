// A ruler's illegitimate child claims the throne once the secret of its birth is out.
// Spec: docs/superpowers/specs/2026-11-10-bastard-claimant-design.md. Draws nothing; without an exposed secret nothing here acts.
import { compareGameDates } from '../gameDates.js';

export const BASTARD_CLAIM_GRUDGE = -20, BASTARD_CLAIM_YEARS = 20, BASTARD_CLAIM_LABEL = 'Förnekad arvsrätt';

const byBirth = (a, b) => compareGameDates(a.child.bornAt, b.child.bornAt) || a.child.id.localeCompare(b.child.id, 'en', { numeric: true });

/** Living children of an exposed affair whose biological father has ruled the realm, as { child, sire, secret }, eldest first. The sitting ruler is left out. */
export function royalBastards(state) {
  const ruled = new Set((state.offices.ruler?.history || []).map((entry) => entry.personId).filter(Boolean));
  const sittingId = state.offices.ruler?.holderId ?? null;
  return state.secrets
    .filter((secret) => secret.type === 'illegitimate_child' && secret.exposed && ruled.has(secret.holderIds[1]))
    .map((secret) => ({ secret, child: state.people[secret.subjectId], sire: state.people[secret.holderIds[1]] }))
    .filter(({ child, sire }) => child && sire && !child.diedAt && child.id !== sittingId)
    .sort(byBirth);
}

/** The eldest royal bastard for whom `free` holds, or null. */
export function bastardClaimant(state, free) {
  return royalBastards(state).find(({ child }) => free(child))?.child ?? null;
}

/** Yearly: every adult royal bastard resents the sitting ruler, unless the ruler is the own father. One cause per ruler. */
export function bastardClaimStep(state, hooks) {
  const ruler = hooks.ruler();
  if (!ruler) return;
  for (const { secret, child, sire } of royalBastards(state)) {
    if (sire.id === ruler.id || !hooks.adult(child)) continue;
    hooks.opinionCause(child.id, ruler.id, BASTARD_CLAIM_GRUDGE, BASTARD_CLAIM_LABEL, `claim:${secret.id}:${ruler.id}`, BASTARD_CLAIM_YEARS);
  }
}

/** The claimant's name, with the royal father when the claim rests on an exposed birth. */
export function claimLabel(state, person) {
  const row = royalBastards(state).find(({ child }) => child.id === person.id);
  return row ? `${person.name}, oäkta barn till ${row.sire.name}` : person.name;
}
