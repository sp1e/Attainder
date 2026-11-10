import { hashRoll } from './duels.js';
import { createSecret, setRelationship } from './secrets.js';
import { exposeCrime } from './crimes.js';

// What happens at the table (spec docs/superpowers/specs/2026-11-10-feast-outcomes-design.md). Historical campaigns only.
// Nothing here draws from a random stream: every pick and roll is a hash of the occasion id.
export const SEDUCTION = Object.freeze({ value: 20, years: 10, label: 'Gästabudets natt' });
export const QUARREL = Object.freeze({ value: -15, years: 10, label: 'Grälet på gästabudet', stress: 10 });
export const POISON = Object.freeze({ hatred: -40, chance: 0.5, death: 0.3, caught: 0.4, health: 20, stress: 20 });

const byId = (a, b) => a.id.localeCompare(b.id);
const clamp = (n, max) => Math.min(max, Math.max(0, n));

/** The married guest who is seduced, and the seducer, as { seduced, seducer }, or null. Reads only. */
export function seductionPair(state, occasion, guests, hooks) {
  const opinion = hooks.getPersonalOpinion;
  const unhappy = guests.filter((person) => {
    const spouse = state.people[person.spouseId];
    return spouse && !spouse.diedAt && opinion(person.id, spouse.id) <= 0
      && !state.secrets.some((secret) => secret.type === 'affair' && secret.subjectId === person.id && !secret.exposed);
  });
  const roll = (person) => hashRoll(`${occasion.id}|seduce|${person.id}`);
  for (const seduced of unhappy.sort((a, b) => roll(a) - roll(b) || byId(a, b))) {
    const seducer = guests.filter((other) => other.sex !== seduced.sex && other.id !== seduced.spouseId && other.id !== seduced.id && !hooks.closeKin(seduced, other))
      .sort((a, b) => opinion(seduced.id, b.id) - opinion(seduced.id, a.id) || byId(a, b))[0];
    if (seducer) return { seduced, seducer };
  }
  return null;
}

function seduce(state, occasion, guests, cause, events, hooks) {
  const pair = seductionPair(state, occasion, guests, hooks);
  if (!pair) return;
  const { seduced, seducer } = pair, host = state.people[occasion.hostId];
  hooks.logEvent(events, 'feast_seduction', 'Ett möte i skymundan', `${host.name} ser ${seduced.name} och ${seducer.name} lämna gästabudet tillsammans.`, [seduced.id, seducer.id]);
  const note = hooks.memory('feast_seduction', `${seducer.name} förför ${seduced.name}`, [seduced.id, seducer.id], { causeId: cause, knownBy: [...new Set([seduced.id, seducer.id, host.id])] });
  createSecret(state, { type: 'affair', subjectId: seduced.id, holderIds: [seduced.id, seducer.id, host.id], evidence: 'weak', causeId: note.id });
  setRelationship(state, { kind: 'lover', aId: seduced.id, bId: seducer.id, causeId: note.id });
  for (const [from, to] of [[seduced, seducer], [seducer, seduced]]) hooks.opinionCause(from.id, to.id, SEDUCTION.value, SEDUCTION.label, note.id, SEDUCTION.years);
}

// Directed pairs among the guests that hold a stored relation, as [fromId, toId], in the order of `keys`. A pair without one has opinion 0 and decides nothing below.
const guestPairs = (state, guests, keys) => {
  const ids = new Set(guests.map((person) => person.id));
  return keys.map((key) => state.relations[key]).filter((rel) => rel && ids.has(rel.fromId) && ids.has(rel.toId)).map((rel) => [rel.fromId, rel.toId]);
};

/** The two guests of different houses whose opinions of each other add up lowest, below 0, as [a, b], or null. `keys` are the relation keys, sorted. Reads only. */
export function quarrelPair(state, guests, hooks, keys = Object.keys(state.relations).sort()) {
  const opinion = hooks.getPersonalOpinion;
  return guestPairs(state, guests, keys).map(([a, b]) => [a, b].sort()).filter(([a, b]) => state.people[a].familyId !== state.people[b].familyId)
    .map(([a, b]) => ({ a, b, sum: opinion(a, b) + opinion(b, a) })).filter((pair) => pair.sum < 0)
    .sort((x, y) => x.sum - y.sum || x.a.localeCompare(y.a) || x.b.localeCompare(y.b)).map((pair) => [state.people[pair.a], state.people[pair.b]])[0] ?? null;
}

