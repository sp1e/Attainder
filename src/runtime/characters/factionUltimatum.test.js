import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { actionHooks, advanceCharacters, applyRealmDissolution, createCharacterSystem, executeCharacterCommand, getCharacterPresentation, getPersonalOpinion, normalizeCharacterSystem } from './index.js';
import { bandFor } from './actionOdds.js';
import { breakdownStep } from './breakdowns.js';
import { serviceOf } from './council.js';
import { refreshCourtStories } from './court.js';
import { actionRandom, plotRandom } from './extensions.js';
import { demandStep } from './familyDemands.js';
import { GRACE_MONTHS, claimantFor, crushOdds, factionStep, factionStrength, presentFactions, refreshFactions, resolveUltimatum, ultimatumChoices, validateFactions } from './factions.js';
import { isImprisoned } from './prisoners.js';
import { createSecret, exposeSecret } from './secrets.js';

// The end of a faction: the ultimatum and the four ways it closes. factions.test.js holds how a faction forms and grows, factionsPresent.test.js what the player sees of one.

const AREL = 'person-0-0';
const ISET = 'person-0-1';
const SERA = 'person-0-2';
const NAMAR = 'person-1-0';
const DARA = 'person-1-1';
const KELAN = 'person-1-2';
const TALIA = 'person-1-3';
const BAREK = 'person-2-2';
const YARA = 'person-2-3';
const CHILDLESS = 'person-3-5';
const ARELS = 'family-arel';
const NAMARS = 'family-namar';
const ESHMUNS = 'family-eshmun';
const FOUR = [NAMAR, DARA, KELAN, TALIA];
const STREAM_LIMIT = 50_000_000;
const START = createCharacterSystem({ seed: 321 }).date;
const FAMILY_MODE = { mode: 'family', familyId: ARELS };
const MODES = { realm: {}, family: FAMILY_MODE };
const FORGED = { name: 'Error', message: /^En faktion i sparfilen är ogiltig\.$/ };
const FORCED_TITLE = 'Adeln tvingar härskaren från tronen';
const NO_FUNDS = 'Otillräcklig statskassa.';

const plain = (value) => JSON.parse(JSON.stringify(value));
const base = (options = {}) => plain(createCharacterSystem({ seed: 321, ...options }));
const ok = (result) => { assert.equal(result.ok, true, result.error); return result.state; };
const advance = (state, date) => ok(advanceCharacters(state, date));
const storyOf = (state, id) => state.stories.find((story) => story.id === id);
const ultimatumOf = (state) => state.stories.find((story) => story.type === 'faction_ultimatum' && story.status === 'open');
const content = ({ revision: _revision, appliedCommandIds: _applied, ...rest }) => rest;
const loads = (state) => { validateFactions(state); normalizeCharacterSystem(plain(state)); };
let commands = 0;
const command = (state, type, payload) => executeCharacterCommand(state, { id: `ultimatum-test-${++commands}`, expectedRevision: state.revision, type, payload });
const answer = (state, story, choiceId) => command(state, 'resolve_story', { storyId: story.id, choiceId });

// A plot stream whose next draws, as percents, pass the checks in order, as in familyDemands.test.js.
function plotStream(...checks) {
  for (let seed = 1; seed < STREAM_LIMIT; seed++) {
    const probe = { plotRngState: seed };
    if (checks.every((check) => check(plotRandom(probe) * 100))) return seed;
  }
  throw new Error('No such stream.');
}
const HIT = plotStream((roll) => roll < 1);
const MISS = plotStream((roll) => roll >= 99);
function actionStream(check) {
  for (let seed = 1; seed < STREAM_LIMIT; seed++) if (check(actionRandom({ actionRngState: seed }) * 100)) return seed;
  throw new Error('No such stream.');
}
const CERTAIN = actionStream((roll) => roll < 1);
const HOPELESS = actionStream((roll) => roll >= 99);

const ready = (options = {}, months = GRACE_MONTHS) => { const state = base(options); state.reign.startedAt = addGameMonths(state.date, -months); return state; };
const step = (state, events = []) => { factionStep(state, events, actionHooks(state)); return events; };
const stepOn = (state, stream) => { state.plotRngState = stream; return step(state); };
const jail = (state, personId, n = 1) => { state.prisoners.push({ id: `prisoner-${n}`, personId, captorFamilyId: ARELS, since: state.date, ransom: 40, status: 'held', closedAt: null, reason: null }); };
function record(state, fields = {}) {
  return { id: `faction-${++state.sequence}`, targetRulerId: state.reign.rulerId, leaderId: NAMAR, claimantId: SERA, memberIds: [NAMAR, DARA, KELAN], knownMemberIds: [], formedAt: state.date, status: 'active', outcome: null, quietUntil: null, ultimatumAt: null, dueAt: null, storyId: null, concessions: 0, closedAt: null, ...fields };
}
const withFaction = (state, fields) => { const faction = record(state, fields); state.factions.push(faction); return faction; };

// Six years into a reign, a faction of four years: the four Namars stand at strength 54 and every other house stays below the threshold.
function strong(options = {}, fields = {}) {
  const state = ready(options, 72);
  return { state, faction: withFaction(state, { memberIds: FOUR, formedAt: addGameMonths(state.date, -48), ...fields }) };
}
function opened(options, fields) {
  const { state, faction } = strong(options, fields);
  stepOn(state, MISS);
  const story = ultimatumOf(state);
  assert.ok(story, 'the ultimatum opened');
  return { state, faction, story };
}
// Legitimacy moves strength by a half, so two points of it make one of strength.
function atStrength(state, faction, value) {
  const hooks = actionHooks(state);
  state.realm.legitimacy += 2 * (factionStrength(state, faction, hooks) - value);
  assert.equal(factionStrength(state, faction, hooks), value);
}

