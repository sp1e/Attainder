import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { actionHooks, advanceCharacters, applyRealmDissolution, createCharacterSystem, executeCharacterCommand, normalizeCharacterSystem } from './index.js';
import { ambitionOf } from './council.js';
import { courtAnnualStep, refreshCourtStories, validateCourt } from './court.js';
import { actionRandom, plotRandom } from './extensions.js';
import { DISCONTENT_THRESHOLD, FORM_BASE, FOUNDERS, GRACE_MONTHS, JOIN_CHANCE, LEAVE_BELOW, MATURITY_PER_YEAR, ULTIMATUM_STRENGTH, claimantFor, discontentOf, factionStep, factionStrength, presentFactions, refreshFactions, validateFactions, voidFactions } from './factions.js';
import { setRelationship } from './secrets.js';

const AREL = 'person-0-0';
const ISET = 'person-0-1';
const SERA = 'person-0-2';
const TAREK = 'person-0-3';
const MIRA = 'person-0-4';
const NAMAR = 'person-1-0';
const DARA = 'person-1-1';
const KELAN = 'person-1-2';
const TALIA = 'person-1-3';
const BAREK = 'person-2-2';
const YARA = 'person-2-3';
const SAFRA = 'person-3-0';
const CHILDLESS = 'person-3-5';
const ARELS = 'family-arel';
const NAMARS = 'family-namar';
const ESHMUNS = 'family-eshmun';
const SAFRAS = 'family-safra';
const FOUR = [NAMAR, DARA, KELAN, TALIA];
const STREAM_LIMIT = 50_000_000;
const TRACE_SPY = 'Din spionmästare har hittat ännu en person i en faktion mot härskaren.';
const TRACE_RUMOR = 'Du har hört talas om ännu en person i en faktion mot härskaren.';