function quarrel(state, guests, keys, cause, events, hooks) {
  const pair = quarrelPair(state, guests, hooks, keys);
  if (!pair) return;
  const [a, b] = pair;
  hooks.logEvent(events, 'feast_quarrel', `${a.name} och ${b.name} grälar vid bordet`, `Gamla motsättningar mellan ${a.name} och ${b.name} bryter ut inför alla gäster.`, [a.id, b.id]);
  const note = hooks.memory('feast_quarrel', `${a.name} och ${b.name} grälar på gästabudet`, [a.id, b.id], { causeId: cause });
  for (const [from, to] of [[a, b], [b, a]]) {
    hooks.opinionCause(from.id, to.id, QUARREL.value, QUARREL.label, note.id, QUARREL.years);
    from.stress = clamp(from.stress + QUARREL.stress, 200);
  }
}

/** The guest outside the controlled family who likes another guest least, at POISON.hatred or lower, as { poisoner, victim }, or null. `keys` are the relation keys, sorted. Reads only. */
export function poisonPair(state, guests, controlledId, hooks, keys = Object.keys(state.relations).sort()) {
  const opinion = hooks.getPersonalOpinion;
  return guestPairs(state, guests, keys).filter(([from]) => state.people[from].familyId !== controlledId)
    .map(([from, to]) => ({ from, to, value: opinion(from, to) })).filter((pair) => pair.value <= POISON.hatred)
    .sort((x, y) => x.value - y.value || x.from.localeCompare(y.from) || x.to.localeCompare(y.to))
    .map((pair) => ({ poisoner: state.people[pair.from], victim: state.people[pair.to] }))[0] ?? null;
}

// The crime the poisoning is, by the action path's rule (actionResolution.js): killing kin is kinslaying.
const crimeOf = (poisoner, victim, dies, hooks) => (!dies ? 'attempted_murder' : hooks.related(poisoner.id, victim.id) ? 'kinslaying' : 'murder');

function poison(state, occasion, guests, keys, cause, events, hooks) {
  const pair = poisonPair(state, guests, hooks.controlledFamily()?.id ?? null, hooks, keys);
  if (!pair || hashRoll(`${occasion.id}|poison`) >= POISON.chance) return;
  const { poisoner, victim } = pair, dies = hashRoll(`${occasion.id}|death`) < POISON.death, crime = crimeOf(poisoner, victim, dies, hooks);
  hooks.logEvent(events, 'feast_poisoning', dies ? `${victim.name} dör vid gästabudet` : `${victim.name} faller ihop vid gästabudet`, `Någon har blandat gift i ${victim.name}s bägare.${dies ? '' : ` ${victim.name} överlever men är svårt medtagen.`}`, [victim.id]);
  // The memory names the crime, so crimeOfSecret can read it when investigate or blackmail exposes the secret later.
  const note = hooks.memory('feast_poisoning', `${victim.name} förgiftas på gästabudet`, [victim.id], { causeId: cause, crime });
  const secret = createSecret(state, { type: dies ? 'murder' : 'plot', subjectId: poisoner.id, holderIds: [poisoner.id], evidence: 'weak', causeId: note.id });
  if (dies) hooks.kill([victim.id], events, 'Förgiftad på gästabudet');
  // Health stops at 1, as other harm that does not kill: the yearly step takes a person at 0.
  else Object.assign(victim, { health: Math.max(1, victim.health - POISON.health), stress: clamp(victim.stress + POISON.stress, 200) });
  if (hashRoll(`${occasion.id}|caught`) < POISON.caught) exposeCrime(state, { secretId: secret.id, crime, victimId: victim.id }, events, hooks);
}

/** At the end of holdFeast on a historical campaign: a seduction, a quarrel and perhaps a poisoning among the guests. `cause` is the feast's memory id. */
export function feastOutcomes(state, occasion, cause, events, hooks) {
  if (!state.historicalOrigin) return;
  const absent = new Set([hooks.activeRepresentative()?.id, occasion.hostId]);
  const guests = () => occasion.guestIds.map((id) => state.people[id]).filter((person) => person && !person.diedAt && !absent.has(person.id)).sort(byId);
  seduce(state, occasion, guests(), cause, events, hooks);
  // Quarrels only add causes to pairs that already hold a relation, so keys sorted once still list every pair that can reach POISON.hatred.
  const keys = Object.keys(state.relations).sort();
  quarrel(state, guests(), keys, cause, events, hooks);
  poison(state, occasion, guests(), keys, cause, events, hooks);
}
