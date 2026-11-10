import { addGameMonths, compareGameDates, diffGameDays, normalizeGameDate } from '../gameDates.js';
import { ADULT_AGE, ARCHETYPES, CONTENT_VERSION, FAMILY_SEEDS, NAME_POOL, RULE_PROVENANCE, RULES_VERSION, SCHEMA_VERSION, SKILL_LABELS, SUCCESSION_LAW_RULES_SV, TRAITS, publicHistoricalOrigin, publicPersonOrigin, publicReligionOrigin } from './content.js';
import { canExerciseMandate, getCharacterAge, getIncapacityCauseIds, isAdultCharacter } from './characterCapacity.js';
import { attachMandateGrant, ensureMandateEpisodes, reconcileMandateEpisode, validateMandateEpisodes } from './mandateEpisodes.js';
export { getCharacterAge } from './characterCapacity.js';

import { ensureGovernance, refreshLegalClaims, registerAccession, familyRoyalClaim, claimSupportPenalty, relevantRegencies, royalRegency, regencyVeto, regencyVetoForRecord, consumeRegencyConsent, cleanHostCandidates, describeGovernance, validateGovernance } from './governance.js';
import { ensurePortraitIdentity, freezeDeathAppearance, resolvePortraitState } from './portraitState.js';
import { ensureHealthState, validateHealthState, runAnnualHealth, advanceHealthTransitions, getNextHealthTransitionDate, getTreatableConditions, treatCondition, recordBereavement, getConditionBurden, publicHealthConditions, ageDeathRisk, HEALTH_CONDITION_LABELS } from './health.js';
import { fadeAll } from './memoryFade.js';
import { STORY_DIRECTOR_VERSION, ensureStoryDirector, validateStoryDirector, scheduleDirectedStory, directedStoryChoices, resolveDirectedStory, refreshDirectedStories } from './storyDirector.js';
import { DIFFICULTIES, ensureCharacterExtensions, normalizeDifficulty, validateCharacterExtensions } from './extensions.js';
import { hasLivingSpouse, isMarried, otherSpousesError, spouseIdsOf } from './marriage.js';
import { addSecretHolders, createSecret, exposeSecret, plotSecretFor, syncPlotSecrets } from './secrets.js';
import { buildCatalogActions } from './actionCatalog.js';
import { estimateAction } from './actionOdds.js';
import { STAFF_ROLES, staffOf } from './courtStaff.js';
import { presentResolutions, presentSchemes, recordNarrative, resolveAttempt, validateActionLog } from './actionResolution.js';
import { punishCrimeChoices, resolvePunishment } from './crimes.js';
import { feastRefusal, feastRows, holdFeast, presentOccasions, validateOccasions } from './occasions.js';
import { WONDER, WONDER_KINDS, completeWonder, startWonder, wonderRefusal } from './wonders.js';
import { ensureForeignRealms, presentForeignRealms, validateForeignRealms } from './foreignRealms.js';
import { TRIBE, bribeTribe, crushTargets, crushTribe, dealTargets, ensureTribes, hasTribes, hireTribe, presentTribes, validateTribes } from './tribes.js';
import { ALLIANCE, arrangeForeignMarriage, foreignMarriageRefusal, foreignPartners, marriageableKin } from './alliances.js';
import { envoyBrief, estimateEnvoy, sendEnvoy } from './envoys.js';
import { CLAIM, claimRefusal, claimTargets, declareWar, fabricateClaim, makePeace, peaceTargets, pressTargets } from './claims.js';
import { npcPlotStep, plotUncoveredChoices, resolvePlotUncovered } from './npcPlots.js';
import { presentRumors, validateRumors } from './rumors.js';
import { conversationBrief, converse, estimateConversation as estimateConversationRequest, presentConversation, validateConversations } from './conversation.js';
import { IMPRISONED, closePrisoner, executePrisoner, heldPrisoners, imprisonPerson, isImprisoned, passCrown, presentPrisoners, prisonerStep, ransomChoices, releasePrisoner, resolveRansom, validatePrisoners } from './prisoners.js';
import { abortScheme, advanceSchemes, getSchemeDates, reinforceScheme, validateSchemes } from './schemes.js';
import { COUNCIL_SEATS, advisorFor, filledSeats, flatteryRevealed, loyaltyPrecision, presentLoyalty, rewardClosedReason, rewardCouncillor, serviceOf } from './council.js';
import { COURT_STORY_TYPES, courtAnnualStep, courtDeadlineText, courtStoryChoices, onAccession, presentCourt, refreshCourtStories, resolveCourtStory, validateCourt } from './court.js';
import { breakdownDue, fitsNature, natureStress } from './breakdowns.js';
import { dreadOf, dreadRows } from './dread.js';
import { seatReaction } from './familyDemands.js';
import { goalClosedReason, openGoals, recordDeed, setReignGoal } from './reign.js';
import { nicknameOf, nicknameProgress } from './nicknames.js';
import { reignHandover } from './handover.js';
import { ELECTION_REASON_SV, electOutsider, electiveTiers, nextSuccessionLaw } from './election.js';
import { electionOrder, presentElection, tallyElection } from './electors.js';
import { primogenitureCandidates } from './succession.js';
import { biologicalFather, paternityStep, recordIllegitimacy } from './paternity.js';
import { bastardClaimStep } from './bastardClaims.js';
import { cadetBranchStep } from './cadetBranches.js';
import { partitionInheritance } from './partition.js';
import { correctionNote, traitsAtAdulthood, tutorProspect } from './tutoring.js';
import { ensureRealmKind, presentRealm, validateRealmKind } from './realmKind.js';
import { bondStep } from './bonds.js';
import { inheritGrudges } from './grudges.js';
import { birthsClosed, courtRenewalStep, ensureLineageState, validateLineageState } from './renewal.js';
import { EVENT_CHAIN_VERSION, ensureEventChains, validateEventChains, scheduleEventChain, refreshEventChains, eventChainChoices, resolveEventChain, getEventChainDates, presentEventChain, presentEventChainHistory } from './eventChains.js';
export { ARCHETYPES, TRAITS, RULE_PROVENANCE } from './content.js';
export { isImprisoned } from './prisoners.js';
export { FADING_MEMORY_TYPES, fadeAll, fadeDeadConditions, fadeDeadDecisions, fadeDeadRelations, fadeMemories, fadeSettledStories } from './memoryFade.js';
export { STORY_MEMORY_WINDOW } from './storyDirector.js';
export { PORTRAIT_STATES, PORTRAIT_AGE_GROUPS, resolvePortraitState } from './portraitState.js';
const copy = (value) => JSON.parse(JSON.stringify(value));
const values = (map) => Object.values(map || {});
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));
const rounded = (value) => { const number = Math.round(value * 100) / 100; return number === 0 ? 0 : number; };
const alive = (person) => Boolean(person && !person.diedAt);
const portraitGroup = (age) => age < ADULT_AGE ? 'child' : age >= 60 ? 'elder' : 'adult';
const has = (person, trait) => Boolean(person?.traits?.includes(trait));
const living = (state) => values(state.people).filter(alive);
const safeId = (id) => typeof id === 'string' && /^[a-zA-Z0-9_:.-]{1,160}$/.test(id);
const nextId = (state, prefix) => `${prefix}-${++state.sequence}`;
// The presentation shows the last 120 public log entries, and no rule reads the log. An accepted mutation keeps
// the suffix from the 120th public entry from the end. Spec: docs/superpowers/specs/2026-11-08-character-log-cap-design.md.
export const CHARACTER_LOG_LIMIT = 120;
export function keptCharacterLog(log) {
  for (let index = log.length - 1, seen = 0; index >= 0; index -= 1) if (log[index].public && ++seen === CHARACTER_LOG_LIMIT) return log.slice(index);
  return log;
}
function capLog(state) { state.log = keptCharacterLog(state.log); }
function random(state) { let n = state.rngState | 0; n ^= n << 13; n ^= n >>> 17; n ^= n << 5; state.rngState = n >>> 0 || 1; return state.rngState / 4294967296; }
function seedNumber(seed) { if (Number.isFinite(Number(seed)) && Number(seed)) return Number(seed) >>> 0 || 1; let n = 2166136261; for (const c of String(seed)) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return n >>> 0 || 1; }
const adult = (state, person) => isAdultCharacter(person, state.date);
const ruler = (state) => state.people[state.offices.ruler?.holderId] || null;
const familyMembers = (state, id) => living(state).filter((p) => p.familyId === id);
const byAge = (state, people) => [...people].sort((a, b) => compareGameDates(a.bornAt, b.bornAt) || a.id.localeCompare(b.id));
// A prisoner never acts for a family or the realm (Phase 2): an imprisoned capable head leaves the household without a representative, while a free guardian still acts for a head who could not act anyway.
function householdRepresentative(state) {
  const family = controlledFamily(state), principal = state.people[family?.headId];
  if (!alive(principal)) return null;
  if (canExerciseMandate(principal, state.date)) return isImprisoned(state, principal.id) ? null : principal;
  const record = state.regencies?.[`family:${family.id}`], guardian = state.people[family.guardianId];
  return record?.principalId === principal.id && record.regentId === guardian?.id && record.phase !== 'contested' && canExerciseMandate(guardian, state.date) && !isImprisoned(state, guardian.id) ? guardian : null;
}
function activeRepresentative(state) { return state.identity.mode === 'realm' ? realmExecutive(state) || householdRepresentative(state) : householdRepresentative(state); }
function controlledFamily(state) { return state.families[state.identity.mode === 'family' ? state.identity.familyId : ruler(state)?.familyId] || null; }
function realmExecutive(state) {
  const principal = ruler(state), record = royalRegency(state);
  if (!state.realm.alive || !alive(principal) || record?.phase === 'contested') return null;
  if (canExerciseMandate(principal, state.date) && !state.offices.ruler.regentId) return isImprisoned(state, principal.id) ? null : principal;
  const regent = ['minority', 'incapacity'].includes(record?.phase) ? state.people[record.regentId] : null;
  return canExerciseMandate(regent, state.date) && !isImprisoned(state, regent.id) ? regent : null;
}
function royalDecisionReason(state, type) {
  if (royalRegency(state)?.phase === 'contested') return 'Mandatöverlämningen är omstridd. Frågan kan tas upp igen när konflikten är löst.';
  if (!realmExecutive(state)) return 'Riket saknar en behörig vuxen företrädare. Frågan kan tas upp igen när mandatet är ordnat.';
  const record = royalRegency(state);
  return record ? regencyVetoForRecord(state, record, type) : '';
}
function consumeRoyalConsent(state, type) { const record = royalRegency(state); if (record) consumeRegencyConsent(state, type, [record]); }
function canRule(state) { const actor = activeRepresentative(state); const executive = realmExecutive(state); const office = state.offices.ruler; if (state.identity.mode === 'family') { const ownHead = state.families[state.identity.familyId]?.headId; if (ownHead !== office.holderId && ownHead !== office.regentId) return false; } return Boolean(actor && executive && actor.id === executive.id); }
// Bribe, hire or crush a border tribe (tribes spec); each lists only the tribes it can reach, and says so when none can.
function addTribeActions(state, add) {
  const deal = dealTargets(state), crush = crushTargets(state), none = 'Inget gränsfolk kan väljas just nu.';
  add('bribe_tribe', 'Betala tribut till gränsfolk', `Köp ${TRIBE.bribeMonths / 12} års fred vid gränsen. Ett betalt folk plundrar inte.`, TRIBE.bribe, [selectField('tribeId', 'Gränsfolk', deal)], true, 'generous', deal.length ? '' : none);
  add('hire_tribe', 'Ta gränsfolk i sold', `Krigarna tjänar riket i ${TRIBE.hireMonths / 12} år, plundrar inte och stärker hären i krig om gränsland.`, TRIBE.hire, [selectField('tribeId', 'Gränsfolk', deal)], true, 'risky', deal.length ? '' : none);
  add('crush_tribe', 'Slå ner gränsfolk', `Ett fälttåg som avgörs genast. En seger håller folket borta i ${TRIBE.crushYears} år; ett nederlag kostar män och anseende.`, TRIBE.crush, [selectField('tribeId', 'Gränsfolk', crush)], true, 'risky', crush.length ? '' : none);
}
const PUBLIC_COMMANDS = new Set(['appoint', 'dismiss', 'banish', 'tax_policy', 'abdicate', 'recognize_claim', 'release_prisoner', 'execute_prisoner', 'reward_councillor', 'set_reign_goal', 'build_wonder', 'foreign_marriage', 'fabricate_claim', 'declare_war', 'make_peace', 'envoy_request', 'bribe_tribe', 'hire_tribe', 'crush_tribe', ...Object.values(ARCHETYPES).map((archetype) => archetype.action)]);
// Every command type with its own branch in handleCommand. attempt_action refuses these ids and points to the command instead.
const COMMAND_TYPES = new Set([...PUBLIC_COMMANDS, 'provide_care', 'rest', 'gift', 'exercise_office', 'educate', 'marry', 'adopt', 'build_estate', 'seek_office', 'build_support', 'press_claim', 'seek_patron', 'return_exile', 'livelihood', 'sell_estate', 'patronize_faith', 'seek_refuge', 'request_regent_consent', 'resolve_regency', 'resolve_story', 'abort_scheme', 'reinforce_scheme', 'hold_feast', 'converse_request', 'realm_effect', 'npc_intent']);
function commandActor(state, type) {
  return PUBLIC_COMMANDS.has(type) || (['patronize_faith', 'exercise_office'].includes(type) && canRule(state)) ? realmExecutive(state) : householdRepresentative(state);
}
function logEvent(state, events, type, title, description, participants = [], extra = {}) { const event = { id: nextId(state, 'event'), date: state.date, type, title, description, participants: participants.filter(Boolean), public: true, ...extra }; state.log.push(event); events.push(event); return event; }
function memory(state, type, title, participants, options = {}) { const item = { id: nextId(state, 'memory'), date: state.date, type, title, participants: participants.filter(Boolean), causeId: options.causeId || null, knownBy: options.knownBy || 'public', familyIds: [...new Set(participants.map((id) => state.people[id]?.familyId).filter(Boolean))], ...options }; state.memories.push(item); return item; }
function relation(state, fromId, toId) { const key = `${fromId}:${toId}`; if (!state.relations[key]) state.relations[key] = { fromId, toId, bonds: [], causes: [] }; return state.relations[key]; }
function opinionCause(state, fromId, toId, amount, label, causeId, years = 10) { if (!fromId || !toId || fromId === toId) return; const rel = relation(state, fromId, toId); if (rel.causes.some((c) => c.causeId === causeId)) return; rel.causes.push({ id: nextId(state, 'opinion'), amount, label, causeId, startAt: state.date, expiresAt: years ? addGameMonths(state.date, years * 12) : null }); }
export function getPersonalOpinion(state, fromId, toId) { if (fromId === toId) return 100; const rel = state.relations[`${fromId}:${toId}`]; const base = state.people[fromId]?.familyId === state.people[toId]?.familyId ? 8 : 0; return clamp(base + (rel?.causes || []).filter((c) => !c.expiresAt || compareGameDates(c.expiresAt, state.date) > 0).reduce((sum, c) => sum + c.amount, 0), -100, 100); }
function addBond(state, a, b, kind) { for (const [from, to] of [[a, b], [b, a]]) { const rel = relation(state, from, to); if (!rel.bonds.includes(kind)) rel.bonds.push(kind); } }
function visibleTo(state, item) { return item.knownBy === 'public' || item.public === true || (Array.isArray(item.knownBy) && item.knownBy.includes(activeRepresentative(state)?.id)); }
function religiousSupport(state, id, excludedIds = []) { const exercisingId = realmExecutive(state)?.id; const treaty = state.projects.some((p) => p.kind === 'sanctuary' && p.status === 'active' && !excludedIds.includes(p.ownerId) && p.ownerId === exercisingId && compareGameDates(p.dueAt, state.date) > 0); return clamp((state.religions[id]?.support || 50) + (treaty ? 15 : 0)); }
function familySupport(state, family, excludedIds = []) { const leader = ruler(state); if (!leader) return 30; const head = state.people[family.headId]; const seats = values(state.offices).filter((o) => !excludedIds.includes(o.holderId) && state.people[o.holderId]?.familyId === family.id && o.id !== 'ruler').length; const religious = religiousSupport(state, family.religionId, excludedIds); return clamp(40 + family.grievance + getPersonalOpinion(state, head?.id, leader.id) * 0.3 + seats * 6 + (religious - 50) * 0.2 + (family.id === leader.familyId ? 10 : 0) + claimSupportPenalty(state, family.id, excludedIds)); }
function opinionReasons(state, fromId, toId) {
  if (fromId === toId) return [{ label: 'Egen person', value: 100 }];
  const items = state.people[fromId]?.familyId === state.people[toId]?.familyId ? [{ label: 'Gemensam familj', value: 8 }] : [];
  const causes = state.relations[fromId + ':' + toId]?.causes || [];
  return [...items, ...causes.filter((c) => !c.expiresAt || compareGameDates(c.expiresAt, state.date) > 0).map((c) => ({ label: c.label, value: c.amount, causeId: c.causeId, expiresAt: c.expiresAt }))];
}
function familySupportReasons(state, family) {
  const leader = ruler(state); if (!leader) return [{ label: 'Interregnum', value: 30 }];
  const seats = values(state.offices).filter((o) => o.id !== 'ruler' && state.people[o.holderId]?.familyId === family.id).length;
  return [{ label: 'Grundläggande samarbete', value: 40 }, { label: 'Familjens intressen och oförrätter', value: rounded(family.grievance) }, { label: 'Familjeledningens personliga åsikt', value: rounded(getPersonalOpinion(state, family.headId, leader.id) * 0.3) }, { label: 'Ämbetsrepresentation', value: seats * 6 }, { label: 'Religiöst stöd', value: rounded((religiousSupport(state, family.religionId) - 50) * 0.2) }, { label: 'Familjen innehar tronen', value: family.id === leader.familyId ? 10 : 0 }, { label: 'Ett rättsligt tronanspråk förbigås', value: claimSupportPenalty(state, family.id) }];
}
function stressFor(person, tag) { const costs = { cruel: (has(person, 'compassionate') ? 28 : 7) + (has(person, 'dutiful') ? 8 : 0), betrayal: (has(person, 'dutiful') ? 28 : 8) + (has(person, 'compassionate') ? 10 : 0), generous: has(person, 'greedy') ? 14 : 0, risky: has(person, 'cautious') ? 18 : 4, surrender: has(person, 'ambitious') ? 24 : 6, duty: has(person, 'dutiful') ? 0 : 3 }; return fitsNature(person, tag) ? 0 : (costs[tag] || 0) + natureStress(person, tag); }
function charge(state, amount, { publicFunds = false, orders = 1, tag = 'duty' } = {}) { const actor = publicFunds ? realmExecutive(state) : householdRepresentative(state); if (!canExerciseMandate(actor, state.date)) throw new Error(publicFunds ? 'Riket saknar en handlingsförmögen företrädare.' : 'Familjen saknar en handlingsförmögen företrädare.'); const account = publicFunds ? state.realm : controlledFamily(state); if (!account) throw new Error('Ingen behörig resursägare finns.'); if (publicFunds && !canRule(state)) throw new Error('Familjen saknar rätt att använda statskassan.'); if (state.actionPoints < orders) throw new Error('Årets handlingsutrymme är slut. För tiden framåt.'); if (account.treasury < amount) throw new Error(`Det behövs ${amount} silver; tillgängligt ${Math.floor(account.treasury)}.`); account.treasury = rounded(account.treasury - amount); state.actionPoints -= orders; actor.stress = clamp(actor.stress + stressFor(actor, tag), 0, 200); if (actor.id === state.reign.rulerId) recordDeed(state, tag); return actor; }
function requirePerson(state, id, { grown = false } = {}) { const person = state.people[id]; if (!alive(person) || (grown && !adult(state, person))) throw new Error(grown ? 'Välj en levande myndig person.' : 'Personen lever inte eller saknas.'); return person; }
function requireRule(state) { if (!canRule(state)) throw new Error('Beslutet kräver härskarens eller regentens mandat.'); }
function requireOwn(state, person) { if (person.familyId !== controlledFamily(state)?.id) throw new Error('Familjebandet ger inte kontroll över denna persons beslut.'); }
const meritScore = (state, p, excludedIds) => p.skills.diplomacy + p.skills.stewardship + familySupport(state, state.families[p.familyId], excludedIds) / 10;
// The elective order and the electors' vote on it. Reads only and draws nothing.
function electiveTally(state, oldRuler, people, excludedIds) { const score = (p) => meritScore(state, p, excludedIds); const tiers = electiveTiers(state, oldRuler, people, score); return { ordered: [...tiers.adults, ...tiers.minors, ...tiers.others], tally: tallyElection(state, oldRuler, tiers, score, (fromId, toId) => getPersonalOpinion(state, fromId, toId)) }; }
function rulerCandidates(state, oldRuler = ruler(state), excludedIds = []) { const people = living(state).filter((p) => p.id !== oldRuler?.id && !excludedIds.includes(p.id)); if (state.realm.successionLaw === 'merit') return people.filter((p) => adult(state, p)).sort((a, b) => meritScore(state, b, excludedIds) - meritScore(state, a, excludedIds) || a.id.localeCompare(b.id)); if (state.realm.successionLaw === 'elective') { const { ordered, tally } = electiveTally(state, oldRuler, people, excludedIds); return electionOrder(ordered, tally); } return primogenitureCandidates(state, oldRuler, people, (p) => adult(state, p)); }
// Both the actual death transition and its read-only forecast use this branch.
// Exclusions omit a departing person's secondary offices and personal support
// from candidate scoring without changing their saved record.
function selectDeathSuccessor(state, previous, lawfulBeforeId, lawfulAfter, excludedIds = []) {
  const candidate = previous.id === lawfulBeforeId ? lawfulAfter : rulerCandidates(state, previous, excludedIds)[0];
  return alive(candidate) && !excludedIds.includes(candidate.id) ? candidate : null;
}

