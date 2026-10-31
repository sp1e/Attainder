import { compareGameDates, normalizeGameDate } from '../gameDates.js';

// Secrets, hooks and relationships are stored in the save (extensions version 1). Nothing here draws from a random stream: every function is a pure edit of the state it is given, and the only counter it spends is state.sequence for new ids.
export const SECRET_TYPES = Object.freeze(['murder', 'affair', 'illegitimate_child', 'heresy', 'plot']);
export const RELATIONSHIP_KINDS = Object.freeze(['friend', 'rival', 'lover', 'nemesis']);
export const EVIDENCE_LEVELS = Object.freeze(['weak', 'strong']);
export const HOOK_STRENGTHS = Object.freeze(['weak', 'strong']);

// One Swedish sentence per failure class. The create functions and validateSecrets throw the same sentences.
const MESSAGES = {
  secret: { id: 'En hemlighet har ogiltigt eller dubblerat id.', kind: 'En hemlighet har ogiltig typ eller bevisnivå.', person: 'En hemlighet hänvisar till en saknad eller dubblerad person.', cause: 'En hemlighet hänvisar till ett saknat orsaksminne.', date: 'En hemlighets tidpunkter eller avslöjandestatus är ogiltiga.' },
  hook: { id: 'Ett övertag har ogiltigt eller dubblerat id.', kind: 'Ett övertag har ogiltig styrka.', person: 'Ett övertag hänvisar till en saknad person.', pair: 'Ett övertag måste gälla två olika personer.', cause: 'Ett övertag hänvisar till ett saknat orsaksminne.', date: 'Ett övertags tidpunkter är ogiltiga.' },
  relationship: { id: 'En relation har ogiltigt eller dubblerat id.', kind: 'En relation har ogiltigt slag.', person: 'En relation hänvisar till en saknad person.', pair: 'En relation måste gälla två olika personer.', cause: 'En relation hänvisar till ett saknat orsaksminne.', date: 'En relations tidpunkt är ogiltig.', dup: 'Två relationer av samma slag gäller samma par.' },
};
const COLLECTIONS_MESSAGE = 'Karaktärstilläggens samlingar är ogiltiga.';

const alive = (person) => Boolean(person && !person.diedAt);
const safeId = (id) => typeof id === 'string' && /^[a-zA-Z0-9_:.-]{1,160}$/.test(id);
const plainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const canonical = (date) => typeof date === 'string' && Boolean(date) && normalizeGameDate(date) === date;
const onOrBefore = (date, limit) => canonical(date) && compareGameDates(date, limit) <= 0;
// Own keys only, so inherited names such as toString are not people.
const personOf = (state, id) => typeof id === 'string' && plainObject(state.people) && Object.hasOwn(state.people, id) ? state.people[id] : null;
const memoryIds = (state) => new Set((Array.isArray(state.memories) ? state.memories : []).map((memory) => memory?.id).filter((id) => typeof id === 'string'));
const missingCause = (causeId, known) => causeId !== null && !(typeof causeId === 'string' && known.has(causeId));
const pairKey = (record) => [record.kind, ...[record.aId, record.bId].sort()].join('|');

function checkSecret(state, secret, known) {
  const m = MESSAGES.secret;
  if (!plainObject(secret) || !safeId(secret.id)) throw new Error(m.id);
  if (!SECRET_TYPES.includes(secret.type) || !EVIDENCE_LEVELS.includes(secret.evidence)) throw new Error(m.kind);
  if (!personOf(state, secret.subjectId) || !Array.isArray(secret.holderIds) || secret.holderIds.some((id) => !personOf(state, id)) || new Set(secret.holderIds).size !== secret.holderIds.length) throw new Error(m.person);
  if (missingCause(secret.causeId, known)) throw new Error(m.cause);
  const created = onOrBefore(secret.createdAt, state.date);
  const exposure = secret.exposed === true ? created && onOrBefore(secret.exposedAt, state.date) && compareGameDates(secret.exposedAt, secret.createdAt) >= 0 : secret.exposed === false && secret.exposedAt == null;
  if (!created || !exposure) throw new Error(m.date);
}

