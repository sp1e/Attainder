import { addGameMonths, compareGameDates, gameDateYear, normalizeGameDate } from '../gameDates.js';
import { chanceFromRows, precisionFor } from './actionOdds.js';
import { rememberAbroad } from './alliances.js';
import { getCharacterAge } from './characterCapacity.js';
import { WAR_ENDS, borderLand, endWar } from './claims.js';
import { hashRoll } from './duels.js';
import { foreignOpinion } from './foreignRealms.js';

// An envoy to a king who remembers (spec docs/superpowers/specs/2026-11-10-envoys-design.md). Historical campaigns only.
// The model reads the player's words into a request and may claim a score for the arguments; the engine grounds each argument in the realm's memories, caps the score and rolls by hashRoll. No stream moves.
export const ENVOY_REQUESTS = Object.freeze({
  reconcile: Object.freeze({ label: 'Be om försoning', base: 35 }),
  peace: Object.freeze({ label: 'Be om fred', base: 30 }),
});
export const ENVOY_ARGUMENT_KINDS = Object.freeze(['offer', 'shared_memory']);
export const ENVOY = Object.freeze({ months: 12, maxArguments: 8, memoryCap: 20, offerCap: 15, offerGround: 20, argumentCap: 10, grievance: 5, grievanceCap: 10,
  reconciled: Object.freeze({ label: 'Försoning', amount: 25, years: 20 }), treaty: Object.freeze({ label: 'Fred genom förhandling', amount: 10, years: 10 }) });
const REASONS = Object.freeze({ hadara: 'Sändebud finns bara i historiska kampanjer.', request: 'Förfrågan till grannriket är ogiltig.', kind: 'Välj vad sändebudet ska be om.',
  realm: 'Välj ett grannrike.', recent: 'Ett sändebud var där nyss. Riket tar inte emot ett nytt förrän om ett år.', peace: 'Riket är inte i krig med er.',
  offer: 'Gåvan måste vara ett helt antal silver, noll eller mer.', score: 'Argumentens poäng måste vara ett heltal, noll eller mer.', arguments: 'Argumenten är ogiltiga.', mandate: 'Sändebud kräver härskarens eller regentens mandat.',
  orders: 'Årets handlingar är slut. För tiden framåt.', bigOffer: 'Gåvan kan vara högst 60 silver.' });
const MEMORY_CUT = 'Minnena väger högst 20';

const plain = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const live = (state, realm) => realm.memories.filter((memory) => compareGameDates(memory.until, state.date) > 0);
/** The reference a shared_memory argument uses for one of the realm's memories. */
export const memoryRef = (memory) => `${memory.date}|${memory.label}`;
const realmOf = (state, realmId) => (typeof realmId === 'string' ? state.foreignRealms?.find((realm) => realm.id === realmId) : undefined);
const giftPoints = (silver) => Math.min(ENVOY.offerCap, Math.floor(silver / 4));

function readRequest(request) {
  if (!plain(request)) return { reason: REASONS.request };
  if (typeof request.kind !== 'string' || !Object.hasOwn(ENVOY_REQUESTS, request.kind)) return { reason: REASONS.kind };
  const offer = request.offerSilver ?? 0, score = request.argumentScore ?? 0, given = request.arguments ?? [];
  if (!Number.isInteger(offer) || offer < 0) return { reason: REASONS.offer };
  if (offer > ENVOY.offerCap * 4) return { reason: REASONS.bigOffer };
  if (!Number.isInteger(score) || score < 0) return { reason: REASONS.score };
  const valid = Array.isArray(given) && given.length <= ENVOY.maxArguments && given.every((item) => plain(item) && ENVOY_ARGUMENT_KINDS.includes(item.kind) && (item.refId == null || typeof item.refId === 'string'));
  if (!valid) return { reason: REASONS.arguments };
  return { realmId: request.realmId, kind: request.kind, offer, score, given: given.map((item) => ({ kind: item.kind, refId: item.refId ?? null })) };
}

/** Why this realm cannot receive an envoy now, or ''. Reads only. */
export function envoyRefusal(state, realm, kind, hooks) {
  if (!state.historicalOrigin) return REASONS.hadara;
  if (!realm) return REASONS.realm;
  if (!hooks.canRule()) return REASONS.mandate;
  if (realm.lastEnvoy && compareGameDates(addGameMonths(realm.lastEnvoy.date, ENVOY.months), state.date) > 0) return REASONS.recent;
  return kind === 'peace' && !realm.war ? REASONS.peace : '';
}

/** The realms an envoy can reach now, as `{ value, label }`. Reads only. */
export const envoyTargets = (state, hooks) => (state.historicalOrigin ? state.foreignRealms.filter((realm) => envoyRefusal(state, realm, 'reconcile', hooks) === '')
  .map((realm) => ({ value: realm.id, label: realm.name })) : []);

// One row per live memory, worth a quarter of its amount rounded the same way for grievances and favors; together held to ±20 by a cut row of their own.
function memoryRows(state, realm) {
  const rows = live(state, realm).map((memory) => ({ label: `${memory.label} (${gameDateYear(memory.date)})`, value: Math.sign(memory.amount) * Math.round(Math.abs(memory.amount) / 4) })).filter((row) => row.value !== 0);
  const sum = rows.reduce((total, row) => total + row.value, 0), held = Math.max(-ENVOY.memoryCap, Math.min(ENVOY.memoryCap, sum));
  return held === sum ? rows : [...rows, { label: MEMORY_CUT, value: held - sum }];
}

