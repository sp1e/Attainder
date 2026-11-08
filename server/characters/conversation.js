import { addGameMonths, compareGameDates, normalizeGameDate } from '../gameDates.js';
import { ODDS_MAX, ODDS_MIN, chanceFromRows, precisionFor } from './actionOdds.js';
import { TRAITS } from './content.js';
import { capPrecision, loyaltyPrecision } from './council.js';
import { actionRandom } from './extensions.js';
import { IMPRISONED, isImprisoned } from './prisoners.js';
// useHook is imported as consumeHook: the react-hooks lint rule reads the name as a React hook.
import { HOOK_RESERVED, SECRET_LABELS, activeHooks, addSecretHolders, grantHook, knownSecrets, reservedHookIds, unreservedHooks, useHook as consumeHook } from './secrets.js';

// Conversation requests: the representative asks one person for support, a secret or a pledge. The model (Task 9) may only claim a score for the arguments; the engine grounds each argument in the state, caps the score again, draws one action roll and applies the outcome.
// The estimate is a pure function of the state. Resolution draws exactly one actionRandom and never touches the main or the plot stream. `hooks` are the engine's (actionHooks in index.js).

export const CONVERSATION_REQUESTS = Object.freeze({
  support: Object.freeze({ label: 'Ge sitt stöd', base: 45 }),
  reveal_secret: Object.freeze({ label: 'Avslöja en hemlighet', base: 25 }),
  pledge: Object.freeze({ label: 'Ge ett löfte', base: 30 }),
});
export const ARGUMENT_KINDS = Object.freeze(['offer', 'shared_enemy', 'shared_memory', 'hook']);
export const CONVERSATION_MONTHS = 12;
export const RECENT_REFUSAL = 'Ni talade om detta nyss. Personen vill inte bli tillfrågad igen än.';

const OPINION_DIVISOR = 4, OPINION_CAP = 20;
const LOYALTY_DIVISOR = 5;
const LOYALTY_ROW = 'Personens lojalitet';
const OFFER_DIVISOR = 4, OFFER_CAP = 15;
const GREEDY_BONUS = 8, HONEST_PENALTY = 10, PARANOID_PENALTY = 8, TRUSTING_BONUS = 6;
const HOOK_BONUS = 20;
const ARGUMENT_CAP = 10;
// An offer grounds an argument once its own gift row is worth half of what the argument can add: 5 points, so 20 silver. Below that a gift still earns its row, but a token sum cannot unlock the whole argument score.
const OFFER_GROUND_POINTS = ARGUMENT_CAP / 2;
const giftPoints = (silver) => Math.min(OFFER_CAP, Math.floor(silver / OFFER_DIVISOR));
const ENEMY_OPINION = -20;
const SUPPORT_OPINION = 10;
export const MAX_ARGUMENTS = 8;
// What a shared memory records decides how it weighs (spec 2026-11-08-memory-valence-design.md). Other types are neutral.
export const MEMORY_VALENCE = Object.freeze({
  favor: Object.freeze(['gift', 'appointment', 'education', 'patronage', 'story_patronage', 'promise_kept', 'adoption']),
  grievance: Object.freeze(['betrayal', 'insult', 'dismissal', 'imprisonment', 'crime', 'scheme_discovered', 'plot', 'refuge_lost', 'story_fracture']),
});
const FAVOR_ROW = 'En tjänst att minnas', FAVOR_BONUS = 5;
const GRIEVANCE_ROW = 'Personen minns ett agg', GRIEVANCE_PENALTY = 5, GRIEVANCE_CAP = 10;

