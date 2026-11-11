import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  HISTORICAL_ERAS, HISTORICAL_REGIONS, HISTORICAL_SUMMARY_SCHEMA,
  foldSearchText, historicalEraFor, historicalStartFromSummary, historicalStartSummary, regionForPolity,
} from './historicalStartSummary.js';

const readPackage = id => JSON.parse(readFileSync(new URL(`./seed/historical/${id}/scenario.json`, import.meta.url), 'utf8'));
const summaryOf = pkg => historicalStartSummary({ meta: pkg.scenario, data: pkg.data });

test('regions and eras keep the agreed ids, labels and order', () => {
  assert.equal(HISTORICAL_SUMMARY_SCHEMA, 5);
  assert.deepEqual(HISTORICAL_REGIONS.map(r => r.id), ['europe','mena','sub-saharan-africa','central-asia','south-asia','east-asia','southeast-asia','americas','oceania','other']);
  assert.deepEqual(HISTORICAL_REGIONS.map(r => r.labelSv), ['Europa','Mellanöstern och Nordafrika','Afrika söder om Sahara','Centralasien','Sydasien','Östasien','Sydostasien','Amerika','Oceanien','Övriga']);
  assert.deepEqual(HISTORICAL_ERAS.map(e => e.id), ['bronze-age','antiquity','early-middle-ages','high-middle-ages','late-middle-ages']);
  assert.ok(Object.isFrozen(HISTORICAL_REGIONS) && Object.isFrozen(HISTORICAL_ERAS));
});

test('the era follows the start year and a year outside the range takes the nearest era', () => {
  const cases = [['-3000-01-01','bronze-age'],['-1201-12-31','bronze-age'],['-1200-01-01','antiquity'],['-0001-12-31','antiquity'],
    ['0500-12-31','antiquity'],['0501-01-01','early-middle-ages'],['0800-12-25','early-middle-ages'],['1200-05-27','high-middle-ages'],
    ['1301-01-01','late-middle-ages'],['1530-12-31','late-middle-ages'],['1600-01-01','late-middle-ages'],['-4000-01-01','bronze-age']];
  for (const [date, id] of cases) assert.equal(historicalEraFor(date).id, id, date);
  assert.equal(historicalEraFor('0800-12-25').labelSv, 'Tidig medeltid');
  assert.equal(historicalEraFor('not a date'), null);
});

test('search text folds case, diacritics and whitespace', () => {
  assert.equal(foldSearchText('  Östasien  '), 'ostasien');
  assert.equal(foldSearchText('KYRKOSTATEN'), 'kyrkostaten');
  assert.equal(foldSearchText('Mellanöstern   och\tNordafrika'), 'mellanostern och nordafrika');
  assert.equal(foldSearchText(undefined), '');
});

test('a polity takes its region from the region file and other when absent', () => {
  assert.equal(regionForPolity('papal-states'), 'europe');
  assert.equal(regionForPolity('egypt-early-dynastic'), 'mena');
  assert.equal(regionForPolity('nowhere'), 'other');
});

test('the Charlemagne package summarises its ten playable courts', () => {
  const summary = summaryOf(readPackage('charlemagne-800'));
  assert.equal(summary.schema, 5);
  assert.equal(summary.invalid, undefined);
  assert.equal(summary.sourceStamp, null);
  assert.equal(summary.contentId, 'charlemagne-800');
  assert.equal(summary.eraId, 'early-middle-ages');
  assert.equal(summary.contentVersion, '1.4.0');
  assert.equal(summary.date, '0800-12-25');
  assert.equal(summary.name, 'Karls rike (karolingiska riket), 800 e.Kr.');
  assert.deepEqual(summary.polities.map(p => [p.id, p.regionId]), [['carolingian-realm', 'europe'], ['papal-states', 'europe'],
    ['tang-empire', 'east-asia'], ['abbasid-caliphate', 'mena'], ['byzantine-empire', 'europe'], ['silla', 'east-asia'], ['emirate-of-cordoba', 'europe'],
    ['aghlabid-emirate', 'mena'], ['kingdom-of-asturias', 'europe'], ['duchy-of-benevento', 'europe']]);
  assert.equal(summary.polities.find(p => p.id === 'papal-states').ruler.name, 'Leo III');
  assert.equal(summary.polities.find(p => p.id === 'byzantine-empire').ruler.name, 'Eirene av Aten');
  for (const polity of summary.polities) {
    assert.ok(polity.families.length >= 1, polity.id);
    assert.ok(polity.nameSv && polity.ruler.originLabelSv, polity.id);
  }
  assert.deepEqual(summary.polities.map(p => p.kind), summary.polities.map(() => 'state'));
  assert.deepEqual(summary.mapCoverage, { mapOnly: [], unownedFeatureCount: 214 });
  assert.deepEqual(Object.keys(summary).slice(-3), ['calendarNoteSv', 'mapCoverage', 'polities']);
});

