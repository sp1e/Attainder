import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { validateHistoricalScenario } from './historicalScenarios.js';
import { createHistoricalCharacterSystem } from './characters/scenarioSeed.js';
import { SHIPPED_START_FOLDERS } from './testing/shippedHistoricalStarts.js';

// Every playable polity of every shipped package, taken from the catalog and the package itself.
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
  for (const folder of ['egypt-3000bc', 'john-1200', 'charlemagne-800']) assert.ok(SHIPPED_START_FOLDERS.includes(folder), folder);
});

for (const folder of SHIPPED_START_FOLDERS) {
  const input = loadPackage(folder), h = input.world.historicalScenario;
  assert.ok(h.playablePolityIds.length >= 1, `${folder} offers a playable polity`);
  for (const polityId of h.playablePolityIds) test(`${folder} ${polityId}: validates and starts in realm and family mode under its documented ruler`, () => {
    const court = h.courtSeeds[polityId], date = h.bookmarkDate;
    assert.deepEqual(validateHistoricalScenario(input, { date, polityId }), { ok: true, contentId: folder, contentVersion: h.contentVersion, date, polityId });
    for (const mode of ['realm', 'family']) {
      const state = createHistoricalCharacterSystem({ historicalScenario: h, date, polityId, mode, seed: 9 });
      assert.equal(state.identity.mode, mode, mode);
      assert.equal(state.identity.polityId, polityId, mode);
      assert.equal(state.realm.id, polityId, mode);
      assert.equal(state.offices.ruler.holderId, court.rulerId, mode);
      assert.ok(state.people[court.rulerId] && !state.people[court.rulerId].diedAt, mode);
      assert.equal(state.realm.successionLaw, court.successionLaw ?? 'primogeniture', mode);
    }
  });
}