const REASONS = Object.freeze({
  request: 'Samtalsförfrågan är ogiltig.',
  kind: 'Välj vad du vill be om.',
  person: 'Personen kan inte tillfrågas.',
  mandate: 'Ingen handlingsförmögen företrädare kan föra samtalet.',
  payer: 'Familjen saknar en handlingsförmögen företrädare som kan betala gåvan.',
  offer: 'Gåvan måste vara ett helt antal silver, noll eller mer.',
  score: 'Argumentens poäng måste vara ett heltal, noll eller mer.',
  arguments: 'Argumenten är ogiltiga.',
  hook: 'Övertaget finns inte, är förbrukat eller gäller inte denna person.',
  reserved: HOOK_RESERVED,
});
const INVALID = Object.freeze({
  list: 'Samtalen i sparfilen är ogiltiga.',
  entry: 'Ett samtal i sparfilen är ogiltigt.',
  id: 'Ett samtal har ett ogiltigt eller dubblerat id.',
  person: 'Ett samtal hänvisar till en saknad person.',
  date: 'Ett samtal har ett ogiltigt datum.',
  effects: 'Ett samtals följder stämmer inte med utgången.',
});
const KEYS = Object.freeze(['id', 'personId', 'kind', 'date', 'value', 'roll', 'accepted', 'effects']);
// charge() prices stress per tag and gives 0 for a tag it does not know, so paying an offer costs the representative no stress.
const PAID_TAG = 'conversation_offer';
const STRENGTH_LABELS = Object.freeze({ weak: 'svagt', strong: 'starkt' });

const plainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const ownKey = (map, key) => typeof key === 'string' && plainObject(map) && Object.hasOwn(map, key);
const list = (state) => (Array.isArray(state.conversations) ? state.conversations : []);
const personOf = (state, id) => (ownKey(state.people, id) ? state.people[id] : null);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const hasTrait = (person, trait) => Array.isArray(person.traits) && person.traits.includes(trait);
const traitLabel = (trait) => `Personen är ${TRAITS[trait].name.toLowerCase()}`;
const fail = (message) => { throw new Error(message); };
const numberOf = (id) => Number(/^conversation-([1-9]\d*)$/.exec(id)?.[1] ?? Number.NaN);
const canonical = (date) => typeof date === 'string' && normalizeGameDate(date) === date;
const naturalOrder = (a, b) => a.id.localeCompare(b.id, 'en', { numeric: true });

// Asked within the last twelve months, whatever the kind and the answer.
const askedRecently = (state, personId) => list(state).some((entry) => entry.personId === personId && compareGameDates(addGameMonths(entry.date, CONVERSATION_MONTHS), state.date) > 0);

// Why this person cannot be asked now, else ''. The representative asks adults of the controlled family and any holder of an office, from any family.
function personRefusal(state, person, representative, hooks) {
  if (!person || person.diedAt || person.id === representative.id) return REASONS.person;
  if (isImprisoned(state, person.id)) return IMPRISONED;
  const holdsOffice = Object.values(state.offices ?? {}).some((office) => office.holderId === person.id);
  const ownAdult = person.familyId === hooks.controlledFamily()?.id && hooks.adult(person);
  if (!holdsOffice && !ownAdult) return REASONS.person;
  return askedRecently(state, person.id) ? RECENT_REFUSAL : '';
}

// The representative, or null when nobody can speak: dead, unable to act or in prison.
function speakerFor(state, hooks) {
  const representative = hooks.activeRepresentative();
  return representative && !representative.diedAt && hooks.canExerciseMandate(representative) && !isImprisoned(state, representative.id) ? representative : null;
}

/** The people the representative may ask now, in id order. */
export function conversationTargets(state, hooks) {
  const representative = speakerFor(state, hooks);
  if (!representative) return [];
  return Object.values(state.people).filter((person) => personRefusal(state, person, representative, hooks) === '').sort(naturalOrder);
}

// Normalizes the parts of a request the model or the player gives: offer, score, hook id and the argument list.
function readRequest(request) {
  if (!plainObject(request)) return { reason: REASONS.request };
  if (!ownKey(CONVERSATION_REQUESTS, request.kind)) return { reason: REASONS.kind };
  if (typeof request.personId !== 'string') return { reason: REASONS.person };
  const offer = request.offerSilver ?? 0, score = request.argumentScore ?? 0, given = request.arguments ?? [];
  if (!Number.isInteger(offer) || offer < 0) return { reason: REASONS.offer };
  if (!Number.isInteger(score) || score < 0) return { reason: REASONS.score };
  if (request.hookId != null && typeof request.hookId !== 'string') return { reason: REASONS.hook };
  const valid = Array.isArray(given) && given.length <= MAX_ARGUMENTS && given.every((item) => plainObject(item) && ARGUMENT_KINDS.includes(item.kind) && (item.refId == null || typeof item.refId === 'string'));
  if (!valid) return { reason: REASONS.arguments };
  return { kind: request.kind, personId: request.personId, offer, score, hookId: request.hookId ?? null, given: given.map((item) => ({ kind: item.kind, refId: item.refId ?? null })) };
}

