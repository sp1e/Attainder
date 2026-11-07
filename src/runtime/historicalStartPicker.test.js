import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { groupHistoricalStartRows, historicalStartRows } from './historicalStartPicker.js';
import { historicalStartOptionFromSummary, orderHistoricalStarts } from './historicalStartOptions.js';
import { historicalStartSummary } from '../../server/historicalStartSummary.js';

// The three shipped starts as the card receives them; John installs as `default`.
const PACKAGES = { 'charlemagne-800': 'charlemagne-800', default: 'john-1200', 'egypt-3000bc': 'egypt-3000bc' };
const shippedOptions = () => orderHistoricalStarts(Object.entries(PACKAGES).map(([scenarioId, folder]) => {
  const pkg = JSON.parse(readFileSync(new URL(`../../server/seed/historical/${folder}/scenario.json`, import.meta.url), 'utf8'));
  return historicalStartOptionFromSummary(scenarioId, historicalStartSummary({ meta: pkg.scenario, data: pkg.data }));
}));
const polityName = (options, scenarioId) => options.find(o => o.scenarioId === scenarioId).polities[0].name;
const shape = groups => groups.map(g => [g.labelSv, g.eras.map(e => [e.labelSv, e.rows.map(r => r.polityName)])]);
const keys = groups => groups.flatMap(g => g.eras.flatMap(e => e.rows.map(r => r.key)));

test('a blank query groups every playable polity by region, then era, then date', () => {
  const options = shippedOptions();
  const rows = historicalStartRows(options);
  const expected = [
    ['Europa', [['Tidig medeltid', ['Bysantinska riket', 'Emiratet Córdoba', 'Furstendömet Benevento', 'Karls rike (karolingiska riket)', 'Kungariket Asturien', 'Kyrkostaten']],
      ['Högmedeltid', [polityName(options, 'default')]]]],
    ['Mellanöstern och Nordafrika', [['Bronsålder', [polityName(options, 'egypt-3000bc')]], ['Tidig medeltid', ['Abbasidiska kalifatet', 'Aghlabidiska emiratet']]]],
    ['Östasien', [['Tidig medeltid', ['Silla', 'Tangriket']]]],
  ];
  assert.deepEqual(shape(groupHistoricalStartRows(rows, '')), expected);
  assert.deepEqual(shape(groupHistoricalStartRows(rows, '   ')), expected);
  assert.deepEqual(shape(groupHistoricalStartRows(rows, undefined)), expected);
});

test('a row carries the polity, its start, era and ruler', () => {
  const papal = historicalStartRows(shippedOptions()).find(r => r.key === 'charlemagne-800/papal-states');
  assert.equal(papal.scenarioId, 'charlemagne-800'); assert.equal(papal.polityId, 'papal-states');
  assert.equal(papal.polityName, 'Kyrkostaten'); assert.equal(papal.eraLabelSv, '800 e.Kr.');
  assert.equal(papal.eraId, 'early-middle-ages'); assert.equal(papal.regionId, 'europe');
  assert.equal(papal.rulerName, 'Leo III'); assert.equal(papal.date, '0800-12-25');
  assert.ok(papal.rulerOrigin);
  assert.ok(papal.searchText.includes('kyrkostaten') && papal.searchText.includes('leo iii') && papal.searchText.includes('tidig medeltid'));
});

test('search ignores case, diacritics and stray whitespace', () => {
  const rows = historicalStartRows(shippedOptions());
  assert.deepEqual(keys(groupHistoricalStartRows(rows, 'leo')), ['charlemagne-800/papal-states']);
  for (const query of ['kyrko', 'KYRKO', 'Kyrkostaten ', '  kyrko  ']) {
    assert.ok(keys(groupHistoricalStartRows(rows, query)).includes('charlemagne-800/papal-states'), query);
  }
  assert.deepEqual(keys(groupHistoricalStartRows(rows, 'Högmedeltid')), keys(groupHistoricalStartRows(rows, 'hogmedeltid')));
  assert.deepEqual(keys(groupHistoricalStartRows(rows, 'Högmedeltid')), ['default/johns-realms']);
  assert.deepEqual(keys(groupHistoricalStartRows(rows, 'Bronsålder')), keys(groupHistoricalStartRows(rows, 'bronsalder')));
  assert.deepEqual(groupHistoricalStartRows(rows, 'zzz'), []);
});

test('a polity with no region entry lands under Övriga, last', () => {
  const options = shippedOptions();
  const egypt = options.find(o => o.scenarioId === 'egypt-3000bc');
  const stray = { ...egypt, scenarioId: 'imported', polities: [{ ...egypt.polities[0], id: 'invented-polity', name: 'Påhittat rike', regionId: undefined }] };
  const groups = groupHistoricalStartRows(historicalStartRows([...options, stray]), '');
  assert.deepEqual(groups.map(g => g.regionId), ['europe', 'mena', 'east-asia', 'other']);
  assert.equal(groups.at(-1).labelSv, 'Övriga');
  assert.deepEqual(keys([groups.at(-1)]), ['imported/invented-polity']);
});

test('rows in one era sort by date, then by polity name in Swedish order', () => {
  const base = shippedOptions().find(o => o.scenarioId === 'charlemagne-800');
  const later = { ...base, scenarioId: 'later', date: '0900-01-01', polities: [{ ...base.polities[0], id: 'a-later', name: 'Aachen' }] };
  const sameDay = { ...base, scenarioId: 'same', polities: [{ ...base.polities[1], id: 'o-same', name: 'Österrike' }, { ...base.polities[1], id: 'z-same', name: 'Zeeland' }] };
  const groups = groupHistoricalStartRows(historicalStartRows([later, sameDay, base]), '');
  assert.deepEqual(groups[0].eras[0].rows.map(r => r.polityName), ['Bysantinska riket', 'Emiratet Córdoba', 'Furstendömet Benevento',
    'Karls rike (karolingiska riket)', 'Kungariket Asturien', 'Kyrkostaten', 'Zeeland', 'Österrike', 'Aachen']);
});
