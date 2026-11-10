import { addGameMonths, compareGameDates } from '../gameDates.js';
import { inflictInjury } from './health.js';
import { isImprisoned } from './prisoners.js';
import { addPrestige } from './reign.js';
import { bondBetween } from './bonds.js';

// The heir challenges a rival to a duel (spec docs/superpowers/specs/2026-11-10-duel-design.md). Historical campaigns only. Nothing here draws from a random stream: the fight is settled by a hash of the story id.
export const DUEL_HATRED = -25, DUEL_CHAMPION_SILVER = 15, DUEL_DEATH = 0.25;
const DUE_MONTHS = 3, QUIET_MONTHS = 60, FORBID_STRESS = 20, WIN_STRESS = 10, PRESTIGE = 5;
const FORBIDDEN = Object.freeze({ value: -20, years: 10, label: 'Förbjuden duell' });
const DEFEAT = Object.freeze({ value: -30, years: 20, label: 'Duellen' });
const CLOSED = Object.freeze({ gone: 'En av duellanterna kan inte längre strida.', replaced: 'Den som skulle avgöra saken företräder inte längre familjen eller riket.' });
const REFUSED = Object.freeze({ nobody: 'Ingen i familjen strider bättre än arvingen.', poor: `Det behövs ${DUEL_CHAMPION_SILVER} silver ur familjens kassa.` });

/** The choice-free end of a duel: the heir goes ahead. */
export const DUEL_EXPIRY = Object.freeze({ choiceId: 'allow', text: 'Ingen förbjöd duellen i tid, och arvingen gick till kamp.' });

const byId = (a, b) => a.id.localeCompare(b.id);
const prowess = (person) => person?.skills?.prowess ?? 0;
const free = (state, person) => person && !person.diedAt && !isImprisoned(state, person.id);

/** A number in [0, 1) fixed by the text (FNV-1a, 32 bits). */
export function hashRoll(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
  return hash / 4294967296;
}

/** The first candidate for the throne when an adult of the player's family, free and not the ruler; else null. */
export function duelHeir(state, hooks) {
  const heir = hooks.rulerCandidates()[0], family = hooks.controlledFamily();
  return free(state, heir) && hooks.adult(heir) && heir.familyId === family?.id && heir.id !== hooks.ruler()?.id ? heir : null;
}

/** The free adult outside the heir's house whom the heir likes least, at DUEL_HATRED or lower or bound as rivals; never the ruler or the representative. */
export function duelRival(state, heir, hooks) {
  const shielded = new Set([hooks.ruler()?.id, hooks.activeRepresentative()?.id]);
  return Object.values(state.people)
    .filter((other) => free(state, other) && hooks.adult(other) && other.familyId !== heir.familyId && !shielded.has(other.id))
    .map((other) => ({ other, opinion: hooks.getPersonalOpinion(heir.id, other.id) }))
    .filter((item) => item.opinion <= DUEL_HATRED || bondBetween(state, heir.id, item.other.id) === 'rival')
    .sort((a, b) => a.opinion - b.opinion || byId(a.other, b.other))[0]?.other ?? null;
}

/** In courtAnnualStep: on a historical campaign the heir challenges the most hated rival, at most one challenge in five years. */
export function duelStep(state, events, hooks) {
  if (!state.historicalOrigin) return;
  const heir = duelHeir(state, hooks), actor = hooks.activeRepresentative();
  // An heir who decides for the family needs no one's leave to fight.
  if (!heir || !actor || heir.id === actor.id) return;
  const recent = (story) => story.type === 'duel_challenge' && (story.status === 'open' || compareGameDates(addGameMonths(story.createdAt, QUIET_MONTHS), state.date) > 0);
  if (state.stories.some(recent)) return;
  const rival = duelRival(state, heir, hooks);
  if (!rival) return;
  const description = `${heir.name} kräver upprättelse av ${rival.name} med vapen i hand. Kampförmåga ${prowess(heir)} mot ${prowess(rival)}.`;
  // The id names the heir and the day, at most one in five years, so the story takes nothing from state.sequence.
  state.stories.push({ id: `duel-${heir.id}-${state.date}`, type: 'duel_challenge', status: 'open', title: `${heir.name} utmanar ${rival.name} på duell`, description, actorId: actor.id, heirId: heir.id, rivalId: rival.id, createdAt: state.date, dueAt: addGameMonths(state.date, DUE_MONTHS), knownBy: 'public' });
  hooks.logEvent(events, 'duel_challenge', 'En utmaning', `${heir.name} utmanar ${rival.name} på duell.`, [heir.id, rival.id]);
}