function successionPerson(state, person) {
  if (!alive(person)) return null;
  const archetype = ARCHETYPES[person.archetype];
  return { id: person.id, name: person.name, familyId: person.familyId, familyName: state.families[person.familyId]?.name || '',
    age: getCharacterAge(person, state.date), archetype: person.archetype, archetypeLabel: archetype?.name || person.archetype,
    ability: archetype ? { action: archetype.action, label: archetype.ability, description: archetype.description } : null };
}

/** Current-date conditional view; never advances time, draws RNG or persists. */
export function getSuccessionForecast(state) {
  if (!state) return null;
  const previous = ruler(state);
  const available = state.realm.alive && alive(previous);
  const excludedIds = available ? [previous.id] : [];
  const lawful = state.people[state.realm.lawfulRulerId];
  const lawfulAfter = previous?.id === lawful?.id ? rulerCandidates(state, previous, excludedIds)[0] : lawful;
  const incoming = available ? selectDeathSuccessor(state, previous, state.realm.lawfulRulerId, lawfulAfter, excludedIds) : null;
  const regent = state.people[state.offices.ruler.regentId];
  const exercising = available ? royalRegency(state)?.phase === 'contested' && canExerciseMandate(regent, state.date) ? regent : realmExecutive(state) : null;
  const regency = state.regencies?.['office:ruler'];
  const contestedRegency = regency?.phase === 'contested' && regency.principalId === previous?.id;
  const requiresRegency = Boolean(incoming && !canExerciseMandate(incoming, state.date));
  const current = successionPerson(state, exercising);
  const expected = successionPerson(state, incoming);
  const status = !state.realm.alive ? 'dissolved' : !alive(previous) ? 'vacant' : expected ? 'conditional' : 'no-successor';
  // An empty elective court elects a generated outsider at the death itself; the forecast names the election and creates nobody.
  const electionFromOutside = Boolean(available && !incoming && state.realm.successionLaw === 'elective');
  const personal = state.projects.filter((project) => project.status === 'active' && project.personal);
  const projectView = (project) => ({ id: project.id, title: project.title, kind: project.kind,
    ownerId: project.ownerId, ownerName: state.people[project.ownerId]?.name || 'Okänd uppdragsgivare',
    familyId: project.familyId || null, familyName: state.families[project.familyId]?.name || null });
  return {
    status, actualRuler: successionPerson(state, previous), lawfulRuler: successionPerson(state, lawful),
    legalHeir: successionPerson(state, state.people[state.realm.legalHeirId]),
    expectedRuler: expected, currentExercising: current,
    contestedCrown: Boolean(available && alive(lawful) && previous.id !== lawful.id),
    contestedRegency: Boolean(contestedRegency), currentUsesRegent: Boolean(exercising && exercising.id === regent?.id),
    requiresRegency, electionFromOutside, election: available && state.realm.successionLaw === 'elective' ? presentElection(state, electiveTally(state, previous, living(state).filter((p) => p.id !== previous.id), excludedIds).tally, loyaltyPrecision(state, actionHooks(state))) : null, abilityChanges: current && expected ? current.ability?.action !== expected.ability?.action : null,
    basis: 'Om bara den nuvarande härskaren avlider vid dagens datum och övriga förhållanden består. Senare dödsfall, nya lagar och maktkamper kan ändra utfallet.',
    authority: !available ? 'Inget aktivt härskarmandat att föra vidare.' : electionFromOutside ? 'Ingen vuxen vid hovet är behörig. Valet faller på en genererad person utanför hovet.' : !expected ? 'Ingen levande kandidat finns i dagens successionsordning.' : requiresRegency
      ? adult(state, incoming) ? 'Efterträdaren är svårt sjuk och behöver en behörig regent tills förmågan återkommer. Ämbetet och arvsrätten följer fortfarande efterträdaren.' : 'Efterträdaren är omyndig. En regent behöver utöva mandatet; barnets egen förmåga kan inte användas direkt. Regentens identitet och samtycke fastställs vid övergången.'
      : 'Efterträdarens egen förmåga hör till det nya mandatet. Tillgängliga beslut beror också på resurser, aktiva projekt och kampanjens behörighet.',
    currentAuthority: !available ? 'Inget aktivt härskarmandat.' : contestedRegency ? 'Regenten håller kvar mandatet. Härskarens beslut är spärrade tills konflikten har lösts.' : !current ? adult(state, previous) ? 'Härskaren är svårt sjuk och saknar en handlingsförmögen företrädare. Kalendern kan fortsätta.' : 'Härskaren är omyndig och saknar en myndig företrädare. Ingen arketypförmåga kan utövas nu.' : exercising.id === regent?.id
      ? 'Regenten utövar mandatet. Vissa beslut kräver regentens samtycke.' : 'Den faktiska härskaren utövar mandatet.',
    identity: { mode: state.identity.mode, familyId: state.identity.mode === 'family' ? state.identity.familyId : expected?.familyId || null,
      familyKeepsThrone: state.identity.mode === 'family' && expected ? expected.familyId === state.identity.familyId : null,
      description: state.identity.mode === 'family'
        ? 'Du följer samma familj även om tronen går till en annan familj. Familjens egendom består; fortsatt spel kräver en levande familjemedlem.'
        : 'Du följer riket genom den nya faktiska härskaren, även om en annan familj tar över. Ett upplöst rike saknar fortsatt härskarmandat.' },
    projects: {
      ending: available ? personal.filter((project) => project.ownerId === previous.id).map(projectView) : [],
      otherPersonal: personal.filter((project) => !available || project.ownerId !== previous.id).map(projectView),
      publicConstruction: state.projects.filter((project) => project.status === 'active' && !project.personal && ['academy', 'aqueduct', 'wonder'].includes(project.kind)).map(projectView),
      familyEstates: state.projects.filter((project) => project.status === 'active' && !project.personal && project.kind === 'estate').map(projectView),
      academyEstablished: Boolean(state.realm.academy),
    },
  };
}

function chooseGuardian(state, familyId, childId) { const adults = byAge(state, familyMembers(state, familyId).filter((p) => adult(state, p) && p.id !== childId)); return adults[0]?.id || byAge(state, living(state).filter((p) => adult(state, p)))[0]?.id || null; }
function reconcileLegalPosition(state, events) {
  const previousId = state.realm.lawfulRulerId;
  refreshLegalClaims(state, rulerCandidates);
  if (previousId && state.realm.lawfulRulerId && previousId !== state.realm.lawfulRulerId) {
    const person = state.people[state.realm.lawfulRulerId];
    const event = logEvent(state, events, 'legal_succession', 'Det rättsliga tronanspråket förs vidare', person.name + ' ärver den erkända rätten. Faktisk kontroll över tronen prövas separat.', [previousId, person.id]);
    memory(state, 'inherited_claim', event.title, event.participants, { causeId: event.id });
  }
}
function refreshRepresentation(state, events = [], { silent = false } = {}) {
  ensureGovernance(state); ensureMandateEpisodes(state);
  const context = { emit: logEvent, events, silent, excluded: (person) => isImprisoned(state, person.id) };
  for (const family of values(state.families).sort((a, b) => a.id.localeCompare(b.id))) {
    family.guardianId = reconcileMandateEpisode(state, `family:${family.id}`, family.headId, context);
  }
  const office = state.offices.ruler, monarch = ruler(state), old = office.regentId;
  const previousBasis = state.regencies['office:ruler']?.basis;
  office.regentId = state.realm.alive ? reconcileMandateEpisode(state, 'office:ruler', monarch?.id, context) : null;
  if (!silent && old && !office.regentId && canExerciseMandate(monarch, state.date)) {
    if (previousBasis !== 'incapacity') suspendPersonalProjects(state, old);
    logEvent(state, events, 'regency', 'Regentskapet upphör', monarch.name + ' tar över sitt fulla mandat.', [monarch.id, old]);
    const regent = state.people[old];
    if (previousBasis !== 'incapacity' && has(regent, 'ambitious')) { regent.stress = clamp(regent.stress + 15, 0, 200); opinionCause(state, old, monarch.id, -10, 'Förlorat regentmandat', 'mandate:' + monarch.id); }
  }
}
function refreshMandates(state, events) {
  ensureGovernance(state);
  // A new head is the eldest living member outside prison; only when all sit in prison does the eldest prisoner take the place.
  for (const family of values(state.families)) if (!alive(state.people[family.headId])) { const members = byAge(state, familyMembers(state, family.id)); family.headId = (members.find((person) => !isImprisoned(state, person.id)) || members[0])?.id || null; }
  for (const faith of values(state.religions)) {
    const priest = state.people[state.offices.priest?.holderId];
    if (adult(state, priest) && priest.religionId === faith.id) faith.leaderId = priest.id;
    else if (!alive(state.people[faith.leaderId])) faith.leaderId = byAge(state, living(state).filter((person) => adult(state, person) && person.religionId === faith.id))[0]?.id || null;
  }
  refreshRepresentation(state, events);
  reconcileLegalPosition(state, events);
}
function refreshStories(state, events) {
  refreshEventChains(state, events, chainContext(state), chainHooks(state));
  refreshDirectedStories(state, events, storyContext(state), { emit: logEvent, resolve: (story, choice) => resolveStory(state, story, choice, events, true) });
  // A crime case or an uncovered plot cannot be answered against the ruler or the person the player acts through (imprisonPerson refuses them), so the story falls when its actor gains that power.
  const empowered = new Set([state.offices.ruler.holderId, activeRepresentative(state)?.id, householdRepresentative(state)?.id].filter(Boolean));
  const ownFamilyId = controlledFamily(state)?.id;
  for (const story of state.stories.filter((item) => ['open', 'waiting'].includes(item.status))) {
    if (story.type === 'coup' && (!alive(state.people[story.actorId]) || story.actorId === state.offices.ruler.holderId)) {
      story.status = 'closed'; story.resolvedAt = state.date;
      story.resolution = !alive(state.people[story.actorId]) ? 'Utmanaren har avlidit; familjens maktbas består.' : 'Utmanaren innehar redan härskarämbetet.';
      logEvent(state, events, 'story_closed', story.title, story.resolution, [story.actorId]);
    }
    if (['office_promise', 'promise_due', 'legacy_claim'].includes(story.type) && story.familyId) {
      if (!familyMembers(state, story.familyId).length) { story.status = 'closed'; story.resolvedAt = state.date; story.resolution = 'Familjen saknar en giltig företrädare.'; logEvent(state, events, 'story_closed', story.title, story.resolution, []); }
      else {
        if (!alive(state.people[story.actorId])) { story.originalActorId ||= story.actorId; story.actorId = state.families[story.familyId].headId; }
        if (story.status === 'waiting' && compareGameDates(story.dueAt, state.date) <= 0) {
          story.status = 'open'; story.reopenedAt = state.date; story.targetId = ruler(state)?.id;
          logEvent(state, events, 'story', story.title, story.description, [story.actorId, story.targetId]);
        }
      }
    }
    if (story.type === 'health_care') { const patient = state.people[story.actorId]; const condition = patient?.healthConditions?.find((item) => item.id === story.conditionId); if (!alive(patient) || !condition || !['active', 'recovering'].includes(condition.stage) || condition.treatment || patient.familyId !== controlledFamily(state)?.id) { story.status = 'closed'; story.resolvedAt = state.date; story.resolution = 'Detta vårdbeslut är inte längre giltigt för ditt hushåll.'; } }
    if (story.type === 'punish_crime' && (!alive(state.people[story.actorId]) || isImprisoned(state, story.actorId) || empowered.has(story.actorId) || compareGameDates(story.dueAt, state.date) <= 0)) {
      story.status = 'closed'; story.resolvedAt = state.date;
      story.resolution = !alive(state.people[story.actorId]) ? 'Gärningspersonen har avlidit; ärendet faller.' : isImprisoned(state, story.actorId) ? 'Gärningspersonen sitter redan fängslad; ärendet faller.' : empowered.has(story.actorId) ? 'Gärningspersonen företräder familjen eller riket; ärendet faller.' : 'Ärendet förföll utan dom.';
      logEvent(state, events, 'story_closed', story.title, story.resolution, [story.actorId]);
    }
    if (story.type === 'ransom_offer' && (!isImprisoned(state, story.actorId) || compareGameDates(story.dueAt, state.date) <= 0)) {
      story.status = 'closed'; story.resolvedAt = state.date; story.resolution = isImprisoned(state, story.actorId) ? 'Erbjudandet förföll utan svar.' : 'Fången sitter inte längre fängslad; erbjudandet förföll.';
      logEvent(state, events, 'story_closed', story.title, story.resolution, [story.actorId]);
    }
    // plot_uncovered opens only for a plotter outside the controlled family, so a plotter inside it got there by a change of crown.
    const plotterInPower = story.type === 'plot_uncovered' && (empowered.has(story.actorId) || state.people[story.actorId]?.familyId === ownFamilyId);
    if (story.type === 'plot_uncovered' && (!alive(state.people[story.actorId]) || isImprisoned(state, story.actorId) || plotterInPower || compareGameDates(story.dueAt, state.date) <= 0)) {
      story.status = 'closed'; story.resolvedAt = state.date;
      story.resolution = !alive(state.people[story.actorId]) ? 'Komplottmakaren har avlidit; ärendet faller.' : isImprisoned(state, story.actorId) ? 'Komplottmakaren sitter fängslad; ärendet faller.' : plotterInPower ? 'Komplottmakaren har själv fått makten eller hör till din ätt; ärendet faller.' : 'Ärendet förföll utan beslut.';
      logEvent(state, events, 'story_closed', story.title, story.resolution, [story.actorId]);
    }
    if (story.type === 'stress_crisis' && !alive(state.people[story.actorId])) { story.status = 'closed'; story.resolvedAt = state.date; story.resolution = 'Personens liv har avslutats.'; }
  }
  const reigning = state.offices.ruler.holderId;
  refreshCourtStories(state, events, actionHooks(state));
  // A forced abdication crowns here, after the checks above read the old ruler. They run again on the same date, as they do after a crown from a command, or a story would fall on the next refresh, and a split advance has more of those than a whole one.
  if (state.offices.ruler.holderId !== reigning) { refreshMandates(state, events); refreshStories(state, events); }
}
function suspendPersonalProjects(state, personId) { for (const project of state.projects.filter((p) => p.status === 'active' && p.ownerId === personId && p.personal)) project.status = 'ended'; }
function crown(state, person, events, reason, legitimacy = 55, lawful = true) { const previous = ruler(state); registerAccession(state, { previousId: previous?.id, newId: person?.id, lawful, reason }); if (previous) suspendPersonalProjects(state, previous.id); state.offices.ruler.holderId = person?.id || null; state.offices.ruler.history.push({ personId: person?.id || null, date: state.date, reason }); state.realm.legitimacy = legitimacy; if (!person) { state.realm.alive = false; logEvent(state, events, 'interregnum', 'Rikets ledning upphör', 'Inga behöriga företrädare finns kvar.', []); } else { state.realm.alive = true; const event = logEvent(state, events, 'succession', `${person.name} tillträder`, `${reason}. Den nya ledarens arketyp är ${ARCHETYPES[person.archetype].name}.`, [previous?.id, person.id]); memory(state, 'succession', event.title, event.participants, { causeId: event.id }); for (const fam of values(state.families)) if (fam.id !== person.familyId) fam.grievance = clamp(fam.grievance - 2, -40, 40); if (closePrisoner(state, person.id, 'released', 'Ärvde tronen')) logEvent(state, events, 'prisoner_released', `${person.name} friges`, 'Ärvde tronen. Den nya härskaren lämnar fängelset.', [person.id]); passCrown(state, person.familyId, events, actionHooks(state)); } refreshMandates(state, events); onAccession(state, person, { lawful, legitimacy }); }
function killPeople(state, ids, events, reason = 'Ålder och hälsa') {
  const deceased = [...new Set(ids)].map((id) => state.people[id]).filter(alive);
  if (!deceased.length) return;
  const oldRuler = ruler(state); const oldLawfulId = state.realm.lawfulRulerId;
  ensureHealthState(state);
  // Mark all deaths at this boundary before selecting any successor or heir.
  for (const person of deceased) {
    freezeDeathAppearance(person, state.date, state.families[person.familyId]);
    person.diedAt = state.date;
    person.deathReason = typeof reason === 'string' ? reason : reason[person.id] || 'Ålder och hälsa';
    suspendPersonalProjects(state, person.id);
    closePrisoner(state, person.id, 'dead', person.deathReason);
  }
  for (const person of deceased) {
    inheritGrudges(state, person, actionHooks(state));
    const heirs = byAge(state, living(state).filter((p) => p.legalParentIds.includes(person.id)));
    const heir = heirs[0] || byAge(state, familyMembers(state, person.familyId))[0];
    if (heir) heir.wealth = rounded(heir.wealth + person.wealth); else state.families[person.familyId].treasury += person.wealth;
    person.wealth = 0;
    for (const office of values(state.offices)) if (office.holderId === person.id && office.id !== 'ruler') { office.holderId = null; office.history.push({ personId: null, date: state.date, reason: 'Dödsfall' }); }
    const event = logEvent(state, events, 'death', `${person.name} har avlidit`, `${person.deathReason}. Personlig egendom går till ${heir?.name || 'familjen'}; familjens gemensamma egendom består.`, [person.id, heir?.id]);
    memory(state, 'death', event.title, [person.id, heir?.id], { causeId: event.id });
    for (const p of living(state)) if (p.legalParentIds.includes(person.id) || spouseIdsOf(p).includes(person.id)) p.stress = clamp(p.stress + 15, 0, 200);
    recordBereavement(state, person, event.id, events);
  }
  reconcileLegalPosition(state, events);
  if (oldRuler && !alive(oldRuler)) {
    const successor = selectDeathSuccessor(state, oldRuler, oldLawfulId, state.people[state.realm.lawfulRulerId]);
    if (!successor && state.realm.successionLaw === 'elective') crown(state, electOutsider(state, oldRuler), events, ELECTION_REASON_SV, 55, oldRuler.id === oldLawfulId);
    else crown(state, successor, events, 'Successionsordningen har tillämpats', 55, oldRuler.id === oldLawfulId);
    partitionInheritance(state, oldRuler, events, actionHooks(state));
  }
  refreshMandates(state, events); refreshStories(state, events); updateStatus(state);
}
function updateStatus(state) { const family = controlledFamily(state); if (state.identity.mode === 'realm' && !state.realm.alive) state.status = { ended: true, reason: 'Riket saknar en giltig fortsättning.' }; else if (state.identity.mode === 'family' && !familyMembers(state, state.identity.familyId).length) state.status = { ended: true, reason: 'Familjen saknar levande medlem eller erkänd fortsättare.' }; else state.status = { ended: false, reason: family?.exiled ? 'Familjen lever i exil.' : '' }; }

export function createCharacterState(options, { familyId, religions }) {
  const date = normalizeGameDate(options.date || '-0300-01-01'); if (!date) throw new Error('Ogiltigt startdatum.');
  const state = { schemaVersion: SCHEMA_VERSION, rulesVersion: RULES_VERSION, contentVersion: CONTENT_VERSION, revision: 0, sequence: 0, date, startedAt: date, nextAnnualDate: addGameMonths(date, 12), rngState: seedNumber(options.seed || 104729), identity: { mode: options.mode === 'family' ? 'family' : 'realm', polityId: String(options.polityId || 'hadara'), familyId: familyId }, realm: { id: String(options.polityId || 'hadara'), name: options.polityName || 'Hadara', kind: 'state', treasury: 240, legitimacy: 65, prestige: 10, alive: true, successionLaw: 'primogeniture', taxPolicy: 'balanced', armyStrength: 55, infrastructure: 0, academy: false }, people: {}, families: {}, offices: {}, cities: {}, religions, relations: {}, memories: [], stories: [], projects: [], log: [], appliedCommandIds: [], actionPoints: 4, status: { ended: false, reason: '' } };
  return state;
}

export function completeCharacterState(state, difficulty) {
  ensureGovernance(state); ensureHealthState(state); ensureMandateEpisodes(state); ensureStoryDirector(state); ensureEventChains(state); ensureLineageState(state); state.difficulty = normalizeDifficulty(difficulty); ensureCharacterExtensions(state); refreshLegalClaims(state, rulerCandidates);
  return state;
}