const plain = (value) => JSON.parse(JSON.stringify(value));
const base = (options = {}) => plain(createCharacterSystem({ seed: 321, ...options }));
const ok = (result) => { assert.equal(result.ok, true, result.error); return result.state; };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`);
let commands = 0;
const command = (state, type, payload) => executeCharacterCommand(state, { id: `faction-test-${++commands}`, expectedRevision: state.revision, type, payload });

// A plot stream whose next draws, as percents, pass the checks in order, as in familyDemands.test.js.
function streamWith(...checks) {
  for (let seed = 1; seed < STREAM_LIMIT; seed++) {
    const probe = { plotRngState: seed };
    if (checks.every((check) => check(plotRandom(probe) * 100))) return seed;
  }
  throw new Error('No such stream.');
}
const HIT = streamWith((roll) => roll < 1);
const MISS = streamWith((roll) => roll >= 99);
const within = (low, high) => streamWith((roll) => roll >= low && roll < high);
const afterDraws = (seed, count) => { const probe = { plotRngState: seed }; for (let i = 0; i < count; i++) plotRandom(probe); return probe.plotRngState; };
// An action stream whose first roll is a success at any odds.
function certainAction() {
  for (let seed = 1; seed < STREAM_LIMIT; seed++) if (actionRandom({ actionRngState: seed }) * 100 < 1) return seed;
  throw new Error('No such stream.');
}

// A reign old enough for a faction. The four adult Namars stand at about 25 from the first day, every other house below the threshold.
const ready = (options = {}, months = GRACE_MONTHS) => { const state = base(options); state.reign.startedAt = addGameMonths(state.date, -months); return state; };
const step = (state, events = []) => { factionStep(state, events, actionHooks(state)); return events; };
const stepOn = (state, stream) => { state.plotRngState = stream; return step(state); };
function opinionOf(state, fromId, amount, toId = AREL) {
  const key = `${fromId}:${toId}`;
  state.relations[key] ??= { fromId, toId, bonds: [], causes: [] };
  state.relations[key].causes.push({ id: `fixture-${++state.sequence}`, amount, label: 'Provvärde', causeId: `fixture-${state.sequence}`, startAt: state.date, expiresAt: null });
}
// Above LEAVE_BELOW and under the threshold: a member stays and a stranger does not join.
const lukewarm = (state, ...ids) => { for (const id of ids) opinionOf(state, id, 40); };
// Under LEAVE_BELOW: a member leaves.
const calm = (state, ...ids) => { for (const id of ids) opinionOf(state, id, 80); };
const jail = (state, personId, n = 1) => { state.prisoners.push({ id: `prisoner-${n}`, personId, captorFamilyId: ARELS, since: state.date, ransom: 40, status: 'held', closedAt: null, reason: null }); };
function record(state, fields = {}) {
  return { id: `faction-${++state.sequence}`, targetRulerId: state.reign.rulerId, leaderId: NAMAR, claimantId: SERA, memberIds: [NAMAR, DARA, KELAN], knownMemberIds: [], formedAt: state.date, status: 'active', outcome: null, quietUntil: null, ultimatumAt: null, dueAt: null, storyId: null, concessions: 0, closedAt: null, ...fields };
}
const withFaction = (state, fields) => { const faction = record(state, fields); state.factions.push(faction); return faction; };
const everyoneKnown = { memberIds: FOUR, knownMemberIds: FOUR };

// Nothing to hold against the crown: support 60 through the hook, legitimacy 60, no grievance, no trait, no fear and no seat. Every term then stands alone.
function neutral() {
  const state = base(), person = state.people[TALIA], family = state.families[NAMARS];
  state.realm.legitimacy = 60;
  Object.assign(family, { grievance: 0, influence: 45 });
  Object.assign(person, { traits: [], fear: 0 });
  return { state, person, family, hooks: { ...actionHooks(state), familySupport: () => 60 } };
}

test('the constants are the brief\'s', () => {
  assert.deepEqual({ DISCONTENT_THRESHOLD, LEAVE_BELOW, FOUNDERS, FORM_BASE, JOIN_CHANCE, GRACE_MONTHS, ULTIMATUM_STRENGTH, MATURITY_PER_YEAR }, { DISCONTENT_THRESHOLD: 16, LEAVE_BELOW: 5, FOUNDERS: 3, FORM_BASE: 40, JOIN_CHANCE: 50, GRACE_MONTHS: 24, ULTIMATUM_STRENGTH: 50, MATURITY_PER_YEAR: 6 });
});

test('a neutral person holds no discontent', () => {
  const { state, person, hooks } = neutral();
  near(discontentOf(state, person, hooks), 0);
});

const TERMS = {
  'the opinion of the ruler counts half, against': [({ state }) => opinionOf(state, TALIA, -20), 10],
  'the opinion of the ruler counts half, for': [({ state }) => opinionOf(state, TALIA, 20), -10],
  'family support under 60 counts 0.6': [({ hooks }) => { hooks.familySupport = () => 50; }, 6],
  'family support over 60 counts 0.6': [({ hooks }) => { hooks.familySupport = () => 70; }, -6],
  'grievance counts half against the crown': [({ family }) => { family.grievance = -10; }, 5],
  'grievance in the crown\'s favour counts half': [({ family }) => { family.grievance = 10; }, -5],
  'legitimacy under 60 counts 0.3': [({ state }) => { state.realm.legitimacy = 50; }, 3],
  'legitimacy over 60 counts 0.3': [({ state }) => { state.realm.legitimacy = 70; }, -3],
  'an ambitious person adds 10': [({ person }) => { person.traits = ['ambitious']; }, 10],
  'a vengeful person adds 8': [({ person }) => { person.traits = ['vengeful']; }, 8],
  'a seat at service below 30 adds 10': [({ state, person }) => { state.offices.chancellor.holderId = person.id; person.loyalty = 29; }, 10],
  'a seat at service 30 adds nothing': [({ state, person }) => { state.offices.chancellor.holderId = person.id; person.loyalty = 30; }, 0],
  'a seat outside the council adds nothing': [({ state, person }) => { state.offices.priest.holderId = person.id; person.loyalty = 10; }, 0],
  'a person of no trait loses fear × 0.3': [({ person }) => { person.fear = 20; }, -6],
  'a cautious person loses fear × 0.6': [({ person }) => { person.traits = ['cautious']; person.fear = 20; }, -12],
  'a craven person loses fear × 0.6': [({ person }) => { person.traits = ['craven']; person.fear = 20; }, -12],
  'a vengeful person at fear 15 gets it back': [({ person }) => { person.traits = ['vengeful']; person.fear = 15; }, 8],
  'a vengeful person at fear 14 does not': [({ person }) => { person.traits = ['vengeful']; person.fear = 14; }, 8 - 4.2],
  'a brave person at fear 15 gets it back': [({ person }) => { person.traits = ['brave']; person.fear = 15; }, 0],
  'a brave person at fear 14 does not': [({ person }) => { person.traits = ['brave']; person.fear = 14; }, -4.2],
  'a vengeful coward keeps half the loss': [({ person }) => { person.traits = ['vengeful', 'cautious']; person.fear = 20; }, 8 - 12 + 6],
};
for (const [name, [arrange, expected]] of Object.entries(TERMS)) test(`discontentOf: ${name}`, () => {
  const fixture = neutral();
  arrange(fixture);
  near(discontentOf(fixture.state, fixture.person, fixture.hooks), expected);
});

test('discontentOf: wanting the throne adds 8 beside the ambitious trait', () => {
  const { state, person, family, hooks } = neutral();
  person.traits = ['ambitious'];
  family.influence = 50;
  assert.equal(ambitionOf(state, person, hooks), 'throne');
  near(discontentOf(state, person, hooks), 10 + 8);
  family.influence = 49;
  assert.notEqual(ambitionOf(state, person, hooks), 'throne');
  near(discontentOf(state, person, hooks), 10);
});

test('discontentOf: a nemesis of the ruler adds 10, in either id order', () => {
  const held = neutral();
  setRelationship(held.state, { kind: 'nemesis', aId: TALIA, bId: AREL });
  near(discontentOf(held.state, held.person, held.hooks), 10);
  const reversed = neutral();
  setRelationship(reversed.state, { kind: 'nemesis', aId: AREL, bId: TALIA });
  near(discontentOf(reversed.state, reversed.person, reversed.hooks), 10);
});

test('discontentOf: a nemesis of someone else and a rival of the ruler add nothing', () => {
  const { state, person, hooks } = neutral();
  setRelationship(state, { kind: 'nemesis', aId: TALIA, bId: SERA });
  setRelationship(state, { kind: 'rival', aId: TALIA, bId: AREL });
  setRelationship(state, { kind: 'nemesis', aId: DARA, bId: AREL });
  near(discontentOf(state, person, hooks), 0);
});

test('fear holds cautious nobles back and drives vengeful ones', () => {
  const at = (traits, fear) => { const { state, person, hooks } = neutral(); Object.assign(person, { traits, fear }); return discontentOf(state, person, hooks); };
  near(at(['cautious'], 40) - at(['cautious'], 0), -24);
  near(at(['vengeful'], 40) - at(['vengeful'], 0), 0);
  // A cautious noble stops at the threshold his vengeful neighbour keeps crossing.
  const state = ready(), hooks = actionHooks(state);
  for (const id of [DARA, KELAN]) state.people[id].traits = ['ambitious', 'cautious'];
  for (const id of FOUR) state.people[id].fear = 30;
  assert.ok(discontentOf(state, state.people[DARA], hooks) < DISCONTENT_THRESHOLD);
  assert.ok(discontentOf(state, state.people[TALIA], hooks) >= DISCONTENT_THRESHOLD);
  // Two free of fear are too few, so the frightened house founds nothing.
  stepOn(state, HIT);
  assert.deepEqual(state.factions, []);
});

test('a faction needs three discontented nobles and a reign of 24 months', () => {
  const young = ready({}, GRACE_MONTHS - 1);
  stepOn(young, HIT);
  assert.deepEqual(young.factions, []);
  assert.equal(young.plotRngState, HIT, 'a young reign draws nothing');

  const two = ready();
  lukewarm(two, KELAN, TALIA);
  stepOn(two, HIT);
  assert.deepEqual(two.factions, []);
  assert.equal(two.plotRngState, HIT, 'two nobles draw nothing');

  const three = ready();
  lukewarm(three, TALIA);
  const sequence = three.sequence;
  stepOn(three, HIT);
  assert.equal(three.plotRngState, afterDraws(HIT, 1), 'one draw');
  assert.deepEqual(three.factions, [{ id: `faction-${sequence + 1}`, targetRulerId: AREL, leaderId: NAMAR, claimantId: SERA, memberIds: [NAMAR, DARA, KELAN], knownMemberIds: [], formedAt: three.date, status: 'active', outcome: null, quietUntil: null, ultimatumAt: null, dueAt: null, storyId: null, concessions: 0, closedAt: null }]);
  validateFactions(three);

  const missed = ready();
  stepOn(missed, MISS);
  assert.deepEqual(missed.factions, []);
  assert.equal(missed.plotRngState, afterDraws(MISS, 1), 'a missed roll is one draw too');
});

test('the three most discontented found the faction, and the leader is the highest, then the lowest id', () => {
  const state = ready();
  opinionOf(state, TALIA, -30);
  opinionOf(state, KELAN, -20);
  stepOn(state, HIT);
  const [faction] = state.factions;
  assert.equal(faction.leaderId, TALIA);
  assert.deepEqual(faction.memberIds, [NAMAR, KELAN, TALIA], 'sorted, with Namar first of the tie between him and Dara');

  const tied = ready();
  stepOn(tied, HIT);
  assert.equal(tied.factions[0].leaderId, NAMAR);
  assert.deepEqual(tied.factions[0].memberIds, [NAMAR, DARA, KELAN]);
});

test('the formation chance is 40 plus the top discontent, by difficulty, at most 90', () => {
  for (const [difficulty, scale] of [['easy', 0.5], ['normal', 1], ['hard', 1.5]]) {
    const fresh = () => { const state = ready(); state.difficulty = difficulty; return state; };
    const probe = fresh(), hooks = actionHooks(probe);
    const top = Math.max(...FOUR.map((id) => discontentOf(probe, probe.people[id], hooks)));
    const chance = Math.min(90, (FORM_BASE + top) * scale);
    if (difficulty === 'hard') assert.equal(chance, 90, 'the hard chance meets the cap');
    const below = fresh(), above = fresh();
    stepOn(below, within(chance - 1, chance));
    stepOn(above, within(chance, chance + 1));
    assert.equal(below.factions.length, 1, difficulty);
    assert.equal(above.factions.length, 0, difficulty);
  }
});

const UNFIT = {
  'an exiled family': (state) => { state.families[NAMARS].exiled = true; },
  'prisoners': (state) => { jail(state, KELAN, 1); jail(state, TALIA, 2); },
  'the dead': (state) => { state.people[KELAN].diedAt = state.date; state.people[TALIA].diedAt = state.date; },
  'minors': (state) => { state.people[KELAN].bornAt = addGameMonths(state.date, -120); state.people[TALIA].bornAt = addGameMonths(state.date, -120); },
};
for (const [name, arrange] of Object.entries(UNFIT)) test(`${name} cannot found a faction and cost no draw`, () => {
  const state = ready();
  arrange(state);
  stepOn(state, HIT);
  assert.deepEqual(state.factions, []);
  assert.equal(state.plotRngState, HIT);
});

test('the ruler\'s own family cannot found a faction', () => {
  const state = ready();
  state.families[NAMARS].exiled = true;
  for (const id of [ISET, SERA, TAREK]) { state.people[id].traits = ['ambitious', 'vengeful']; opinionOf(state, id, -80); }
  assert.ok(discontentOf(state, state.people[SERA], actionHooks(state)) >= DISCONTENT_THRESHOLD);
  stepOn(state, HIT);
  assert.deepEqual(state.factions, []);
  assert.equal(state.plotRngState, HIT);
});

test('forming a faction logs nothing and leaves no memory', () => {
  const state = ready();
  state.plotRngState = HIT;
  const before = plain(state), events = step(state);
  assert.equal(state.factions.length, 1);
  assert.deepEqual(events, []);
  assert.deepEqual(state.log, before.log);
  assert.deepEqual(state.memories, before.memories);
  assert.deepEqual(state.stories, before.stories);
  // Past the record itself, its id and the one draw, the state has not moved.
  const rest = ({ factions, plotRngState, sequence, ...other }) => other;
  assert.deepEqual(rest(plain(state)), rest(before));
});

test('the step draws from the plot stream alone', () => {
  const state = ready();
  withFaction(state, { memberIds: [NAMAR, DARA] });
  const { rngState, actionRngState } = state;
  stepOn(state, HIT);
  assert.equal(state.rngState, rngState);
  assert.equal(state.actionRngState, actionRngState);
  assert.notEqual(state.plotRngState, HIT);
});

test('a live faction shuts out a second one, and a closed one does not', () => {
  const state = ready();
  const faction = withFaction(state, { memberIds: FOUR, knownMemberIds: FOUR });
  stepOn(state, HIT);
  assert.deepEqual(state.factions, [faction]);
  Object.assign(faction, { status: 'closed', outcome: 'dissolved', closedAt: state.date });
  stepOn(state, HIT);
  assert.equal(state.factions.length, 2);
  validateFactions(state);
});

const discovers = (chance, prepare = () => {}) => {
  const run = (roll) => { const state = ready(); withFaction(state, { memberIds: FOUR }); prepare(state); stepOn(state, roll); return state.factions[0].knownMemberIds.length; };
  assert.equal(run(within(chance - 1, chance)), 1, `a roll under ${chance}`);
  assert.equal(run(within(chance, chance + 1)), 0, `a roll of ${chance}`);
};
const spymaster = (loyalty, intrigue = 7) => (state) => { state.offices.spymaster.holderId = SERA; state.people[SERA].loyalty = loyalty; state.people[SERA].skills.intrigue = intrigue; };

test('discovery reads half the representative\'s intrigue with no spymaster', () => {
  discovers(25); // Arel's intrigue of 4 reads as 2
  discovers(15, (state) => { state.people[AREL].skills.intrigue = 0; });
});

test('discovery reads the spymaster, and +10 comes on top of the cap for a faithful one', () => {
  discovers(50, spymaster(60));
  discovers(60, spymaster(68));
  discovers(70, spymaster(60, 14));
  discovers(80, spymaster(68, 14));
});

test('discovery takes the first hidden member, a year at a time', () => {
  const state = ready();
  const faction = withFaction(state, { memberIds: FOUR, knownMemberIds: [DARA] });
  stepOn(state, HIT);
  assert.deepEqual(faction.knownMemberIds, [NAMAR, DARA]);
  assert.equal(state.plotRngState, afterDraws(HIT, 1), 'once a year');
  stepOn(state, HIT);
  assert.deepEqual(faction.knownMemberIds, [NAMAR, DARA, KELAN]);
  validateFactions(state);
});

test('the discovery event names nobody', () => {
  for (const [holderId, description] of [[null, TRACE_RUMOR], [SERA, TRACE_SPY]]) {
    const state = ready(), events = [];
    withFaction(state, { memberIds: FOUR });
    state.offices.spymaster.holderId = holderId;
    state.plotRngState = HIT;
    step(state, events);
    assert.equal(events.length, 1);
    const [event] = events;
    assert.equal(event.title, 'Spår av en faktion');
    assert.equal(event.description, description);
    assert.deepEqual(event.participants, []);
    assert.equal(state.log.at(-1).id, event.id);
    const text = JSON.stringify(event);
    for (const person of Object.values(state.people)) { assert.equal(text.includes(person.name), false, person.name); assert.equal(text.includes(person.id), false, person.id); }
    for (const family of Object.values(state.families)) assert.equal(text.includes(family.name), false, family.name);
  }
});

test('discovery draws only when a member is hidden', () => {
  const state = ready();
  withFaction(state, everyoneKnown);
  const events = stepOn(state, HIT) ?? [];
  assert.equal(state.plotRngState, HIT);
  assert.deepEqual(events, []);
});

test('a faction does not surface in the year it forms', () => {
  const state = ready();
  const hitTwice = streamWith((roll) => roll < 1, (roll) => roll < 1);
  stepOn(state, hitTwice);
  assert.equal(state.factions.length, 1);
  assert.deepEqual(state.factions[0].knownMemberIds, []);
  assert.equal(state.plotRngState, afterDraws(hitTwice, 1));
});

test('members who calm down leave with no draw', () => {
  const state = ready();
  const faction = withFaction(state, { memberIds: [NAMAR, DARA, KELAN], knownMemberIds: [NAMAR, DARA, KELAN] });
  lukewarm(state, TALIA);
  calm(state, DARA);
  assert.ok(discontentOf(state, state.people[DARA], actionHooks(state)) < LEAVE_BELOW);
  stepOn(state, HIT);
  assert.deepEqual(faction.memberIds, [NAMAR, KELAN]);
  assert.deepEqual(faction.knownMemberIds, [NAMAR, KELAN], 'a known member who left is no known member');
  assert.equal(faction.status, 'active');
  assert.equal(state.plotRngState, HIT);
  validateFactions(state);
});

test('a member at exactly the leaving line stays, and half a point under it leaves', () => {
  // With no trait, grievance or doubt about legitimacy, Dara's discontent is half her opinion against the ruler.
  const atOpinion = (opinion) => {
    const state = ready();
    const faction = withFaction(state, { memberIds: FOUR, knownMemberIds: FOUR });
    state.realm.legitimacy = 60;
    state.families[NAMARS].grievance = 0;
    state.people[DARA].traits = [];
    opinionOf(state, DARA, opinion);
    const hooks = { ...actionHooks(state), familySupport: () => 60 };
    factionStep(state, [], hooks);
    return { stays: faction.memberIds.includes(DARA), discontent: discontentOf(state, state.people[DARA], hooks) };
  };
  assert.deepEqual(atOpinion(-10), { stays: true, discontent: LEAVE_BELOW });
  assert.deepEqual(atOpinion(-9), { stays: false, discontent: LEAVE_BELOW - 0.5 });
});

test('a leader who calms down hands over to the most discontented member', () => {
  const state = ready();
  const faction = withFaction(state, { memberIds: [NAMAR, DARA, KELAN], knownMemberIds: [NAMAR, DARA, KELAN] });
  lukewarm(state, TALIA);
  calm(state, NAMAR);
  opinionOf(state, KELAN, -10);
  stepOn(state, HIT);
  assert.deepEqual(faction.memberIds, [DARA, KELAN]);
  assert.equal(faction.leaderId, KELAN);
});

test('non-members at the threshold draw in id order, and only they draw', () => {
  const state = ready();
  const faction = withFaction(state, { memberIds: [NAMAR, DARA], knownMemberIds: [NAMAR, DARA] });
  const stream = streamWith((roll) => roll >= 99, (roll) => roll < 1, (roll) => roll >= 99);
  stepOn(state, stream);
  assert.deepEqual(faction.memberIds, [NAMAR, DARA, TALIA], 'Kelan drew first and missed, Talia hit');
  assert.deepEqual(faction.knownMemberIds, [NAMAR, DARA], 'a new member starts hidden');
  // Talia is hidden, so the year ended with a third draw for discovery.
  assert.equal(state.plotRngState, afterDraws(stream, 3));
  validateFactions(state);
});

test('a joiner lands in id order among the members', () => {
  const state = ready();
  const faction = withFaction(state, { memberIds: [NAMAR, TALIA], knownMemberIds: [NAMAR, TALIA] });
  stepOn(state, streamWith((roll) => roll < 1, (roll) => roll < 1, (roll) => roll >= 99));
  assert.deepEqual(faction.memberIds, [NAMAR, DARA, KELAN, TALIA]);
  validateFactions(state);
});

test('a non-member under the threshold costs no draw', () => {
  const state = ready();
  withFaction(state, { memberIds: [NAMAR, DARA], knownMemberIds: [NAMAR, DARA] });
  lukewarm(state, KELAN, TALIA);
  stepOn(state, HIT);
  assert.equal(state.plotRngState, HIT);
});

test('people of an exiled house or in prison do not join', () => {
  const state = ready();
  withFaction(state, { memberIds: [NAMAR, DARA], knownMemberIds: [NAMAR, DARA] });
  jail(state, KELAN);
  jail(state, TALIA, 2);
  stepOn(state, HIT);
  assert.equal(state.plotRngState, HIT);
});

test('the join chance is 50 by difficulty', () => {
  for (const [difficulty, chance] of [['easy', 25], ['normal', 50], ['hard', 75]]) {
    const joins = (roll) => {
      const state = ready();
      state.difficulty = difficulty;
      const faction = withFaction(state, { memberIds: FOUR.slice(0, 3), knownMemberIds: FOUR.slice(0, 3) });
      stepOn(state, roll);
      return faction.memberIds.includes(TALIA);
    };
    assert.equal(joins(within(chance - 1, chance)), true, difficulty);
    assert.equal(joins(within(chance, chance + 1)), false, difficulty);
  }
  assert.equal(JOIN_CHANCE, 50);
});

test('a faction under two members closes as dissolved and draws no discovery', () => {
  const state = ready();
  const faction = withFaction(state, { memberIds: [NAMAR, DARA] });
  lukewarm(state, KELAN, TALIA);
  calm(state, DARA);
  stepOn(state, HIT);
  assert.deepEqual([faction.status, faction.outcome, faction.closedAt], ['closed', 'dissolved', state.date]);
  assert.equal(state.plotRngState, HIT);
  validateFactions(state);
});

test('a joiner keeps a faction alive that a leaver would have ended', () => {
  const state = ready();
  const faction = withFaction(state, { memberIds: [NAMAR, DARA], knownMemberIds: [NAMAR] });
  calm(state, DARA);
  lukewarm(state, TALIA);
  stepOn(state, streamWith((roll) => roll < 1, (roll) => roll >= 99));
  assert.deepEqual(faction.memberIds, [NAMAR, KELAN]);
  assert.equal(faction.status, 'active');
});

const NPC_AND_MINOR = {
  'an NPC ruler': () => ready({ mode: 'family', familyId: NAMARS }),
  'a minor': () => {
    const state = base();
    Object.assign(state.offices.ruler, { holderId: MIRA, regentId: AREL });
    state.reign.rulerId = MIRA;
    state.realm.lawfulRulerId = MIRA;
    state.regencies['office:ruler'] = { id: 'office:ruler', principalId: MIRA, regentId: AREL, phase: 'minority', startedAt: state.date, grants: [], requestAfter: {}, handoverDueAt: null };
    state.stories = [];
    delete state.mandateVersion; delete state.mandateActivatedAt; delete state.mandateSequence;
    const loaded = plain(normalizeCharacterSystem(state));
    loaded.reign.startedAt = addGameMonths(loaded.date, -GRACE_MONTHS);
    assert.equal(actionHooks(loaded).canRule(), true);
    return loaded;
  },
};
test('factions stop under an NPC ruler and under a minor', () => {
  for (const [name, fresh] of Object.entries(NPC_AND_MINOR)) {
    const empty = fresh();
    stepOn(empty, HIT);
    assert.deepEqual(empty.factions, [], name);
    assert.equal(empty.plotRngState, HIT, name);

    const live = fresh();
    withFaction(live, { memberIds: [NAMAR, DARA] });
    live.plotRngState = HIT;
    calm(live, DARA);
    const before = plain(live);
    step(live);
    assert.deepEqual(plain(live), before, name);
  }
});

test('the claimant is the oldest free sibling, then the first free adult in line, then the leader', () => {
  const state = ready();
  const faction = withFaction(state), hooks = actionHooks(state);
  const claimant = (useHooks = hooks) => claimantFor(state, faction, useHooks)?.id ?? null;
  assert.equal(claimant(), SERA, 'Arel has no sibling, so the heir claims');
  jail(state, SERA, 1);
  assert.equal(claimant(), ISET, 'the next free adult in line');
  // Arel gets two siblings through a shared legal parent who has no child yet.
  for (const id of [AREL, YARA, BAREK]) state.people[id].legalParentIds = [CHILDLESS];
  assert.equal(claimant(), BAREK, 'the older sibling');
  state.people[YARA].bornAt = addGameMonths(state.people[BAREK].bornAt, -12);
  assert.equal(claimant(), YARA, 'age decides, ahead of the id');
  jail(state, YARA, 2);
  assert.equal(claimant(), BAREK, 'a sibling in prison gives way');
  state.people[BAREK].bornAt = addGameMonths(state.date, -120);
  assert.equal(claimant(), ISET, 'a minor sibling gives way');
  assert.equal(claimant({ ...hooks, rulerCandidates: () => [] }), NAMAR, 'nobody in line leaves the leader');
  state.people[NAMAR].diedAt = state.date;
  assert.equal(claimant({ ...hooks, rulerCandidates: () => [] }), null, 'nobody at all');
});

test('the first free adult in line skips a minor', () => {
  const state = ready();
  const faction = withFaction(state), hooks = actionHooks(state);
  assert.equal(claimantFor(state, faction, { ...hooks, rulerCandidates: () => [state.people[MIRA], state.people[TAREK]] }).id, TAREK);
});

test('the chain passes over a person whose house is in exile', () => {
  const state = ready();
  const faction = withFaction(state), hooks = actionHooks(state);
  for (const id of [AREL, BAREK, TALIA]) state.people[id].legalParentIds = [CHILDLESS];
  assert.equal(claimantFor(state, faction, hooks).id, BAREK, 'the older sibling');
  state.families[ESHMUNS].exiled = true;
  assert.equal(claimantFor(state, faction, hooks).id, TALIA, 'the older sibling is in exile');
  state.families[NAMARS].exiled = true;
  assert.equal(claimantFor(state, faction, hooks).id, SERA, 'no sibling is left, so the line decides');
  assert.equal(claimantFor(state, faction, { ...hooks, rulerCandidates: () => [state.people[BAREK], state.people[TAREK]] }).id, TAREK, 'the first in line is in exile');
  assert.equal(claimantFor(state, faction, { ...hooks, rulerCandidates: () => [] }), null, 'the leader is in exile too');
});

test('factionStrength adds members, families, legitimacy, influence and age and subtracts dread', () => {
  const strength = (prepare, fields) => {
    const state = ready();
    state.realm.legitimacy = 60;
    prepare(state);
    return factionStrength(state, record(state, fields), actionHooks(state));
  };
  const none = () => {};
  assert.equal(strength(none), 24, '8 × 3 members');
  assert.equal(strength(none, { memberIds: [NAMAR, DARA, BAREK] }), 24 + 10, 'a second family');
  assert.equal(strength(none, { memberIds: [NAMAR, DARA, BAREK, SAFRA] }), 32 + 20, 'a third family');
  assert.equal(strength((state) => { state.realm.legitimacy = 40; }), 24 + 10);
  assert.equal(strength((state) => { state.families[NAMARS].influence = 65; }), 24 + 10);
  assert.equal(strength((state) => { state.families[NAMARS].influence = 25; }), 24 - 10);
  assert.equal(strength((state) => { for (const person of Object.values(state.people)) person.fear = 20; }), 24 - 6, 'dread 20');
  assert.equal(strength((state) => { state.families[ESHMUNS].influence = 65; }, { memberIds: [NAMAR, DARA, BAREK] }), 34 + 10, 'the top influence of the member families');
  assert.equal(strength((state) => { state.families[SAFRAS].influence = 65; }), 24, 'a family with no member counts nothing');
});

test('factionStrength matures by full years since forming and stays within 5 to 95', () => {
  const at = (months, prepare = () => {}) => {
    const state = ready();
    state.realm.legitimacy = 60;
    prepare(state);
    return factionStrength(state, record(state, { formedAt: addGameMonths(state.date, -months) }), actionHooks(state));
  };
  assert.equal(at(11), 24);
  assert.equal(at(12), 24 + MATURITY_PER_YEAR);
  assert.equal(at(23), 24 + MATURITY_PER_YEAR);
  assert.equal(at(24), 24 + 2 * MATURITY_PER_YEAR);
  assert.equal(at(0, (state) => { for (const person of Object.values(state.people)) person.fear = 100; }), 5);
  assert.equal(at(240), 95);
});

test('a member who dies or goes to prison is removed on the same date', () => {
  const start = ready();
  const faction = withFaction(start, { memberIds: FOUR, knownMemberIds: [DARA, KELAN] });
  // killPeople ends with refreshStories, so the death needs no year turn.
  actionHooks(start).kill([DARA], [], 'Ett prov');
  assert.deepEqual(faction.memberIds, [NAMAR, KELAN, TALIA]);
  assert.deepEqual(faction.knownMemberIds, [KELAN]);

  const date = start.date;
  start.actionRngState = certainAction();
  const jailed = ok(command(start, 'attempt_action', { actionId: 'imprison', actorId: AREL, targetIds: [KELAN], means: {} }));
  assert.equal(jailed.date, date);
  assert.ok(jailed.prisoners.some((prisoner) => prisoner.personId === KELAN && prisoner.status === 'held'));
  assert.deepEqual(jailed.factions[0].memberIds, [NAMAR, TALIA]);
  assert.deepEqual(jailed.factions[0].knownMemberIds, []);
});

test('a dead or imprisoned leader gives way to the most discontented member', () => {
  const dead = ready();
  const first = withFaction(dead, { memberIds: FOUR });
  opinionOf(dead, TALIA, -10);
  actionHooks(dead).kill([NAMAR], [], 'Ett prov');
  assert.equal(first.leaderId, TALIA);

  const held = ready();
  const second = withFaction(held, { memberIds: FOUR });
  jail(held, NAMAR);
  refreshCourtStories(held, [], actionHooks(held));
  assert.equal(second.leaderId, DARA, 'a tie goes to the lowest id');
  assert.deepEqual(second.memberIds, [DARA, KELAN, TALIA]);
});

test('a dead or imprisoned claimant is replaced through the chain', () => {
  const dead = ready();
  const first = withFaction(dead, { memberIds: FOUR });
  actionHooks(dead).kill([SERA], [], 'Ett prov');
  assert.equal(first.claimantId, ISET);

  const held = ready();
  const second = withFaction(held, { memberIds: FOUR });
  jail(held, SERA);
  refreshFactions(held, [], actionHooks(held));
  assert.equal(second.claimantId, ISET);
});

// banish ends in refreshStories, so the faction answers on the date of the command.
const banishNamars = (state) => ok(command(state, 'banish', { familyId: NAMARS }));

test('a banished house leaves both member lists on the date of the command', () => {
  const state = ready();
  withFaction(state, { memberIds: [NAMAR, DARA, BAREK, SAFRA], knownMemberIds: [DARA, BAREK], leaderId: BAREK });
  const after = banishNamars(state), [faction] = after.factions;
  assert.equal(after.families[NAMARS].exiled, true);
  assert.equal(after.date, state.date);
  assert.deepEqual(faction.memberIds, [BAREK, SAFRA]);
  assert.deepEqual(faction.knownMemberIds, [BAREK]);
  assert.equal(faction.status, 'active');
  assert.equal(after.plotRngState, state.plotRngState);
  validateFactions(after);
});

test('a banished leader gives way to the most discontented member who stayed', () => {
  const state = ready();
  withFaction(state, { memberIds: [NAMAR, BAREK, SAFRA] });
  opinionOf(state, SAFRA, -30);
  const after = banishNamars(state);
  assert.equal(after.factions[0].leaderId, SAFRA);
  assert.deepEqual(after.factions[0].memberIds, [BAREK, SAFRA]);
  validateFactions(after);
});

test('a banished claimant is replaced through the chain', () => {
  const state = ready();
  withFaction(state, { memberIds: [BAREK, SAFRA], leaderId: BAREK, claimantId: KELAN });
  const after = banishNamars(state);
  assert.equal(after.factions[0].claimantId, SERA);
  assert.equal(after.factions[0].status, 'active');
  validateFactions(after);
});

test('a banished house that leaves too few members dissolves the faction', () => {
  const one = ready();
  withFaction(one, { memberIds: [NAMAR, DARA, BAREK], knownMemberIds: [DARA, BAREK] });
  const left = banishNamars(one), [faction] = left.factions;
  assert.deepEqual([faction.status, faction.outcome, faction.closedAt], ['closed', 'dissolved', one.date]);
  assert.deepEqual(faction.memberIds, [BAREK]);
  assert.deepEqual(faction.knownMemberIds, [BAREK]);
  assert.deepEqual(presentFactions(left, actionHooks(left)), []);
  validateFactions(left);

  const whole = ready();
  withFaction(whole, everyoneKnown);
  const gone = banishNamars(whole).factions[0];
  assert.deepEqual([gone.status, gone.outcome, gone.memberIds, gone.knownMemberIds], ['closed', 'dissolved', [], []]);
});

test('a refresh dissolves a faction under two members or with no claimant, and draws nothing', () => {
  const few = ready();
  const faction = withFaction(few, { memberIds: [NAMAR, DARA] });
  few.plotRngState = HIT;
  const before = plain(few.log), events = [];
  actionHooks(few).kill([DARA], events, 'Ett prov');
  assert.deepEqual([faction.status, faction.outcome, faction.closedAt], ['closed', 'dissolved', few.date]);
  assert.deepEqual(faction.memberIds, [NAMAR]);
  assert.equal(few.plotRngState, HIT);
  assert.ok(few.log.length > before.length);
  validateFactions(few);

  const orphan = ready();
  const hopeless = withFaction(orphan, { memberIds: FOUR });
  orphan.people[SERA].diedAt = orphan.date;
  refreshFactions(orphan, [], { ...actionHooks(orphan), adult: () => false });
  assert.deepEqual([hopeless.status, hopeless.outcome, hopeless.claimantId], ['closed', 'dissolved', null]);
  validateFactions(orphan);
});

test('a refresh leaves a closed faction and the year\'s calm members alone', () => {
  const state = ready();
  const faction = withFaction(state, { status: 'closed', outcome: 'dissolved', closedAt: state.date });
  const live = record(state, { memberIds: [KELAN, TALIA], leaderId: KELAN });
  state.factions.push(live);
  calm(state, TALIA);
  state.people[DARA].diedAt = state.date;
  const before = plain(state.factions);
  refreshFactions(state, [], actionHooks(state));
  assert.deepEqual(plain(state.factions), before, `${faction.id} keeps its dead, and leaving is the year step's`);
});