// Every input at the value whose row falls out: readiness 55, service 50, legitimacy 50, strength 50 and dread 0.
function evenOdds() {
  const { state, faction } = strong();
  const hooks = { ...actionHooks(state), militaryReadiness: () => 55, dreadOf: () => 0 };
  state.realm.legitimacy = 50;
  state.families[NAMARS].influence += 2 * (50 - factionStrength(state, faction, hooks));
  assert.equal(factionStrength(state, faction, hooks), 50);
  state.people[KELAN].traits = [];
  serveAt({ state, hooks }, 50);
  return { state, faction, hooks };
}
function serveAt({ state, hooks }, service) {
  const general = state.people[KELAN];
  general.loyalty += service - serviceOf(state, 'general', hooks);
  assert.equal(serviceOf(state, 'general', hooks), service);
}
const rowsOf = (odds) => Object.fromEntries(odds.rows.map(({ label, value }) => [label, value]));
const sum = (rows) => rows.reduce((total, row) => total + row.value, 0);
const setStrength = ({ state, faction, hooks }, value) => { state.families[NAMARS].influence += 2 * (value - factionStrength(state, faction, hooks)); assert.equal(factionStrength(state, faction, hooks), value); };
const ROW_CASES = [
  ['Härens beredskap', (f) => { f.hooks.militaryReadiness = () => 75; }, 10],
  ['Härens beredskap', (f) => { f.hooks.militaryReadiness = () => 35; }, -10],
  ['Härens beredskap', (f) => { f.hooks.militaryReadiness = () => 56; }, 1],
  ['Härens beredskap', (f) => { f.hooks.militaryReadiness = () => 54; }, undefined],
  ['Överbefälhavarens tjänst', (f) => serveAt(f, 70), 8],
  ['Överbefälhavarens tjänst', (f) => serveAt(f, 69), undefined],
  ['Överbefälhavarens tjänst', (f) => serveAt(f, 50), undefined],
  ['Överbefälhavarens tjänst', (f) => serveAt(f, 49), -8],
  ['Överbefälhavarens tjänst', (f) => serveAt(f, 30), -8],
  ['Överbefälhavarens tjänst', (f) => serveAt(f, 29), -15],
  ['Överbefälhavarens tjänst', (f) => { f.state.offices.general.holderId = null; }, -15],
  ['Rikets legitimitet', (f) => { f.state.realm.legitimacy = 80; }, 10],
  ['Rikets legitimitet', (f) => { f.state.realm.legitimacy = 20; }, -10],
  ['Rikets legitimitet', (f) => { f.state.realm.legitimacy = 51; }, undefined],
  ['Faktionens styrka', (f) => setStrength(f, 70), -10],
  ['Faktionens styrka', (f) => setStrength(f, 40), 5],
  ['Faktionens styrka', (f) => setStrength(f, 49), undefined],
  ['Rädsla för härskaren', (f) => { f.hooks.dreadOf = () => 25; }, 5],
  ['Rädsla för härskaren', (f) => { f.hooks.dreadOf = () => 24; }, 4],
  ['Rädsla för härskaren', (f) => { f.hooks.dreadOf = () => 4; }, undefined],
  ['Rädsla för härskaren', (f) => { f.hooks.dreadOf = () => 90; }, 10],
];
const SWEDISH_LABEL = /^[A-ZÅÄÖ][a-zåäö ]+$/;

test('an ultimatum opens at strength 50 and names the leader and the claimant', () => {
  const { state, faction } = strong();
  atStrength(state, faction, 50);
  const events = stepOn(state, MISS), story = ultimatumOf(state), dueAt = addGameMonths(state.date, 6);
  assert.deepEqual({ status: faction.status, ultimatumAt: faction.ultimatumAt, dueAt: faction.dueAt, storyId: faction.storyId }, { status: 'ultimatum', ultimatumAt: state.date, dueAt, storyId: story.id });
  assert.deepEqual(faction.knownMemberIds, [NAMAR], 'the leader comes out and the rest stay hidden');
  assert.equal(story.title, 'Faktionen kräver abdikation');
  assert.deepEqual({ actorId: story.actorId, knownBy: story.knownBy, dueAt: story.dueAt, factionId: story.factionId, createdAt: story.createdAt }, { actorId: NAMAR, knownBy: 'public', dueAt, factionId: faction.id, createdAt: state.date });
  assert.equal(story.deadlineText, 'Utan svar tvingar adeln härskaren från tronen när tiden går ut.');
  for (const id of [NAMAR, AREL, SERA]) assert.ok(story.description.includes(state.people[id].name), id);
  assert.ok(events.some((event) => event.title === 'Adeln ställer ett ultimatum'));
  loads(state);
});

test('an ultimatum does not open below strength 50', () => {
  const { state, faction } = strong();
  atStrength(state, faction, 49);
  stepOn(state, MISS);
  assert.equal(faction.status, 'active');
  assert.equal(ultimatumOf(state), undefined);
});

test('a leader who claims the throne is named once', () => {
  const { state, story } = opened({}, { claimantId: NAMAR });
  assert.ok(story.description.includes('sig själv'));
  assert.equal(story.description.split(state.people[NAMAR].name).length, 2);
});

test('an ultimatum names a claimant of exposed royal birth as the ruler\'s illegitimate child', () => {
  const { state, story } = opened({}, { claimantId: BAREK });
  assert.ok(!story.description.includes('oäkta'));
  exposeSecret(state, createSecret(state, { type: 'illegitimate_child', subjectId: BAREK, holderIds: [YARA, AREL], evidence: 'weak' }).id);
  stepOn(state, MISS);
  assert.ok(storyOf(state, story.id).description.includes(`kräver tronen åt ${state.people[BAREK].name}, oäkta barn till ${state.people[AREL].name}.`));
});