// An offer counts from 20 silver, a shared memory when it names a live memory the realm holds in the player's favor.
function groundedArguments(state, realm, read) {
  const seen = new Set();
  return read.given.filter((argument) => {
    const key = `${argument.kind}|${argument.refId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    if (argument.kind === 'offer') return read.offer >= ENVOY.offerGround;
    return live(state, realm).some((memory) => memoryRef(memory) === argument.refId && memory.amount > 0);
  });
}

const citedGrievances = (state, realm, read) => new Set(read.given.filter((argument) => argument.kind === 'shared_memory')
  .filter((argument) => live(state, realm).some((memory) => memoryRef(memory) === argument.refId && memory.amount < 0)).map((argument) => argument.refId)).size;

function buildRows(state, realm, read, grounding) {
  const rows = [{ label: 'Grundchans', value: ENVOY_REQUESTS[read.kind].base }, ...memoryRows(state, realm)];
  const add = (label, value) => { if (value !== 0) rows.push({ label, value }); };
  add('Erbjuden gåva', giftPoints(read.offer));
  if (grounding.length) add('Övertygande argument', Math.min(ENVOY.argumentCap, read.score));
  add('Ni påminner om ett agg', -Math.min(ENVOY.grievanceCap, ENVOY.grievance * citedGrievances(state, realm, read)));
  return rows;
}

/** Odds for one envoy request, or a Swedish refusal. `request` is { realmId, kind, offerSilver, arguments: [{ kind, refId }], argumentScore }. Pure. */
export function estimateEnvoy(state, request, hooks) {
  const read = readRequest(request);
  if (read.reason) return { ok: false, reason: read.reason };
  const realm = realmOf(state, read.realmId), reason = envoyRefusal(state, realm, read.kind, hooks);
  if (reason) return { ok: false, reason };
  if (state.actionPoints < 1) return { ok: false, reason: REASONS.orders };
  if (read.offer > state.realm.treasury) return { ok: false, reason: `Det behövs ${read.offer} silver; tillgängligt ${Math.floor(state.realm.treasury)}.` };
  const grounding = groundedArguments(state, realm, read);
  const precision = precisionFor(hooks.activeRepresentative()?.skills?.diplomacy);
  const { value, modifiers, display } = chanceFromRows(buildRows(state, realm, read, grounding), precision);
  return { ok: true, realmId: realm.id, kind: read.kind, offerSilver: read.offer, value, modifiers, precision, display, groundedArguments: grounding };
}

function apply(state, realm, kind, events, hooks) {
  if (kind === 'reconcile') return rememberAbroad(state, realm, ENVOY.reconciled);
  endWar(state, realm, { ...WAR_ENDS.stalemate, prestige: 0, memory: ENVOY.treaty }, events, hooks, `Sändebuden sluter fred. ${borderLand(realm)} stannar hos ${realm.name}.`);
}

/** Runs the command envoy_request after requireRule: one order, the roll, and on acceptance the offer and the outcome. */
export function sendEnvoy(state, request, actor, events, hooks) {
  const estimate = estimateEnvoy(state, request, hooks);
  if (!estimate.ok) throw new Error(estimate.reason);
  const realm = realmOf(state, estimate.realmId), ruler = realm.people[realm.rulerId];
  hooks.charge(0, { publicFunds: true, tag: 'duty' });
  const roll = hashRoll(`${realm.id}|${state.date}|${estimate.kind}|${state.plotRngState}|envoy`) * 100, accepted = roll < estimate.value;
  if (accepted && estimate.offerSilver > 0) hooks.charge(estimate.offerSilver, { publicFunds: true, orders: 0, tag: 'generous' });
  realm.lastEnvoy = { date: state.date, kind: estimate.kind, value: estimate.value, accepted };
  hooks.logEvent(events, 'envoy', accepted ? `${ruler.name} tar emot sändebudet` : `${ruler.name} avvisar sändebudet`,
    `${actor.name} sände bud till ${realm.name} ${estimate.kind === 'peace' ? 'om fred' : 'om försoning'}${accepted ? ' och fick ja.' : ' men fick nej.'}`, [actor.id]);
  if (accepted) apply(state, realm, estimate.kind, events, hooks);
}

/** What the model may know to speak as the realm's ruler: names, age, opinion, live memories and the standing between the realms. No odds, no roll. Null when the realm is missing. */
export function envoyBrief(state, realmId) {
  const realm = realmOf(state, realmId);
  if (!state.historicalOrigin || !realm) return null;
  const ruler = realm.people[realm.rulerId];
  return { realmId: realm.id, realmName: realm.name, rulerName: ruler.name, rulerAge: getCharacterAge(ruler, state.date), opinion: foreignOpinion(state, realm.id),
    memories: live(state, realm).map((memory) => ({ refId: memoryRef(memory), label: memory.label, year: gameDateYear(memory.date), favorable: memory.amount > 0 })),
    allied: Boolean(realm.alliance), claim: realm.claim?.status ?? null, atWar: Boolean(realm.war) };
}

/** A save's lastEnvoy on one realm; absent in older saves. */
export const validEnvoy = (envoy) => envoy == null || (plain(envoy) && normalizeGameDate(envoy.date) === envoy.date && Object.hasOwn(ENVOY_REQUESTS, envoy.kind)
  && Number.isInteger(envoy.value) && envoy.value >= 5 && envoy.value <= 95 && typeof envoy.accepted === 'boolean');
