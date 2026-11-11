import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DOSSIER_FILES, mapCoverage, packageCoverage } from './historicalCoverage.js';
import { SHIPPED_HISTORICAL_PACKAGES } from './historicalStarts.js';

const readJson = relative => JSON.parse(readFileSync(new URL(`./seed/historical/${relative}`, import.meta.url), 'utf8'));
const coverageOf = id => packageCoverage({
  data: readJson(`${id}/scenario.json`).data,
  dossier: DOSSIER_FILES[id] ? readJson(`courts/${DOSSIER_FILES[id]}`) : null,
});
const coverage = Object.fromEntries(SHIPPED_HISTORICAL_PACKAGES.map(id => [id, coverageOf(id)]));

test('the shipped package list is the bookmarks plus John', () => {
  assert.deepEqual(SHIPPED_HISTORICAL_PACKAGES, ['egypt-3000bc', 'charlemagne-800', 'world-1500', 'john-1200']);
  assert.ok(Object.isFrozen(SHIPPED_HISTORICAL_PACKAGES) && Object.isFrozen(DOSSIER_FILES));
});

test('package coverage pins the shipped counts', () => {
  const ids = ['egypt-3000bc', 'charlemagne-800', 'john-1200', 'world-1500'];
  assert.deepEqual(ids.map(id => coverage[id].playable.length), [1, 10, 4, 2]);
  assert.deepEqual(ids.map(id => coverage[id].mapOnly.map(p => p.id)), [[], [], ['western-xia', 'chimu'], []]);
  assert.deepEqual(ids.map(id => coverage[id].features.byBoundary['withheld-control']), [137, 214, 280, 289]);
  assert.deepEqual(ids.map(id => coverage[id].sourceCount), [57, 127, 74, 36]);
});

test('map-only polities carry the dossier status and reason', () => {
  const byId = Object.fromEntries(coverage['john-1200'].mapOnly.map(p => [p.id, p]));
  assert.equal(byId['western-xia'].nameSv, 'Västra Xia');
  assert.equal(byId.chimu.nameSv, 'Chimú');
  for (const polity of Object.values(byId)) {
    assert.equal(polity.dossierStatus, 'blocked');
    assert.ok(typeof polity.blockedReason === 'string' && polity.blockedReason.length > 0);
  }
});

test('a playable polity carries its seat and region', () => {
  const johns = coverage['john-1200'].playable.find(p => p.id === 'johns-realms');
  assert.equal(johns.seatSv, 'Windsor');
  assert.equal(johns.regionId, 'europe');
});

test('map coverage without review data counts zero', () => {
  assert.deepEqual(mapCoverage({ polities: [{ id: 'a' }], playablePolityIds: ['a'] }), { mapOnly: [], unownedFeatureCount: 0 });
  assert.deepEqual(mapCoverage({ polities: [{ id: 'a' }, { id: 'b' }], playablePolityIds: ['a'] }).mapOnly, [{ id: 'b', nameSv: 'b' }]);
});
