import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { actionHooks, advanceCharacters, createCharacterSystem, executeCharacterCommand, getCharacterPresentation, normalizeCharacterSystem } from './index.js';
import { refreshCourtStories } from './court.js';
import { actionRandom, plotRandom } from './extensions.js';
import { factionStep, ultimatumChoices, validateFactions } from './factions.js';

// How an ultimatum ends: who comes into the open, who may answer it and who can still be crowned. factionUltimatum.test.js holds the ultimatum itself and the four answers.

const AREL = 'person-0-0';
const SERA = 'person-0-2';
const NAMAR = 'person-1-0';
const DARA = 'person-1-1';
const KELAN = 'person-1-2';
const TALIA = 'person-1-3';
const BAREK = 'person-2-2';
const YARA = 'person-2-3';
const ESHMUNS = 'family-eshmun';
const FOUR = [NAMAR, DARA, KELAN, TALIA];
const STREAM_LIMIT = 50_000_000;
const REGENT_REFUSAL = 'En regent kan inte avsäga sig härskarens tron.';

const plain = (value) => JSON.parse(JSON.stringify(value));
const ok = (result) => { assert.equal(result.ok, true, result.error); return result.state; };
const advance = (state, date) => ok(advanceCharacters(state, date));
const storyOf = (state, id) => state.stories.find((story) => story.id === id);
const loads = (state) => { validateFactions(state); normalizeCharacterSystem(plain(state)); };
let commands = 0;
const command = (state, type, payload) => executeCharacterCommand(state, { id: `ends-test-${++commands}`, expectedRevision: state.revision, type, payload });
const answer = (state, story, choiceId) => command(state, 'resolve_story', { storyId: story.id, choiceId });

// The same searches as factionUltimatum.test.js.
function search(fits) {
  for (let seed = 1; seed < STREAM_LIMIT; seed++) if (fits(seed)) return seed;
  throw new Error('No such stream.');
}
const MISS = search((seed) => plotRandom({ plotRngState: seed }) * 100 >= 99);
const CERTAIN = search((seed) => actionRandom({ actionRngState: seed }) * 100 < 1);
const HOPELESS = search((seed) => actionRandom({ actionRngState: seed }) * 100 >= 99);

// Six years into a reign, a faction of four years: the four Namars stand at strength 54, and only the leader is known once the ultimatum is out.
function opened(fields = {}) {
  const state = plain(createCharacterSystem({ seed: 321 }));
  state.reign.startedAt = addGameMonths(state.date, -72);
  const faction = { id: `faction-${++state.sequence}`, targetRulerId: state.reign.rulerId, leaderId: NAMAR, claimantId: SERA, memberIds: FOUR, knownMemberIds: [], formedAt: addGameMonths(state.date, -48), status: 'active', outcome: null, quietUntil: null, ultimatumAt: null, dueAt: null, storyId: null, concessions: 0, closedAt: null, ...fields };
  state.factions.push(faction);
  state.plotRngState = MISS;
  factionStep(state, [], actionHooks(state));
  const story = state.stories.find((item) => item.type === 'faction_ultimatum' && item.status === 'open');
  assert.ok(story, 'the ultimatum opened');
  return { state, faction, story };
}

// Everyone whose row in the view carries the faction's id.
const rowHolders = (state, factionId) => getCharacterPresentation(state).people.filter(({ opinionReasons }) => opinionReasons.some((row) => row.causeId === factionId)).map(({ id }) => id);

function injure(state, personId) {
  state.people[personId].healthConditions.push({ id: 'ends-test-injury', kind: 'injury', severity: 3, stage: 'active', startedAt: state.date, nextTransitionAt: addGameMonths(state.date, 4), nextExposureAt: null, stageHistory: [{ stage: 'active', date: state.date }], treatment: null, causeId: null, sourceKind: 'calendar', relatedPersonId: null, scarRoll: 0.99, outcomeRoll: 0.99, endedAt: null });
}