test('an ultimatum waits while a coup is open and while the faction is appeased', () => {
  const coup = strong();
  coup.state.stories.push({ id: 'story-coup', type: 'coup', status: 'open' });
  stepOn(coup.state, MISS);
  assert.equal(coup.faction.status, 'active');
  assert.equal(ultimatumOf(coup.state), undefined);
  coup.state.stories.at(-1).status = 'resolved';
  stepOn(coup.state, MISS);
  assert.equal(coup.faction.status, 'ultimatum');

  const { state, faction } = strong({}, { status: 'appeased', ultimatumAt: addGameMonths(START, -12), quietUntil: addGameMonths(START, 1), concessions: 1 });
  stepOn(state, MISS);
  assert.equal(faction.status, 'appeased');
  assert.equal(ultimatumOf(state), undefined);
  state.date = faction.quietUntil;
  stepOn(state, MISS);
  assert.equal(faction.status, 'ultimatum');
  assert.ok(ultimatumOf(state));
});

test('an appeased faction returns to the dark once the quiet ends, and it stays on the board', () => {
  const { state, faction } = strong({}, { status: 'appeased', ultimatumAt: addGameMonths(START, -12), quietUntil: START, concessions: 1 });
  atStrength(state, faction, 40);
  stepOn(state, MISS);
  assert.deepEqual({ status: faction.status, ultimatumAt: faction.ultimatumAt }, { status: 'active', ultimatumAt: addGameMonths(state.date, -12) });
  loads(state);
  const [shown] = presentFactions(state, actionHooks(state));
  assert.equal(shown.stageLabel, 'I det fördolda');
  assert.equal(shown.claimantName, state.people[SERA].name);
  assert.equal(shown.dueAt, null);
});

test('crush odds move with each row, stay integers from 5 to 95, and each row has a Swedish label', () => {
  const even = evenOdds();
  assert.deepEqual(crushOdds(even.state, even.faction, even.hooks).rows, [{ label: 'Grundchans', value: 50 }]);
  assert.equal(crushOdds(even.state, even.faction, even.hooks).value, 50);
  for (const [label, arrange, expected] of ROW_CASES) {
    const fixture = evenOdds();
    arrange(fixture);
    const odds = crushOdds(fixture.state, fixture.faction, fixture.hooks);
    assert.equal(rowsOf(odds)[label], expected, `${label} ${expected}`);
    assert.equal(sum(odds.rows), odds.value, label);
    assert.ok(odds.rows.every((row) => SWEDISH_LABEL.test(row.label) && Number.isInteger(row.value) && row.value !== 0), label);
    assert.ok(Number.isInteger(odds.value) && odds.value >= 5 && odds.value <= 95, label);
  }
});

test('crush odds stop at 5 and 95, and the cut is a row of its own', () => {
  const high = evenOdds();
  high.hooks.militaryReadiness = () => 200;
  high.hooks.dreadOf = () => 90;
  const top = crushOdds(high.state, high.faction, high.hooks);
  assert.equal(top.value, 95);
  assert.ok(rowsOf(top)['Högsta möjliga chans'] < 0);
  assert.equal(sum(top.rows), 95);

  const low = evenOdds();
  low.hooks.militaryReadiness = () => 0;
  low.state.offices.general.holderId = null;
  low.state.realm.legitimacy = 0;
  const bottom = crushOdds(low.state, low.faction, low.hooks);
  assert.equal(bottom.value, 5);
  assert.ok(rowsOf(bottom)['Lägsta möjliga chans'] > 0);
  assert.equal(sum(bottom.rows), 5);
});

function spiedOdds({ spymaster, command: skill }) {
  const fixture = evenOdds(), { state } = fixture;
  fixture.hooks.militaryReadiness = () => 75;
  serveAt(fixture, 70);
  state.people[KELAN].skills.command = skill;
  state.offices.spymaster.holderId = TALIA;
  Object.assign(state.people[TALIA], { traits: [], loyalty: 100 });
  state.people[TALIA].skills.intrigue = spymaster;
  return { fixture, odds: crushOdds(state, fixture.faction, fixture.hooks) };
}

test('crush odds never show more than the loyalty precision', () => {
  const clear = spiedOdds({ spymaster: 12, command: 12 }).odds;
  assert.equal(clear.precision, 'exact');
  assert.deepEqual(clear.display, { chance: clear.value, modifiers: clear.rows });

  const blind = spiedOdds({ spymaster: 3, command: 15 }).odds;
  assert.equal(blind.precision, 'three');
  assert.equal(blind.display.chance, bandFor(blind.value, 'three'));
  assert.ok(blind.display.modifiers.every((row) => !('value' in row) && ['+', '−'].includes(row.sign)));
  assert.ok(!blind.display.modifiers.some((row) => row.label === 'Överbefälhavarens tjänst'), 'the row reads loyalty');

  assert.equal(spiedOdds({ spymaster: 12, command: 3 }).odds.precision, 'three');
  assert.equal(spiedOdds({ spymaster: 12, command: 8 }).odds.precision, 'five');
  const { fixture } = spiedOdds({ spymaster: 12, command: 12 });
  fixture.state.offices.general.holderId = null;
  assert.equal(crushOdds(fixture.state, fixture.faction, fixture.hooks).precision, 'three');
});

test('the top cut does not show in a band', () => {
  const { fixture } = spiedOdds({ spymaster: 3, command: 15 });
  fixture.hooks.militaryReadiness = () => 200;
  const odds = crushOdds(fixture.state, fixture.faction, fixture.hooks);
  assert.ok(rowsOf(odds)['Högsta möjliga chans'] < 0);
  assert.ok(!odds.display.modifiers.some((row) => row.label === 'Högsta möjliga chans'));
});

