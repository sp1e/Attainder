import { addGameMonths, compareGameDates, normalizeGameDate } from '../gameDates.js';
import { bandFor, chanceFromRows, precisionFor } from './actionOdds.js';
import { COUNCIL_SEATS, ambitionOf, capPrecision, loyaltyPrecision, readerIntrigue, serviceOf, serviceTier } from './council.js';
import { cowNobles } from './dread.js';
import { actionRandom, normalizeDifficulty, plotRandom, spymasterOf } from './extensions.js';
import { AGGRESSION } from './npcPlots.js';
import { imprisonPerson, imprisonRefusal, isImprisoned } from './prisoners.js';
import { bastardClaimant, claimLabel } from './bastardClaims.js';
import { addPrestige, reignMonths } from './reign.js';

// Factions: discontented nobles gather against the ruler in secret, and the spymaster uncovers them a person at a time. A record is { id: 'faction-<n>', targetRulerId, leaderId, claimantId, memberIds, knownMemberIds, formedAt, status, outcome, quietUntil, ultimatumAt, dueAt, storyId, concessions, closedAt } and lives in state.factions. memberIds and knownMemberIds stay sorted, every known member is a member, and one faction lives at a time.
// Silence is a hard rule. A forecast passes event text to the model, so forming, joining, leaving and dissolving write no event, no memory and no log line. A discovery logs and its text names nobody. While a faction lives, presentFactions is the only reader that reveals names, and only known ones.
// At strength 50 a faction comes out with a dated ultimatum, and its leader with it. The ruler abdicates, concedes or tries to crush it, and an unanswered ultimatum or a failed crush deposes the ruler. A concession buys 36 months, after which the faction goes back to work in the dark. An open ultimatum is public, so its story names the people behind it, and settleFaction retells it when one is replaced. A crush or a deposition brings the whole faction into the open: both copy memberIds to knownMemberIds before they write a row, so a member outside knownMemberIds never reaches the view or a prompt. A concession, an abdication, a dissolved faction and a voided one reveal nobody.
// The yearly step runs only while the player holds the crown as an adult. It draws only from the plot stream (plotRandom), and only after every other check passed. The one other draw is the crush, from the action stream (actionRandom).
// `hooks` are the engine's (actionHooks in index.js). actionResolution.js, npcPlots.js and schemes.js import each other in a cycle, so AGGRESSION is read only inside a function here.

export const DISCONTENT_THRESHOLD = 15;
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
// The outcomes only an ultimatum can lead to.
const ANSWERED = Object.freeze(['abdicated', 'deposed', 'crushed']);
const FIELDS = 'claimantId,closedAt,concessions,dueAt,formedAt,id,knownMemberIds,leaderId,memberIds,outcome,quietUntil,status,storyId,targetRulerId,ultimatumAt';
const INVALID = 'En faktion i sparfilen är ogiltig.';
const ULTIMATUM = Object.freeze({ months: 6, title: 'Faktionen kräver abdikation', event: 'Adeln ställer ett ultimatum', deadlineText: 'Utan svar tvingar adeln härskaren från tronen när tiden går ut.' });
const ANSWER_ORDERS = 1;
const NO_MANDATE = 'Kräver härskarmandat.';
const NO_ORDERS = 'Årets handlingsutrymme är slut. För tiden framåt.';
const NO_FUNDS = 'Otillräcklig statskassa.';
const NO_REGENT = 'En regent kan inte avsäga sig härskarens tron.';
const ABDICATION = Object.freeze({ reason: 'Abdikation under tryck från adeln', legitimacyLoss: 10, legitimacyFloor: 30, prestige: -8 });
const CONCESSION = Object.freeze({ silver: 60, perConcession: 40, legitimacy: -5, quietMonths: 36 });
const CRUSHED = Object.freeze({ fear: 15, opinion: -15, opinionLabel: 'Kronans hårda hand mot adeln', legitimacy: -3, title: 'Faktionen slås ned' });
// A head outside the faction earns this row too, so its label names no faction.
const DEPOSITION = Object.freeze({ reason: 'Adeln tvingar fram en abdikation', title: 'Adeln tvingar härskaren från tronen', legitimacy: 35, prestige: -15, influence: -15, stress: 30, stressMax: 200, grievance: 10, opinion: 10, opinionLabel: 'Stöder det nya styret', chancellorReason: 'Faktionen belönar sin ledare' });
const ODDS = Object.freeze({ base: 50, readinessBase: 55, readinessPer: 2, legitimacyBase: 50, legitimacyPer: 3, strengthBase: 50, strengthPer: 2, dreadPer: 5, dreadMax: 10 });
const GENERAL_ROW = 'Överbefälhavarens tjänst';
// By serviceTier. A vacant seat has no service and lands in the lowest tier.
const GENERAL_SERVICE = Object.freeze({ trogen: 8, pålitlig: 0, motvillig: -8, opålitlig: -15 });
const CLOSED = Object.freeze({ reign: 'Ultimatumet gällde den förra härskaren och faller med det styret.', dissolved: 'Faktionen har fallit samman, och ultimatumet faller med den.' });

