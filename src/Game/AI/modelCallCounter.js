// Session-only count of model calls by kind ('year', 'interpret', 'narrate'). Nothing is stored in the save.
const counts = new Map();
const listeners = new Set();
let total = 0;

export function recordModelCall(kind = 'year') {
  total += 1;
  counts.set(kind, (counts.get(kind) || 0) + 1);
  const snapshot = getModelCallCounts();
  for (const listener of [...listeners]) listener(snapshot);
}

export function getModelCallCounts() {
  return { total, byKind: Object.fromEntries(counts) };
}

export function subscribeModelCalls(listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
