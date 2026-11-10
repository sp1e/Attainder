// A large house loses a branch that founds a rival house. Spec: docs/superpowers/specs/2026-11-10-cadet-branch-design.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHistoricalCharacterSystem } from './scenarioSeed.js';
import { actionHooks, normalizeCharacterSystem } from './index.js';
import { CADET_GRUDGE, CADET_LABEL, CADET_SIZE, cadetBranchOf, cadetBranchStep } from './cadetBranches.js';
import { ensurePortraitIdentity } from './portraitState.js';
import { addGameMonths } from '../gameDates.js';

const plain = (value) => JSON.parse(JSON.stringify(value));
const DATA = JSON.parse(readFileSync(new URL('../../../server/seed/historical/charlemagne-800/scenario.json', import.meta.url), 'utf8')).data;
const HOUSE = 'generated-house-1', HEAD = 'generated-courtier-1';
const BRANCH = ['berta', 'wido', 'child-1', 'child-2'];

const add = (state, id, fields) => {
  state.people[id] = ensurePortraitIdentity({ ...plain(state.people[HEAD]), id, name: id, spouseId: null, mentorId: null, diedAt: null, biologicalParentIds: [], legalParentIds: [], portraitIdentityId: null, healthConditions: [], ...fields }, state.people);
};

// Hovhus 1 at ten living members: the head and five children, and the head's younger sister Berta with her husband and two children.
function court() {
  const state = createHistoricalCharacterSystem({ historicalScenario: plain(DATA.world.historicalScenario), date: DATA.game.startDate, polityId: 'carolingian-realm', mode: 'realm', seed: 777 });
  const head = state.people[HEAD], born = (months) => addGameMonths(head.bornAt, months);
  const put = (id, fields) => add(state, id, fields);
  put('matriarch', { name: 'Matriarken', sex: 'female', bornAt: born(-300), diedAt: state.date });
  head.legalParentIds = ['matriarch']; head.biologicalParentIds = ['matriarch'];
  put('berta', { name: 'Berta', sex: 'female', bornAt: born(24), legalParentIds: ['matriarch'], biologicalParentIds: ['matriarch'], spouseId: 'wido' });
  put('wido', { name: 'Wido', sex: 'male', bornAt: born(36), spouseId: 'berta' });
  for (const n of [1, 2]) put(`child-${n}`, { name: `Barn ${n}`, bornAt: born(240 + n * 12), legalParentIds: ['berta', 'wido'], biologicalParentIds: ['berta', 'wido'] });
  for (const n of [1, 2, 3, 4, 5]) put(`heir-${n}`, { name: `Arvinge ${n}`, bornAt: born(200 + n * 12), legalParentIds: [HEAD], biologicalParentIds: [HEAD] });
  Object.assign(state.families[HOUSE], { treasury: 100, estates: 3, influence: 50 });
  return state;
}

const step = (state) => { const events = []; cadetBranchStep(state, events, actionHooks(state)); return events; };
const causeOf = (state, fromId, toId) => state.relations[`${fromId}:${toId}`]?.causes.filter((cause) => cause.label === CADET_LABEL) ?? [];

test('a collateral line of a house at ten members leaves and founds a rival house with its share', () => {
  const state = court(), events = step(state);
  const [event] = events.filter((e) => e.type === 'cadet_branch');
  const branch = Object.values(state.families).find((family) => family.headId === 'berta');
  assert.ok(branch, 'Berta heads a new house');
  assert.equal(branch.name, 'Bertas gren av Hovhus 1');
  assert.deepEqual(BRANCH.map((id) => state.people[id].familyId), BRANCH.map(() => branch.id));
  assert.equal(state.people['heir-1'].familyId, HOUSE);
  assert.equal(state.families[HOUSE].headId, HEAD);
  assert.deepEqual({ treasury: branch.treasury, estates: branch.estates, influence: branch.influence }, { treasury: 40, estates: 1, influence: 20 });
  assert.deepEqual({ treasury: state.families[HOUSE].treasury, estates: state.families[HOUSE].estates, influence: state.families[HOUSE].influence }, { treasury: 60, estates: 2, influence: 30 });
  assert.equal(event.description, 'Berta lämnar Hovhus 1 (genererat) med 3 anhöriga och grundar Bertas gren av Hovhus 1.');
  for (const [from, to] of [['berta', HEAD], [HEAD, 'berta']]) {
    const [cause, ...rest] = causeOf(state, from, to);
    assert.equal(rest.length, 0);
    assert.equal(cause.amount, CADET_GRUDGE);
  }
  normalizeCharacterSystem(plain(state));
});