export function createCharacterSystem(options = {}) {
  const state = createCharacterState(options, { familyId: FAMILY_SEEDS.some((f) => f.id === options.familyId) ? options.familyId : 'family-arel', religions: { dawn: { id: 'dawn', name: 'Gryningens tempel', support: 58, leaderId: 'person-3-0' }, river: { id: 'river', name: 'Flodens väktare', support: 52, leaderId: 'person-2-0' } } });
  const date = state.date;
  const archetypes = Object.keys(ARCHETYPES);
  FAMILY_SEEDS.forEach((family, f) => {
    state.families[family.id] = { id: family.id, name: family.name, color: family.color, religionId: family.religionId, headId: `person-${f}-0`, guardianId: null, treasury: 110, estates: 2, influence: f === 0 ? 60 : 45, grievance: f === 1 ? -4 : 0, exiled: false, hostFamilyId: null, claims: [], cooldowns: {} };
    [54, 50, 28, 26, 10, 6].forEach((age, index) => { const id = `person-${f}-${index}`; state.people[id] = { id, name: `${family.names[index]} ${family.name}`, familyId: family.id, bornAt: addGameMonths(date, -age * 12), diedAt: null, sex: index % 2 === 0 ? 'female' : 'male', culture: 'Hadariska', religionId: family.religionId, traits: index === 2 && f === 0 ? ['compassionate', 'gregarious'] : [...family.traits], archetype: index === 0 ? family.archetype : archetypes[(f * 2 + index) % archetypes.length], skills: { command: 4 + (f + index) % 6, stewardship: 4 + (f * 2 + index) % 6, diplomacy: 4 + (f + index * 2) % 6, learning: 4 + (f + index * 3) % 6 }, stress: 0, health: 100, wealth: age >= ADULT_AGE ? 30 : 0, loyalty: f === 1 ? 48 : 68, fear: 0, biologicalParentIds: index >= 4 ? [`person-${f}-2`, `person-${f}-3`] : index === 2 ? [`person-${f}-0`, `person-${f}-1`] : [], legalParentIds: index >= 4 ? [`person-${f}-2`, `person-${f}-3`] : index === 2 ? [`person-${f}-0`, `person-${f}-1`] : [], spouseId: index < 4 ? `person-${f}-${index % 2 === 0 ? index + 1 : index - 1}` : null, mentorId: index >= 4 ? `person-${f}-2` : null, education: index >= 4 ? 'learning' : null, goal: { type: family.traits.includes('ambitious') ? 'office' : 'security', since: date, progress: 0 }, lastBirthAt: null, lastDecision: null, cooldowns: {} }; });
    for (const [a, b] of [[0, 1], [2, 3]]) { addBond(state, `person-${f}-${a}`, `person-${f}-${b}`, 'partner'); opinionCause(state, `person-${f}-${a}`, `person-${f}-${b}`, 25, 'Äktenskap', `marriage:${f}:${a}`, 0); opinionCause(state, `person-${f}-${b}`, `person-${f}-${a}`, 25, 'Äktenskap', `marriage:${f}:${a}`, 0); }
  });
  state.people['person-0-2'].archetype = 'diplomat';
  for (const person of values(state.people)) { person.portraitId = person.id; person.portraitSourceAgeGroup = portraitGroup(getCharacterAge(person, date)); const familyName = state.families[person.familyId].name; if (person.name === `${familyName} ${familyName}`) person.name = `${familyName} av ${state.realm.name}`; }
  const cityList = options.cities?.length ? options.cities : [{ id: 'hadara', name: 'Hadara' }, { id: 'narim', name: 'Narim' }, { id: 'selene', name: 'Selene' }];
  cityList.slice(0, 12).forEach((city, i) => { const id = String(city.id || `city-${i}`); state.cities[id] = { id, name: city.name || id, regionId: city.regionId || null, familyId: FAMILY_SEEDS[i % 4].id, baseRevenue: 18 + i * 2, infrastructure: 0, unrest: 12, governorOfficeId: `governor-${i}` }; state.offices[`governor-${i}`] = { id: `governor-${i}`, name: `Guvernör: ${city.name || id}`, kind: 'governor', holderId: `person-${i % 4}-${i === 0 ? 2 : 0}`, cityId: id, regentId: null, history: [], publicBudget: 30 }; });
  for (const [id, name, holderId] of [['ruler', 'Härskare', 'person-0-0'], ['general', 'Överbefälhavare', 'person-1-2'], ['chancellor', 'Kansler', 'person-2-2'], ['priest', 'Överstepräst', 'person-3-0']]) state.offices[id] = { id, name, kind: id, holderId, regentId: null, history: [{ personId: holderId, date, reason: 'Kampanjstart' }], publicBudget: 30 };
  completeCharacterState(state, options.difficulty);
  // Moment 1 of the intrigue phase: the chancellor's private affair. New campaigns only; draws no randomness.
  createSecret(state, { type: 'affair', subjectId: 'person-2-2', holderIds: ['person-2-2'], evidence: 'strong', causeId: null });
  const events = []; logEvent(state, events, 'foundation', 'En generation tar ansvar', `${state.realm.name} formas av fyra familjer. Du följer ${state.identity.mode === 'realm' ? 'riket genom dess ledare' : `familjen ${state.families[state.identity.familyId].name}`}.`, [ruler(state).id]);
  state.stories.push({ id: nextId(state, 'story'), type: 'office_promise', title: 'Ett löfte vid gränsen', description: 'Namar kräver ett framtida guvernörsämbete som erkännande för arméns tjänst. Ett löfte kan ge stöd nu och binda nästa generation.', actorId: 'person-1-2', targetId: ruler(state).id, familyId: 'family-namar', officeId: values(state.offices).find((o) => o.kind === 'governor' && o.holderId !== 'person-1-2')?.id, createdAt: date, dueAt: addGameMonths(date, 36), status: 'open', knownBy: 'public' });
  return state;
}

