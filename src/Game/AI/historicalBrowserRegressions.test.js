/*! Open Historia - historical map and pregame browser regressions, AGPL-3.0-or-later (see LICENSE). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPromptRegionCatalog } from './promptRegionCatalog.js';
import { buildWorldSummary, buildPromptContext, filterToRenderedRegions } from './promptContext.js';
import { primeCustomRegionCatalogEntries } from '../../runtime/assets.js';
import { buildLookupContext, executeLookup } from './lookupTools.js';

const source = readFileSync(new URL('./gameplay.js', import.meta.url), 'utf8');
const start = source.indexOf('export const maybeGeneratePregameHistory = async () => {');
const end = source.indexOf('\nexport const ', start + 1);
assert.ok(start >= 0 && end > start);
const body = source.slice(start, end).replace('export const maybeGeneratePregameHistory', 'const maybeGeneratePregameHistory');

function harness({ initialId = '', switchId = initialId, switchWorld = {}, initialWorld = {} } = {}) {
  let id = initialId, calls = 0, reads = 0, reached = 0;
  const game = { startDate: '1200-12-31', gameDate: '1200-12-31' };
  const world = { startingTimelineText: 'Existing history', ...initialWorld };
  const deps = {
    isSimulationBusy: () => false, beginSimulation: () => {}, endSimulation: () => {}, activeCampaignId: () => id,
    readGameStateBundle: async () => { reads++; return { game, world, events: [] }; },
    normalizeString: v => String(v ?? '').trim(), normalizeEvents: v => v ?? [], normalizeWorldState: v => v,
    buildCurrentCanonicalPolityVocabulary: async () => [], buildTemplateVariables: async () => ({}),
    buildTaskLookups: () => null, runJsonTask: async () => { calls++; id = switchId; return { payload: { events: [{ title: 'event' }] } }; },
    readEventsState: async () => [], readWorldState: async () => ({ ...world, ...switchWorld }), readGameData: async () => game,
    normalizeArray: v => Array.isArray(v) ? v : [], normalizeGeneratedEvent: v => v, decodeWorldStorylineUpdates: () => { reached++; throw new Error('bootstrap reached'); }, console: { info() {}, error() {}, warn() {} },
  };
  return { run: new Function(...Object.keys(deps), `${body}\nreturn maybeGeneratePregameHistory;`)(...Object.values(deps)), counts: () => ({ calls, reads, reached }) };
}

test('scenario-only library never reads or calls the model for pregame history', async () => {
  const h = harness(); await h.run(); assert.deepEqual(h.counts(), { calls: 0, reads: 0, reached: 0 });
});
test('same-date campaign switch discards in-flight bootstrap before reading active data', async () => {
  const h = harness({ initialId: 'old', switchId: 'new', switchWorld: { characterSystem: {} } });
  await h.run(); assert.deepEqual(h.counts(), { calls: 1, reads: 1, reached: 0 });
});
test('same campaign acquiring historical characters discards in-flight bootstrap', async () => {
  const h = harness({ initialId: 'old', switchWorld: { characterSystem: {} } });
  await h.run(); assert.deepEqual(h.counts(), { calls: 1, reads: 1, reached: 0 });
});
test('legacy campaign remains eligible for automatic history', async () => {
  const h = harness({ initialId: 'old' }); await h.run(); assert.equal(h.counts().calls, 1); assert.equal(h.counts().reached, 1);
});

test('historical prompt and lookup catalog exclude residual modern features while retaining runtime owners', async () => {
  const scenario = [{ id: 'hbm-19', name: 'Nile', country: 'egypt' }, { id: 'hbm-20', name: 'Delta', country: 'egypt' }];
  const stock = [{ id: 'GHA.1_1', name: 'Ashanti', country: 'Ghana' }, { id: 'CHN.1_1', name: 'Hong Kong', country: 'China' }, { id: 'IND.1_1', name: 'Uttarakhand', country: 'India' }, { id: 'PAK.1_1', name: 'Gilgit-Baltistan', country: 'Pakistan' }];
  const world = { historicalScenario: { kind: 'historical' }, customRegions: true, regionOwnershipOverrides: { 'hbm-19': 'egypt', 'hbm-20': 'new-realm' }, polityOverrides: { egypt: { code: 'egypt', name: 'Egypt', aliases: [] }, 'new-realm': { code: 'new-realm', name: 'New Realm', aliases: [] } } };
  const load = () => buildPromptRegionCatalog(world, { loadScenario: async () => scenario, loadCombined: async () => [...scenario, ...stock] });
  const catalog = await load(); assert.deepEqual(catalog, scenario);
  const summary = await buildWorldSummary({ world, game: { country: 'egypt' }, events: [], chats: [] }, catalog);
  assert.match(summary, /New Realm/); assert.match(summary, /Nile/); assert.doesNotMatch(summary, /Ashanti|Hong Kong|Uttarakhand|Gilgit-Baltistan|Ghana|China|India|Pakistan/);
  const ctx = buildLookupContext({ regions: catalog, world, cities: [], events: [], chats: [], units: [] });
  assert.equal((await executeLookup(ctx, 'find_region', { name: 'Ashanti' })).matches?.length ?? 0, 0);
  assert.match(JSON.stringify(await executeLookup(ctx, 'find_region', { name: 'Nile' })), /Nile/);
  primeCustomRegionCatalogEntries(scenario);
  const variables = await buildPromptContext({ world, game: { country: 'egypt' }, events: [], chats: [] }, { requiredKeys: ['worldSummary'] });
  assert.match(variables.worldSummary, /Nile/);
  assert.doesNotMatch(variables.worldSummary, /Ashanti|Hong Kong|Uttarakhand|Gilgit-Baltistan/);
  assert.deepEqual(await buildPromptRegionCatalog({}, { loadScenario: async () => scenario, loadCombined: async () => [...scenario, ...stock] }), [...scenario, ...stock]);
});

test('historical scenario keeps its own stock-shaped IDs without an ownership override', () => {
  const rows = [{ id: 'GHA.1_1', name: 'Authored land', country: '' }, { id: 'hbm-19', name: 'Nile', country: 'egypt' }];
  assert.deepEqual(filterToRenderedRegions(rows, { customRegions: true, historicalScenario: { kind: 'historical' }, regionOwnershipOverrides: {} }, { scenarioOnly: true }), rows);
});
