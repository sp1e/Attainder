import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { actionHooks, createCharacterSystem, getCharacterPresentation, normalizeCharacterSystem } from './index.js';
import { bandFor } from './actionOdds.js';
import { stressPressureStep } from './breakdowns.js';
import { validateCourt } from './court.js';
import { plotRandom } from './extensions.js';
import { GRACE_MONTHS, factionStep, factionStrength, presentFactions, validateFactions } from './factions.js';

// What the player sees of a faction and what a save may hold. factions.test.js holds the rules of the step and the refresh.

const AREL = 'person-0-0';
const SERA = 'person-0-2';
const NAMAR = 'person-1-0';
const DARA = 'person-1-1';
const KELAN = 'person-1-2';
const TALIA = 'person-1-3';
const FOUR = [NAMAR, DARA, KELAN, TALIA];
const STREAM_LIMIT = 50_000_000;
const FORGED = { name: 'Error', message: /^En faktion i sparfilen är ogiltig\.$/ };

const plain = (value) => JSON.parse(JSON.stringify(value));
const base = (options = {}) => plain(createCharacterSystem({ seed: 321, ...options }));

// A plot stream whose next draws, as percents, pass the checks in order, as in familyDemands.test.js.
function streamWith(...checks) {
  for (let seed = 1; seed < STREAM_LIMIT; seed++) {
    const probe = { plotRngState: seed };
    if (checks.every((check) => check(plotRandom(probe) * 100))) return seed;
  }
  throw new Error('No such stream.');
}
const HIT = streamWith((roll) => roll < 1);

// A reign old enough for a faction. The four adult Namars stand at about 25 from the first day, every other house below the threshold.
const ready = (options = {}, months = GRACE_MONTHS) => { const state = base(options); state.reign.startedAt = addGameMonths(state.date, -months); return state; };
const step = (state, events = []) => { factionStep(state, events, actionHooks(state)); return events; };
const stepOn = (state, stream) => { state.plotRngState = stream; return step(state); };
function record(state, fields = {}) {
  return { id: `faction-${++state.sequence}`, targetRulerId: state.reign.rulerId, leaderId: NAMAR, claimantId: SERA, memberIds: [NAMAR, DARA, KELAN], knownMemberIds: [], formedAt: state.date, status: 'active', outcome: null, quietUntil: null, ultimatumAt: null, dueAt: null, storyId: null, concessions: 0, closedAt: null, ...fields };
}
const withFaction = (state, fields) => { const faction = record(state, fields); state.factions.push(faction); return faction; };

test('an unknown faction is absent from the view', () => {
  const state = ready(), before = plain(getCharacterPresentation(state));
  withFaction(state, { memberIds: FOUR });
  const view = plain(getCharacterPresentation(state));
  assert.deepEqual(view.court.factions, []);
  assert.deepEqual(view, before);
  assert.deepEqual(presentFactions(state, actionHooks(state)), []);
});

test('a discovered member appears at the reader\'s precision and the rest stay hidden', () => {
  const state = ready();
  const faction = withFaction(state, { memberIds: FOUR });
  stepOn(state, HIT);
  assert.deepEqual(faction.knownMemberIds, [NAMAR]);
  const strength = factionStrength(state, faction, actionHooks(state));
  const view = plain(getCharacterPresentation(state)).court.factions;
  assert.deepEqual(view, [{ id: faction.id, stageLabel: 'I det fördolda', knownMembers: [{ id: NAMAR, name: 'Namar av Hadara' }], claimantName: null, strengthLabel: bandFor(strength, 'three'), memberCount: null, dueAt: null }]);
  const text = JSON.stringify(view);
  for (const id of [DARA, KELAN, TALIA, SERA]) assert.equal(text.includes(id), false, id);
  for (const name of [DARA, KELAN, TALIA, SERA].map((id) => state.people[id].name)) assert.equal(text.includes(name), false, name);
});

test('the reader\'s precision sets the strength label and the head count', () => {
  const read = (intrigue) => {
    const state = ready();
    const faction = withFaction(state, { memberIds: FOUR, knownMemberIds: [NAMAR] });
    state.offices.spymaster.holderId = SERA;
    state.people[SERA].skills.intrigue = intrigue;
    return { shown: presentFactions(state, actionHooks(state))[0], strength: factionStrength(state, faction, actionHooks(state)) };
  };
  const five = read(7), exact = read(12);
  assert.equal(five.shown.strengthLabel, bandFor(five.strength, 'five'));
  assert.equal(five.shown.memberCount, null);
  assert.equal(exact.shown.strengthLabel, `${exact.strength} %`);
  assert.equal(exact.shown.memberCount, 4);
});