const OPEN_ENDS = {
  'a crush': { close: ({ state, story }) => { state.actionRngState = CERTAIN; return ok(answer(state, story, 'crush')); }, outcome: 'crushed', holders: FOUR },
  'a failed crush': { close: ({ state, story }) => { state.actionRngState = HOPELESS; return ok(answer(state, story, 'crush')); }, outcome: 'deposed', holders: [NAMAR] },
  'a deposition': { close: ({ state, story }) => advance(state, story.dueAt), outcome: 'deposed', holders: [NAMAR] },
};
for (const [name, { close, outcome, holders }] of Object.entries(OPEN_ENDS)) test(`${name} brings the whole faction into the open, so every row in the view belongs to a known member`, () => {
  const fixture = opened();
  assert.deepEqual(fixture.faction.knownMemberIds, [NAMAR]);
  const after = close(fixture), [faction] = after.factions;
  assert.equal(faction.outcome, outcome);
  assert.deepEqual(faction.knownMemberIds, FOUR);
  const found = rowHolders(after, faction.id);
  assert.deepEqual(found, holders);
  assert.ok(found.every((id) => faction.knownMemberIds.includes(id)));
  loads(after);
});

test('a head outside the faction keeps the reward of his house and joins no list of members', () => {
  const { state, faction, story } = opened();
  faction.memberIds = [...FOUR, YARA];
  const head = state.families[ESHMUNS].headId;
  assert.ok(!faction.memberIds.includes(head));
  const after = advance(state, story.dueAt), [closed] = after.factions;
  assert.deepEqual(closed.knownMemberIds, [...FOUR, YARA]);
  assert.deepEqual(rowHolders(after, closed.id), [NAMAR, head]);
});

const QUIET_ENDS = {
  'a concession': { close: ({ state, story }) => ok(answer(state, story, 'concede')), status: 'appeased', outcome: null, known: [NAMAR] },
  'an abdication under pressure': { close: ({ state, story }) => ok(answer(state, story, 'abdicate')), status: 'closed', outcome: 'abdicated', known: [NAMAR] },
  // The known leader dies with two others, and Dara ends the faction as its last hidden member.
  'a faction that falls apart': { close: ({ state }) => { actionHooks(state).kill([NAMAR, KELAN, TALIA], [], 'Provfall'); refreshCourtStories(state, [], actionHooks(state)); return state; }, status: 'closed', outcome: 'dissolved', known: [] },
  'a change of reign': { close: ({ state }) => ok(command(state, 'abdicate', {})), status: 'closed', outcome: 'void', known: [NAMAR] },
};
for (const [name, { close, status, outcome, known }] of Object.entries(QUIET_ENDS)) test(`${name} reveals nobody`, () => {
  const after = close(opened()), [faction] = after.factions;
  assert.deepEqual({ status: faction.status, outcome: faction.outcome }, { status, outcome });
  assert.deepEqual(faction.knownMemberIds, known);
  assert.ok(faction.memberIds.length > known.length, 'a member is left to reveal');
  assert.deepEqual(rowHolders(after, faction.id), []);
});

test('a regent cannot abdicate for the ruler, and can still concede or crush', () => {
  const { state, story } = opened();
  injure(state, AREL);
  const ruled = advance(state, addGameMonths(state.date, 1));
  assert.ok(ruled.offices.ruler.regentId);
  const [abdicate, concede, crush] = ultimatumChoices(ruled, storyOf(ruled, story.id), actionHooks(ruled));
  assert.equal(abdicate.disabledReason, REGENT_REFUSAL);
  assert.deepEqual([concede.disabledReason, crush.disabledReason], ['', '']);
  const refused = answer(ruled, story, 'abdicate');
  assert.equal(refused.ok, false);
  assert.equal(refused.state.offices.ruler.holderId, AREL);
  assert.equal(ok(answer(ruled, story, 'concede')).factions[0].status, 'appeased');
});

test('a regent does not hold back the deadline', () => {
  const { state, story } = opened();
  injure(state, AREL);
  const after = advance(advance(state, addGameMonths(state.date, 1)), story.dueAt);
  assert.equal(after.factions[0].outcome, 'deposed');
  assert.equal(after.offices.ruler.holderId, SERA);
});

test('a claimant whose family lands in exile on the deadline is not the one crowned', () => {
  const { state, faction, story } = opened({ claimantId: BAREK });
  state.date = story.dueAt;
  state.families[ESHMUNS].exiled = true;
  const crowned = [], engine = actionHooks(state);
  refreshCourtStories(state, [], { ...engine, crown: (person, ...rest) => { crowned.push(person.id); return engine.crown(person, ...rest); } });
  assert.deepEqual(crowned, [SERA]);
  assert.deepEqual({ claimantId: faction.claimantId, outcome: faction.outcome }, { claimantId: SERA, outcome: 'deposed' });
  validateFactions(state);
});