test('any accession voids the faction', () => {
  const state = ready();
  const faction = withFaction(state, { memberIds: FOUR, knownMemberIds: [NAMAR] });
  actionHooks(state).kill([AREL], [], 'Ett prov');
  assert.notEqual(state.offices.ruler.holderId, AREL);
  assert.deepEqual([faction.status, faction.outcome, faction.closedAt], ['closed', 'void', state.date]);
  assert.deepEqual(presentFactions(state, actionHooks(state)), []);
  validateFactions(state);
});

test('a dissolved realm voids the faction', () => {
  const state = ready();
  const faction = withFaction(state);
  const after = ok(applyRealmDissolution(state, { id: 'host-end', date: state.date, reason: 'Ett prov', hostCandidates: [] }));
  assert.equal(after.factions.at(-1).id, faction.id);
  assert.deepEqual([after.factions.at(-1).status, after.factions.at(-1).outcome], ['closed', 'void']);
});

test('voidFactions leaves an ended faction as it ended', () => {
  const state = ready();
  const ended = addGameMonths(state.date, -12);
  const faction = withFaction(state, { status: 'closed', outcome: 'dissolved', closedAt: ended, formedAt: addGameMonths(state.date, -24) });
  voidFactions(state);
  assert.deepEqual([faction.outcome, faction.closedAt], ['dissolved', ended]);
});