const knownByBoth = (memory, aId, bId) => memory.knownBy === 'public' || memory.public === true || (Array.isArray(memory.knownBy) && memory.knownBy.includes(aId) && memory.knownBy.includes(bId));

// The memory a shared_memory argument names, when both people took part and both know it, else null.
function sharedMemory(state, argument, representative, speaker) {
  const memory = Array.isArray(state.memories) ? state.memories.find((item) => item?.id === argument.refId) : null;
  const shared = memory && Array.isArray(memory.participants) && memory.participants.includes(representative.id) && memory.participants.includes(speaker.id);
  return shared && knownByBoth(memory, representative.id, speaker.id) ? memory : null;
}

// The distinct grievances among the cited memories: each one the speaker shares and knows counts against the request.
function citedGrievances(state, given, representative, speaker) {
  const ids = new Set(given.filter((argument) => argument.kind === 'shared_memory')
    .map((argument) => sharedMemory(state, argument, representative, speaker))
    .filter((memory) => memory && MEMORY_VALENCE.grievance.includes(memory.type)).map((memory) => memory.id));
  return ids.size;
}

// Whether one argument refers to something that exists in the state. A claim without a basis earns nothing.
function grounded(state, argument, ctx) {
  const { representative, speaker, offer, hookId, hooks } = ctx;
  if (argument.kind === 'offer') return giftPoints(offer) >= OFFER_GROUND_POINTS;
  if (argument.kind === 'hook') return hookId !== null && (argument.refId === null || argument.refId === hookId);
  if (argument.kind === 'shared_memory') {
    const memory = sharedMemory(state, argument, representative, speaker);
    return Boolean(memory) && !MEMORY_VALENCE.grievance.includes(memory.type);
  }
  const enemy = personOf(state, argument.refId);
  return Boolean(enemy) && !enemy.diedAt && enemy.id !== representative.id && enemy.id !== speaker.id
    && hooks.getPersonalOpinion(speaker.id, enemy.id) <= ENEMY_OPINION && hooks.getPersonalOpinion(representative.id, enemy.id) <= ENEMY_OPINION;
}

// Distinct grounded arguments in the order given.
function groundedArguments(state, given, ctx) {
  const seen = new Set();
  return given.filter((argument) => {
    const key = `${argument.kind}|${argument.refId}`;
    if (seen.has(key) || !grounded(state, argument, ctx)) return false;
    seen.add(key);
    return true;
  });
}

function buildRows(state, read, speaker, representative, ctx, grounding, hooks) {
  const rows = [{ label: 'Grundchans', value: CONVERSATION_REQUESTS[read.kind].base }];
  const add = (label, value) => { if (value !== 0) rows.push({ label, value }); };
  add('Personens åsikt om dig', clamp(Math.round(hooks.getPersonalOpinion(speaker.id, representative.id) / OPINION_DIVISOR), -OPINION_CAP, OPINION_CAP));
  add(LOYALTY_ROW, Math.round(((Number.isFinite(speaker.loyalty) ? speaker.loyalty : 50) - 50) / LOYALTY_DIVISOR));
  add('Erbjuden gåva', giftPoints(read.offer));
  if (read.offer > 0 && hasTrait(speaker, 'greedy')) add(traitLabel('greedy'), GREEDY_BONUS);
  if (read.kind === 'reveal_secret' && hasTrait(speaker, 'honest')) add(traitLabel('honest'), -HONEST_PENALTY);
  if (hasTrait(speaker, 'paranoid')) add(traitLabel('paranoid'), -PARANOID_PENALTY);
  if (hasTrait(speaker, 'trusting')) add(traitLabel('trusting'), TRUSTING_BONUS);
  if (ctx.hookId !== null) add('Övertag över personen', HOOK_BONUS);
  if (grounding.length) add('Övertygande argument', Math.min(ARGUMENT_CAP, read.score));
  if (grounding.some((argument) => argument.kind === 'shared_memory'
    && MEMORY_VALENCE.favor.includes(sharedMemory(state, argument, representative, speaker)?.type))) add(FAVOR_ROW, FAVOR_BONUS);
  add(GRIEVANCE_ROW, -Math.min(GRIEVANCE_CAP, GRIEVANCE_PENALTY * citedGrievances(state, read.given, representative, speaker)));
  return rows;
}

