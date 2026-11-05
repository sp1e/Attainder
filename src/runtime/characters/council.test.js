import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { buildCharacterPromptContext } from '../characterWorld.js';
import { actionHooks, advanceCharacters, createCharacterSystem, estimateConversation, executeCharacterCommand, getAvailableCharacterActions, getCharacterPresentation, getCharacterWorldEffects, normalizeCharacterSystem } from './index.js';
import { COUNCIL_SEATS, ambitionOf, capPrecision, chancellorStep, chancellorYield, effectiveIntrigue, loyaltyDriftStep, loyaltyLabel, loyaltyPrecision, presentCouncil, presentLoyalty, readerIntrigue, serviceOf, serviceTier } from './council.js';
import { courtAnnualStep } from './court.js';
import { plotRandom } from './extensions.js';
import { hearScheme } from './rumors.js';
import { advanceSchemes } from './schemes.js';

const REP = 'person-0-0';
const SERA = 'person-0-2';
const NAMAR = 'person-1-0';
const KELAN = 'person-1-2';
const TALIA = 'person-1-3';
const BAREK = 'person-2-2';
const ESHMUN = 'person-2-0';
const SAFRA = 'person-3-0';
const SAFRA_KIN = 'person-3-2';
const MIRA = 'person-0-4';
const NAMARS = 'family-namar';
const ESHMUNS = 'family-eshmun';
const SAFRAS = 'family-safra';

const plain = (value) => JSON.parse(JSON.stringify(value));
const base = (options = {}) => createCharacterSystem({ seed: 321, ...options });
const streams = ({ rngState, actionRngState, plotRngState }) => ({ rngState, actionRngState, plotRngState });
let counter = 0;
const run = (state, type, payload) => executeCharacterCommand(state, { id: `council-${++counter}`, expectedRevision: state.revision, type, payload });
const ok = (result) => { assert.equal(result.ok, true, result.error); return result.state; };
const setOpinion = (state, fromId, toId, amount) => actionHooks(state).opinionCause(fromId, toId, amount, 'Prov', `council-test-${++counter}`, 10);
const opinionOf = (state, id) => actionHooks(state).getPersonalOpinion(id, REP);
// Moves a person's opinion of the ruler to exactly `target`, whatever the family bonds add.
const setRulerOpinion = (state, id, target) => setOpinion(state, id, REP, target - opinionOf(state, id));

// Seats a person with no traits and opinion 0 of the ruler, so service equals loyalty.
function seat(state, officeId, id, { loyalty = 50, intrigue = null, stewardship = null } = {}) {
  const person = state.people[id];
  state.offices[officeId].holderId = id;
  Object.assign(person, { traits: [], loyalty });
  if (intrigue !== null) person.skills.intrigue = intrigue;
  if (stewardship !== null) person.skills.stewardship = stewardship;
  setRulerOpinion(state, id, 0);
  return person;
}

// The action stream state whose next draw is `next` / 2^32: one xorshift step undone (as in rumors.test.js).
function seedBefore(next) {
  const undoLeft = (x, k) => { let y = x; for (let i = 0; i < 32; i += k) y = (x ^ (y << k)) >>> 0; return y; };
  const undoRight = (x, k) => { let y = x; for (let i = 0; i < 32; i += k) y = (x ^ (y >>> k)) >>> 0; return y; };
  return undoLeft(undoRight(undoLeft(next >>> 0, 5), 17), 13);
}
const drawOf = (percent) => seedBefore(Math.floor((percent / 100) * 2 ** 32));

// An NPC scheme against the controlled family, due for its monthly check today.
function plant(state, overrides = {}) {
  const item = {
    id: `scheme-${++state.sequence}`, actionId: 'undermine', actorId: BAREK, targetIds: [SERA], means: { silver: 0, agentRoles: [] },
    startedAt: state.date, dueAt: addGameMonths(state.date, 12), nextCheckAt: state.date,
    status: 'active', discoveredAt: null, resolutionId: null, playerControlled: false, commandId: null, ...overrides,
  };
  state.schemes.push(item);
  return item;
}

// Whether a scheme's monthly check discovers the plan on a draw of `percent`.
function discoveredAt(service, percent) {
  const state = plain(base());
  seat(state, 'spymaster', TALIA, { loyalty: service, intrigue: 12 });
  state.people[BAREK].skills.intrigue = 10;
  state.people[SERA].skills.intrigue = 10;
  const scheme = plant(state);
  state.actionRngState = drawOf(percent);
  advanceSchemes(state, [], actionHooks(state));
  return scheme.discoveredAt !== null;
}

// The rumor heard on a certain hearing draw and a true account.
function heardBy(state) {
  const scheme = plant(state, { targetIds: [NAMAR], nextCheckAt: addGameMonths(state.date, 1) });
  state.plotRngState = drawOf(0.01);
  return hearScheme(state, scheme, actionHooks(state));
}

