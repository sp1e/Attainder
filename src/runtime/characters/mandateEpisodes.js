import { compareGameDates, normalizeGameDate } from '../gameDates.js';
import { canExerciseMandate, getIncapacityCauseIds, isAdultCharacter, selectMandateRegent } from './characterCapacity.js';

export const MANDATE_VERSION = 1;
const active = (record) => record && ['minority', 'incapacity', 'contested'].includes(record.phase);
const alive = (person) => Boolean(person && !person.diedAt);
const canonical = (date) => typeof date === 'string' && Boolean(date) && normalizeGameDate(date) === date;

function bindGrant(grant, record) {
  return { ...grant, episodeId: record.episodeId, termId: record.termId, regentId: record.regentId };
}

export function ensureMandateEpisodes(state) {
  if (state.mandateVersion != null) {
    if (state.mandateVersion !== MANDATE_VERSION) throw new Error('Sparfilens version för tillfälliga mandat stöds inte.');
    return;
  }
  state.mandateVersion = MANDATE_VERSION;
  state.mandateActivatedAt = state.date;
  state.mandateSequence = 0;
  for (const record of Object.values(state.regencies || {})) {
    record.episodeId = `legacy:${record.id}:${record.principalId}:${record.startedAt}`;
    record.termId = `${record.episodeId}:${record.regentId}`;
    record.basis = 'minority';
    record.causeConditionIds = [];
    const holder = record.id === 'office:ruler' ? state.offices.ruler : state.families[record.id.slice(7)];
    const principalId = record.id === 'office:ruler' ? holder?.holderId : holder?.headId;
    const regentId = record.id === 'office:ruler' ? holder?.regentId : holder?.guardianId;
    const unchanged = record.principalId === principalId && record.regentId === regentId;
    record.grants = (record.grants || []).map((grant) => bindGrant(grant, record));
    if (active(record) && !unchanged) { record.grants = []; record.requestAfter = {}; }
  }
}

function newTerm(state, record, regentId) {
  record.regentId = regentId;
  record.termId = `mandate-term-${++state.mandateSequence}`;
  record.grants = [];
  record.requestAfter = {};
}

function eligible(state, principal, regent, scope, basis) {
  if (!regent || regent.id === principal.id || !canExerciseMandate(regent, state.date)) return false;
  const family = state.families[regent.familyId];
  return Boolean(family && (basis === 'minority' || !family.exiled || (scope === 'family' && regent.familyId === principal.familyId)));
}

// Only representation changes here. Succession, ownership, money and RNG remain
// with their existing systems. A contested handover stays contested while ill.
export function reconcileMandateEpisode(state, id, principalId, { emit = () => {}, events = [], silent = false } = {}) {
  ensureMandateEpisodes(state);
  state.regencies ||= {};
  const principal = state.people[principalId];
  const scope = id === 'office:ruler' ? 'royal' : 'family';
  let record = state.regencies[id];
  const end = (phase = 'ended') => { if (active(record)) { record.phase = phase; record.endedAt = state.date; } };
  if (!alive(principal)) { end('closed'); return null; }
  if (record && record.principalId !== principalId) { end('closed'); record = null; }
  const causes = getIncapacityCauseIds(principal, state.date);
  const grown = isAdultCharacter(principal, state.date);
  if (active(record) && record.phase === 'contested') {
    record.causeConditionIds = causes;
    if (alive(state.people[record.regentId])) return record.regentId;
    end();
  }
  const needsRepresentative = !grown || causes.length > 0;
  if (!needsRepresentative) {
    if (!active(record)) return null;
    const regent = state.people[record.regentId];
    if (record.basis === 'minority' && canExerciseMandate(regent, state.date) &&
        regent.traits?.includes('ambitious') && regent.loyalty < 70 && (state.families[regent.familyId]?.influence || 0) >= 40) {
      record.phase = 'contested'; record.handoverDueAt = state.date; record.causeConditionIds = [];
      if (!silent) emit(state, events, 'regency_dispute', 'Regenten håller fast vid makten',
        `${regent.name} vägrar lämna över mandatet till ${principal.name}. En pension, rådets stöd eller en maktprövning kan lösa konflikten.`, [principal.id, regent.id]);
      return regent.id;
    }
    record.causeConditionIds = [];
    end();
    return null;
  }
  if (!active(record)) {
    const basis = grown ? 'incapacity' : 'minority';
    record = { id, principalId, regentId: null, basis, phase: basis, episodeId: `mandate-episode-${++state.mandateSequence}`,
      startedAt: state.date, handoverDueAt: null, grants: [], requestAfter: {}, causeConditionIds: causes };
    newTerm(state, record, selectMandateRegent(state, { principalId, scope, basis }));
    state.regencies[id] = record;
    if (!silent && basis === 'incapacity') emit(state, events, 'incapacity_regency', 'Ett tillfälligt mandat behövs',
      record.regentId ? `${principal.name} kan inte utöva sitt mandat under den svåra sjukdomen. ${state.people[record.regentId].name} företräder personen tills förmågan återkommer.` :
        `${principal.name} kan inte utöva sitt mandat under den svåra sjukdomen. Ingen behörig företrädare finns just nu.`, [principalId, record.regentId]);
  } else if (!eligible(state, principal, state.people[record.regentId], scope, record.basis)) {
    const replacement = selectMandateRegent(state, { principalId, scope, basis: record.basis });
    if (replacement !== record.regentId) newTerm(state, record, replacement);
  }
  record.causeConditionIds = causes;
  return record.regentId;
}

