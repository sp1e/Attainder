import { addGameMonths, compareGameDates, normalizeGameDate } from '../gameDates.js';
import { bandFor } from './actionOdds.js';
import { COUNCIL_SEATS, ambitionOf, loyaltyPrecision, readerIntrigue, serviceOf, serviceTier } from './council.js';
import { normalizeDifficulty, plotRandom, spymasterOf } from './extensions.js';
import { AGGRESSION } from './npcPlots.js';
import { isImprisoned } from './prisoners.js';
import { reignMonths } from './reign.js';

// Factions: discontented nobles gather against the ruler in secret, and the spymaster uncovers them a person at a time. A record is { id: 'faction-<n>', targetRulerId, leaderId, claimantId, memberIds, knownMemberIds, formedAt, status, outcome, quietUntil, ultimatumAt, dueAt, storyId, concessions, closedAt } and lives in state.factions. memberIds and knownMemberIds stay sorted, every known member is a member, and one faction lives at a time.
// Silence is a hard rule. A forecast passes event text to the model, so forming, joining, leaving and dissolving write no event, no memory and no log line. Only a discovery logs, and its text names nobody. presentFactions is the only reader that reveals names, and only known ones.
// The yearly step runs only while the player holds the crown as an adult. It draws only from the plot stream (plotRandom), and only after every other check passed. Nothing else here draws randomness.
// `hooks` are the engine's (actionHooks in index.js). actionResolution.js, npcPlots.js and schemes.js import each other in a cycle, so AGGRESSION is read only inside a function here.

export const DISCONTENT_THRESHOLD = 16;
export const LEAVE_BELOW = 5;
export const FOUNDERS = 3;
export const FORM_BASE = 40;
export const JOIN_CHANCE = 50;
export const GRACE_MONTHS = 24;
export const ULTIMATUM_STRENGTH = 50;
export const MATURITY_PER_YEAR = 6;

const MIN_MEMBERS = 2;
const CLAIMANT_NAMED_AT = 2;
const FORM_CHANCE = Object.freeze({ min: 5, max: 90 });
// `held` is what fear takes from the cautious and the craven, `fear` from everyone else. From `enemyFear` the vengeful and the brave turn `fear` of it back into enmity.
const DISCONTENT = Object.freeze({ opinion: 0.5, supportBase: 60, support: 0.6, grievance: 0.5, legitimacyBase: 60, legitimacy: 0.3, ambitious: 10, vengeful: 8, throne: 8, shakySeat: 10, seatBelow: 30, nemesis: 10, held: 0.6, fear: 0.3, enemyFear: 15 });
const STRENGTH = Object.freeze({ member: 8, family: 10, legitimacyBase: 60, legitimacy: 0.5, influenceBase: 45, influence: 0.5, dread: 0.3, min: 5, max: 95 });
const DISCOVERY = Object.freeze({ base: 15, perPoint: 5, max: 70, faithful: 10 });
const TRACE = Object.freeze({ title: 'Spår av en faktion', spymaster: 'Din spionmästare har hittat ännu en person i en faktion mot härskaren.', rumor: 'Du har hört talas om ännu en person i en faktion mot härskaren.' });
const STAGE_LABELS = Object.freeze({ active: 'I det fördolda', ultimatum: 'Ultimatum', appeased: 'Har backat tills vidare' });
const STATUSES = Object.freeze(['active', 'ultimatum', 'appeased', 'closed']);
const OUTCOMES = Object.freeze(['dissolved', 'abdicated', 'deposed', 'crushed', 'void']);
const FIELDS = 'claimantId,closedAt,concessions,dueAt,formedAt,id,knownMemberIds,leaderId,memberIds,outcome,quietUntil,status,storyId,targetRulerId,ultimatumAt';
const INVALID = 'En faktion i sparfilen är ogiltig.';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const compareIds = (a, b) => a.localeCompare(b, 'en', { numeric: true });
const byId = (a, b) => compareIds(a.id, b.id);
const byBirth = (a, b) => compareGameDates(a.bornAt, b.bornAt) || byId(a, b);
const sortedIds = (ids) => [...ids].sort(compareIds);
const hasAny = (person, traits) => traits.some((trait) => person.traits.includes(trait));
const aggression = (state) => AGGRESSION[normalizeDifficulty(state.difficulty)];
const isLive = (faction) => faction.status !== 'closed';
const liveFactions = (state) => (state.factions ?? []).filter(isLive);
// In exile or in prison, a person neither plots nor claims. The loader refuses a person with no family, so the lookup always lands.
const isAtLarge = (state, person) => !state.families[person.familyId].exiled && !isImprisoned(state, person.id);
// hooks.adult is false for the dead and for a person who is missing.
const isFree = (state, person, hooks) => hooks.adult(person) && isAtLarge(state, person);
const closeFaction = (state, faction, outcome) => { Object.assign(faction, { status: 'closed', outcome, closedAt: state.date }); };

