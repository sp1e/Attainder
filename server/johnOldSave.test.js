import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { johnRelease100 } from './fixtures/releaseFixtures.js';
import { defaultScenarioFiles } from '../scripts/sync-default-scenario.mjs';

const moduleUrl = file => JSON.stringify(new URL(file, import.meta.url).href);
const SEED_DIR = new URL('./seed/default/', import.meta.url);
// Each run is one start of the desktop app on the same data folder. `seed` is the built-in scenario the app
// ships (null for today's server/seed/default). `keep` hands values to the next run.
const desktop = root => (body, seed = null) => {
  const env = { ...process.env, OH_DATA_DIR: path.join(root, 'data') };
  delete env.OH_BUILT_IN_SEED_DIR;
  if (seed) env.OH_BUILT_IN_SEED_DIR = seed;
  return execFileSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path';
    import * as store from ${moduleUrl('./libraryStore.js')};
    import { advanceCharacters } from ${moduleUrl('./characters/index.js')};
    import { addGameMonths } from ${moduleUrl('./gameDates.js')};
    const kept = path.join(${JSON.stringify(root)}, 'kept.json');
    const keep = value => fs.writeFileSync(kept, JSON.stringify(value));
    const recall = () => JSON.parse(fs.readFileSync(kept, 'utf8'));
    // Every clock read moves on a millisecond, so two reads of a missing timestamp never agree by luck.
    { const RealDate = Date; let tick = 0;
      globalThis.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(RealDate.now() + ++tick); } static now() { return RealDate.now() + ++tick; } }; }
    const playsAYear = (world, label) => {
      const state = world.characterSystem, target = addGameMonths(state.date, 12);
      const year = advanceCharacters(state, target, { id: 'after-upgrade' });
      assert.equal(year.ok, true, label + ': ' + year.error);
      assert.equal(year.state.date, target, label);
      assert.equal(year.state.realm.id, state.realm.id, label);
    };
    ${body}
  `], { env, stdio: 'pipe', encoding: 'utf8' });
};

// The app as John 1.0.0 shipped it: the built-in scenario at revision 1 under the same map stamp.
function writeRelease100Seed(dir) {
  cpSync(SEED_DIR, dir, { recursive: true });
  for (const [name, text] of Object.entries(defaultScenarioFiles(johnRelease100(), 1))) writeFileSync(path.join(dir, name), text);
}

const START = { date: '1200-12-31', seed: 7, difficulty: 'normal' };
const MODES = ['realm', 'family'];

test('a campaign started on the built-in John 1.0.0 loads, restores from its companion and plays a year after the 1.1.0 refresh', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'attainder-john-100-')), run = desktop(root), seed100 = path.join(root, 'seed-1.0.0');
  writeRelease100Seed(seed100);
  try {
    run(`
      store.ensureScenarioStore();
      const world = store.getScenarioDetails('default').data.world;
      assert.equal(world.builtInMap, 'historical-john-1200-v1');
      assert.equal(world.builtInRevision, 1);
      assert.equal(world.historicalScenario.contentVersion, '1.0.0');
      const campaigns = ${JSON.stringify(MODES)}.map(mode => {
        const created = store.createGame({ name: 'john-' + mode, scenarioId: 'default', setActive: false,
          historicalStart: { ...${JSON.stringify(START)}, polityId: 'johns-realms', mode }, gamePatch: { country: 'johns-realms', difficulty: 'standard', language: 'Swedish' } });
        assert.equal(created.data.world.historicalScenario.contentVersion, '1.0.0');
        assert.equal(created.data.world.builtInRevision, 1);
        return { id: created.game.id, data: store.getGameDetails(created.game.id).data, bundle: store.exportGameBundle(created.game.id) };
      });
      keep({ campaigns, companion: store.exportScenarioBundle('default') });
    `, seed100);
    // The next start runs the 1.1.0 app: same map stamp, revision 2, so the built-in refreshes in place.
    run(`
      store.ensureScenarioStore();
      const world = store.getScenarioDetails('default').data.world;
      assert.equal(world.builtInMap, 'historical-john-1200-v1');
      assert.equal(world.builtInRevision, 2);
      assert.equal(world.historicalScenario.contentVersion, '1.1.0');
      assert.deepEqual(world.historicalScenario.playablePolityIds, ['johns-realms', 'khmer-angkor', 'almohad', 'france-capetian']);
      const { campaigns, companion: companion100 } = recall(), companion110 = store.exportScenarioBundle('default');
      for (const saved of campaigns) {
        const loaded = store.getGameDetails(saved.id);
        assert.equal(loaded.game.scenarioId, 'default', saved.id + ': the campaign stays on the built-in');
        assert.deepEqual(loaded.data, saved.data, saved.id + ': the campaign keeps its own 1.0.0 world');
        const bundle = store.exportGameBundle(saved.id);
        assert.deepEqual(bundle.data, saved.bundle.data);
        playsAYear(loaded.data.world, saved.id + ' loaded');
        for (const [label, companion] of [['1.1.0', companion110], ['1.0.0', companion100]]) {
          const restored = store.restoreGameBundle({ bundle, scenarioBundle: companion });
          assert.deepEqual(restored.data.world, bundle.data.world, saved.id + ' restored with ' + label);
          playsAYear(restored.data.world, saved.id + ' restored with ' + label);
        }
        const rebound = store.restoreScenarioForGame(saved.id, companion110);
        assert.deepEqual(rebound.data.world, saved.data.world, saved.id + ': its companion is restored from the 1.1.0 export');
        playsAYear(rebound.data.world, saved.id + ' rebound');
      }
      const khmer = store.createGame({ name: 'khmer', scenarioId: 'default', setActive: false,
        historicalStart: { ...${JSON.stringify(START)}, polityId: 'khmer-angkor', mode: 'realm' }, gamePatch: { country: 'khmer-angkor' } });
      assert.equal(khmer.data.world.characterSystem.offices.ruler.holderId, 'jayavarman-vii');
      playsAYear(khmer.data.world, 'new Khmer campaign');
    `);
    assert.equal(JSON.parse(readFileSync(path.join(root, 'kept.json'), 'utf8')).campaigns.length, MODES.length);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
