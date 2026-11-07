import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dateCertaintySv, eventAnchorYear, eventsForYears, historicalRecord, noticeEvents, renderCoverageReport, validateCoverage, validateEventCatalog, yearsClosedBetween } from './historicalEvents.js';
import { checkHistoricalEvents } from '../scripts/check-historical-events.mjs';

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
const fixtureCoverage = { schemaVersion: 1, ranges: [range(-3300, -1), range(1, 1530, 'partial')] };
const source = { id: 's1', title: 'T', institution: 'I', url: 'https://example.org', locator: 'p. 1', retrievedOn: '2026-11-07', originalChronology: 'BC', reuseTerms: 'cite' };
const goodEvent = {
  id: 'e1', titleSv: 'Rubrik', summarySv: 'Sammanfattning', geographySv: 'Egypten', category: 'politics', importance: 2,
  date: { kind: 'exact', startYear: -3100, endYear: -3100, displaySv: '3100 f.Kr.' },
  sourceIds: ['s1'], selectionNote: 'Valt', review: { status: 'approved', reviewedBy: 'sp1e', reviewedOn: '2026-11-07' },
};
const catalogWith = (event, sources = [source]) => ({ schemaVersion: 1, sources, events: [event] });

test('the coverage index partitions all 4,830 years', () => {
  const result = validateCoverage(fixtureCoverage, emptyCatalog);
  assert.equal(result.ok, true);
  assert.equal(Object.values(result.totals).reduce((a, b) => a + b), 4830);
  assert.equal(result.totals.partial, 1530);
});
test('a gap, an overlap or a range holding year zero alone is refused', () => {
  const refused = (ranges) => validateCoverage({ schemaVersion: 1, ranges }, emptyCatalog).ok === false;
  assert.ok(refused([range(-3300, -2), range(1, 1530)]));
  assert.ok(refused([range(-3300, 5), range(5, 1530)]));
  assert.ok(refused([range(-3300, -1), range(0, 0), range(1, 1530)]));
});
const errorsOf = (catalog) => validateEventCatalog(catalog).errors ?? [];
const hasError = (errors, text) => errors.some((error) => error.includes(text));
test('coverage that stops at AD 1200 leaves a gap before the start range ends', () => {
  const errors = validateCoverage({ schemaVersion: 1, ranges: [range(-3300, -1), range(1, 1200)] }, emptyCatalog).errors ?? [];
  assert.ok(hasError(errors, 'gap: ranges stop before 1530'), JSON.stringify(errors));
});
test('an event is refused for each defect, with the error that names it', () => {
  const withDate = (patch) => ({ ...goodEvent, date: { ...goodEvent.date, ...patch } });
  const cases = {
    'year outside the range': [withDate({ startYear: -3400, endYear: -3400 }), 'startYear -3400 is not a year'],
    'year past the range': [withDate({ startYear: 1531, endYear: 1531 }), 'startYear 1531 is not a year in -3300..1530'],
    'start year zero': [withDate({ startYear: 0, endYear: 5, kind: 'range' }), 'startYear 0 is not a year'],
    'start after end': [withDate({ startYear: -3000, endYear: -3100, kind: 'range' }), 'startYear is after endYear'],
    'exact with start != end': [withDate({ endYear: -3000 }), 'exact date must have startYear equal to endYear'],
    'range with start equal to end': [withDate({ kind: 'range' }), 'range date must span more than one year'],
    'unknown date kind': [withDate({ kind: 'vague' }), 'unknown date kind vague'],
    'missing source id': [{ ...goodEvent, sourceIds: ['nope'] }, 'unknown source id nope'],
    'empty sourceIds': [{ ...goodEvent, sourceIds: [] }, 'needs at least one source id'],
    'missing id': [{ ...goodEvent, id: undefined }, 'missing id'],
    'empty id': [{ ...goodEvent, id: '' }, 'missing id'],
    'non-string id': [{ ...goodEvent, id: 7 }, 'missing id'],
    'no Swedish title': [{ ...goodEvent, titleSv: '' }, 'missing titleSv'],
    'unknown category': [{ ...goodEvent, category: 'sport' }, 'unknown category sport'],
    'unapproved review': [{ ...goodEvent, review: { ...goodEvent.review, status: 'draft' } }, 'review status must be approved'],
    'reviewedOn is not a date': [{ ...goodEvent, review: { ...goodEvent.review, reviewedOn: 'yesterday' } }, 'reviewedOn is not a valid date'],
    'reviewedOn is not a calendar day': [{ ...goodEvent, review: { ...goodEvent.review, reviewedOn: '2026-02-30' } }, 'reviewedOn is not a valid date'],
  };
  assert.equal(validateEventCatalog(catalogWith(goodEvent)).ok, true);
  for (const [name, [event, text]] of Object.entries(cases)) {
    const errors = errorsOf(catalogWith(event));
    assert.ok(hasError(errors, text), `${name}: expected "${text}" in ${JSON.stringify(errors)}`);
  }
  const sourceCases = {
    'source without url': [{ ...source, url: '' }, 'missing url'],
    'source without locator': [{ ...source, locator: '' }, 'missing locator'],
    'source with a script url': [{ ...source, url: 'javascript:alert(1)' }, 'url must start with https:// or http://'],
    'source url new URL refuses': [{ ...source, url: 'https://' }, 'url is not a valid URL'],
    'source url with an empty host': [{ ...source, url: 'https://:8080/x' }, 'url is not a valid URL'],
    'retrievedOn is not a date': [{ ...source, retrievedOn: '07/11/2026' }, 'retrievedOn is not a valid date'],
  };
  for (const [name, [bad, text]] of Object.entries(sourceCases)) {
    const errors = errorsOf(catalogWith(goodEvent, [bad]));
    assert.ok(hasError(errors, text), `${name}: expected "${text}" in ${JSON.stringify(errors)}`);
  }
  assert.ok(hasError(errorsOf({ ...emptyCatalog, sources: [source], events: [goodEvent, goodEvent] }), 'duplicate id e1'), 'duplicate id');
});
test('a source that no event cites is refused', () => {
  const unused = { ...source, id: 's2' };
  const errors = errorsOf(catalogWith(goodEvent, [source, unused]));
  assert.ok(hasError(errors, 'source[1]: s2 is cited by no event'), JSON.stringify(errors));
});
test('an empty catalog stays valid, with no sources to cite', () => {
  assert.equal(validateEventCatalog(emptyCatalog).ok, true);
});
test('an event inside a range marked no-secure-event is refused', () => {
  const coverage = { schemaVersion: 1, ranges: [range(-3300, -3000, 'no-secure-event'), range(-2999, -1), range(1, 1530)] };
  const errors = validateCoverage(coverage, catalogWith(goodEvent)).errors ?? [];
  assert.ok(hasError(errors, 'marked no-secure-event'), JSON.stringify(errors));
  assert.equal(validateCoverage(coverage, emptyCatalog).ok, true);
});
test('a range event that overlaps a no-secure-event range at either end is refused', () => {
  const coverage = { schemaVersion: 1, ranges: [range(-3300, -3000, 'no-secure-event'), range(-2999, -1, 'partial'), range(1, 1530, 'partial')] };
  const spanning = (startYear, endYear) => catalogWith({ ...goodEvent, date: { kind: 'range', startYear, endYear, displaySv: 'x' } });
  const startsEarlier = validateCoverage(coverage, spanning(-3200, -3050)).errors ?? [];
  assert.ok(hasError(startsEarlier, 'marked no-secure-event'), `inside: ${JSON.stringify(startsEarlier)}`);
  const endsInside = validateCoverage(coverage, spanning(-3100, -2500)).errors ?? [];
  assert.ok(hasError(endsInside, 'marked no-secure-event'), `start inside, end after: ${JSON.stringify(endsInside)}`);
  const startsBefore = validateCoverage(coverage, spanning(-3300, -2900)).errors ?? [];
  assert.ok(hasError(startsBefore, 'marked no-secure-event'), `start at the edge: ${JSON.stringify(startsBefore)}`);
  assert.equal(validateCoverage(coverage, spanning(-2900, -2500)).ok, true, 'a range clear of it passes');
});
test('a range whose end year falls inside a no-secure-event range is refused', () => {
  const coverage = { schemaVersion: 1, ranges: [range(-3300, -3200, 'partial'), range(-3199, -3000, 'no-secure-event'), range(-2999, -1, 'partial'), range(1, 1530, 'partial')] };
  const event ={ ...goodEvent, date: { kind: 'range', startYear: -3250, endYear: -3100, displaySv: 'x' } };
  const errors = validateCoverage(coverage, catalogWith(event)).errors ?? [];
  assert.ok(hasError(errors, 'marked no-secure-event'), JSON.stringify(errors));
});
test('an event inside a range marked unresearched is refused', () => {
  const coverage = { schemaVersion: 1, ranges: [range(-3300, -1), range(1, 1530, 'partial')] };
  const errors = validateCoverage(coverage, catalogWith(goodEvent)).errors ?? [];
  assert.ok(hasError(errors, 'marked unresearched'), JSON.stringify(errors));
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
  assert.match(first, /4830 calendar years/);
});

