import { addGameMonths, compareGameDates } from '../gameDates.js';
import { precisionFor } from './actionOdds.js';
import { getCharacterAge } from './characterCapacity.js';
import { staffOf } from './courtStaff.js';
import { ageDeathRisk, conditionFatalRisk } from './health.js';
import { exposeSecret } from './secrets.js';

// The physician's prognosis and the deathbed (spec docs/superpowers/specs/2026-11-09-deathbed-design.md). Nothing here draws from a random stream.
export const DEATHBED_RISK = 0.12;
const DUE_MONTHS = 6, QUIET_MONTHS = 60, BEQUEST_MAX = 30, ENEMY_AT = -20, CONFESS_STRESS = 30;
const PEACE = Object.freeze({ value: 15, years: 10, label: 'Försoning vid dödsbädden' });
const CONFESSABLE = Object.freeze(['affair', 'heresy', 'illegitimate_child']);
const CLOSED = Object.freeze({ dead: 'Personens liv har avslutats.', replaced: 'Personen företräder inte längre familjen eller riket.' });
const REFUSED = Object.freeze({ child: 'Det finns inget levande barn att testamentera till.', poor: 'Den egna förmögenheten räcker inte till ett testamente.', enemy: 'Ingen vid hovet hatar dig nog för en försoning.', secret: 'Det finns ingen hemlighet att bekänna.' });
const FIVE = Object.freeze([[4, 'under 5 %'], [10, '5–10 %'], [20, '10–20 %'], [35, '20–35 %'], [Infinity, 'över 35 %']]);
const THREE = Object.freeze([[10, 'liten'], [25, 'påtaglig'], [Infinity, 'stor']]);

/** The choice-free end of a deathbed, for the dispatch table in court.js. */
export const DEATHBED_EXPIRY = Object.freeze({ choiceId: 'rest', text: 'Ingen valde i tid. Dagarna gick utan ett sista beslut.' });

const byId = (a, b) => a.id.localeCompare(b.id);
const activeAt = (cause, date) => !cause.expiresAt || compareGameDates(cause.expiresAt, date) > 0;

/** The chance the person dies within a year: the age band and health of annualStep, plus the fatal risk of each active illness under its care. At most 1. */
export function deathRisk(state, person) {
  const illness = (person.healthConditions || []).filter((condition) => condition.stage === 'active' && condition.kind !== 'bereavement').reduce((sum, condition) => sum + conditionFatalRisk(person, condition), 0);
  return Math.min(1, ageDeathRisk(getCharacterAge(person, state.date), person.health) + illness);
}

/** What the physician of the person's household says of the risk: exact, five brackets or three words, by the physician's learning (0 without one). */
export function prognosis(state, person) {
  const physician = staffOf(state, person.familyId).find((staff) => staff.role === 'physician');
  const percent = Math.round(deathRisk(state, person) * 100);
  const precision = precisionFor(physician?.skills?.learning ?? 0);
  if (precision === 'exact') return `${percent} %`;
  return (precision === 'five' ? FIVE : THREE).find(([max]) => percent <= max)[1];
}

/** In courtAnnualStep: the active representative at a risk of DEATHBED_RISK or more gets a deathbed, unless one is open or the same person had one in the last five years. */
export function deathbedStep(state, events, hooks) {
  const actor = hooks.activeRepresentative();
  if (!actor || actor.diedAt || deathRisk(state, actor) < DEATHBED_RISK) return;
  const recent = (story) => story.type === 'deathbed' && (story.status === 'open' || (story.actorId === actor.id && compareGameDates(addGameMonths(story.createdAt, QUIET_MONTHS), state.date) > 0));
  if (state.stories.some(recent)) return;
  const description = `Läkaren bedömer risken att ${actor.name} dör inom ett år som ${prognosis(state, actor)}. Det finns tid för ett sista beslut.`;
  // The id names the person and the day, at most one per five years, so the story takes nothing from state.sequence.
  const story = { id: `deathbed-${actor.id}-${state.date}`, type: 'deathbed', status: 'open', title: `${actor.name} känner sina dagar räknade`, description, actorId: actor.id, createdAt: state.date, dueAt: addGameMonths(state.date, DUE_MONTHS), knownBy: 'public' };
  state.stories.push(story);
  deathbedLog(state, events, `${story.id}-opened`, 'deathbed', 'Läkaren varnar', `${actor.name} väntas inte leva länge till.`, [actor.id]);
}

/** Writes a log line under an id of its own. A deathbed nobody answers then leaves state.sequence, and every later person and event id, as main has them. */
export function deathbedLog(state, events, id, type, title, description, participants) {
  const event = { id, date: state.date, type, title, description, participants: participants.filter(Boolean), public: true };
  state.log.push(event);
  events.push(event);
}

