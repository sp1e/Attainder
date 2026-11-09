import { compareGameDates } from '../gameDates.js';
import { createSecret } from './secrets.js';
import { isImprisoned } from './prisoners.js';

// Children of an affair (spec docs/superpowers/specs/2026-11-09-illegitimate-children-design.md).
// Nothing here moves a random stream: the paternity draw hashes the plot stream's current state with the mother and the date.
export const LOVER_SHARE = 0.5;
export const BASTARD_GRUDGE = -25, BASTARD_YEARS = 20, BASTARD_LABEL = 'Oäkta barn';

const byId = (a, b) => a.id.localeCompare(b.id);
/** The paternity draw in [0, 1) for a birth now: an FNV-1a hash of the plot stream's state, the mother and the date. Reads the stream, never advances it. */
export function paternityDraw(state, mother) {
  let n = 2166136261;
  for (const char of `${state.plotRngState}|${mother.id}|${state.date}|paternity`) n = Math.imul(n ^ char.charCodeAt(0), 16777619);
  return (n >>> 0) / 4294967296;
}

const hiddenAffair = (state, mother) => state.secrets.find((secret) => secret.type === 'affair' && secret.subjectId === mother.id && !secret.exposed) ?? null;

/** The men who can father the mother's child in an affair: alive, adult, not the husband, not in prison, not close kin, not the player's representative. In id order. */
export function eligibleLovers(state, mother, husband, hooks) {
  const representativeId = hooks.activeRepresentative()?.id ?? null;
  return Object.values(state.people).filter((man) => !man.diedAt && man.sex === 'male' && hooks.adult(man) && man.id !== husband.id && man.id !== representativeId
    && !isImprisoned(state, man.id) && !hooks.closeKin(mother, man)).sort(byId);
}

// The lover of the mother's latest child of this affair, when he can still be the father.
function earlierLover(state, mother, affair, eligible) {
  const earlier = state.secrets.filter((secret) => secret.type === 'illegitimate_child' && secret.holderIds[0] === mother.id && compareGameDates(secret.createdAt, affair.createdAt) >= 0).at(-1);
  return earlier ? eligible.find((man) => man.id === earlier.holderIds[1]) ?? null : null;
}

/** Who fathers the child a married mother bears now. Without a hidden affair: the husband, with no draw. With one: a paternityDraw below LOVER_SHARE gives the lover, else the husband. */
export function biologicalFather(state, mother, husband, hooks) {
  const affair = hiddenAffair(state, mother);
  if (!affair) return husband;
  const u = paternityDraw(state, mother);
  if (!(u < LOVER_SHARE)) return husband;
  const eligible = eligibleLovers(state, mother, husband, hooks);
  if (!eligible.length) return husband;
  return earlierLover(state, mother, affair, eligible) ?? eligible[Math.floor((u / LOVER_SHARE) * eligible.length)];
}

/** The hidden secret of a child whose biological father is the lover: subject the child, held by mother and lover, caused by the birth memory. */
export function recordIllegitimacy(state, child, mother, lover, birthMemoryId) {
  return createSecret(state, { type: 'illegitimate_child', subjectId: child.id, holderIds: [mother.id, lover.id], evidence: 'weak', causeId: birthMemoryId });
}

/** The yearly step: for each exposed illegitimate_child secret the living legal father holds a grudge against the mother and the biological father. The cause id `bastard:<secret id>` keeps it to one. */
export function paternityStep(state, hooks) {
  for (const secret of state.secrets.filter((item) => item.type === 'illegitimate_child' && item.exposed)) {
    const child = state.people[secret.subjectId];
    const [motherId, loverId] = secret.holderIds;
    const father = (child?.legalParentIds || []).map((id) => state.people[id]).find((parent) => parent && parent.id !== motherId);
    if (!father || father.diedAt) continue;
    for (const targetId of [motherId, loverId].filter((id) => state.people[id] && !state.people[id].diedAt)) hooks.opinionCause(father.id, targetId, BASTARD_GRUDGE, BASTARD_LABEL, `bastard:${secret.id}`, BASTARD_YEARS);
  }
}