// A known member who leaves is no known member.
function keepMembers(faction, keeps) {
  faction.memberIds = faction.memberIds.filter(keeps);
  faction.knownMemberIds = faction.knownMemberIds.filter(keeps);
}

// dread.js writes the relationship with the kin first; a pair reads the same either way round.
function isNemesis(state, personId, rulerId) {
  return state.relationships.some(({ kind, aId, bId }) => kind === 'nemesis' && ((aId === personId && bId === rulerId) || (aId === rulerId && bId === personId)));
}

const holdsShakySeat = (state, person, hooks) => COUNCIL_SEATS.some((id) => state.offices[id]?.holderId === person.id && serviceOf(state, id, hooks) < DISCONTENT.seatBelow);

function fearTerm(person) {
  const held = hasAny(person, ['cautious', 'craven']) ? DISCONTENT.held : DISCONTENT.fear;
  const enemy = hasAny(person, ['vengeful', 'brave']) && person.fear >= DISCONTENT.enemyFear ? DISCONTENT.fear : 0;
  return person.fear * (enemy - held);
}

function natureTerm(state, person, rulerId, hooks) {
  const ambitious = person.traits.includes('ambitious') ? DISCONTENT.ambitious : 0;
  const vengeful = person.traits.includes('vengeful') ? DISCONTENT.vengeful : 0;
  const throne = ambitionOf(state, person, hooks) === 'throne' ? DISCONTENT.throne : 0;
  const seat = holdsShakySeat(state, person, hooks) ? DISCONTENT.shakySeat : 0;
  return ambitious + vengeful + throne + seat + (isNemesis(state, person.id, rulerId) ? DISCONTENT.nemesis : 0);
}

/** How much a person holds against the crown. Unrounded, and never shown. */
export function discontentOf(state, person, hooks) {
  const ruler = hooks.ruler(), family = state.families[person.familyId];
  const opinion = ruler ? hooks.getPersonalOpinion(person.id, ruler.id) : 0;
  const realm = (DISCONTENT.supportBase - hooks.familySupport(family)) * DISCONTENT.support + (DISCONTENT.legitimacyBase - state.realm.legitimacy) * DISCONTENT.legitimacy;
  return -opinion * DISCONTENT.opinion + realm - family.grievance * DISCONTENT.grievance + natureTerm(state, person, ruler?.id, hooks) + fearTerm(person);
}

/** The ruler's oldest free adult sibling, else the first free adult in line, else the leader, else null. */
export function claimantFor(state, faction, hooks) {
  const ruler = hooks.ruler(), free = (person) => isFree(state, person, hooks), leader = state.people[faction.leaderId];
  const sharesParent = (person) => person.id !== ruler?.id && person.legalParentIds.some((id) => ruler?.legalParentIds.includes(id));
  const [sibling] = Object.values(state.people).filter((person) => free(person) && sharesParent(person)).sort(byBirth);
  return sibling ?? hooks.rulerCandidates().find(free) ?? (free(leader) ? leader : null);
}

function fullYears(from, to) {
  let years = 0;
  while (compareGameDates(addGameMonths(from, 12 * (years + 1)), to) <= 0) years++;
  return years;
}

/** The faction's strength, 5 to 95. Derived on every read and never stored. */
export function factionStrength(state, faction, hooks) {
  const families = [...new Set(faction.memberIds.map((id) => state.people[id].familyId))];
  const topInfluence = Math.max(...families.map((id) => state.families[id].influence));
  const numbers = STRENGTH.member * faction.memberIds.length + STRENGTH.family * (families.length - 1);
  const standing = (STRENGTH.legitimacyBase - state.realm.legitimacy) * STRENGTH.legitimacy + (topInfluence - STRENGTH.influenceBase) * STRENGTH.influence;
  return clamp(Math.round(numbers + standing - hooks.dreadOf() * STRENGTH.dread + MATURITY_PER_YEAR * fullYears(faction.formedAt, state.date)), STRENGTH.min, STRENGTH.max);
}

// Free adults outside the ruler's family, at the threshold, in id order.
function restless(state, hooks) {
  const rulingFamilyId = hooks.ruler().familyId;
  const eligible = (person) => person.familyId !== rulingFamilyId && isFree(state, person, hooks);
  return Object.values(state.people).filter((person) => eligible(person) && discontentOf(state, person, hooks) >= DISCONTENT_THRESHOLD).sort(byId);
}

