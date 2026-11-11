import { addGameMonths, compareGameDates, normalizeGameDate } from '../gameDates.js';
import { rememberAbroad } from './alliances.js';
import { CLAIM, atWar, targetable } from './claims.js';
import { hashRoll } from './duels.js';
import { otherFaith } from './faithReform.js';

// The priests call a holy war against a neighbor of another faith (spec docs/superpowers/specs/2026-11-11-holy-war-design.md). Historical campaigns only.
// Every roll is hashRoll of text; nothing here moves a random stream.
export const HOLY_WAR = Object.freeze({ call: 0.15, quietYears: 10, dueMonths: 6, support: 10, supportFloor: 1,
  joined: Object.freeze({ label: 'Det heliga kriget', amount: 15, years: 20 }),
  refused: Object.freeze({ label: 'Avvisade det heliga kriget', amount: -20, years: 20 }) });
/** Nobody answering the priests in time counts as a refusal. */
export const HOLY_WAR_EXPIRY = Object.freeze({ choiceId: 'refuse', text: 'Inget svar nådde prästerna i tid. De tar tystnaden som ett nej.' });
const CLOSED = Object.freeze({ target: 'Målet för det heliga kriget finns inte längre.', war: 'Riket för redan ett annat krig.', caller: 'Prästen som krävde kriget lever inte längre.', mandate: 'Familjen har inte längre härskarens mandat.',
  replaced: 'Den som skulle svara företräder inte längre riket.', family: 'Familjen styrs inte längre av spelaren.' });
const clampSupport = (n) => Math.min(100, Math.max(HOLY_WAR.supportFloor, n));
const living = (person) => person && !person.diedAt;

/** The priest office holder of the ruler's faith, else the faith's leader; never the ruler. Reads only. */
export function holyWarCaller(state, hooks) {
  const ruler = hooks.ruler();
  if (!living(ruler)) return null;
  const fits = (person) => living(person) && person.id !== ruler.id && hooks.adult(person);
  const priest = state.people[state.offices.priest?.holderId];
  if (fits(priest) && priest.religionId === ruler.religionId) return priest;
  const leader = state.people[state.religions[ruler.religionId]?.leaderId];
  return fits(leader) ? leader : null;
}

/** The neighbors a holy war can strike: targetable for a claim, and of another faith than the ruler. Reads only. */
export const holyWarTargets = (state, hooks) => state.foreignRealms.filter((realm) => targetable(realm) && otherFaith(state, hooks.ruler()?.religionId, realm.faith));

// The date of the last call lives on the state: memory fading removes settled stories after five years.
const recent = (state) => state.stories.some((story) => story.type === 'holy_war_call' && story.status === 'open')
  || (typeof state.lastHolyWarCall === 'string' && compareGameDates(addGameMonths(state.lastHolyWarCall, 12 * HOLY_WAR.quietYears), state.date) > 0);

/** In courtAnnualStep: the priests may call a holy war. */
export function holyWarStep(state, events, hooks) {
  if (!state.historicalOrigin) return;
  const actor = hooks.activeRepresentative(), family = hooks.controlledFamily();
  if (!actor || !family || !hooks.canRule() || atWar(state) || recent(state)) return;
  const priest = holyWarCaller(state, hooks), targets = priest ? holyWarTargets(state, hooks) : [], roll = `${state.plotRngState}|${state.date}|holy`;
  if (!targets.length || hashRoll(roll) >= HOLY_WAR.call) return;
  const realm = targets[Math.floor(hashRoll(`${roll}|target`) * targets.length)], title = `Prästerna kräver heligt krig mot ${realm.name}`;
  state.lastHolyWarCall = state.date;
  const event = hooks.logEvent(events, 'holy_war_call', title, `${priest.name} predikar att ${realm.name} håller fast vid ${realm.faith.name} och måste besegras.`, [priest.id, actor.id]);
  state.stories.push({ id: `holy-${realm.id}-${state.date}`, type: 'holy_war_call', status: 'open', title, causeId: event.id,
    description: `${priest.name} kräver krig mot ${realm.name}. Ett ja startar kriget genast; ett nej gör prästerskapet bittert.`,
    realmId: realm.id, callerId: priest.id, familyId: family.id, actorId: actor.id, createdAt: state.date, dueAt: addGameMonths(state.date, HOLY_WAR.dueMonths), knownBy: 'public' });
}

/** The two answers to the priests. Reads only. */
export function holyWarChoices(state, story, hooks) {
  const short = !hooks.canRule() ? 'Kräver härskarmandat.' : state.realm.treasury < CLAIM.war ? `Det behövs ${CLAIM.war} silver ur statskassan.` : '';
  return [
    { id: 'declare', label: 'Gå i heligt krig', description: `Kriget om gränslandet börjar genast. Prästerna står bakom härskaren, och tron vinner ${HOLY_WAR.support} i stöd.`, cost: `${CLAIM.war} silver`, stress: '0', disabledReason: short },
    { id: 'refuse', label: 'Avvisa prästerna', description: `Riket håller fred. Prästen vänder sig mot härskaren, och tron tappar ${HOLY_WAR.support} i stöd.`, cost: '0 silver', stress: '0', disabledReason: '' },
  ];
}

/** Applies a choice resolveStory has already checked, or the expiry. */
export function resolveHolyWar(state, story, choiceId, events, hooks) {
  Object.assign(story, { status: 'resolved', choiceId, resolvedAt: state.date });
  const realm = state.foreignRealms.find((entry) => entry.id === story.realmId), ruler = hooks.ruler(), declare = choiceId === 'declare';
  if (declare) {
    state.realm.treasury -= CLAIM.war;
    realm.claim = { since: state.date, readyAt: state.date, status: 'ready', exposed: false };
    realm.war = { since: state.date, score: 0, battles: 0 };
    rememberAbroad(state, realm, CLAIM.declared);
  }
  const answer = declare ? HOLY_WAR.joined : HOLY_WAR.refused, faith = state.religions[ruler?.religionId];
  if (ruler) hooks.opinionCause(story.callerId, ruler.id, answer.amount, answer.label, story.id, answer.years);
  if (faith) faith.support = clampSupport(faith.support + (declare ? HOLY_WAR.support : -HOLY_WAR.support));
  hooks.logEvent(events, declare ? 'war_declared' : 'holy_war_refused', declare ? `Heligt krig mot ${realm.name}` : 'Härskaren avvisar det heliga kriget',
    declare ? `Hären går över gränsen mot ${realm.name} med prästernas välsignelse.` : `${realm.name} får vara i fred. Prästerskapet minns nejet.`, [story.actorId]);
}

/** Why an open call no longer stands, or '' while it does. Such a story closes with no effect. */
export function holyWarClosedReason(state, story, hooks) {
  const realm = state.foreignRealms?.find((entry) => entry.id === story.realmId);
  if (!realm || !targetable(realm)) return CLOSED.target;
  if (atWar(state)) return CLOSED.war;
  if (!living(state.people[story.callerId])) return CLOSED.caller;
  if (hooks.controlledFamily()?.id !== story.familyId) return CLOSED.family;
  if (!hooks.canRule()) return CLOSED.mandate;
  return hooks.activeRepresentative()?.id === story.actorId ? '' : CLOSED.replaced;
}

/** A save's date of the last call: absent until the priests first call, and never in Hadara. */
export function validateHolyWar(state) {
  if (!Object.hasOwn(state, 'lastHolyWarCall')) return;
  if (!state.historicalOrigin || normalizeGameDate(state.lastHolyWarCall) !== state.lastHolyWarCall) throw new Error('Sparfilens heliga krig är ogiltigt.');
}