test('reading the choices draws nothing', () => {
  const { state, faction, story } = opened();
  const before = plain(state), hooks = actionHooks(state);
  const choices = ultimatumChoices(state, story, hooks);
  crushOdds(state, faction, hooks);
  const shown = getCharacterPresentation(state).stories.find((item) => item.id === story.id);
  assert.deepEqual(plain(state), before);
  assert.deepEqual(shown.choices.map((choice) => choice.id), ['abdicate', 'concede', 'crush']);
  const [abdicate, concede, crush] = choices, odds = crushOdds(state, faction, hooks);
  assert.deepEqual({ label: abdicate.label, tag: abdicate.tag, cost: abdicate.cost }, { label: `Abdikera till förmån för ${state.people[SERA].name}`, tag: 'surrender', cost: '1 handling' });
  assert.deepEqual({ label: concede.label, cost: concede.cost }, { label: 'Ge efter för adeln', cost: '60 silver ur statskassan och 1 handling' });
  assert.deepEqual({ label: crush.label, tag: crush.tag, description: crush.description, odds: crush.odds }, { label: 'Slå ned faktionen', tag: 'risky', description: `Chans att lyckas: ${bandFor(odds.value, odds.precision)}`, odds: odds.display });
  assert.ok(choices.every((choice) => choice.disabledReason === ''));
  assert.deepEqual(shown.choices.find((choice) => choice.id === 'crush').odds, odds.display);
});

test('an answer needs the mandate and an order, and the concession needs the silver', () => {
  const { state, story } = opened();
  state.realm.treasury = 59;
  const concede = (choices) => choices.find((choice) => choice.id === 'concede');
  assert.equal(concede(ultimatumChoices(state, story, actionHooks(state))).disabledReason, NO_FUNDS);
  state.realm.treasury = 60;
  assert.equal(concede(ultimatumChoices(state, story, actionHooks(state))).disabledReason, '');
  state.actionPoints = 0;
  assert.ok(ultimatumChoices(state, story, actionHooks(state)).every((choice) => choice.disabledReason === 'Årets handlingsutrymme är slut. För tiden framåt.'));
  assert.equal(answer(state, story, 'crush').ok, false);
  state.actionPoints = 1;
  assert.equal(answer(state, story, 'forced').ok, false, 'the expiry is no choice');
  const hooks = { ...actionHooks(state), canRule: () => false };
  assert.ok(ultimatumChoices(state, story, hooks).every((choice) => choice.disabledReason === 'Kräver härskarmandat.'));
});

test('abdicate crowns the claimant lawfully', () => {
  const { state, story, faction } = opened();
  Object.assign(state.realm, { legitimacy: 60, prestige: 40 });
  const orders = state.actionPoints, after = ok(answer(state, story, 'abdicate')), record = after.factions[0];
  assert.equal(after.offices.ruler.holderId, SERA);
  assert.deepEqual({ legitimacy: after.realm.legitimacy, prestige: after.realm.prestige, lawful: after.reign.lawful }, { legitimacy: 50, prestige: 32, lawful: true });
  assert.equal(after.actionPoints, orders - 1);
  assert.deepEqual({ status: record.status, outcome: record.outcome, closedAt: record.closedAt }, { status: 'closed', outcome: 'abdicated', closedAt: state.date });
  assert.deepEqual({ status: storyOf(after, story.id).status, choiceId: storyOf(after, story.id).choiceId }, { status: 'resolved', choiceId: 'abdicate' });
  assert.deepEqual(after.prisoners, []);
  assert.equal(faction.status, 'ultimatum', 'the command works on a copy');
  loads(after);
});

test('abdicate leaves the new ruler no less than legitimacy 30', () => {
  const { state, story } = opened();
  state.realm.legitimacy = 35;
  assert.equal(ok(answer(state, story, 'abdicate')).realm.legitimacy, 30);
});

test('concede costs more each time', () => {
  const { state, story } = opened();
  Object.assign(state.realm, { legitimacy: 40, treasury: 500 });
  const after = ok(answer(state, story, 'concede')), [record] = after.factions;
  assert.deepEqual({ treasury: after.realm.treasury, legitimacy: after.realm.legitimacy }, { treasury: 440, legitimacy: 35 });
  assert.deepEqual({ status: record.status, concessions: record.concessions, quietUntil: record.quietUntil, dueAt: record.dueAt, members: record.memberIds }, { status: 'appeased', concessions: 1, quietUntil: addGameMonths(state.date, 36), dueAt: null, members: FOUR });
  assert.equal(storyOf(after, story.id).status, 'resolved');
  loads(after);

  record.quietUntil = after.date;
  stepOn(after, MISS);
  const again = ultimatumOf(after), [second] = ultimatumChoices(after, again, actionHooks(after)).filter((choice) => choice.id === 'concede');
  assert.notEqual(again.id, story.id);
  assert.equal(second.cost, '100 silver ur statskassan och 1 handling');
  after.actionPoints = 3;
  const third = ok(answer(after, again, 'concede'));
  assert.equal(third.realm.treasury, 340);
  assert.equal(third.factions[0].concessions, 2);
  loads(third);
});

test('a concession takes the deadline away', () => {
  const { state, story } = opened();
  const after = ok(answer(state, story, 'concede'));
  const later = advance(after, story.dueAt);
  assert.equal(later.offices.ruler.holderId, AREL);
  assert.equal(later.factions[0].status, 'appeased');
});