test('the court year runs the faction step after the demands', () => {
  const state = ready();
  for (const id of [ESHMUNS, SAFRAS]) state.families[id].exiled = true;
  // Namar's house demands at 40 and forms at about 65. The first roll is a miss for the demand and a hit for the faction, the second a miss for both.
  const stream = streamWith((roll) => roll >= 50 && roll < 60, (roll) => roll >= 99);
  state.plotRngState = stream;
  courtAnnualStep(state, [], actionHooks(state));
  assert.deepEqual(state.familyDemands, []);
  assert.deepEqual(state.factions, []);
  assert.equal(state.plotRngState, afterDraws(stream, 2));
});

test('a faction goes through the year turn, a save and a load', () => {
  let state = createCharacterSystem({ seed: 321 });
  for (let year = 1; year <= 6 && !state.factions.length; year++) state = ok(advanceCharacters(state, addGameMonths(state.date, 12), { id: `year-${year}` }));
  assert.equal(state.factions.length, 1, 'seed 321 grows a faction within six years');
  const loaded = normalizeCharacterSystem(plain(state));
  assert.deepEqual(loaded.factions, state.factions);
  validateCourt(loaded);
});

test('a whole advance and a month-by-month advance reach the same factions', () => {
  const start = createCharacterSystem({ seed: 321 }), months = 72;
  const whole = ok(advanceCharacters(start, addGameMonths(start.date, months), { id: 'whole' }));
  let split = start;
  for (let month = 1; month <= months; month++) split = ok(advanceCharacters(split, addGameMonths(start.date, month), { id: `month-${month}` }));
  assert.ok(whole.factions.length > 0);
  assert.deepEqual(split.factions, whole.factions);
  assert.equal(split.plotRngState, whole.plotRngState);
});
