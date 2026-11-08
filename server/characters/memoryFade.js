import { STORY_MEMORY_WINDOW } from './storyDirector.js';

/** Health memory types. A dead person keeps the condition itself in healthConditions. */
export const FADING_MEMORY_TYPES = Object.freeze(['health_onset', 'health_recovering', 'health_treatment', 'health_resolved', 'health_scars', 'bereavement']);
const fading = new Set(FADING_MEMORY_TYPES);

// Every memory id that some value outside that memory names: a cause, an outcome, an action log entry.
function citedMemoryIds(state) {
  const ids = new Set(state.memories.map((memory) => memory?.id)), cited = new Set();
  const walk = (value, selfId) => {
    if (typeof value === 'string') { if (value !== selfId && ids.has(value)) cited.add(value); }
    else if (Array.isArray(value)) for (const item of value) walk(item, selfId);
    else if (value && typeof value === 'object') for (const item of Object.values(value)) walk(item, selfId);
  };
  for (const [key, value] of Object.entries(state)) if (key !== 'memories') walk(value, null);
  for (const memory of state.memories) walk(memory, memory?.id);
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
  const cited = citedMemoryIds(state);
  const kept = old.filter((memory) => !fading.has(memory?.type) || !allDead(state, memory) || cited.has(memory.id));
  if (kept.length < old.length) state.memories = [...kept, ...state.memories.slice(cut)];
}
