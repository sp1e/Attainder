import { addGameMonths } from '../gameDates.js';
import { ACTION_CATALOG } from './actionCatalog.js';
import { bondBetween } from './bonds.js';
import { estimateAction } from './actionOdds.js';
import { resolveAttempt } from './actionResolution.js';
import { CRIME_LABELS, exposeCrime } from './crimes.js';
import { normalizeDifficulty, plotRandom } from './extensions.js';
import { imprisonPerson, isImprisoned } from './prisoners.js';
import { activeHooks, addSecretHolders, createSecret, exposeSecret, grantHook, strengthenSecret } from './secrets.js';

// NPC plots: once a year, people outside the controlled family plot against the throne and against each other, and unfaithful spouses leave an affair secret behind. The yearly step draws only from the plot stream (plotRandom); the schemes it starts draw from the action stream like any other scheme.
// Draw order inside one step: the plot against the player (one draw when a candidate qualifies), the feud between two NPCs (one draw when a pair qualifies), then one draw per unfaithful spouse in id order. No check is drawn before everything else that could stop the plot has been checked, so a plot that cannot start costs no draw.
// actionResolution.js imports schemes.js, which imports this file, so nothing at the top level may use the exports of actionResolution.js; they are only used inside functions.

// How much more or less often the court plots by difficulty.
export const AGGRESSION = Object.freeze({ easy: 0.5, normal: 1, hard: 1.5 });
// Plot against the player: score = −opinion(candidate → target) + 15 × ambitious + 15 × vengeful + intrigue − fear × 0.4 (cautious or craven) or 0.15 (anyone else), the fear weights of evaluateCharacterDecision. The best candidate plots at a score of 20 or more, with chance clamp(score / 2, 0, 40) percent × aggression, and poisons at 60 or more.
const MIN_SCORE = 20;
const POISON_SCORE = 60;
const CHANCE_CAP = 40;
const TRAIT_BONUS = 15;
const TIMID_FEAR = 0.4;
const BOLD_FEAR = 0.15;
// Feud between two NPCs: the pair with the lowest mutual opinion (the average of the two opinions) below −10 starts an undermine with chance 0.2. At most two feuds are active.
const FEUD_OPINION = -10;
const FEUD_CHANCE = 0.2;
const MAX_FEUDS = 2;
// A married NPC who thinks no better of the spouse than 0 starts an affair with chance 0.08 a year.
const AFFAIR_CHANCE = 0.08;
const STORY_MONTHS = 12;
const NO_RULER = 'Bara härskaren kan fängsla.';
const MESSAGES = Object.freeze({
  gone: 'Komplotten kan inte längre mötas på det här sättet.',
  exposed: 'Komplotten är redan avslöjad.',
  nobody: 'Det finns ingen företrädare som kan använda greppet.',
  hooked: 'Du har redan ett grepp över personen.',
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const hasTrait = (person, trait) => Array.isArray(person.traits) && person.traits.includes(trait);
const treasuryOf = (state, person) => finite(state.families[person.familyId]?.treasury);
const costOf = (actionId) => ACTION_CATALOG[actionId].cost.silver;
const isNpcScheme = (scheme) => scheme.status === 'active' && scheme.playerControlled === false;

// Living adults who can act and are not in prison, sorted by id. `outside` leaves out the controlled family. The plot against the player also leaves out exiled families (`abroad`).
function actors(state, hooks, { abroad }) {
  const controlled = hooks.controlledFamily()?.id ?? null;
  return Object.values(state.people)
    .filter((person) => !person.diedAt && hooks.adult(person) && person.familyId !== controlled && !isImprisoned(state, person.id) && hooks.canExerciseMandate(person)
      && (!abroad || state.families[person.familyId]?.exiled !== true))
    .sort(byId);
}

// The person an NPC plot against the player aims at: the ruler in realm mode, the representative in family mode. Always a member of the controlled family.
function crownTarget(state, hooks) {
  const target = state.identity.mode === 'family' ? hooks.activeRepresentative() : hooks.ruler();
  return target && !target.diedAt && target.familyId === hooks.controlledFamily()?.id ? target : null;
}

export function plotScore(person, opinion) {
  const fearWeight = hasTrait(person, 'cautious') || hasTrait(person, 'craven') ? TIMID_FEAR : BOLD_FEAR;
  return -opinion + (hasTrait(person, 'ambitious') ? TRAIT_BONUS : 0) + (hasTrait(person, 'vengeful') ? TRAIT_BONUS : 0) + finite(person.skills?.intrigue) - finite(person.fear) * fearWeight;
}

// Starts the scheme through the engine's own gate, with the NPC's context (no order, paid by the plotter's family). The plotter's plot secret (subject and only holder the plotter) is what a discovery later turns into evidence.
function launch(state, hooks, events, { actor, target, actionId }, order) {
  const intent = { actionId, actorId: actor.id, targetIds: [target.id], means: {} };
  const scheme = resolveAttempt(state, { id: `npc-plot:${state.date}:${order}`, payload: intent }, events, { ...hooks, estimateContext: () => hooks.npcEstimateContext(actor.id) });
  scheme.secretId = createSecret(state, { type: 'plot', subjectId: actor.id, holderIds: [actor.id], evidence: 'weak' }).id;
  return scheme;
}

const canStart = (state, hooks, actionId, actor, target) => estimateAction(state, { actionId, actorId: actor.id, targetIds: [target.id], means: {} }, hooks.npcEstimateContext(actor.id)).ok;

function plotAgainstPlayer(state, hooks, events, order) {
  const controlled = hooks.controlledFamily()?.id ?? null;
  const target = crownTarget(state, hooks);
  if (!target || state.schemes.some((scheme) => isNpcScheme(scheme) && state.people[scheme.actorId]?.familyId !== controlled && state.people[scheme.targetIds[0]]?.familyId === controlled)) return null;
  let best = null;
  for (const person of actors(state, hooks, { abroad: true })) {
    if (treasuryOf(state, person) < costOf('undermine')) continue;
    const score = plotScore(person, hooks.getPersonalOpinion(person.id, target.id));
    if (!best || score > best.score) best = { actor: person, score };
  }
  if (!best || best.score < MIN_SCORE) return null;
  const actionId = best.score >= POISON_SCORE ? 'poison' : 'undermine';
  if (!canStart(state, hooks, actionId, best.actor, target)) return null;
  const chance = clamp(best.score / 2, 0, CHANCE_CAP) * AGGRESSION[normalizeDifficulty(state.difficulty)];
  if (!(plotRandom(state) * 100 < chance)) return null;
  return launch(state, hooks, events, { actor: best.actor, target, actionId }, order);
}

// Two NPCs of different families that think worst of each other. A rival pair comes before every other pair and needs no feud opinion. The one with the lower opinion plots (the earlier id on a tie); a pair is skipped when its plotter cannot pay or already plots against the same person.
function worstFeud(state, hooks) {
  const people = actors(state, hooks, { abroad: false });
  let worst = null;
  for (const [index, a] of people.entries()) {
    for (const b of people.slice(index + 1)) {
      if (a.familyId === b.familyId) continue;
      const aThinks = hooks.getPersonalOpinion(a.id, b.id), bThinks = hooks.getPersonalOpinion(b.id, a.id);
      const mutual = (aThinks + bThinks) / 2, rival = bondBetween(state, a.id, b.id) === 'rival';
      if ((!rival && mutual >= FEUD_OPINION) || (worst && (worst.rival > rival || (worst.rival === rival && mutual >= worst.mutual)))) continue;
      const [actor, target] = aThinks <= bThinks ? [a, b] : [b, a];
      const busy = state.schemes.some((scheme) => isNpcScheme(scheme) && scheme.actorId === actor.id && scheme.targetIds[0] === target.id);
      if (!busy && treasuryOf(state, actor) >= costOf('undermine')) worst = { actor, target, mutual, rival };
    }
  }
  return worst && { actor: worst.actor, target: worst.target, mutual: worst.mutual };
}

function feud(state, hooks, events, order) {
  const controlled = hooks.controlledFamily()?.id ?? null;
  const active = state.schemes.filter((scheme) => isNpcScheme(scheme) && state.people[scheme.actorId]?.familyId !== controlled && state.people[scheme.targetIds[0]]?.familyId !== controlled);
  if (active.length >= MAX_FEUDS) return null;
  const pair = worstFeud(state, hooks);
  if (!pair || !canStart(state, hooks, 'undermine', pair.actor, pair.target)) return null;
  if (!(plotRandom(state) < FEUD_CHANCE)) return null;
  return launch(state, hooks, events, { ...pair, actionId: 'undermine' }, order);
}

// An unfaithful NPC spouse leaves a weak affair secret that only the spouse in question knows about. It feeds investigate and blackmail.
function affairs(state, hooks) {
  const controlled = hooks.controlledFamily()?.id ?? null;
  const people = Object.values(state.people).filter((person) => !person.diedAt && hooks.adult(person) && person.familyId !== controlled).sort(byId);
  for (const person of people) {
    const spouse = typeof person.spouseId === 'string' && Object.hasOwn(state.people, person.spouseId) ? state.people[person.spouseId] : null;
    if (!spouse || spouse.diedAt || hooks.getPersonalOpinion(person.id, spouse.id) > 0) continue;
    if (state.secrets.some((secret) => secret.type === 'affair' && secret.subjectId === person.id && !secret.exposed)) continue;
    if (plotRandom(state) < AFFAIR_CHANCE) createSecret(state, { type: 'affair', subjectId: person.id, holderIds: [person.id], evidence: 'weak' });
  }
}

/**
 * The yearly NPC intrigue step, called in annualStep after aiAnnual and prisonerStep. Starts at most one scheme against the controlled family's throne (poison from a score of 60, else undermine), at most one feud between two other houses (with at most two active) and may add affair secrets. Each scheme goes through resolveAttempt with the NPC context and carries the plotter's plot secret as `secretId`. Draws only plotRandom here; the schemes draw actionRandom later, as any scheme does. `hooks` is actionHooks(state).
 */
export function npcPlotStep(state, events, hooks) {
  if (state.status?.ended) return;
  let started = 0;
  if (plotAgainstPlayer(state, hooks, events, started + 1)) started += 1;
  if (feud(state, hooks, events, started + 1)) started += 1;
  affairs(state, hooks);
}

/**
 * Called when a scheme is discovered. A plot of an NPC outside the controlled family against a member of it makes its secret known to the target and the representative with strong evidence and opens the story plot_uncovered. A scheme without a plot secret (one an NPC started through npc_intent) first gets a weak plot secret about the actor, held by him, as npcPlotStep gives its own plots. Anything else (the player's own schemes, plots against other houses) does nothing. Draws no randomness. Returns the story or null. `memory` is the discovery memory.
 */
export function uncoverPlot(state, scheme, memory, hooks) {
  const controlled = hooks.controlledFamily()?.id ?? null;
  const actor = state.people[scheme.actorId], target = state.people[scheme.targetIds[0]];
  if (scheme.playerControlled !== false || !controlled || target.familyId !== controlled || actor.familyId === controlled) return null;
  if (typeof scheme.secretId !== 'string') scheme.secretId = createSecret(state, { type: 'plot', subjectId: actor.id, holderIds: [actor.id], evidence: 'weak' }).id;
  const representative = hooks.activeRepresentative();
  addSecretHolders(state, scheme.secretId, [target.id, representative?.id].filter(Boolean));
  strengthenSecret(state, scheme.secretId);
  const label = ACTION_CATALOG[scheme.actionId].label.toLowerCase();
  return hooks.openStory({ type: 'plot_uncovered', title: `Komplott avslöjad: ${actor.name}`, description: `${actor.name} ligger bakom en plan (${label}) mot ${target.name}. Du avgör hur komplotten ska mötas.`,
    actorId: actor.id, targetId: target.id, familyId: actor.familyId, createdAt: state.date, dueAt: addGameMonths(state.date, STORY_MONTHS), knownBy: 'public',
    schemeId: scheme.id, secretId: scheme.secretId, plotAction: scheme.actionId, targetWasRuler: target.id === hooks.ruler()?.id, causeId: memory.id });
}

// Why the representative cannot take a hook over the plotter: there is no representative, or he already holds an active hook over him.
function hookRefusal(state, story, hooks) {
  const representative = hooks.activeRepresentative();
  if (!representative) return MESSAGES.nobody;
  return activeHooks(state, representative.id, story.actorId).length ? MESSAGES.hooked : '';
}

// targetWasRuler is fixed when the plot is uncovered, so a ruler who dies before the choice does not change the charge.
const crimeFor = (story) => (story.targetWasRuler === true ? 'treason' : story.plotAction === 'poison' ? 'attempted_murder' : null);

/** The four answers to an uncovered plot. `imprison` is open to a representative who is the ruler; `expose` and `hook` need a plot that is not already public, and `hook` a representative who holds no active hook over the plotter yet. */
export function plotUncoveredChoices(state, story, hooks) {
  const secret = state.secrets.find((item) => item.id === story.secretId);
  const plotter = state.people[story.actorId];
  const ruler = hooks.ruler();
  const rulerOnly = ruler && hooks.activeRepresentative()?.id === ruler.id ? '' : NO_RULER;
  const gone = !plotter || plotter.diedAt || !secret ? MESSAGES.gone : '';
  const out = gone || (secret.exposed ? MESSAGES.exposed : '');
  const name = plotter?.name ?? 'Komplottmakaren';
  const crime = crimeFor(story);
  return [
    { id: 'imprison', label: 'Fängsla komplottmakaren', description: `${name} förs i fängelse efter ett lagligt beslut. Ingen legitimitet går förlorad.`, cost: '0 silver', stress: '0', disabledReason: gone || rulerOnly || (isImprisoned(state, story.actorId) ? 'Personen sitter redan fängslad.' : '') },
    { id: 'expose', label: 'Avslöja komplotten', description: crime ? `Planen görs offentlig som ${CRIME_LABELS[crime].toLowerCase()}. Offrets släkt vänder sig mot ${name}.` : 'Planen görs offentlig.', cost: '0 silver', stress: '0', disabledReason: out },
    { id: 'hook', label: 'Behåll kunskapen som grepp', description: `Du får ett starkt grepp över ${name} som kan användas i en senare handling.`, cost: '0 silver', stress: '0', disabledReason: gone || hookRefusal(state, story, hooks) },
    { id: 'ignore', label: 'Låt det vara', description: 'Inget görs. Komplotten är känd men förblir en hemlighet.', cost: '0 silver', stress: '0', disabledReason: '' },
  ];
}

/** Applies the chosen answer to a plot_uncovered story. `imprison`: lawful imprisonment by the ruler's family; `expose`: treason when the target is the ruler, attempted murder for a poisoning, else the secret goes public; `hook`: the representative gets a strong hook over the plotter; `ignore`: nothing. Draws no randomness. */
export function resolvePlotUncovered(state, story, choiceId, hooks, events = []) {
  if (choiceId === 'imprison') imprisonPerson(state, story.actorId, hooks.ruler().familyId, events, hooks, { lawful: true });
  else if (choiceId === 'expose') {
    const crime = crimeFor(story);
    if (crime) exposeCrime(state, { secretId: story.secretId, crime, victimId: story.targetId }, events, hooks);
    else exposeSecret(state, story.secretId);
  } else if (choiceId === 'hook') grantHook(state, { ownerId: hooks.activeRepresentative().id, targetId: story.actorId, strength: 'strong', causeId: story.causeId });
}
