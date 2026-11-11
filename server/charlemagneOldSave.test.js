import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { charlemagneRelease110, charlemagneRelease120, charlemagneRelease130 } from './fixtures/releaseFixtures.js';

const moduleUrl = file => JSON.stringify(new URL(file, import.meta.url).href);
// Each run is one start of the desktop app on the same data folder. `keep` hands values to the next run.
const desktop = root => body => execFileSync(process.execPath, ['--input-type=module', '-e', `
  import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path';
  import * as store from ${moduleUrl('./libraryStore.js')};
  import { advanceCharacters, normalizeCharacterSystem } from ${moduleUrl('./characters/index.js')};
  import { addGameMonths } from ${moduleUrl('./gameDates.js')};
  const kept = path.join(${JSON.stringify(root)}, 'kept.json');
  const keep = value => fs.writeFileSync(kept, JSON.stringify(value));
  const recall = () => JSON.parse(fs.readFileSync(kept, 'utf8'));
  ${body}
`], { env: { ...process.env, OH_DATA_DIR: path.join(root, 'data') }, stdio: 'pipe', encoding: 'utf8' });

const START = { date: '0800-12-25', seed: 7, difficulty: 'normal' };

// Installs `release` as the Charlemagne start, starts `campaigns` on it, then starts the app again, which upgrades
// the start to 1.4.0. Every campaign must load, restore from both companions and play a year. `checks` runs inside
// the campaign loop of the second start with `saved`, `loaded`, `bundle`, `companion140` and `playsAYear` in scope.
function oldSaveFlow({ version, release, campaigns, checks = '' }) {
  const root = mkdtempSync(path.join(os.tmpdir(), `attainder-charlemagne-${version.replaceAll('.', '')}-`)), run = desktop(root);
  const releaseFile = path.join(root, `charlemagne-800-${version}.json`);
  writeFileSync(releaseFile, JSON.stringify(release));
  try {
    // The old install: the start's marker stands and its copy is the bundle that release shipped.
    run(`
      store.ensureScenarioStore();
      store.deleteScenario('charlemagne-800');
      const release = JSON.parse(fs.readFileSync(${JSON.stringify(releaseFile)}, 'utf8'));
      assert.equal(store.importScenarioBundle(release, { setSelected: false }).scenario.id, 'charlemagne-800');
      assert.equal(store.getScenarioDetails('charlemagne-800').data.world.historicalScenario.contentVersion, ${JSON.stringify(version)});
      const campaigns = ${JSON.stringify(campaigns)}.map(([polityId, mode]) => {
        const created = store.createGame({ name: polityId, scenarioId: 'charlemagne-800', setActive: false,
          historicalStart: { ...${JSON.stringify(START)}, polityId, mode }, gamePatch: { country: polityId, difficulty: 'standard', language: 'Swedish' } });
        assert.equal(created.data.world.historicalScenario.contentVersion, ${JSON.stringify(version)});
        return { id: created.game.id, polityId, data: store.getGameDetails(created.game.id).data, bundle: store.exportGameBundle(created.game.id) };
      });
      keep({ campaigns, companion: store.exportScenarioBundle('charlemagne-800') });
    `);
    // The next start of the app reads the library, which replaces the installed copy with 1.4.0.
    run(`
      store.ensureScenarioStore();
      assert.equal(store.getScenarioDetails('charlemagne-800').data.world.historicalScenario.contentVersion, '1.4.0');
      const { campaigns, companion: companionOld } = recall(), companion140 = store.exportScenarioBundle('charlemagne-800');
      assert.equal(companion140.data.world.historicalScenario.playablePolityIds.length, 10);
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
        assert.equal(loaded.game.scenarioId, 'charlemagne-800');
        assert.deepEqual(loaded.data, saved.data, saved.id + ': the campaign keeps its own ${version} world');
        assert.equal(loaded.data.world.historicalScenario.contentVersion, ${JSON.stringify(version)});
        const bundle = store.exportGameBundle(saved.id);
        assert.deepEqual(bundle.data, saved.bundle.data);
        playsAYear(loaded.data.world, saved.id + ' loaded');
        for (const [label, companion] of [['1.4.0', companion140], [${JSON.stringify(version)}, companionOld]]) {
          const restored = store.restoreGameBundle({ bundle, scenarioBundle: companion });
          assert.deepEqual(restored.data.world, bundle.data.world, saved.id + ' restored with ' + label);
          playsAYear(restored.data.world, saved.id + ' restored with ' + label);
        }
        const rebound = store.restoreScenarioForGame(saved.id, companion140);
        assert.deepEqual(rebound.data.world, saved.data.world, saved.id + ': its companion is restored from the 1.4.0 export');
        playsAYear(rebound.data.world, saved.id + ' rebound');
        ${checks}
      }
    `);
    assert.equal(JSON.parse(readFileSync(path.join(root, 'kept.json'), 'utf8')).campaigns.length, campaigns.length);
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test('a campaign started on the shipped Charlemagne 1.1.0 loads, restores from its companion and plays a year after the 1.4.0 upgrade', () => {
  oldSaveFlow({ version: '1.1.0', release: charlemagneRelease110(), campaigns: [['carolingian-realm', 'realm'], ['papal-states', 'family']] });
});

test('a campaign started on the shipped Charlemagne 1.2.0 loads, restores from its companion and plays a year after the 1.4.0 upgrade', () => {
  // Kyrkostaten keeps the merit law its 1.2.0 world was started with. A save written before Phase 5 has no realm
  // kind: a copy without it restores and plays a year as a state.
  oldSaveFlow({ version: '1.2.0', release: charlemagneRelease120(), campaigns: [['papal-states', 'realm'], ['kingdom-of-asturias', 'family']], checks: `
    if (saved.polityId === 'papal-states') {
      assert.equal(loaded.data.world.characterSystem.realm.successionLaw, 'merit', 'Kyrkostaten keeps its 1.2.0 law');
      assert.equal(playsAYear(loaded.data.world, 'Kyrkostaten loaded').realm.successionLaw, 'merit', 'Kyrkostaten plays a year under merit');
      const stripped = JSON.parse(JSON.stringify(bundle));
      delete stripped.data.world.characterSystem.realm.kind;
      const restored = store.restoreGameBundle({ bundle: stripped, scenarioBundle: companion140 });
      assert.deepEqual(restored.data.world, stripped.data.world, 'the store keeps the save as written');
      // The game reads a saved character system through normalizeCharacterSystem, which adds the kind.
      const migrated = normalizeCharacterSystem(restored.data.world.characterSystem);
      assert.equal(migrated.realm.kind, 'state', 'a save without a realm kind rules a state');
      const year = playsAYear({ characterSystem: migrated }, 'Kyrkostaten without a realm kind');
      assert.equal(year.realm.kind, 'state');
      assert.equal(year.realm.successionLaw, 'merit');
    }
  ` });
});

test('a campaign started on the shipped Charlemagne 1.3.0 loads, restores from its companion and plays a year after the 1.4.0 upgrade', () => {
  oldSaveFlow({ version: '1.3.0', release: charlemagneRelease130(), campaigns: [['carolingian-realm', 'realm'], ['papal-states', 'family']] });
});
