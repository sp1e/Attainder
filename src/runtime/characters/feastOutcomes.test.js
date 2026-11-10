// A feast where someone seduces, someone quarrels and someone is poisoned. Spec: docs/superpowers/specs/2026-11-10-feast-outcomes-design.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHistoricalCharacterSystem } from './scenarioSeed.js';
import { actionHooks, executeCharacterCommand, normalizeCharacterSystem } from './index.js';
import { hashRoll } from './duels.js';
import { POISON, QUARREL, SEDUCTION, feastOutcomes } from './feastOutcomes.js';
import { crimeOfSecret } from './crimes.js';
import { isLawfulSubject } from './prisoners.js';
import { exposeSecret } from './secrets.js';
import { LOVER_SHARE, biologicalFather, eligibleLovers, paternityDraw } from './paternity.js';

const plain = (value) => JSON.parse(JSON.stringify(value));
const DATA = JSON.parse(readFileSync(new URL('../../../server/seed/historical/charlemagne-800/scenario.json', import.meta.url), 'utf8')).data;
const WIFE = 'rotrud', HUSBAND = 'generated-courtier-1', LOVER = 'generated-courtier-2', THIRD = 'generated-courtier-3', VICTIM = 'berta';

let counter = 0;
const ok = (result) => { assert.equal(result.ok, true, result.error); return result; };
const streams = (s) => [s.rngState, s.actionRngState, s.plotRngState, s.lineageRngState, s.healthRngState];
function feeling(state, fromId, toId, amount) {
  const key = `${fromId}:${toId}`;
  state.relations[key] ??= { fromId, toId, bonds: [], causes: [] };
  state.relations[key].causes.push({ id: `fixture-${++counter}`, amount, label: 'Prov', causeId: `fixture-${counter}`, startAt: state.date, expiresAt: null });
}
const opinionCause = (state, fromId, toId, label) => state.relations[`${fromId}:${toId}`]?.causes.find((cause) => cause.label === label);
function court() {
  return createHistoricalCharacterSystem({ historicalScenario: plain(DATA.world.historicalScenario), date: DATA.game.startDate, polityId: 'carolingian-realm', mode: 'realm', seed: 777 });
}
// The next occasion id is `occasion-<sequence + 1>`. Moves the counter so that id's hash rolls meet `wanted`.
function rollsWhere(state, wanted) {
  for (let n = state.sequence + 1; ; n++) {
    const roll = (suffix) => hashRoll(`occasion-${n}|${suffix}`);
    if (wanted(roll('poison'), roll('death'), roll('caught'))) { state.sequence = n - 1; return; }
  }
}
const feast = (state) => ok(executeCharacterCommand(state, { id: `feast-${++counter}`, expectedRevision: state.revision, type: 'hold_feast', payload: {} }));
const kinds = (events) => events.filter((event) => event.type.startsWith('feast_')).map((event) => event.type);

test('an unhappy spouse is seduced by the guest they like most, which leaves an affair the host knows of', () => {
  const state = court();
  Object.assign(state.people[WIFE], { spouseId: HUSBAND });
  Object.assign(state.people[HUSBAND], { spouseId: WIFE });
  feeling(state, HUSBAND, WIFE, 10);
  feeling(state, WIFE, LOVER, 30);
  const before = streams(state), { state: after, events } = feast(state);
  assert.deepEqual(kinds(events), ['feast_seduction']);
  const secret = after.secrets.find((item) => item.type === 'affair');
  assert.deepEqual({ subject: secret.subjectId, holders: secret.holderIds, exposed: secret.exposed }, { subject: WIFE, holders: [WIFE, LOVER, 'karl'], exposed: false });
  assert.ok(after.relationships.some((item) => item.kind === 'lover' && [item.aId, item.bId].sort().join() === [LOVER, WIFE].sort().join()));
  for (const [from, to] of [[WIFE, LOVER], [LOVER, WIFE]]) assert.equal(opinionCause(after, from, to, SEDUCTION.label).amount, SEDUCTION.value);
  assert.deepEqual(after.memories.find((m) => m.type === 'feast_seduction').knownBy, [WIFE, LOVER, 'karl']);
  assert.deepEqual(streams(after), before);
  normalizeCharacterSystem(plain(after));
});

