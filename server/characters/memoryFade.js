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

/**
 * Removes health memories older than the story director's window whose participants have all died and
 * that no other value in the state cites. The director reads the newest STORY_MEMORY_WINDOW memories,
 * so it sees the same ones before and after. Draws nothing.
 * Spec: docs/superpowers/specs/2026-11-08-memory-fade-design.md.
 */
export function fadeMemories(state) {
  const cut = state.memories.length - STORY_MEMORY_WINDOW;
  if (cut <= 0) return;
  const old = state.memories.slice(0, cut);
  if (!old.some((memory) => fading.has(memory?.type) && allDead(state, memory))) return;
  const cited = citedIds(state, new Set(old.map((memory) => memory?.id)));
  const kept = old.filter((memory) => !fading.has(memory?.type) || !allDead(state, memory) || cited.has(memory.id));
  if (kept.length < old.length) state.memories = [...kept, ...state.memories.slice(cut)];
}

/**
 * Removes the resolved conditions of dead persons that no other value in the state names. Scars and the
 * illness at death stay; a portrait shows nothing for a resolved condition and the health rules read only
 * the living. Draws nothing. Spec: docs/superpowers/specs/2026-11-08-condition-fade-design.md.
 */
export function fadeDeadConditions(state) {
  const dead = Object.values(state.people).filter((person) => person.diedAt && Array.isArray(person.healthConditions));
  const candidates = new Set(dead.flatMap((person) => person.healthConditions.filter((item) => item?.stage === 'resolved' && typeof item.id === 'string').map((item) => item.id)));
  if (!candidates.size) return;
  const cited = citedIds(state, candidates);
  for (const person of dead) {
    const kept = person.healthConditions.filter((item) => !candidates.has(item?.id) || cited.has(item.id));
    if (kept.length < person.healthConditions.length) person.healthConditions = kept;
  }
}

/**
 * Removes the personal relations between two persons who have both died, unless an action log opinion
 * effect names the pair (adjustEffect in actionResolution.js finds its cause there) or another value in
 * the state names one of its causes. Opinions are read only for the living. Draws nothing.
 * Spec: docs/superpowers/specs/2026-11-08-relation-fade-design.md.
 */
export function fadeDeadRelations(state) {
  const gone = (id) => !state.people[id] || Boolean(state.people[id].diedAt);
  const candidates = Object.entries(state.relations).filter(([, rel]) => rel && gone(rel.fromId) && gone(rel.toId));
  if (!candidates.length) return;
  const adjustable = new Set((Array.isArray(state.actionLog) ? state.actionLog : []).flatMap((entry) => (Array.isArray(entry?.effects) ? entry.effects : [])
    .filter((effect) => effect?.kind === 'opinion').map((effect) => `${effect.fromId}:${effect.toId}`)));
  const causeIds = (rel) => (Array.isArray(rel.causes) ? rel.causes : []).map((item) => item?.id).filter((id) => typeof id === 'string');
  const cited = citedIds(state, new Set(candidates.flatMap(([, rel]) => causeIds(rel))));
  for (const [key, rel] of candidates) {
    if (!adjustable.has(`${rel.fromId}:${rel.toId}`) && !causeIds(rel).some((id) => cited.has(id))) delete state.relations[key];
  }
}
