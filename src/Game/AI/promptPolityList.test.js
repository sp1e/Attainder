/*! Open Historia - ranked prompt polity list, AGPL-3.0-or-later (see LICENSE). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorldSummary, rankedPolitySummary } from './promptContext.js';

const codeAt = (index) => `polity-${String(index).padStart(2, '0')}`;
const polityWorld = (count) => {
  const polityOverrides = {};
  for (let index = 1; index <= count; index += 1) {
    polityOverrides[codeAt(index)] = { code: codeAt(index), name: `Realm ${index}`, aliases: [] };
  }
  return { polityOverrides, regionOwnershipOverrides: {}, wars: [], regionClaimants: {} };
};
const fullLine = (index) => `- ${codeAt(index)}: Realm ${index}`;
const pendingActions = [
  { title: 'Envoy to Realm 7', description: 'Ask Realm 12 for grain.', resolved: false },
  { title: 'Old treaty with Realm 3', resolved: true },
];

test('the player and the polities in pending actions lead, the rest overflow into a names line', () => {
  const text = rankedPolitySummary(polityWorld(20), { playerName: codeAt(20), bundle: { actions: pendingActions } });
  const lines = text.split('\n');
  const rest = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 13, 14, 15];
  assert.deepEqual(lines.slice(0, 16), [fullLine(20), fullLine(7), fullLine(12), ...rest.map(fullLine)]);
  assert.equal(lines.length, 17);
  assert.equal(lines[16], 'Other polities: Realm 16, Realm 17, Realm 18, Realm 19');
});

test('the names line holds 40 names and counts what it leaves out', () => {
  const lines = rankedPolitySummary(polityWorld(60), { playerName: '' }).split('\n');
  assert.equal(lines.length, 17);
  assert.deepEqual(lines.slice(0, 16), Array.from({ length: 16 }, (_, index) => fullLine(index + 1)));
  const names = Array.from({ length: 40 }, (_, index) => `Realm ${index + 17}`);
  assert.equal(lines[16], `Other polities: ${names.join(', ')}, +4 more`);
  assert.ok(lines[16].startsWith('Other polities:'));
  assert.ok(lines[16].endsWith('+4 more'));
});

test('no polities gives the empty-world sentence', () => {
  assert.equal(rankedPolitySummary(polityWorld(0), {}), 'No dynamic polity overrides are currently recorded.');
  assert.equal(rankedPolitySummary({}, {}), 'No dynamic polity overrides are currently recorded.');
});

test('without any focus the lines keep insertion order', () => {
  const text = rankedPolitySummary(polityWorld(10), { playerName: '' });
  assert.equal(text, Array.from({ length: 10 }, (_, index) => fullLine(index + 1)).join('\n'));
});

test('full lines keep colour, aliases and note', () => {
  const world = { polityOverrides: {
    a: { code: 'a', name: 'Alpha', color: '#112233', aliases: ['Al', 'Alfa'], note: 'Old kingdom.' },
    b: { code: 'b', aliases: [] },
  } };
  assert.equal(rankedPolitySummary(world, {}), '- a: Alpha (#112233) aliases Al, Alfa — Old kingdom.\n- b: b');
});

test('the ranking is deterministic', () => {
  const context = { playerName: codeAt(20), bundle: { actions: pendingActions } };
  assert.equal(rankedPolitySummary(polityWorld(60), context), rankedPolitySummary(polityWorld(60), context));
});

test('the world summary lists the player first among the polities', async () => {
  const summary = await buildWorldSummary({
    world: polityWorld(20),
    game: { country: codeAt(20) },
    actions: pendingActions,
    events: [],
    chats: [],
  }, []);
  const lines = summary.split('\n');
  const heading = lines.indexOf('Dynamic polity overrides:');
  assert.ok(heading >= 0);
  assert.equal(lines[heading + 1], fullLine(20));
  assert.equal(lines[heading + 2], fullLine(7));
  assert.equal(lines[heading + 17], 'Other polities: Realm 16, Realm 17, Realm 18, Realm 19');
});