// Whether a hearing draw of `percent` reaches the player, at a given service of a spymaster with intrigue 12.
function hears(service, percent) {
  const state = plain(base());
  seat(state, 'spymaster', TALIA, { loyalty: service, intrigue: 12 });
  const scheme = plant(state, { targetIds: [NAMAR], nextCheckAt: addGameMonths(state.date, 1) });
  state.plotRngState = drawOf(percent);
  return hearScheme(state, scheme, actionHooks(state)) !== null;
}

function drifted(opinion, grievance, loyalty = 50) {
  const state = plain(base());
  seat(state, 'general', KELAN, { loyalty });
  setRulerOpinion(state, KELAN, opinion);
  state.families[NAMARS].grievance = grievance;
  loyaltyDriftStep(state, actionHooks(state));
  return state.people[KELAN].loyalty;
}

// The court step rolls a family's demand on the plot stream, so the stream shows where the step runs in the year turn. On this stream the first draw misses Namar's chance of 40 and the draw after the plots hits it.
const ORDER_STREAM = 123615169;
const NAMARS_CHANCE = 40;
// A demand from today keeps its family quiet for 24 months and reaches nothing else in a year turn.
const yearOnStream = (quietFamilies) => {
  const state = plain(base());
  state.plotRngState = ORDER_STREAM;
  state.familyDemands = quietFamilies.map((familyId) => ({ id: `demand-${familyId}`, familyId, kind: 'office', targetId: 'chancellor', storyId: 'story-none', openedAt: state.date, dueAt: addGameMonths(state.date, 12), status: 'void', closedAt: state.date }));
  return ok(advanceCharacters(state, state.nextAnnualDate));
};

test('a year turn rolls the court step on the stream npcPlotStep leaves behind', () => {
  const afterPlots = yearOnStream([ESHMUNS, NAMARS, SAFRAS]).plotRngState;
  assert.notEqual(afterPlots, ORDER_STREAM);
  assert.ok(plotRandom({ plotRngState: ORDER_STREAM }) * 100 >= NAMARS_CHANCE);
  const next = { plotRngState: afterPlots };
  assert.ok(plotRandom(next) * 100 < NAMARS_CHANCE);

  const live = yearOnStream([ESHMUNS, SAFRAS]);
  assert.deepEqual(live.familyDemands.filter((demand) => demand.status === 'open').map((demand) => demand.familyId), [NAMARS]);
  assert.equal(live.plotRngState, next.plotRngState);
});

test('a real year turn runs the court step and pays the chancellor\'s yield', () => {
  const state = plain(base());
  seat(state, 'chancellor', BAREK, { loyalty: 100, stewardship: 10 });
  const expected = Math.round(Math.max(0, state.realm.treasury + getCharacterWorldEffects(state).annualRevenue) * 100) / 100 + 12;
  const after = ok(advanceCharacters(state, state.nextAnnualDate));
  assert.equal(after.realm.treasury, expected);
});

test('the court step stops at once in a dissolved realm', () => {
  const state = plain(base());
  seat(state, 'chancellor', BAREK, { loyalty: 100, stewardship: 10 });
  setRulerOpinion(state, BAREK, 20);
  const alive = plain(state);
  courtAnnualStep(alive, [], actionHooks(alive));
  assert.notDeepEqual(alive, state, 'the control: a living realm changes');
  state.realm.alive = false;
  const before = plain(state), events = [];
  courtAnnualStep(state, events, actionHooks(state));
  assert.deepEqual(state, before);
  assert.deepEqual(events, []);
});

test('the court step drifts loyalty before the chancellor yields', () => {
  const state = plain(base());
  seat(state, 'chancellor', BAREK, { loyalty: 49, stewardship: 20 });
  setRulerOpinion(state, BAREK, 20);
  const treasury = state.realm.treasury;
  courtAnnualStep(state, [], actionHooks(state));
  assert.equal(state.people[BAREK].loyalty, 50);
  assert.equal(state.realm.treasury, treasury + 5, 'service 56 after the drift yields 5; service 55 before it would yield 4');
});

test('the council seats are the three of moment 17, without the priest', () => {
  assert.deepEqual(COUNCIL_SEATS, ['chancellor', 'general', 'spymaster']);
});

test('service follows loyalty, opinion and personality', () => {
  const state = plain(base()), hooks = actionHooks(state);
  assert.equal(serviceOf(state, 'spymaster', hooks), null, 'a vacant seat');
  seat(state, 'spymaster', TALIA, { loyalty: 60 });
  assert.equal(serviceOf(state, 'spymaster', hooks), 60);
  setRulerOpinion(state, TALIA, 5);
  assert.equal(serviceOf(state, 'spymaster', hooks), 62, '61.5 rounds up');
  setRulerOpinion(state, TALIA, -10);
  assert.equal(serviceOf(state, 'spymaster', hooks), 57);
  setRulerOpinion(state, TALIA, 0);
  state.people[TALIA].traits = ['dutiful'];
  assert.equal(serviceOf(state, 'spymaster', hooks), 70);
  state.people[TALIA].traits = ['ambitious'];
  assert.equal(serviceOf(state, 'spymaster', hooks), 55);
  state.people[TALIA].traits = ['dutiful', 'ambitious'];
  assert.equal(serviceOf(state, 'spymaster', hooks), 65);
  // Service stays in 0..100.
  state.people[TALIA].traits = ['dutiful']; state.people[TALIA].loyalty = 100;
  assert.equal(serviceOf(state, 'spymaster', hooks), 100);
  state.people[TALIA].traits = ['ambitious']; state.people[TALIA].loyalty = 2;
  assert.equal(serviceOf(state, 'spymaster', hooks), 0);
  // The dead hold nothing.
  state.people[TALIA].diedAt = state.date;
  assert.equal(serviceOf(state, 'spymaster', hooks), null);
});

