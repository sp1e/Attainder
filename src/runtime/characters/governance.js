import { addGameMonths, compareGameDates, normalizeGameDate } from '../gameDates.js';

const values = (map) => Object.values(map || {});
const alive = (person) => Boolean(person && !person.diedAt);
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));
const has = (person, trait) => person?.traits?.includes(trait);

// Additive fields in the first, unreleased character schema. Their defaults are
// deterministic and do not change time, RNG, balances or player identity.
export function ensureGovernance(state) {
  state.regencies ||= {};
  state.externalHosts ||= [];
  state.realm.claimHistory ||= [];
  for (const record of values(state.regencies)) { record.grants ||= []; record.requestAfter ||= {}; }
  if (!Object.hasOwn(state.realm, 'lawfulRulerId')) state.realm.lawfulRulerId = state.offices.ruler.holderId;
  if (!Object.hasOwn(state.realm, 'legalHeirId')) state.realm.legalHeirId = null;
  for (const family of values(state.families)) family.claims ||= [];
  return state;
}

function claimRecord(state, personId, kind, origin) {
  const person = state.people[personId];
  if (!alive(person)) return;
  const family = state.families[person.familyId];
  let record = family.claims.find((item) => item.personId === personId && item.kind === kind && item.status === 'active');
  if (!record) {
    record = { id: `claim:${kind}:${personId}:${state.date}`, officeId: 'ruler', personId, kind, origin, createdAt: state.date, status: 'active' };
    family.claims.push(record);
  }
  return record;
}

export function refreshLegalClaims(state, candidates) {
  ensureGovernance(state);
  if (!state.realm.alive) {
    for (const family of values(state.families)) for (const claim of family.claims) if (claim.status === 'active') {
      claim.status = 'suspended'; claim.endedAt = state.date; claim.resolution = 'Riket har upplösts; den historiska rättsgrunden består.';
    }
    return;
  }
  let lawful = state.people[state.realm.lawfulRulerId];
  if (!alive(lawful)) {
    const previous = lawful;
    lawful = candidates(state, previous)[0] || state.people[state.offices.ruler.holderId] || null;
    state.realm.lawfulRulerId = lawful?.id || null;
    if (lawful) state.realm.claimHistory.push({ date: state.date, type: 'legal_succession', fromId: previous?.id || null, toId: lawful.id, reason: 'Den rättsliga successionsordningen förs vidare separat från faktisk kontroll.' });
  }
  const heir = lawful ? candidates(state, lawful)[0] : null;
  state.realm.legalHeirId = heir?.id || null;
  for (const family of values(state.families)) for (const claim of family.claims) if (claim.status === 'active') {
    const person = state.people[claim.personId];
    const valid = alive(person) && person.familyId === family.id && (claim.kind === 'lawful-ruler' ? claim.personId === lawful?.id : claim.kind === 'heir' ? claim.personId === heir?.id : true);
    if (!valid) { claim.status = alive(person) ? person.familyId !== family.id ? 'transferred' : 'superseded' : 'deceased'; claim.endedAt = state.date; }
  }
  if (lawful) claimRecord(state, lawful.id, 'lawful-ruler', 'Erkänd succession eller återupprättad rätt');
  if (heir) claimRecord(state, heir.id, 'heir', `Efterträdare till ${lawful.id} enligt ${state.realm.successionLaw}`);
}

export function registerAccession(state, { previousId, newId, lawful = true, reason }) {
  ensureGovernance(state);
  const oldLawful = state.realm.lawfulRulerId;
  const restored = newId === oldLawful;
  if (lawful || restored) state.realm.lawfulRulerId = newId || null;
  state.realm.claimHistory.push({ date: state.date, type: restored && previousId !== newId ? 'restoration' : lawful ? 'lawful_accession' : 'seizure', fromId: previousId || null, toId: newId || null, lawfulRulerId: state.realm.lawfulRulerId, reason });
}

export function familyRoyalClaim(state, familyId, excludedIds = []) {
  const claimant = state.people[state.realm.lawfulRulerId];
  return state.realm.alive && alive(claimant) && !excludedIds.includes(claimant.id) && claimant.familyId === familyId && claimant.id !== state.offices.ruler.holderId ? claimant : null;
}

export function claimSupportPenalty(state, familyId, excludedIds = []) { return familyRoyalClaim(state, familyId, excludedIds) ? -12 : 0; }