function mostDiscontented(state, people, hooks) {
  const rows = people.map((person) => ({ person, discontent: discontentOf(state, person, hooks) }));
  return rows.sort((a, b) => b.discontent - a.discontent || byId(a.person, b.person)).map((row) => row.person);
}

// Silent by rule: no event, no memory and no log line. The founders are the three most discontented; anyone else at the threshold joins on a later year's draw.
function formFaction(state, hooks) {
  const founders = mostDiscontented(state, restless(state, hooks), hooks).slice(0, FOUNDERS);
  if (founders.length < FOUNDERS) return;
  const [leader] = founders, chance = clamp((FORM_BASE + discontentOf(state, leader, hooks)) * aggression(state), FORM_CHANCE.min, FORM_CHANCE.max);
  if (plotRandom(state) * 100 >= chance) return;
  const faction = { id: `faction-${++state.sequence}`, targetRulerId: hooks.ruler().id, leaderId: leader.id, claimantId: null, memberIds: sortedIds(founders.map((person) => person.id)), knownMemberIds: [], formedAt: state.date, status: 'active', outcome: null, quietUntil: null, ultimatumAt: null, dueAt: null, storyId: null, concessions: 0, closedAt: null };
  // The leader is a free adult, so the chain always ends in somebody.
  faction.claimantId = claimantFor(state, faction, hooks).id;
  state.factions.push(faction);
}

function shiftMembers(state, faction, hooks) {
  keepMembers(faction, (id) => discontentOf(state, state.people[id], hooks) >= LEAVE_BELOW);
  for (const { id } of restless(state, hooks)) {
    if (faction.memberIds.includes(id)) continue;
    if (plotRandom(state) * 100 < JOIN_CHANCE * aggression(state)) faction.memberIds = sortedIds([...faction.memberIds, id]);
  }
}

// Replaces a leader or a claimant who is gone. Too few members or no claimant ends the faction. Silent, as forming is.
function settleFaction(state, faction, hooks) {
  if (faction.memberIds.length < MIN_MEMBERS) { closeFaction(state, faction, 'dissolved'); return; }
  if (!faction.memberIds.includes(faction.leaderId)) faction.leaderId = mostDiscontented(state, faction.memberIds.map((id) => state.people[id]), hooks)[0].id;
  const claimant = state.people[faction.claimantId];
  if (!claimant || !isFree(state, claimant, hooks)) faction.claimantId = claimantFor(state, faction, hooks)?.id ?? null;
  if (faction.claimantId === null) closeFaction(state, faction, 'dissolved');
}

function discoveryChance(state, spymaster, hooks) {
  const faithful = spymaster && serviceTier(serviceOf(state, 'spymaster', hooks)) === 'trogen' ? DISCOVERY.faithful : 0;
  return clamp(DISCOVERY.base + readerIntrigue(state, hooks) * DISCOVERY.perPoint, DISCOVERY.base, DISCOVERY.max) + faithful;
}

// A forecast passes the event text to the model, so the event names nobody and lists no participant.
function discover(state, faction, events, hooks) {
  const hidden = faction.memberIds.find((id) => !faction.knownMemberIds.includes(id));
  if (!hidden) return;
  const spymaster = spymasterOf(state);
  if (plotRandom(state) * 100 >= discoveryChance(state, spymaster, hooks)) return;
  faction.knownMemberIds = sortedIds([...faction.knownMemberIds, hidden]);
  hooks.logEvent(events, 'faction_trace', TRACE.title, spymaster ? TRACE.spymaster : TRACE.rumor, []);
}

/** Yearly, after the demands: a faction forms, or the live one shifts and may lose a member to the spymaster. A faction never surfaces in the year it forms. */
export function factionStep(state, events, hooks) {
  if (!hooks.canRule() || !hooks.adult(hooks.ruler()) || reignMonths(state) < GRACE_MONTHS) return;
  const [faction] = liveFactions(state);
  if (!faction) { formFaction(state, hooks); return; }
  shiftMembers(state, faction, hooks);
  settleFaction(state, faction, hooks);
  if (isLive(faction)) discover(state, faction, events, hooks);
}

/** Takes the dead, the imprisoned and the banished out of the live faction on the date it happens, and refills what they held. Draws nothing and writes no event. */
export function refreshFactions(state, events, hooks) {
  for (const faction of liveFactions(state)) {
    keepMembers(faction, (id) => !state.people[id].diedAt && isAtLarge(state, state.people[id]));
    settleFaction(state, faction, hooks);
  }
}