test('crush draws once from the action stream and leaves plotRngState and rngState alone', () => {
  const { state, story } = opened();
  Object.assign(state, { actionRngState: CERTAIN });
  state.realm.legitimacy = 40;
  const { plotRngState, rngState } = state, probe = { actionRngState: CERTAIN }, fear = state.people[BAREK].fear;
  actionRandom(probe);
  const others = [DARA, KELAN, TALIA], before = others.map((id) => getPersonalOpinion(state, id, AREL));
  const after = ok(answer(state, story, 'crush'));
  assert.deepEqual({ action: after.actionRngState, plot: after.plotRngState, rng: after.rngState }, { action: probe.actionRngState, plot: plotRngState, rng: rngState });
  assert.equal(after.offices.ruler.holderId, AREL);
  assert.ok(isImprisoned(after, NAMAR));
  assert.equal(after.prisoners[0].captorFamilyId, ARELS);
  assert.equal(after.realm.legitimacy, 37, 'a lawful arrest costs nothing more');
  assert.equal(after.people[BAREK].fear, fear + 15);
  assert.deepEqual(others.map((id) => getPersonalOpinion(after, id, AREL)), before.map((value) => value - 15));
  assert.equal(after.relations[`${NAMAR}:${AREL}`].causes.find((cause) => cause.label === 'Kronans hårda hand mot adeln').amount, -15, 'the leader also loses his offices');
  assert.deepEqual({ status: after.factions[0].status, outcome: after.factions[0].outcome }, { status: 'closed', outcome: 'crushed' });
  assert.equal(storyOf(after, story.id).status, 'resolved');
  loads(after);
});

test('the crush event names the leader alone', () => {
  const { state, story } = opened();
  state.actionRngState = CERTAIN;
  const { events } = answer(state, story, 'crush');
  for (const id of [DARA, KELAN, TALIA]) {
    assert.ok(!JSON.stringify(events).includes(id), id);
    assert.ok(!JSON.stringify(events).includes(state.people[id].name), id);
  }
});

test('a house that won names no faction in its opinion of the new ruler', () => {
  const { state, story } = opened();
  const after = advance(state, story.dueAt);
  assert.ok(!actionHooks(after).opinionReasons(NAMAR, SERA).some(({ label }) => /faktion|tronen/i.test(label)), 'a prompt reads these rows');
  assert.ok(actionHooks(after).opinionReasons(NAMAR, SERA).some(({ label }) => label === 'Stöder det nya styret'));
});

test('a crushed leader who speaks for the realm stays free', () => {
  const { state, story, faction } = opened();
  state.actionRngState = CERTAIN;
  const hooks = { ...actionHooks(state), activeRepresentative: () => state.people[NAMAR] };
  resolveUltimatum(state, story, 'crush', [], hooks);
  assert.equal(faction.outcome, 'crushed');
  assert.equal(isImprisoned(state, NAMAR), false);
});

test('a failed crush deposes the ruler', () => {
  const { state, story } = opened({}, { claimantId: BAREK });
  state.actionRngState = HOPELESS;
  const { plotRngState, rngState } = state, after = ok(answer(state, story, 'crush'));
  assert.equal(after.offices.ruler.holderId, BAREK);
  assert.deepEqual({ status: after.factions[0].status, outcome: after.factions[0].outcome }, { status: 'closed', outcome: 'deposed' });
  assert.equal(after.reign.lawful, false);
  assert.ok(isImprisoned(after, AREL));
  assert.equal(after.realm.legitimacy, 30);
  assert.deepEqual({ plot: after.plotRngState, rng: after.rngState }, { plot: plotRngState, rng: rngState });
  loads(after);
});

test('a failed crush confines a ruler of the claimant\'s own family who no longer heads it', () => {
  const { state, story } = opened();
  state.actionRngState = HOPELESS;
  state.families[ARELS].headId = ISET;
  const after = ok(answer(state, story, 'crush'));
  assert.equal(after.offices.ruler.holderId, SERA);
  assert.ok(isImprisoned(after, AREL));
  assert.equal(after.prisoners[0].captorFamilyId, ARELS);
  assert.equal(after.realm.legitimacy, 30);
  loads(after);
});

test('an expiry leaves a ruler of the claimant\'s own family free', () => {
  const { state, story } = opened();
  state.families[ARELS].headId = ISET;
  const after = advance(state, story.dueAt);
  assert.equal(after.offices.ruler.holderId, SERA);
  assert.equal(isImprisoned(after, AREL), false);
  assert.equal(after.realm.legitimacy, 35);
});

for (const [mode, options] of Object.entries(MODES)) test(`an ignored ultimatum forces abdication on its date, the same for whole and split advances in ${mode} mode`, () => {
  const { state, story } = opened(options, { claimantId: BAREK });
  const eve = advance(state, addGameMonths(state.date, 5));
  assert.equal(eve.offices.ruler.holderId, AREL);
  assert.equal(ultimatumOf(eve).id, story.id);

  const whole = ok(advanceCharacters(state, story.dueAt, { id: 'whole' }));
  let split = state;
  for (let month = 1; month <= 6; month++) split = normalizeCharacterSystem(plain(ok(advanceCharacters(split, addGameMonths(state.date, month), { id: `month-${month}` }))));
  assert.equal(whole.offices.ruler.holderId, BAREK);
  assert.deepEqual({ status: storyOf(whole, story.id).status, choiceId: storyOf(whole, story.id).choiceId, resolvedAt: storyOf(whole, story.id).resolvedAt }, { status: 'resolved', choiceId: 'forced', resolvedAt: story.dueAt });
  assert.equal(whole.factions[0].outcome, 'deposed');
  assert.deepEqual(content(plain(split)), content(plain(whole)));
});

for (const [mode, options] of Object.entries(MODES)) test(`a story the new ruler ends falls on the date of the abdication, the same for whole and split advances in ${mode} mode`, () => {
  const { state, story } = opened(options, { claimantId: BAREK });
  state.stories.push({ id: 'story-coup', type: 'coup', status: 'open', title: 'Kupp', description: 'Prov', actorId: BAREK, familyId: ESHMUNS, createdAt: state.date, dueAt: addGameMonths(state.date, 24), knownBy: 'public' });
  const target = addGameMonths(story.dueAt, 4);
  const whole = ok(advanceCharacters(state, target, { id: 'whole' }));
  let split = ok(advanceCharacters(state, story.dueAt, { id: 'first' }));
  split = ok(advanceCharacters(split, addGameMonths(story.dueAt, 1), { id: 'second' }));
  split = ok(advanceCharacters(split, target, { id: 'third' }));
  assert.equal(storyOf(whole, 'story-coup').resolvedAt, story.dueAt);
  assert.deepEqual(content(plain(split)), content(plain(whole)));
});

