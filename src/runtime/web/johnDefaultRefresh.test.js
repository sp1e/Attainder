import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { installFakeIndexedDb } from './fakeIndexedDb.js';
import { johnRelease100, johnRelease110 } from '../../../server/fixtures/releaseFixtures.js';
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
  return year.state;
};

// Every clock read moves on a millisecond, so two reads that should share one timestamp never agree by luck.
const tickingClock = () => {
  const RealDate = Date; let tick = 0;
  globalThis.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(RealDate.now() + ++tick); } static now() { return RealDate.now() + ++tick; } };
  return () => { globalThis.Date = RealDate; };
};

// A web library from an older John release: the built-in record as that release's seed wrote it, at its revision on the same map.
async function storeJohnRelease(idb, release, revision) {
  const { idbGet, idbPut, idbDelete, STORES } = idb, current = await idbGet(STORES.scenarios, 'default');
  const files = defaultScenarioFiles(release, revision), meta = JSON.parse(files['scenario.json']);
  await idbPut(STORES.scenarios, { ...current, meta: { ...current.meta, ...meta },
    json: { ...current.json, world: JSON.parse(files['world.json']), game: JSON.parse(files['game.json']) },
    geojson: { ...current.geojson, citiesGeojson: JSON.parse(files['cities.geojson']) } });
  await idbDelete(STORES.scenarioMeta, 'default');
}

// Starts `campaigns` on the built-in John `version` at `revision`, then seeds again, which refreshes the built-in to
// 1.2.0 at revision 3. Every campaign must load, restore from both companions and play a year; `check(saved, loaded)`
// adds release-specific assertions. Both tests share one in-memory library: idb.js keeps its first connection.
async function refreshFrom({ version, revision, release, campaigns, check = () => {} }) {
  if (!globalThis.indexedDB) installFakeIndexedDb();
  const originalFetch = globalThis.fetch, restoreClock = tickingClock();
  globalThis.fetch = async input => String(input).startsWith('file:') ? new Response(await readFile(new URL(String(input)))) : originalFetch(input);
  try {
    const store = await import('./libraryStore.js'), idb = await import('./idb.js');
    const call = async (method, segments, body) => {
      const response = await store.handleGames({ method, segments, body, query: new URLSearchParams() });
      const data = await response.json(); assert.ok(response.ok, JSON.stringify(data)); return data;
    };
    const defaultWorld = async () => (await idb.idbGet(idb.STORES.scenarios, 'default')).json.world;
    const companion = async () => (await store.handleScenarios({ method: 'GET', segments: ['default', 'export'], query: new URLSearchParams() })).json();
    await store.ensureSeeded();
    await storeJohnRelease(idb, release, revision);
    assert.equal((await defaultWorld()).historicalScenario.contentVersion, version);
    const started = [];
    for (const [polityId, mode] of campaigns) {
      const made = await call('POST', [], { scenarioId: 'default', historicalStart: { date: '1200-12-31', polityId, mode, seed: 7, difficulty: 'normal' }, gamePatch: { country: polityId } });
      assert.equal(made.data.world.builtInRevision, revision);
      assert.equal(made.data.world.historicalScenario.contentVersion, version);
      started.push({ id: made.game.id, polityId, data: (await call('GET', [made.game.id])).data, bundle: await call('GET', [made.game.id, 'export']) });
    }
    const companionOld = await companion();

    await store.ensureSeeded();
    const world = await defaultWorld();
    assert.equal(world.builtInMap, 'historical-john-1200-v1');
    assert.equal(world.builtInRevision, 3);
    assert.equal(world.historicalScenario.contentVersion, '1.2.0');
    assert.deepEqual(world.historicalScenario.playablePolityIds, ['johns-realms', 'khmer-angkor', 'almohad', 'france-capetian']);
    const companion120 = await companion();
    for (const saved of started) {
      const loaded = await call('GET', [saved.id]);
      assert.equal(loaded.game.scenarioId, 'default', `${saved.id}: the campaign stays on the built-in`);
      assert.deepEqual(loaded.data, saved.data, `${saved.id}: the campaign keeps its own ${version} world`);
      playsAYear(loaded.data.world, `${saved.id} loaded`);
      for (const [label, scenarioBundle] of [['1.2.0', companion120], [version, companionOld]]) {
        const restored = await call('POST', ['restore'], { bundle: saved.bundle, scenarioBundle });
        assert.deepEqual(restored.data.world, saved.bundle.data.world, `${saved.id} restored with ${label}`);
        playsAYear(restored.data.world, `${saved.id} restored with ${label}`);
      }
      check(saved, loaded);
    }
  } finally { globalThis.fetch = originalFetch; restoreClock(); }
}

test('a web library holding John at revision 1 refreshes to 1.2.0, keeps the map stamp, and its campaigns load, restore and play a year', async () => {
  await refreshFrom({ version: '1.0.0', revision: 1, release: johnRelease100(), campaigns: [['johns-realms', 'realm'], ['johns-realms', 'family']] });
});

test('a web library holding John 1.1.0 at revision 2 refreshes to 1.2.0, and its campaigns load, restore and play a year', async () => {
  await refreshFrom({ version: '1.1.0', revision: 2, release: johnRelease110(), campaigns: [['johns-realms', 'realm'], ['johns-realms', 'family'], ['almohad', 'realm']],
    check: (saved, loaded) => {
      if (saved.polityId !== 'almohad') return;
      // The Almohads keep the merit law their 1.1.0 world was started with.
      assert.equal(loaded.data.world.characterSystem.realm.successionLaw, 'merit', 'the Almohads keep their 1.1.0 law');
      assert.equal(playsAYear(loaded.data.world, 'Almohads loaded').realm.successionLaw, 'merit', 'the Almohads play a year under merit');
    } });
});
