import { addGameMonths, compareGameDates, diffGameDays, normalizeGameDate } from '../gameDates.js';
import { ensurePortraitIdentity, healthStageAt, PORTRAIT_AGE_GROUPS, PORTRAIT_STATES } from './portraitState.js';

export const HEALTH_VERSION = 1;
export const HEALTH_CONDITION_LABELS = Object.freeze({ smallpox: 'Smittkoppor', fever: 'Febersjukdom', injury: 'Skada', bereavement: 'Sorg' });
export const HEALTH_STAGE_LABELS = Object.freeze({ active: 'Pågående', recovering: 'Återhämtning', scarred: 'Läkt med bestående ärr', resolved: 'Avslutat' });
const values = (map) => Object.values(map || {});
const living = (state) => values(state.people).filter((person) => !person.diedAt);
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const nextId = (state, prefix) => `${prefix}-${++state.healthSequence}`;
function hash(value) { let n = 2166136261; for (const char of String(value)) n = Math.imul(n ^ char.charCodeAt(0), 16777619); return n >>> 0 || 1; }
function draw(state) { let n = state.healthRngState | 0; n ^= n << 13; n ^= n >>> 17; n ^= n << 5; state.healthRngState = n >>> 0 || 1; return state.healthRngState / 4294967296; }

export function ensureHealthState(state) {
  state.healthVersion ??= HEALTH_VERSION;
  state.healthActivatedAt ??= state.date;
  state.healthRngState ??= hash(`${state.rngState}:${state.identity.polityId}:health-v1`);
  state.healthSequence ??= 0;
  for (const person of values(state.people)) {
    person.healthConditions ??= [];
    ensurePortraitIdentity(person, state.people);
  }
  return state;
}

function emit(state, events, type, title, description, participants, extra = {}) {
  const event = { id: nextId(state, 'health-event'), date: state.date, type, title, description, participants: participants.filter(Boolean), public: true, ...extra };
  state.log.push(event); events.push(event);
  const memory = { id: nextId(state, 'health-memory'), date: state.date, type, title, participants: event.participants, causeId: event.id, familyIds: [...new Set(event.participants.map((id) => state.people[id]?.familyId).filter(Boolean))], knownBy: 'public' };
  state.memories.push(memory);
  return event;
}

const ongoing = (condition) => ['active', 'recovering'].includes(condition.stage);
export function getTreatableConditions(person) { return (person?.healthConditions || []).filter((condition) => ongoing(condition) && condition.kind !== 'bereavement' && !condition.treatment); }
export function getConditionBurden(person) { return Math.min(0.45, (person?.healthConditions || []).filter(ongoing).reduce((sum, condition) => sum + (condition.kind === 'smallpox' ? 0.08 : condition.kind === 'injury' ? 0.06 : condition.kind === 'fever' ? 0.04 : 0) * condition.severity * (condition.stage === 'recovering' ? 0.5 : 1), 0)); }

export function getNextHealthTransitionDate(state) {
  let next = null;
  for (const person of living(state)) for (const condition of person.healthConditions || []) {
    if (ongoing(condition) && condition.nextTransitionAt && (!next || compareGameDates(condition.nextTransitionAt, next) < 0)) next = condition.nextTransitionAt;
    if (condition.stage === 'active' && condition.nextExposureAt && (!next || compareGameDates(condition.nextExposureAt, next) < 0)) next = condition.nextExposureAt;
  }
  return next;
}