function validatePlainData(root) {
  const seen = new WeakSet();
  const visit = (value, depth) => {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Sparfilen innehåller ett ogiltigt tal.');
    if (!value || typeof value !== 'object') return;
    if (depth > 60 || seen.has(value)) throw new Error('Sparfilens struktur är ogiltig.');
    seen.add(value);
    for (const [key, entry] of Object.entries(value)) { if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Sparfilen innehåller en otillåten datanyckel.'); visit(entry, depth + 1); }
    seen.delete(value);
  };
  visit(root, 0);
}
function validateReferences(state) {
  if (!Number.isInteger(state.revision) || state.revision < 0 || !Number.isInteger(state.sequence) || state.sequence < 0 || compareGameDates(state.nextAnnualDate, state.date) <= 0) throw new Error('Sparfilens revisions- eller kalendergräns är ogiltig.');
  for (const kind of ['people', 'families', 'offices', 'cities', 'religions']) for (const [id, entry] of Object.entries(state[kind])) if (!safeId(id) || entry.id !== id) throw new Error('Sparfilens identiteter stämmer inte.');
  for (const person of values(state.people)) {
    if (!Array.isArray(person.traits) || !Array.isArray(person.biologicalParentIds) || !Array.isArray(person.legalParentIds) || !person.cooldowns || !person.skills || !state.religions[person.religionId]) throw new Error('En person saknar giltiga egenskaper.');
    if (Object.keys(SKILL_LABELS).some((key) => !Number.isFinite(person.skills[key]) || person.skills[key] < 0)) throw new Error('En person har ogiltig kompetens.');
    if (['wealth', 'stress', 'health', 'loyalty', 'fear'].some((key) => !Number.isFinite(person[key]) || person[key] < 0)) throw new Error('En person har ogiltigt tillstånd.');
    const spouseError = otherSpousesError(state, person); if (spouseError) throw new Error(spouseError);
    if ([...person.biologicalParentIds, ...person.legalParentIds, person.spouseId, person.mentorId].filter(Boolean).some((id) => !state.people[id])) throw new Error('Ett släktband hänvisar till en saknad person.');
    if (compareGameDates(person.bornAt, state.date) > 0 || (person.diedAt && (!normalizeGameDate(person.diedAt) || compareGameDates(person.diedAt, state.date) > 0))) throw new Error('Personens livsdatum ligger utanför kampanjen.');
  }
  for (const family of values(state.families)) if (!Number.isFinite(family.treasury) || family.treasury < 0 || !Number.isInteger(family.estates) || family.estates < 0 || (family.headId && !alive(state.people[family.headId])) || (family.guardianId && !alive(state.people[family.guardianId]))) throw new Error('Familjens tillgångar eller ledning är ogiltiga.');
  for (const city of values(state.cities)) if (!state.families[city.familyId] || !state.offices[city.governorOfficeId]) throw new Error('Staden saknar en giltig politisk koppling.');
  for (const story of state.stories) if (isOfficePromise(story) && Object.hasOwn(story, 'reopenedAt')) {
    const canonical = (date) => typeof date === 'string' && Boolean(date) && normalizeGameDate(date) === date;
    const validDates = [story.reopenedAt, story.createdAt, story.dueAt].every(canonical);
    if (!validDates || compareGameDates(story.reopenedAt, state.date) > 0 || compareGameDates(story.reopenedAt, story.createdAt) < 0 || compareGameDates(story.dueAt, story.createdAt) < 0 ||
      (story.status === 'waiting' && compareGameDates(story.dueAt, story.reopenedAt) <= 0) ||
      (['open', 'resolved'].includes(story.status) && compareGameDates(story.reopenedAt, story.dueAt) < 0)) throw new Error('Ämbetsärendets återöppningsdatum är ogiltigt.');
  }
}

export function normalizeCharacterSystem(raw) {
  if (raw == null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Karaktärssystemets sparformat är ogiltigt.');
  if (Number(raw.schemaVersion || 1) > SCHEMA_VERSION) throw new Error('Sparfilen använder en nyare version av karaktärssystemet. Originalet har behållits.');
  if (raw.schemaVersion !== 1) throw new Error('Karaktärssystemets version saknar en stödd migration.');
  if (raw.rulesVersion !== RULES_VERSION || raw.contentVersion !== CONTENT_VERSION) throw new Error('Kampanjens regel- eller innehållsversion stöds inte; automatisk regeländring är avstängd.');
  validatePlainData(raw);
  const state = copy(raw);
  if (state.historicalOrigin != null) {
    const origin = state.historicalOrigin;
    if (typeof origin !== 'object' || Array.isArray(origin)
      || origin.calendar !== 'proleptic-gregorian-no-year-zero'
      || !['contentId', 'contentVersion', 'eraLabelSv'].every(key => typeof origin[key] === 'string' && origin[key].trim())
      || !origin.bookmarkDate || normalizeGameDate(origin.bookmarkDate) !== origin.bookmarkDate
      || (origin.coverage !== undefined && (!Array.isArray(origin.coverage) || !origin.coverage.every(entry =>
        entry && typeof entry === 'object' && !Array.isArray(entry)
        && ['area', 'status', 'noteSv'].every(key => typeof entry[key] === 'string' && entry[key].trim())
        && Array.isArray(entry.sourceIds) && entry.sourceIds.every(id => typeof id === 'string' && id.trim()))))) {
      throw new Error('Sparfilens historiska ursprungsuppgifter är ogiltiga.');
    }
  }
  for (const key of ['people', 'families', 'offices', 'cities', 'religions', 'relations']) if (!state[key] || typeof state[key] !== 'object' || Array.isArray(state[key])) throw new Error(`Sparfilen saknar ${key}.`);
  for (const key of ['memories', 'stories', 'projects', 'log', 'appliedCommandIds']) if (!Array.isArray(state[key])) throw new Error(`Sparfilen saknar ${key}.`);
  if (!normalizeGameDate(state.date) || !normalizeGameDate(state.nextAnnualDate)) throw new Error('Sparfilens kalender är ogiltig.');
  if (!['realm', 'family'].includes(state.identity?.mode) || !state.families[state.identity.familyId] || !state.realm || !state.offices.ruler) throw new Error('Sparfilens kampanjidentitet är ogiltig.');
  ensureGovernance(state); ensureRealmKind(state); ensureCharacterExtensions(state);
  validateRealmKind(state);
  for (const person of values(state.people)) if (!state.families[person.familyId] || !normalizeGameDate(person.bornAt) || !ARCHETYPES[person.archetype] || !Number.isFinite(person.health)) throw new Error(`Ogiltig person: ${person.id}.`);
  for (const office of values(state.offices)) if (office.holderId && !alive(state.people[office.holderId])) throw new Error(`Ämbetet ${office.name} har en ogiltig innehavare.`);
  if (!Number.isFinite(state.revision) || !Number.isFinite(state.rngState) || !Number.isFinite(state.realm.treasury)) throw new Error('Sparfilen innehåller ogiltiga tal.');
  validateReferences(state);
  validateGovernance(state);
  ensureHealthState(state); validateHealthState(state);
  ensureMandateEpisodes(state); validateMandateEpisodes(state);
  refreshRepresentation(state, [], { silent: true });
  validateMandateEpisodes(state);
  ensureStoryDirector(state); validateStoryDirector(state);
  ensureEventChains(state); validateEventChains(state);
  ensureLineageState(state); validateLineageState(state);
  validateCharacterExtensions(state);
  // Called here rather than from validateCharacterExtensions: actionResolution.js imports extensions.js, so the reverse import would be a cycle.
  validateActionLog(state);
  validateSchemes(state);
  validateOccasions(state);
  validatePrisoners(state);
  validateCourt(state);
  validateRumors(state);
  validateConversations(state);
  ensureForeignRealms(state); validateForeignRealms(state);
  ensureTribes(state); validateTribes(state);
  return state;
}

export function getCharacterWorldEffects(state) {
  const leader = ruler(state); const exercising = realmExecutive(state);
  const personal = state.projects.filter((p) => p.status === 'active' && p.personal && p.ownerId === exercising?.id && compareGameDates(p.dueAt, state.date) > 0);
  const cityEffects = values(state.cities).map((city) => { const gov = state.people[state.offices[city.governorOfficeId]?.holderId]; const family = state.families[city.familyId]; const support = familySupport(state, family); const govEff = gov ? gov.skills.stewardship * 0.018 - Math.max(0, gov.stress - 60) * 0.002 - getConditionBurden(gov) : -0.12; const productionMultiplier = rounded(clamp(0.65 + support * 0.005 + govEff + city.infrastructure * 0.08 - city.unrest * 0.003 + (personal.some((p) => p.kind === 'reform') ? 0.15 : 0), 0.25, 2.5)); return { id: city.id, name: city.name, regionId: city.regionId, familyId: family.id, governorId: gov?.id || null, productionMultiplier, taxIncome: rounded(city.baseRevenue * productionMultiplier * (state.realm.taxPolicy === 'harsh' ? 1.25 : state.realm.taxPolicy === 'gentle' ? 0.8 : 1)), unrest: city.unrest }; });
  const general = state.people[state.offices.general.holderId]; const generalSupport = general ? familySupport(state, state.families[general.familyId]) : 25;
  const militaryReadiness = clamp(state.realm.armyStrength * 0.45 + (general?.skills.command || 0) * 2 + (general?.loyalty || 30) * 0.25 + generalSupport * 0.15 - (general?.stress || 0) * 0.1 - getConditionBurden(general) * 30 + (personal.some((p) => p.kind === 'mobilize') ? 20 : 0));
  return { realmAlive: state.realm.alive, polityId: state.identity.polityId, leaderId: leader?.id || null, leaderName: leader?.name || 'Interregnum', treasury: rounded(state.realm.treasury), annualRevenue: state.realm.alive ? rounded(cityEffects.reduce((sum, c) => sum + c.taxIncome, 0) - 20 - values(state.offices).filter((o) => o.kind !== 'ruler' && o.holderId).length * 5) : 0, productionMultiplier: rounded(cityEffects.reduce((sum, c) => sum + c.productionMultiplier, 0) / Math.max(1, cityEffects.length)), militaryReadiness: state.realm.alive ? rounded(militaryReadiness) : 0, legitimacy: rounded(state.realm.legitimacy), cityEffects, orders: state.actionPoints, date: state.date, revision: state.revision };
}

function assignOffice(state, office, candidate, events, reason = 'Utnämning') { const previous = state.people[office.holderId]; if (office.id === 'ruler') { crown(state, candidate, events, reason); return; } office.holderId = candidate?.id || null; office.history.push({ personId: candidate?.id || null, date: state.date, reason }); const event = logEvent(state, events, 'appointment', candidate ? `${candidate.name} blir ${office.name.toLowerCase()}` : `${office.name} blir vakant`, reason, [previous?.id, candidate?.id]); if (previous && previous.id !== candidate?.id) { const m = memory(state, 'dismissal', `Avsatt från ${office.name}`, [previous.id, ruler(state)?.id], { causeId: event.id }); opinionCause(state, previous.id, ruler(state)?.id, -20, 'Förlorat ämbete', m.id); state.families[previous.familyId].grievance = clamp(state.families[previous.familyId].grievance - 8, -40, 40); } if (candidate && candidate.id !== previous?.id) { const m = memory(state, 'appointment', `Utnämnd till ${office.name}`, [candidate.id, ruler(state)?.id], { causeId: event.id }); opinionCause(state, candidate.id, ruler(state)?.id, 15, 'Utnämning', m.id); state.families[candidate.familyId].grievance = clamp(state.families[candidate.familyId].grievance + 5, -40, 40); if (office.cityId) state.cities[office.cityId].familyId = candidate.familyId; } }
function storyContext(state, eventType = null) {
  const actor = eventType == null ? activeRepresentative(state) : ['governor_audit', 'veteran_petition'].includes(eventType) ? realmExecutive(state) : householdRepresentative(state);
  return { actor, family: controlledFamily(state), canRule: canRule(state), age: (person) => getCharacterAge(person, state.date), stress: (tag) => stressFor(actor, tag),
    ...(eventType == null ? { forEvent: (type) => storyContext(state, type) } : {}) };
}
function chainContext(state) {
  return { opinion: (from, to) => getPersonalOpinion(state, from, to),
    related: (a, b) => [state.relations[`${a}:${b}`], state.relations[`${b}:${a}`]].some((r) => r && (r.bonds.length || r.causes.length)),
    forScope: (scope) => { const actor = scope === 'public' ? realmExecutive(state) : householdRepresentative(state);
      return { actor, family: controlledFamily(state), canRule: canRule(state), stress: (tag) => stressFor(actor, tag) }; } };
}
function chainHooks(state) {
  return { emit: logEvent, memory: (type, title, participants, options) => memory(state, type, title, participants, options),
    opinion: (from, to, amount, label, cause) => opinionCause(state, from, to, amount, label, cause),
    spend: (amount, publicFunds, tag) => charge(state, amount, { publicFunds, orders: 0, tag }) };
}
// The context estimateAction reads (actionOdds.js). Orders follow spec 5.8: the household representative, a living adult of the controlled family, or an office holder while the representative can rule. The wallets are the accounts charge() debits.
function actionContext(state) {
  const representative = householdRepresentative(state), family = controlledFamily(state), ruling = canRule(state);
  const canOrder = (id) => {
    const person = Object.hasOwn(state.people, id) ? state.people[id] : null;
    if (!alive(person) || !adult(state, person)) return false;
    if (person.id === representative?.id || person.familyId === family?.id) return true;
    return ruling && values(state.offices).some((office) => office.kind !== 'ruler' && office.holderId === person.id);
  };
  const wallet = (kind) => kind === 'family' ? family?.treasury ?? 0 : kind === 'realm' && ruling ? state.realm.treasury : 0;
  // representativeId stays the household representative, who pays through charge(). activeRepresentativeId is the person the player acts through, who gives the orders: in realm mode the ruler or regent.
  // The crown's council advises only a player who rules.
  const advisor = ruling ? (entry) => advisorFor(state, entry.skill, actionHooks(state)) : null;
  return { representativeId: representative?.id || null, activeRepresentativeId: activeRepresentative(state)?.id || null, playerControlled: true, canOrder, wallet, advisor, opinion: (fromId, toId) => getPersonalOpinion(state, fromId, toId),
    situation: (entry, actor, target, means) => { const feast = feastRows(state, entry, actor, target, means, family?.id ?? null); return { ...feast, success: [...feast.success, ...dreadRows(entry, target)] }; } };
}
// npc_intent: an NPC acts on its own account. It orders only itself, pays from its own family's treasury and is never under the player's orders (no refusal draw). The difficulty row compares targets with the person the player acts through.
function npcActionContext(state, actorId) {
  const actor = Object.hasOwn(state.people, actorId) ? state.people[actorId] : null;
  const family = actor && Object.hasOwn(state.families, actor.familyId) ? state.families[actor.familyId] : null;
  return { ...actionContext(state), representativeId: activeRepresentative(state)?.id || null, playerControlled: false, advisor: null,
    canOrder: (id) => id === actorId, wallet: (kind) => kind === 'family' ? family?.treasury ?? 0 : 0,
    situation: (entry, person, target, means) => feastRows(state, entry, person, target, means) };
}
/** Odds for one contested action through the engine's own context, or a Swedish refusal. Pure: no randomness, no spending. The result carries the true values used for rolling; `display` is the only part to show the player. */
export function estimateCharacterAction(state, intent) { return estimateAction(state, intent, actionContext(state)); }
/** Odds for one conversation request through the engine's own hooks, or a Swedish refusal. Pure: no randomness, no spending. Like estimateCharacterAction, the result carries the true values for rolling and `display` for the player. */
export function estimateConversation(state, request) { return estimateConversationRequest(state, request, actionHooks(state)); }
/** What the model may know to speak as one person (conversation.js). Engine-side only: it holds the speaker's view of the representative and the secrets both share as labels, so it is not part of the presentation. */
export function getConversationBrief(state, personId) { return conversationBrief(state, personId, actionHooks(state)); }
/** Odds for one envoy to a foreign realm (envoys.js), or a Swedish refusal. Pure. */
export function estimateEnvoyRequest(state, request) { return estimateEnvoy(state, request, actionHooks(state)); }
/** What the model may know to speak as a foreign ruler (envoys.js). Engine-side only. */
export function getEnvoyBrief(state, realmId) { return envoyBrief(state, realmId); }
// Spouse, parent, child, sibling or the same family. Relatives by marriage count through the spouse bond only.
function kin(state, aId, bId) {
  const a = state.people[aId], b = state.people[bId];
  if (!a || !b || a.id === b.id) return false;
  const parents = (person) => [...person.legalParentIds, ...person.biologicalParentIds];
  return a.familyId === b.familyId || isMarried(a, b) || parents(a).includes(b.id) || parents(b).includes(a.id) || parents(a).some((id) => parents(b).includes(id));
}
function openStory(state, story) { const item = { ...story, id: nextId(state, 'story'), status: 'open' }; state.stories.push(item); return item; }
/** The hooks the action gate, the schemes and the plot step use. Exported so the rules modules can be tested against the engine's own helpers. */
export function actionHooks(state) {
  return { kill: (ids, events, reason) => killPeople(state, ids, events, reason), related: (aId, bId) => kin(state, aId, bId), ruler: () => ruler(state), openStory: (story) => openStory(state, story),
    closeKin: (a, b) => closeKin(state, a, b), addBond: (aId, bId, kind) => addBond(state, aId, bId, kind),
    memory: (type, title, participants, options) => memory(state, type, title, participants, options),
    opinionCause: (fromId, toId, amount, label, causeId, years) => opinionCause(state, fromId, toId, amount, label, causeId, years),
    logEvent: (events, type, title, description, participants, extra) => logEvent(state, events, type, title, description, participants, extra),
    charge: (amount, options) => charge(state, amount, options),
    vacate: (office, events, reason) => assignOffice(state, office, null, events, reason),
    imprison: (personId, story, events = []) => imprisonPerson(state, personId, ruler(state)?.familyId, events, actionHooks(state), { lawful: true }),
    activeRepresentative: () => activeRepresentative(state), householdRepresentative: () => householdRepresentative(state), controlledFamily: () => controlledFamily(state),
    getPersonalOpinion: (fromId, toId) => getPersonalOpinion(state, fromId, toId), opinionReasons: (fromId, toId) => opinionReasons(state, fromId, toId), canExerciseMandate: (person) => canExerciseMandate(person, state.date), adult: (person) => adult(state, person),
    estimateContext: () => actionContext(state), npcEstimateContext: (actorId) => npcActionContext(state, actorId), isCommandAction: (id) => COMMAND_TYPES.has(id),
    flatteryRevealed: (advisorId) => flatteryRevealed(state, advisorId, actionHooks(state)),
    crown: (person, events, reason, legitimacy, lawful) => crown(state, person, events, reason, legitimacy, lawful), assignOffice: (office, candidate, events, reason) => assignOffice(state, office, candidate, events, reason),
    familySupport: (family) => familySupport(state, family), rulerCandidates: () => rulerCandidates(state), canRule: () => canRule(state), militaryReadiness: () => getCharacterWorldEffects(state).militaryReadiness, appointReason: () => royalDecisionReason(state, 'appoint'), consumeAppointConsent: () => consumeRoyalConsent(state, 'appoint'), stressFor: (person, tag) => stressFor(person, tag), councilService: () => COUNCIL_SEATS.map((seat) => serviceOf(state, seat, actionHooks(state))), dreadOf: () => dreadOf(state, actionHooks(state)) };
}
function rawStoryChoices(state, story) { const controller = canRule(state); const actor = activeRepresentative(state); const family = controlledFamily(state); const cost = (n, pub) => (pub ? !controller ? 'Kräver härskarmandat.' : state.realm.treasury < n ? 'Otillräcklig statskassa.' : '' : !householdRepresentative(state) ? 'Familjen saknar en handlingsförmögen företrädare.' : (family?.treasury || 0) < n ? 'Otillräcklig familjekassa.' : '');
  if (story.type === 'character_event') return directedStoryChoices(state, story, storyContext(state));
  if (story.type === 'event_chain') return eventChainChoices(state, story, chainContext(state));
  if (story.type === 'health_care') return [{ id: 'physician', label: 'Anlita en läkekunnig', description: 'Omvårdnad underlättar återhämtningen och minskar risken för komplikationer. Ingen garanti mot ärr.', cost: '20 familjesilver', stress: String(stressFor(actor, 'generous')), disabledReason: cost(20, false) }, { id: 'rest', label: 'Ordna vila och avlastning', description: 'Lindra belastningen och ge tid för återhämtning.', cost: '5 familjesilver', stress: '0', disabledReason: cost(5, false) }, { id: 'watch', label: 'Avvakta tillståndets förlopp', description: 'Ingen ny vård ordnas. Tillståndet följer kalendern; ett senare beslut kan fortfarande fattas.', cost: '0 silver', stress: '0', disabledReason: '' }];
  if (story.type === 'office_promise') return controller ? [{ id: 'promise', label: 'Ge ett bindande löfte', description: 'Namar får stöd nu; ämbetskravet återkommer om tre år.', cost: '0 silver', stress: '0', disabledReason: '' }, { id: 'compensate', label: 'Betala för tjänsten', description: '30 silver ersätter ett framtida ämbete.', cost: '30 silver ur statskassan', stress: String(stressFor(actor, 'generous')), disabledReason: cost(30, true) }, { id: 'refuse', label: 'Avvisa kravet', description: 'Familjen minns förödmjukelsen och dess stöd sjunker.', cost: '0 silver', stress: String(stressFor(actor, 'cruel')), disabledReason: '' }] : [{ id: 'support', label: 'Stöd familjens krav', description: 'Bygg en politisk förbindelse och öka familjens inflytande.', cost: '10 silver', stress: '0', disabledReason: cost(10, false) }, { id: 'observe', label: 'Avvakta rådets beslut', description: 'Rikets ledning avgör frågan.', cost: '0 silver', stress: '0', disabledReason: '' }];
  if (story.type === 'promise_due' || story.type === 'legacy_claim') return controller ? [{ id: 'honor', label: 'Uppfyll löftet', description: 'En behörig medlem av familjen får det utlovade ämbetet.', cost: '10 silver', stress: '0', disabledReason: cost(10, true) || regencyVeto(state, 'appoint') || (!familyMembers(state, story.familyId).some((p) => adult(state, p)) ? 'Ingen behörig kandidat finns.' : '') }, { id: 'settle', label: 'Förhandla om ersättning', description: 'Betala 35 silver och avsluta kravet.', cost: '35 silver', stress: String(stressFor(actor, 'generous')), disabledReason: cost(35, true) }, { id: 'break', label: 'Bryt löftet', description: 'Familjen och berörda personer minns sveket. Det kan återkomma i nästa generation.', cost: '0 silver', stress: String(stressFor(actor, 'betrayal')), disabledReason: '' }] : [{ id: 'advocate', label: 'Driv familjens sak', description: 'Samla inflytande genom att påminna om löftet.', cost: '10 silver', stress: '0', disabledReason: cost(10, false) }, { id: 'observe', label: 'Låt rådet avgöra', description: 'Härskarens personlighet och stöd avgör svaret.', cost: '0 silver', stress: '0', disabledReason: '' }];
  if (story.type === 'stress_crisis') return [{ id: 'rest', label: 'Dra dig tillbaka för återhämtning', description: 'Minska stress med 40 och avstå årets återstående handlingar.', cost: '0 silver', stress: '−40', disabledReason: '' }, { id: 'support', label: 'Sök stöd i hushållet', description: 'Minska stress med 25 och förbättra en familjerelation.', cost: '15 silver', stress: '−25', disabledReason: cost(15, false) }, { id: 'endure', label: 'Fortsätt under belastning', description: 'Behåll handlingsutrymmet men förlora hälsa.', cost: '0 silver', stress: '+5', disabledReason: '' }];
  if (story.type === 'coup') return controller ? [{ id: 'negotiate', label: 'Förhandla om makten', description: 'En eftergift kostar 45 silver men kan förhindra en kupp.', cost: '45 silver', stress: String(stressFor(actor, 'surrender')), disabledReason: cost(45, true) }, { id: 'resist', label: 'Försvara ämbetet', description: 'Utgången beror på faktisk militär beredskap, familjestöd och legitimitet.', cost: '0 silver', stress: String(stressFor(actor, 'risky')), disabledReason: '' }, { id: 'yield', label: 'Överlåt tronen', description: 'Riksläget följer den nya ledaren. Familjeläget behåller familjen och dess egendom.', cost: '0 silver', stress: String(stressFor(actor, 'surrender')), disabledReason: '' }] : [{ id: 'back', label: 'Stöd utmanaren', description: 'Kosta på en allierad och stärk familjens nätverk.', cost: '20 silver', stress: '0', disabledReason: cost(20, false) }, { id: 'observe', label: 'Avvakta utgången', description: 'De inblandades makt avgör striden.', cost: '0 silver', stress: '0', disabledReason: '' }];
  if (story.type === 'discovery') return [{ id: 'expose', label: 'Avslöja planen', description: 'Planens mål får veta vem som agerat och reagerar på sanningen.', cost: '0 silver', stress: '0', disabledReason: '' }, { id: 'keep', label: 'Behåll kunskapen', description: 'Hemligheten förblir känd endast av de invigda.', cost: '0 silver', stress: '0', disabledReason: '' }];
  if (story.type === 'punish_crime') return punishCrimeChoices(state, story, { controller });
  if (story.type === 'ransom_offer') return ransomChoices(state, story, { controller });
  if (story.type === 'plot_uncovered') return plotUncoveredChoices(state, story, actionHooks(state));
  if (COURT_STORY_TYPES.includes(story.type)) return courtStoryChoices(state, story, actionHooks(state));
  return [{ id: 'acknowledge', label: 'Noterat', description: 'Följden läggs till i historiken.', cost: '0 silver', stress: '0', disabledReason: '' }];
}

const isOfficePromise = (story) => ['office_promise', 'promise_due', 'legacy_claim'].includes(story.type);
function promisedAppointment(state, story) {
  const office = state.offices[story.officeId];
  const eligible = familyMembers(state, story.familyId).filter((person) => adult(state, person) && !state.families[person.familyId].exiled && !isImprisoned(state, person.id));
  const candidate = eligible.find((person) => person.id === story.actorId) || byAge(state, eligible)[0];
  const reason = royalDecisionReason(state, 'appoint') || (!office || office.kind === 'ruler' ? 'Löftet saknar ett giltigt förvaltningsämbete.' : !candidate ? 'Familjen saknar en behörig kandidat till ämbetet.' : office.holderId === candidate.id ? 'Kandidaten innehar redan det utlovade ämbetet.' : '');
  return { office, candidate, reason };
}
function npcPromiseDecision(state, story) {
  const executive = realmExecutive(state);
  const unavailable = royalDecisionReason(state);
  if (unavailable) return { decision: null, reason: unavailable };
  if (story.type === 'office_promise') {
    const decision = has(executive, 'dutiful') || has(executive, 'compassionate') ? 'promise' : 'refuse';
    return { decision, reason: decision === 'promise' ? royalDecisionReason(state, 'appoint') : '' };
  }
  const decision = has(executive, 'dutiful') && state.realm.treasury >= 10 ? 'honor' : state.realm.treasury >= 35 && has(executive, 'compassionate') ? 'settle' : 'break';
  return { decision, reason: decision === 'honor' ? promisedAppointment(state, story).reason : '' };
}
function storyChoices(state, story) {
  const choices = rawStoryChoices(state, story);
  if (!isOfficePromise(story)) return choices;
  const npc = !canRule(state);
  const reason = npc ? npcPromiseDecision(state, story).reason : '';
  for (const choice of choices) {
    if (npc) {
      choice.disabledReason = reason || choice.disabledReason;
      if (choice.id === 'observe') choice.description = 'Den behöriga härskaren eller regenten avgör frågan enligt sitt mandat.';
    }
    if (choice.id === 'honor') choice.disabledReason ||= promisedAppointment(state, story).reason;
  }
  if (reason || choices.some((choice) => choice.id === 'honor' && choice.disabledReason)) choices.push({ id: 'defer', label: 'Skjut upp frågan', description: 'Behåll ärendet och ta upp det igen om ett år. Ingen kassa belastas.', cost: '0 silver', stress: '0', disabledReason: '' });
  return choices;
}

function resolveStory(state, story, choiceId, events, automatic = false) {
  if (story.status !== 'open') throw new Error('Frågan är redan avgjord.');
  if (story.type === 'event_chain') { resolveEventChain(state, story, choiceId, events, chainContext(state), chainHooks(state)); return; }
  const choices = storyChoices(state, story); const choice = choices.find((c) => c.id === choiceId); if (!choice || choice.disabledReason) throw new Error(choice?.disabledReason || 'Valet är inte giltigt.');
  const actor = story.type === 'character_event' ? storyContext(state, story.eventType).actor : story.type === 'health_care' ? householdRepresentative(state) : activeRepresentative(state); const leader = isOfficePromise(story) ? realmExecutive(state) : ruler(state); const fam = state.families[story.familyId];
  if (isOfficePromise(story) && choiceId === 'defer') {
    story.status = 'waiting'; story.dueAt = addGameMonths(state.date, 12);
    logEvent(state, events, 'story_deferred', story.title, choice.description, [story.actorId, actor?.id]);
    return;
  }
  const spend = (n, pub, tag = 'duty') => { if (automatic) { const payingActor = pub ? realmExecutive(state) : householdRepresentative(state); if (!canExerciseMandate(payingActor, state.date)) throw new Error('Beslutet saknar en handlingsförmögen företrädare.'); const wallet = pub ? state.realm : controlledFamily(state); if (wallet.treasury < n) throw new Error('Otillräckliga medel.'); wallet.treasury -= n; return payingActor; } return charge(state, n, { publicFunds: pub, orders: 0, tag }); };
  if (story.type === 'character_event') {
    resolveDirectedStory(state, story, choiceId, storyContext(state), { spend,
      memory: (type, title, participants, options) => memory(state, type, title, participants, options),
      opinion: (from, to, amount, label, cause) => opinionCause(state, from, to, amount, label, cause) });
  } else if (story.type === 'health_care') {
    const patient = requirePerson(state, story.actorId); requireOwn(state, patient);
    if (choiceId !== 'watch') { const carer = spend(choiceId === 'physician' ? 20 : 5, false, choiceId === 'physician' ? 'generous' : 'duty'); treatCondition(state, patient, story.conditionId, choiceId, carer.id, events); }
  } else if (story.type === 'office_promise') {
    const promiseSource = { ...story }; delete promiseSource.reopenedAt;
    if (choiceId === 'promise') { fam.grievance = clamp(fam.grievance + 10, -40, 40); const m = memory(state, 'promise', 'Löfte om guvernörsämbete', [leader?.id, story.actorId], { familyIds: [fam.id], officeId: story.officeId }); state.stories.push({ ...promiseSource, id: nextId(state, 'story'), type: 'promise_due', title: 'Ett ämbete har utlovats', description: 'Familjen väntar på att det bindande löftet ska infrias.', createdAt: state.date, dueAt: addGameMonths(state.date, 36), status: 'waiting', causeId: m.id }); opinionCause(state, story.actorId, leader?.id, 15, 'Ett bindande löfte', m.id); }
    if (choiceId === 'compensate') { spend(30, true, 'generous'); fam.treasury += 30; fam.grievance = clamp(fam.grievance + 8, -40, 40); }
    if (choiceId === 'refuse') { spend(0, true, 'cruel'); fam.grievance = clamp(fam.grievance - 10, -40, 40); const m = memory(state, 'insult', 'Kravet avvisades offentligt', [story.actorId, leader?.id]); opinionCause(state, story.actorId, leader?.id, -20, 'Avvisat krav', m.id); }
    if (choiceId === 'support') { spend(10, false); controlledFamily(state).influence += 6; fam.grievance += 3; }
    if (choiceId === 'observe' || choiceId === 'support') { const promise = npcPromiseDecision(state, story).decision === 'promise'; if (promise) { const m = memory(state, 'promise', 'Rikets företrädare lovade ett ämbete', [leader.id, story.actorId], { familyIds: [fam.id], officeId: story.officeId }); state.stories.push({ ...promiseSource, id: nextId(state, 'story'), type: 'promise_due', title: 'Löftet ska infrias', createdAt: state.date, dueAt: addGameMonths(state.date, 36), status: 'waiting', causeId: m.id }); } else fam.grievance -= 8; }
  } else if (story.type === 'promise_due' || story.type === 'legacy_claim') {
    let decision = choiceId;
    if (choiceId === 'observe' || choiceId === 'advocate') { decision = npcPromiseDecision(state, story).decision; if (choiceId === 'advocate') { spend(10, false); controlledFamily(state).influence += 8; } }
    if (decision === 'honor') { const { office, candidate, reason } = promisedAppointment(state, story); if (reason) throw new Error(reason); if (choiceId === decision) spend(10, true); else state.realm.treasury -= 10; assignOffice(state, office, candidate, events, 'Ett tidigare löfte uppfylls'); consumeRoyalConsent(state, 'appoint'); fam.grievance = clamp(fam.grievance + 15, -40, 40); memory(state, 'promise_kept', 'Familjens löfte uppfylldes', [leader?.id, candidate?.id], { causeId: story.causeId, familyIds: [fam.id] }); }
    if (decision === 'settle') { if (choiceId === decision) spend(35, true, 'generous'); else state.realm.treasury -= 35; fam.treasury += 35; fam.grievance = clamp(fam.grievance + 7, -40, 40); memory(state, 'settlement', 'Löftet omförhandlades', [leader?.id, fam.headId], { causeId: story.causeId, familyIds: [fam.id] }); }
    if (decision === 'break') { if (choiceId === decision) spend(0, true, 'betrayal'); fam.grievance = clamp(fam.grievance - 22, -40, 40); const m = memory(state, 'betrayal', 'Ett bindande löfte bröts', [leader?.id, story.actorId], { causeId: story.causeId, familyIds: [fam.id] }); for (const p of familyMembers(state, fam.id).filter((p) => adult(state, p))) opinionCause(state, p.id, leader?.id, -30, 'Brutet familjelöfte', m.id, 12); if (story.type !== 'legacy_claim') state.stories.push({ id: nextId(state, 'story'), type: 'legacy_claim', title: 'Nästa generation kräver upprättelse', description: 'Familjen återkommer till det brutna löftet. Rätten och minnet överlevde de ursprungliga deltagarna.', familyId: fam.id, actorId: fam.headId, targetId: leader?.id, officeId: story.officeId, createdAt: state.date, dueAt: addGameMonths(state.date, 144), status: 'waiting', causeId: m.id, knownBy: 'public' }); }
  } else if (story.type === 'stress_crisis') { const person = state.people[story.actorId]; if (alive(person)) { if (choiceId === 'rest') { person.stress = Math.max(0, person.stress - 40); state.actionPoints = 0; } if (choiceId === 'support') { spend(15, false); person.stress = Math.max(0, person.stress - 25); } if (choiceId === 'endure') { person.health = Math.max(1, person.health - 12); person.stress = clamp(person.stress + 5, 0, 200); } } }
  else if (story.type === 'coup') { const challenger = alive(state.people[story.actorId]) ? state.people[story.actorId] : state.people[fam?.headId]; if (alive(challenger)) { if (choiceId === 'negotiate') { spend(45, true, 'surrender'); state.families[challenger.familyId].treasury += 45; state.families[challenger.familyId].grievance += 18; } else { if (choiceId === 'back') { spend(20, false); controlledFamily(state).influence += 10; } if (choiceId === 'yield') spend(0, true, 'surrender'); if (choiceId === 'resist') spend(0, true, 'risky'); const defense = getCharacterWorldEffects(state).militaryReadiness + state.realm.legitimacy * 0.4; const attack = state.families[challenger.familyId].influence + challenger.skills.command * 3 + (choiceId === 'back' ? 15 : 0); if (choiceId === 'yield' || attack > defense) crown(state, challenger, events, 'En maktkamp förändrar rikets ledning', 35, false); else { state.families[challenger.familyId].influence = Math.max(10, state.families[challenger.familyId].influence - 20); challenger.stress = clamp(challenger.stress + 20, 0, 200); logEvent(state, events, 'coup_defeated', 'Maktövertagandet avvärjs', `${challenger.name} saknade tillräckligt stöd och militär styrka.`, [challenger.id, leader?.id]); } } } }
  else if (story.type === 'discovery' && choiceId === 'expose') { const hidden = state.memories.find((m) => m.id === story.causeId); if (hidden) { hidden.knownBy = 'public'; const plot = plotSecretFor(state, hidden.id); if (plot) exposeSecret(state, plot.id); opinionCause(state, hidden.participants[1], hidden.participants[0], -25, 'Avslöjad plan', hidden.id); memory(state, 'discovery', 'En hemlig plan avslöjades', hidden.participants, { causeId: hidden.id }); } }
  else if (story.type === 'punish_crime') resolvePunishment(state, story, choiceId, actionHooks(state), events);
  else if (story.type === 'ransom_offer') resolveRansom(state, story, choiceId, actionHooks(state), events);
  else if (story.type === 'plot_uncovered') resolvePlotUncovered(state, story, choiceId, actionHooks(state), events);
  else if (COURT_STORY_TYPES.includes(story.type)) resolveCourtStory(state, story, choiceId, events, actionHooks(state));
  story.status = 'resolved'; story.choiceId = choiceId; story.resolvedAt = state.date;
  logEvent(state, events, 'choice', story.title, `${choice.label}. ${choice.description}`, [story.actorId, actor?.id]);
}

function handleGovernanceCommand(state, command, events) {
  const p = command.payload || {};
  const actor = commandActor(state, command.type);
  const family = controlledFamily(state);
  if (command.type === 'seek_refuge') {
    if (state.realm.alive || !family?.exiled) throw new Error('Extern fristad söks efter rikets faktiska upplösning.');
    const host = state.externalHosts.find((candidate) => candidate.id === p.polityId);
    if (!host) throw new Error('Mottagaren finns inte bland världens giltiga riken.');
    if (family.hostPolityId === host.id) throw new Error('Familjen har redan accepterat skydd där.');
    const key = 'refuge:' + host.id;
    if (family.cooldowns[key] && compareGameDates(family.cooldowns[key], state.date) > 0) throw new Error('Mottagaren omprövar förslaget först om ett år.');
    charge(state, host.admissionCost, { tag: 'surrender' });
    const score = family.influence + actor.skills.diplomacy * 3 + host.opinion * 0.5;
    const accepted = score >= host.refugeThreshold;
    family.cooldowns[key] = addGameMonths(state.date, 12);
    if (accepted) { family.hostPolityId = host.id; family.hostPolityName = host.name; family.hostFamilyId = null; family.refugeAcceptedAt = state.date; }
    else family.influence = clamp(family.influence + 3);
    const event = logEvent(state, events, accepted ? 'refuge_accepted' : 'refuge_refused', accepted ? 'Ett rike tar emot familjen' : 'Förslaget om fristad avslås', `${host.name}: mottagningsstöd ${Math.round(score)}, krav ${host.refugeThreshold}. ${accepted ? 'Skyddet ger en tryggare hemvist men inga offentliga ämbeten.' : 'Familjen kan stärka sitt inflytande, välja en annan faktisk mottagare eller förhandla igen om ett år.'}`, [actor.id]);
    memory(state, event.type, event.title, event.participants, { causeId: event.id, familyIds: [family.id], hostPolityId: host.id });
    return true;
  }
  if (command.type === 'recognize_claim') {
    requireRule(state);
    const claimant = state.people[state.realm.lawfulRulerId];
    if (!alive(claimant) || claimant.id === state.offices.ruler.holderId) throw new Error('Det finns inget åsidosatt rättsligt anspråk att erkänna.');
    charge(state, 0, { publicFunds: true, tag: 'surrender' });
    crown(state, claimant, events, 'Den faktiska härskaren erkänner den bestående rättsliga tronföljden', 65, true);
    return true;
  }
  if (!['request_regent_consent', 'resolve_regency'].includes(command.type)) return false;
  const record = relevantRegencies(state).find((candidate) => candidate.id === p.regencyId);
  if (!record) throw new Error('Välj en pågående förmyndarregering som berör din företrädare.');
  const regent = requirePerson(state, record.regentId, { grown: true });
  const principal = requirePerson(state, record.principalId);
  if (command.type === 'request_regent_consent') {
    if (!['minority', 'incapacity'].includes(record.phase)) throw new Error('En omstridd mandatöverlämning måste lösas först.');
    if (!regencyVetoForRecord(state, record, p.actionType)) throw new Error('Regentens samtycke behövs inte för detta beslut.');
    if (!['negotiate', 'compensate', 'appeal'].includes(p.approach)) throw new Error('Välj förhandling, ersättning eller rådets prövning.');
    if (record.requestAfter[p.actionType] && compareGameDates(record.requestAfter[p.actionType], state.date) > 0) throw new Error('En ny samtyckesförhandling om samma beslut kan föras om ett år.');
    if (p.approach === 'appeal' && family.influence < 15) throw new Error('Rådets prövning kostar 15 inflytande.');
    const cost = p.approach === 'compensate' ? 30 : p.approach === 'negotiate' ? 10 : 0;
    const support = family.influence + principal.skills.diplomacy * 3;
    const cooperation = regent.loyalty + getPersonalOpinion(state, regent.id, principal.id) * 0.5 - (has(regent, 'ambitious') ? 15 : 0);
    const accepted = p.approach === 'appeal' ? support >= 65 : cooperation + (p.approach === 'compensate' ? 35 : 0) >= 60;
    charge(state, cost, { tag: p.approach === 'compensate' ? 'generous' : 'duty' });
    if (p.approach === 'appeal') family.influence -= 15;
    if (p.approach === 'compensate') regent.wealth += cost;
    record.requestAfter[p.actionType] = addGameMonths(state.date, 12);
    if (accepted) record.grants.push(attachMandateGrant(record, { actionType: p.actionType, grantedAt: state.date, expiresAt: addGameMonths(state.date, 12), usedAt: null, approach: p.approach }));
    const event = logEvent(state, events, accepted ? 'regent_consent' : 'regent_veto', accepted ? 'Regentens veto hävs för ett beslut' : 'Regenten står fast vid sitt veto', `${regent.name}: rådsstöd ${Math.round(support)}. ${accepted ? 'Tillståndet gäller en lyckad handling inom ett år.' : 'Förhandlingen kostar resurser men ökar den personliga tilliten. Försök igen om ett år eller välj en annan politik.'}`, [principal.id, regent.id]);
    opinionCause(state, regent.id, principal.id, accepted ? 5 : 10, 'Förhandling om förmyndarmandat', event.id, 5);
    memory(state, event.type, event.title, event.participants, { causeId: event.id });
    return true;
  }
  if (record.phase !== 'contested' || !adult(state, principal)) throw new Error('Det finns ingen bestridd myndighetsöverlämning att lösa.');
  if (!['pension', 'council', 'confront'].includes(p.approach)) throw new Error('Välj pension, rådets mandat eller maktprövning.');
  if (p.approach === 'council' && family.influence < 20) throw new Error('Rådets mandat kostar 20 inflytande.');
  const support = family.influence + principal.skills.diplomacy * 3 + (p.approach === 'confront' ? principal.skills.command * 3 : 0);
  const resistance = (state.families[regent.familyId]?.influence || 0) * 0.6 + (100 - regent.loyalty) * 0.5 + (has(regent, 'ambitious') ? 15 : 0);
  const accepted = p.approach === 'pension' || support >= resistance + (p.approach === 'confront' ? 8 : 0);
  const cost = p.approach === 'pension' ? 40 : p.approach === 'confront' ? 25 : 0;
  charge(state, cost, { tag: p.approach === 'confront' ? 'risky' : 'surrender' });
  if (p.approach === 'council') family.influence -= 20;
  if (p.approach === 'pension') regent.wealth += cost;
  if (accepted) { record.phase = 'ended'; record.endedAt = state.date; record.resolution = p.approach; }
  else { principal.stress = clamp(principal.stress + 15, 0, 200); family.influence = Math.max(0, family.influence - 5); }
  const event = logEvent(state, events, accepted ? 'regency_resolved' : 'regency_resisted', accepted ? 'Mandatet lämnas över' : 'Regenten håller kvar mandatet', `${principal.name}: stöd ${Math.round(support)}. ${accepted ? 'Företrädaren övertar detta mandats rättigheter.' : 'Bygg mer stöd, skaffa en pension eller försök en annan väg. Familjens ägande består.'}`, [principal.id, regent.id]);
  opinionCause(state, regent.id, principal.id, p.approach === 'pension' ? 10 : -15, 'Uppgörelse om regentskapet', event.id, 10);
  memory(state, event.type, event.title, event.participants, { causeId: event.id });
  return true;
}

// Engine-only commands: the model proposes them and prepareCharacterTimeline, the only caller that sets origin 'gate', runs them. A player command of these types is refused.
const GATE_COMMANDS = new Set(['realm_effect', 'npc_intent']);
// record_action_narrative is written only by the narrate step (recordCharacterNarrative, the only caller that sets origin 'narrate'); a player, gate or unmarked command is refused.
const NARRATE_ONLY = 'Berättelsen kan bara skrivas av berättarsteget.';
// converse_request is sent only by submitConversationRequest in characterRuntime.js, the only caller that sets origin 'converse'; a player, gate or unmarked command is refused.
const CONVERSE_ONLY = 'Samtalsförfrågningar kan bara göras i samtalssteget.';
const GATE_ONLY = 'Rikets läge och andra familjers handlingar ändras bara när motorn prövar modellens förslag.';
// Per-command envelopes of realm_effect. armyStrength moves state.realm.armyStrength, the base the military readiness projection reads.
const REALM_EFFECT_ENVELOPE = Object.freeze({ treasury: [-80, 40], legitimacy: [-10, 5], armyStrength: [-15, 10] });
const REALM_EFFECT_LABELS = Object.freeze({ treasury: 'statskassan', legitimacy: 'legitimiteten', armyStrength: 'arméns styrka' });
const REALM_EFFECT_REASON_MAX = 200;
const signed = (value) => `${value > 0 ? '+' : '−'}${Math.abs(value)}`;
function applyRealmEffect(state, p, events) {
  if (!state.realm.alive) throw new Error('Riket finns inte längre och kan inte förändras.');
  const deltas = {};
  for (const [key, [min, max]] of Object.entries(REALM_EFFECT_ENVELOPE)) {
    if (p[key] === undefined) continue;
    if (!Number.isInteger(p[key]) || p[key] < min || p[key] > max) throw new Error(`Förändringen av ${REALM_EFFECT_LABELS[key]} måste vara ett heltal från ${signed(min)} till ${signed(max)}.`);
    if (p[key] !== 0) deltas[key] = p[key];
  }
  if (!Object.keys(deltas).length) throw new Error('Förslaget ändrar inget i riket.');
  const reason = typeof p.reason === 'string' ? p.reason.trim() : '';
  if (!reason || reason.length > REALM_EFFECT_REASON_MAX) throw new Error(`Förslaget behöver ett skäl på 1 till ${REALM_EFFECT_REASON_MAX} tecken.`);
  // Each field stops at its existing bound: the treasury at 0, legitimacy and army strength at 0 and 100.
  if (deltas.treasury) state.realm.treasury = rounded(Math.max(0, state.realm.treasury + deltas.treasury));
  if (deltas.legitimacy) state.realm.legitimacy = clamp(state.realm.legitimacy + deltas.legitimacy);
  if (deltas.armyStrength) state.realm.armyStrength = clamp(state.realm.armyStrength + deltas.armyStrength);
  const summary = Object.entries(deltas).map(([key, value]) => `${REALM_EFFECT_LABELS[key]} ${signed(value)}`).join(', ');
  logEvent(state, events, 'realm_effect', 'Rikets läge förändras', `${reason} Förändring: ${summary}.`, []);
}
// The actor of an npc_intent: a living adult who is neither the player's representative nor a member of the controlled family. Targets are free: NPCs may act against the player's people.
function runNpcIntent(state, command, events) {
  const p = command.payload || {};
  const actor = typeof p.actorId === 'string' && Object.hasOwn(state.people, p.actorId) ? state.people[p.actorId] : null;
  if (!alive(actor) || !adult(state, actor)) throw new Error('Den föreslagna aktören måste vara en levande vuxen.');
  if ([householdRepresentative(state)?.id, activeRepresentative(state)?.id].includes(actor.id) || actor.familyId === controlledFamily(state)?.id) throw new Error('Modellen får inte handla för spelarens egna personer.');
  const intent = { actionId: p.actionId, actorId: actor.id, targetIds: p.targetIds };
  resolveAttempt(state, { id: command.id, payload: intent }, events, { ...actionHooks(state), estimateContext: () => npcActionContext(state, actor.id) });
}

function handleCommand(state, command, events) {
  if (GATE_COMMANDS.has(command.type)) {
    if (command.origin !== 'gate') throw new Error(GATE_ONLY);
    if (command.type === 'realm_effect') applyRealmEffect(state, command.payload || {}, events); else runNpcIntent(state, command, events);
    refreshMandates(state, events); refreshStories(state, events); updateStatus(state); return;
  }
  const p = command.payload || {}; const type = command.type; const veto = regencyVeto(state, type); if (veto) throw new Error(veto); const actor = commandActor(state, type); const ownFamily = controlledFamily(state);
  if (handleGovernanceCommand(state, command, events)) { refreshMandates(state, events); refreshStories(state, events); updateStatus(state); return; }
  if (type === 'resolve_story') { const story = state.stories.find((s) => s.id === p.storyId && visibleTo(state, s)); if (!story || (story.status !== 'open')) throw new Error('Berättelsen är inte tillgänglig.'); resolveStory(state, story, p.choiceId, events); refreshMandates(state, events); refreshStories(state, events); updateStatus(state); return; }
  // A narrative records an outcome the engine already decided, so it needs no mandate of its own.
  if (type === 'record_action_narrative') { if (command.origin !== 'narrate') throw new Error(NARRATE_ONLY); recordNarrative(state, p, actionHooks(state), events); refreshMandates(state, events); refreshStories(state, events); updateStatus(state); return; }
  // A conversation is held by the active representative, who is checked by the conversation rules themselves.
  if (type === 'converse_request') { if (command.origin !== 'converse') throw new Error(CONVERSE_ONLY); converse(state, p, events, actionHooks(state)); refreshMandates(state, events); refreshStories(state, events); updateStatus(state); return; }
  // An envoy carries words the model read from the player's text (envoys spec), so it comes only through the conversation step.
  if (type === 'envoy_request') { if (command.origin !== 'converse') throw new Error(CONVERSE_ONLY); requireRule(state); sendEnvoy(state, p, actor, events, actionHooks(state)); refreshMandates(state, events); refreshStories(state, events); updateStatus(state); return; }
  if (!canExerciseMandate(actor, state.date)) throw new Error('Beslutet saknar en handlingsförmögen företrädare. Kalendern kan fortsätta.');
  if (type === 'provide_care') { const patient = requirePerson(state, p.personId); requireOwn(state, patient); if (!['physician', 'rest'].includes(p.care)) throw new Error('Välj vila eller en läkekunnig.'); if (!getTreatableConditions(patient).some((condition) => condition.id === p.conditionId)) throw new Error('Välj ett obehandlat pågående tillstånd.'); charge(state, p.care === 'physician' ? 20 : 5, { tag: p.care === 'physician' ? 'generous' : 'duty' }); treatCondition(state, patient, p.conditionId, p.care, actor.id, events); }
  else if (type === 'rest') { charge(state, 10, { orders: 1, tag: 'duty' }); actor.stress = Math.max(0, actor.stress - 30); actor.health = clamp(actor.health + 5); logEvent(state, events, 'rest', 'Tid för återhämtning', `${actor.name} återhämtar sig. Stress −30, hälsa +5.`, [actor.id]); }
  else if (type === 'gift') { const target = requirePerson(state, p.targetId, { grown: true }); if (target.id === actor.id) throw new Error('Välj en annan person.'); const cooldown = actor.cooldowns[`gift:${target.id}`]; if (cooldown && compareGameDates(cooldown, state.date) > 0) throw new Error('En ny gåva uppskattas först om ett år.'); charge(state, 15, { tag: 'generous' }); target.wealth += 15; const m = memory(state, 'gift', 'En personlig gåva', [actor.id, target.id]); opinionCause(state, target.id, actor.id, 15, 'En uppskattad gåva', m.id, 6); actor.cooldowns[`gift:${target.id}`] = addGameMonths(state.date, 12); logEvent(state, events, 'gift', 'En relation stärks', `${target.name} uppskattar gåvan från ${actor.name}.`, [actor.id, target.id]); }
  else if (type === 'appoint' || type === 'dismiss') { requireRule(state); const office = state.offices[p.officeId]; if (!office || office.kind === 'ruler') throw new Error('Välj ett förvaltningsämbete.'); const candidate = type === 'appoint' ? requirePerson(state, p.personId, { grown: true }) : null; if (candidate && isImprisoned(state, candidate.id)) throw new Error(IMPRISONED); if (candidate?.id === office.holderId || (!candidate && !office.holderId)) throw new Error('Ämbetet har redan den ställningen.'); if (candidate && state.families[candidate.familyId].exiled) throw new Error('Personens familj måste återvända från exil först.'); charge(state, type === 'appoint' ? 15 : 5, { publicFunds: true, tag: type === 'dismiss' ? 'cruel' : 'duty' }); assignOffice(state, office, candidate, events); if (candidate) seatReaction(state, state.families[candidate.familyId], events, actionHooks(state)); }
  else if (type === 'exercise_office') {
    const office = state.offices[p.officeId];
    if (!office || office.kind === 'ruler' || office.holderId !== actor.id) throw new Error('Du kan bara utöva ett ämbete som din aktiva företrädare innehar.');
    if (!['service', 'patronage'].includes(p.policy)) throw new Error('Välj hur ämbetets resurser ska användas.');
    if (office.publicBudget < 10) throw new Error('Ämbetets budget behöver fyllas på genom förvaltning över tid.');
    const key = 'office:' + office.id;
    if (actor.cooldowns[key] && compareGameDates(actor.cooldowns[key], state.date) > 0) throw new Error('Ett större ämbetsinitiativ per år är möjligt.');
    charge(state, 0, { publicFunds: canRule(state), tag: p.policy === 'patronage' ? 'betrayal' : 'duty' });
    office.publicBudget -= 10;
    actor.cooldowns[key] = addGameMonths(state.date, 12);
    if (p.policy === 'service') {
      if (office.kind === 'governor') { const city = state.cities[office.cityId]; city.unrest = Math.max(0, city.unrest - 8); city.infrastructure = rounded(city.infrastructure + 0.25); }
      if (office.kind === 'general') state.realm.armyStrength = clamp(state.realm.armyStrength + 8);
      if (office.kind === 'chancellor') state.realm.legitimacy = clamp(state.realm.legitimacy + 4);
      if (office.kind === 'priest') state.religions[actor.religionId].support = clamp(state.religions[actor.religionId].support + 8);
      actor.loyalty = clamp(actor.loyalty + 3);
      logEvent(state, events, 'office_service', 'Ämbetet omsätter resurser i arbete', actor.name + ' använder sitt mandat som ' + office.name.toLowerCase() + '. Förvaltningen eller rikets beredskap förbättras.', [actor.id]);
    } else {
      ownFamily.influence = clamp(ownFamily.influence + 8); ownFamily.treasury += 8; actor.loyalty = Math.max(0, actor.loyalty - 3); state.realm.legitimacy = Math.max(0, state.realm.legitimacy - 3);
      if (office.cityId) state.cities[office.cityId].unrest = clamp(state.cities[office.cityId].unrest + 6);
      const m = memory(state, 'patronage', 'Familjens klienter gynnas av ett ämbete', [actor.id, ruler(state)?.id]);
      opinionCause(state, ruler(state)?.id, actor.id, -8, 'Ämbetsresurser till familjens klienter', m.id, 8);
      logEvent(state, events, 'office_patronage', 'Ämbetet stärker familjens nätverk', 'Inflytande och familjekassa ökar, men legitimitet och förtroende minskar.', [actor.id]);
    }
  }
  else if (type === 'educate') { const child = requirePerson(state, p.childId); requireOwn(state, child); if (adult(state, child)) throw new Error('Utbildningsvalet gäller barn.'); const mentor = requirePerson(state, p.mentorId, { grown: true }); if (!Object.hasOwn(SKILL_LABELS, p.focus)) throw new Error('Välj ett utbildningsområde.'); charge(state, 15); child.mentorId = mentor.id; child.education = p.focus; addBond(state, child.id, mentor.id, 'mentor'); memory(state, 'education', `${child.name} får en mentor`, [child.id, mentor.id]); logEvent(state, events, 'education', 'Nästa generation formas', `${mentor.name} undervisar ${child.name} i ${SKILL_LABELS[p.focus].toLowerCase()}.${tutorProspect(child, mentor)}`, [child.id, mentor.id]); }
  else if (type === 'marry') { const person = requirePerson(state, p.personId, { grown: true }); const partner = requirePerson(state, p.partnerId, { grown: true }); requireOwn(state, person); if (person.id === partner.id || hasLivingSpouse(state, person) || hasLivingSpouse(state, partner)) throw new Error('Båda personerna måste vara fria att ingå äktenskap.'); if (closeKin(state, person, partner)) throw new Error('Nära släktingar kan inte gifta sig enligt kampanjens lag.'); if (getPersonalOpinion(state, partner.id, actor.id) < -20 || (has(partner, 'ambitious') && ownFamily.influence < 25)) throw new Error('Den föreslagna partnern avböjer förbindelsen.'); charge(state, 20); person.spouseId = partner.id; partner.spouseId = person.id; addBond(state, person.id, partner.id, 'partner'); const m = memory(state, 'marriage', 'Ett nytt äktenskap', [person.id, partner.id]); opinionCause(state, person.id, partner.id, 20, 'Äktenskap', m.id, 0); opinionCause(state, partner.id, person.id, 20, 'Äktenskap', m.id, 0); ownFamily.influence = clamp(ownFamily.influence + 5); logEvent(state, events, 'marriage', 'Två liv knyts samman', `${person.name} och ${partner.name} ingår äktenskap.`, [person.id, partner.id]); }
  else if (type === 'adopt') { const child = requirePerson(state, p.childId); if (adult(state, child) || child.id === actor.id || child.legalParentIds.includes(actor.id)) throw new Error('Välj ett barn som inte redan är ditt juridiska barn.'); const guardian = state.people[state.families[child.familyId].headId]; if (child.familyId !== ownFamily.id && getPersonalOpinion(state, guardian?.id, actor.id) < 10) throw new Error('Barnets familj samtycker inte till adoptionen. Bygg en relation först.'); charge(state, 25); child.legalParentIds = [...new Set([...child.legalParentIds, actor.id])]; child.familyId = ownFamily.id; state.adoptions.push({ adopterId: actor.id, childId: child.id, date: state.date }); memory(state, 'adoption', 'En juridisk familjebindning', [actor.id, child.id]); logEvent(state, events, 'adoption', 'Familjen får en erkänd arvinge', `${child.name} adopteras av ${actor.name}. Biologiskt släktskap ändras inte.`, [actor.id, child.id]); }
  else if (type === 'build_estate') { if (ownFamily.exiled && !ownFamily.hostFamilyId && !ownFamily.hostPolityId) throw new Error('Hushållet behöver en beskyddare före investering i jord.'); charge(state, 45); state.projects.push({ id: nextId(state, 'project'), kind: 'estate', title: 'Utbyggd familjeegendom', ownerId: actor.id, familyId: ownFamily.id, createdAt: state.date, dueAt: addGameMonths(state.date, 24), personal: false, status: 'active' }); logEvent(state, events, 'project', 'Familjen investerar', 'En ny egendom ger inkomster om två år och består över generationsskiften.', [actor.id]); }
  else if (type === 'seek_office') { if (!state.realm.alive) throw new Error('Det tidigare rikets ämbeten har upphört.'); const office = state.offices[p.officeId]; if (!office || office.kind === 'ruler') throw new Error('Välj ett förvaltningsämbete.'); if (office.holderId === actor.id) throw new Error('Du innehar redan ämbetet.'); if (ownFamily.exiled) throw new Error('Familjen måste återvända från exil först.'); const previous = ownFamily.cooldowns[`petition:${office.id}`]; if (previous && compareGameDates(previous, state.date) > 0) throw new Error('Rådet behandlar en ansökan per år.'); charge(state, 15); ownFamily.cooldowns[`petition:${office.id}`] = addGameMonths(state.date, 12); const score = ownFamily.influence + getPersonalOpinion(state, ruler(state)?.id, actor.id) * 0.5 + actor.skills.diplomacy * 3; if (score >= (office.holderId ? 90 : 60)) assignOffice(state, office, actor, events, 'Rådet godkänner familjens ansökan'); else { ownFamily.influence = clamp(ownFamily.influence + 8); logEvent(state, events, 'petition', 'Ansökan når rådet', `Stöd ${Math.round(score)} av ${office.holderId ? 90 : 60}. Familjens inflytande ökar med 8 inför nästa ansökan.`, [actor.id, ruler(state)?.id]); } }
  else if (type === 'build_support') { const target = state.families[p.familyId]; if (!target || target.id === ownFamily.id) throw new Error('Välj en annan familj.'); const key = `support:${target.id}`; if (ownFamily.cooldowns[key] && compareGameDates(ownFamily.cooldowns[key], state.date) > 0) throw new Error('Denna familj behöver tid innan nästa förhandling.'); charge(state, 15, { tag: 'generous' }); ownFamily.influence = clamp(ownFamily.influence + 12); target.treasury += 10; const m = memory(state, 'patronage', 'Ömsesidigt politiskt stöd', [actor.id, target.headId]); opinionCause(state, target.headId, actor.id, 12, 'Patronage', m.id, 8); ownFamily.cooldowns[key] = addGameMonths(state.date, 12); logEvent(state, events, 'alliance', 'Familjens nätverk växer', `${target.name} förhandlar med ${ownFamily.name}. Inflytande +12.`, [actor.id, target.headId]); }
  else if (type === 'press_claim') { if (!state.realm.alive) throw new Error('Det tidigare riket finns inte längre. Ett anspråk återskapar ingen stat.'); if (canRule(state) || actor.id === state.offices.ruler.holderId) throw new Error('Du utövar redan härskarmakten.'); const claimant = familyRoyalClaim(state, ownFamily.id) || actor; const requiredInfluence = claimant.id === state.realm.lawfulRulerId ? 45 : 60; if (ownFamily.influence < requiredInfluence) throw new Error('Minst ' + requiredInfluence + ' inflytande krävs för detta anspråk.'); if (state.stories.some((s) => s.type === 'coup' && s.status === 'open')) throw new Error('En maktkamp pågår redan.'); charge(state, 40, { tag: 'risky' }); const defense = getCharacterWorldEffects(state).militaryReadiness + state.realm.legitimacy * 0.35; const attack = ownFamily.influence + claimant.skills.command * 3 + claimant.skills.diplomacy + (claimant.id === state.realm.lawfulRulerId ? 20 : 0); if (attack > defense) crown(state, claimant, events, 'Familjens anspråk stöds av rådet och armén', claimant.id === state.realm.lawfulRulerId ? 65 : 45, claimant.id === state.realm.lawfulRulerId); else { ownFamily.influence = Math.max(15, ownFamily.influence - 15); actor.stress = clamp(actor.stress + 15, 0, 200); logEvent(state, events, 'claim_failed', 'Anspråket saknar tillräcklig makt', `Stöd ${Math.round(attack)}, motstånd ${Math.round(defense)}. Familjens egendom består.`, [actor.id, ruler(state)?.id]); } }
  else if (type === 'abdicate') { requireRule(state); if (state.offices.ruler.regentId) throw new Error('En regent kan inte avsäga sig barnets tron.'); const successor = rulerCandidates(state)[0]; if (!successor) throw new Error('Det finns ingen giltig efterträdare.'); charge(state, 0, { publicFunds: true, tag: 'surrender' }); crown(state, successor, events, 'Frivillig abdikation', Math.max(30, state.realm.legitimacy - 10), actor.id === state.realm.lawfulRulerId); }
  else if (type === 'banish') { requireRule(state); const family = state.families[p.familyId]; if (!family || family.id === ruler(state)?.familyId) throw new Error('Välj en annan familj.'); if (family.exiled) throw new Error('Familjen lever redan i exil.'); charge(state, 30, { publicFunds: true, tag: 'cruel' }); family.exiled = true; family.hostFamilyId = null; family.grievance = -40; for (const subject of living(state)) if (subject.id !== actor.id) subject.fear = clamp(subject.fear + 15); state.realm.legitimacy = clamp(state.realm.legitimacy - 15); for (const office of values(state.offices).filter((o) => o.kind !== 'ruler' && state.people[o.holderId]?.familyId === family.id)) assignOffice(state, office, null, events, 'Familjen förvisas'); const m = memory(state, 'exile', 'Familjen fördrevs', [actor.id, family.headId], { familyIds: [family.id] }); for (const member of familyMembers(state, family.id)) opinionCause(state, member.id, actor.id, -40, 'Förvisning', m.id, 20); logEvent(state, events, 'exile', `${family.name} fördrivs`, 'Familjens ägande består, men lokal åtkomst och ämbeten går förlorade.', [family.headId]); }
  else if (type === 'seek_patron') { if (!state.realm.alive) throw new Error('Det upplösta rikets familjer kan inte utlova extern fristad. Välj ett faktiskt mottagarrike.'); const host = state.families[p.familyId]; if (!host || host.id === ownFamily.id || host.exiled) throw new Error('Välj en möjlig beskyddare.'); charge(state, 10); const score = getPersonalOpinion(state, host.headId, actor.id) + ownFamily.influence; if (score >= 35) { ownFamily.hostFamilyId = host.id; logEvent(state, events, 'patron', 'Familjen får skydd', `${host.name} ger hushållet en trygg hemvist.`, [actor.id, host.headId]); } else { ownFamily.influence = clamp(ownFamily.influence + 5); logEvent(state, events, 'patron_refused', 'Beskyddaren avböjer', 'Familjen fortsätter som skyddslöst hushåll och kan söka en annan väg.', [actor.id, host.headId]); } }
  else if (type === 'return_exile') { if (!state.realm.alive) throw new Error('Det tidigare riket finns inte längre att återvända till.'); if (!ownFamily.exiled) throw new Error('Familjen befinner sig inte i exil.'); const support = ownFamily.influence + getPersonalOpinion(state, ruler(state)?.id, actor.id); if (support < 65) throw new Error(`Återkomst kräver 65 stöd; nu ${Math.round(support)}.`); charge(state, 30); ownFamily.exiled = false; ownFamily.hostFamilyId = null; logEvent(state, events, 'return', 'Familjen återvänder', 'Egendomen blir åter åtkomlig och ämbeten kan sökas.', [actor.id]); }
  else if (type === 'livelihood') { charge(state, 0); ownFamily.treasury += 12 + actor.skills.stewardship; actor.stress = clamp(actor.stress + 4, 0, 200); logEvent(state, events, 'livelihood', 'Hushållet söker försörjning', `Arbete och handel ger ${12 + actor.skills.stewardship} silver.`, [actor.id]); }
  else if (type === 'sell_estate') { if (ownFamily.estates < 1) throw new Error('Familjen saknar egendom att sälja.'); charge(state, 0); ownFamily.estates -= 1; ownFamily.treasury += ownFamily.exiled ? 20 : 35; logEvent(state, events, 'property', 'Familjen säljer egendom', 'Likvida medel ökar men framtida egendomsinkomster minskar.', [actor.id]); }
  else if (type === 'tax_policy') { requireRule(state); if (!['gentle', 'balanced', 'harsh'].includes(p.policy)) throw new Error('Ogiltig skattepolitik.'); if (state.realm.taxPolicy === p.policy) throw new Error('Politiken gäller redan.'); charge(state, 10, { publicFunds: true, tag: p.policy === 'harsh' ? 'cruel' : 'duty' }); state.realm.taxPolicy = p.policy; for (const family of values(state.families)) family.grievance = clamp(family.grievance + (p.policy === 'harsh' ? -8 : p.policy === 'gentle' ? 6 : 2), -40, 40); logEvent(state, events, 'policy', 'Skattepolitiken ändras', p.policy === 'harsh' ? 'Högre intäkter ökar familjernas missnöje och stadens oro.' : 'Skatterna anpassas och stödet räknas om.', [actor.id]); }
  else if (type === 'patronize_faith') { const faith = state.religions[p.religionId]; if (!faith) throw new Error('Välj ett religiöst samfund.'); charge(state, 20, { publicFunds: canRule(state), tag: 'generous' }); faith.support = clamp(faith.support + 12); ownFamily.influence = clamp(ownFamily.influence + 4); memory(state, 'religion', `Stöd till ${faith.name}`, [actor.id, faith.leaderId]); logEvent(state, events, 'religion', 'Ett religiöst samfund får stöd', `${faith.name} stärker sitt politiska stöd med 12.`, [actor.id, faith.leaderId]); }
  else if (type === 'attempt_action') resolveAttempt(state, command, events, actionHooks(state));
  else if (type === 'hold_feast') holdFeast(state, events, actionHooks(state));
  else if (type === 'build_wonder') { requireRule(state); startWonder(state, p.wonderKind, actor, nextId(state, 'project'), events, actionHooks(state)); }
  else if (type === 'foreign_marriage') { requireRule(state); arrangeForeignMarriage(state, p, actor, nextId(state, 'person'), events, actionHooks(state)); }
  else if (type === 'fabricate_claim') { requireRule(state); fabricateClaim(state, p, actor, events, actionHooks(state)); }
  else if (type === 'declare_war') { requireRule(state); declareWar(state, p, actor, events, actionHooks(state)); }
  else if (type === 'make_peace') { requireRule(state); makePeace(state, p, actor, events, actionHooks(state)); }
  else if (type === 'bribe_tribe') { requireRule(state); bribeTribe(state, p, actor, events, actionHooks(state)); }
  else if (type === 'hire_tribe') { requireRule(state); hireTribe(state, p, actor, events, actionHooks(state)); }
  else if (type === 'crush_tribe') { requireRule(state); crushTribe(state, p, actor, events, actionHooks(state)); }
  else if (type === 'reward_councillor') { requireRule(state); rewardCouncillor(state, p.officeId, events, actionHooks(state)); }
  else if (type === 'set_reign_goal') { requireRule(state); setReignGoal(state, p.goalType, actionHooks(state)); }
  else if (type === 'release_prisoner') releasePrisoner(state, p, events, actionHooks(state));
  else if (type === 'execute_prisoner') executePrisoner(state, p, events, actionHooks(state));
  else if (type === 'abort_scheme') abortScheme(state, p, actionHooks(state));
  else if (type === 'reinforce_scheme') reinforceScheme(state, p, actionHooks(state));
  else if (Object.values(ARCHETYPES).some((a) => a.action === type)) { requireRule(state); const archetype = ARCHETYPES[actor.archetype]; if (archetype.action !== type) throw new Error('Den aktiva ledaren saknar denna arketypförmåga.'); if (state.projects.some((project) => project.kind === type && project.status === 'active' && (!project.personal || project.ownerId === actor.id))) throw new Error('Förmågan är redan aktiv.'); if (actor.cooldowns[type] && compareGameDates(actor.cooldowns[type], state.date) > 0) throw new Error('Förmågan kan användas igen nästa år.'); if (type === 'academy' && state.realm.academy) throw new Error('Akademin finns redan.'); charge(state, archetype.cost, { publicFunds: true, tag: type === 'mobilize' ? 'risky' : 'duty' }); actor.cooldowns[type] = addGameMonths(state.date, 12);
    if (['mobilize', 'reform', 'sanctuary'].includes(type)) { state.projects.push({ id: nextId(state, 'project'), kind: type, title: archetype.ability, ownerId: actor.id, createdAt: state.date, dueAt: addGameMonths(state.date, 36), personal: true, status: 'active' });  }
    if (type === 'concord') { for (const f of values(state.families)) { f.grievance = clamp(f.grievance + 10, -40, 40); opinionCause(state, f.headId, actor.id, 8, 'Försoningsråd', `concord:${state.date}`); } }
    if (type === 'academy' || type === 'aqueduct') state.projects.push({ id: nextId(state, 'project'), kind: type, title: archetype.ability, ownerId: actor.id, createdAt: state.date, dueAt: addGameMonths(state.date, type === 'academy' ? 36 : 24), personal: false, status: 'active' });
    if (type === 'succession_law') { state.realm.successionLaw = nextSuccessionLaw(state.realm.successionLaw); state.realm.legitimacy = clamp(state.realm.legitimacy - 8); for (const f of values(state.families)) f.grievance = clamp(f.grievance + (f.id === actor.familyId ? -8 : 5), -40, 40); }
    if (type === 'network') { const hidden = state.memories.find((m) => m.type === 'plot' && m.knownBy !== 'public' && !m.knownBy.includes(actor.id)); if (hidden) { hidden.knownBy.push(actor.id); const plot = plotSecretFor(state, hidden.id); if (plot) addSecretHolders(state, plot.id, [actor.id]); state.stories.push({ id: nextId(state, 'story'), type: 'discovery', title: 'En dold plan upptäcks', description: 'Dina kontakter har identifierat en person som försöker underminera rikets ledning.', actorId: hidden.participants[0], targetId: hidden.participants[1], createdAt: state.date, dueAt: addGameMonths(state.date, 12), status: 'open', knownBy: [actor.id], causeId: hidden.id }); } else { state.realm.legitimacy = clamp(state.realm.legitimacy + 5); } }
    logEvent(state, events, 'ability', archetype.ability, `${actor.name} använder ${archetype.name.toLowerCase()}s särskilda möjlighet.`, [actor.id]);
  } else throw new Error('Okänd karaktärshandling.');
  refreshMandates(state, events); refreshStories(state, events); updateStatus(state);
}

export function executeCharacterCommand(original, command) {
  if (!original) return { ok: false, state: original, events: [], error: 'Karaktärssystemet är inte startat.' };
  if (!safeId(command?.id)) return { ok: false, state: original, events: [], error: 'Handlingen behöver ett giltigt unikt id.' };
  if (original.appliedCommandIds.includes(command.id)) return { ok: true, state: original, events: [], error: null, duplicate: true };
  if (command.expectedRevision !== original.revision) return { ok: false, state: original, events: [], error: 'Världen har ändrats. Läs det senaste läget och försök igen.' };
  if (original.status.ended) return { ok: false, state: original, events: [], error: original.status.reason };
  try { const state = copy(original); ensureHealthState(state); ensureEventChains(state); ensureCharacterExtensions(state); const events = []; refreshRepresentation(state, events, { silent: original.mandateVersion == null }); handleCommand(state, command, events); consumeRegencyConsent(state, command.type); state.appliedCommandIds.push(command.id); state.revision++; capLog(state); return { ok: true, state, events, error: null }; } catch (error) { return { ok: false, state: original, events: [], error: error.message }; }
}

function closeKin(state, a, b) { if (a.familyId === b.familyId && (a.legalParentIds.length === 0 || b.legalParentIds.length === 0)) return true; const ancestors = (person) => new Set([...person.biologicalParentIds, ...person.legalParentIds, ...person.biologicalParentIds.flatMap((id) => state.people[id]?.biologicalParentIds || [])]); const aa = ancestors(a); const bb = ancestors(b); return aa.has(b.id) || bb.has(a.id) || [...aa].some((id) => bb.has(id)); }
export function evaluateCharacterDecision(state, personId) { const person = state.people[personId]; if (!canExerciseMandate(person, state.date)) return { personId, choice: 'wait', reasons: ['Personen kan inte utöva ett mandat just nu.'], scores: {} }; const family = state.families[person.familyId]; const leader = ruler(state); const holdsOffice = values(state.offices).some((o) => o.holderId === person.id); const support = familySupport(state, family); const opinion = getPersonalOpinion(state, person.id, leader?.id); const danger = (100 - person.health) / 100 + person.stress / 200; const scores = { serve: 20 + person.loyalty * 0.35 + (has(person, 'dutiful') ? 22 : 0) + (holdsOffice ? 10 : 0), seek_office: 12 + (has(person, 'ambitious') ? 35 : 0) + person.skills.diplomacy + (holdsOffice ? -35 : 8) - danger * 30, enrich: 12 + (has(person, 'greedy') ? 35 : 0) + person.skills.stewardship - danger * 15, reconcile: 12 + (has(person, 'compassionate') || has(person, 'gregarious') ? 30 : 0) + (support < 40 ? 12 : 0), plot: Math.max(0, -opinion * 0.4 + (50 - support) * 0.5) + (has(person, 'vengeful') ? 25 : 0) + (has(person, 'ambitious') ? 12 : 0) - (has(person, 'dutiful') ? 20 : 0) - (has(person, 'cautious') ? 18 : 0) - danger * 40 - person.fear * (has(person, 'cautious') ? 0.4 : 0.15), recover: 8 + person.stress * 0.65 + (has(person, 'cautious') ? 10 : 0) + (100 - person.health) * 0.35 };
  if (person.goal?.type === 'office') scores.seek_office += 6; if (person.goal?.type === 'security') scores.recover += 5; if (person.lastDecision?.choice && scores[person.lastDecision.choice] !== undefined) scores[person.lastDecision.choice] += 4;
  if (person.id === leader?.id || family.influence < 25 || family.treasury < 5 || family.exiled) scores.plot = -Infinity;
  const choice = Object.keys(scores).sort((a, b) => scores[b] - scores[a] || a.localeCompare(b))[0];
  return { personId, choice, reasons: [`Personlighet: ${person.traits.map((t) => TRAITS[t]?.name || t).join(', ')}`, `Tjänstelojalitet ${person.loyalty}; familjestöd ${Math.round(support)}; personlig åsikt ${Math.round(opinion)}.`, `Stress ${Math.round(person.stress)}, hälsa ${Math.round(person.health)}, rädsla ${Math.round(person.fear)}; tidigare mål ${person.goal?.type || 'saknas'}.`], scores: Object.fromEntries(Object.entries(scores).map(([key, value]) => [key, Number.isFinite(value) ? rounded(value) : null])) };
}
function aiAnnual(state, events) { const player = activeRepresentative(state); const leader = ruler(state); for (const person of living(state).filter((p) => adult(state, p) && p.id !== player?.id && !isImprisoned(state, p.id))) { const decision = evaluateCharacterDecision(state, person.id); person.lastDecision = { ...decision, date: state.date }; const family = state.families[person.familyId]; if (decision.choice === 'recover') { person.stress = Math.max(0, person.stress - 12); person.health = clamp(person.health + 2); } if (decision.choice === 'enrich') { person.wealth += 3; family.treasury += 2; person.goal = { type: 'wealth', since: person.goal?.type === 'wealth' ? person.goal.since : state.date, progress: Math.floor(person.wealth) }; } if (decision.choice === 'seek_office') { family.influence = clamp(family.influence + 2); person.goal = { type: 'office', since: person.goal?.type === 'office' ? person.goal.since : state.date, progress: family.influence }; } if (decision.choice === 'reconcile') { family.grievance = clamp(family.grievance + 1, -40, 40); person.stress = Math.max(0, person.stress - 4); } if (decision.choice === 'serve') { person.loyalty = clamp(person.loyalty + 1); person.skills.stewardship = Math.min(20, rounded(person.skills.stewardship + 0.1)); } if (decision.choice === 'plot' && leader && family.treasury >= 5) { family.treasury -= 5; family.influence = clamp(family.influence + 4); const recent = state.memories.some((m) => m.type === 'plot' && m.participants[0] === person.id && diffGameDays(m.date, state.date) < 1095); if (!recent) memory(state, 'plot', `${person.name} bygger en hemlig opposition`, [person.id, leader.id], { knownBy: [person.id] }); if (family.influence > 70 && familySupport(state, family) < 35 && !state.stories.some((s) => s.type === 'coup' && ['open', 'waiting'].includes(s.status))) { state.stories.push({ id: nextId(state, 'story'), type: 'coup', title: 'En utmanare samlar stöd', description: `${person.name} kräver en ny ledning. Familjens inflytande och arméns lydnad blir avgörande.`, actorId: person.id, targetId: leader.id, familyId: family.id, createdAt: state.date, dueAt: addGameMonths(state.date, 12), status: 'open', knownBy: 'public' }); logEvent(state, events, 'challenge', 'Rikets ledning utmanas', `${family.name} samlar en koalition bakom ${person.name}.`, [person.id, leader.id]); } } }
  const executive = realmExecutive(state);
  if (executive && !canRule(state)) {
    // The spymaster is the ruler's own choice (Phase 2): the realm's leadership does not fill it on its own.
    for (const office of values(state.offices).filter((office) => !office.holderId && office.kind !== 'ruler' && office.id !== 'spymaster')) {
      if (royalDecisionReason(state, 'appoint')) break;
      const skill = office.kind === 'general' ? 'command' : 'stewardship';
      const score = (person) => person.skills[skill] + getPersonalOpinion(state, executive.id, person.id) / 10;
      const candidate = living(state).filter((person) => adult(state, person) && !state.families[person.familyId].exiled && !isImprisoned(state, person.id)).sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))[0];
      if (candidate) { assignOffice(state, office, candidate, events, 'Rikets ledning fyller ett vakant ämbete'); consumeRoyalConsent(state, 'appoint'); }
    }
  }
}
function newChild(state, mother, father, events, sire = father) { const id = nextId(state, 'person'); const familyId = mother.familyId; const nameIndex = Math.floor(random(state) * NAME_POOL.length); const sex = random(state) < 0.5 ? 'female' : 'male'; const child = { id, name: `${NAME_POOL[nameIndex]} ${state.families[familyId].name}`, familyId, bornAt: state.date, diedAt: null, sex, culture: mother.culture, religionId: mother.religionId, traits: [mother.traits[0], sire.traits[0]].filter((t, i, list) => list.indexOf(t) === i), archetype: 'scholar', skills: { command: 1, stewardship: 1, diplomacy: 1, learning: 1, intrigue: 1, prowess: 1 }, stress: 0, health: 100, wealth: 0, loyalty: 60, fear: 0, biologicalParentIds: [mother.id, sire.id], legalParentIds: [mother.id, father.id], spouseId: null, mentorId: mother.id, education: 'learning', goal: { type: 'education', since: state.date, progress: 0 }, lastBirthAt: null, lastDecision: null, cooldowns: {} }; if (state.historicalOrigin) { child.name = `Barn ${id} (${state.families[familyId].name})`; child.identityOrigin = 'generated'; child.originLabelSv = 'Genererad person'; const claim = { status: 'generated', noteSv: 'Personen och familjebanden har uppstått i simuleringen.', sourceIds: [] }; child.historicalOrigin = publicPersonOrigin({ identityOrigin: child.identityOrigin, originLabelSv: child.originLabelSv, claims: { identity: claim, bornAt: claim, kinship: claim, mechanics: claim } }); } child.healthConditions = []; ensurePortraitIdentity(child, state.people); state.people[id] = child; mother.lastBirthAt = state.date; const event = logEvent(state, events, 'birth', `${child.name} föds`, `Barn till ${mother.name} och ${father.name}.`, [id, mother.id, father.id]); const birth = memory(state, 'birth', event.title, event.participants, { causeId: event.id }); if (sire.id !== father.id) recordIllegitimacy(state, child, mother, sire, birth.id); }
/** A married mother bears a child now: the husband is the legal father, the biological father comes from biologicalFather (paternity.js). */
export function bearChild(state, mother, husband, events) { newChild(state, mother, husband, events, biologicalFather(state, mother, husband, actionHooks(state))); }
function annualStep(state, events) {
  const effects = getCharacterWorldEffects(state), treasuryBefore = state.realm.treasury; state.realm.treasury = rounded(Math.max(0, state.realm.treasury + effects.annualRevenue)); state.actionPoints = 4;
  let annualRevenue = rounded(state.realm.treasury - treasuryBefore);
  for (const office of values(state.offices)) if (state.realm.alive && office.kind !== 'ruler' && office.holderId) office.publicBudget = Math.min(30, office.publicBudget + 5);
  for (const family of values(state.families)) { const members = familyMembers(state, family.id); const income = family.estates * (family.exiled ? (family.hostFamilyId || family.hostPolityId) ? 1 : 0 : 6); family.treasury = rounded(Math.max(0, family.treasury + income - members.length * 0.5 - (family.exiled ? 4 : 0))); family.influence = clamp(family.influence - (family.exiled ? 2 : 0)); if (family.exiled && !family.hostFamilyId && !family.hostPolityId && family.treasury < 5) for (const person of members) { person.health = Math.max(1, person.health - 5); person.stress = clamp(person.stress + 8, 0, 200); } }
  for (const city of values(state.cities)) { const support = familySupport(state, state.families[city.familyId]); city.unrest = clamp(city.unrest + (support < 35 ? 6 : -2) + (state.realm.taxPolicy === 'harsh' ? 5 : state.realm.taxPolicy === 'gentle' ? -3 : 0)); }
  for (const project of state.projects.filter((p) => p.status === 'active')) if (compareGameDates(project.dueAt, state.date) <= 0) { project.status = 'completed'; if (project.kind === 'estate') state.families[project.familyId].estates++; if (project.kind === 'aqueduct') { for (const city of values(state.cities)) city.infrastructure++; state.realm.infrastructure++; } if (project.kind === 'academy') state.realm.academy = true; if (project.kind === 'wonder') completeWonder(state); logEvent(state, events, 'project_completed', project.personal ? `${project.title} upphör` : `${project.title} står färdigt`, project.personal ? 'Den tidsbundna effekten har löpt ut.' : 'Det färdiga resultatet består över ledarskiften.', [project.ownerId]); }
  const deaths = []; const livingBefore = living(state).sort((a, b) => a.id.localeCompare(b.id));
  for (const person of livingBefore) { const age = getCharacterAge(person, state.date); person.stress = Math.max(0, person.stress - 3); person.fear = Math.max(0, person.fear - 2); if (age >= 45) person.health = Math.max(0, person.health - (age >= 70 ? 5 : age >= 60 ? 3 : 1)); if (person.stress >= 100) person.health = Math.max(0, person.health - 4); if (age < ADULT_AGE && person.education) { const mentor = state.people[person.mentorId]; if (alive(mentor)) { const gain = 0.5 + mentor.skills[person.education] / 18 + (state.realm.academy ? 0.5 : 0); person.skills[person.education] = Math.min(20, rounded(person.skills[person.education] + gain)); } } if (age === ADULT_AGE) { const mentor = state.people[person.mentorId]; let corrected = null; if (alive(mentor)) { person.archetype = mentor.archetype; const shaped = traitsAtAdulthood(person, mentor, random(state)); if (shaped) { person.traits = shaped.traits; corrected = shaped.corrected; } } logEvent(state, events, 'adulthood', `${person.name} blir myndig`, `Utbildning och erfarenheter formar en ${ARCHETYPES[person.archetype].name.toLowerCase()}.${correctionNote(person, corrected)}`, [person.id, person.mentorId]); memory(state, 'adulthood', 'Myndighet och avslutad grundutbildning', [person.id, person.mentorId]); }
    const draw = random(state); if (person.health <= 0 || draw < ageDeathRisk(age, person.health)) deaths.push(person.id);
  }
  killPeople(state, deaths, events);
  if (!state.status.ended) runAnnualHealth(state, events, { representativeId: activeRepresentative(state)?.id, playerFamilyId: controlledFamily(state)?.id, nominalId: state.identity.mode === 'realm' ? state.offices.ruler.holderId : state.families[state.identity.familyId]?.headId });
  for (const mother of living(state).filter((p) => p.sex === 'female' && getCharacterAge(p, state.date) >= 20 && getCharacterAge(p, state.date) <= 42).sort((a, b) => a.id.localeCompare(b.id))) { if (birthsClosed(state)) break; const father = state.people[mother.spouseId]; if (!adult(state, father) || father.sex !== 'male') continue; if (mother.lastBirthAt && diffGameDays(mother.lastBirthAt, state.date) < 600) continue; const children = values(state.people).filter((p) => p.biologicalParentIds.includes(mother.id)); if (children.length >= 4) continue; if (random(state) < (mother.health > 50 ? 0.22 : 0.06)) bearChild(state, mother, father, events); }
  const representativeId = activeRepresentative(state)?.id; const singles = living(state).filter((p) => adult(state, p) && getCharacterAge(p, state.date) < 40 && !hasLivingSpouse(state, p) && p.id !== representativeId).sort((a, b) => a.id.localeCompare(b.id));
  for (const person of singles) { if (hasLivingSpouse(state, person)) continue; const partner = singles.find((p) => p.id !== person.id && p.sex !== person.sex && !hasLivingSpouse(state, p) && !closeKin(state, person, p)); if (partner && random(state) < 0.2) { person.spouseId = partner.id; partner.spouseId = person.id; addBond(state, person.id, partner.id, 'partner'); logEvent(state, events, 'marriage', 'En ny familjeförbindelse', `${person.name} och ${partner.name} gifter sig.`, [person.id, partner.id]); memory(state, 'marriage', 'Äktenskap mellan familjer', [person.id, partner.id]); } }
  refreshMandates(state, events); aiAnnual(state, events);
  for (const story of [...state.stories]) { if (story.type !== 'event_chain' && story.status === 'open' && diffGameDays(story.reopenedAt || story.createdAt, state.date) > 730) { const choices = storyChoices(state, story).filter((choice) => !choice.disabledReason); const fallback = choices.find((c) => c.id === 'defer') || choices.find((c) => c.id === 'observe' || c.id === 'watch' || (story.type !== 'health_care' && c.id === 'rest') || c.id === 'keep' || c.id === 'break' || c.id === 'resist' || c.id === 'refuse') || choices.find((c) => !c.disabledReason); if (fallback) { try { resolveStory(state, story, fallback.id, events, true); } catch { story.status = 'closed'; } } } }
  refreshStories(state, events);
  scheduleDirectedStory(state, events, storyContext(state), logEvent);
  scheduleEventChain(state, events, chainContext(state), chainHooks(state));
  const actor = activeRepresentative(state); if (actor?.stress >= 80 && !breakdownDue(state, actor) && !state.stories.some((s) => s.type === 'stress_crisis' && s.status === 'open' && s.actorId === actor.id)) state.stories.push({ id: nextId(state, 'story'), type: 'stress_crisis', title: 'Ansvaret börjar tära', description: `${actor.name} behöver hantera sin belastning.`, actorId: actor.id, createdAt: state.date, dueAt: addGameMonths(state.date, 12), status: 'open', knownBy: [actor.id] });
  if (state.realm.alive && state.realm.treasury === 0) state.realm.legitimacy = clamp(state.realm.legitimacy - 8); else if (state.realm.alive) state.realm.legitimacy = clamp(state.realm.legitimacy + 0.5);
  updateStatus(state); const yearEvent = logEvent(state, events, 'year', 'Årets förvaltning är avslutad', '', []);
  syncPlotSecrets(state);
  prisonerStep(state, events, actionHooks(state));
  paternityStep(state, actionHooks(state));
  bastardClaimStep(state, actionHooks(state));
  bondStep(state, actionHooks(state));
  npcPlotStep(state, events, actionHooks(state));
  annualRevenue = rounded(annualRevenue + courtAnnualStep(state, events, actionHooks(state)));
  courtRenewalStep(state, events, actionHooks(state));
  cadetBranchStep(state, events, actionHooks(state));
  // Fill the existing event after the payment, preserving its id and position in both logs.
  yearEvent.description = `Statskassan förändras med ${annualRevenue.toFixed(1).replace('.', ',').replace('-', '−')} silver. Nya personliga beslut, ålder och politiska förhållanden har behandlats.`;
}