/** What an ultimatum past its due date resolves to. */
export const ULTIMATUM_EXPIRY = Object.freeze({ choiceId: 'forced', text: 'Ingen svarade i tid, och adeln tvingade härskaren från tronen.' });

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
// The opinion rows of a crush and a deposition carry the faction's id into the view, so the whole faction counts as known before the first row.
const closeInTheOpen = (state, faction, outcome) => { closeFaction(state, faction, outcome); faction.knownMemberIds = [...faction.memberIds]; };
const factionOf = (state, story) => state.factions.find((faction) => faction.id === story.factionId);
const ultimatumStory = (state, faction) => state.stories.find((story) => story.id === faction.storyId);
const moveLegitimacy = (state, amount) => { state.realm.legitimacy = clamp(state.realm.legitimacy + amount, 0, 100); };

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

/** The eldest free adult royal bastard whose birth is exposed, else the ruler's oldest free adult sibling, else the first free adult in line, else the leader, else null. */
export function claimantFor(state, faction, hooks) {
  const ruler = hooks.ruler(), free = (person) => isFree(state, person, hooks), leader = state.people[faction.leaderId];
  const sharesParent = (person) => person.id !== ruler?.id && person.legalParentIds.some((id) => ruler?.legalParentIds.includes(id));
  const [sibling] = Object.values(state.people).filter((person) => free(person) && sharesParent(person)).sort(byBirth);
  return bastardClaimant(state, free) ?? sibling ?? hooks.rulerCandidates().find(free) ?? (free(leader) ? leader : null);
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

function ultimatumText(state, faction, hooks) {
  const leader = state.people[faction.leaderId], claimant = faction.claimantId === leader.id ? 'sig själv' : claimLabel(state, state.people[faction.claimantId]);
  return `${leader.name} leder adeln mot ${hooks.ruler().name} och kräver tronen åt ${claimant}.`;
}

const withLeaderKnown = (faction) => sortedIds(new Set([...faction.knownMemberIds, faction.leaderId]));

// An open ultimatum is public, so it names the people who stand behind it today. Silent, as the rest of settleFaction is.
function retellUltimatum(state, faction, hooks) {
  faction.knownMemberIds = withLeaderKnown(faction);
  Object.assign(ultimatumStory(state, faction), { actorId: faction.leaderId, description: ultimatumText(state, faction, hooks) });
}

// Replaces a leader or a claimant who is gone. Too few members or no claimant ends the faction, and refreshCourtStories then closes an open ultimatum. Silent, as forming is.
function settleFaction(state, faction, hooks) {
  if (faction.memberIds.length < MIN_MEMBERS) { closeFaction(state, faction, 'dissolved'); return; }
  if (!faction.memberIds.includes(faction.leaderId)) faction.leaderId = mostDiscontented(state, faction.memberIds.map((id) => state.people[id]), hooks)[0].id;
  const claimant = state.people[faction.claimantId];
  if (!claimant || !isFree(state, claimant, hooks)) faction.claimantId = claimantFor(state, faction, hooks)?.id ?? null;
  if (faction.claimantId === null) closeFaction(state, faction, 'dissolved');
  else if (faction.status === 'ultimatum') retellUltimatum(state, faction, hooks);
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

const quietOver = (state, { quietUntil }) => quietUntil === null || compareGameDates(quietUntil, state.date) <= 0;
const coupOpen = (state) => state.stories.some((story) => story.type === 'coup' && story.status === 'open');
const readyToDemand = (state, faction, hooks) => faction.status === 'active' && quietOver(state, faction) && factionStrength(state, faction, hooks) >= ULTIMATUM_STRENGTH && !coupOpen(state);

function openUltimatum(state, faction, events, hooks) {
  const dueAt = addGameMonths(state.date, ULTIMATUM.months), description = ultimatumText(state, faction, hooks);
  const story = hooks.openStory({ type: 'faction_ultimatum', title: ULTIMATUM.title, description, actorId: faction.leaderId, createdAt: state.date, dueAt, knownBy: 'public', factionId: faction.id, deadlineText: ULTIMATUM.deadlineText });
  Object.assign(faction, { status: 'ultimatum', ultimatumAt: state.date, dueAt, storyId: story.id, knownMemberIds: withLeaderKnown(faction) });
  hooks.logEvent(events, 'faction_ultimatum', ULTIMATUM.event, description, [faction.leaderId, hooks.ruler().id, faction.claimantId]);
}

/** Yearly, after the demands: a faction forms, or the live one shifts, may lose a member to the spymaster, and comes out with an ultimatum once it is strong enough. A faction never surfaces in the year it forms. */
export function factionStep(state, events, hooks) {
  if (!hooks.canRule() || !hooks.adult(hooks.ruler()) || reignMonths(state) < GRACE_MONTHS) return;
  const [faction] = liveFactions(state);
  if (!faction) { formFaction(state, hooks); return; }
  if (faction.status === 'appeased' && quietOver(state, faction)) faction.status = 'active';
  shiftMembers(state, faction, hooks);
  settleFaction(state, faction, hooks);
  if (!isLive(faction)) return;
  discover(state, faction, events, hooks);
  if (readyToDemand(state, faction, hooks)) openUltimatum(state, faction, events, hooks);
}

/** Takes the dead, the imprisoned and the banished out of the live faction on the date it happens, and refills what they held. Draws nothing and writes no event. */
export function refreshFactions(state, events, hooks) {
  for (const faction of liveFactions(state)) {
    keepMembers(faction, (id) => !state.people[id].diedAt && isAtLarge(state, state.people[id]));
    settleFaction(state, faction, hooks);
  }
}

/** A faction is sworn against one ruler, so every change of reign ends it and its open ultimatum. An answer that crowns closes the faction first, so that story stays for its caller to resolve. */
export function voidFactions(state) {
  for (const faction of liveFactions(state)) {
    const story = ultimatumStory(state, faction);
    if (story?.status === 'open') Object.assign(story, { status: 'closed', resolvedAt: state.date, resolution: CLOSED.reign });
    closeFaction(state, faction, 'void');
  }
}

/** Why an open ultimatum fell away, or ''. The faction fell apart, since a change of reign has closed the story already. */
export function ultimatumClosedReason(state, story) {
  return factionOf(state, story).status === 'ultimatum' ? '' : CLOSED.dissolved;
}

function crushRows(state, faction, hooks) {
  const { base, readinessBase, readinessPer, legitimacyBase, legitimacyPer, strengthBase, strengthPer, dreadPer, dreadMax } = ODDS;
  return [
    { label: 'Grundchans', value: base },
    { label: 'Härens beredskap', value: Math.round((hooks.militaryReadiness() - readinessBase) / readinessPer) },
    { label: GENERAL_ROW, value: GENERAL_SERVICE[serviceTier(serviceOf(state, 'general', hooks))] },
    { label: 'Rikets legitimitet', value: Math.round((state.realm.legitimacy - legitimacyBase) / legitimacyPer) },
    { label: 'Faktionens styrka', value: -Math.round((factionStrength(state, faction, hooks) - strengthBase) / strengthPer) },
    { label: 'Rädsla för härskaren', value: Math.min(dreadMax, Math.floor(hooks.dreadOf() / dreadPer)) },
  ].filter((row) => row.value !== 0);
}

function crushPrecision(state, hooks) {
  if (serviceOf(state, 'general', hooks) === null) return 'three';
  return capPrecision(precisionFor(state.people[state.offices.general.holderId].skills.command), loyaltyPrecision(state, hooks));
}

/** The chance to crush the faction, 5 to 95. Reads only. `rows` add up to `value`, with the cut at a bound as a row of its own, and `display` is what the player may read of them. A band hides the general's row, which would read loyalty. */
export function crushOdds(state, faction, hooks) {
  const precision = crushPrecision(state, hooks);
  const { value, modifiers, display } = chanceFromRows(crushRows(state, faction, hooks), precision, GENERAL_ROW);
  return { value, precision, rows: modifiers, display };
}

function answerBar(state, hooks) {
  if (!hooks.canRule()) return NO_MANDATE;
  return state.actionPoints < ANSWER_ORDERS ? NO_ORDERS : '';
}

const concessionCost = (faction) => CONCESSION.silver + CONCESSION.perConcession * faction.concessions;

/** The three answers, as new objects. Reads only: the crush shows its odds and draws nothing until it is chosen. */
export function ultimatumChoices(state, story, hooks) {
  const faction = factionOf(state, story), { value, precision, display } = crushOdds(state, faction, hooks);
  const bar = answerBar(state, hooks), silver = concessionCost(faction), cost = '1 handling';
  const stress = (tag) => String(hooks.stressFor(hooks.activeRepresentative(), tag));
  return [
    { id: 'abdicate', label: `Abdikera till förmån för ${state.people[faction.claimantId].name}`, description: `Tronen går lagligt vidare. Riket tappar ${ABDICATION.legitimacyLoss} i legitimitet, till lägst ${ABDICATION.legitimacyFloor}, och ${-ABDICATION.prestige} i ryktbarhet.`, tag: 'surrender', cost, stress: stress('surrender'), disabledReason: state.offices.ruler.regentId ? NO_REGENT : bar },
    { id: 'concede', label: 'Ge efter för adeln', description: `Adeln väntar i ${CONCESSION.quietMonths} månader, men faktionen består. Riket tappar ${-CONCESSION.legitimacy} i legitimitet.`, cost: `${silver} silver ur statskassan och 1 handling`, stress: stress('duty'), disabledReason: bar || (state.realm.treasury < silver ? NO_FUNDS : '') },
    { id: 'crush', label: 'Slå ned faktionen', description: `Chans att lyckas: ${bandFor(value, precision)}`, tag: 'risky', odds: display, cost, stress: stress('risky'), disabledReason: bar },
  ];
}

function abdicate(state, faction, events, hooks) {
  hooks.charge(0, { publicFunds: true, orders: ANSWER_ORDERS, tag: 'surrender' });
  closeFaction(state, faction, 'abdicated');
  hooks.crown(state.people[faction.claimantId], events, ABDICATION.reason, Math.max(ABDICATION.legitimacyFloor, state.realm.legitimacy - ABDICATION.legitimacyLoss), true);
  addPrestige(state, ABDICATION.prestige);
}

function concede(state, faction, events, hooks) {
  hooks.charge(concessionCost(faction), { publicFunds: true, orders: ANSWER_ORDERS });
  moveLegitimacy(state, CONCESSION.legitimacy);
  Object.assign(faction, { status: 'appeased', concessions: faction.concessions + 1, quietUntil: addGameMonths(state.date, CONCESSION.quietMonths), dueAt: null });
}

// Puts a person in prison where imprisonPerson allows it. It refuses the ruler and whoever the player acts through.
function jailIfAllowed(state, person, captorFamilyId, events, hooks, lawful) {
  if (!imprisonRefusal(person.id, hooks)) imprisonPerson(state, person.id, captorFamilyId, events, hooks, { lawful });
}

// The crown holds. The public event names the leader alone, and the opinion rows name the rest.
function breakFaction(state, faction, events, hooks) {
  const ruler = hooks.ruler(), leader = state.people[faction.leaderId];
  closeInTheOpen(state, faction, 'crushed');
  jailIfAllowed(state, leader, ruler.familyId, events, hooks, true);
  cowNobles(state, CRUSHED.fear, hooks);
  for (const id of faction.memberIds) hooks.opinionCause(id, ruler.id, CRUSHED.opinion, CRUSHED.opinionLabel, faction.id);
  moveLegitimacy(state, CRUSHED.legitimacy);
  hooks.logEvent(events, 'faction_crushed', CRUSHED.title, `${ruler.name} slår ned faktionen som ${leader.name} ledde.`, [ruler.id, leader.id]);
}

// The opinion cause drops a head who is missing, and a head who is the new ruler.
function rewardHouses(state, faction, ruler, hooks) {
  for (const familyId of new Set(faction.memberIds.map((id) => state.people[id].familyId))) {
    const family = state.families[familyId];
    family.grievance = clamp(family.grievance + DEPOSITION.grievance, -40, 40);
    hooks.opinionCause(family.headId, ruler.id, DEPOSITION.opinion, DEPOSITION.opinionLabel, faction.id);
  }
}

// The expiry runs this with no player present, so nothing here reads a story or spends an order. The faction closes first, so that crown leaves its outcome alone.
function depose(state, faction, events, hooks, { confine = false } = {}) {
  const old = hooks.ruler(), claimant = state.people[faction.claimantId], leader = state.people[faction.leaderId], family = state.families[old.familyId];
  closeInTheOpen(state, faction, 'deposed');
  hooks.crown(claimant, events, DEPOSITION.reason, DEPOSITION.legitimacy, false);
  addPrestige(state, DEPOSITION.prestige);
  family.influence = Math.max(0, family.influence + DEPOSITION.influence);
  old.stress = clamp(old.stress + DEPOSITION.stress, 0, DEPOSITION.stressMax);
  rewardHouses(state, faction, claimant, hooks);
  if (leader.id !== claimant.id && state.offices.chancellor.holderId !== leader.id) hooks.assignOffice(state.offices.chancellor, leader, events, DEPOSITION.chancellorReason);
  hooks.logEvent(events, 'forced_abdication', DEPOSITION.title, `${leader.name} och adeln tvingar ${old.name} att lämna tronen till ${claimant.name}.`, [old.id, claimant.id, leader.id]);
  if (confine || old.familyId !== claimant.familyId) jailIfAllowed(state, old, claimant.familyId, events, hooks, false);
}

// The roll comes last: nothing is drawn unless the order could be paid.
function crush(state, faction, events, hooks) {
  const { value } = crushOdds(state, faction, hooks);
  hooks.charge(0, { publicFunds: true, orders: ANSWER_ORDERS, tag: 'risky' });
  if (actionRandom(state) * 100 < value) breakFaction(state, faction, events, hooks);
  else depose(state, faction, events, hooks, { confine: true });
}

const ANSWERS = Object.freeze({ abdicate, concede, crush, forced: depose });

/** Pays a choice or the expiry `forced`. The caller closes the story. */
export function resolveUltimatum(state, story, choiceId, events, hooks) {
  ANSWERS[choiceId](state, factionOf(state, story), events, hooks);
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

// A faction that ended keeps the record it ended with, so only a live one answers for its members, its target and the grace of its reign.
function validCourse(state, faction) {
  if (faction.status === 'closed') return OUTCOMES.includes(faction.outcome) && dateWithin(faction.closedAt, faction.formedAt, state.date) && (faction.claimantId === null || ownKey(state.people, faction.claimantId));
  if (faction.outcome !== null || faction.closedAt !== null || faction.memberIds.length < MIN_MEMBERS) return false;
  if (compareGameDates(addGameMonths(state.reign.startedAt, GRACE_MONTHS), faction.formedAt) > 0) return false;
  return faction.memberIds.includes(faction.leaderId) && ownKey(state.people, faction.claimantId) && faction.targetRulerId === state.reign.rulerId;
}

function standingUltimatum(state, faction) {
  const { ultimatumAt, dueAt, leaderId, knownMemberIds } = faction;
  if (ultimatumAt === null || dueAt === null || !knownMemberIds.includes(leaderId) || compareGameDates(ultimatumAt, dueAt) > 0) return false;
  const story = ultimatumStory(state, faction);
  return story?.status === 'open' && story.dueAt === dueAt;
}

const validTruce = ({ ultimatumAt, quietUntil, concessions }) => ultimatumAt !== null && quietUntil !== null && concessions >= 1 && compareGameDates(quietUntil, ultimatumAt) > 0;
const validEnd = ({ outcome, ultimatumAt, closedAt }) => !ANSWERED.includes(outcome) || (ultimatumAt !== null && compareGameDates(ultimatumAt, closedAt) <= 0);
// A faction that gave way and came back keeps the date of its ultimatum.
const validDark = ({ ultimatumAt, concessions }) => ultimatumAt === null || concessions >= 1;
const STAGE_CHECKS = Object.freeze({ active: (state, faction) => validDark(faction), ultimatum: standingUltimatum, appeased: (state, faction) => validTruce(faction), closed: (state, faction) => validEnd(faction) });

function validStage(state, faction) {
  const { status, formedAt, quietUntil, ultimatumAt, dueAt } = faction;
  if ((quietUntil !== null && !canonical(quietUntil)) || (dueAt !== null && !canonical(dueAt)) || (ultimatumAt !== null && !dateWithin(ultimatumAt, formedAt, state.date))) return false;
  return STAGE_CHECKS[status](state, faction) && ownStory(state, faction);
}

function validFaction(state, faction) {
  if (faction === null || typeof faction !== 'object' || Object.keys(faction).sort().join() !== FIELDS) return false;
  if (!(numberOf(faction.id) <= state.sequence) || !STATUSES.includes(faction.status) || !Number.isInteger(faction.concessions) || faction.concessions < 0) return false;
  if (!ownKey(state.people, faction.targetRulerId) || !ownKey(state.people, faction.leaderId) || !validMembers(state, faction)) return false;
  return canonical(faction.formedAt) && compareGameDates(faction.formedAt, state.date) <= 0 && validCourse(state, faction) && validStage(state, faction);
}

// An open ultimatum is the one its faction stands on.
function standsBehind(state, story) {
  const faction = factionOf(state, story);
  return faction.status === 'ultimatum' && faction.storyId === story.id;
}

/** Refuses forged faction records. Called from validateCourt when a save loads. */
export function validateFactions(state) {
  if (!state.factions.every((faction) => validFaction(state, faction))) throw new Error(INVALID);
  const ids = new Set(state.factions.map((faction) => faction.id));
  const told = state.stories.every((story) => story.type !== 'faction_ultimatum' || (ids.has(story.factionId) && (story.status !== 'open' || standsBehind(state, story))));
  if (ids.size !== state.factions.length || liveFactions(state).length > 1 || !told) throw new Error(INVALID);
}
