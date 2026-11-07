import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { validateHistoricalCourt, validateHistoricalScenario } from './historicalScenarios.js';
import { createHistoricalCharacterSystem } from './characters/scenarioSeed.js';
import { SHIPPED_START_FOLDERS } from './testing/shippedHistoricalStarts.js';

// Every playable polity of every shipped package, taken from the catalog and the package itself.
// Packages load inside the tests, so a catalog entry without a folder is named by the first test, not an import error.
const SEED = new URL('../../server/seed/historical/', import.meta.url);
const readJson = (folder, name) => JSON.parse(readFileSync(new URL(`${folder}/${name}`, SEED), 'utf8'));
const loadPackage = folder => {
  const { game, world } = readJson(folder, 'scenario.json').data;
  return { game, world, regions: readJson(folder, 'regions.geojson'), assetManifest: readJson(folder, 'manifest.json') };
};

test('the catalog names every package shipped under server/seed/historical', () => {
  const onDisk = readdirSync(SEED, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && existsSync(new URL(`${entry.name}/scenario.json`, SEED))).map(entry => entry.name);
  assert.deepEqual([...SHIPPED_START_FOLDERS].sort(), onDisk.sort());
  for (const folder of ['egypt-3000bc', 'john-1200', 'charlemagne-800', 'world-1500']) assert.ok(SHIPPED_START_FOLDERS.includes(folder), folder);
});

test('the shipped packages offer seventeen playable polities: Egypt, ten at AD 800, four at AD 1200 and two at AD 1500', () => {
  const counts = Object.fromEntries(SHIPPED_START_FOLDERS.map(folder => [folder, loadPackage(folder).world.historicalScenario.playablePolityIds.length]));
  assert.deepEqual(counts, { 'egypt-3000bc': 1, 'charlemagne-800': 10, 'world-1500': 2, 'john-1200': 4 });
  assert.equal(Object.values(counts).reduce((sum, count) => sum + count, 0), 17);
});

const startsEveryMode = (h, polityId) => {
  const court = h.courtSeeds[polityId], date = h.bookmarkDate;
  for (const mode of ['realm', 'family']) {
    const state = createHistoricalCharacterSystem({ historicalScenario: h, date, polityId, mode, seed: 9 });
    assert.equal(state.identity.mode, mode, mode);
    assert.equal(state.identity.polityId, polityId, mode);
    assert.equal(state.realm.id, polityId, mode);
    assert.equal(state.offices.ruler.holderId, court.rulerId, mode);
    assert.ok(state.people[court.rulerId] && !state.people[court.rulerId].diedAt, mode);
    assert.equal(state.realm.successionLaw, court.successionLaw ?? 'primogeniture', mode);
  }
};

for (const folder of SHIPPED_START_FOLDERS) test(`${folder}: every playable polity passes both validators and starts in realm and family mode under its documented ruler`, async t => {
  const input = loadPackage(folder), h = input.world.historicalScenario;
  assert.ok(h.playablePolityIds.length >= 1, `${folder} offers a playable polity`);
  for (const polityId of h.playablePolityIds) await t.test(polityId, () => {
    const date = h.bookmarkDate;
    assert.deepEqual(validateHistoricalScenario(input, { date, polityId }), { ok: true, contentId: folder, contentVersion: h.contentVersion, date, polityId });
    assert.equal(validateHistoricalCourt(h, { date, polityId }).ok, true, polityId);
    startsEveryMode(h, polityId);
  });
});