function createCondition(state, person, kind, events, context = {}) {
  const severity = kind === 'bereavement' ? 1 : draw(state) < 0.15 ? 3 : draw(state) < 0.45 ? 2 : 1;
  const condition = { id: nextId(state, 'condition'), kind, stage: 'active', severity, startedAt: state.date, nextTransitionAt: addGameMonths(state.date, kind === 'bereavement' ? 24 : kind === 'smallpox' ? 3 : kind === 'injury' ? 4 : 1), nextExposureAt: kind === 'smallpox' ? addGameMonths(state.date, 1) : null, stageHistory: [{ stage: 'active', date: state.date }], treatment: null, causeId: context.causeId || null, sourceKind: context.sourceKind || 'calendar', relatedPersonId: context.relatedPersonId || null, scarRoll: draw(state), outcomeRoll: draw(state), endedAt: null };
  person.healthConditions.push(condition);
  if (kind !== 'bereavement') {
    person.health = Math.max(1, person.health - severity * (kind === 'smallpox' ? 6 : kind === 'injury' ? 5 : 3));
    person.stress = clamp(person.stress + severity * 5, 0, 200);
  }
  const description = kind === 'smallpox' ? `${person.name} insjuknar i smittkoppor. Sjukdomen påverkar ork och tjänsteförmåga; återhämtning kan lämna bestående ärr.` : kind === 'fever' ? `${person.name} får feber och behöver återhämtning.` : kind === 'injury' ? `${person.name} skadas ${context.sourceKind === 'military-training' ? 'under militär tjänst' : 'i ett olycksfall'}. Skadan begränsar arbetsförmågan medan den läker.` : `${person.name} sörjer ${state.people[context.relatedPersonId]?.name || 'en närstående'}. Sorgen klingar av med tiden men minnet består.`;
  const event = emit(state, events, kind === 'bereavement' ? 'bereavement' : 'health_onset', `${person.name}: ${HEALTH_CONDITION_LABELS[kind].toLowerCase()}`, description, [person.id, context.relatedPersonId], { conditionId: condition.id });
  condition.causeId ||= event.id;
  return condition;
}

function offerHealthCare(state, person, condition, { representativeId, playerFamilyId, nominalId } = {}) {
  const controlledPatient = person.id === representativeId || person.id === nominalId;
  if (person.familyId !== playerFamilyId || (!controlledPatient && condition.severity < 2) || state.stories.some((story) => story.type === 'health_care' && story.status === 'open')) return;
  state.stories.push({ id: nextId(state, 'health-story'), type: 'health_care', title: 'Hushållet behöver ordna vård', description: `${person.name} har ${HEALTH_CONDITION_LABELS[condition.kind].toLowerCase()}. Vård och vila kan lindra följderna men garanterar inte att komplikationer undviks.`, actorId: person.id, familyId: person.familyId, conditionId: condition.id, causeId: condition.causeId, createdAt: state.date, dueAt: condition.nextTransitionAt, status: 'open', knownBy: 'public' });
}

function arrangeHealthCare(state, person, condition, context = {}, events) {
  offerHealthCare(state, person, condition, context);
  const controlledPatient = person.id === context.representativeId || person.id === context.nominalId;
  // Only an independent adult may spend a personal purse autonomously.
  // Player-family money and minors' inherited assets require a player choice.
  if (!controlledPatient && compareGameDates(addGameMonths(person.bornAt, 18 * 12), state.date) <= 0 && person.wealth >= 20 && (condition.severity >= 2 || person.traits.includes('cautious'))) {
    person.wealth -= 20;
    treatCondition(state, person, condition.id, 'physician', person.id, events);
  }
}

/** Called by the real death transition; it cannot invent a deceased relative. */
export function recordBereavement(state, deceased, causeId, events) {
  ensureHealthState(state);
  for (const person of living(state)) {
    if (!person.legalParentIds.includes(deceased.id) && person.spouseId !== deceased.id && !deceased.legalParentIds.includes(person.id)) continue;
    if (person.healthConditions.some((condition) => condition.kind === 'bereavement' && condition.relatedPersonId === deceased.id)) continue;
    if (deceased.legalParentIds.includes(person.id)) person.stress = clamp(person.stress + 15, 0, 200);
    createCondition(state, person, 'bereavement', events, { causeId, relatedPersonId: deceased.id, sourceKind: 'bereavement' });
  }
}

