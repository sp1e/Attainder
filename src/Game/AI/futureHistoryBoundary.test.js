import test from "node:test";
import assert from "node:assert/strict";

import { buildRealHistoryDirective, historicalJumpTemplate } from "./futureHistoryBoundary.js";
import { readFileSync } from 'node:fs';
import { createHistoricalCharacterSystem } from '../../runtime/characters/scenarioSeed.js';
import { getCharacterPresentation } from '../../runtime/characters/index.js';
import { buildHistoricalPromptContext } from '../../runtime/characterWorld.js';

test('historical context replaces mandatory future history, without treating scenario metadata alone as an opt-in', () => {
  const data = JSON.parse(readFileSync(new URL('../../../server/seed/historical/john-1200/scenario.json', import.meta.url), 'utf8')).data;
  const state = createHistoricalCharacterSystem({ historicalScenario: data.world.historicalScenario, date: data.game.startDate, polityId: data.game.country, seed: 321 });
  const historicalContext = buildHistoricalPromptContext(getCharacterPresentation(state));
  const result = buildRealHistoryDirective({ historicalContext, game: { ...data.game, gameDate: '1201-09-01' } });
  assert.match(result, /alternate outcomes/);
  assert.doesNotMatch(result, /the real events of this period happen|stays the default/);
  const legacy = buildRealHistoryDirective({ world: data.world, game: data.game });
  assert.match(legacy, /the real events of this period happen/);
  assert.equal(buildRealHistoryDirective({ historicalContext: { contentId: 'fake' }, world: data.world, game: data.game }), legacy);
  const custom = 'An inline mention [Real History Is the Default] stays.\r\n[Real History Is the Default]\r\nReplace this.\r\n[Author rules]\r\nKeep this.\r\n';
  const changed = historicalJumpTemplate(custom, historicalContext);
  assert.ok(changed.startsWith('An inline mention [Real History Is the Default] stays.\r\n'));
  assert.ok(changed.endsWith('[Author rules]\r\nKeep this.\r\n'));
  assert.ok(!changed.includes('Replace this.'));
  assert.equal(historicalJumpTemplate(custom, undefined), custom);
  assert.equal(historicalJumpTemplate(custom, { ...historicalContext, bookmarkDate: '0000-01-01' }), custom);
});

// A skip through May 2014 holds that month's real elections, coups and crises
// unless this game has changed their causes.
test("a game keeps following real history after its start", () => {
  const text = buildRealHistoryDirective({ game: { startDate: "2014-03-22", gameDate: "2014-04-21" } });
  assert.match(text, /^\[This Game and Real History\]/);
  assert.match(text, /This game began on 2014-03-22, and this jump starts on 2014-04-21\./);
  assert.match(text, /stays the default for everything the game has not changed/);
  assert.match(text, /the real events of this period happen, with their real people, places, dates and numbers/);
  assert.match(text, /another history or a world of its own follows that instead/);
});

test("the first jump of a game says only when it began", () => {
  const text = buildRealHistoryDirective({ game: { startDate: "1936-01-01", gameDate: "1936-01-01" } });
  assert.match(text, /This game began on 1936-01-01\. Real history/);
});

test("it forbids nothing the model remembers", () => {
  const text = buildRealHistoryDirective({ game: { startDate: "1912-01-01" } });
  for (const gone of [/MEMORY IS NOT EVIDENCE/i, /COUNTERFACTUAL FUTURE/i, /BRANCH AUDIT/i, /admissible only/i]) {
    assert.doesNotMatch(text, gone);
  }
});
