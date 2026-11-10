import { addGameMonths, compareGameDates, parseGameDate } from '../gameDates.js';
import { isImprisoned } from './prisoners.js';
import { byAge, childrenIndex } from './cadetBranches.js';

// A choice from ten years earlier comes back (spec docs/superpowers/specs/2026-11-10-decision-echo-design.md). Historical campaigns only. Nothing here draws from a random stream.
export const ECHO_TYPES = Object.freeze(['story_choice', 'story_patronage', 'story_fracture', 'chain_choice']);
export const ECHO_MIN = 5, ECHO_AMENDS_SILVER = 15, ECHO_FROM_MONTHS = 120, ECHO_TO_MONTHS = 132;
const DUE_MONTHS = 6, QUIET_MONTHS = 36, ASK_INFLUENCE = 8, APOLOGY_INFLUENCE = 5;
const CAUSES = Object.freeze({
  embrace: Object.freeze({ value: 15, years: 20, label: 'Ett minne från tio år sedan' }),
  ask: Object.freeze({ value: -5, years: 10, label: 'Gentjänsten är utkrävd' }),
  amends: Object.freeze({ value: 20, years: 20, label: 'Gottgjort' }),
  apologize: Object.freeze({ value: 12, years: 20, label: 'En offentlig ursäkt' }),
  stand: Object.freeze({ value: -15, years: 20, label: 'Ett gammalt agg' }),
});
const CLOSED = Object.freeze({ gone: 'Den som bar minnet kan inte längre föra det vidare.', replaced: 'Den som skulle svara företräder inte längre familjen eller riket.', family: 'Familjen som fattade beslutet styrs inte längre av spelaren.' });
const POOR = `Det behövs ${ECHO_AMENDS_SILVER} silver ur familjens kassa.`;

/** The choice-free end of an echo: a kind memory is welcomed, a harsh one is left standing. */
export const ECHO_EXPIRY = Object.freeze({ choiceId: 'embrace', text: 'Ingen svarade, men minnet bestod.' });
const HARSH_EXPIRY = Object.freeze({ choiceId: 'stand', text: 'Ingen svarade, och agget bestod.' });
export const echoExpiry = (story) => (story.tone === 'harsh' ? HARSH_EXPIRY : ECHO_EXPIRY);

const free = (state, person) => person && !person.diedAt && !isImprisoned(state, person.id);
const clamp = (n) => Math.min(100, Math.max(0, n));

/** Memory id → every opinion cause that names it, expired or not, as { fromId, toId, amount }. A chain choice can leave one per role. */
function causesByMemory(state) {
  const index = new Map();
  for (const rel of Object.values(state.relations)) for (const cause of rel?.causes || []) {
    if (typeof cause.causeId !== 'string') continue;
    if (!index.has(cause.causeId)) index.set(cause.causeId, []);
    index.get(cause.causeId).push({ fromId: rel.fromId, toId: rel.toId, amount: cause.amount });
  }
  return index;
}

/** The witness when free, adult and unshielded, else the witness's eldest such legal child; null when neither. */
function carrierFor(state, witnessId, hooks, index, shielded) {
  const fit = (person) => free(state, person) && hooks.adult(person) && !shielded.has(person.id);
  const witness = state.people[witnessId];
  if (fit(witness)) return witness;
  return (index.get(witnessId) || []).map((id) => state.people[id]).filter(fit).sort(byAge)[0] ?? null;
}

const inWindow = (state, memory) => compareGameDates(addGameMonths(memory.date, ECHO_FROM_MONTHS), state.date) <= 0 && compareGameDates(addGameMonths(memory.date, ECHO_TO_MONTHS), state.date) > 0;

/** The decision that comes back this year, as { memory, cause, carrier }, or null. Reads only. */
export function echoSource(state, hooks) {
  const family = hooks.controlledFamily(), shielded = new Set([hooks.ruler()?.id, hooks.activeRepresentative()?.id]);
  const causes = causesByMemory(state), index = childrenIndex(state);
  return state.memories.filter((memory) => ECHO_TYPES.includes(memory.type) && inWindow(state, memory))
    .flatMap((memory) => (causes.get(memory.id) || []).map((cause) => ({ memory, cause })))
    .filter(({ cause }) => Math.abs(cause.amount) >= ECHO_MIN && state.people[cause.toId]?.familyId === family?.id)
    .map((item) => ({ ...item, carrier: carrierFor(state, item.cause.fromId, hooks, index, new Set([...shielded, item.cause.toId])) }))
    .filter(({ carrier }) => carrier)
    .sort((a, b) => Math.abs(b.cause.amount) - Math.abs(a.cause.amount) || compareGameDates(a.memory.date, b.memory.date)
      || a.memory.id.localeCompare(b.memory.id) || a.cause.fromId.localeCompare(b.cause.fromId))[0] ?? null;
}