/** Game balance, not a clinical or historical epidemic model. */
export function runAnnualHealth(state, events, { representativeId, playerFamilyId, nominalId } = {}) {
  ensureHealthState(state);
  const infectiousFamilies = new Set(living(state).filter((person) => person.healthConditions.some((condition) => condition.kind === 'smallpox' && condition.stage === 'active')).map((person) => person.familyId));
  for (const person of living(state).sort((a, b) => a.id.localeCompare(b.id))) {
    if (person.healthConditions.some((condition) => ongoing(condition) && condition.kind !== 'bereavement')) continue;
    const recent = (kind) => person.healthConditions.some((condition) => condition.kind === kind && diffGameDays(condition.startedAt, state.date) < 730);
    const immune = person.healthConditions.some((condition) => condition.kind === 'smallpox');
    const military = state.offices.general?.holderId === person.id;
    const risk = (100 - person.health) / 3000 + person.stress / 8000;
    const roll = draw(state);
    const smallpoxRisk = immune ? 0 : 0.008 + (infectiousFamilies.has(person.familyId) ? 0.07 : 0);
    const feverRisk = recent('fever') ? 0 : 0.025 + risk;
    const injuryRisk = recent('injury') ? 0 : military ? 0.045 : 0.006;
    const kind = roll < smallpoxRisk ? 'smallpox' : roll < smallpoxRisk + feverRisk ? 'fever' : roll < smallpoxRisk + feverRisk + injuryRisk ? 'injury' : null;
    if (!kind) continue;
    const condition = createCondition(state, person, kind, events, { sourceKind: kind === 'injury' ? military ? 'military-training' : 'accident' : infectiousFamilies.has(person.familyId) ? 'household-outbreak' : 'calendar-illness' });
    arrangeHealthCare(state, person, condition, { representativeId, playerFamilyId, nominalId }, events);
  }
}

export function treatCondition(state, person, conditionId, care, actorId, events) {
  const condition = person.healthConditions.find((entry) => entry.id === conditionId);
  if (!condition || !getTreatableConditions(person).includes(condition)) throw new Error('Det finns inget obehandlat pågående tillstånd att vårda.');
  if (!['rest', 'physician'].includes(care)) throw new Error('Välj vila eller en läkekunnig.');
  condition.treatment = { kind: care, date: state.date, byId: actorId };
  const earlier = addGameMonths(state.date, care === 'physician' ? 1 : 2);
  if (compareGameDates(earlier, condition.nextTransitionAt) < 0) condition.nextTransitionAt = earlier;
  person.health = clamp(person.health + (care === 'physician' ? 4 : 2));
  person.stress = clamp(person.stress - (care === 'physician' ? 8 : 5), 0, 200);
  emit(state, events, 'health_treatment', `${person.name} får ${care === 'physician' ? 'vård' : 'tid att vila'}`, care === 'physician' ? 'En läkekunnig ger omvårdnad. Återhämtningen underlättas, men kvarstående ärr och komplikationer är fortfarande möjliga.' : 'Hushållet ordnar avlastning och vila. Tillståndets fortsatta förlopp följer kalendern.', [person.id, actorId], { conditionId });
  for (const story of state.stories) if (story.type === 'health_care' && story.conditionId === condition.id && story.status === 'open') { story.status = 'resolved'; story.resolvedAt = state.date; story.resolution = care; }
  return condition;
}