test('the John summary carries its map-only polities', () => {
  const summary = summaryOf(readPackage('john-1200'));
  assert.deepEqual(summary.mapCoverage, {
    mapOnly: [{ id: 'western-xia', nameSv: 'Västra Xia' }, { id: 'chimu', nameSv: 'Chimú' }], unownedFeatureCount: 280,
  });
});

test('a playable polity carries its kind, and an unknown or non-state kind leaves the start invalid', () => {
  const withKind = (kind) => {
    const pkg = readPackage('charlemagne-800');
    pkg.data.world.historicalScenario.polities.find(p => p.id === 'papal-states').kind = kind;
    return summaryOf(pkg);
  };
  const confederation = withKind('confederation');
  assert.equal(confederation.invalid, undefined);
  assert.equal(confederation.polities.find(p => p.id === 'papal-states').kind, 'confederation');
  assert.equal(confederation.polities.find(p => p.id === 'carolingian-realm').kind, 'state');
  for (const kind of ['empire', 'non-state']) {
    let summary;
    assert.doesNotThrow(() => { summary = withKind(kind); }, kind);
    assert.deepEqual(summary, { schema: 5, sourceStamp: null, invalid: true, date: '0800-12-25', contentId: 'charlemagne-800' }, kind);
  }
});

test('each polity carries its court start text and null when the court has none', () => {
  const pkg = readPackage('charlemagne-800');
  const h = pkg.data.world.historicalScenario;
  h.courtSeeds['papal-states'].contextSv = 'Leo III styr Kyrkostaten från Rom.';
  h.courtSeeds['papal-states'].contextSourceIds = Object.keys(h.sources).slice(0, 1);
  delete h.courtSeeds['carolingian-realm'].contextSv;
  delete h.courtSeeds['carolingian-realm'].contextSourceIds;
  const summary = summaryOf(pkg);
  assert.equal(summary.contextSv, h.contextSv, 'the package text stays as the fallback');
  assert.deepEqual(summary.polities.map(p => [p.id, p.contextSv]),
    [['carolingian-realm', null], ['papal-states', 'Leo III styr Kyrkostaten från Rom.'],
      ...h.playablePolityIds.slice(2).map(id => [id, h.courtSeeds[id].contextSv])]);
  for (const polity of summary.polities.slice(2)) assert.ok(polity.contextSv.length > 50, polity.id);
});

test('a broken court makes the summary invalid and a non-historical world gives null', () => {
  const pkg = readPackage('charlemagne-800');
  const court = pkg.data.world.historicalScenario.courtSeeds['papal-states'];
  court.people = court.people.filter(person => person.id !== court.rulerId);
  const broken = historicalStartSummary({ meta: pkg.scenario, data: pkg.data, sourceStamp: 'stamp' });
  assert.deepEqual(broken, { schema: 5, sourceStamp: 'stamp', invalid: true, date: '0800-12-25', contentId: 'charlemagne-800' });
  // The library bar still lists a broken start, so the player can open or delete it.
  assert.deepEqual(historicalStartFromSummary(broken, pkg.scenario), { date: '0800-12-25', contentId: 'charlemagne-800' });
  assert.equal(historicalStartFromSummary(broken, { ...pkg.scenario, restoreOnly: true }), null);

  const families = readPackage('egypt-3000bc');
  const [polityId] = families.data.world.historicalScenario.playablePolityIds;
  families.data.world.historicalScenario.courtSeeds[polityId].families = [];
  assert.equal(summaryOf(families).invalid, true);

  const plain = readPackage('egypt-3000bc');
  delete plain.data.world.historicalScenario;
  assert.equal(summaryOf(plain), null);
  assert.equal(historicalStartSummary({ meta: { id: 'x' }, data: {} }), null);
});

test('every shipped package gives a valid summary', () => {
  for (const id of ['egypt-3000bc','charlemagne-800','john-1200','world-1500']) {
    const summary = summaryOf(readPackage(id));
    assert.equal(summary.invalid, undefined, id);
    assert.ok(summary.polities.every(p => p.regionId !== 'other'), id);
  }
});

test('each polity carries its court mechanics note, null without one', () => {
  const pkg = readPackage('world-1500');
  const h = pkg.data.world.historicalScenario;
  assert.deepEqual(summaryOf(pkg).polities.map(p => [p.id, p.mechanicsNoteSv]), h.playablePolityIds.map(id => [id, h.courtSeeds[id].mechanics.noteSv]));
  assert.ok(summaryOf(pkg).polities[0].mechanicsNoteSv.includes('Ett barn styr genom en förmyndare.'), 'a dossier court carries its coverage lines');
  delete h.courtSeeds[h.playablePolityIds[0]].mechanics.noteSv;
  assert.equal(summaryOf(pkg).polities[0].mechanicsNoteSv, null);
});

test('the polity region check passes on the shipped packages', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  execFileSync(process.execPath, ['scripts/check-polity-regions.mjs', '--check'], { cwd: root, stdio: 'pipe' });
});
