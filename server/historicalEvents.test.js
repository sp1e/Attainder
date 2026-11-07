import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dateCertaintySv, eventAnchorYear, eventsForYears, historicalRecord, renderCoverageReport, validateCoverage, validateEventCatalog, yearsClosedBetween } from './historicalEvents.js';

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

const emptyCatalog = { schemaVersion: 1, sources: [], events: [] };
const range = (startYear, endYear, status = 'unresearched') => ({ startYear, endYear, status, note: 'test' });
const fixtureCoverage = { schemaVersion: 1, ranges: [range(-3300, -1), range(1, 1200, 'partial')] };
const source = { id: 's1', title: 'T', institution: 'I', url: 'https://example.org', locator: 'p. 1', retrievedOn: '2026-11-07', originalChronology: 'BC', reuseTerms: 'cite' };
const goodEvent = {
  id: 'e1', titleSv: 'Rubrik', summarySv: 'Sammanfattning', geographySv: 'Egypten', category: 'politics', importance: 2,
  date: { kind: 'exact', startYear: -3100, endYear: -3100, displaySv: '3100 f.Kr.' },
  sourceIds: ['s1'], selectionNote: 'Valt', review: { status: 'approved', reviewedBy: 'sp1e', reviewedOn: '2026-11-07' },
};
const catalogWith = (event, sources = [source]) => ({ schemaVersion: 1, sources, events: [event] });

test('the coverage index partitions all 4,500 years', () => {
  const result = validateCoverage(fixtureCoverage, emptyCatalog);
  assert.equal(result.ok, true);
  assert.equal(Object.values(result.totals).reduce((a, b) => a + b), 4500);
  assert.equal(result.totals.partial, 1200);
});
test('a gap, an overlap or a range holding year zero alone is refused', () => {
  const refused = (ranges) => validateCoverage({ schemaVersion: 1, ranges }, emptyCatalog).ok === false;
  assert.ok(refused([range(-3300, -2), range(1, 1200)]));
  assert.ok(refused([range(-3300, 5), range(5, 1200)]));
  assert.ok(refused([range(-3300, -1), range(0, 0), range(1, 1200)]));
});
test('an event is refused for each defect', () => {
  const withDate = (patch) => ({ ...goodEvent, date: { ...goodEvent.date, ...patch } });
  const cases = {
    'year outside the range': withDate({ startYear: -3400, endYear: -3400 }),
    'start year zero': withDate({ startYear: 0, endYear: 5, kind: 'range' }),
    'start after end': withDate({ startYear: -3000, endYear: -3100, kind: 'range' }),
    'exact with start != end': withDate({ endYear: -3000 }),
    'missing source id': { ...goodEvent, sourceIds: ['nope'] },
    'missing id': { ...goodEvent, id: undefined },
    'empty id': { ...goodEvent, id: '' },
    'non-string id': { ...goodEvent, id: 7 },
    'no Swedish title': { ...goodEvent, titleSv: '' },
    'unknown category': { ...goodEvent, category: 'sport' },
    'unapproved review': { ...goodEvent, review: { ...goodEvent.review, status: 'draft' } },
  };
  assert.equal(validateEventCatalog(catalogWith(goodEvent)).ok, true);
  for (const [name, event] of Object.entries(cases)) assert.equal(validateEventCatalog(catalogWith(event)).ok, false, name);
  assert.equal(validateEventCatalog(catalogWith(goodEvent, [{ ...source, url: '' }])).ok, false, 'source without url');
  assert.equal(validateEventCatalog(catalogWith(goodEvent, [{ ...source, locator: '' }])).ok, false, 'source without locator');
  assert.equal(validateEventCatalog(catalogWith(goodEvent, [{ ...source, url: 'javascript:alert(1)' }])).ok, false, 'source with a script url');
  assert.equal(validateEventCatalog({ ...emptyCatalog, sources: [source], events: [goodEvent, goodEvent] }).ok, false, 'duplicate id');
});
test('an event inside a range marked no-secure-event is refused', () => {
  const coverage = { schemaVersion: 1, ranges: [range(-3300, -3000, 'no-secure-event'), range(-2999, -1), range(1, 1200)] };
  assert.equal(validateCoverage(coverage, catalogWith(goodEvent)).ok, false);
  assert.equal(validateCoverage(coverage, emptyCatalog).ok, true);
});
test('the committed catalog and coverage pass', () => {
  const read = (name) => JSON.parse(readFileSync(new URL(`./seed/historical/events/${name}`, import.meta.url), 'utf8'));
  const catalog = read('catalog.json');
  assert.equal(validateEventCatalog(catalog).ok, true);
  assert.equal(validateCoverage(read('coverage.json'), catalog).ok, true);
});
test('the coverage report is stable', () => {
  const first = renderCoverageReport(fixtureCoverage, emptyCatalog);
  assert.equal(first, renderCoverageReport(fixtureCoverage, emptyCatalog));
  assert.match(first, /4500 calendar years/);
});
