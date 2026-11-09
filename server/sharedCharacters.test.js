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
  [{}, '8998d87d357e09e5a15409d28b8407baeb258c03ccd025f6abc564be6728328d', '0592b6ea3f323b54acd7b22c4b8e613080e299c12e43f227f199ab7aa9ec60ff', 104729, 2206754125],
  [{ seed: 321, mode: 'realm' }, '5d663a3450a3534a6c60c9b484a517606a81dfe3a4f69768d5dfcc24039f5eac', 'b651b71991923fd444f96a68874b9e6f6ba82ec1cca0b79cee99c7f2593ceb0a', 321, 2318062802],
  [{ seed: 321, mode: 'family' }, '1502f96366fbb39cc0f4247c7c8d11b4363c1767cbba3baf73a61f5fc59c95a2', '8d499786d58c6484f4d586dacc718be6bd1a7ade62c211682a0464471ce752de', 321, 2318062802],
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