test('a crowned councillor keeps the seat at no opinion of herself and cannot reward herself', () => {
  const state = plain(base());
  state.offices.spymaster.holderId = SERA;
  assert.equal(serviceOf(state, 'spymaster', actionHooks(state)), 70);
  const crowned = ok(run(state, 'abdicate', {}));
  assert.equal(crowned.offices.ruler.holderId, SERA);
  assert.equal(crowned.offices.spymaster.holderId, SERA);
  assert.equal(serviceOf(crowned, 'spymaster', actionHooks(crowned)), crowned.people[SERA].loyalty);
  const refused = run(crowned, 'reward_councillor', { officeId: 'spymaster' });
  assert.equal(refused.ok, false);
  assert.equal(refused.error, 'Du kan inte belöna dig själv.');
  // Her own opinion moves no drift either.
  const { loyalty } = crowned.people[SERA];
  loyaltyDriftStep(crowned, actionHooks(crowned));
  assert.equal(crowned.people[SERA].loyalty, loyalty);
});

const rewardSeats = (state) => getAvailableCharacterActions(state).find((item) => item.type === 'reward_councillor').fields.find((item) => item.key === 'officeId').options.map((item) => item.value);

// A child on the throne and the old ruler as her regent, as in regencyAuthority.test.js.
function regency(seats) {
  const state = plain(base());
  Object.assign(state.offices.ruler, { holderId: MIRA, regentId: REP });
  state.reign.rulerId = MIRA;
  state.realm.lawfulRulerId = MIRA;
  state.regencies['office:ruler'] = { id: 'office:ruler', principalId: MIRA, regentId: REP, phase: 'minority', startedAt: state.date, grants: [], requestAfter: {}, handoverDueAt: null };
  state.stories = [];
  for (const [officeId, holderId] of Object.entries(seats)) state.offices[officeId].holderId = holderId;
  delete state.mandateVersion; delete state.mandateActivatedAt; delete state.mandateSequence;
  return normalizeCharacterSystem(state);
}

test('the reward menu leaves out the ruler\'s own seat', () => {
  const state = plain(base());
  state.offices.spymaster.holderId = SERA;
  assert.deepEqual(rewardSeats(state), ['chancellor', 'general', 'spymaster']);
  const crowned = ok(run(state, 'abdicate', {}));
  assert.equal(crowned.offices.spymaster.holderId, SERA);
  assert.deepEqual(rewardSeats(crowned), ['chancellor', 'general']);
});

test('a regent in a seat cannot reward herself', () => {
  const state = regency({ spymaster: REP, general: MIRA });
  const hooks = actionHooks(state);
  assert.equal(hooks.ruler().id, MIRA);
  assert.equal(hooks.activeRepresentative().id, REP);
  const refused = run(state, 'reward_councillor', { officeId: 'spymaster' });
  assert.equal(refused.ok, false);
  assert.equal(refused.error, 'Du kan inte belöna dig själv.');
  assert.deepEqual(rewardSeats(state), ['chancellor'], 'neither her own seat nor the child ruler\'s');
  ok(run(state, 'reward_councillor', { officeId: 'chancellor' }));
});

test('a regent cannot reward the seat the ruler holds', () => {
  const state = regency({ general: MIRA });
  const { treasury } = state.realm, { loyalty } = state.people[MIRA], { actionPoints } = state;
  const refused = run(state, 'reward_councillor', { officeId: 'general' });
  // A refused command hands the input back, so these read the state the command would have changed.
  assert.equal(refused.state.realm.treasury, treasury);
  assert.equal(refused.state.people[MIRA].loyalty, loyalty);
  assert.equal(refused.state.actionPoints, actionPoints);
  assert.equal(refused.ok, false);
  assert.equal(refused.error, 'Härskarens ämbete kan inte belönas.');
});

test('the reward action closes with a reason when no seat can be rewarded', () => {
  const rewardAction = (state) => getAvailableCharacterActions(state).find((item) => item.type === 'reward_councillor');
  const closed = regency({ spymaster: REP, general: MIRA, chancellor: null });
  assert.deepEqual(rewardSeats(closed), []);
  assert.equal(rewardAction(closed).disabledReason, 'Inget av rådets ämbeten kan belönas.');
  const vacant = regency({ spymaster: null, general: null, chancellor: null });
  assert.equal(rewardAction(vacant).disabledReason, 'Inget av rådets ämbeten kan belönas.');
  assert.equal(rewardAction(regency({ spymaster: REP, general: MIRA })).disabledReason, '', 'one open seat keeps the action open');
});