export function advanceCharacters(original, targetDate, options = {}) {
  const date = normalizeGameDate(targetDate); if (!original || !date) return { ok: false, state: original, events: [], error: 'Ogiltigt tillstånd eller datum.' };
  const id = options.id || `advance:${date}`;
  if (!safeId(id)) return { ok: false, state: original, events: [], error: 'Ogiltigt tidsstegs-id.' };
  if (original.appliedCommandIds.includes(id)) return { ok: true, state: original, events: [], error: null, duplicate: true };
  if (compareGameDates(date, original.date) < 0) return { ok: false, state: original, events: [], error: 'Tiden kan bara återställas genom en tidigare sparad värld.' };
  if (date === original.date || original.status.ended) return { ok: true, state: original, events: [], error: null };
  if (diffGameDays(original.date, date) > 366 * 500) return { ok: false, state: original, events: [], error: 'Dela upp tidshopp som är längre än 500 år.' };
  try {
  const state = copy(original); ensureHealthState(state); ensureEventChains(state); ensureLineageState(state); ensureCharacterExtensions(state); const events = [];
  refreshRepresentation(state, events, { silent: original.mandateVersion == null });
  for (let next = getNextCharacterTransitionDate(state, date); next; next = getNextCharacterTransitionDate(state, date)) {
    state.date = next;
    const fatalities = advanceHealthTransitions(state, events, { representativeId: activeRepresentative(state)?.id, playerFamilyId: controlledFamily(state)?.id, nominalId: state.identity.mode === 'realm' ? state.offices.ruler.holderId : state.families[state.identity.familyId]?.headId });
    killPeople(state, fatalities.map((fatality) => fatality.personId), events, Object.fromEntries(fatalities.map((fatality) => [fatality.personId, fatality.reason])));
    refreshRepresentation(state, events);
    advanceSchemes(state, events, actionHooks(state));
    if (compareGameDates(state.nextAnnualDate, state.date) <= 0 && !state.status.ended) { annualStep(state, events); state.nextAnnualDate = addGameMonths(state.nextAnnualDate, 12); }
    refreshStories(state, events); updateStatus(state);
    if (state.status.ended) { if (compareGameDates(state.nextAnnualDate, state.date) <= 0) state.nextAnnualDate = addGameMonths(state.nextAnnualDate, 12); break; }
  }
  if (!state.status.ended) state.date = date; state.appliedCommandIds.push(id); state.revision++; capLog(state); fadeAll(state); return { ok: true, state, events, error: null };
  } catch (error) { return { ok: false, state: original, events: [], error: error.message }; }
}