function forcedAbdication(options) {
  const fixture = opened(options, { leaderId: DARA });
  fixture.state.realm.prestige = 40;
  const state = ok(command(fixture.state, 'set_reign_goal', { goalType: 'fill_treasury' }));
  const influence = state.families[ARELS].influence, stress = state.people[AREL].stress, grievance = state.families[NAMARS].grievance;
  const opinion = getPersonalOpinion(state, NAMAR, SERA);
  const result = advanceCharacters(state, fixture.story.dueAt), after = ok(result);
  assert.equal(after.offices.ruler.holderId, SERA);
  assert.deepEqual({ rulerId: after.reign.rulerId, goals: after.reign.goals, lawful: after.reign.lawful }, { rulerId: SERA, goals: [], lawful: false });
  assert.deepEqual({ legitimacy: after.realm.legitimacy, prestige: after.realm.prestige }, { legitimacy: 35, prestige: 25 });
  assert.equal(after.families[ARELS].influence, influence - 15);
  assert.equal(after.people[AREL].stress, stress + 30);
  assert.equal(after.families[NAMARS].grievance, grievance - 2 + 5 + 10, 'an accession takes 2 from every other house, and an appointment gives 5 to the appointee\'s');
  assert.equal(getPersonalOpinion(after, NAMAR, SERA), opinion + 10);
  assert.equal(after.offices.chancellor.holderId, DARA);
  assert.ok(result.events.some((event) => event.title === FORCED_TITLE));
  assert.equal(after.status.ended, false);
  loads(after);
  const year = advance(after, addGameMonths(after.date, 12));
  assert.equal(year.status.ended, false);
  assert.equal(year.reign.rulerId, SERA);
}

test('a forced abdication costs the ruler, the goals, prestige and influence and leaves the campaign running in realm and family mode', () => {
  for (const options of Object.values(MODES)) forcedAbdication(options);
});

test('every house behind the faction is rewarded once', () => {
  const { state, faction, story } = opened();
  faction.memberIds = [...faction.memberIds, YARA];
  state.offices.chancellor.holderId = NAMAR;
  const head = state.families[ESHMUNS].headId, opinion = getPersonalOpinion(state, head, SERA);
  const eshmuns = state.families[ESHMUNS].grievance, namars = state.families[NAMARS].grievance;
  const after = advance(state, story.dueAt);
  assert.equal(after.families[ESHMUNS].grievance, eshmuns - 2 + 10);
  assert.equal(after.families[NAMARS].grievance, namars - 2 + 10);
  assert.equal(getPersonalOpinion(after, head, SERA), opinion + 10);
});

test('the old ruler\'s losses stop at their bounds', () => {
  const { state, story } = opened();
  state.families[ARELS].influence = 10;
  state.people[AREL].stress = 190;
  const after = advance(state, story.dueAt);
  assert.equal(after.families[ARELS].influence, 0);
  assert.equal(after.people[AREL].stress, 200);
});

test('a claimant who leads the faction leaves the chancery alone', () => {
  const { state, story } = opened({}, { claimantId: NAMAR });
  const after = advance(state, story.dueAt);
  assert.equal(after.offices.ruler.holderId, NAMAR);
  assert.equal(after.offices.chancellor.holderId, BAREK);
  loads(after);
});

test('a leader who is chancellor already keeps the seat without a new appointment', () => {
  const { state, story } = opened();
  state.offices.chancellor.holderId = NAMAR;
  const history = state.offices.chancellor.history.length, after = advance(state, story.dueAt);
  assert.equal(after.offices.chancellor.holderId, NAMAR);
  assert.equal(after.offices.chancellor.history.length, history);
});

test('a leader who holds another seat takes the chancery beside it', () => {
  const { state, story } = opened({}, { leaderId: KELAN });
  const after = advance(state, story.dueAt);
  assert.equal(after.offices.chancellor.holderId, KELAN);
  assert.equal(after.offices.general.holderId, KELAN);
  loads(after);
});

test('a deposed ruler goes to prison when the claimant is of another family', () => {
  const { state, story } = opened({}, { claimantId: BAREK });
  const after = advance(state, story.dueAt);
  assert.ok(isImprisoned(after, AREL));
  assert.equal(after.prisoners[0].captorFamilyId, ESHMUNS);
  assert.equal(after.realm.legitimacy, 30);
  loads(after);
});

test('a deposed ruler who still heads the player\'s household stays free', () => {
  const { state, story } = opened(FAMILY_MODE, { claimantId: BAREK });
  const after = advance(state, story.dueAt);
  assert.equal(after.offices.ruler.holderId, BAREK);
  assert.equal(isImprisoned(after, AREL), false);
  assert.equal(after.realm.legitimacy, 35);
  assert.equal(after.status.ended, false);
  loads(after);
});

test('a deposed ruler who no longer heads the household goes to prison in family mode', () => {
  const { state, story } = opened(FAMILY_MODE, { claimantId: BAREK });
  state.families[ARELS].headId = ISET;
  const after = advance(state, story.dueAt);
  assert.ok(isImprisoned(after, AREL));
  loads(after);
});

