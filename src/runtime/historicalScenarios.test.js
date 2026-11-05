import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { pointInGeometry } from '../Game/AI/placement.js';
import { aggregatePolityGeometry } from '../Game/Map/vnext/polityGeometry.js';
import { buildPolityLabelCollections } from '../Game/Map/vnext/polityLabels.js';
import { validateHistoricalScenario, historicalGeometryCenter } from './historicalScenarios.js';

// Synthetic schema fixture. Never packaged as playable historical content.
export function syntheticScenario() {
  const claim = { status: 'generated', sourceIds: [], noteSv: 'Syntetiskt testvärde.' };
  const source = { title: 'Synthetic evidence', institution: 'Test', url: 'https://example.org/test', locator: 'fixture', retrievedAt: '2026-11-05', license: 'CC0-1.0', chronology: '1200', uncertainty: 'Synthetic', review: 'synthetic' };
  const person = { id: 'person', name: 'Test', identityOrigin: 'generated', originLabelSv: 'Genererad testperson', familyId: 'family', religionId: 'religion', legalParentIds: [], spouseIds: [], claims: { identity: claim, biography: claim, mechanics: claim } };
  const h = { schemaVersion: 1, kind: 'historical', contentId: 'synthetic', contentVersion: '1', calendar: 'proleptic-gregorian-no-year-zero', bookmarkDate: '1200-12-31', eraLabelSv: '1200 e.Kr.', contextSv: 'Syntetiskt schemaexempel.', coverageNoteSv: 'Syntetiskt test.', sources: { test: source }, polities: [{ id: 'polity', nameSv: 'Test', sourceIds: ['test'], boundary: 'approximate' }], playablePolityIds: ['polity'], settlements: [{ id: 'city', nameSv: 'Teststad', coordinates: [1, 1], polityId: 'polity', regionId: 'region', placement: 'inside', sourceIds: ['test'], noteSv: 'Syntetisk placering.' }], coverage: ['Africa','Asia','Europe','Americas','Oceania','Antarctica'].map(area => ({ area, status: 'unresolved', sourceIds: ['test'], noteSv: 'Syntetiskt, okänd kontroll.' })), courtSeeds: { polity: { polityId: 'polity', rulerId: 'person', seatId: 'city', people: [person], families: [{ id: 'family', headId: 'person', claims: { identity: claim } }], religions: [{ id: 'religion', claims: { identity: claim } }], offices: [{ id: 'ruler', holderId: 'person', claims: { identity: claim } }], cities: [{ id: 'city', settlementId: 'city', claims: { mechanics: claim } }], mechanics: { status: 'generated', noteSv: 'Testregler.' } } } };
  return { game: { startDate: h.bookmarkDate, currentDate: h.bookmarkDate }, world: { historicalScenario: h, polityOverrides: { polity: { name: 'Test' } } }, regions: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { id: 'region', owner: 'polity', historical: { status: 'owned', boundary: 'approximate', sourceIds: ['test'] } }, geometry: { type: 'Polygon', coordinates: [[[0,0],[2,0],[2,2],[0,2],[0,0]]] } }] }, assetManifest: { assets: [{ id: 'regionsGeojson', sourceIds: ['test'], crs: 'OGC:CRS84', revision: 'fixture', sha256: '0'.repeat(64), license: 'CC0-1.0', transformations: ['synthetic'] }] } };
}
const validate = input => validateHistoricalScenario(input, { date: '1200-12-31', polityId: 'polity' });
test('synthetic fixture validates without mutation', () => {
  const input = syntheticScenario(), before = structuredClone(input);
  assert.deepEqual(validate(input), { ok: true, contentId: 'synthetic', contentVersion: '1', date: '1200-12-31', polityId: 'polity' });
  assert.deepEqual(input, before);
});
for (const [name, mutate] of [
  ['missing source', x => { delete x.world.historicalScenario.sources.test; }],
  ['duplicate ids', x => x.world.historicalScenario.polities.push(x.world.historicalScenario.polities[0])],
  ['unsupported date', x => { x.world.historicalScenario.bookmarkDate = '1201-01-01'; }],
  ['invalid coordinates', x => { x.regions.features[0].geometry.coordinates[0][0] = [181, 0]; }],
  ['open ring', x => { x.regions.features[0].geometry.coordinates[0].pop(); }],
  ['dangling owner', x => { x.regions.features[0].properties.owner = 'missing'; }],
  ['absent court', x => { delete x.world.historicalScenario.courtSeeds.polity; }],
  ['settlement outside region', x => { x.world.historicalScenario.settlements[0].coordinates = [30,30]; }],
  ['missing map polity', x => { x.regions.features[0].properties.owner = ''; }],
  ['missing identity origin', x => { delete x.world.historicalScenario.courtSeeds.polity.people[0].identityOrigin; }],
  ['missing claim certainty', x => { delete x.world.historicalScenario.courtSeeds.polity.people[0].claims.identity.status; }],
  ['false sourced generated identity', x => { x.world.historicalScenario.courtSeeds.polity.people[0].claims.identity.status = 'sourced'; }],
  ['incomplete coverage', x => x.world.historicalScenario.coverage.pop()],
  ['missing asset hash', x => { delete x.assetManifest.assets[0].sha256; }],
  ['conflicting runtime owner', x => { x.world.regionOwnershipOverrides = { region: 'other' }; }],
  ['unreviewed runtime polity', x => { x.world.polityOverrides.modern = { name: 'Modern country' }; }],
  ['conflicting game calendar fields', x => { x.game.gameDate = '1200-01-01'; }],
  ['nonreciprocal spouse claim', x => { x.world.historicalScenario.courtSeeds.polity.people[0].spouseIds = ['person']; }],
]) test(`rejects ${name}`, () => { const input = syntheticScenario(); mutate(input); assert.equal(validate(input).ok, false); });
test('contested frontier requires explicit competing polities, provenance and note', () => {
  const input = syntheticScenario(), h = input.world.historicalScenario;
  h.polities.push({ id: 'other', nameSv: 'Andra', sourceIds: ['test'], boundary: 'approximate' });
  h.settlements.push({ id: 'frontier', nameSv: 'Gränsort', coordinates: [2.01,1], polityId: null, regionId: 'region', placement: 'contested', candidatePolityIds: ['polity','other'], sourceIds: ['test'], noteSv: 'Läget och kontrollen är omstridda.' });
  assert.equal(validate(input).ok, true);
  delete h.settlements[1].candidatePolityIds;
  assert.equal(validate(input).ok, false);
});
test('disjoint dateline islands center on a real component, not Greenwich', () => {
  const geometry = { type: 'MultiPolygon', coordinates: [[[[178,-20],[179,-20],[179,-19],[178,-19],[178,-20]]], [[[-179,-20],[-178,-20],[-178,-19],[-179,-19],[-179,-20]]]] };
  assert.ok(Math.abs(historicalGeometryCenter(geometry)[0]) > 170);
});