test('the two guests of different houses who think least of each other quarrel', () => {
  const state = court();
  feeling(state, LOVER, THIRD, -20);
  feeling(state, THIRD, LOVER, -20);
  feeling(state, 'gisela', VICTIM, -90);
  const stress = [LOVER, THIRD].map((id) => state.people[id].stress);
  const { state: after, events } = feast(state);
  assert.deepEqual(kinds(events), ['feast_quarrel'], 'a house quarrels with no one inside it');
  assert.equal(events.find((event) => event.type === 'feast_quarrel').participants.join(), [LOVER, THIRD].join());
  assert.equal(opinionCause(after, LOVER, THIRD, QUARREL.label).amount, QUARREL.value);
  assert.equal(opinionCause(after, THIRD, LOVER, QUARREL.label).amount, QUARREL.value);
  assert.deepEqual([LOVER, THIRD].map((id) => after.people[id].stress), stress.map((n) => n + QUARREL.stress));
});

test('a poisoner who is caught kills the guest they hate, and the crime is exposed', () => {
  const state = court();
  feeling(state, THIRD, VICTIM, -60);
  feeling(state, 'karl-den-yngre', HUSBAND, -95);
  rollsWhere(state, (poison, death, caught) => poison < POISON.chance && death < POISON.death && caught < POISON.caught);
  const { state: after, events } = feast(state);
  assert.equal(after.people[VICTIM].deathReason, 'Förgiftad på gästabudet');
  assert.equal(after.people[HUSBAND].diedAt, null, 'the controlled family never poisons');
  const secret = after.secrets.find((item) => item.type === 'murder');
  assert.deepEqual([secret.subjectId, secret.exposed], [THIRD, true]);
  assert.ok(events.some((event) => event.type === 'crime_exposed'));
  normalizeCharacterSystem(plain(after));
});

test('a victim who lives keeps 1 health at least, and an uncaught poisoner keeps a hidden plot secret that names the crime', () => {
  const state = court();
  feeling(state, THIRD, VICTIM, -60);
  rollsWhere(state, (poison, death, caught) => poison < POISON.chance && death >= POISON.death && caught >= POISON.caught);
  state.people[VICTIM].health = POISON.health - 5;
  const { stress } = state.people[VICTIM];
  const { state: after, events } = feast(state);
  assert.deepEqual([after.people[VICTIM].diedAt, after.people[VICTIM].health, after.people[VICTIM].stress], [null, 1, Math.min(200, stress + QUARREL.stress + POISON.stress)]);
  const secret = after.secrets.find((item) => item.type === 'plot' && item.subjectId === THIRD);
  assert.deepEqual([secret.exposed, secret.holderIds], [false, [THIRD]]);
  assert.ok(!events.some((event) => event.type === 'crime_exposed'));
  normalizeCharacterSystem(plain(after));
  assert.deepEqual(crimeOfSecret(after, secret.id), { crime: 'attempted_murder', victimId: VICTIM });
  assert.equal(isLawfulSubject(after, THIRD), false, 'a hidden poisoning convicts no one');
  exposeSecret(after, secret.id);
  assert.equal(isLawfulSubject(after, THIRD), true, 'a poisoning found out later, by investigation or blackmail, makes the poisoner a lawful prisoner');
});