test('the claimant stays unnamed until two members are known or the ultimatum is out', () => {
  const claimant = (fields) => { const state = ready(); withFaction(state, fields); return presentFactions(state, actionHooks(state))[0].claimantName; };
  assert.equal(claimant({ knownMemberIds: [NAMAR] }), null);
  assert.equal(claimant({ knownMemberIds: [NAMAR, DARA] }), 'Sera Arel');
  assert.equal(claimant({ status: 'ultimatum', ultimatumAt: base().date, dueAt: addGameMonths(base().date, 6) }), 'Sera Arel');
});

test('the stage labels follow the status, and a closed faction is not shown', () => {
  const shown = (fields) => { const state = ready(); withFaction(state, fields); return presentFactions(state, actionHooks(state)); };
  const date = base().date, due = addGameMonths(date, 6);
  assert.equal(shown({ knownMemberIds: [NAMAR] })[0].stageLabel, 'I det fördolda');
  const ultimatum = shown({ status: 'ultimatum', ultimatumAt: date, dueAt: due });
  assert.equal(ultimatum[0].stageLabel, 'Ultimatum');
  assert.equal(ultimatum[0].dueAt, due, 'an ultimatum shows with no member known');
  assert.deepEqual(ultimatum[0].knownMembers, []);
  assert.equal(shown({ status: 'appeased', ultimatumAt: date, quietUntil: addGameMonths(date, 36) })[0].stageLabel, 'Har backat tills vidare');
  assert.deepEqual(shown({ knownMemberIds: [NAMAR], status: 'closed', outcome: 'dissolved', closedAt: date }), []);
});

test('the court shows what presentFactions shows, and showing draws nothing', () => {
  const state = ready();
  withFaction(state, { knownMemberIds: [NAMAR] });
  const before = plain(state);
  assert.deepEqual(getCharacterPresentation(state).court.factions, presentFactions(state, actionHooks(state)));
  assert.deepEqual(plain(state), before);
});

test('the pressure counts the factions the player can see, and no others', () => {
  const pressure = (fields) => {
    const state = ready();
    state.people[AREL].stress = 10;
    withFaction(state, fields(state));
    stressPressureStep(state, actionHooks(state));
    return state.people[AREL].stress - 10;
  };
  assert.equal(pressure(() => ({})), 0, 'an unknown faction weighs nothing');
  assert.equal(pressure(() => ({ knownMemberIds: [NAMAR] })), 6);
  assert.equal(pressure((state) => ({ knownMemberIds: [NAMAR], status: 'closed', outcome: 'dissolved', closedAt: state.date })), 0);
});

