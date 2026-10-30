import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCampaignSeed, DEFAULT_CAMPAIGN_SEED } from './campaignSeed.js';
import { createCharacterSystem } from './characters/index.js';

test('blank campaign seeds preserve the established default', () => {
  for (const value of [undefined, null, '']) assert.equal(normalizeCampaignSeed(value), DEFAULT_CAMPAIGN_SEED);
});
test('campaign seed validates the complete unsigned range without silent coercion', () => {
  for (const value of [0, -1, 4294967296, 1.5, NaN, Infinity, true, {}, [], '1e3', '0x12', ' ', '293oops']) assert.throws(() => normalizeCampaignSeed(value));
  assert.equal(normalizeCampaignSeed(' 293 '), 293);
  assert.equal(normalizeCampaignSeed(4294967295), 4294967295);
});
test('a selected seed reproduces the same initial character system', () => {
  const options = { seed: normalizeCampaignSeed('293'), polityId: 'Hadara', polityName: 'Hadara' };
  assert.deepEqual(createCharacterSystem(options), createCharacterSystem(options));
  assert.notDeepEqual(createCharacterSystem(options), createCharacterSystem({ ...options, seed: 294 }));
});