test('a sitting ruler wants no throne', () => {
  const state = plain(base()), hooks = actionHooks(state);
  state.people[REP].traits = ['ambitious'];
  assert.ok(state.families[state.people[REP].familyId].influence >= 50);
  assert.equal(hooks.ruler().id, REP);
  assert.notEqual(ambitionOf(state, state.people[REP], hooks), 'throne');
});

test('service reads as four tiers', () => {
  assert.deepEqual([100, 70, 69, 50, 49, 30, 29, 0].map(serviceTier), ['trogen', 'trogen', 'pålitlig', 'pålitlig', 'motvillig', 'motvillig', 'opålitlig', 'opålitlig']);
});

test('a spymaster below 50 service hears less and sees less', () => {
  const state = plain(base()), hooks = actionHooks(state), talia = state.people[TALIA];
  seat(state, 'spymaster', TALIA, { intrigue: 12 });
  const effective = (service) => { talia.loyalty = service; return effectiveIntrigue(state, talia, hooks); };
  assert.deepEqual([100, 50, 49, 30, 29, 0].map(effective), [12, 12, 9, 9, 6, 6]);
  talia.skills.intrigue = 7; talia.loyalty = 30;
  assert.equal(effectiveIntrigue(state, talia, hooks), 5, 'floor(5.25)');
  talia.loyalty = 29;
  assert.equal(effectiveIntrigue(state, talia, hooks), 3, 'floor(3.5)');

  // spymasterWatch: base chance 20 plus half the effective intrigue, 6, 4 or 3.
  for (const [service, chance] of [[50, 26], [49, 24], [30, 24], [29, 23]]) {
    assert.equal(discoveredAt(service, chance - 0.01), true, `service ${service} sees just below ${chance}`);
    assert.equal(discoveredAt(service, chance + 0.01), false, `service ${service} misses just above ${chance}`);
  }

  // hearScheme: hearing 5 + effective × 2, accuracy 40 + effective × 3.
  for (const [service, chance] of [[50, 29], [49, 23], [29, 17]]) {
    assert.equal(hears(service, chance - 0.01), true, `service ${service} hears just below ${chance}`);
    assert.equal(hears(service, chance + 0.01), false, `service ${service} misses just above ${chance}`);
  }
  const reliability = (service, intrigue) => { const scene = plain(base()); seat(scene, 'spymaster', TALIA, { loyalty: service, intrigue }); return heardBy(scene).reliability; };
  assert.deepEqual([50, 49, 29].map((service) => reliability(service, 12)), ['trolig', 'trolig', 'osäker']);
  assert.deepEqual([50, 49, 29].map((service) => reliability(service, 14)), ['säker', 'trolig', 'trolig']);
});

test('Phase 2 numbers hold at 50 service or more', () => {
  const state = plain(base()), hooks = actionHooks(state), talia = state.people[TALIA];
  seat(state, 'spymaster', TALIA);
  for (const intrigue of [1, 7, 12, 13, 20]) {
    talia.skills.intrigue = intrigue;
    for (const service of [50, 75, 100]) {
      talia.loyalty = service;
      assert.equal(effectiveIntrigue(state, talia, hooks), intrigue);
    }
  }
  // Someone who holds no council seat keeps their intrigue, the representative above all.
  const representative = state.people[REP];
  representative.loyalty = 0;
  assert.equal(effectiveIntrigue(state, representative, hooks), representative.skills.intrigue);
  // The priest is outside the council.
  const safra = state.people[SAFRA];
  safra.loyalty = 0;
  assert.equal(effectiveIntrigue(state, safra, hooks), safra.skills.intrigue);
});

test('the reader is the spymaster, else half the representative', () => {
  const state = plain(base()), hooks = actionHooks(state);
  assert.equal(state.people[REP].skills.intrigue, 4);
  assert.equal(readerIntrigue(state, hooks), 2);
  state.people[REP].skills.intrigue = 5;
  assert.equal(readerIntrigue(state, hooks), 2, 'rounds down');
  seat(state, 'spymaster', TALIA, { loyalty: 40, intrigue: 12 });
  assert.equal(readerIntrigue(state, hooks), 9);
  assert.equal(loyaltyPrecision(state, hooks), 'five');
  state.people[TALIA].loyalty = 50;
  assert.equal(loyaltyPrecision(state, hooks), 'exact');
  state.people[TALIA].diedAt = state.date;
  assert.equal(readerIntrigue(state, hooks), 2, 'a dead spymaster reads nothing');
  assert.equal(loyaltyPrecision(state, hooks), 'three');
});

