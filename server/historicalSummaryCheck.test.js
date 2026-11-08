// The start card's summary after the full start validation: a start that passes the card's
// structural checks but would fail at Start reads as invalid. Spec:
// docs/superpowers/specs/2026-11-08-start-summary-schema-5-design.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkedHistoricalStartSummary } from './historicalSummaryCheck.js';
import { historicalStartSummary } from './historicalStartSummary.js';

const readPackage = id => JSON.parse(readFileSync(new URL(`./seed/historical/${id}/scenario.json`, import.meta.url), 'utf8'));
const mapOf = pkg => ({ regions: pkg.assets.regionsGeojson.data, cities: pkg.assets.citiesGeojson.data });
const inputs = (pkg, map = mapOf(pkg)) => ({ meta: pkg.scenario, data: pkg.data, sourceStamp: 'stamp', loadMap: () => map });
const INVALID_AD800 = { schema: 5, sourceStamp: 'stamp', invalid: true, date: '0800-12-25', contentId: 'charlemagne-800' };

test('a shipped start that passes the start validation keeps its summary', () => {
  for (const id of ['egypt-3000bc', 'charlemagne-800', 'john-1200', 'world-1500']) {
    const pkg = readPackage(id);
    assert.deepEqual(checkedHistoricalStartSummary(inputs(pkg)), historicalStartSummary(inputs(pkg)), id);
  }
});

test('a start whose map lacks a playable polity reads as invalid', () => {
  const pkg = readPackage('charlemagne-800'), regions = pkg.assets.regionsGeojson.data;
  regions.features = regions.features.filter(f => f.properties.owner !== 'silla');
  assert.equal(historicalStartSummary(inputs(pkg)).invalid, undefined, 'the structural checks pass');
  assert.deepEqual(checkedHistoricalStartSummary(inputs(pkg)), INVALID_AD800);
});

test('a start without its map or cities reads as invalid', () => {
  const pkg = readPackage('charlemagne-800');
  assert.deepEqual(checkedHistoricalStartSummary(inputs(pkg, { ...mapOf(pkg), regions: null })), INVALID_AD800);
  assert.deepEqual(checkedHistoricalStartSummary(inputs(pkg, { ...mapOf(pkg), cities: null })), INVALID_AD800);
  assert.deepEqual(checkedHistoricalStartSummary(inputs(pkg, null)), INVALID_AD800);
});

test('a start date outside the package range reads as invalid and keeps the stored date', () => {
  const pkg = readPackage('charlemagne-800');
  Object.assign(pkg.data.game, { startDate: '0801-01-01', gameDate: '0801-01-01' });
  assert.deepEqual(checkedHistoricalStartSummary(inputs(pkg)), { ...INVALID_AD800, date: '0801-01-01' });
});

test('a restore-only copy keeps its summary; the catalog leaves it off by its meta', () => {
  const pkg = readPackage('egypt-3000bc');
  const summary = checkedHistoricalStartSummary({ ...inputs(pkg), meta: { ...pkg.scenario, restoreOnly: true } });
  assert.equal(summary.invalid, undefined);
});

test('a structural failure and a scenario that is not historical pass through unchanged', () => {
  const broken = readPackage('charlemagne-800');
  const court = broken.data.world.historicalScenario.courtSeeds['papal-states'];
  court.people = court.people.filter(person => person.id !== court.rulerId);
  assert.deepEqual(checkedHistoricalStartSummary(inputs(broken)), INVALID_AD800);
  const plain = readPackage('egypt-3000bc');
  delete plain.data.world.historicalScenario;
  // Neither reads the map.
  const unread = () => { throw new Error('the map was read'); };
  assert.deepEqual(checkedHistoricalStartSummary({ ...inputs(broken), loadMap: unread }), INVALID_AD800);
  assert.equal(checkedHistoricalStartSummary({ ...inputs(plain), loadMap: unread }), null);
  assert.equal(checkedHistoricalStartSummary({ meta: null, data: {}, sourceStamp: null, loadMap: unread }), null);
});
