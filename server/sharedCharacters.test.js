import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as shared from './characters/index.js';
import { addGameMonths } from './gameDates.js';
import { SHIPPED_START_FOLDERS } from '../src/runtime/testing/shippedHistoricalStarts.js';

const digest = state => createHash('sha256').update(JSON.stringify(state)).digest('hex');
const baselines = [
  [{}, 'b8e8360705c092d6dc38f74d765b262e83266fe1ab936cbbb31d4bb906c65d98', 'f72213bb4427b2734584a3da27ea0f6573790847975378a72278d9ad95855fe5', 104729, 2206754125],
  [{ seed: 321, mode: 'realm' }, '440588c359fd8aacd11b43956d60d11dc2a547908ef052cb13a7899cd311de6b', 'e1f5da663aa6ba3c9334215a9abd3bdd1851ede6f85ad8df7871aba6682e601d', 321, 2318062802],
  [{ seed: 321, mode: 'family' }, '1214759a50e420498311422357232502a59127524e6e6010fcfbff068c8700fd', '631aa7e30265a6ce707c2f72374cb960aacf4f3d9435eec8b5a15d47db7d26c8', 321, 2318062802],
];
for (const [options, initial, year, initialRng, yearRng] of baselines) test(`Hadara preflight complete-state parity ${JSON.stringify(options)}`, () => {
  const state = shared.createCharacterSystem(options);
  assert.equal(digest(state), initial);
  assert.equal(state.rngState, initialRng);
  const result = shared.advanceCharacters(state, addGameMonths(state.date, 12), { id: 'packaging-preflight-year' });
  assert.equal(result.ok, true, result.error);
  assert.equal(digest(result.state), year);
  assert.equal(result.state.rngState, yearRng);
});

test('client compatibility entries preserve the entire shared export surface and identity', async () => {
  const entries = ['gameDates.js', 'historicalStarts.js', 'historicalScenarios.js', ...fs.readdirSync(new URL('./characters/', import.meta.url)).filter(name => name.endsWith('.js')).map(name => `characters/${name}`)];
  for (const entry of entries) {
    const canonical = await import(new URL(entry, import.meta.url));
    const wrapper = await import(new URL(`../src/runtime/${entry}`, import.meta.url));
    assert.deepEqual(Object.keys(wrapper), Object.keys(canonical), entry);
    for (const key of Object.keys(canonical)) assert.equal(wrapper[key], canonical[key], `${entry}: ${key}`);
  }
});

test('installed layout validates and constructs both historical courts with no src tree', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'attainder-installed-'));
  try {
    fs.mkdirSync(path.join(fixture, 'server'));
    for (const name of ['characters', 'gameDates.js', 'historicalStarts.js', 'historicalScenarios.js']) fs.cpSync(new URL(`./${name}`, import.meta.url), path.join(fixture, 'server', name), { recursive: true });
    fs.writeFileSync(path.join(fixture, 'package.json'), JSON.stringify({ type: 'module' }));
    // Production dependency resolution only; no checkout source tree is linked.
    fs.symlinkSync(path.resolve('node_modules'), path.join(fixture, 'node_modules'), 'junction');
    assert.equal(fs.existsSync(path.join(fixture, 'src')), false);
    for (const id of SHIPPED_START_FOLDERS) {
      const directory = path.join(fixture, 'server', 'seed', 'historical', id);
      fs.mkdirSync(directory, { recursive: true });
      for (const name of ['scenario.json', 'regions.geojson', 'manifest.json']) fs.copyFileSync(new URL(`./seed/historical/${id}/${name}`, import.meta.url), path.join(directory, name));
    }
    const entry = path.join(fixture, 'smoke.mjs');
    fs.writeFileSync(entry, `import assert from 'node:assert/strict';
import { createCharacterSystem } from './server/characters/index.js';
import { createHistoricalCharacterSystem } from './server/characters/scenarioSeed.js';
import { HISTORICAL_BOOKMARKS, validateHistoricalStartDate } from './server/historicalStarts.js';
import { validateHistoricalScenario } from './server/historicalScenarios.js';
import fs from 'node:fs';
assert.equal(typeof validateHistoricalScenario, 'function');
assert.equal(validateHistoricalStartDate('1200-12-31').ok, true);
assert.equal(createCharacterSystem().realm.id, 'hadara');
const folders = ${JSON.stringify(SHIPPED_START_FOLDERS)};
// Every bookmark in the installed catalog is a copied package; John's package installs as the default start.
for (const { id } of HISTORICAL_BOOKMARKS) assert.ok(folders.includes(id), id);
for (const id of folders) {
  const load = name => JSON.parse(fs.readFileSync(new URL('./server/seed/historical/' + id + '/' + name, import.meta.url), 'utf8'));
  const { data } = load('scenario.json');
  const { historicalScenario } = data.world;
  const options = { historicalScenario, date: data.game.startDate, polityId: data.game.country };
  assert.equal(validateHistoricalScenario({ ...data, regions: load('regions.geojson'), assetManifest: load('manifest.json') }, options).ok, true);
  const state = createHistoricalCharacterSystem(options);
  assert.equal(state.historicalOrigin.contentId, id);
  assert.equal(state.offices.ruler.holderId, historicalScenario.courtSeeds[options.polityId].rulerId);
}`);
    assert.equal(execFileSync(process.execPath, [entry], { encoding: 'utf8' }), '');
  } finally { fs.rmSync(fixture, { recursive: true, force: true }); }
});
