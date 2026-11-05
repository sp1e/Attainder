import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePolityIdentity } from './polityIdentity.js';
import { resolvePolityFlag } from './polityFlags.js';
import { resolveCityLayerSource } from './cityFeatures.js';
import { mergeStockAndDeclaredPolities } from './countryList.js';
import { hasExactRegionTileIdentity } from '../Game/Map/vnext/regionTileAuthority.js';
const world = { historicalScenario: { kind: 'historical', polities: [{id:'egypt',nameSv:'Egypt'}] }, polityOverrides: { egypt: { name: 'Egypt', mapRefs: { gadm0: ['EGY'] } } } };
test('historical identity does not revive a modern stock country', () => {
  assert.equal(resolvePolityIdentity('Sweden',world,{ allowUnknown: false }).status,'unresolved');
  assert.equal(resolvePolityIdentity('Sweden',{}, { allowUnknown: false }).status,'stock-base');
});
test('historical flags require scenario evidence, including names that match modern countries', () => {
  assert.equal(resolvePolityFlag({ polity: 'egypt',world }).imageUrl,null);
  assert.equal(resolvePolityFlag({ polity: 'egypt',world,flags: { egypt: 'data:image/png;base64,abc' } }).source,'custom');
});
test('missing historical city data fails closed instead of revealing modern cities', () => {
  assert.equal(resolveCityLayerSource({ customCities: false, collection: { features: [] },readSucceeded: false,historical: true }),'custom');
  assert.equal(resolveCityLayerSource({ customCities: true, collection: null,readSucceeded: false,historical: true }),'loading');
  assert.equal(resolveCityLayerSource({ customCities: true, collection: { features: [] },readSucceeded: false }),'stock');
});
test('close zoom never hands historical geometry to modern matching tile ids', () => {
  assert.equal(hasExactRegionTileIdentity([{ id: 'EGY.1' }],new Set(['EGY.1']),{ historical: true }),false);
  assert.equal(hasExactRegionTileIdentity([{ id: 'EGY.1' }],new Set(['EGY.1'])),true);
});
test('historical country lists exclude modern stock and unknown background regions', () => {
  const modern = [{ code: 'SWE',name: 'Sweden' }];
  assert.deepEqual(mergeStockAndDeclaredPolities(modern,world,{ resolvePolityIdentity }),[{ code: 'egypt',name: 'Egypt' }]);
  assert.equal(mergeStockAndDeclaredPolities(modern,{},{}).length,1);
});
