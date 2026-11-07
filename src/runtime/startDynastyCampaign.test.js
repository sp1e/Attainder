import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import * as campaignSeed from './campaignSeed.js';
import * as startOptions from './historicalStartOptions.js';
import { historicalStartSummary } from '../../server/historicalStartSummary.js';

// The catalog as both library stores return it: each scenario with its historicalSummary.
const summaryOf = folder => {
  const b = JSON.parse(readFileSync(new URL(`../../server/seed/historical/${folder}/scenario.json`, import.meta.url), 'utf8'));
  return historicalStartSummary({ meta: b.scenario, data: b.data });
};
const CHARLEMAGNE = summaryOf('charlemagne-800');
const entry = (id, historicalSummary, extra = {}) => ({ id, historicalSummary, historicalStart: { date: historicalSummary.date }, ...extra });

// A library.js that counts every call, so a test can say which reads a start made.
function fakeLibrary(scenarios) {
  const calls = { catalog: 0, details: 0, assets: 0, create: [], activate: [] };
  const library = {
    ensureLibraryCatalog: async () => { calls.catalog += 1; return { scenarios }; },
    loadScenarioDetails: async () => { calls.details += 1; throw new Error('loadScenarioDetails is not for the start card'); },
    downloadScenarioJsonAsset: async () => { calls.assets += 1; throw new Error('downloadScenarioJsonAsset is not for the start card'); },
    createGame: async request => { calls.create.push(request); return { game: { id: 'game-1' } }; },
    activateGame: async id => { calls.activate.push(id); },
  };
  return { library, calls };
}

function loadStart(library) {
  const module = { exports: {} };
  const modules = { './library.js': library, './campaignSeed.js': campaignSeed, './historicalStartOptions.js': startOptions };
  const code = transformSync(readFileSync(new URL('./startDynastyCampaign.js', import.meta.url), 'utf8'), { loader: 'js', format: 'cjs' }).code;
  vm.runInNewContext(code, { module, exports: module.exports, localStorage: { getItem: () => null, setItem: () => {} },
    require: id => { assert.ok(id in modules, `Unexpected import: ${id}`); return modules[id]; } });
  return module.exports;
}

test('the start options come from the catalog summaries without loading any scenario', async () => {
  const { library, calls } = fakeLibrary([
    entry('egypt-3000bc', summaryOf('egypt-3000bc')), entry('default', summaryOf('john-1200')), entry('charlemagne-800', CHARLEMAGNE),
    { id: 'modern', historicalSummary: null, historicalStart: null },
  ]);
  const options = await loadStart(library).loadHistoricalStartOptions();
  assert.deepEqual([...options].map(o => o.scenarioId), ['charlemagne-800', 'default', 'egypt-3000bc']);
  assert.deepEqual([...options].map(o => o.eraId), ['early-middle-ages', 'high-middle-ages', 'bronze-age']);
  assert.equal(calls.catalog, 1);
  assert.equal(calls.details, 0, 'no loadScenarioDetails');
  assert.equal(calls.assets, 0, 'no downloadScenarioJsonAsset');
});

test('a start with an invalid summary or a restore-only copy is left off the card', async () => {
  const { library } = fakeLibrary([
    entry('charlemagne-800', CHARLEMAGNE),
    { id: 'broken', historicalSummary: { schema: 1, sourceStamp: null, invalid: true }, historicalStart: { date: '0800-12-25' } },
    entry('restored', CHARLEMAGNE, { restoreOnly: true }),
    entry('old-schema', { ...CHARLEMAGNE, schema: 0 }),
  ]);
  const options = await loadStart(library).loadHistoricalStartOptions();
  assert.deepEqual([...options].map(o => o.scenarioId), ['charlemagne-800']);
});

test('two copies of one start both show, and the copy starts the copy without a second catalog read', async () => {
  const { library, calls } = fakeLibrary([entry('charlemagne-800', CHARLEMAGNE), entry('charlemagne-800-copy', CHARLEMAGNE)]);
  const mod = loadStart(library);
  const options = await mod.loadHistoricalStartOptions();
  assert.deepEqual([...options].map(o => o.scenarioId), ['charlemagne-800', 'charlemagne-800-copy']);
  const copy = options.find(o => o.scenarioId === 'charlemagne-800-copy');
  await mod.startDynastyCampaign({ option: copy, polityId: 'papal-states', mode: 'realm' });
  assert.equal(calls.catalog, 1, 'the start used the chosen option');
  assert.equal(calls.create.length, 1);
  const request = calls.create[0];
  assert.equal(request.scenarioId, 'charlemagne-800-copy');
  assert.equal(request.name, 'Kyrkostaten, 800 e.Kr. · Riket');
  assert.equal(request.historicalStart.polityId, 'papal-states');
  assert.equal(request.historicalStart.date, '0800-12-25');
  assert.deepEqual(calls.activate, ['game-1']);
});

test('without an option the start reads the catalog and takes the named scenario', async () => {
  const { library, calls } = fakeLibrary([entry('charlemagne-800', CHARLEMAGNE), entry('charlemagne-800-copy', CHARLEMAGNE)]);
  await loadStart(library).startDynastyCampaign({ scenarioId: 'charlemagne-800-copy', mode: 'family', familyId: 'x' });
  assert.equal(calls.catalog, 1);
  assert.equal(calls.create[0].scenarioId, 'charlemagne-800-copy');
  assert.equal(calls.create[0].historicalStart.polityId, 'carolingian-realm');
  assert.equal(calls.create[0].name, 'Karls rike (karolingiska riket), 800 e.Kr. · Familjen');
  await assert.rejects(loadStart(fakeLibrary([]).library).startDynastyCampaign({}), /inget giltigt historiskt scenario/);
});