/** Earliest actual simulation boundary, including subannual health changes. */
export function getNextCharacterTransitionDate(state, targetDate) {
  const target = normalizeGameDate(targetDate);
  if (!state || state.status.ended || !target || compareGameDates(target, state.date) <= 0) return null;
  // A plot, a crime case, a ransom offer and a court story lapse on their due date, so that date is a step of its own and a long jump closes them on the same day as monthly stepping.
  const storyDeadlines = state.stories.filter((story) => ((['character_event', 'plot_uncovered', 'punish_crime', 'ransom_offer', ...COURT_STORY_TYPES].includes(story.type)) && story.status === 'open') || (isOfficePromise(story) && story.status === 'waiting')).map((story) => story.dueAt);
  const majorityDates = living(state).filter((person) => !adult(state, person)).map((person) => addGameMonths(person.bornAt, ADULT_AGE * 12));
  const dates = [state.nextAnnualDate, getNextHealthTransitionDate(state), ...getEventChainDates(state), ...getSchemeDates(state), ...majorityDates, ...storyDeadlines, target].filter((date) => date && compareGameDates(date, state.date) > 0 && compareGameDates(date, target) <= 0);
  return dates.sort(compareGameDates)[0] || target;
}

const selectField = (key, label, items) => ({ key, label, type: 'select', options: items.map((item) => ({ value: item.id ?? item.value, label: item.name ?? item.label })) });
export function getAvailableCharacterActions(state) {
  const actor = activeRepresentative(state); const householdActor = householdRepresentative(state); const family = controlledFamily(state); if (!actor || state.status.ended) return [];
  const publicRight = canRule(state); const people = living(state).filter((p) => adult(state, p)); const ownPeople = people.filter((p) => p.familyId === family?.id); const children = living(state).filter((p) => !adult(state, p)); const offices = values(state.offices).filter((o) => o.kind !== 'ruler'); const otherFamilies = values(state.families).filter((f) => f.id !== family?.id); const base = state.actionPoints < 1 ? 'Årets handlingar är slut. För tiden framåt.' : !adult(state, actor) ? 'Ingen myndig företrädare finns.' : '';
  const actions = [];
  function add(type, label, description, amount, fields = [], pub = false, tag = 'duty', extraReason = '') { const wallet = pub ? state.realm : family; const acting = commandActor(state, type); actions.push({ type, label, description, actorId: acting?.id || null, actorName: acting?.name || null, payer: { kind: pub ? 'realm' : 'family', id: pub ? state.realm.id : family?.id }, cost: `${amount} silver ur ${pub ? 'statskassan' : 'familjekassan'} · 1 handling`, stress: String(stressFor(acting, tag)), disabledReason: base || (!canExerciseMandate(acting, state.date) ? 'Mandatet saknar en handlingsförmögen företrädare.' : '') || extraReason || regencyVeto(state, type) || (pub && !publicRight ? 'Kräver härskarmandat.' : wallet?.treasury < amount ? 'Otillräckligt med silver.' : fields.some((field) => !field.options.length) ? 'Ingen behörig deltagare finns.' : ''), fields }); }
  const patients = familyMembers(state, family?.id).filter((person) => getTreatableConditions(person).length);
  if (patients.length) {
    add('provide_care', 'Ordna vård i hushållet', 'Välj ett pågående tillstånd. Omvårdnad och vila lindrar följderna; utgången avgörs av sparade regler och kalendern.', 5, [selectField('personId', 'Person', patients), selectField('conditionId', 'Tillstånd', patients.flatMap((person) => getTreatableConditions(person).map((condition) => ({ id: condition.id, name: person.name + ' · ' + HEALTH_CONDITION_LABELS[condition.kind] })))), selectField('care', 'Omvårdnad', [{ id: 'rest', name: 'Vila och avlastning · 5 silver' }, { id: 'physician', name: 'En läkekunnig · 20 silver' }])]);
    actions.at(-1).cost = 'Vila 5 eller läkekunnig 20 familjesilver · 1 handling';
  }
  add('rest', 'Återhämta dig', `${householdActor?.name || 'Familjens företrädare'}: stress −30 och hälsa +5.`, 10);
  add('gift', 'Ge en personlig gåva', 'Förbättra en riktad relation. En gåva per mottagare och år.', 15, [selectField('targetId', 'Mottagare', people.filter((p) => p.id !== householdActor?.id))], false, 'generous');
  add('hold_feast', 'Håll gästabud', 'Bjud in alla myndiga personer i riket i en månad. Gästerna kommer närmare och intriger mot dem blir lättare att föra, men fler ser vad som sker.', 30, [], false, 'generous', family ? feastRefusal(state, family.id) : '');
  actions.at(-1).category = 'court';
  if (state.historicalOrigin && publicRight) add('build_wonder', 'Bygg ett underverk', `Ett tioårigt bygge ur statskassan. Det färdiga underverket ger ${WONDER.prestige} ryktbarhet och håller rikets ryktbarhet uppe så länge riket består.`, WONDER.cost, [selectField('wonderKind', 'Underverk', Object.entries(WONDER_KINDS).map(([value, kind]) => ({ value, label: kind.label })))], true, 'duty', wonderRefusal(state));
  if (state.historicalOrigin && publicRight) add('foreign_marriage', 'Gifte med ett grannhus', 'Gift bort en person i din familj med en ogift person i ett grannrike. Partnern flyttar till hovet och riket får en allierad, som kan kalla er till krig.', ALLIANCE.cost, [selectField('personId', 'Person', marriageableKin(state, actionHooks(state))), selectField('partnerKey', 'Partner', foreignPartners(state))], true, 'duty', foreignMarriageRefusal(state, actionHooks(state)));
  if (state.historicalOrigin && publicRight) add('fabricate_claim', 'Smid ett anspråk', `Låt skrivare förfalska en arvsrätt till gränslandet mot ett grannrike. Anspråket är klart om ${CLAIM.months / 12} år, och förfalskningen kan avslöjas.`, CLAIM.forge, [selectField('realmId', 'Grannrike', claimTargets(state))], true, 'risky', claimRefusal(state));
  if (state.historicalOrigin && publicRight && pressTargets(state).length) add('declare_war', 'Gå i krig för anspråket', 'Förklara krig för att ta gränslandet. Ett slag om året avgör kriget; två segrar mer än nederlagen vinner landet.', CLAIM.war, [selectField('realmId', 'Grannrike', pressTargets(state))], true, 'risky');
  if (publicRight && hasTribes(state)) addTribeActions(state, add);
  if (state.historicalOrigin && publicRight && peaceTargets(state).length) add('make_peace', 'Slut fred', 'Avsluta kriget utan att vinna landet. Riket förlorar 5 i ryktbarhet och anspråket upphör.', 0, [selectField('realmId', 'Grannrike', peaceTargets(state))], true, 'surrender');
  add('build_estate', 'Utveckla familjens egendom', 'En bestående egendom färdigställs om två år och ger inkomster.', 45, [], false, 'duty', family?.exiled && !family.hostFamilyId && !family.hostPolityId ? 'Sök en beskyddare före jordköp.' : '');
  add('build_support', 'Bygg politiskt stöd', 'Förhandla med en annan familj. Inflytande +12 och en personlig förbindelse.', 15, [selectField('familyId', 'Familj', otherFamilies)], false, 'generous');
  if (state.realm.alive) add('seek_office', 'Sök ett ämbete', 'Rådet väger inflytande, diplomati och härskarens personliga inställning.', 15, [selectField('officeId', 'Ämbete', offices)], false, 'duty', family?.exiled ? 'Återvänd från exil först.' : '');
  add('educate', 'Utse en mentor', 'Styr utbildningen av ett barn i familjen. Personligheten förblir delvis osäker.', 15, [selectField('childId', 'Barn', children.filter((p) => p.familyId === family?.id)), selectField('mentorId', 'Mentor', people), selectField('focus', 'Utbildning', Object.entries(SKILL_LABELS).map(([id, name]) => ({ id, name })))]);
  add('marry', 'Förhandla om äktenskap', 'Två myndiga personer behöver vara fria och acceptera förbindelsen.', 20, [selectField('personId', 'Familjemedlem', ownPeople.filter((p) => !hasLivingSpouse(state, p))), selectField('partnerId', 'Föreslagen partner', people.filter((p) => !hasLivingSpouse(state, p)))]);
  add('adopt', 'Adoptera en arvinge', 'Skapar juridiskt föräldraskap; en annan familj behöver samtycka.', 25, [selectField('childId', 'Barn', children.filter((p) => !p.legalParentIds.includes(householdActor?.id)))]);
  add('patronize_faith', 'Stöd ett religiöst samfund', 'Samfundets politiska stöd ökar med 12.', 20, [selectField('religionId', 'Samfund', values(state.religions))], publicRight, 'generous');
  add('livelihood', 'Sök försörjning', householdActor ? `Arbete och handel ger ${12 + householdActor.skills.stewardship} silver. Stress +4.` : 'En handlingsförmögen företrädare kan ordna arbete och handel för hushållet.', 0);
  add('sell_estate', 'Sälj familjeegendom', 'Likvida medel nu, lägre inkomster senare.', 0, [], false, 'duty', family?.estates < 1 ? 'Ingen egendom finns att sälja.' : '');
  const ownOffices = offices.filter((o) => o.holderId === actor.id);
  if (ownOffices.length) { add('exercise_office', 'Utöva ditt ämbete', 'Använd ämbetets avgränsade budget till offentlig tjänst eller familjens klienter. Valet påverkar verklig förvaltning och politik.', 0, [selectField('officeId', 'Ditt ämbete', ownOffices), selectField('policy', 'Inriktning', [{ id: 'service', name: 'Offentlig tjänst' }, { id: 'patronage', name: 'Familjens klienter' }])]); actions.at(-1).cost = '10 silver ur ämbetets budget · 1 handling'; actions.at(-1).stress = 'Tjänst: ' + stressFor(actor, 'duty') + ' · Klienter: ' + stressFor(actor, 'betrayal'); }
  const lawfulClaim = family && familyRoyalClaim(state, family.id);
  if (state.realm.alive && !publicRight && actor.id !== state.offices.ruler.holderId) add('press_claim', lawfulClaim ? 'Återupprätta familjens rättsliga anspråk' : 'Driv anspråket på tronen', lawfulClaim ? 'Den rättsliga pretendenten ' + lawfulClaim.name + ' får 20 extra maktstöd och behöver minst 45 inflytande.' : 'Inflytande och befäl vägs mot arméns beredskap och härskarens legitimitet.', 40, [], false, 'risky', family?.influence < (lawfulClaim ? 45 : 60) ? 'Familjen behöver mer inflytande.' : '');
  if (family?.exiled && state.realm.alive) { add('seek_patron', 'Sök skydd hos en familj', 'En beskyddare ger hemvist och tillgång till försörjning.', 10, [selectField('familyId', 'Beskyddare', otherFamilies.filter((f) => !f.exiled))]); add('return_exile', 'Förhandla om återkomst', 'Inflytande och härskarens inställning behöver tillsammans nå 65.', 30); }
  if (publicRight) { add('appoint', 'Utse en ämbetsinnehavare', 'Offentliga rättigheter följer ämbetet. Förbigångna personer och familjer reagerar.', 15, [selectField('officeId', 'Ämbete', offices), selectField('personId', 'Kandidat', people)], true); add('dismiss', 'Avsätt en ämbetsinnehavare', 'Ämbetet blir vakant. Personens och familjens egna tillgångar består.', 5, [selectField('officeId', 'Ämbete', offices.filter((o) => o.holderId))], true, 'cruel'); add('tax_policy', 'Ändra skattepolitik', 'Intäkter, politiskt stöd och lokal oro förändras tillsammans.', 10, [selectField('policy', 'Skattenivå', [{ id: 'gentle', name: 'Låg' }, { id: 'balanced', name: 'Balanserad' }, { id: 'harsh', name: 'Hög' }])], true); add('banish', 'Förvisa en politisk familj', 'Förlorade ämbeten och åtkomst skapar bestående oförrätter. Legitimitet −15.', 30, [selectField('familyId', 'Familj', otherFamilies.filter((f) => !f.exiled))], true, 'cruel'); add('abdicate', 'Abdikera enligt successionsordningen', 'Nästa lagliga kandidat tar över. Personliga förmågor upphör och spelidentiteten följer kampanjvalet.', 0, [], true, 'surrender', state.offices.ruler.regentId ? 'Regenten kan inte avsäga sig barnets tron.' : ''); const a = ARCHETYPES[actor.archetype]; add(a.action, a.ability, a.description, a.cost, [], true, a.action === 'mobilize' ? 'risky' : 'duty', state.projects.some((p) => p.kind === a.action && p.status === 'active' && (!p.personal || p.ownerId === actor.id)) ? 'Förmågan är redan aktiv.' : a.action === 'academy' && state.realm.academy ? 'Akademin finns redan.' : ''); }
  if (publicRight) { const seats = filledSeats(state, actionHooks(state)); add('reward_councillor', 'Belöna en rådsmedlem', 'Stärk en rådsmedlems lojalitet med silver ur statskassan. En belöning per rådsmedlem och år.', 20, [selectField('officeId', 'Ämbete', seats)], true, 'generous', rewardClosedReason(seats)); }
  if (publicRight) { const hooks = actionHooks(state), goals = openGoals(state, hooks); add('set_reign_goal', 'Sätt ett mål för regeringen', 'Utlys ett mål för regeringen. Ett uppnått mål ger legitimitet och ryktbarhet, ett förfelat mål kostar legitimitet.', 0, [selectField('goalType', 'Mål', goals)], true, 'duty', goalClosedReason(state, goals, hooks)); }
  const held = family ? heldPrisoners(state, family.id) : [];
  // Listed whenever prisoners are held, so the Intriger tab can show why a ruler-only command is closed (add() gives the reason).
  if (held.length) {
    const prisoners = held.map((record) => ({ id: record.id, name: `${state.people[record.personId].name} · fånge sedan ${record.since}` }));
    add('release_prisoner', 'Frige en fånge', 'Fången släpps ur fängelset. Fången och familjens huvudman minns nåden (åsikt om dig +10).', 0, [selectField('prisonerId', 'Fånge', prisoners)], true);
    add('execute_prisoner', 'Avrätta en fånge', 'Fången avrättas. Fångens släkt tappar förtroendet för dig (åsikt om dig −50) och legitimiteten sjunker med 4 om fången inte är dömd för ett avslöjat brott.', 0, [selectField('prisonerId', 'Fånge', prisoners)], true, 'cruel');
  }
  if (family?.exiled && !state.realm.alive) {
    const hosts = state.externalHosts.filter((host) => host.id !== family.hostPolityId);
    add('seek_refuge', 'Förhandla om fristad i ett annat rike', 'Mottagaren måste acceptera. Inflytande + diplomati ×3 + mottagarens åsikt /2 prövas mot dess krav. Ingen stat skapas av förhandlingen.', 0, [selectField('polityId', 'Verklig mottagare', hosts.map((host) => ({ id: host.id, name: host.name + ' · ' + host.admissionCost + ' silver · krav ' + host.refugeThreshold })))], false, 'surrender');
    actions.at(-1).cost = 'Mottagarens kostnad (vanligen 20 familjesilver) · 1 handling';
  }
  if (publicRight && state.realm.lawfulRulerId !== state.offices.ruler.holderId) add('recognize_claim', 'Erkänn det rättsliga tronanspråket', 'Lämna tronen till ' + state.people[state.realm.lawfulRulerId]?.name + '. Familjens privata tillgångar består.', 0, [], true, 'surrender');
  const governance = describeGovernance(state);
  const minority = governance.regencies.filter((record) => ['minority', 'incapacity'].includes(record.phase) && canExerciseMandate(state.people[record.regentId], state.date) && record.vetoedActions.length);
  if (minority.length) {
    const denied = [...new Set(minority.flatMap((record) => record.vetoedActions.filter((type) => actions.some((action) => action.type === type))))];
    add('request_regent_consent', 'Förhandla om regentens samtycke', 'Veto kan hävas för ett lyckat beslut inom ett år. Förhandling behöver 60 samarbetsvilja; ersättning ger +35; rådet behöver 65 stöd. Avslag förbrukar insatsen.', 0, [selectField('regencyId', 'Mandat', minority.map((record) => ({ id: record.id, name: record.regentName + (record.id.startsWith('office:') ? ' · rikets regent' : ' · familjens förmyndare') }))), selectField('actionType', 'Beslut', denied.map((id) => ({ id, name: actions.find((action) => action.type === id)?.label || ARCHETYPES[Object.keys(ARCHETYPES).find((key) => ARCHETYPES[key].action === id)]?.ability || id }))), selectField('approach', 'Väg', [{ id: 'negotiate', name: 'Förhandla · 10 familjesilver' }, { id: 'compensate', name: 'Ersätt regenten · 30 familjesilver' }, { id: 'appeal', name: 'Rådets prövning · 15 inflytande' }])]);
    actions.at(-1).cost = 'Vald insats · 1 handling';
  }
  const contested = governance.regencies.filter((record) => record.phase === 'contested');
  if (contested.length) {
    add('resolve_regency', 'Återta mandatet efter myndighetsdagen', 'En pension garanterar överlämning. Råd eller maktprövning väger eget stöd mot regentens inflytande, ambition och bristande lojalitet; avslag kostar resurser.', 0, [selectField('regencyId', 'Mandat', contested.map((record) => ({ id: record.id, name: record.regentName + (record.id.startsWith('office:') ? ' · rikets regent' : ' · familjens förmyndare') }))), selectField('approach', 'Uppgörelse', [{ id: 'pension', name: 'Avtalad pension · 40 familjesilver' }, { id: 'council', name: 'Rådets mandat · 20 inflytande' }, { id: 'confront', name: 'Maktprövning · 25 familjesilver' }])], false, 'surrender');
    actions.at(-1).cost = 'Vald insats · 1 handling';
  }
  return actions;
}

