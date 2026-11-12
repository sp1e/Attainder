/*! Open Historia - historical prompt and lookup wiring regressions, AGPL-3.0-or-later (see LICENSE). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPromptRegionCatalog } from './promptRegionCatalog.js';
import { buildWorldSummary, filterToRenderedRegions, playerPolityLabel } from './promptContext.js';
import { normalizeWorldState } from '../../runtime/gameState.js';
import { buildLookupContext, executeLookup } from './lookupTools.js';

const promptSource = readFileSync(new URL('./promptContext.js', import.meta.url), 'utf8');
const gameplaySource = readFileSync(new URL('./gameplay.js', import.meta.url), 'utf8');
const scenario = [
  { id: 'hbm-19', name: 'Nile', country: 'egypt' },
  { id: 'hbm-20', name: 'Delta', country: 'egypt' },
  { id: 'USA.1_1', name: 'Uncertain Shore', country: '' },
];
const stock = [
  { id: 'GHA.1_1', name: 'Ashanti', country: 'Ghana' },
  { id: 'CHN.1_1', name: 'Hong Kong', country: 'China' },
  { id: 'IND.1_1', name: 'Uttarakhand', country: 'India' },
  { id: 'PAK.1_1', name: 'Gilgit-Baltistan', country: 'Pakistan' },
];
const world = { historicalScenario: { kind: 'historical' }, customRegions: true,
  regionOwnershipOverrides: { 'hbm-19': 'egypt', 'hbm-20': 'new-realm' },
  polityOverrides: { egypt: { code: 'egypt', name: 'Egypt', aliases: [] }, 'new-realm': { code: 'new-realm', name: 'New Realm', aliases: [] } } };
const scenarioGeometry = { type: 'FeatureCollection', features: scenario.map((row, index) => ({
  type: 'Feature', properties: { id: row.id, name: row.name, owner: row.country },
  geometry: { type: 'Polygon', coordinates: [[[index, 0], [index + 0.8, 0], [index + 0.8, 0.8], [index, 0]]] },
})) };
const bundle = w => ({ world: w, game: { country: 'egypt' }, events: [], chats: [] });
const normalizeString = v => String(v ?? '').trim();
const normalizeArray = v => Array.isArray(v) ? v : [];
const loadScenario = async () => scenario;
const loadRegionCatalog = async () => [...scenario, ...stock];
const selectCatalog = w => buildPromptRegionCatalog(w, { loadScenario, loadCombined: loadRegionCatalog });

// Execute the production assembly functions with the real selector, summary and
// lookup engine; replace only their I/O boundaries with a scenario and stock catalog.
const loaderAt = promptSource.indexOf('const loadRegions = async');
const loaderEnd = promptSource.indexOf('\n', loaderAt);
const promptAt = promptSource.indexOf('export const buildPromptContext = async');
assert.ok(loaderAt >= 0 && promptAt > loaderAt);
const promptCode = `${promptSource.slice(loaderAt, loaderEnd)}\n${promptSource.slice(promptAt).replace('export const buildPromptContext', 'const buildPromptContext')}\nreturn buildPromptContext;`;
const assemblePrompt = new Function('buildPromptRegionCatalog', 'loadRegionCatalog', 'normalizeArray', 'normalizeString', 'buildWorldSummary', 'playerPolityLabel', promptCode)(selectCatalog, loadRegionCatalog, normalizeArray, normalizeString, buildWorldSummary, playerPolityLabel);

const lookupAt = gameplaySource.indexOf('const buildTaskLookups =');
const lookupEnd = gameplaySource.indexOf('// The places a text names', lookupAt);
assert.ok(lookupAt >= 0 && lookupEnd > lookupAt);
const lookupCode = `${gameplaySource.slice(lookupAt, lookupEnd)}\nreturn buildTaskLookups;`;
const deps = { lookupFunctionsEnabled: () => true, SIMULATION_AUDIENCE: 'simulation', LOOKUP_TOOLS: [],
  normalizeWorldState, normalizeArray, normalizeString, buildPromptRegionCatalog: selectCatalog, loadRegionCatalog,
  readJson: async url => url === 'regions' ? scenarioGeometry : { features: [] }, JSON_URLS: { regionsGeojson: 'regions', citiesGeojson: 'cities' },
  filterToRenderedRegions, buildLookupContext, executeLookup };
const assembleLookups = new Function(...Object.keys(deps), lookupCode)(...Object.values(deps));

test('actual historical prompt and lookup assembly excludes stock rows and keeps scenario regions and runtime owner', async () => {
  const b = bundle(world);
  const result = await assemblePrompt(b, { requiredKeys: ['worldSummary'] });
  assert.match(result.worldSummary, /Nile/);
  assert.match(result.worldSummary, /New Realm/);
  assert.doesNotMatch(result.worldSummary, /Ashanti|Hong Kong|Uttarakhand|Gilgit-Baltistan|Ghana|China|India|Pakistan/);
  const lookup = assembleLookups(b);
  for (const name of ['Ashanti', 'Hong Kong', 'Uttarakhand', 'Gilgit-Baltistan']) {
    assert.equal((await lookup.execute('find_region', { name })).matches.length, 0, name);
  }
  assert.equal((await lookup.execute('find_region', { name: 'Uncertain Shore' })).bestMatch.name, 'Uncertain Shore');
  const delta = await lookup.execute('find_region', { name: 'Delta' });
  assert.match(JSON.stringify(delta), /new-realm/i);
});

test('same actual assembly retains stock rows for a legacy map', async () => {
  const b = bundle({ customRegions: false });
  const result = await assemblePrompt(b, { requiredKeys: ['worldSummary'] });
  assert.match(result.worldSummary, /Ghana/);
  const ashanti = await assembleLookups(b).execute('find_region', { name: 'Ashanti' });
  assert.equal(ashanti.bestMatch.name, 'Ashanti');
});
