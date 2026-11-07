import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  HISTORICAL_ERAS, HISTORICAL_REGIONS, HISTORICAL_SUMMARY_SCHEMA,
  foldSearchText, historicalEraFor, historicalStartSummary, regionForPolity,
} from './historicalStartSummary.js';

const readPackage = id => JSON.parse(readFileSync(new URL(`./seed/historical/${id}/scenario.json`, import.meta.url), 'utf8'));
const summaryOf = pkg => historicalStartSummary({ meta: pkg.scenario, data: pkg.data });

test('regions and eras keep the agreed ids, labels and order', () => {
  assert.equal(HISTORICAL_SUMMARY_SCHEMA, 1);
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

test('the Charlemagne package summarises both playable courts', () => {
  const summary = summaryOf(readPackage('charlemagne-800'));
  assert.equal(summary.schema, 1);
  assert.equal(summary.invalid, undefined);
  assert.equal(summary.sourceStamp, null);
  assert.equal(summary.contentId, 'charlemagne-800');
  assert.equal(summary.eraId, 'early-middle-ages');
  assert.equal(summary.contentVersion, '1.1.0');
  assert.equal(summary.date, '0800-12-25');
  assert.equal(summary.name, 'Karls rike (karolingiska riket), 800 e.Kr.');
  assert.deepEqual(summary.polities.map(p => p.id), ['carolingian-realm','papal-states']);
  assert.equal(summary.polities.find(p => p.id === 'papal-states').ruler.name, 'Leo III');
  for (const polity of summary.polities) {
    assert.equal(polity.regionId, 'europe', polity.id);
    assert.ok(polity.families.length >= 1, polity.id);
    assert.ok(polity.nameSv && polity.ruler.originLabelSv, polity.id);
  }
});

test('a broken court makes the summary invalid and a non-historical world gives null', () => {
  const pkg = readPackage('charlemagne-800');
  const court = pkg.data.world.historicalScenario.courtSeeds['papal-states'];
  court.people = court.people.filter(person => person.id !== court.rulerId);
  assert.deepEqual(historicalStartSummary({ meta: pkg.scenario, data: pkg.data, sourceStamp: 'stamp' }), { schema: 1, sourceStamp: 'stamp', invalid: true });

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
  for (const id of ['egypt-3000bc','charlemagne-800','john-1200']) {
    const summary = summaryOf(readPackage(id));
    assert.equal(summary.invalid, undefined, id);
    assert.ok(summary.polities.every(p => p.regionId !== 'other'), id);
  }
});

test('the polity region check passes on the shipped packages', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  execFileSync(process.execPath, ['scripts/check-polity-regions.mjs', '--check'], { cwd: root, stdio: 'pipe' });
});