const childrenOf = (state, person) => Object.values(state.people).filter((child) => !child.diedAt && (child.legalParentIds || []).includes(person.id));
// The youngest living legal child, the later id on a shared birth date.
const youngestChild = (state, person) => childrenOf(state, person).sort((a, b) => compareGameDates(b.bornAt, a.bornAt) || byId(b, a))[0] ?? null;
// The living adult with the lowest opinion of the person, at ENEMY_AT or lower; the earlier id on a tie.
function worstEnemy(state, person, hooks) {
  const scored = Object.values(state.people).filter((other) => !other.diedAt && other.id !== person.id && hooks.adult(other)).map((other) => ({ other, opinion: hooks.getPersonalOpinion(other.id, person.id) }));
  const enemy = scored.filter((item) => item.opinion <= ENEMY_AT).sort((a, b) => a.opinion - b.opinion || byId(a.other, b.other))[0];
  return enemy?.other ?? null;
}
const confessable = (state, person) => state.secrets.find((secret) => !secret.exposed && CONFESSABLE.includes(secret.type) && (secret.type === 'illegitimate_child' ? secret.holderIds[0] === person.id : secret.subjectId === person.id)) ?? null;

/** The four choices, with a Swedish reason on each that cannot apply. */
export function deathbedChoices(state, story, hooks) {
  const actor = state.people[story.actorId], child = youngestChild(state, actor), enemy = worstEnemy(state, actor, hooks), amount = Math.min(BEQUEST_MAX, Math.floor(actor.wealth));
  return [
    { id: 'bequest', label: child ? `Testamentera silver till ${child.name}` : 'Testamentera silver', description: `${Math.max(0, amount)} silver ur den egna förmögenheten går till det yngsta barnet.`, cost: `${Math.max(0, amount)} silver`, stress: '0', disabledReason: !child ? REFUSED.child : amount < 1 ? REFUSED.poor : '' },
    { id: 'reconcile', label: enemy ? `Försonas med ${enemy.name}` : 'Försonas med en fiende', description: 'Agget mellan er upphör åt båda hållen, och fienden ser mildare på dina barn.', cost: '0 silver', stress: '0', disabledReason: enemy ? '' : REFUSED.enemy },
    { id: 'confess', label: 'Bekänn en hemlighet', description: 'Den äldsta egna hemligheten blir känd, och samvetet lättar.', cost: '0 silver', stress: `−${CONFESS_STRESS}`, disabledReason: confessable(state, actor) ? '' : REFUSED.secret },
    { id: 'rest', label: 'Låt dagarna gå', description: 'Inget görs.', cost: '0 silver', stress: '0', disabledReason: '' },
  ];
}

function reconcile(state, actor, story, hooks) {
  const enemy = worstEnemy(state, actor, hooks);
  for (const key of [`${enemy.id}:${actor.id}`, `${actor.id}:${enemy.id}`]) for (const cause of state.relations[key]?.causes || []) if (cause.amount < 0 && activeAt(cause, state.date)) cause.expiresAt = state.date;
  for (const child of childrenOf(state, actor).filter((item) => hooks.adult(item) && item.id !== enemy.id).sort(byId)) hooks.opinionCause(enemy.id, child.id, PEACE.value, PEACE.label, `deathbed:${story.id}`, PEACE.years);
}

/** Applies a choice resolveStory has already checked, or the expiry `rest`. */
export function resolveDeathbed(state, story, choiceId, events, hooks) {
  const actor = state.people[story.actorId];
  if (choiceId === 'bequest') { const child = youngestChild(state, actor), amount = Math.min(BEQUEST_MAX, Math.floor(actor.wealth)); actor.wealth -= amount; child.wealth += amount; deathbedLog(state, events, `${story.id}-bequest`, 'bequest', 'Ett testamente', `${actor.name} testamenterar ${amount} silver till ${child.name}.`, [actor.id, child.id]); }
  if (choiceId === 'reconcile') reconcile(state, actor, story, hooks);
  if (choiceId === 'confess') { exposeSecret(state, confessable(state, actor).id); actor.stress = Math.max(0, actor.stress - CONFESS_STRESS); deathbedLog(state, events, `${story.id}-confession`, 'confession', 'En bekännelse', `${actor.name} bekänner en hemlighet inför hovet.`, [actor.id]); }
}

/** Why an open deathbed no longer stands, or '' while it does. Such a story closes with no effect. */
export function deathbedClosedReason(state, story, hooks) {
  const actor = state.people[story.actorId];
  if (!actor || actor.diedAt) return CLOSED.dead;
  return hooks.activeRepresentative()?.id === actor.id ? '' : CLOSED.replaced;
}