test('loyalty bands contain the true value', () => {
  const five = { 0: 'mycket svag', 20: 'mycket svag', 21: 'svag', 40: 'svag', 41: 'jämn', 60: 'jämn', 61: 'stark', 80: 'stark', 81: 'mycket stark', 95: 'mycket stark', 96: 'mycket stark', 100: 'mycket stark' };
  for (const [value, label] of Object.entries(five)) assert.equal(loyaltyLabel(Number(value), 'five'), label, `five at ${value}`);
  const three = { 0: 'svag', 20: 'svag', 21: 'svag', 35: 'svag', 36: 'oviss', 40: 'oviss', 41: 'oviss', 60: 'oviss', 61: 'oviss', 65: 'oviss', 66: 'stark', 80: 'stark', 81: 'stark', 95: 'stark', 96: 'stark', 100: 'stark' };
  for (const [value, label] of Object.entries(three)) assert.equal(loyaltyLabel(Number(value), 'three'), label, `three at ${value}`);
  assert.equal(loyaltyLabel(48, 'exact'), '48 av 100');
  assert.equal(loyaltyLabel(0, 'exact'), '0 av 100');
});

test('the coarser precision wins', () => {
  const order = ['three', 'five', 'exact'];
  for (const [i, a] of order.entries()) for (const [j, b] of order.entries()) assert.equal(capPrecision(a, b), order[Math.min(i, j)]);
});

test('the presentation carries no loyalty and reads it at the reader\'s precision', () => {
  const reading = (state) => getCharacterPresentation(state).people.find((person) => person.id === NAMAR).loyaltyReading;
  const state = plain(base());
  state.people[NAMAR].loyalty = 48;
  assert.deepEqual(reading(state), { label: 'oviss', precision: 'three' });
  const sera = state.people[SERA];
  state.offices.spymaster.holderId = SERA;
  assert.equal(sera.skills.intrigue, 7);
  assert.equal(serviceOf(state, 'spymaster', actionHooks(state)), 70);
  assert.deepEqual(reading(state), { label: 'jämn', precision: 'five' });
  sera.skills.intrigue = 12;
  assert.deepEqual(reading(state), { label: '48 av 100', precision: 'exact' });

  // Service 20: intrigue 14 falls to 7 and exact to five, intrigue 7 falls to 3 and five to three.
  sera.loyalty = 18;
  assert.equal(serviceOf(state, 'spymaster', actionHooks(state)), 20);
  sera.skills.intrigue = 14;
  assert.deepEqual(reading(state), { label: 'jämn', precision: 'five' });
  sera.skills.intrigue = 7;
  assert.deepEqual(reading(state), { label: 'oviss', precision: 'three' });

  const view = getCharacterPresentation(state);
  assert.equal(view.ruler.loyaltyReading, null, 'the representative reads no loyalty of himself');
  for (const person of [...view.people, view.ruler, view.representative]) assert.equal(person.loyalty, undefined);
  assert.doesNotMatch(JSON.stringify(view), /"loyalty"/);
  assert.equal(presentLoyalty(state, state.people[REP], actionHooks(state)), null);
});

test('no prompt carries a true loyalty', () => {
  const prompt = buildCharacterPromptContext(plain(base()));
  assert.doesNotMatch(prompt, /"loyalty"/);
  assert.match(prompt, /"loyaltyReading":\{"label":"oviss","precision":"three"\}/);
});

test('a new representative\'s last decision keeps loyalty out of the view and the prompt', () => {
  const fresh = base(), state = ok(run(ok(advanceCharacters(fresh, addGameMonths(fresh.date, 12))), 'abdicate', {}));
  const saved = state.people[SERA].lastDecision;
  assert.match(saved.reasons.join(' '), /Tjänstelojalitet/, 'the control: the saved record holds the number');
  const view = getCharacterPresentation(state);
  assert.equal(view.representative.id, SERA);
  assert.deepEqual(view.representative.lastDecision, { choice: saved.choice, date: saved.date });
  // The bare word stays in view.versions.provenance, a source credit with no number.
  assert.doesNotMatch(JSON.stringify(view), /Tjänstelojalitet \d|"scores"/);
  assert.doesNotMatch(buildCharacterPromptContext(state), /Tjänstelojalitet \d|"scores"/);
});

test('presenting the council and the readings draws nothing and spends nothing', () => {
  const state = plain(base());
  seat(state, 'spymaster', TALIA, { loyalty: 40, intrigue: 12 });
  const before = plain(state), hooks = actionHooks(state);
  getCharacterPresentation(state);
  presentCouncil(state, hooks);
  presentLoyalty(state, state.people[NAMAR], hooks);
  ambitionOf(state, state.people[NAMAR], hooks);
  assert.deepEqual(plain(state), before);
});