export function reconcileRegency(state, id, principalId, proposedRegentId, { isAdult, emit, events }) {
  ensureGovernance(state);
  const principal = state.people[principalId];
  let record = state.regencies[id];
  if (record && record.principalId !== principalId && !['ended', 'closed'].includes(record.phase)) { record.phase = 'closed'; record.endedAt = state.date; }
  if (!alive(principal)) {
    if (record && !['ended', 'closed'].includes(record.phase)) { record.phase = 'closed'; record.endedAt = state.date; }
    return null;
  }
  if (!isAdult(state, principal)) {
    const regentId = record?.principalId === principalId && record.phase === 'minority' && alive(state.people[record.regentId]) ? record.regentId : proposedRegentId;
    if (!regentId) return null;
    if (!record || record.principalId !== principalId || record.regentId !== regentId || ['ended', 'closed'].includes(record.phase)) {
      record = { id, principalId, regentId, phase: 'minority', startedAt: state.date, grants: [], requestAfter: {}, handoverDueAt: null };
      state.regencies[id] = record;
    }
    return regentId;
  }
  if (!record || record.principalId !== principalId || ['ended', 'closed'].includes(record.phase)) return null;
  const regent = state.people[record.regentId];
  if (!alive(regent)) { record.phase = 'ended'; record.endedAt = state.date; return null; }
  if (record.phase === 'contested') return record.regentId;
  const influence = state.families[regent.familyId]?.influence || 0;
  if (has(regent, 'ambitious') && regent.loyalty < 70 && influence >= 40) {
    record.phase = 'contested'; record.handoverDueAt = state.date;
    emit(state, events, 'regency_dispute', 'Regenten håller fast vid makten', `${regent.name} vägrar lämna över mandatet till ${principal.name}. En pension, rådets stöd eller en maktprövning kan lösa konflikten.`, [principal.id, regent.id]);
    return record.regentId;
  }
  record.phase = 'ended'; record.endedAt = state.date;
  return null;
}

export function relevantRegencies(state) {
  const principalIds = state.identity.mode === 'realm' ? [state.offices.ruler.holderId] : [state.families[state.identity.familyId]?.headId];
  return values(state.regencies).filter((record) => principalIds.includes(record.principalId) && ['minority', 'contested'].includes(record.phase) && alive(state.people[record.regentId]));
}

const RESERVED = new Set(['appoint', 'dismiss', 'banish', 'tax_policy', 'mobilize', 'reform', 'concord', 'academy', 'succession_law', 'sanctuary', 'network', 'aqueduct', 'build_estate', 'adopt']);

export function regencyVetoForRecord(state, record, type) {
    if (!RESERVED.has(type)) return '';
    const isFamilyAction = ['build_estate', 'adopt'].includes(type);
    if (record.id.startsWith('family:') !== isFamilyAction) return '';
    if (record.phase === 'contested') return 'Mandatöverlämningen är omstridd. Lös regentkonflikten först.';
    if (record.grants.some((grant) => grant.actionType === type && !grant.usedAt && compareGameDates(grant.expiresAt, state.date) > 0)) return '';
    const regent = state.people[record.regentId];
    const veto = (has(regent, 'cautious') && ['mobilize', 'banish', 'network'].includes(type)) ||
      (has(regent, 'dutiful') && ['banish', 'succession_law'].includes(type)) ||
      (has(regent, 'greedy') && ['academy', 'aqueduct', 'concord', 'build_estate'].includes(type)) ||
      (has(regent, 'ambitious') && ['appoint', 'dismiss', 'succession_law', 'adopt'].includes(type));
    if (veto) return `${regent.name} samtycker inte till detta beslut. Förhandla eller vänd dig till rådet.`;
    return '';
}

export function regencyVeto(state, type) {
  for (const record of relevantRegencies(state)) {
    const veto = regencyVetoForRecord(state, record, type);
    if (veto) return veto;
  }
  return '';
}

export function consumeRegencyConsent(state, type) {
  for (const record of relevantRegencies(state)) {
    const grant = record.grants.find((item) => item.actionType === type && !item.usedAt && compareGameDates(item.expiresAt, state.date) > 0);
    if (grant) grant.usedAt = state.date;
  }
}

