// Attested name pools for generated people in historical campaigns. Spec: docs/superpowers/specs/2026-11-11-name-pools-design.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHistoricalCharacterSystem } from './scenarioSeed.js';
import { bearChild, createCharacterSystem, normalizeCharacterSystem } from './index.js';
import { ensureStaff } from './courtStaff.js';
import { NAME_POOL } from '../../../server/characters/content.js';
import { validNamePool } from './namePools.js';
import { validateHistoricalCourt } from '../../../server/historicalScenarios.js';

const plain = (value) => JSON.parse(JSON.stringify(value));
const DATA = JSON.parse(readFileSync(new URL('../../../server/seed/historical/charlemagne-800/scenario.json', import.meta.url), 'utf8')).data;
const POOL = { id: 'test-pool', male: ['Walateus', 'Gisleboldus', 'Gerosmus'], female: ['Framengildis', 'Ermentrudis'] };
const streams = (s) => [s.rngState, s.actionRngState, s.plotRngState, s.lineageRngState, s.healthRngState];

function scenario(pool) {
  const h = plain(DATA.world.historicalScenario);
  if (pool !== undefined) h.courtSeeds['carolingian-realm'].namePool = pool;
  return h;
}
const court = (pool) => createHistoricalCharacterSystem({ historicalScenario: scenario(pool), date: DATA.game.startDate, polityId: 'carolingian-realm', mode: 'realm', seed: 777 });
const parents = (state) => {
  const living = Object.values(state.people).filter((p) => !p.diedAt);
  return [living.find((p) => p.sex === 'female'), living.find((p) => p.sex === 'male')];
};
const newest = (state) => Object.values(state.people).at(-1);

test('a court with a name pool carries it into the campaign', () => {
  assert.equal(validateHistoricalCourt(scenario(POOL), { date: DATA.game.startDate, polityId: 'carolingian-realm' }).ok, true);
  assert.deepEqual(court(POOL).namePool, POOL);
  assert.equal(Object.hasOwn(court(), 'namePool'), false);
});

test('a child takes a first name from the pool for its sex and moves the streams as before', () => {
  const pooled = court(POOL), bare = court();
  const [mother, father] = parents(pooled);
  bearChild(pooled, mother, father, []);
  bearChild(bare, bare.people[mother.id], bare.people[father.id], []);
  const child = newest(pooled), plainChild = newest(bare);
  const family = pooled.families[mother.familyId].name;
  assert.equal(child.sex, plainChild.sex);
  assert.ok(POOL[child.sex].some((name) => child.name === `${name} (${family})`), child.name);
  assert.equal(plainChild.name, `Barn ${plainChild.id} (${family})`);
  assert.deepEqual(streams(pooled), streams(bare));
});

test('court staff take their names from the pool', () => {
  const state = court(POOL);
  const staff = ensureStaff(state, state.realm.familyId ?? Object.keys(state.families)[0], 'cook');
  const first = staff.name.replace(/ \(.*\)$/, '');
  assert.ok([...POOL.male, ...POOL.female].includes(first), staff.name);
});

test('Hadara has no pool, and a child there keeps the old names', () => {
  const state = createCharacterSystem({ seed: 321 });
  assert.equal(Object.hasOwn(state, 'namePool'), false);
  const [mother, father] = parents(state);
  bearChild(state, mother, father, []);
  assert.ok(NAME_POOL.some((name) => newest(state).name.startsWith(`${name} `)));
});

test('saves keep the pool and refuse a broken one or one in Hadara', () => {
  const state = court(POOL);
  assert.deepEqual(normalizeCharacterSystem(plain(state)).namePool, POOL);
  for (const broken of [null, [], { ...POOL, id: 'Bad Id' }, { ...POOL, male: [] }, { ...POOL, female: ['Ermentrudis', 'Ermentrudis'] }, { ...POOL, extra: 1 }]) {
    const save = plain(state);
    save.namePool = broken;
    assert.throws(() => normalizeCharacterSystem(save), /Sparfilens namnlista är ogiltig/);
  }
  const hadara = plain(createCharacterSystem({ seed: 321 }));
  hadara.namePool = POOL;
  assert.throws(() => normalizeCharacterSystem(hadara), /Sparfilens namnlista är ogiltig/);
});

test('the package validator refuses a malformed pool', () => {
  for (const broken of [null, { ...POOL, male: ['Walateus (genererad)'] }, { ...POOL, female: [''] }, { ...POOL, male: ['x'.repeat(41)] }, { id: 'test-pool', male: ['A'] }]) {
    assert.equal(validNamePool(broken), false, JSON.stringify(broken));
    assert.equal(validateHistoricalCourt(scenario(broken), { date: DATA.game.startDate, polityId: 'carolingian-realm' }).ok, false, JSON.stringify(broken));
  }
});