test('conversation odds never show more than the loyalty precision', () => {
  const state = plain(base());
  const speaker = state.people[NAMAR], representative = state.people[REP];
  Object.assign(speaker, { traits: [], loyalty: 80 });
  representative.skills.diplomacy = 14;
  const request = { personId: NAMAR, kind: 'support', offerSilver: 0, hookId: null, arguments: [], argumentScore: 0 };
  const estimate = () => estimateConversation(state, request);

  // Diplomacy 14 without a spymaster: a band and no number, on any row.
  const banded = estimate();
  assert.equal(banded.ok, true, banded.reason);
  assert.equal(banded.precision, 'three');
  assert.equal(typeof banded.display.chance, 'string');
  assert.ok(banded.display.modifiers.every((row) => !('value' in row)));
  assert.doesNotMatch(JSON.stringify(banded.display), /\d/);
  assert.ok(banded.modifiers.some((row) => row.label === 'Personens lojalitet'), 'the true row stays for the roll');

  // A spymaster who serves well lifts the cap to five, and one with intrigue 12 to the talker's own precision.
  seat(state, 'spymaster', TALIA, { loyalty: 60, intrigue: 7 });
  assert.equal(estimate().precision, 'five');
  state.people[TALIA].skills.intrigue = 12;
  const exact = estimate();
  assert.equal(exact.precision, 'exact');
  assert.equal(typeof exact.display.chance, 'number');
  // The spymaster never lifts a poor talker above his diplomacy.
  representative.skills.diplomacy = 4;
  assert.equal(estimate().precision, 'three');
  // The rolled value stays the same at every precision.
  assert.equal(exact.value, banded.value);
});

test('the loyalty row shows only at exact precision and still counts in the odds', () => {
  const state = plain(base()), speaker = state.people[NAMAR], ROW = 'Personens lojalitet';
  speaker.traits = [];
  state.people[REP].skills.diplomacy = 14;
  const request = { personId: NAMAR, kind: 'support', offerSilver: 0, hookId: null, arguments: [], argumentScore: 0 };
  const at = (loyalty) => { speaker.loyalty = loyalty; return estimateConversation(state, request); };

  // Below exact the rows read the same at any loyalty, so neither a sign nor a zero row left out sorts loyalty into buckets.
  for (const [intrigue, precision] of [[null, 'three'], [7, 'five']]) {
    if (intrigue !== null) seat(state, 'spymaster', TALIA, { loyalty: 60, intrigue });
    const estimates = [20, 49, 50, 52, 80].map(at);
    for (const estimate of estimates) {
      assert.equal(estimate.precision, precision);
      assert.deepEqual(estimate.display.modifiers, estimates[0].display.modifiers);
      assert.ok(estimate.display.modifiers.every((row) => row.label !== ROW));
    }
    assert.equal(estimates[4].value - estimates[0].value, 12, 'the loyalty row moves the odds from −6 to +6');
    assert.equal(estimates[4].modifiers.find((row) => row.label === ROW).value, 6);
  }

  seat(state, 'spymaster', TALIA, { loyalty: 60, intrigue: 12 });
  assert.deepEqual(at(80).display.modifiers.find((row) => row.label === ROW), { label: ROW, value: 6 });
});

test('loyalty drifts with opinion and grievance', () => {
  for (const [opinion, grievance, change] of [[20, 0, 1], [19, 0, 0], [-19, 0, 0], [-20, 0, -2], [0, -10, -1], [0, -9, 0], [-20, -10, -3], [20, -10, 0]]) {
    assert.equal(drifted(opinion, grievance), 50 + change, `opinion ${opinion}, grievance ${grievance}`);
  }
  assert.equal(drifted(20, 0, 100), 100, 'clamped at 100');
  assert.equal(drifted(-20, -10, 1), 0, 'clamped at 0');
});

test('loyalty drift reaches only the living holders of council seats, once each', () => {
  const state = plain(base());
  seat(state, 'chancellor', BAREK, { loyalty: 50 });
  seat(state, 'general', BAREK, { loyalty: 50 });
  setRulerOpinion(state, BAREK, 20);
  const dead = seat(state, 'spymaster', TALIA, { loyalty: 50 });
  setRulerOpinion(state, TALIA, 20);
  dead.diedAt = state.date;
  const priest = state.offices.priest.holderId, governor = state.offices['governor-0'].holderId;
  setRulerOpinion(state, priest, 20);
  setRulerOpinion(state, governor, 20);
  const before = plain(state);
  loyaltyDriftStep(state, actionHooks(state));
  assert.equal(state.people[BAREK].loyalty, 51, 'two seats drift once');
  assert.equal(dead.loyalty, 50);
  assert.equal(state.people[priest].loyalty, before.people[priest].loyalty);
  assert.equal(state.people[governor].loyalty, before.people[governor].loyalty);
  assert.deepEqual(streams(state), streams(before));
});