test('a ruler\'s death voids the faction, the demand, the breakdown and the goals without a penalty', () => {
  const fixture = opened();
  fixture.state.plotRngState = HIT;
  demandStep(fixture.state, [], actionHooks(fixture.state));
  fixture.state.people[AREL].stress = 100;
  breakdownStep(fixture.state, [], actionHooks(fixture.state));
  const state = ok(command(fixture.state, 'set_reign_goal', { goalType: 'fill_treasury' }));
  const breakdown = state.stories.find((story) => story.type === 'stress_breakdown');
  const { prestige } = state.realm, influence = state.families[ARELS].influence, events = [];
  actionHooks(state).kill([AREL], events, 'Provfall');
  const result = advanceCharacters(state, addGameMonths(state.date, 1)), after = ok(result);
  assert.notEqual(after.offices.ruler.holderId, AREL);
  assert.deepEqual({ status: after.factions[0].status, outcome: after.factions[0].outcome }, { status: 'closed', outcome: 'void' });
  const closed = storyOf(after, fixture.story.id);
  assert.deepEqual({ status: closed.status, resolvedAt: closed.resolvedAt, resolution: closed.resolution }, { status: 'closed', resolvedAt: state.date, resolution: 'Ultimatumet gällde den förra härskaren och faller med det styret.' });
  assert.equal(after.familyDemands[0].status, 'void');
  assert.equal(storyOf(after, breakdown.id).status, 'closed');
  assert.deepEqual(after.reign.goals, []);
  assert.deepEqual({ prestige: after.realm.prestige, influence: after.families[ARELS].influence, prisoners: after.prisoners }, { prestige, influence, prisoners: [] });
  assert.ok(![...events, ...result.events].some((event) => event.title === FORCED_TITLE));
  const later = advance(after, fixture.story.dueAt);
  assert.equal(later.reign.rulerId, after.reign.rulerId);
  loads(later);
});

test('the claimant falls through sibling, heir and leader and is replaced before the deadline', () => {
  const { state, faction, story } = opened();
  state.people[AREL].legalParentIds = [CHILDLESS];
  state.people[YARA].legalParentIds = [CHILDLESS];
  assert.equal(claimantFor(state, faction, actionHooks(state)).id, YARA);
  faction.claimantId = YARA;
  jail(state, YARA);
  refreshCourtStories(state, [], actionHooks(state));
  assert.equal(faction.claimantId, SERA, 'the sibling is in prison, so the heir stands');
  assert.ok(story.description.includes(state.people[SERA].name));
  assert.ok(!story.description.includes(state.people[YARA].name));

  const crowned = [], engine = actionHooks(state);
  const noHeirs = { ...engine, rulerCandidates: () => [], crown: (person, ...rest) => { crowned.push(person); return engine.crown(person, ...rest); } };
  state.people[SERA].diedAt = state.date;
  refreshFactions(state, [], noHeirs);
  assert.equal(faction.claimantId, NAMAR, 'no heir is left, so the leader stands');
  assert.ok(ultimatumChoices(state, story, noHeirs).some((choice) => choice.label === `Abdikera till förmån för ${state.people[NAMAR].name}`));

  state.date = story.dueAt;
  refreshCourtStories(state, [], noHeirs);
  assert.deepEqual(crowned.map((person) => person.id), [NAMAR]);
  validateFactions(state);
});

test('a claimant who dies or lands in prison on the deadline is not the one crowned', () => {
  // A death through the hook would run the expiry itself, past the spy below.
  for (const remove of [(state) => { state.people[SERA].diedAt = state.date; }, (state) => jail(state, SERA)]) {
    const { state, faction, story } = opened();
    state.date = story.dueAt;
    remove(state);
    const crowned = [], engine = actionHooks(state);
    refreshCourtStories(state, [], { ...engine, crown: (person, ...rest) => { crowned.push(person); return engine.crown(person, ...rest); } });
    assert.equal(crowned.length, 1);
    assert.equal(crowned[0].diedAt ?? null, null);
    assert.equal(isImprisoned(state, crowned[0].id), false);
    assert.notEqual(crowned[0].id, SERA);
    assert.equal(faction.outcome, 'deposed');
  }
});

test('a new leader takes over the ultimatum and becomes known', () => {
  const { state, faction, story } = opened();
  actionHooks(state).kill([NAMAR], [], 'Provfall');
  refreshCourtStories(state, [], actionHooks(state));
  assert.notEqual(faction.leaderId, NAMAR);
  assert.ok(faction.knownMemberIds.includes(faction.leaderId));
  assert.equal(story.actorId, faction.leaderId);
  assert.ok(story.description.includes(state.people[faction.leaderId].name));
  loads(state);
});

test('a faction that falls apart takes its ultimatum with it', () => {
  const { state, faction, story } = opened();
  actionHooks(state).kill([DARA, KELAN, TALIA], [], 'Provfall');
  refreshCourtStories(state, [], actionHooks(state));
  assert.deepEqual({ status: faction.status, outcome: faction.outcome }, { status: 'closed', outcome: 'dissolved' });
  assert.deepEqual({ status: story.status, resolvedAt: story.resolvedAt, resolution: story.resolution }, { status: 'closed', resolvedAt: state.date, resolution: 'Faktionen har fallit samman, och ultimatumet faller med den.' });
  const later = advance(state, story.dueAt);
  assert.equal(later.offices.ruler.holderId, AREL);
  loads(later);
});

test('a demand due on the same day falls with the old reign and costs the new ruler nothing', () => {
  const { state, story } = opened();
  state.plotRngState = HIT;
  demandStep(state, [], actionHooks(state));
  const [demand] = state.familyDemands, demandStory = storyOf(state, demand.storyId);
  demand.dueAt = story.dueAt;
  demandStory.dueAt = story.dueAt;
  const after = advance(state, story.dueAt);
  assert.equal(after.offices.ruler.holderId, SERA);
  assert.equal(after.familyDemands[0].status, 'void');
  assert.equal(storyOf(after, demandStory.id).status, 'closed');
  assert.notEqual(storyOf(after, demandStory.id).choiceId, 'lapse');
});

