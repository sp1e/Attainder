import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INVENTORY_SCHEMA, RESEARCH_STATUSES, SHIPPED_STATUSES, inventoryTables, shippedStatus, validatePublicInventory,
} from './historicalInventory.js';

// One package is enough: the rules read the start's polities and review features.
const packages = new Map([['charlemagne-800', {
  polities: [{ id: 'carolingian-realm' }, { id: 'old-realm' }],
  playablePolityIds: ['carolingian-realm'],
  regionReview: [
    { sourceIndex: 5, boundaryDecision: 'accepted-world-scale-approximation' },
    { sourceIndex: 9, boundaryDecision: 'withheld-control' },
  ],
}]]);

const row = (fields) => ({
  id: 'europe/x', nameSv: 'X', regionId: 'europe', startId: null, polityId: null, featureIndex: null,
  researchStatus: 'pending', sourceUrl: null, ...fields,
});
const onStart = { startId: 'charlemagne-800' };
const validRows = () => [
  row({ id: 'europe/frankish-realm', nameSv: 'Frankerriket', ...onStart, polityId: 'carolingian-realm', researchStatus: 'playable-candidate', sourceUrl: 'https://example.org/source' }),
  row({ id: 'europe/old-realm', nameSv: 'Det gamla riket', ...onStart, polityId: 'old-realm', researchStatus: 'map-only' }),
  row({ id: 'europe/feature-five', nameSv: 'Område fem', ...onStart, featureIndex: 5, researchStatus: 'pending' }),
  row({ id: 'east-asia/candidate', nameSv: 'Kandidat', regionId: 'east-asia', researchStatus: 'playable-candidate' }),
  row({ id: 'americas/map-only', nameSv: 'Bara karta', regionId: 'americas', researchStatus: 'map-only' }),
  row({ id: 'oceania/engine-kind', nameSv: 'Ny sort', regionId: 'oceania', researchStatus: 'needs-engine-kind' }),
  row({ id: 'mena/no-source', nameSv: 'Utan källa', regionId: 'mena', researchStatus: 'no-source' }),
  row({ id: 'europe/pending', nameSv: 'Väntar', researchStatus: 'pending' }),
];
const inventory = (fields = {}) => ({ schema: INVENTORY_SCHEMA, preparedOn: '2026-11-09', rows: validRows(), ...fields });

test('the status vocabularies are the spec lists', () => {
  assert.equal(INVENTORY_SCHEMA, 'attainder-public-inventory-v1');
  assert.deepEqual(RESEARCH_STATUSES, ['playable-candidate', 'map-only', 'needs-engine-kind', 'no-source', 'pending']);
  assert.deepEqual(SHIPPED_STATUSES, ['playable', 'on-map', ...RESEARCH_STATUSES]);
});

test('a valid inventory with every shipped status validates', () => {
  const result = validatePublicInventory(inventory({ withheldRowCount: 400 }), packages);
  assert.deepEqual(result, { ok: true, errors: [] });
  assert.deepEqual(validRows().map(r => shippedStatus(r, packages)),
    ['playable', 'on-map', 'on-map', 'playable-candidate', 'map-only', 'needs-engine-kind', 'no-source', 'pending']);
});

test('a row on a withheld feature takes its research status', () => {
  const withheld = row({ id: 'europe/withheld', ...onStart, featureIndex: 9, researchStatus: 'pending' });
  assert.equal(validatePublicInventory(inventory({ rows: [withheld] }), packages).ok, true);
  assert.equal(shippedStatus(withheld, packages), 'pending');
});

