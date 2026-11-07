import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as shared from './characters/index.js';
import { addGameMonths } from './gameDates.js';

const digest = state => createHash('sha256').update(JSON.stringify(state)).digest('hex');
const baselines = [
  [{}, '44fde375a2a9bacc99e7edf803fb0e05fa6b5a67c57b5870ce58a214ed59d15d', 'fe262d2a3891f3de0299973acb5cda00ef63ab000b8eef1185ab3f87d02d4834', 104729, 2206754125],
  [{ seed: 321, mode: 'realm' }, 'ddc8235a0426367e48aa5743d8536c7c2d52ac7c80f6e43270e54228bd75864f', 'a3d478f43ed5a92fb212b49a5b628a0c37711afcdf4cef8e0fdc4e7606dbf3dd', 321, 2318062802],
  [{ seed: 321, mode: 'family' }, 'b41c3c65f44b5c69c5a73c8f7315d8331e36dcaecc868e63e9efc364870a2003', 'dab52a7f0a2c975cc9d90ce2c7723c7d432367c0039a0d5bab0dc6c7fbe75655', 321, 2318062802],
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
    for (const id of ['egypt-3000bc', 'john-1200', 'charlemagne-800']) {
      const directory = path.join(fixture, 'server', 'seed', 'historical', id);
      fs.mkdirSync(directory, { recursive: true });
      for (const name of ['scenario.json', 'regions.geojson', 'manifest.json']) fs.copyFileSync(new URL(`./seed/historical/${id}/${name}`, import.meta.url), path.join(directory, name));
    }
    const entry = path.join(fixture, 'smoke.mjs');
    fs.writeFileSync(entry, `import assert from 'node:assert/strict';
import { createCharacterSystem } from './server/characters/index.js';
import { createHistoricalCharacterSystem } from './server/characters/scenarioSeed.js';
import { validateHistoricalStartDate } from './server/historicalStarts.js';
import { validateHistoricalScenario } from './server/historicalScenarios.js';
import fs from 'node:fs';
assert.equal(typeof validateHistoricalScenario, 'function');
assert.equal(validateHistoricalStartDate('1200-12-31').ok, true);
assert.equal(createCharacterSystem().realm.id, 'hadara');
for (const id of ['egypt-3000bc', 'john-1200', 'charlemagne-800']) {
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