test('the chancellor\'s yield follows service and draws nothing', () => {
  const state = plain(base()), hooks = actionHooks(state);
  seat(state, 'chancellor', BAREK, { stewardship: 10 });
  const yieldAt = (service) => { state.people[BAREK].loyalty = service; return chancellorYield(state, hooks); };
  assert.deepEqual([75, 25, 100, 0, 50].map(yieldAt), [10, -10, 12, -12, 0]);
  // A loss too small to round to a coin is 0, never −0.
  state.people[BAREK].skills.stewardship = 1;
  assert.equal(yieldAt(45), 0);
  state.people[BAREK].skills.stewardship = 0;
  assert.equal(yieldAt(0), 0);
  state.offices.chancellor.holderId = null;
  assert.equal(chancellorYield(state, hooks), 0, 'a vacant seat');

  seat(state, 'chancellor', BAREK, { loyalty: 75, stewardship: 10 });
  const before = plain(state);
  chancellorStep(state, hooks);
  assert.equal(state.realm.treasury, before.realm.treasury + 10);
  assert.deepEqual({ ...plain(state), realm: before.realm }, before, 'the treasury moves and nothing else, so no log line reveals the sign');
  // The realm treasury has a floor of 0, and no amount of money falls below it.
  state.people[BAREK].loyalty = 0;
  state.realm.treasury = 5;
  chancellorStep(state, hooks);
  assert.equal(state.realm.treasury, 0);
});

test('a treasury in cents keeps two decimals after the yield', () => {
  const state = plain(base()), hooks = actionHooks(state);
  seat(state, 'chancellor', BAREK, { loyalty: 75, stewardship: 10 });
  state.realm.treasury = 1.13;
  chancellorStep(state, hooks);
  assert.equal(state.realm.treasury, 11.13);
});

test('reward_councillor raises loyalty once a year and refuses a vacant seat', () => {
  const state = plain(base());
  const refused = (result, message) => { assert.equal(result.ok, false); assert.equal(result.error, message); };
  state.people[BAREK].loyalty = 60;
  const { treasury } = state.realm, { actionPoints } = state;

  const rewarded = ok(run(state, 'reward_councillor', { officeId: 'chancellor' }));
  assert.equal(rewarded.people[BAREK].loyalty, 68);
  const logged = (after) => after.log.find((event) => event.title === `${state.people[BAREK].name} belönades`);
  assert.equal(logged(rewarded).public, true);
  assert.doesNotMatch(`${logged(rewarded).title} ${logged(rewarded).description}`, /\d|lojal/i);
  assert.equal(rewarded.realm.treasury, treasury - 20);
  assert.equal(rewarded.actionPoints, actionPoints - 1);
  assert.equal(rewarded.reign.deeds.generous, state.reign.deeds.generous + 1);
  assert.deepEqual(streams(rewarded), streams(state));
  refused(run(rewarded, 'reward_councillor', { officeId: 'chancellor' }), 'Rådsmedlemmen belönades nyligen.');

  // Another councillor has a cooldown of his own.
  ok(run(rewarded, 'reward_councillor', { officeId: 'general' }));

  // The cooldown runs twelve months.
  const almost = plain(rewarded);
  almost.date = addGameMonths(state.date, 11);
  refused(run(almost, 'reward_councillor', { officeId: 'chancellor' }), 'Rådsmedlemmen belönades nyligen.');
  almost.date = addGameMonths(state.date, 12);
  ok(run(almost, 'reward_councillor', { officeId: 'chancellor' }));

  refused(run(state, 'reward_councillor', { officeId: 'spymaster' }), 'Ämbetet är vakant.');
  assert.equal(run(state, 'reward_councillor', { officeId: 'priest' }).ok, false, 'the priest is outside the council');
  assert.equal(run(state, 'reward_councillor', { officeId: 'ruler' }).ok, false);

  // Loyalty stays within 100, and the log reads the same at any loyalty.
  const loyal = plain(state);
  loyal.people[BAREK].loyalty = 95;
  const crowded = ok(run(loyal, 'reward_councillor', { officeId: 'chancellor' }));
  assert.equal(crowded.people[BAREK].loyalty, 100);
  assert.equal(logged(crowded).description, logged(rewarded).description);

  // The silver comes from the realm, so a house without the crown has no such command.
  refused(run(base({ mode: 'family', familyId: NAMARS }), 'reward_councillor', { officeId: 'chancellor' }), 'Beslutet kräver härskarens eller regentens mandat.');

  // The menu follows the filled seats, and the cooldown stays out of the view.
  const action = getAvailableCharacterActions(state).find((item) => item.type === 'reward_councillor');
  assert.equal(action.label, 'Belöna en rådsmedlem');
  assert.equal(action.cost, '20 silver ur statskassan · 1 handling');
  const field = action.fields.find((item) => item.key === 'officeId');
  assert.equal(field.label, 'Ämbete');
  assert.deepEqual(field.options.map((item) => item.value), ['chancellor', 'general']);
  assert.doesNotMatch(JSON.stringify(getCharacterPresentation(rewarded)), /council_reward/);
});

