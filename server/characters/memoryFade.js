import { addGameMonths, compareGameDates } from '../gameDates.js';
import { CRISIS_MEMORY_MONTHS } from './breakdowns.js';
import { STORY_MEMORY_WINDOW } from './storyDirector.js';

/** Health memory types. A dead person keeps scars and the illness at death in healthConditions. */
export const FADING_MEMORY_TYPES = Object.freeze(['health_onset', 'health_recovering', 'health_treatment', 'health_resolved', 'health_scars', 'bereavement']);
const fading = new Set(FADING_MEMORY_TYPES);

// The ids in `ids` that some value in the state names outside the record that carries that id: a
// cause, an outcome, an action log entry, a regency's cause conditions.
function citedIds(state, ids) {
  const cited = new Set();
  const walk = (value, selfId) => {
    if (typeof value === 'string') { if (value !== selfId && ids.has(value)) cited.add(value); return; }
    if (!value || typeof value !== 'object') return;
    const own = !Array.isArray(value) && ids.has(value.id) ? value.id : selfId;
    for (const item of Array.isArray(value) ? value : Object.values(value)) walk(item, own);
  };
  walk(state, null);
  return cited;
}

const allDead = (state, memory) => Array.isArray(memory.participants) && memory.participants.length > 0
  && memory.participants.every((id) => !state.people[id] || state.people[id].diedAt);

// Each fade comes in two halves: `…Candidates` gives the ids it may remove, or null when it has nothing to
// remove, and `apply…` removes the candidates that `cited` does not hold and says whether it removed any.

function memoryCandidates(state) {
  const cut = state.memories.length - STORY_MEMORY_WINDOW;
  if (cut <= 0) return null;
  const ids = state.memories.slice(0, cut).filter((memory) => fading.has(memory?.type) && allDead(state, memory)).map((memory) => memory.id);
  return ids.length ? new Set(ids) : null;
}
function applyMemoryFade(state, ids, cited) {
  const kept = state.memories.filter((memory) => !ids.has(memory?.id) || cited.has(memory.id));
  if (kept.length === state.memories.length) return false;
  state.memories = kept;
  return true;
}

/**
 * Removes health memories older than the story director's window whose participants have all died and
 * that no other value in the state cites. The director reads the newest STORY_MEMORY_WINDOW memories,
 * so it sees the same ones before and after. Draws nothing.
 * Spec: docs/superpowers/specs/2026-11-08-memory-fade-design.md.
 */
export function fadeMemories(state) { runFade(state, memoryCandidates, applyMemoryFade); }

const deadWithConditions = (state) => Object.values(state.people).filter((person) => person.diedAt && Array.isArray(person.healthConditions));
function conditionCandidates(state) {
  const ids = deadWithConditions(state).flatMap((person) => person.healthConditions.filter((item) => item?.stage === 'resolved' && typeof item.id === 'string').map((item) => item.id));
  return ids.length ? new Set(ids) : null;
}
function applyConditionFade(state, ids, cited) {
  let removed = false;
  for (const person of deadWithConditions(state)) {
    const kept = person.healthConditions.filter((item) => !ids.has(item?.id) || cited.has(item.id));
    if (kept.length < person.healthConditions.length) { person.healthConditions = kept; removed = true; }
  }
  return removed;
}

/**
 * Removes the resolved conditions of dead persons that no other value in the state names. Scars and the
 * illness at death stay; a portrait shows nothing for a resolved condition and the health rules read only
 * the living. Draws nothing. Spec: docs/superpowers/specs/2026-11-08-condition-fade-design.md.
 */
export function fadeDeadConditions(state) { runFade(state, conditionCandidates, applyConditionFade); }