/**
 * Odds for one conversation request, or a Swedish refusal. `request` is { personId, kind, offerSilver, hookId, arguments: [{ kind, refId }], argumentScore }. Pure: no randomness, no spending, no edit.
 * Rows: Grundchans (by kind), the speaker's opinion of the representative (round(op / 4), ±20), loyalty (round((loyalty − 50) / 5)), the offer (floor(silver / 4), at most 15), greedy +8 with any offer, honest −10 for a secret, paranoid −8, trusting +6, a hook +20, and `Övertygande argument` = min(10, argumentScore) when at least one argument is grounded. The value is cut to 5 to 95; the cut is a row of its own.
 * An argument counts only when it refers to something real: an offer needs 20 silver, a shared enemy a living person both hold at −20 or lower, a shared memory one both took part in and know, a hook an active hook of the representative over the speaker named by hookId. A hook an active scheme holds in its means is refused.
 * The result carries the true `value` and `modifiers` for rolling and `display`, which follows `precision` (the representative's diplomacy, as for Phase 1's odds, capped at the loyalty precision because an exact row `Personens lojalitet` would reveal loyalty) and never carries a number at 'five' or 'three'.
 */
export function estimateConversation(state, request, hooks) {
  const read = readRequest(request);
  if (read.reason) return { ok: false, reason: read.reason };
  const representative = speakerFor(state, hooks), speaker = personOf(state, read.personId);
  if (!representative) return { ok: false, reason: REASONS.mandate };
  const reason = personRefusal(state, speaker, representative, hooks);
  if (reason) return { ok: false, reason };
  const payer = hooks.householdRepresentative();
  if (read.offer > 0 && !(payer && !payer.diedAt && hooks.canExerciseMandate(payer))) return { ok: false, reason: REASONS.payer };
  const purse = hooks.controlledFamily()?.treasury ?? 0;
  if (read.offer > purse) return { ok: false, reason: `Det behövs ${read.offer} silver; tillgängligt ${Math.floor(purse)}.` };
  if (read.hookId !== null && !activeHooks(state, representative.id, speaker.id).some((hook) => hook.id === read.hookId)) return { ok: false, reason: REASONS.hook };
  if (read.hookId !== null && reservedHookIds(state).has(read.hookId)) return { ok: false, reason: REASONS.reserved };
  const ctx = { representative, speaker, offer: read.offer, hookId: read.hookId, hooks };
  const grounding = groundedArguments(state, read.given, ctx);
  const rows = buildRows(state, read, speaker, representative, ctx, grounding, hooks);
  const precision = capPrecision(precisionFor(representative.skills?.diplomacy), loyaltyPrecision(state, hooks));
  const { value, modifiers, display } = chanceFromRows(rows, precision, LOYALTY_ROW);
  return { ok: true, personId: speaker.id, kind: read.kind, offerSilver: read.offer, hookId: read.hookId, value, modifiers, precision, display, groundedArguments: grounding };
}

// The secret the speaker holds and the representative lacks, strongest evidence first and the lowest id among equals; exposed secrets are no longer secret.
function strongestSecret(state, speaker, representative) {
  const lacking = knownSecrets(state, speaker.id).filter((secret) => !secret.exposed && secret.holderIds.includes(speaker.id) && !secret.holderIds.includes(representative.id));
  return lacking.sort((a, b) => (a.evidence === b.evidence ? naturalOrder(a, b) : a.evidence === 'strong' ? -1 : 1))[0] ?? null;
}