function checkHook(state, hook, known) {
  const m = MESSAGES.hook;
  if (!plainObject(hook) || !safeId(hook.id)) throw new Error(m.id);
  if (!HOOK_STRENGTHS.includes(hook.strength)) throw new Error(m.kind);
  if (!personOf(state, hook.ownerId) || !personOf(state, hook.targetId)) throw new Error(m.person);
  if (hook.ownerId === hook.targetId) throw new Error(m.pair);
  if (missingCause(hook.causeId, known)) throw new Error(m.cause);
  const created = onOrBefore(hook.createdAt, state.date);
  if (!created || (hook.usedAt !== null && !(onOrBefore(hook.usedAt, state.date) && compareGameDates(hook.usedAt, hook.createdAt) >= 0))) throw new Error(m.date);
}

function checkRelationship(state, relationship, known) {
  const m = MESSAGES.relationship;
  if (!plainObject(relationship) || !safeId(relationship.id)) throw new Error(m.id);
  if (!RELATIONSHIP_KINDS.includes(relationship.kind)) throw new Error(m.kind);
  if (!personOf(state, relationship.aId) || !personOf(state, relationship.bId)) throw new Error(m.person);
  if (relationship.aId === relationship.bId) throw new Error(m.pair);
  if (missingCause(relationship.causeId, known)) throw new Error(m.cause);
  if (!onOrBefore(relationship.createdAt, state.date)) throw new Error(m.date);
}

const COLLECTIONS = [['secrets', 'secret', checkSecret], ['hooks', 'hook', checkHook], ['relationships', 'relationship', checkRelationship]];

/** Validates secrets, hooks and relationships: ids unique and safe, every referenced person exists, types, strengths and kinds are known, causes are existing memories or null, dates are canonical and not in the future. */
export function validateSecrets(state) {
  if (COLLECTIONS.some(([list]) => !Array.isArray(state[list]))) throw new Error(COLLECTIONS_MESSAGE);
  const known = memoryIds(state);
  for (const [list, noun, check] of COLLECTIONS) {
    const ids = new Set(), pairs = new Set();
    for (const entry of state[list]) {
      check(state, entry, known);
      if (ids.has(entry.id)) throw new Error(MESSAGES[noun].id);
      ids.add(entry.id);
      if (noun === 'relationship') { const key = pairKey(entry); if (pairs.has(key)) throw new Error(MESSAGES.relationship.dup); pairs.add(key); }
    }
  }
}

// Validates the record before anything is spent, then takes the id from state.sequence (the same `<prefix>-<n>` form as the rest of the engine).
function store(state, list, noun, check, build) {
  const record = build(`${noun}-${state.sequence + 1}`);
  check(state, record, memoryIds(state));
  if (state[list].some((entry) => entry.id === record.id)) throw new Error(MESSAGES[noun].id);
  state.sequence += 1; state[list].push(record);
  return record;
}

export function createSecret(state, { type, subjectId, holderIds = [], evidence = 'weak', causeId = null } = {}) {
  return store(state, 'secrets', 'secret', checkSecret, (id) => ({ id, type, subjectId, holderIds: Array.isArray(holderIds) ? [...new Set(holderIds)] : holderIds, evidence, causeId, exposed: false, createdAt: state.date }));
}

const findSecret = (state, secretId) => {
  const secret = state.secrets.find((entry) => entry.id === secretId);
  if (!secret) throw new Error('Hemligheten finns inte.');
  return secret;
};

// Appends only the people not yet holding the secret, so the order of the existing holders never changes.
function mergeHolders(state, secret, personIds) {
  if (!Array.isArray(personIds) || personIds.some((id) => !personOf(state, id))) throw new Error(MESSAGES.secret.person);
  for (const id of personIds) if (!secret.holderIds.includes(id)) secret.holderIds.push(id);
  return secret;
}

