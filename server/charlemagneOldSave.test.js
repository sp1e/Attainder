import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { charlemagneRelease110 } from './fixtures/releaseFixtures.js';

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

const START = { date: '0800-12-25', seed: 7, difficulty: 'normal' };
const CAMPAIGNS = [['carolingian-realm', 'realm'], ['papal-states', 'family']];

test('a campaign started on the shipped Charlemagne 1.1.0 loads, restores from its companion and plays a year after the 1.2.0 upgrade', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'attainder-charlemagne-110-')), run = desktop(root);
  const releaseFile = path.join(root, 'charlemagne-800-1.1.0.json');
  writeFileSync(releaseFile, JSON.stringify(charlemagneRelease110()));
  try {
    // The 1.1.0 install: the start's marker stands and its copy is the bundle that release shipped.
    run(`
      store.ensureScenarioStore();
      store.deleteScenario('charlemagne-800');
      const release = JSON.parse(fs.readFileSync(${JSON.stringify(releaseFile)}, 'utf8'));
      assert.equal(store.importScenarioBundle(release, { setSelected: false }).scenario.id, 'charlemagne-800');
      assert.equal(store.getScenarioDetails('charlemagne-800').data.world.historicalScenario.contentVersion, '1.1.0');
      const campaigns = ${JSON.stringify(CAMPAIGNS)}.map(([polityId, mode]) => {
        const created = store.createGame({ name: polityId, scenarioId: 'charlemagne-800', setActive: false,
          historicalStart: { ...${JSON.stringify(START)}, polityId, mode }, gamePatch: { country: polityId, difficulty: 'standard', language: 'Swedish' } });
        assert.equal(created.data.world.historicalScenario.contentVersion, '1.1.0');
        return { id: created.game.id, data: store.getGameDetails(created.game.id).data, bundle: store.exportGameBundle(created.game.id) };
      });
      keep({ campaigns, companion: store.exportScenarioBundle('charlemagne-800') });
    `);
    // The next start of the app reads the library, which replaces the installed copy with 1.2.0.
    run(`
      store.ensureScenarioStore();
      assert.equal(store.getScenarioDetails('charlemagne-800').data.world.historicalScenario.contentVersion, '1.2.0');
      const { campaigns, companion: companion110 } = recall(), companion120 = store.exportScenarioBundle('charlemagne-800');
      assert.equal(companion120.data.world.historicalScenario.playablePolityIds.length, 10);
      const playsAYear = (world, label) => {
        const state = world.characterSystem, target = addGameMonths(state.date, 12);
        const year = advanceCharacters(state, target, { id: 'after-upgrade' });
        assert.equal(year.ok, true, label + ': ' + year.error);
        assert.equal(year.state.date, target, label);
        assert.equal(year.state.realm.id, state.realm.id, label);
      };
      for (const saved of campaigns) {
        const loaded = store.getGameDetails(saved.id);
        assert.equal(loaded.game.scenarioId, 'charlemagne-800');
        assert.deepEqual(loaded.data, saved.data, saved.id + ': the campaign keeps its own 1.1.0 world');
        assert.equal(loaded.data.world.historicalScenario.contentVersion, '1.1.0');
        const bundle = store.exportGameBundle(saved.id);
        assert.deepEqual(bundle.data, saved.bundle.data);
        playsAYear(loaded.data.world, saved.id + ' loaded');
        for (const [label, companion] of [['1.2.0', companion120], ['1.1.0', companion110]]) {
          const restored = store.restoreGameBundle({ bundle, scenarioBundle: companion });
          assert.deepEqual(restored.data.world, bundle.data.world, saved.id + ' restored with ' + label);
          playsAYear(restored.data.world, saved.id + ' restored with ' + label);
        }
        const rebound = store.restoreScenarioForGame(saved.id, companion120);
        assert.deepEqual(rebound.data.world, saved.data.world, saved.id + ': its companion is restored from the 1.2.0 export');
        playsAYear(rebound.data.world, saved.id + ' rebound');
      }
    `);
    assert.equal(JSON.parse(readFileSync(path.join(root, 'kept.json'), 'utf8')).campaigns.length, CAMPAIGNS.length);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