export function grantMatchesMandate(record, grant) {
  return active(record) && Boolean(record.regentId) && grant.episodeId === record.episodeId &&
    grant.termId === record.termId && grant.regentId === record.regentId;
}

export function attachMandateGrant(record, grant) {
  return bindGrant(grant, record);
}

export function validateMandateEpisodes(state) {
  if (state.mandateVersion !== MANDATE_VERSION || !canonical(state.mandateActivatedAt) ||
      compareGameDates(state.mandateActivatedAt, state.date) > 0 || !Number.isSafeInteger(state.mandateSequence) || state.mandateSequence < 0) throw new Error('Mandatsystemets aktivering är ogiltig.');
  for (const record of Object.values(state.regencies || {})) {
    if (!['minority', 'incapacity'].includes(record.basis) || typeof record.episodeId !== 'string' || !record.episodeId ||
        typeof record.termId !== 'string' || !record.termId || !Array.isArray(record.causeConditionIds) ||
        new Set(record.causeConditionIds).size !== record.causeConditionIds.length) throw new Error('Ett mandat saknar giltig episod eller företrädarperiod.');
    if (!canonical(record.startedAt) || compareGameDates(record.startedAt, state.date) > 0 ||
        (record.endedAt != null && (!canonical(record.endedAt) || compareGameDates(record.endedAt, record.startedAt) < 0 || compareGameDates(record.endedAt, state.date) > 0)) ||
        (record.handoverDueAt != null && (!canonical(record.handoverDueAt) || compareGameDates(record.handoverDueAt, record.startedAt) < 0 || compareGameDates(record.handoverDueAt, state.date) > 0))) throw new Error('Mandatets tidsgränser är ogiltiga.');
    if ((record.phase === 'incapacity' && record.basis !== 'incapacity') || (record.phase === 'minority' && record.basis !== 'minority')) throw new Error('Mandatets grund och fas stämmer inte överens.');
    const person = state.people[record.principalId];
    if (record.causeConditionIds.some((id) => !person?.healthConditions?.some((condition) => condition.id === id && condition.severity === 3 && ['smallpox', 'fever', 'injury'].includes(condition.kind)))) throw new Error('Mandatets sjukdomsorsak saknar en giltig personkoppling.');
    for (const grant of record.grants || []) {
      if (grant.episodeId !== record.episodeId || grant.termId !== record.termId || grant.regentId !== record.regentId || !record.regentId) throw new Error('Ett samtycke tillhör en annan mandatperiod.');
      if (!canonical(grant.grantedAt) || !canonical(grant.expiresAt) || compareGameDates(grant.grantedAt, state.date) > 0 || compareGameDates(grant.expiresAt, grant.grantedAt) <= 0 ||
          (grant.usedAt != null && (!canonical(grant.usedAt) || compareGameDates(grant.usedAt, grant.grantedAt) < 0 || compareGameDates(grant.usedAt, state.date) > 0))) throw new Error('Samtyckets tidsgränser är ogiltiga.');
    }
  }
}