export function addSecretHolders(state, secretId, personIds) { return mergeHolders(state, findSecret(state, secretId), personIds); }

/** Exposing is idempotent: a secret that is already out keeps its first exposedAt. */
export function exposeSecret(state, secretId) {
  const secret = findSecret(state, secretId);
  if (!secret.exposed) { secret.exposed = true; secret.exposedAt = state.date; }
  return secret;
}

export function grantHook(state, { ownerId, targetId, strength = 'weak', causeId = null } = {}) {
  return store(state, 'hooks', 'hook', checkHook, (id) => ({ id, ownerId, targetId, strength, causeId, createdAt: state.date, usedAt: null }));
}

const hookUsable = (state, hook) => alive(personOf(state, hook.ownerId)) && alive(personOf(state, hook.targetId));

/** A weak hook is spent by its first use (usedAt). A strong hook is not changed and can be used again. Uses are recorded by the caller's action log, not here. */
export function useHook(state, hookId) {
  const hook = state.hooks.find((entry) => entry.id === hookId);
  if (!hook) throw new Error('Övertaget finns inte.');
  if (!hookUsable(state, hook)) throw new Error('Övertagets ägare eller mål lever inte längre.');
  if (hook.usedAt !== null) throw new Error('Övertaget är redan använt.');
  if (hook.strength === 'weak') hook.usedAt = state.date;
  return hook;
}

/** Hooks that useHook would accept: unused, and both people alive. Without a target, every target counts. */
export const activeHooks = (state, ownerId, targetId = null) => state.hooks.filter((hook) => hook.ownerId === ownerId && (targetId == null || hook.targetId === targetId) && hook.usedAt === null && hookUsable(state, hook));

/** One record per unordered pair and kind. An existing record is returned as it is; a non-null causeId replaces its cause, a null one never erases it. */
export function setRelationship(state, { kind, aId, bId, causeId = null } = {}) {
  const candidate = { id: `relationship-${state.sequence + 1}`, kind, aId, bId, causeId, createdAt: state.date };
  checkRelationship(state, candidate, memoryIds(state));
  const existing = state.relationships.find((entry) => pairKey(entry) === pairKey(candidate));
  if (!existing) return store(state, 'relationships', 'relationship', checkRelationship, () => candidate);
  if (causeId !== null) existing.causeId = causeId;
  return existing;
}

/** What a person knows: the secrets they hold plus everything already exposed. Being the subject is not enough. */
export const knownSecrets = (state, personId) => state.secrets.filter((secret) => secret.exposed || secret.holderIds.includes(personId));

/** The plot secret that was created from a plot memory, or null. */
export const plotSecretFor = (state, memoryId) => state.secrets?.find((secret) => secret.type === 'plot' && secret.causeId === memoryId) || null;

/** Migrates the engine's private plot memories into plot secrets. A memory that no secret names as its cause gets a weak plot secret (subject participants[0], holders knownBy). For a memory that already has a plot secret, its knownBy ids are added to the holders. Memories are never changed. Draws no randomness; new ids come from state.sequence in memory array order. */
export function syncPlotSecrets(state) {
  if (!Array.isArray(state.secrets) || !Array.isArray(state.memories)) return;
  const named = new Map();
  for (const secret of state.secrets) if (typeof secret?.causeId === 'string') named.set(secret.causeId, [...(named.get(secret.causeId) || []), secret]);
  for (const memory of state.memories) {
    if (memory?.type !== 'plot' || !Array.isArray(memory.knownBy)) continue;
    const secrets = named.get(memory.id);
    if (!secrets) named.set(memory.id, [createSecret(state, { type: 'plot', subjectId: memory.participants?.[0], holderIds: memory.knownBy, evidence: 'weak', causeId: memory.id })]);
    else for (const secret of secrets) if (secret.type === 'plot') mergeHolders(state, secret, memory.knownBy);
  }
}
