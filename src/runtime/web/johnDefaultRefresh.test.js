import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { installFakeIndexedDb } from './fakeIndexedDb.js';
import { johnRelease100 } from '../../../server/fixtures/releaseFixtures.js';
import { defaultScenarioFiles } from '../../../scripts/sync-default-scenario.mjs';
import { advanceCharacters } from '../../../server/characters/index.js';
import { addGameMonths } from '../../../server/gameDates.js';

// The web build's seed of the built-in scenario must carry today's server/seed/default. The generator
// runs only when it is missing or stale, so a parallel run does not rewrite files other tests read.
const META = new URL('./generated/defaultScenarioMeta.js', import.meta.url);
const seedRevision = JSON.parse(readFileSync(new URL('../../../server/seed/default/world.json', import.meta.url), 'utf8')).builtInRevision;
if (!existsSync(META) || !readFileSync(META, 'utf8').includes(`builtInRevision = ${seedRevision};`)) {
  execFileSync(process.execPath, [fileURLToPath(new URL('../../../scripts/seed-web-defaults.mjs', import.meta.url))]);
}

const playsAYear = (world, label) => {
  const state = world.characterSystem, target = addGameMonths(state.date, 12);
  const year = advanceCharacters(state, target, { id: 'after-upgrade' });
  assert.equal(year.ok, true, `${label}: ${year.error}`);
  assert.equal(year.state.date, target, label);
  assert.equal(year.state.realm.id, state.realm.id, label);
};

// Every clock read moves on a millisecond, so two reads that should share one timestamp never agree by luck.
const tickingClock = () => {
  const RealDate = Date; let tick = 0;
  globalThis.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(RealDate.now() + ++tick); } static now() { return RealDate.now() + ++tick; } };
  return () => { globalThis.Date = RealDate; };
};

// A web library from John 1.0.0: the built-in record as that release's seed wrote it, at revision 1 on the same map.
async function storeJohn100(idb) {
  const { idbGet, idbPut, idbDelete, STORES } = idb, current = await idbGet(STORES.scenarios, 'default'), release = johnRelease100();
  const files = defaultScenarioFiles(release, 1), meta = JSON.parse(files['scenario.json']);
  await idbPut(STORES.scenarios, { ...current, meta: { ...current.meta, ...meta },
    json: { ...current.json, world: JSON.parse(files['world.json']), game: JSON.parse(files['game.json']) },
    geojson: { ...current.geojson, citiesGeojson: JSON.parse(files['cities.geojson']) } });
  await idbDelete(STORES.scenarioMeta, 'default');
}

test('a web library holding John at revision 1 refreshes to 1.2.0, keeps the map stamp, and its campaigns load, restore and play a year', async () => {
  installFakeIndexedDb();
  const originalFetch = globalThis.fetch, restoreClock = tickingClock();
  globalThis.fetch = async input => String(input).startsWith('file:') ? new Response(await readFile(new URL(String(input)))) : originalFetch(input);
  try {
    const store = await import('./libraryStore.js'), idb = await import('./idb.js');
    const call = async (method, segments, body) => {
      const response = await store.handleGames({ method, segments, body, query: new URLSearchParams() });
      const data = await response.json(); assert.ok(response.ok, JSON.stringify(data)); return data;
    };
    const defaultWorld = async () => (await idb.idbGet(idb.STORES.scenarios, 'default')).json.world;
    await store.ensureSeeded();
    await storeJohn100(idb);
    assert.equal((await defaultWorld()).historicalScenario.contentVersion, '1.0.0');
    const campaigns = [];
    for (const mode of ['realm', 'family']) {
      const made = await call('POST', [], { scenarioId: 'default', historicalStart: { date: '1200-12-31', polityId: 'johns-realms', mode, seed: 7, difficulty: 'normal' }, gamePatch: { country: 'johns-realms' } });
      assert.equal(made.data.world.builtInRevision, 1);
      assert.equal(made.data.world.historicalScenario.contentVersion, '1.0.0');
      campaigns.push({ id: made.game.id, data: (await call('GET', [made.game.id])).data, bundle: await call('GET', [made.game.id, 'export']) });
    }
    const companion100 = await (await store.handleScenarios({ method: 'GET', segments: ['default', 'export'], query: new URLSearchParams() })).json();

    await store.ensureSeeded();
    const world = await defaultWorld();
    assert.equal(world.builtInMap, 'historical-john-1200-v1');
    assert.equal(world.builtInRevision, 3);
    assert.equal(world.historicalScenario.contentVersion, '1.2.0');
    assert.deepEqual(world.historicalScenario.playablePolityIds, ['johns-realms', 'khmer-angkor', 'almohad', 'france-capetian']);
    const companion120 = await (await store.handleScenarios({ method: 'GET', segments: ['default', 'export'], query: new URLSearchParams() })).json();
    for (const saved of campaigns) {
      const loaded = await call('GET', [saved.id]);
      assert.equal(loaded.game.scenarioId, 'default', `${saved.id}: the campaign stays on the built-in`);
      assert.deepEqual(loaded.data, saved.data, `${saved.id}: the campaign keeps its own 1.0.0 world`);
      playsAYear(loaded.data.world, `${saved.id} loaded`);
      for (const [label, companion] of [['1.2.0', companion120], ['1.0.0', companion100]]) {
        const restored = await call('POST', ['restore'], { bundle: saved.bundle, scenarioBundle: companion });
        assert.deepEqual(restored.data.world, saved.bundle.data.world, `${saved.id} restored with ${label}`);
        playsAYear(restored.data.world, `${saved.id} restored with ${label}`);
      }
    }
  } finally { globalThis.fetch = originalFetch; restoreClock(); }
});