test('a house below the size, the head\'s own line and a spouse who married in found no branch', () => {
  const small = court();
  small.people['heir-5'].diedAt = small.date;
  assert.equal(CADET_SIZE, 10);
  assert.equal(cadetBranchOf(small, small.families[HOUSE], actionHooks(small)), null);
  const own = court();
  for (const id of ['berta']) { own.people[id].legalParentIds = [HEAD]; own.people[id].biologicalParentIds = [HEAD]; }
  assert.equal(cadetBranchOf(own, own.families[HOUSE], actionHooks(own)), null);
  const married = court();
  married.people.berta.legalParentIds = [];
  assert.equal(cadetBranchOf(married, married.families[HOUSE], actionHooks(married)), null);
});

test('a branch that would leave fewer than five behind does not split, and no child of the founder splits in its place', () => {
  const state = court();
  for (const n of [3, 4, 5]) state.people[`heir-${n}`].legalParentIds = ['berta'];
  for (const n of [3, 4, 5]) state.people[`heir-${n}`].biologicalParentIds = ['berta'];
  state.people['child-1'].bornAt = addGameMonths(state.date, -240);
  add(state, 'grandchild', { name: 'Barnbarn', bornAt: state.date, legalParentIds: ['child-1'], biologicalParentIds: ['child-1'] });
  assert.equal(cadetBranchOf(state, state.families[HOUSE], actionHooks(state)), null);
});

test('a prisoner and a spouse of another house stay behind, and a house without estates gives none', () => {
  const state = court();
  state.people.wido.familyId = 'royal-house';
  add(state, 'heir-6', { name: 'Arvinge 6', bornAt: state.date, legalParentIds: [HEAD], biologicalParentIds: [HEAD] });
  state.prisoners.push({ id: 'prisoner-1', personId: 'child-2', captorFamilyId: 'royal-house', since: state.date, ransom: 40, status: 'held', closedAt: null, reason: null });
  state.families[HOUSE].estates = 0;
  const { branch } = cadetBranchOf(state, state.families[HOUSE], actionHooks(state));
  assert.deepEqual(branch.map((person) => person.id), ['berta', 'child-1']);
  step(state);
  const house = state.families[state.people.berta.familyId];
  assert.deepEqual({ estates: house.estates, old: state.families[HOUSE].estates, wido: state.people.wido.familyId, prisoner: state.people['child-2'].familyId }, { estates: 0, old: 0, wido: 'royal-house', prisoner: HOUSE });
  normalizeCharacterSystem(plain(state));
});

test('a Hadara campaign never splits, and a second branch of the same root is numbered', () => {
  const hadara = court();
  delete hadara.historicalOrigin;
  assert.deepEqual(step(hadara), []);
  const state = court();
  state.families['family-old'] = { ...plain(state.families[HOUSE]), id: 'family-old', name: 'Bertas gren av Hovhus 1', headId: HEAD };
  step(state);
  assert.ok(Object.values(state.families).some((family) => family.name === 'Bertas gren av Hovhus 1 2'));
  const nested = court();
  nested.families['family-anna'] = { ...plain(nested.families[HOUSE]), id: 'family-anna', name: 'Annas gren av Hovhus 1', headId: HEAD };
  nested.families[HOUSE].name = 'Annas gren av Hovhus 1 2';
  step(nested);
  assert.equal(nested.families[nested.people.berta.familyId].name, 'Bertas gren av Hovhus 1', 'a branch of a branch names the root house');
  const numbered = court();
  numbered.families[HOUSE].name = 'Annas gren av Hovhus 6';
  step(numbered);
  assert.equal(numbered.families[numbered.people.berta.familyId].name, 'Bertas gren av Hovhus 6', 'a number in the name of the root house stays');
});