/** The command menu plus the contested actions of the action catalog, with the household representative and family that pay for them. Read-only: no randomness, no spending. */
export function getCatalogActions(state) { return catalogFrom(state, getAvailableCharacterActions(state)); }
// The acting person is the active representative, who gives the orders (drawOrder in actionResolution.js); the controlled family pays.
const catalogFrom = (state, actions) => buildCatalogActions(state, actions, { representativeId: activeRepresentative(state)?.id || null, familyId: controlledFamily(state)?.id || null, realmAccess: canRule(state),
  shieldedIds: [state.offices.ruler?.holderId, activeRepresentative(state)?.id, householdRepresentative(state)?.id].filter(Boolean) });

function presentStory(state, story) {
  const choices = story.status === 'open' ? storyChoices(state, story) : [];
  const fallback = story.type === 'character_event' ? choices.find((choice) => choice.id === 'ignore') : null;
  const cause = state.memories.find((item) => item.id === story.causeId && visibleTo(state, item));
  const caption = story.status === 'open' && COURT_STORY_TYPES.includes(story.type) ? { deadlineText: courtDeadlineText(story, actionHooks(state)) } : {};
  return { ...copy(story), ...caption, actorName: state.people[story.actorId]?.name || state.families[story.familyId]?.name || '',
    causeTitle: cause?.title || null,
    fallbackDescription: fallback ? `${fallback.label}. ${fallback.description} Kostnad: 0 silver.` : null, choices,
    ...(story.type === 'event_chain' ? presentEventChain(state, story) : {}) };
}