test('the committed coverage report matches the catalog', async () => {
  const result = await checkHistoricalEvents({ check: true });
  assert.equal(typeof result.events, 'number');
});
test('thirteen minor events cannot push a major later event out of the notice', () => {
  const minor = Array.from({ length: 13 }, (_, i) => ({ id: `m${i}`, importance: 1, date: { kind: 'exact', startYear: 1000 + i } }));
  const major = { id: 'big', importance: 3, date: { kind: 'exact', startYear: 1100 } };
  const groups = eventsForYears({ events: [...minor, major] }, Array.from({ length: 101 }, (_, i) => 1000 + i), 900);
  const shown = noticeEvents(groups).slice(0, 12);
  assert.equal(shown[0].id, 'big');
  assert.equal(shown.length, 12);
  assert.equal(shown.some((event) => event.id === 'm12'), false);
});
test('the notice order is importance, then year, then id by code point', () => {
  const at = (id, importance, year) => ({ id, importance, date: { kind: 'exact', startYear: year } });
  const groups = [
    { year: 1500, events: [at('b', 2, 1500), at('B', 2, 1500)] },
    { year: 1600, events: [at('a', 2, 1600), at('z', 3, 1600)] },
  ];
  assert.deepEqual(noticeEvents(groups).map((event) => event.id), ['z', 'B', 'b', 'a']);
});
test('ids order by code point in a group, whatever the locale', () => {
  const at = (id) => ({ id, importance: 1, date: { kind: 'exact', startYear: 1500 } });
  const rows = eventsForYears({ events: [at('a'), at('B'), at('Z')] }, [1500], 1200);
  assert.deepEqual(rows[0].events.map((event) => event.id), ['B', 'Z', 'a']);
});
test('a range that crosses the campaign start is reported in the start year', () => {
  const crossing = { id: 'x', importance: 1, date: { kind: 'range', startYear: 1100, endYear: 1300 } };
  const rows = eventsForYears({ events: [crossing] }, [1200, 1201], 1200);
  assert.deepEqual(rows.map((row) => row.year), [1200]);
  assert.deepEqual(historicalRecord({ events: [crossing] }, '1200-01-01', '1202-01-01').map((row) => row.year), [1200]);
});
test('an unknown date kind falls back to the disputed label', () => {
  assert.equal(dateCertaintySv({ date: { kind: 'guess' } }), 'Omtvistat datum');
  assert.equal(dateCertaintySv({}), 'Omtvistat datum');
});
test('an invalid end date returns no years', () => {
  assert.deepEqual(yearsClosedBetween('1201-01-01', 'nonsense'), []);
  assert.deepEqual(yearsClosedBetween('1201-01-01', ''), []);
});
