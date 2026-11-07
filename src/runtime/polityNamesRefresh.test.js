import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldRefreshPolityNames } from './polityNamesRefresh.js';

const known = new Set(['johns-realms']);

test('a cache older than 15 seconds refreshes', () => {
  assert.equal(shouldRefreshPolityNames({ now: 20000, refreshedAt: 4000, code: 'johns-realms', known }), true);
});

test('a fresh cache that knows the code does not refresh', () => {
  assert.equal(shouldRefreshPolityNames({ now: 5000, refreshedAt: 4000, code: 'johns-realms', known }), false);
});

test('a code missing from a fresh cache refreshes after one second, as after a switch to another world', () => {
  assert.equal(shouldRefreshPolityNames({ now: 5500, refreshedAt: 4000, code: 'papal-states', known }), true);
});

test('a missing code refreshes at most once a second', () => {
  assert.equal(shouldRefreshPolityNames({ now: 4500, refreshedAt: 4000, code: 'papal-states', known }), false);
});

test('an empty code never forces a refresh', () => {
  assert.equal(shouldRefreshPolityNames({ now: 5500, refreshedAt: 4000, code: '  ', known }), false);
});