function describeCharacterAuthority(state) {
  const family = controlledFamily(state);
  const describe = (scope) => {
    const principalId = scope === 'royal' ? state.offices.ruler.holderId : family?.headId;
    const principal = state.people[principalId];
    const record = state.regencies[scope === 'royal' ? 'office:ruler' : `family:${family?.id}`];
    const representative = scope === 'royal' ? realmExecutive(state) : householdRepresentative(state);
    const contested = record?.phase === 'contested' && record.principalId === principalId;
    const reason = contested ? 'contested' : alive(principal) && !adult(state, principal) ? 'minority' : getIncapacityCauseIds(principal, state.date).length ? 'incapacity' : null;
    const blockedReason = contested ? 'Mandatöverlämningen är omstridd. De reserverade besluten är spärrade tills konflikten är löst.' : !representative ?
      scope === 'royal' && !state.realm.alive ? 'Riket har upplösts.' : 'Ingen handlingsförmögen företrädare finns just nu. Kalendern kan fortsätta.' : '';
    return { principalId: principalId || null, representativeId: representative?.id || null, reason, blockedReason,
      playerCanExercise: !state.status.ended && (scope === 'royal' ? canRule(state) : Boolean(representative)) };
  };
  return { royal: describe('royal'), household: describe('household') };
}

export function getCharacterPresentation(state) {
  if (!state) return null; const leader = ruler(state); const representative = activeRepresentative(state); const family = controlledFamily(state); const effects = getCharacterWorldEffects(state); const actions = getAvailableCharacterActions(state); const difficulty = normalizeDifficulty(state.difficulty); const hooks = actionHooks(state);
  const people = values(state.people).map((p) => ({ ...copy(p), ...(p.historicalOrigin ? { historicalOrigin: publicPersonOrigin(p.historicalOrigin) } : {}), healthConditions: publicHealthConditions(p, p.diedAt || state.date), portraitState: resolvePortraitState(p, state.date, { family: state.families[p.familyId] }), portraitId: p.portraitId && p.portraitSourceAgeGroup === portraitGroup(getCharacterAge(p, p.diedAt || state.date)) ? p.portraitId : `fallback-${p.sex}-${portraitGroup(getCharacterAge(p, p.diedAt || state.date))}`, portraitAgeGroup: portraitGroup(getCharacterAge(p, p.diedAt || state.date)), age: getCharacterAge(p, p.diedAt || state.date), alive: alive(p), imprisoned: isImprisoned(state, p.id), familyName: state.families[p.familyId]?.name || '', archetypeLabel: ARCHETYPES[p.archetype]?.name || p.archetype, traitLabels: p.traits.map((t) => TRAITS[t]?.name || t), roleNames: values(state.offices).filter((o) => o.holderId === p.id).map((o) => o.name), opinion: representative ? getPersonalOpinion(state, p.id, representative.id) : 0, opinionReasons: representative ? opinionReasons(state, p.id, representative.id) : [], relations: values(state.relations).filter((r) => r.fromId === p.id && r.bonds.length).map((r) => ({ targetId: r.toId, targetName: state.people[r.toId]?.name || r.toId, types: [...r.bonds] })), stressLevel: p.stress >= 100 ? 'Kris' : p.stress >= 60 ? 'Belastad' : 'Samlad', goalLabel: ({ office: 'Söker inflytande och ämbete', security: 'Skyddar familjens trygghet', wealth: 'Bygger förmögenhet', education: 'Utbildas' })[p.goal?.type] || 'Fullgör sitt uppdrag', lastDecision: p.id === representative?.id && p.lastDecision ? { choice: p.lastDecision.choice, date: p.lastDecision.date } : null, cooldowns: undefined, loyalty: undefined, loyaltyReading: presentLoyalty(state, p, hooks), nickname: nicknameOf(state, p.id) }));
  const families = values(state.families).map((f) => ({ ...copy(f), headName: state.people[f.headId]?.name || 'Ingen', guardianName: state.people[f.guardianId]?.name || null, support: Math.round(familySupport(state, f)), supportReasons: familySupportReasons(state, f), income: f.estates * (f.exiled ? (f.hostFamilyId || f.hostPolityId) ? 1 : 0 : 6), memberIds: familyMembers(state, f.id).map((p) => p.id), officeCount: values(state.offices).filter((o) => state.people[o.holderId]?.familyId === f.id).length, statusLabel: f.exiled ? f.hostPolityId ? 'Exil under ' + f.hostPolityName + 's accepterade skydd' : f.hostFamilyId ? `Exil under ${state.families[f.hostFamilyId]?.name}s skydd` : 'Skyddslöst hushåll' : 'Etablerad' }));
  return { ...(state.historicalOrigin ? { historicalOrigin: publicHistoricalOrigin(state.historicalOrigin), foreignRealms: presentForeignRealms(state, hooks), tribes: presentTribes(state) } : {}), realm: presentRealm(state), court: presentCourt(state, hooks), nicknamePath: nicknameProgress(state, hooks), handover: reignHandover(state, hooks), chainHistory: presentEventChainHistory(state, family?.id), authority: describeCharacterAuthority(state), date: state.date, revision: state.revision, mode: state.identity.mode, identity: { ...state.identity, familyName: state.families[state.identity.familyId]?.name, realmName: state.realm.name }, ruler: people.find((p) => p.id === leader?.id) || null, representative: people.find((p) => p.id === representative?.id) || null, people, families, offices: values(state.offices).map((o) => ({ ...copy(o), holderName: state.people[o.holderId]?.name || 'Vakant', regentName: state.people[o.regentId]?.name || null })), cities: effects.cityEffects.map((c) => ({ ...c, familyName: state.families[c.familyId]?.name, governorName: state.people[c.governorId]?.name || 'Vakant' })), religions: values(state.religions).map((r) => ({ ...r, ...(r.historicalOrigin ? { historicalOrigin: publicReligionOrigin(r.historicalOrigin) } : {}), support: religiousSupport(state, r.id), leaderName: state.people[r.leaderId]?.name || 'Vakant' })), memories: state.memories.filter((m) => visibleTo(state, m)).map((m) => ({ ...copy(m), participantNames: m.participants.map((id) => state.people[id]?.name || id) })), stories: state.stories.filter((s) => visibleTo(state, s) && ['open', 'waiting'].includes(s.status)).map((s) => presentStory(state, s)), projects: state.projects.map((project) => ({ ...copy(project), effectActive: project.status === 'active' && (!project.personal || (project.ownerId === realmExecutive(state)?.id && compareGameDates(project.dueAt, state.date) > 0)), effectReason: project.personal && project.status === 'active' && project.ownerId !== realmExecutive(state)?.id ? 'Den personliga effekten vilar utan ett aktivt härskarmandat. Slutdatumet ligger fast.' : '' })), actions, catalog: catalogFrom(state, actions), difficulty: { id: difficulty, label: DIFFICULTIES[difficulty] }, recentResolutions: presentResolutions(state, family?.id ?? null), staff: staffOf(state, family?.id ?? null).map((member) => ({ id: member.id, name: member.name, role: member.role, roleLabel: STAFF_ROLES[member.role] || member.role })), schemes: presentSchemes(state, family?.id ?? null), occasions: presentOccasions(state, family?.id ?? null), prisoners: presentPrisoners(state, family?.id ?? null), rumors: presentRumors(state, family?.id ?? null), ...presentConversation(state, hooks), economy: { treasury: effects.treasury, annualRevenue: effects.annualRevenue, familyTreasury: rounded(family?.treasury || 0), familyIncome: rounded((family?.estates || 0) * (family?.exiled ? (family.hostFamilyId || family.hostPolityId) ? 1 : 0 : 6) - familyMembers(state, family?.id).length * 0.5 - (family?.exiled ? 4 : 0)), influence: Math.round(family?.influence || 0), legitimacy: effects.legitimacy, militaryReadiness: effects.militaryReadiness, productionMultiplier: effects.productionMultiplier, actionPoints: state.actionPoints, taxPolicy: state.realm.taxPolicy, academy: state.realm.academy }, governance: describeGovernance(state), succession: { ...describeGovernance(state), forecast: getSuccessionForecast(state), law: state.realm.successionLaw, lawLabel: SUCCESSION_LAW_RULES_SV[state.realm.successionLaw] ?? SUCCESSION_LAW_RULES_SV.primogeniture, candidates: rulerCandidates(state).slice(0, 8).map((p) => ({ id: p.id, name: p.name, familyName: state.families[p.familyId]?.name, age: getCharacterAge(p, state.date), archetypeLabel: ARCHETYPES[p.archetype]?.name })), regentName: state.people[state.offices.ruler.regentId]?.name || null, familyHeadName: state.people[family?.headId]?.name || null, propertyRule: 'Personlig egendom går till äldsta levande juridiska barn, annars en familjemedlem. Familjeegendom och statskassa behåller sina ägare.' }, log: state.log.filter((e) => e.public).slice(-CHARACTER_LOG_LIMIT).reverse().map(copy), status: copy(state.status), versions: { schema: state.schemaVersion, rules: state.rulesVersion, content: state.contentVersion, health: state.healthVersion, stories: STORY_DIRECTOR_VERSION, chains: EVENT_CHAIN_VERSION, mandates: state.mandateVersion, provenance: RULE_PROVENANCE } };
}

// Host order authorization shares the exact family/regent mandate rules.
export function canCharacterDirectRealm(state) { return Boolean(state && !state.status.ended && canRule(state)); }

function hostTransition(original, operation, apply) {
  if (!original || !safeId(operation?.id)) return { ok: false, state: original, events: [], error: 'Hostövergången behöver ett giltigt tillstånd och id.' };
  if (original.appliedCommandIds.includes(operation.id)) return { ok: true, state: original, events: [], error: null, duplicate: true };
  if (normalizeGameDate(operation.date || original.date) !== original.date) return { ok: false, state: original, events: [], error: 'För kalendern fram till hosthändelsens datum innan övergången.' };
  try {
    const state = copy(original); ensureGovernance(state); ensureHealthState(state); ensureCharacterExtensions(state);
    const events = [];
    if (apply(state, events) === false) return { ok: true, state: original, events: [], error: null };
    refreshMandates(state, events); refreshStories(state, events); updateStatus(state);
    state.appliedCommandIds.push(operation.id); state.revision++; capLog(state);
    return { ok: true, state, events, error: null };
  } catch (error) { return { ok: false, state: original, events: [], error: error.message }; }
}

/** Invoked only after the host world has actually dissolved the polity. */
export function applyRealmDissolution(original, operation) {
  return hostTransition(original, operation, (state, events) => {
    if (!state.realm.alive) return false;
    const formerRuler = ruler(state);
    const family = controlledFamily(state);
    state.externalHosts = cleanHostCandidates(operation.hostCandidates, state.identity.polityId, operation.hostAccepted ? [operation.hostPolityId] : []);
    const acceptedHost = operation.hostAccepted && state.externalHosts.find((host) => host.id === operation.hostPolityId);
    if (operation.hostAccepted && !acceptedHost) throw new Error('Ett accepterande mottagarrike måste finnas bland hostens verkliga kandidater.');
    state.realm.alive = false;
    state.realm.dissolvedAt = state.date;
    state.realm.dissolutionReason = String(operation.reason || 'Statsbildningen har upphört.');
    state.realm.formerTreasury = state.realm.treasury;
    state.realm.treasury = 0;
    for (const office of values(state.offices)) {
      if (office.holderId) office.history.push({ personId: office.holderId, date: state.date, reason: 'Ämbetet upphör när riket upplöses.' });
      office.holderId = null; office.regentId = null; office.publicBudget = 0;
    }
    onAccession(state, null, { lawful: state.reign.lawful, legitimacy: state.realm.legitimacy });
    for (const record of values(state.regencies)) if (record.id.startsWith('office:')) { record.phase = 'closed'; record.endedAt = state.date; }
    for (const project of state.projects) if (project.status === 'active' && project.kind !== 'estate') { project.status = 'ended'; project.endedAt = state.date; project.endReason = 'Den offentliga uppdragsgivaren har upphört.'; }
    if (family) {
      family.exiled = true; family.hostFamilyId = null;
      family.hostPolityId = acceptedHost?.id || null;
      family.hostPolityName = acceptedHost?.name || null;
      family.refugeAcceptedAt = acceptedHost ? state.date : null;
    }
    const event = logEvent(state, events, 'realm_dissolved', `${state.realm.name} upphör som rike`, `${state.realm.dissolutionReason} Offentliga mandat upphör. Familjens egna personer och tillgångar består${acceptedHost ? ` under ${acceptedHost.name}s accepterade skydd` : ' utan garanterat skydd'}.`, [formerRuler?.id, family?.headId]);
    memory(state, 'realm_dissolved', event.title, event.participants, { causeId: event.id, familyIds: family ? [family.id] : [] });
    for (const story of state.stories) if (['open', 'waiting'].includes(story.status) && ['office_promise', 'promise_due', 'legacy_claim', 'coup', ...COURT_STORY_TYPES].includes(story.type)) {
      story.status = 'closed'; story.resolvedAt = state.date; story.resolution = 'Det tidigare rikets offentliga ämbeten har upphört; minnet består.';
    }
    return true;
  });
}

/** Reconcile actual host actors when their world identities change or vanish. */
export function reconcileExternalHosts(original, operation) {
  return hostTransition(original, operation, (state, events) => {
    const protectedHosts = values(state.families).map((family) => operation.hostAliases?.[family.hostPolityId] || family.hostPolityId).filter(Boolean);
    const candidates = cleanHostCandidates(operation.hostCandidates, state.identity.polityId, protectedHosts);
    const changed = JSON.stringify(candidates) !== JSON.stringify(state.externalHosts);
    state.externalHosts = candidates;
    let lost = false;
    let renamed = false;
    for (const family of values(state.families)) if (family.hostPolityId) {
      const renamedId = operation.hostAliases?.[family.hostPolityId];
      const renamedHost = renamedId && candidates.find((host) => host.id === renamedId);
      if (renamedHost && renamedHost.id !== family.hostPolityId) {
        family.hostPolityId = renamedHost.id; family.hostPolityName = renamedHost.name; renamed = true;
      }
      const currentHost = candidates.find((host) => host.id === family.hostPolityId);
      if (currentHost && currentHost.name !== family.hostPolityName) { family.hostPolityName = currentHost.name; renamed = true; }
    }
    for (const family of values(state.families)) if (family.hostPolityId && !candidates.some((host) => host.id === family.hostPolityId)) {
      const oldHostName = family.hostPolityName || family.hostPolityId;
      family.hostPolityId = null; family.hostPolityName = null; family.refugeAcceptedAt = null;
      family.exiled = true; lost = true;
      const event = logEvent(state, events, 'refuge_lost', 'Familjen förlorar sitt skydd', `${oldHostName} finns inte längre som giltig mottagare. ${family.name} behöver söka nytt skydd.`, [family.headId]);
      memory(state, 'refuge_lost', event.title, event.participants, { causeId: event.id, familyIds: [family.id] });
    }
    if (changed && !lost) logEvent(state, events, 'refuge_context', 'Möjliga mottagare har förändrats', 'Förhandlingar om skydd använder de riken som faktiskt finns i världen.', []);
    return changed || lost || renamed;
  });
}