/** A faction is sworn against one ruler, so every change of reign ends it. */
export function voidFactions(state) {
  for (const faction of liveFactions(state)) closeFaction(state, faction, 'void');
}

function presentFaction(state, faction, precision, hooks) {
  const named = faction.knownMemberIds.length >= CLAIMANT_NAMED_AT || faction.ultimatumAt !== null;
  return { id: faction.id, stageLabel: STAGE_LABELS[faction.status], knownMembers: faction.knownMemberIds.map((id) => ({ id, name: state.people[id].name })), claimantName: named ? state.people[faction.claimantId].name : null, strengthLabel: bandFor(factionStrength(state, faction, hooks), precision), memberCount: precision === 'exact' ? faction.memberIds.length : null, dueAt: faction.dueAt };
}

/** What the player knows, at the reader's precision. Reads only. A faction with no known member and no ultimatum does not exist here. */
export function presentFactions(state, hooks) {
  const shown = liveFactions(state).filter((faction) => faction.knownMemberIds.length > 0 || faction.ultimatumAt !== null);
  if (!shown.length) return [];
  const precision = loyaltyPrecision(state, hooks);
  return shown.map((faction) => presentFaction(state, faction, precision, hooks));
}

const canonical = (date) => typeof date === 'string' && normalizeGameDate(date) === date;
const ownKey = (map, key) => typeof key === 'string' && Object.hasOwn(map, key);
const numberOf = (id) => Number(/^faction-([1-9]\d*)$/.exec(id)?.[1] ?? Number.NaN);
const dateWithin = (date, from, to) => canonical(date) && compareGameDates(date, from) >= 0 && compareGameDates(date, to) <= 0;
const sortedPeople = (state, ids) => Array.isArray(ids) && ids.every((id, index) => ownKey(state.people, id) && (index === 0 || compareIds(ids[index - 1], id) < 0));
const validMembers = (state, { memberIds, knownMemberIds }) => sortedPeople(state, memberIds) && sortedPeople(state, knownMemberIds) && knownMemberIds.every((id) => memberIds.includes(id));
const ownStory = (state, { id, storyId }) => storyId === null || state.stories.some((story) => story.id === storyId && story.type === 'faction_ultimatum' && story.factionId === id);

// A faction that ended keeps the record it ended with, so only a live one answers for its members and its target.
function validCourse(state, faction) {
  if (faction.status === 'closed') return OUTCOMES.includes(faction.outcome) && dateWithin(faction.closedAt, faction.formedAt, state.date) && (faction.claimantId === null || ownKey(state.people, faction.claimantId));
  if (faction.outcome !== null || faction.closedAt !== null || faction.memberIds.length < MIN_MEMBERS) return false;
  return faction.memberIds.includes(faction.leaderId) && ownKey(state.people, faction.claimantId) && faction.targetRulerId === state.reign.rulerId;
}

function validStage(state, faction) {
  const { status, formedAt, quietUntil, ultimatumAt, dueAt, storyId } = faction;
  if ((quietUntil !== null && !canonical(quietUntil)) || (dueAt !== null && !canonical(dueAt)) || (ultimatumAt !== null && !dateWithin(ultimatumAt, formedAt, state.date))) return false;
  if (status === 'ultimatum' && (ultimatumAt === null || dueAt === null || storyId === null)) return false;
  return (status !== 'appeased' || quietUntil !== null) && ownStory(state, faction);
}

function validFaction(state, faction) {
  if (faction === null || typeof faction !== 'object' || Object.keys(faction).sort().join() !== FIELDS) return false;
  if (!(numberOf(faction.id) <= state.sequence) || !STATUSES.includes(faction.status) || !Number.isInteger(faction.concessions) || faction.concessions < 0) return false;
  if (!ownKey(state.people, faction.targetRulerId) || !ownKey(state.people, faction.leaderId) || !validMembers(state, faction)) return false;
  return canonical(faction.formedAt) && compareGameDates(faction.formedAt, state.date) <= 0 && validCourse(state, faction) && validStage(state, faction);
}

/** Refuses forged faction records. Called from validateCourt when a save loads. */
export function validateFactions(state) {
  if (!state.factions.every((faction) => validFaction(state, faction))) throw new Error(INVALID);
  const ids = new Set(state.factions.map((faction) => faction.id));
  const told = state.stories.every((story) => story.type !== 'faction_ultimatum' || ids.has(story.factionId));
  if (ids.size !== state.factions.length || liveFactions(state).length > 1 || !told) throw new Error(INVALID);
}