const deadPairs = (state) => {
  const gone = (id) => !state.people[id] || Boolean(state.people[id].diedAt);
  return Object.entries(state.relations).filter(([, rel]) => rel && gone(rel.fromId) && gone(rel.toId));
};
const causeIds = (rel) => (Array.isArray(rel.causes) ? rel.causes : []).map((item) => item?.id).filter((id) => typeof id === 'string');
function relationCandidates(state) {
  const pairs = deadPairs(state);
  return pairs.length ? new Set(pairs.flatMap(([, rel]) => causeIds(rel))) : null;
}
function applyRelationFade(state, ids, cited) {
  const adjustable = new Set((Array.isArray(state.actionLog) ? state.actionLog : []).flatMap((entry) => (Array.isArray(entry?.effects) ? entry.effects : [])
    .filter((effect) => effect?.kind === 'opinion').map((effect) => `${effect.fromId}:${effect.toId}`)));
  let removed = false;
  for (const [key, rel] of deadPairs(state)) {
    if (!adjustable.has(`${rel.fromId}:${rel.toId}`) && !causeIds(rel).some((id) => cited.has(id))) { delete state.relations[key]; removed = true; }
  }
  return removed;
}

/**
 * Removes the personal relations between two persons who have both died, unless an action log opinion
 * effect names the pair (adjustEffect in actionResolution.js finds its cause there) or another value in
 * the state names one of its causes. Opinions are read only for the living. Draws nothing.
 * Spec: docs/superpowers/specs/2026-11-08-relation-fade-design.md.
 */
export function fadeDeadRelations(state) { runFade(state, relationCandidates, applyRelationFade); }

// Only the living decide, and the panel shows the representative's decision alone, so the dead keep
// none. The key stays as null, the shape the seed gives a person who has not decided.
export function fadeDeadDecisions(state) {
  for (const person of Object.values(state.people)) {
    if (person?.diedAt && person.lastDecision != null) person.lastDecision = null;
  }
}

const SETTLED = new Set(['resolved', 'closed']);
function storyCandidates(state) {
  if (!Array.isArray(state.stories) || !Array.isArray(state.memories)) return null;
  const cutoff = addGameMonths(state.date, -CRISIS_MEMORY_MONTHS);
  const window = new Set(state.memories.slice(-STORY_MEMORY_WINDOW).map((memory) => memory?.id));
  const ids = state.stories.filter((story) => SETTLED.has(story?.status) && typeof story.id === 'string'
    && compareGameDates(story.createdAt, cutoff) < 0 && !(story.causeId && window.has(story.causeId))).map((story) => story.id);
  return ids.length ? new Set(ids) : null;
}
function applyStoryFade(state, ids, cited) {
  const kept = state.stories.filter((story) => !ids.has(story?.id) || cited.has(story.id));
  if (kept.length === state.stories.length) return false;
  state.stories = kept;
  return true;
}

/**
 * Removes resolved and closed stories created more than CRISIS_MEMORY_MONTHS ago whose cause is outside the
 * story director's memory window and whose id no other value in the state names. No view lists a settled
 * story, the breakdown rule reads crises inside CRISIS_MEMORY_MONTHS, and the director reads causes inside
 * its window. Draws nothing. Spec: docs/superpowers/specs/2026-11-09-story-fade-design.md.
 */
export function fadeSettledStories(state) { runFade(state, storyCandidates, applyStoryFade); }

function runFade(state, candidates, apply) {
  const ids = candidates(state);
  if (ids) apply(state, ids, citedIds(state, ids));
}

const FADES = Object.freeze([[memoryCandidates, applyMemoryFade], [conditionCandidates, applyConditionFade], [relationCandidates, applyRelationFade], [storyCandidates, applyStoryFade]]);

/**
 * Runs every fade until a round removes nothing, with one walk of the state per round for all of them.
 * One fade can free what another keeps (a faded story no longer names a condition), so a single pass
 * would leave a long jump and monthly stepping with different states. Every fade only removes, so the
 * rounds end. Draws nothing.
 */
export function fadeAll(state) {
  fadeDeadDecisions(state);
  for (;;) {
    const plans = FADES.map(([candidates, apply]) => ({ ids: candidates(state), apply })).filter((plan) => plan.ids);
    if (!plans.length) return;
    const cited = citedIds(state, new Set(plans.flatMap((plan) => [...plan.ids])));
    let removed = false;
    for (const plan of plans) removed = plan.apply(state, plan.ids, cited) || removed;
    if (!removed) return;
  }
}