const loadBookmark = async id => {
  const root = new URL(`../../server/seed/historical/${id}/`,import.meta.url);
  const [bundle,regions,assetManifest] = await Promise.all(['scenario.json','regions.geojson','manifest.json'].map(async file => JSON.parse(await readFile(new URL(file,root),'utf8'))));
  return { bundle,game: bundle.data.game,world: bundle.data.world,regions,assetManifest,root };
};
for (const id of ['egypt-3000bc','john-1200']) test(`source-backed ${id} package validates with complete hashed assets and review`,async () => {
  const input = await loadBookmark(id), h = input.world.historicalScenario;
  assert.equal(validateHistoricalScenario(input,{ date: h.bookmarkDate,polityId: h.playablePolityIds[0] }).ok,true);
  assert.equal(h.regionReview.length,id === 'egypt-3000bc' ? 138 : 286);
  assert.equal(h.regionReview.filter(r => r.ownerPolityId).length,h.polities.length);
  for (const asset of input.assetManifest.assets) {
    const bytes = await readFile(new URL(asset.id === 'regionsGeojson' ? 'regions.geojson' : 'cities.geojson',input.root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
  }
  const court = h.courtSeeds[h.playablePolityIds[0]];
  assert.equal(court.people[0].identityOrigin,id === 'egypt-3000bc' ? 'generated' : 'documented');
  assert.equal(court.people[0].claims.mechanics.status,'generated');
  assert.equal(h.sources[ id === 'egypt-3000bc' ? 'memphis' : 'windsor'].license.startsWith('ODC-By'),true);
  assert.equal(input.bundle.componentLicenses[0].sourceFiles[0].text.includes('FeatureCollection'),true);
  assert.equal(input.bundle.license.scope,'authored-content');
});
test('real map landmarks retain reviewed control and negative ownership samples',async () => {
  const { regions,world } = await loadBookmark('john-1200');
  const owner = point => regions.features.filter(f => booleanPointInPolygon(point,f)).map(f => f.properties.owner).filter(Boolean);
  // Rounded diagnostic locations test coarse shapes, not surveyed sites or presence.
  for (const point of [[-.6,51.4833],[1.1,49.44],[-.58,44.84],[-.55,47.47],[-1.68,48.11]]) assert.ok(owner(point).includes('johns-realms'));
  for (const point of [[-6.26,53.35],[-9,53.5],[-4,53],[-3.18,51.48],[-3.19,55.95],[2.35,48.85],[1.44,43.6]]) assert.ok(!owner(point).includes('johns-realms'));
  assert.ok(owner([2.35,48.85]).includes('france-capetian'));
  assert.ok(owner([-7.98,31.63]).includes('almohad'));
  // UNESCO Chan Chan coordinate metadata, not an invented centroid.
  assert.ok(owner([-79.07473694444444,-8.10783611111111]).includes('chimu'));
  for (const index of [46,213,282,33,43,207,60,61,65]) assert.equal(world.historicalScenario.regionReview[index].ownerPolityId,null);
  assert.equal(world.historicalScenario.regionReview[214].geometryStatus,'quarantined-self-intersection');
});
test('Bronze Age cultures do not acquire kingdoms; omitted Pacific land remains visible',async () => {
  const { regions,world } = await loadBookmark('egypt-3000bc');
  const h = world.historicalScenario;
  assert.deepEqual(h.polities.map(p => p.id),['egypt-early-dynastic']);
  assert.equal(h.regionReview[16].ownerPolityId,null,'Ur polygon cannot prove Uruk ownership');
  assert.equal(h.regionReview[17].ownerPolityId,null,'Proto-Elamite accounting cannot prove one kingdom');
  // Physical diagnostic points only; no population/sovereignty claim.
  for (const point of [[-175.2,-21.15],[178.05,-17.8],[-171.75,-13.85],[-109.35,-27.12]]) {
    const hits = regions.features.filter(f => booleanPointInPolygon(point,f));
    assert.ok(hits.length > 0,`missing Pacific physical land ${point}`);
    assert.ok(hits.every(f => f.properties.owner === '' && f.properties.historical.status === 'unresolved'));
  }
  assert.equal(regions.features.some(f => booleanPointInPolygon([0,0],f)),false,'Atlantic ocean stays water');
});
test('shared placement and label pipeline choose the seat polity, with no background duplicate',async () => {
  for (const id of ['egypt-3000bc','john-1200']) {
    const { regions,world } = await loadBookmark(id), h = world.historicalScenario;
    const seat = h.settlements[0];
    const hits = regions.features.filter(f => pointInGeometry(seat.coordinates,f.geometry));
    assert.equal(hits.length,1,'the computational land background must not swallow the seat');
    assert.equal(hits[0].properties.owner,seat.polityId);
    const surfaces = aggregatePolityGeometry(regions,world.regionOwnershipOverrides);
    assert.deepEqual(new Set(surfaces.features.map(f => f.properties.owner)),new Set(h.polities.map(p => p.id)));
    const labels = buildPolityLabelCollections(surfaces);
    assert.ok(labels.labelData.features.some(r => r.properties.owner === seat.polityId));
  }
});
test('pinned dateline archipelago keeps its components and runtime label off Greenwich',async () => {
  const source = JSON.parse(await readFile(new URL('../../server/seed/historical/sources/hbm-world_1200.geojson',import.meta.url),'utf8'));
  const geometry = source.features[284].geometry;
  // This tests a source geometry risk; its Tonga imperial-control claim is withheld.
  assert.ok(Math.abs(historicalGeometryCenter(geometry)[0]) > 160);
  const labels = buildPolityLabelCollections({ type: 'FeatureCollection',features: [{ type: 'Feature',properties: { owner: 'synthetic-dateline-geometry-probe' },geometry }] });
  assert.ok(labels.labelData.features.length > 0);
  for (const f of labels.pointLabelData.features) assert.ok(Math.abs(f.geometry.coordinates[0]) > 150);
});