for (const [mode, options] of Object.entries(MODES)) test(`a dissolved realm leaves the ultimatum and its record agreeing in ${mode} mode`, () => {
  const { state, story } = opened(options);
  const after = ok(applyRealmDissolution(state, { id: `dissolve-${mode}`, date: state.date, reason: 'Riket faller.', hostCandidates: [] }));
  assert.deepEqual({ status: after.factions[0].status, outcome: after.factions[0].outcome, closedAt: after.factions[0].closedAt }, { status: 'closed', outcome: 'void', closedAt: state.date });
  assert.deepEqual({ status: storyOf(after, story.id).status, resolvedAt: storyOf(after, story.id).resolvedAt }, { status: 'closed', resolvedAt: state.date });
  assert.equal(ultimatumOf(after), undefined);
  loads(after);
  const later = advance(after, story.dueAt);
  assert.equal(later.factions[0].outcome, 'void');
  assert.notEqual(storyOf(later, story.id).choiceId, 'forced');
});

const CROWN_PATHS = {
  'a voluntary abdication': (state) => ok(command(state, 'abdicate', {})),
  'a death': (state) => { actionHooks(state).kill([AREL], [], 'Provfall'); return state; },
  'an appointment to the throne': (state) => { actionHooks(state).assignOffice(state.offices.ruler, state.people[SERA], [], 'Provfall'); return state; },
  'a crown taken by force': (state) => { actionHooks(state).crown(state.people[BAREK], [], 'Provfall', 40, false); return state; },
};
for (const [name, crown] of Object.entries(CROWN_PATHS)) test(`${name} leaves the ultimatum and its record agreeing`, () => {
  const { state, story } = opened();
  const after = crown(state);
  assert.deepEqual({ status: after.factions[0].status, outcome: after.factions[0].outcome }, { status: 'closed', outcome: 'void' });
  assert.equal(storyOf(after, story.id).status, 'closed');
  loads(after);
});

const ULTIMATUM_FORGERIES = {
  'a leader nobody knows': (faction) => { faction.knownMemberIds = []; },
  'a deadline before the ultimatum': (faction, state, story) => { faction.dueAt = addGameMonths(faction.ultimatumAt, -1); story.dueAt = faction.dueAt; },
  'a story already answered': (faction, state, story) => { story.status = 'resolved'; },
  'a story with another deadline': (faction, state, story) => { story.dueAt = addGameMonths(story.dueAt, 1); },
};
const OUTCOME_FORGERIES = {
  'no ultimatum': (faction) => { faction.ultimatumAt = null; },
  'an ultimatum after the end': (faction) => { faction.closedAt = addGameMonths(faction.ultimatumAt, -1); },
};
const TRUCE_FORGERIES = {
  'a truce with no ultimatum': (faction) => { faction.ultimatumAt = null; },
  'a truce with no concession': (faction) => { faction.concessions = 0; },
  'a truce that ends before the ultimatum': (faction) => { faction.quietUntil = addGameMonths(faction.ultimatumAt, -1); },
  'a truce that ends on the ultimatum': (faction) => { faction.quietUntil = faction.ultimatumAt; },
};

test('forged ultimatums are rejected', () => {
  const { state } = opened();
  validateFactions(state);
  for (const [name, forge] of Object.entries(ULTIMATUM_FORGERIES)) {
    const copy = plain(state);
    forge(copy.factions[0], copy, ultimatumOf(copy));
    assert.throws(() => validateFactions(copy), FORGED, name);
  }
});

test('an open ultimatum answers for a faction that stands behind it', () => {
  const { state } = opened();
  const quiet = plain(state);
  Object.assign(quiet.factions[0], { status: 'appeased', quietUntil: addGameMonths(quiet.date, 36), concessions: 1 });
  assert.throws(() => validateFactions(quiet), FORGED, 'the faction has backed down');
  const other = plain(state);
  other.stories.push({ ...plain(ultimatumOf(other)), id: 'story-second' });
  assert.throws(() => validateFactions(other), FORGED, 'a second open ultimatum');
});

for (const outcome of ['abdicated', 'deposed', 'crushed']) test(`a faction that ended as ${outcome} needs its ultimatum`, () => {
  const { state } = strong({}, { status: 'closed', outcome, closedAt: START, ultimatumAt: START });
  validateFactions(state);
  for (const [name, forge] of Object.entries(OUTCOME_FORGERIES)) {
    const copy = plain(state);
    forge(copy.factions[0], copy);
    assert.throws(() => validateFactions(copy), FORGED, name);
  }
});

test('a faction that dissolved or was voided needs no ultimatum', () => {
  for (const outcome of ['dissolved', 'void']) validateFactions(strong({}, { status: 'closed', outcome, closedAt: START }).state);
});

test('forged truces are rejected', () => {
  const { state } = strong({}, { status: 'appeased', ultimatumAt: START, quietUntil: addGameMonths(START, 36), concessions: 1 });
  validateFactions(state);
  for (const [name, forge] of Object.entries(TRUCE_FORGERIES)) {
    const copy = plain(state);
    forge(copy.factions[0], copy);
    assert.throws(() => validateFactions(copy), FORGED, name);
  }
});

test('an active faction with an ultimatum behind it is only a faction that gave way', () => {
  const date = START;
  validateFactions(strong({}, { ultimatumAt: date, quietUntil: date, concessions: 1 }).state);
  assert.throws(() => validateFactions(strong({}, { ultimatumAt: date }).state), FORGED);
});

test('a live faction is no older than the grace of its reign', () => {
  const state = ready();
  withFaction(state, { formedAt: addGameMonths(state.date, -1) });
  assert.throws(() => validateFactions(state), FORGED);
  const ended = ready();
  withFaction(ended, { formedAt: addGameMonths(ended.date, -1), status: 'closed', outcome: 'void', closedAt: ended.date });
  validateFactions(ended);
  const boundary = ready();
  withFaction(boundary);
  validateFactions(boundary);
});