// A secret learned in conversation is also known to its cause memory, so the player sees what the representative now holds.
function shareCauseMemory(state, secret, representative) {
  const memory = Array.isArray(state.memories) ? state.memories.find((item) => item.id === secret.causeId) : null;
  if (memory && Array.isArray(memory.knownBy) && !memory.knownBy.includes(representative.id)) memory.knownBy.push(representative.id);
}

const APPLY = {
  support(state, { representative, speaker, note }, hooks) {
    hooks.opinionCause(speaker.id, representative.id, SUPPORT_OPINION, 'Stöd i samtal', note.id);
    return [{ kind: 'opinion', fromId: speaker.id, toId: representative.id, amount: SUPPORT_OPINION }];
  },
  reveal_secret(state, { representative, speaker }) {
    const secret = strongestSecret(state, speaker, representative);
    if (secret) { addSecretHolders(state, secret.id, [representative.id]); shareCauseMemory(state, secret, representative); }
    return [{ kind: 'secret', secretId: secret ? secret.id : null }];
  },
  pledge(state, { representative, speaker, note }) {
    const hook = grantHook(state, { ownerId: representative.id, targetId: speaker.id, strength: 'weak', causeId: note.id });
    return [{ kind: 'hook', hookId: hook.id }];
  },
};

// What the request asks for, as it reads after "bad <person>".
const ASKED = Object.freeze({ support: 'om stöd', reveal_secret: 'att berätta en hemlighet', pledge: 'om ett löfte' });

// Title and text of the chronicle event. `empty` marks a reveal that was accepted but had no secret to give.
function describe(representative, speaker, kind, accepted, empty) {
  const asked = `${representative.name} bad ${speaker.name} ${ASKED[kind]}`;
  if (!accepted) return { title: `${speaker.name} avvisar förfrågan`, text: `${asked} men fick nej.` };
  if (kind === 'support') return { title: `${speaker.name} ger sitt stöd`, text: `${asked} och fick ja.` };
  if (kind === 'pledge') return { title: `${speaker.name} ger ett löfte`, text: `${asked} och fick ja.` };
  if (empty) return { title: `${speaker.name} har inget att berätta`, text: `${asked}, men ${speaker.name} hade inget att berätta.` };
  return { title: `${speaker.name} anförtror sig`, text: `${asked} och fick ja.` };
}

/**
 * Runs the command converse_request: payload is the request of estimateConversation. Re-estimates (the model's score is capped again), draws one actionRandom roll (accepted when roll < value), spends a used hook either way, and on acceptance pays the offer from the family wallet (no order point) and applies the kind's effect: support +10 opinion (`Stöd i samtal`), reveal_secret the speaker's strongest unexposed secret the representative lacks (none: accepted with secretId null), pledge a weak hook of the representative over the speaker. A refusal pays nothing.
 * Both outcomes write a memory known by the two and a state.conversations entry { id, personId, kind, date, value, roll, accepted, effects }. Throws the estimate's Swedish reason when the request is refused; nothing is drawn then.
 */
export function converse(state, request, events, hooks) {
  const estimate = estimateConversation(state, request, hooks);
  if (!estimate.ok) throw new Error(estimate.reason);
  const representative = hooks.activeRepresentative(), speaker = state.people[estimate.personId];
  const { offerSilver: offer, hookId } = estimate, effects = [];
  // consumeHook spends a weak hook; a strong one stays usable, so only a spent hook is recorded.
  if (hookId !== null && consumeHook(state, hookId).usedAt !== null) effects.push({ kind: 'hook_spent', hookId });
  const roll = actionRandom(state) * 100, accepted = roll < estimate.value;
  if (accepted && offer > 0) { hooks.charge(offer, { orders: 0, tag: PAID_TAG }); effects.push({ kind: 'silver', amount: offer }); }
  const empty = accepted && estimate.kind === 'reveal_secret' && !strongestSecret(state, speaker, representative);
  const outcome = describe(representative, speaker, estimate.kind, accepted, empty);
  const event = hooks.logEvent(events, 'conversation', outcome.title, outcome.text, [representative.id, speaker.id]);
  const note = hooks.memory('conversation', outcome.title, [representative.id, speaker.id], { causeId: event.id, knownBy: [representative.id, speaker.id] });
  effects.push({ kind: 'memory', memoryId: note.id });
  if (accepted) effects.push(...APPLY[estimate.kind](state, { representative, speaker, note }, hooks));
  state.conversations.push({ id: `conversation-${++state.sequence}`, personId: speaker.id, kind: estimate.kind, date: state.date, value: estimate.value, roll, accepted, effects });
}

