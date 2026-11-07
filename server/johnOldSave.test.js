import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { johnRelease100, johnRelease110 } from './fixtures/releaseFixtures.js';
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
      return year.state;
    };
    ${body}
  `], { env, stdio: 'pipe', encoding: 'utf8' });
};

// The app as an older John release shipped it: the built-in scenario at that revision under the same map stamp.
function writeReleaseSeed(dir, release, revision) {
  cpSync(SEED_DIR, dir, { recursive: true });
  for (const [name, text] of Object.entries(defaultScenarioFiles(release, revision))) writeFileSync(path.join(dir, name), text);
}

const START = { date: '1200-12-31', seed: 7, difficulty: 'normal' };

// Starts `campaigns` on the built-in John `version` at `revision`, then starts today's app, which refreshes the
// built-in to 1.2.0 at revision 3. Every campaign must load, restore from both companions and play a year.
// `checks` runs inside the campaign loop of the second start with `saved` and `loaded` in scope.
function oldSaveFlow({ version, revision, release, campaigns, checks = '' }) {
  const root = mkdtempSync(path.join(os.tmpdir(), `attainder-john-${version.replaceAll('.', '')}-`)), run = desktop(root), seedDir = path.join(root, `seed-${version}`);
  writeReleaseSeed(seedDir, release, revision);
  try {
    run(`
      store.ensureScenarioStore();
      const world = store.getScenarioDetails('default').data.world;
      assert.equal(world.builtInMap, 'historical-john-1200-v1');
      assert.equal(world.builtInRevision, ${revision});
      assert.equal(world.historicalScenario.contentVersion, ${JSON.stringify(version)});
      const campaigns = ${JSON.stringify(campaigns)}.map(([polityId, mode]) => {
        const created = store.createGame({ name: polityId + '-' + mode, scenarioId: 'default', setActive: false,
          historicalStart: { ...${JSON.stringify(START)}, polityId, mode }, gamePatch: { country: polityId, difficulty: 'standard', language: 'Swedish' } });
        assert.equal(created.data.world.historicalScenario.contentVersion, ${JSON.stringify(version)});
        assert.equal(created.data.world.builtInRevision, ${revision});
        return { id: created.game.id, polityId, data: store.getGameDetails(created.game.id).data, bundle: store.exportGameBundle(created.game.id) };
      });
      keep({ campaigns, companion: store.exportScenarioBundle('default') });
    `, seedDir);
    // The next start runs the 1.2.0 app: same map stamp, revision 3, so the built-in refreshes in place.
    run(`
      store.ensureScenarioStore();
      const world = store.getScenarioDetails('default').data.world;
      assert.equal(world.builtInMap, 'historical-john-1200-v1');
      assert.equal(world.builtInRevision, 3);
      assert.equal(world.historicalScenario.contentVersion, '1.2.0');
      assert.deepEqual(world.historicalScenario.playablePolityIds, ['johns-realms', 'khmer-angkor', 'almohad', 'france-capetian']);
      const { campaigns, companion: companionOld } = recall(), companion120 = store.exportScenarioBundle('default');
      for (const saved of campaigns) {
        const loaded = store.getGameDetails(saved.id);
        assert.equal(loaded.game.scenarioId, 'default', saved.id + ': the campaign stays on the built-in');
        assert.deepEqual(loaded.data, saved.data, saved.id + ': the campaign keeps its own ${version} world');
        const bundle = store.exportGameBundle(saved.id);
        assert.deepEqual(bundle.data, saved.bundle.data);
        playsAYear(loaded.data.world, saved.id + ' loaded');
        for (const [label, companion] of [['1.2.0', companion120], [${JSON.stringify(version)}, companionOld]]) {
          const restored = store.restoreGameBundle({ bundle, scenarioBundle: companion });
          assert.deepEqual(restored.data.world, bundle.data.world, saved.id + ' restored with ' + label);
          playsAYear(restored.data.world, saved.id + ' restored with ' + label);
        }
        const rebound = store.restoreScenarioForGame(saved.id, companion120);
        assert.deepEqual(rebound.data.world, saved.data.world, saved.id + ': its companion is restored from the 1.2.0 export');
        playsAYear(rebound.data.world, saved.id + ' rebound');
        ${checks}
      }
      const khmer = store.createGame({ name: 'khmer', scenarioId: 'default', setActive: false,
        historicalStart: { ...${JSON.stringify(START)}, polityId: 'khmer-angkor', mode: 'realm' }, gamePatch: { country: 'khmer-angkor' } });
      assert.equal(khmer.data.world.characterSystem.offices.ruler.holderId, 'jayavarman-vii');
      playsAYear(khmer.data.world, 'new Khmer campaign');
    `);
    assert.equal(JSON.parse(readFileSync(path.join(root, 'kept.json'), 'utf8')).campaigns.length, campaigns.length);
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test('a campaign started on the built-in John 1.0.0 loads, restores from its companion and plays a year after the 1.2.0 refresh', () => {
  oldSaveFlow({ version: '1.0.0', revision: 1, release: johnRelease100(), campaigns: [['johns-realms', 'realm'], ['johns-realms', 'family']] });
});

test('a campaign started on the built-in John 1.1.0 loads, restores from its companion and plays a year after the 1.2.0 refresh', () => {
  // The Almohads keep the merit law their 1.1.0 world was started with.
  oldSaveFlow({ version: '1.1.0', revision: 2, release: johnRelease110(), campaigns: [['johns-realms', 'realm'], ['johns-realms', 'family'], ['almohad', 'realm']], checks: `
    if (saved.polityId === 'almohad') {
      assert.equal(loaded.data.world.characterSystem.realm.successionLaw, 'merit', 'the Almohads keep their 1.1.0 law');
      assert.equal(playsAYear(loaded.data.world, 'Almohads loaded').realm.successionLaw, 'merit', 'the Almohads play a year under merit');
    }
  ` });
});