const closedFields = (state) => ({ status: 'closed', outcome: 'dissolved', closedAt: state.date });
// A whole ultimatum, then the one field a forgery spoils, so the check that refuses it is the check on that field.
function standing(faction, state, fields) {
  const dueAt = addGameMonths(state.date, 6);
  state.stories.push({ id: 'story-ultimatum', type: 'faction_ultimatum', factionId: faction.id, status: 'open', dueAt });
  Object.assign(faction, { status: 'ultimatum', ultimatumAt: state.date, dueAt, storyId: 'story-ultimatum', knownMemberIds: [faction.leaderId], ...fields });
}
const LIVE_FORGERIES = {
  'an unknown field': (faction) => { faction.secret = 1; },
  'a missing field': (faction) => { delete faction.quietUntil; },
  'a bad id': (faction) => { faction.id = 'faction-x'; },
  'an id past the sequence': (faction, state) => { faction.id = `faction-${state.sequence + 1}`; },
  'a known member who is no member': (faction) => { faction.knownMemberIds = [TALIA]; },
  'an unsorted member list': (faction) => { faction.memberIds = [DARA, NAMAR, KELAN]; },
  'a repeated member': (faction) => { faction.memberIds = [NAMAR, DARA, DARA]; },
  'a member who does not exist': (faction) => { faction.memberIds = [NAMAR, 'person-9-9']; },
  'an inherited name as a member': (faction) => { faction.memberIds = [NAMAR, 'toString']; },
  'a member list that is no list': (faction) => { faction.memberIds = NAMAR; },
  'an unsorted known list': (faction) => { faction.knownMemberIds = [DARA, NAMAR]; },
  'a repeated known member': (faction) => { faction.knownMemberIds = [NAMAR, NAMAR]; },
  'a leader outside the faction': (faction) => { faction.leaderId = TALIA; },
  'a live faction with no claimant': (faction) => { faction.claimantId = null; },
  'a claimant who does not exist': (faction) => { faction.claimantId = 'person-9-9'; },
  'a live faction of one': (faction) => { faction.memberIds = [NAMAR]; },
  'a target who does not rule': (faction) => { faction.targetRulerId = SERA; },
  'an unknown status': (faction) => { faction.status = 'open'; },
  'an outcome on a live faction': (faction) => { faction.outcome = 'dissolved'; },
  'a closing date on a live faction': (faction, state) => { faction.closedAt = state.date; },
  'a formation in the future': (faction, state) => { faction.formedAt = addGameMonths(state.date, 1); },
  'a date that is no date': (faction) => { faction.formedAt = 'igår'; },
  'a negative concession count': (faction) => { faction.concessions = -1; },
  'a fractional concession count': (faction) => { faction.concessions = 0.5; },
  'a quiet date that is no date': (faction) => { faction.quietUntil = 'snart'; },
  'an ultimatum with no date': (faction, state) => { standing(faction, state, { ultimatumAt: null }); },
  'an ultimatum with no deadline': (faction, state) => { standing(faction, state, { dueAt: null }); },
  'an ultimatum after today': (faction, state) => { standing(faction, state, { ultimatumAt: addGameMonths(state.date, 1) }); },
  'an ultimatum with no story': (faction, state) => { standing(faction, state, { storyId: null }); },
  'a truce with no end': (faction) => { faction.status = 'appeased'; },
  'a story that does not exist': (faction) => { faction.storyId = 'story-999'; },
};
const CLOSED_FORGERIES = {
  'a closed faction with no outcome': (faction) => { faction.outcome = null; },
  'a closed faction with an unknown outcome': (faction) => { faction.outcome = 'won'; },
  'a closed faction with no date': (faction) => { faction.closedAt = null; },
  'a closing before the forming': (faction, state) => { faction.closedAt = addGameMonths(state.date, -1); },
  'a closing in the future': (faction, state) => { faction.closedAt = addGameMonths(state.date, 1); },
  'a closed faction with a leader who does not exist': (faction) => { faction.leaderId = 'person-9-9'; },
};
test('forged faction records are rejected', () => {
  const clean = ready();
  withFaction(clean);
  validateFactions(clean);
  for (const [name, forge] of Object.entries(LIVE_FORGERIES)) {
    const state = plain(clean);
    forge(state.factions[0], state);
    assert.throws(() => validateFactions(state), FORGED, name);
  }
  const ended = ready();
  withFaction(ended, closedFields(ended));
  validateFactions(ended);
  for (const [name, forge] of Object.entries(CLOSED_FORGERIES)) {
    const state = plain(ended);
    forge(state.factions[0], state);
    assert.throws(() => validateFactions(state), FORGED, name);
  }
});

test('forged lists are rejected, and loading goes through the check', () => {
  const twins = ready();
  withFaction(twins);
  withFaction(twins, { memberIds: [KELAN, TALIA], leaderId: KELAN });
  assert.throws(() => validateFactions(twins), FORGED, 'two live factions');

  const repeated = ready();
  withFaction(repeated, closedFields(repeated));
  repeated.factions.push(plain(repeated.factions[0]));
  assert.throws(() => validateFactions(repeated), FORGED, 'a repeated id');

  const loose = ready();
  loose.stories.push({ id: 'story-loose', type: 'faction_ultimatum', factionId: 'faction-99' });
  assert.throws(() => validateFactions(loose), FORGED, 'an ultimatum story of no faction');

  const notARecord = ready();
  notARecord.factions = [null];
  assert.throws(() => validateFactions(notARecord), FORGED, 'no record at all');

  const saved = ready();
  withFaction(saved, { knownMemberIds: [TALIA] });
  assert.throws(() => validateCourt(saved), FORGED);
  assert.throws(() => normalizeCharacterSystem(plain(saved)), FORGED);
});

test('the later statuses load as records of their own', () => {
  const held = ready();
  standing(withFaction(held), held);
  validateFactions(held);
  const stray = plain(held);
  stray.stories.at(-1).factionId = 'faction-0';
  assert.throws(() => validateFactions(stray), FORGED, 'a story of no faction');
  const wrongType = plain(held);
  wrongType.stories.at(-1).type = 'family_demand';
  assert.throws(() => validateFactions(wrongType), FORGED, 'a story of another type');

  const truce = ready();
  withFaction(truce, { status: 'appeased', ultimatumAt: truce.date, quietUntil: addGameMonths(truce.date, 36), concessions: 1 });
  validateFactions(truce);
});
