import test from 'node:test';
import assert from 'node:assert/strict';
import { dateCertaintySv, eventAnchorYear, eventsForYears, historicalRecord, yearsClosedBetween } from './historicalEvents.js';

test('a turn reports the year whose last day it contains', () => {
  assert.deepEqual(yearsClosedBetween('-3000-01-01', '-2999-01-01'), [-3000]);
  assert.deepEqual(yearsClosedBetween('1200-12-31', '1201-12-31'), [1200]);
  assert.deepEqual(yearsClosedBetween('1201-01-01', '1201-06-01'), []);
});
test('the window steps over the missing year zero', () => {
  assert.deepEqual(yearsClosedBetween('-0002-06-01', '0002-06-01'), [-2, -1, 1]);
});
test('adjoining turns report each year exactly once', () => {
  const cuts = ['-0005-03-01', '-0004-12-31', '-0002-01-01', '0001-01-01', '0001-12-31', '0003-07-07'];
  const seen = cuts.slice(1).flatMap((to, i) => yearsClosedBetween(cuts[i], to));
  assert.deepEqual(seen, yearsClosedBetween(cuts[0], cuts.at(-1)));
  assert.equal(new Set(seen).size, seen.length);
});
test('invalid input and backwards windows return no years', () => {
  assert.deepEqual(yearsClosedBetween('nonsense', '1201-01-01'), []);
  assert.deepEqual(yearsClosedBetween('1201-01-01', '1200-01-01'), []);
});
test('a range anchors once, at its start or at the campaign start', () => {
  const range = { date: { kind: 'range', startYear: -3100, endYear: -2686 } };
  assert.equal(eventAnchorYear(range, -3000), -3000);
  assert.equal(eventAnchorYear(range, -3200), -3100);
  assert.equal(eventAnchorYear(range, -2000), null);
});
test('two events in a year sort by importance, then id', () => {
  const at = (id, importance) => ({ id, importance, date: { kind: 'exact', startYear: 1500 } });
  const catalog = { events: [at('b', 1), at('c', 3), at('a', 1)] };
  const rows = eventsForYears(catalog, [1500], 1200);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].year, 1500);
  assert.deepEqual(rows[0].events.map((event) => event.id), ['c', 'a', 'b']);
});
test('an empty catalog and an uncovered year return no rows', () => {
  assert.deepEqual(eventsForYears({ events: [] }, [1500], 1200), []);
  const catalog = { events: [{ id: 'x', importance: 1, date: { kind: 'exact', startYear: 1400 } }] };
  assert.deepEqual(eventsForYears(catalog, [1500], 1200), []);
});
test('the historical record lists the newest year first', () => {
  const at = (id, year) => ({ id, importance: 1, date: { kind: 'exact', startYear: year } });
  const catalog = { events: [at('old', -2), at('new', 1)] };
  const rows = historicalRecord(catalog, '-0002-06-01', '0002-06-01');
  assert.deepEqual(rows.map((row) => row.year), [1, -2]);
});
test('date certainty has a Swedish label per kind', () => {
  const label = (kind) => dateCertaintySv({ date: { kind } });
  assert.equal(label('exact'), 'Säkert år');
  assert.equal(label('approximate'), 'Ungefärligt datum');
  assert.equal(label('range'), 'Tidsspann');
  assert.equal(label('disputed'), 'Omtvistat datum');
});
test('lookup leaves the catalog unchanged and draws no randomness', () => {
  const catalog = {
    events: [
      { id: 'b', importance: 1, date: { kind: 'range', startYear: 1300, endYear: 1600 } },
      { id: 'a', importance: 3, date: { kind: 'exact', startYear: 1500 } },
    ],
  };
  const clone = structuredClone(catalog);
  const realRandom = Math.random;
  Math.random = () => { throw new Error('Math.random must not be called'); };
  try {
    eventsForYears(catalog, [1500], 1200);
    historicalRecord(catalog, '1200-01-01', '1501-01-01');
  } finally {
    Math.random = realRandom;
  }
  assert.deepEqual(catalog, clone);
});