// Each case breaks one rule of the spec's inventory contract; the error starts with the row id
// (or "inventory") and names the field.
const replaceFirst = (fields) => inventory({ rows: [{ ...validRows()[0], ...fields }, ...validRows().slice(1)] });
const withoutKey = (object, key) => Object.fromEntries(Object.entries(object).filter(([k]) => k !== key));
const ruleCases = [
  ['bad id shape', replaceFirst({ id: 'Europe/Frank' }), /^Europe\/Frank: id /],
  ['duplicate id', inventory({ rows: [...validRows(), validRows()[1]] }), /^europe\/old-realm: id .*duplicate/],
  ['empty nameSv', replaceFirst({ nameSv: '' }), /^europe\/frankish-realm: nameSv /],
  ['regionId other', replaceFirst({ regionId: 'other' }), /^europe\/frankish-realm: regionId /],
  ['regionId against polity-regions.json', replaceFirst({ regionId: 'east-asia' }), /^europe\/frankish-realm: regionId .*polity-regions/],
  ['unknown startId', replaceFirst({ startId: 'rome-100' }), /^europe\/frankish-realm: startId /],
  ['shipped startId without package data', replaceFirst({ startId: 'world-1500' }), /^europe\/frankish-realm: startId /],
  ['polityId unknown in the package', replaceFirst({ polityId: 'no-such-realm' }), /^europe\/frankish-realm: polityId /],
  ['polityId without startId', replaceFirst({ startId: null }), /^europe\/frankish-realm: polityId .*startId/],
  ['featureIndex absent from regionReview', replaceFirst({ polityId: null, featureIndex: 7 }), /^europe\/frankish-realm: featureIndex /],
  ['featureIndex without startId', replaceFirst({ startId: null, polityId: null, featureIndex: 5 }), /^europe\/frankish-realm: featureIndex .*startId/],
  ['unknown researchStatus', replaceFirst({ researchStatus: 'done' }), /^europe\/frankish-realm: researchStatus /],
  ['http sourceUrl', replaceFirst({ sourceUrl: 'http://example.org/source' }), /^europe\/frankish-realm: sourceUrl /],
  ['no-source with a sourceUrl', replaceFirst({ researchStatus: 'no-source' }), /^europe\/frankish-realm: sourceUrl .*no-source/],
  ['extra row key', replaceFirst({ privateNote: 'x' }), /^europe\/frankish-realm: privateNote /],
  ['missing row key', inventory({ rows: [withoutKey(validRows()[0], 'sourceUrl')] }), /^europe\/frankish-realm: sourceUrl /],
  ['extra top-level key', inventory({ inventoryCommit: 'abc' }), /^inventory: inventoryCommit /],
  ['wrong schema', inventory({ schema: 'attainder-public-inventory-v0' }), /^inventory: schema /],
  ['impossible month', inventory({ preparedOn: '2026-13-01' }), /^inventory: preparedOn /],
  ['impossible day', inventory({ preparedOn: '2026-02-30' }), /^inventory: preparedOn /],
  ['rows not an array', inventory({ rows: {} }), /^inventory: rows /],
  ['negative withheldRowCount', inventory({ withheldRowCount: -1 }), /^inventory: withheldRowCount /],
  ['fractional withheldRowCount', inventory({ withheldRowCount: 1.5 }), /^inventory: withheldRowCount /],
];

test('each field rule fails with its error', () => {
  for (const [name, input, pattern] of ruleCases) {
    const result = validatePublicInventory(input, packages);
    assert.equal(result.ok, false, name);
    assert.ok(result.errors.some(e => pattern.test(e)), `${name}: ${JSON.stringify(result.errors)}`);
  }
});

test('an empty row list is valid', () => {
  assert.deepEqual(validatePublicInventory({ schema: INVENTORY_SCHEMA, preparedOn: '2026-11-09', rows: [] }, packages),
    { ok: true, errors: [] });
});

test('the tables count every status per start and region', () => {
  const { byStart, byRegion } = inventoryTables(inventory(), packages);
  const zero = Object.fromEntries(SHIPPED_STATUSES.map(s => [s, 0]));
  assert.deepEqual(byStart.map(r => r.key), ['egypt-3000bc', 'charlemagne-800', 'world-1500', 'john-1200', 'no start']);
  assert.deepEqual(byStart[1].counts, { ...zero, playable: 1, 'on-map': 2 });
  assert.deepEqual(byStart[4].counts, { ...zero, 'playable-candidate': 1, 'map-only': 1, 'needs-engine-kind': 1, 'no-source': 1, pending: 1 });
  assert.deepEqual(byStart[0].counts, zero);
  assert.deepEqual(byRegion.map(r => r.key),
    ['europe', 'mena', 'sub-saharan-africa', 'central-asia', 'south-asia', 'east-asia', 'southeast-asia', 'americas', 'oceania']);
  const region = Object.fromEntries(byRegion.map(r => [r.key, r.counts]));
  assert.deepEqual(region.europe, { ...zero, playable: 1, 'on-map': 2, pending: 1 });
  assert.deepEqual(region.mena, { ...zero, 'no-source': 1 });
  assert.deepEqual(region['south-asia'], zero);
});
