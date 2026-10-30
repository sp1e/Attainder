import test from 'node:test';
import assert from 'node:assert/strict';
import { getPortraitAsset, portraitAssetKey } from './portraitAssets.js';
import manifest from './portrait-manifest.json' with { type: 'json' };
import { PORTRAIT_STATES, PORTRAIT_AGE_GROUPS } from './portraitState.js';

const entry = { src: '/dynasties/portraits/variants/person-0-0.png', width: 2016, height: 2688,
  rowBounds: [0,387,776,1239,1687,2148,2688], columnBounds: [0,336,672,1008,1344,1680,2016] };
const atlases = { layout: { states: PORTRAIT_STATES, ageGroups: PORTRAIT_AGE_GROUPS }, characters: { 'person-0-0': entry } };
const person = (visualState = 'healthy', ageGroup = 'adult') => ({ id: 'person-0-0', name: 'Arel', age: 54, portraitState: { identityId: 'person-0-0', fallbackIdentityId: 'person-0-0', visualState, ageGroup, lifeStatus: 'alive' } });

test('a healthy original keeps its authored identity and age instead of unnecessarily switching images', () => {
  const asset = getPortraitAsset(person(), { atlases });
  assert.equal(asset.kind, 'image');
  assert.equal(asset.src, '/dynasties/portraits/person-0-0.png');
  assert.equal(asset.missingVariant, false);
});
test('smallpox, recovery and scars select distinct exact rectangles in uneven atlas rows', () => {
  const illness = getPortraitAsset(person('smallpox'), { atlases });
  assert.deepEqual(illness.rect, { x: 336, y: 776, width: 336, height: 463 });
  assert.equal(getPortraitAsset(person('smallpox-recovering'), { atlases }).rect.x, 672);
  assert.equal(getPortraitAsset(person('smallpox-scars'), { atlases }).rect.x, 1008);
  assert.equal(illness.identityId, 'person-0-0');
});
test('aging changes the portrait stage without replacing the seed identity', () => {
  const aged = getPortraitAsset(person('healthy', 'elder'), { atlases });
  assert.equal(aged.kind, 'atlas');
  assert.deepEqual(aged.rect, { x: 0, y: 1687, width: 336, height: 461 });
  assert.equal(aged.sourceIdentityId, 'person-0-0');
});
test('missing and malformed atlases fall back to the same original and report the missing variant', () => {
  for (const characters of [{}, { 'person-0-0': { ...entry, rowBounds: [0, 1] } }, { 'person-0-0': { ...entry, src: 'https://example.com/portrait.png' } }]) {
    const asset = getPortraitAsset(person('smallpox'), { atlases: { ...atlases, characters } });
    assert.equal(asset.src, '/dynasties/portraits/person-0-0.png');
    assert.equal(asset.missingVariant, true);
  }
});
test('future people may use only an explicitly known shared identity and do not become that person', () => {
  const next = { id: 'born-101', name: 'Sela', portraitState: { identityId: 'born-101', fallbackIdentityId: 'person-0-0', ageGroup: 'child', visualState: 'fever' } };
  const asset = getPortraitAsset(next, { atlases });
  assert.equal(asset.identityId, 'born-101');
  assert.equal(asset.sourceIdentityId, 'person-0-0');
  assert.equal(asset.usesSharedFallback, true);
  assert.equal(getPortraitAsset({ id: '../../secret', portraitState: { fallbackIdentityId: 'https://example.com/x' } }), null);
});
test('all 24 identities and 36 state-age combinations resolve to in-bounds assets', () => {
  const all = { ...atlases, characters: Object.fromEntries(manifest.people.map((p) => [p.id, { ...entry, src: `/dynasties/portraits/variants/${p.id}.png` }])) };
  let count = 0;
  for (const original of manifest.people) for (const ageGroup of PORTRAIT_AGE_GROUPS) for (const visualState of PORTRAIT_STATES) {
    const asset = getPortraitAsset({ ...original, portraitState: { identityId: original.id, ageGroup, visualState } }, { atlases: all });
    assert.equal(asset.identityId, original.id);
    if (asset.kind === 'atlas') {
      assert.ok(asset.rect.x >= 0 && asset.rect.y >= 0);
      assert.ok(asset.rect.x + asset.rect.width <= asset.width);
      assert.ok(asset.rect.y + asset.rect.height <= asset.height);
    }
    count++;
  }
  assert.equal(count, 864);
});
test('portrait keys change for state and identity; deceased labels remain attached to the same face', () => {
  const a = getPortraitAsset(person('smallpox'), { atlases });
  const b = getPortraitAsset(person('smallpox-scars'), { atlases });
  assert.notEqual(portraitAssetKey(a), portraitAssetKey(b));
  const dead = person('smallpox-scars'); dead.portraitState.lifeStatus = 'deceased';
  const memorial = getPortraitAsset(dead, { atlases });
  assert.equal(portraitAssetKey(memorial), portraitAssetKey(b));
  assert.match(memorial.label, /minnesporträtt/);
});