const BRIEF_MEMORIES = 12;
const knownTo = (memory, personId) => memory.knownBy === 'public' || memory.public === true || (Array.isArray(memory.knownBy) && memory.knownBy.includes(personId));

/**
 * What the model may know to speak as one person: name, traits, offices, the opinion of the representative with its reasons, up to twelve memories that involve the speaker or the representative and that both the speaker and the representative know (the presentation's visibility rule: public or known by the representative; newest first, with ids), the secrets the speaker and the representative both hold as a type label and a subject name only (no id, no evidence, no other holder), and the representative's active hooks over the speaker that no active scheme holds in its means. A private memory or a secret only the speaker holds never reaches the model, so the reply cannot leak it. Pure: no randomness, no edit. Null when the person or the representative is missing. `hooks` need activeRepresentative, getPersonalOpinion and opinionReasons (actionHooks in index.js).
 */
export function conversationBrief(state, personId, hooks) {
  const speaker = personOf(state, personId), representative = hooks.activeRepresentative();
  if (!speaker || !representative) return null;
  const name = (id) => personOf(state, id)?.name ?? id;
  const memories = (Array.isArray(state.memories) ? state.memories : [])
    .filter((memory) => knownTo(memory, speaker.id) && knownTo(memory, representative.id) && Array.isArray(memory.participants) && (memory.participants.includes(speaker.id) || memory.participants.includes(representative.id)))
    .reverse().slice(0, BRIEF_MEMORIES)
    .map((memory) => ({ id: memory.id, date: memory.date, title: memory.title, participantNames: memory.participants.map(name) }));
  const secrets = (Array.isArray(state.secrets) ? state.secrets : []).filter((secret) => secret.holderIds.includes(speaker.id) && secret.holderIds.includes(representative.id))
    .map((secret) => ({ typeLabel: SECRET_LABELS[secret.type], subjectName: name(secret.subjectId) }));
  return {
    personId: speaker.id, name: speaker.name, familyName: state.families?.[speaker.familyId]?.name ?? '',
    traits: (speaker.traits ?? []).map((trait) => TRAITS[trait]?.name ?? trait),
    offices: Object.values(state.offices ?? {}).filter((office) => office.holderId === speaker.id).map((office) => office.name),
    opinion: hooks.getPersonalOpinion(speaker.id, representative.id),
    opinionReasons: hooks.opinionReasons(speaker.id, representative.id).map(({ label, value }) => ({ label, value })),
    memories, secrets,
    hooks: unreservedHooks(state, representative.id, speaker.id).map((hook) => ({ id: hook.id, strength: hook.strength, strengthLabel: STRENGTH_LABELS[hook.strength] })),
  };
}

/** What the player sees of the conversation tools: who may be asked now, the representative's own unspent hooks and the secrets the representative knows. Names, type labels and the strength of the evidence only; who else holds a secret never leaves the engine. */
export function presentConversation(state, hooks) {
  const representative = speakerFor(state, hooks);
  const name = (id) => personOf(state, id)?.name ?? id;
  const targets = conversationTargets(state, hooks).map((person) => ({ id: person.id, name: person.name, familyName: state.families?.[person.familyId]?.name ?? '' }));
  const own = representative ? activeHooks(state, representative.id) : [];
  const secrets = representative ? knownSecrets(state, representative.id) : [];
  return {
    conversationTargets: targets,
    ownHooks: own.map((hook) => ({ id: hook.id, targetId: hook.targetId, targetName: name(hook.targetId), strength: hook.strength, strengthLabel: STRENGTH_LABELS[hook.strength] })),
    knownSecrets: secrets.map((secret) => ({ id: secret.id, type: secret.type, typeLabel: SECRET_LABELS[secret.type], subjectId: secret.subjectId, subjectName: name(secret.subjectId), evidence: secret.evidence, evidenceLabel: STRENGTH_LABELS[secret.evidence], exposed: secret.exposed })),
  };
}