/** The family member with the highest prowess above the heir's, other than the heir and the representative; the earlier id on a tie. */
function championFor(state, story, hooks) {
  const heir = state.people[story.heirId], family = hooks.controlledFamily();
  return Object.values(state.people)
    .filter((person) => free(state, person) && hooks.adult(person) && person.familyId === family?.id && ![story.heirId, story.actorId].includes(person.id) && prowess(person) > prowess(heir))
    .sort((a, b) => prowess(b) - prowess(a) || byId(a, b))[0] ?? null;
}

/** The three choices, with a Swedish reason on the champion when it cannot apply. */
export function duelChoices(state, story, hooks) {
  const heir = state.people[story.heirId], champion = championFor(state, story, hooks), purse = hooks.controlledFamily()?.treasury ?? 0;
  return [
    { id: 'allow', label: 'Låt duellen ske', description: `${heir.name} strider själv. Förloraren kan dö eller skadas.`, cost: '0 silver', stress: '0', disabledReason: '' },
    { id: 'champion', label: champion ? `Sänd ${champion.name} som kämpe` : 'Sänd en kämpe', description: 'En bättre kämpe ur familjen strider i arvingens ställe.', cost: `${DUEL_CHAMPION_SILVER} silver`, stress: '0', disabledReason: !champion ? REFUSED.nobody : purse < DUEL_CHAMPION_SILVER ? REFUSED.poor : '' },
    { id: 'forbid', label: 'Förbjud duellen', description: `Ingen strid. ${heir.name} känner sig förödmjukad och tar illa upp.`, cost: '0 silver', stress: `+${FORBID_STRESS} för arvingen`, disabledReason: '' },
  ];
}

/** The fighter's chance to win: 0.5 plus 0.05 per point of prowess over the rival, held inside 0.15 to 0.85. */
export const winChance = (fighter, rival) => Math.min(0.85, Math.max(0.15, 0.5 + 0.05 * (prowess(fighter) - prowess(rival))));

function fight(state, story, fighter, events, hooks) {
  const rival = state.people[story.rivalId], heirWins = hashRoll(`${story.id}|win`) < winChance(fighter, rival);
  const [winner, loser] = heirWins ? [fighter, rival] : [rival, fighter], dies = hashRoll(`${story.id}|wound`) < DUEL_DEATH;
  const outcome = dies ? `${loser.name} faller.` : `${loser.name} skadas.`;
  const event = hooks.logEvent(events, 'duel', `${winner.name} besegrar ${loser.name} i en duell`, `${winner.name} vinner duellen mot ${loser.name}. ${outcome}`, [winner.id, loser.id]);
  winner.stress = Math.max(0, winner.stress - WIN_STRESS);
  if (heirWins && fighter.id === story.heirId) addPrestige(state, PRESTIGE);
  if (dies) { hooks.kill([loser.id], events, 'Föll i en duell'); return; }
  inflictInjury(state, loser, events, { sourceKind: 'duel', causeId: event.id, relatedPersonId: winner.id, rolls: { severity: 2, scar: hashRoll(`${story.id}|scar`), outcome: hashRoll(`${story.id}|recovery`) } });
  const note = hooks.memory('duel', event.title, [winner.id, loser.id], { causeId: event.id }).id;
  hooks.opinionCause(loser.id, winner.id, DEFEAT.value, DEFEAT.label, note, DEFEAT.years);
}

/** Applies a choice resolveStory has already checked, or the expiry `allow`. Marks the story resolved first, so a death in the fight does not close it a second time. */
export function resolveDuel(state, story, choiceId, events, hooks) {
  Object.assign(story, { status: 'resolved', choiceId, resolvedAt: state.date });
  const heir = state.people[story.heirId];
  if (choiceId === 'forbid') {
    heir.stress = Math.min(200, heir.stress + FORBID_STRESS);
    hooks.opinionCause(heir.id, story.actorId, FORBIDDEN.value, FORBIDDEN.label, `duel:${story.id}`, FORBIDDEN.years);
    return;
  }
  const champion = choiceId === 'champion' ? championFor(state, story, hooks) : null;
  if (champion) hooks.controlledFamily().treasury -= DUEL_CHAMPION_SILVER;
  fight(state, story, champion ?? heir, events, hooks);
}

/** Why an open duel no longer stands, or '' while it does. Such a story closes with no effect. */
export function duelClosedReason(state, story, hooks) {
  if (![story.heirId, story.rivalId].every((id) => free(state, state.people[id]))) return CLOSED.gone;
  return hooks.activeRepresentative()?.id === story.actorId ? '' : CLOSED.replaced;
}