/** Process only due boundaries. Fatal outcomes return IDs for normal succession. */
export function advanceHealthTransitions(state, events, context = {}) {
  const deaths = [];
  for (const person of living(state).sort((a, b) => a.id.localeCompare(b.id))) for (const condition of person.healthConditions) {
    if (condition.kind === 'smallpox' && condition.stage === 'active' && condition.nextExposureAt && compareGameDates(condition.nextExposureAt, state.date) <= 0) {
      condition.nextExposureAt = null;
      let infections = 0;
      const relatives = living(state).filter((candidate) => candidate.familyId === person.familyId && candidate.id !== person.id).sort((a, b) => a.id.localeCompare(b.id));
      for (const relative of relatives) {
        if (infections >= 2 || relative.healthConditions.some((entry) => entry.kind === 'smallpox' || (entry.kind !== 'bereavement' && ongoing(entry)))) continue;
        if (draw(state) >= (condition.treatment?.kind === 'physician' ? 0.05 : 0.12)) continue;
        const secondary = createCondition(state, relative, 'smallpox', events, { sourceKind: 'household-exposure', causeId: condition.causeId, relatedPersonId: person.id });
        arrangeHealthCare(state, relative, secondary, context, events); infections++;
      }
    }
    if (!ongoing(condition) || !condition.nextTransitionAt || compareGameDates(condition.nextTransitionAt, state.date) > 0) continue;
    const care = condition.treatment?.kind;
    if (condition.stage === 'active' && condition.kind !== 'bereavement') {
      const baseRisk = condition.kind === 'smallpox' ? 0.012 * condition.severity : condition.kind === 'injury' ? 0.004 * condition.severity : 0.002 * condition.severity;
      const fatalRisk = (baseRisk + (person.health < 30 ? 0.04 : 0)) * (care === 'physician' ? 0.55 : care === 'rest' ? 0.8 : 1);
      if (condition.outcomeRoll < fatalRisk) {
        person.health = 0; condition.nextTransitionAt = null; condition.nextExposureAt = null; condition.fatalAt = state.date;
        deaths.push({ personId: person.id, reason: HEALTH_CONDITION_LABELS[condition.kind] });
        continue;
      }
      condition.stage = 'recovering';
      condition.nextTransitionAt = addGameMonths(state.date, condition.kind === 'smallpox' ? 6 : condition.kind === 'injury' ? 3 : 2);
      person.health = clamp(person.health + condition.severity * (condition.kind === 'smallpox' ? 3 : condition.kind === 'fever' ? 0 : 2));
      emit(state, events, 'health_recovering', `${person.name} börjar återhämta sig`, `Den akuta fasen av ${HEALTH_CONDITION_LABELS[condition.kind].toLowerCase()} avtar. Återhämtningen är ännu inte avslutad.`, [person.id], { conditionId: condition.id });
    } else {
      const scarRisk = condition.kind === 'smallpox' ? 0.4 + condition.severity * 0.1 : condition.kind === 'injury' ? 0.12 * condition.severity : 0;
      const scarred = condition.kind !== 'bereavement' && condition.scarRoll < Math.max(0, scarRisk - (care === 'physician' ? 0.1 : 0));
      condition.stage = scarred ? 'scarred' : 'resolved';
      condition.nextTransitionAt = null; condition.endedAt = state.date;
      if (condition.kind !== 'bereavement') person.health = clamp(person.health + condition.severity * 3);
      const title = condition.kind === 'bereavement' ? `${person.name}s sorg blir mindre akut` : scarred ? `${person.name} läker med bestående ärr` : `${person.name} har återhämtat sig`;
      emit(state, events, scarred ? 'health_scars' : 'health_resolved', title, condition.kind === 'bereavement' ? 'Det synliga sorgestadiet avtar. Släktbanden och minnet av den döde finns kvar.' : scarred ? 'Den akuta nedsättningen upphör. Ärren finns kvar som en bestående följd av det genomlevda tillståndet.' : 'Den tidsbundna nedsättningen upphör; händelsen finns kvar i personens minnen.', [person.id], { conditionId: condition.id });
    }
    condition.stageHistory.push({ stage: condition.stage, date: state.date });
  }
  for (const story of state.stories) if (story.type === 'health_care' && story.status === 'open') {
    const person = state.people[story.actorId];
    const condition = person?.healthConditions.find((item) => item.id === story.conditionId);
    if (!person || person.diedAt || !condition || !ongoing(condition) || condition.treatment) { story.status = 'closed'; story.resolvedAt = state.date; story.resolution = 'Tillståndet kräver inte längre detta vårdbeslut.'; }
  }
  return deaths;
}

export function publicHealthConditions(person, date) {
  return (person.healthConditions || []).filter((condition) => compareGameDates(condition.startedAt, date) <= 0).map(({ scarRoll: _scarRoll, outcomeRoll: _outcomeRoll, nextTransitionAt: _nextTransitionAt, nextExposureAt: _nextExposureAt, ...condition }) => ({ ...JSON.parse(JSON.stringify(condition)), label: HEALTH_CONDITION_LABELS[condition.kind], active: !person.diedAt && ongoing(condition), stageLabel: person.diedAt && ongoing(condition) ? 'Pågick vid dödsfallet' : HEALTH_STAGE_LABELS[healthStageAt(condition, date)] }));
}