// Which effect kinds an entry must carry for each request kind when accepted, and the ones a refusal may carry.
const OUTCOME_EFFECT = Object.freeze({ support: 'opinion', reveal_secret: 'secret', pledge: 'hook' });
const OUTCOME_KINDS = Object.freeze(['opinion', 'secret', 'hook', 'silver']);

function checkEffect(state, entry, effect) {
  if (!plainObject(effect)) fail(INVALID.effects);
  const exists = (collection, id) => Array.isArray(state[collection]) && state[collection].some((item) => item?.id === id);
  if (effect.kind === 'memory') return exists('memories', effect.memoryId) || fail(INVALID.effects);
  if (effect.kind === 'hook_spent') return state.hooks?.some((hook) => hook?.id === effect.hookId && hook.strength === 'weak' && hook.usedAt !== null) || fail(INVALID.effects);
  if (!entry.accepted || !OUTCOME_KINDS.includes(effect.kind)) fail(INVALID.effects);
  if (effect.kind === 'silver') return (Number.isInteger(effect.amount) && effect.amount > 0) || fail(INVALID.effects);
  if (effect.kind === 'opinion') return (effect.fromId === entry.personId && personOf(state, effect.toId) && effect.amount === SUPPORT_OPINION) || fail(INVALID.effects);
  if (effect.kind === 'hook') return exists('hooks', effect.hookId) || fail(INVALID.effects);
  return effect.secretId === null || exists('secrets', effect.secretId) || fail(INVALID.effects);
}

function checkEntry(state, entry, ids) {
  if (!plainObject(entry) || Object.keys(entry).length !== KEYS.length || !KEYS.every((key) => Object.hasOwn(entry, key))) fail(INVALID.entry);
  const number = numberOf(entry.id);
  if (!Number.isInteger(number) || number > state.sequence || ids.has(entry.id)) fail(INVALID.id);
  if (!ownKey(CONVERSATION_REQUESTS, entry.kind) || typeof entry.accepted !== 'boolean') fail(INVALID.entry);
  if (!personOf(state, entry.personId)) fail(INVALID.person);
  if (!canonical(entry.date) || compareGameDates(entry.date, state.date) > 0) fail(INVALID.date);
  if (!Number.isInteger(entry.value) || entry.value < ODDS_MIN || entry.value > ODDS_MAX) fail(INVALID.entry);
  if (typeof entry.roll !== 'number' || !Number.isFinite(entry.roll) || entry.roll < 0 || entry.roll >= 100 || entry.accepted !== entry.roll < entry.value) fail(INVALID.entry);
  if (!Array.isArray(entry.effects)) fail(INVALID.effects);
  for (const effect of entry.effects) checkEffect(state, entry, effect);
  const count = (kind) => entry.effects.filter((effect) => effect.kind === kind).length;
  if (count('memory') !== 1 || count('silver') > 1 || count('hook_spent') > 1) fail(INVALID.effects);
  const outcomes = entry.effects.filter((effect) => ['opinion', 'secret', 'hook'].includes(effect.kind));
  if (outcomes.length !== (entry.accepted ? 1 : 0) || outcomes.some((effect) => effect.kind !== OUTCOME_EFFECT[entry.kind])) fail(INVALID.effects);
}

/** Validates state.conversations on load: `conversation-<n>` ids unique and within state.sequence, a known kind and person, a canonical date not after today, a value from 5 to 95, a roll from 0 to 100 that agrees with `accepted`, and effects that fit the kind and the outcome (one memory, a refusal carrying no outcome). */
export function validateConversations(state) {
  if (!Array.isArray(state.conversations)) fail(INVALID.list);
  const ids = new Set();
  for (const entry of state.conversations) {
    checkEntry(state, entry, ids);
    ids.add(entry.id);
  }
}