function describe(state, memory, cause, carrier) {
  const witness = state.people[cause.fromId], decider = state.people[cause.toId];
  const heir = carrier.id === witness.id ? '' : `${witness.name} är död, men ${carrier.name} bär minnet vidare. `;
  return `För tio år sedan beslutade ${decider.name}: ”${memory.title}”. ${heir}${cause.amount > 0 ? `${carrier.name} har inte glömt tjänsten.` : `${carrier.name} har inte förlåtit.`}`;
}

/** In courtAnnualStep: on a historical campaign a decision from ten years earlier comes back, at most one echo in three years. */
export function echoStep(state, events, hooks) {
  if (!state.historicalOrigin) return;
  const actor = hooks.activeRepresentative(), family = hooks.controlledFamily();
  const recent = (story) => story.type === 'decision_echo' && (story.status === 'open' || compareGameDates(addGameMonths(story.createdAt, QUIET_MONTHS), state.date) > 0);
  if (!actor || !family || state.stories.some(recent)) return;
  const source = echoSource(state, hooks);
  if (!source) return;
  const { memory, cause, carrier } = source, tone = cause.amount > 0 ? 'kind' : 'harsh';
  const title = `${carrier.name} minns ett beslut från ${parseGameDate(memory.date).year}`;
  state.stories.push({ id: `echo-${memory.id}`, type: 'decision_echo', status: 'open', title, description: describe(state, memory, cause, carrier), tone, causeId: memory.id, familyId: family.id, actorId: actor.id, carrierId: carrier.id, witnessId: cause.fromId, createdAt: state.date, dueAt: addGameMonths(state.date, DUE_MONTHS), knownBy: 'public' });
  hooks.logEvent(events, 'decision_echo', 'Ett gammalt beslut', `${carrier.name} minns ”${memory.title}”.`, [carrier.id, actor.id]);
}

const option = (id, label, description, cost = '0 silver', disabledReason = '') => ({ id, label, description, cost, stress: '0', disabledReason });

/** Two choices for a kind memory, three for a harsh one, with a Swedish reason where one cannot apply. */
export function echoChoices(state, story, hooks) {
  const name = state.people[story.carrierId].name, purse = state.families[story.familyId]?.treasury ?? 0;
  if (story.tone === 'kind') return [
    option('embrace', 'Knyt banden fastare', `${name} får en bättre bild av dig.`),
    option('ask', 'Be om en gentjänst', `Familjen vinner ${ASK_INFLUENCE} inflytande. ${name} tycker att tjänsten nu är betald.`),
  ];
  return [
    option('amends', 'Gottgör det gamla', `${name} får ersättning och försonas.`, `${ECHO_AMENDS_SILVER} silver`, purse < ECHO_AMENDS_SILVER ? POOR : ''),
    option('apologize', 'Be om ursäkt offentligt', `Familjen förlorar ${APOLOGY_INFLUENCE} inflytande. ${name} blir mildare stämd.`),
    option('stand', 'Stå fast vid beslutet', `${name} bär agget vidare.`),
  ];
}

/** Applies a choice resolveStory has already checked, or the expiry. */
export function resolveEcho(state, story, choiceId, events, hooks) {
  Object.assign(story, { status: 'resolved', choiceId, resolvedAt: state.date });
  // The family that decided pays and gains; echoClosedReason closes the story once the player no longer controls it.
  const family = state.families[story.familyId], cause = CAUSES[choiceId];
  if (choiceId === 'ask') family.influence = clamp(family.influence + ASK_INFLUENCE);
  if (choiceId === 'apologize') family.influence = clamp(family.influence - APOLOGY_INFLUENCE);
  if (choiceId === 'amends') family.treasury -= ECHO_AMENDS_SILVER;
  hooks.opinionCause(story.carrierId, story.actorId, cause.value, cause.label, `echo:${story.id}`, cause.years);
}

/** Why an open echo no longer stands, or '' while it does. Such a story closes with no effect. */
export function echoClosedReason(state, story, hooks) {
  if (!free(state, state.people[story.carrierId])) return CLOSED.gone;
  if (hooks.controlledFamily()?.id !== story.familyId) return CLOSED.family;
  return hooks.activeRepresentative()?.id === story.actorId ? '' : CLOSED.replaced;
}