export function validateHealthState(state) {
  if (state.healthVersion !== HEALTH_VERSION || !Number.isInteger(state.healthRngState) || state.healthRngState <= 0 || state.healthRngState > 4294967295 || !Number.isInteger(state.healthSequence) || state.healthSequence < 0 || !normalizeGameDate(state.healthActivatedAt) || compareGameDates(state.healthActivatedAt, state.date) > 0) throw new Error('Hälsosystemets sparade version eller slump är ogiltig.');
  const ids = new Set();
  for (const person of values(state.people)) {
    if (!Array.isArray(person.healthConditions) || person.portraitIdentityId !== person.id || typeof person.portraitFallbackIdentityId !== 'string') throw new Error('Personens hälsotillstånd eller porträttidentitet är ogiltig.');
    if (person.deathAppearance && (!person.diedAt || !PORTRAIT_AGE_GROUPS.includes(person.deathAppearance.ageGroup) || !PORTRAIT_STATES.includes(person.deathAppearance.visualState) || !Array.isArray(person.deathAppearance.stateKeys) || !person.deathAppearance.stateKeys.includes(person.deathAppearance.visualState) || person.deathAppearance.stateKeys.some((key) => !PORTRAIT_STATES.includes(key)) || !Array.isArray(person.deathAppearance.reasons))) throw new Error('Det bevarade porträttillståndet vid döden är ogiltigt.');
    for (const condition of person.healthConditions) {
      if (typeof condition.id !== 'string' || !/^[a-zA-Z0-9_:.-]{1,160}$/.test(condition.id) || ids.has(condition.id) || !HEALTH_CONDITION_LABELS[condition.kind] || !HEALTH_STAGE_LABELS[condition.stage] || ![1, 2, 3].includes(condition.severity) || !normalizeGameDate(condition.startedAt) || compareGameDates(condition.startedAt, state.date) > 0 || !Array.isArray(condition.stageHistory) || !condition.stageHistory.length || condition.stageHistory.at(-1).stage !== condition.stage || (condition.relatedPersonId && !state.people[condition.relatedPersonId])) throw new Error('Ett sparat hälsotillstånd är ogiltigt.');
      ids.add(condition.id);
      if (![condition.scarRoll, condition.outcomeRoll].every((number) => Number.isFinite(number) && number >= 0 && number < 1)) throw new Error('Hälsotillståndets sparade utfall är ogiltigt.');
      if (condition.nextTransitionAt && (!normalizeGameDate(condition.nextTransitionAt) || (!person.diedAt && compareGameDates(condition.nextTransitionAt, state.date) <= 0))) throw new Error('Ett hälsotillstånd har en obehandlad kalendergräns.');
      if (condition.nextExposureAt && (!normalizeGameDate(condition.nextExposureAt) || (!person.diedAt && compareGameDates(condition.nextExposureAt, state.date) <= 0))) throw new Error('En smittexponering har en obehandlad kalendergräns.');
      if (condition.stageHistory.some((entry) => !HEALTH_STAGE_LABELS[entry.stage] || !normalizeGameDate(entry.date) || compareGameDates(entry.date, state.date) > 0)) throw new Error('Hälsotillståndets historik ligger utanför kampanjen.');
      if (condition.stageHistory.some((entry, index) => compareGameDates(entry.date, index ? condition.stageHistory[index - 1].date : condition.startedAt) < 0)) throw new Error('Hälsotillståndets historik ligger i fel ordning.');
      if (!person.diedAt && ongoing(condition) && !condition.nextTransitionAt) throw new Error('Ett pågående hälsotillstånd saknar nästa kalendergräns.');
      if (condition.treatment && (!['rest', 'physician'].includes(condition.treatment.kind) || !state.people[condition.treatment.byId] || !normalizeGameDate(condition.treatment.date))) throw new Error('Hälsotillståndets behandling är ogiltig.');
    }
  }
}