export function cleanHostCandidates(candidates, extinctId, preserveIds = []) {
  const seen = new Set();
  return (Array.isArray(candidates) ? candidates : []).flatMap((candidate) => {
    if (!candidate || typeof candidate.id !== 'string' || !candidate.id.trim() || candidate.id.length > 160 || candidate.id === extinctId || seen.has(candidate.id) || candidate.alive === false) return [];
    seen.add(candidate.id);
    return [{ id: candidate.id, name: String(candidate.name || candidate.id).slice(0, 180), opinion: clamp(candidate.opinion || 0, -100, 100), refugeThreshold: clamp(candidate.refugeThreshold ?? 55), admissionCost: clamp(candidate.admissionCost ?? 20, 0, 100) }];
  }).sort((a, b) => Number(preserveIds.includes(b.id)) - Number(preserveIds.includes(a.id)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).slice(0, 24).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function describeGovernance(state) {
  const actual = state.people[state.offices.ruler.holderId];
  const lawful = state.people[state.realm.lawfulRulerId];
  const heir = state.people[state.realm.legalHeirId];
  return {
    actualRulerId: actual?.id || null, actualRulerName: actual?.name || 'Ingen aktiv innehavare',
    lawfulRulerId: lawful?.id || null, lawfulRulerName: lawful?.name || 'Ingen erkänd pretendent',
    legalHeirId: heir?.id || null, legalHeirName: heir?.name || 'Ingen erkänd efterträdare',
    contestedCrown: Boolean(state.realm.alive && lawful && actual && lawful.id !== actual.id),
    claimHistory: [...(state.realm.claimHistory || [])],
    claims: values(state.families).flatMap((family) => family.claims.map((claim) => ({ ...claim, personName: state.people[claim.personId]?.name || claim.personId, familyName: family.name }))),
    regencies: relevantRegencies(state).map((record) => ({ ...record, principalName: state.people[record.principalId]?.name, regentName: state.people[record.regentId]?.name, vetoedActions: [...RESERVED].filter((type) => regencyVetoForRecord(state, record, type)) })),
    realmAlive: state.realm.alive, externalHosts: [...(state.externalHosts || [])],
  };
}

export function validateGovernance(state) {
  if (!state.regencies || typeof state.regencies !== 'object' || Array.isArray(state.regencies) || !Array.isArray(state.externalHosts) || state.externalHosts.length > 24 || !Array.isArray(state.realm.claimHistory)) throw new Error('Sparfilens mandat eller värdregister är ogiltigt.');
  for (const id of [state.realm.lawfulRulerId, state.realm.legalHeirId].filter(Boolean)) if (!state.people[id] || (state.realm.alive && !alive(state.people[id]))) throw new Error('Ett rättsligt anspråk hänvisar till en ogiltig person.');
  for (const family of values(state.families)) {
    if (!Array.isArray(family.claims)) throw new Error('Familjens anspråksregister är ogiltigt.');
    for (const claim of family.claims) if (!state.people[claim.personId] || claim.officeId !== 'ruler' || !['lawful-ruler', 'heir'].includes(claim.kind) || !['active', 'suspended', 'superseded', 'deceased', 'transferred'].includes(claim.status) || !normalizeGameDate(claim.createdAt)) throw new Error('Ett historiskt tronanspråk är ogiltigt.');
    if (family.hostPolityId && !state.externalHosts.some((host) => host.id === family.hostPolityId)) throw new Error('Familjens skydd saknar en registrerad mottagare.');
  }
  for (const [id, record] of Object.entries(state.regencies)) {
    if (record.id !== id || !state.people[record.principalId] || !state.people[record.regentId] || !['minority', 'contested', 'ended', 'closed'].includes(record.phase) || !Array.isArray(record.grants) || !record.requestAfter || typeof record.requestAfter !== 'object') throw new Error('Ett förmyndarmandat är ogiltigt.');
    if (['minority', 'contested'].includes(record.phase) && (!alive(state.people[record.principalId]) || !alive(state.people[record.regentId]))) throw new Error('Ett aktivt förmyndarmandat hänvisar till en avliden person.');
    for (const grant of record.grants) if (!RESERVED.has(grant.actionType) || !normalizeGameDate(grant.grantedAt) || !normalizeGameDate(grant.expiresAt) || (grant.usedAt && !normalizeGameDate(grant.usedAt))) throw new Error('Ett samtycke saknar giltiga beslut eller datum.');
  }
  const ids = new Set();
  for (const host of state.externalHosts) {
    if (!host || typeof host.id !== 'string' || !host.id.trim() || host.id.length > 160 || host.id === state.identity.polityId || ids.has(host.id) || !Number.isFinite(host.opinion) || host.opinion < -100 || host.opinion > 100 || !Number.isFinite(host.admissionCost) || host.admissionCost < 0 || host.admissionCost > 100 || !Number.isFinite(host.refugeThreshold) || host.refugeThreshold < 0 || host.refugeThreshold > 100) throw new Error('En mottagares identitet eller villkor är ogiltiga.');
    ids.add(host.id);
  }
}