test('ambition follows the first match of five', () => {
  const state = plain(base()), hooks = actionHooks(state);
  const label = (id) => ambitionOf(state, state.people[id], hooks);
  const namar = state.people[NAMAR];

  // Throne: ambitious, a family of influence 50 or more, opinion of the ruler 0 or less.
  namar.traits = ['ambitious']; state.families[NAMARS].influence = 50;
  setRulerOpinion(state, NAMAR, 0);
  assert.equal(label(NAMAR), 'throne');
  state.families[NAMARS].influence = 49;
  assert.equal(label(NAMAR), 'security', 'an ambitious governor of a weak house already holds office');
  state.families[NAMARS].influence = 50;
  setRulerOpinion(state, NAMAR, 1);
  assert.equal(label(NAMAR), 'security', 'nor does he want the throne from a ruler he likes');

  // Office: holds none, ambitious or seeking one.
  const talia = state.people[TALIA];
  Object.assign(talia, { traits: ['ambitious'], goal: null });
  state.families[NAMARS].influence = 49;
  assert.equal(label(TALIA), 'office');
  Object.assign(talia, { traits: [], goal: { type: 'office' } });
  assert.equal(label(TALIA), 'office');
  Object.assign(talia, { traits: ['greedy'], goal: null });
  assert.equal(label(TALIA), 'wealth', 'no office wanted, so the next match decides');

  // City: a family head whose family holds fewer cities than another.
  assert.equal(label(SAFRA), 'city');
  Object.assign(state.people[SAFRA_KIN], { traits: [], goal: null });
  assert.equal(label(SAFRA_KIN), 'security', 'only the head of the house wants its city');
  assert.equal(label(NAMAR), 'security', 'three houses hold one city each');
  assert.equal(label(ESHMUN), 'wealth', 'greedy, and his house holds as many cities as any');
  state.people[ESHMUN].traits = [];
  assert.equal(label(ESHMUN), 'security');
});

test('ambition reaches the view only at five-band precision or better', () => {
  const state = plain(base()), hooks = actionHooks(state);
  assert.deepEqual(presentCouncil(state, hooks).ambitions, []);
  assert.deepEqual(getCharacterPresentation(state).court.council.ambitions, []);

  seat(state, 'spymaster', TALIA, { loyalty: 60, intrigue: 7 });
  const expected = [
    { personId: NAMAR, name: state.people[NAMAR].name, ambitionLabel: 'Trygghet' },
    { personId: ESHMUN, name: state.people[ESHMUN].name, ambitionLabel: 'Rikedom' },
    { personId: SAFRA, name: state.people[SAFRA].name, ambitionLabel: 'En stad' },
  ];
  assert.deepEqual(presentCouncil(state, hooks).ambitions, expected);
  state.people[TALIA].skills.intrigue = 12;
  assert.deepEqual(presentCouncil(state, hooks).ambitions, expected);
  // The ambition itself is never stored on a person.
  assert.doesNotMatch(JSON.stringify(state.people), /ambition/i);
  // A spymaster who serves poorly loses the view again.
  state.people[TALIA].skills.intrigue = 7;
  state.people[TALIA].loyalty = 29;
  assert.deepEqual(presentCouncil(state, hooks).ambitions, []);
});

test('the council shows each seat at the reader\'s precision, with service kept inside 5..95', () => {
  const state = plain(base()), hooks = actionHooks(state);
  const view = presentCouncil(state, hooks);
  assert.deepEqual(view.seats, [
    { officeId: 'chancellor', name: 'Kansler', holderId: BAREK, holderName: state.people[BAREK].name, serviceLabel: 'stark' },
    { officeId: 'general', name: 'Överbefälhavare', holderId: KELAN, holderName: state.people[KELAN].name, serviceLabel: 'oviss' },
    { officeId: 'spymaster', name: 'Spionmästare', holderId: null, holderName: 'Vakant', serviceLabel: null },
  ]);
  assert.deepEqual(getCharacterPresentation(state).court.council.seats, view.seats);

  seat(state, 'spymaster', TALIA, { loyalty: 60, intrigue: 12 });
  seat(state, 'chancellor', BAREK, { loyalty: 100 });
  seat(state, 'general', KELAN, { loyalty: 0 });
  const exact = presentCouncil(state, hooks).seats;
  assert.deepEqual(exact.map((row) => row.serviceLabel), ['95 av 100', '5 av 100', '60 av 100']);
});

test('a dead holder leaves the seat vacant in the council view', () => {
  const state = plain(base()), hooks = actionHooks(state);
  state.people[KELAN].diedAt = state.date;
  const general = presentCouncil(state, hooks).seats.find((row) => row.officeId === 'general');
  assert.deepEqual(general, { officeId: 'general', name: 'Överbefälhavare', holderId: null, holderName: 'Vakant', serviceLabel: null });
});

test('the player\'s own house is left out of the ambitions', () => {
  const state = plain(base()), hooks = actionHooks(state);
  seat(state, 'spymaster', TALIA, { loyalty: 60, intrigue: 7 });
  const ids = presentCouncil(state, hooks).ambitions.map((row) => row.personId);
  assert.ok(!ids.includes(REP));
  assert.ok(!ids.includes(MIRA));
});
