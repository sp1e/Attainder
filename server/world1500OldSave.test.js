import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { world1500Release100 } from './fixtures/releaseFixtures.js';

const moduleUrl = file => JSON.stringify(new URL(file, import.meta.url).href);
// Each run is one start of the desktop app on the same data folder. `keep` hands values to the next run.
const desktop = root => body => execFileSync(process.execPath, ['--input-type=module', '-e', `
  import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path';
  import * as store from ${moduleUrl('./libraryStore.js')};
  import { advanceCharacters } from ${moduleUrl('./characters/index.js')};
  import { addGameMonths } from ${moduleUrl('./gameDates.js')};
  const kept = path.join(${JSON.stringify(root)}, 'kept.json');
  const keep = value => fs.writeFileSync(kept, JSON.stringify(value));
  const recall = () => JSON.parse(fs.readFileSync(kept, 'utf8'));
  ${body}
`], { env: { ...process.env, OH_DATA_DIR: path.join(root, 'data') }, stdio: 'pipe', encoding: 'utf8' });

const START = { date: '1500-12-31', seed: 7, difficulty: 'normal' };
const CAMPAIGNS = [['inca-empire', 'realm'], ['aztec-empire', 'family']];

test('a campaign started on the shipped world-1500 1.0.0 loads, restores from its companion and plays a year after the 1.2.0 upgrade', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'attainder-world1500-100-')), run = desktop(root);
  const releaseFile = path.join(root, 'world-1500-1.0.0.json');
  writeFileSync(releaseFile, JSON.stringify(world1500Release100()));
  try {
    // The 1.0.0 install: the start's marker stands and its copy is the bundle that release shipped.
    run(`
      store.ensureScenarioStore();
      store.deleteScenario('world-1500');
      const release = JSON.parse(fs.readFileSync(${JSON.stringify(releaseFile)}, 'utf8'));
      assert.equal(store.importScenarioBundle(release, { setSelected: false }).scenario.id, 'world-1500');
      assert.equal(store.getScenarioDetails('world-1500').data.world.historicalScenario.contentVersion, '1.0.0');
      const campaigns = ${JSON.stringify(CAMPAIGNS)}.map(([polityId, mode]) => {
        const created = store.createGame({ name: polityId, scenarioId: 'world-1500', setActive: false,
          historicalStart: { ...${JSON.stringify(START)}, polityId, mode }, gamePatch: { country: polityId, difficulty: 'standard', language: 'Swedish' } });
        assert.equal(created.data.world.historicalScenario.contentVersion, '1.0.0');
        return { id: created.game.id, polityId, data: store.getGameDetails(created.game.id).data, bundle: store.exportGameBundle(created.game.id) };
      });
      keep({ campaigns, companion: store.exportScenarioBundle('world-1500') });
    `);
    // The next start of the app reads the library, which replaces the installed copy with 1.2.0.
    run(`
      store.ensureScenarioStore();
      assert.equal(store.getScenarioDetails('world-1500').data.world.historicalScenario.contentVersion, '1.2.0');
      const { campaigns, companion: companion100 } = recall(), companion120 = store.exportScenarioBundle('world-1500');
      assert.deepEqual(companion120.data.world.historicalScenario.playablePolityIds, ['aztec-empire', 'inca-empire']);
      const playsAYear = (world, label) => {
        const state = world.characterSystem, target = addGameMonths(state.date, 12);
        const year = advanceCharacters(state, target, { id: 'after-upgrade' });
        assert.equal(year.ok, true, label + ': ' + year.error);
        assert.equal(year.state.date, target, label);
        assert.equal(year.state.realm.id, state.realm.id, label);
        return year.state;
      };
      for (const saved of campaigns) {
        const loaded = store.getGameDetails(saved.id);
        assert.equal(loaded.game.scenarioId, 'world-1500');
        assert.deepEqual(loaded.data, saved.data, saved.id + ': the campaign keeps its own 1.0.0 world');
        assert.equal(loaded.data.world.historicalScenario.contentVersion, '1.0.0');
        const bundle = store.exportGameBundle(saved.id);
        assert.deepEqual(bundle.data, saved.bundle.data);
        playsAYear(loaded.data.world, saved.id + ' loaded');
        for (const [label, companion] of [['1.2.0', companion120], ['1.0.0', companion100]]) {
          const restored = store.restoreGameBundle({ bundle, scenarioBundle: companion });
          assert.deepEqual(restored.data.world, bundle.data.world, saved.id + ' restored with ' + label);
          playsAYear(restored.data.world, saved.id + ' restored with ' + label);
        }
        const rebound = store.restoreScenarioForGame(saved.id, companion120);
        assert.deepEqual(rebound.data.world, saved.data.world, saved.id + ': its companion is restored from the 1.2.0 export');
        playsAYear(rebound.data.world, saved.id + ' rebound');
        // Inkariket keeps the primogeniture its 1.0.0 world was started with.
        if (saved.polityId === 'inca-empire') {
          assert.equal(loaded.data.world.characterSystem.realm.successionLaw, 'primogeniture', 'Inkariket keeps its 1.0.0 law');
          assert.equal(playsAYear(loaded.data.world, 'Inkariket loaded').realm.successionLaw, 'primogeniture', 'Inkariket plays a year under primogeniture');
        }
      }
    `);
    assert.equal(JSON.parse(readFileSync(path.join(root, 'kept.json'), 'utf8')).campaigns.length, CAMPAIGNS.length);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