test('a poisoner who kills a relative commits kinslaying', () => {
  const state = court();
  state.people[LOVER].legalParentIds = [THIRD];
  feeling(state, THIRD, LOVER, -60);
  rollsWhere(state, (poison, death, caught) => poison < POISON.chance && death < POISON.death && caught < POISON.caught);
  const { state: after, events } = feast(state);
  assert.equal(after.people[LOVER].deathReason, 'Förgiftad på gästabudet');
  const secret = after.secrets.find((item) => item.type === 'murder' && item.subjectId === THIRD);
  assert.deepEqual(crimeOfSecret(after, secret.id), { crime: 'kinslaying', victimId: LOVER });
  assert.ok(events.some((event) => event.type === 'crime_exposed'));
});

test('a child of the feast affair is the seducer\'s when the paternity draw names a lover', () => {
  const state = court();
  Object.assign(state.people[WIFE], { spouseId: HUSBAND });
  Object.assign(state.people[HUSBAND], { spouseId: WIFE });
  feeling(state, WIFE, LOVER, 30);
  const { state: after } = feast(state);
  const [wife, husband, hooks] = [after.people[WIFE], after.people[HUSBAND], actionHooks(after)];
  const eligible = eligibleLovers(after, wife, husband, hooks);
  assert.ok(eligible.length > 1 && eligible.some((man) => man.id === LOVER));
  // A draw below LOVER_SHARE whose share of the eligible list would pick someone else without the feast's bond.
  for (after.plotRngState = 1; ; after.plotRngState++) {
    const u = paternityDraw(after, wife);
    if (u < LOVER_SHARE && eligible[Math.floor((u / LOVER_SHARE) * eligible.length)].id !== LOVER) break;
  }
  assert.equal(biologicalFather(after, wife, husband, hooks).id, LOVER);
});

test('the host takes no part either, when someone other than the representative pays', () => {
  let id = 0;
  while (hashRoll(`occasion-host-${id}|poison`) >= POISON.chance) id++;
  const outcome = (hostId) => {
    const state = court(), events = [];
    feeling(state, HUSBAND, VICTIM, -90);
    const hooks = { ...actionHooks(state), activeRepresentative: () => state.people.karl };
    feastOutcomes(state, { id: `occasion-host-${id}`, hostId, guestIds: [HUSBAND, VICTIM, THIRD] }, null, events, hooks);
    return kinds(events);
  };
  assert.deepEqual(outcome('karl'), ['feast_quarrel', 'feast_poisoning']);
  assert.deepEqual(outcome(HUSBAND), []);
});

test('a court left as the scenario sets it holds a quiet feast', () => {
  assert.deepEqual(kinds(feast(court()).events), []);
});

test('no poisoning when the roll fails or the hatred is too mild, and nothing at a Hadara feast', () => {
  const failed = court();
  feeling(failed, THIRD, VICTIM, -60);
  rollsWhere(failed, (poison) => poison >= POISON.chance);
  assert.ok(!kinds(feast(failed).events).includes('feast_poisoning'));
  const mild = court();
  feeling(mild, THIRD, VICTIM, POISON.hatred + 1);
  feeling(mild, VICTIM, THIRD, 50);
  rollsWhere(mild, (poison) => poison < POISON.chance);
  assert.ok(!kinds(feast(mild).events).includes('feast_poisoning'));
  const hadara = court();
  delete hadara.historicalOrigin;
  feeling(hadara, THIRD, VICTIM, -60);
  feeling(hadara, LOVER, THIRD, -30);
  rollsWhere(hadara, (poison) => poison < POISON.chance);
  assert.deepEqual(kinds(feast(hadara).events), []);
});

test('the representative takes no part in what happens at the table', () => {
  const state = court();
  Object.assign(state.people.karl, { spouseId: WIFE });
  Object.assign(state.people[WIFE], { spouseId: 'karl' });
  feeling(state, 'karl', HUSBAND, -90);
  feeling(state, HUSBAND, 'karl', -90);
  feeling(state, 'karl', 'gisela', 50);
  const { events } = feast(state);
  assert.ok(events.every((event) => !event.type.startsWith('feast_') || !event.participants.includes('karl')));
});
