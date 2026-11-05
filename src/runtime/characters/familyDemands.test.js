import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths } from '../gameDates.js';
import { actionHooks, advanceCharacters, applyRealmDissolution, createCharacterSystem, executeCharacterCommand, getCharacterPresentation, getPersonalOpinion, normalizeCharacterSystem } from './index.js';
import { breakdownStep, stressPressureStep } from './breakdowns.js';
import { courtAnnualStep, refreshCourtStories } from './court.js';
import { plotRandom } from './extensions.js';
import { demandChoices, demandStep, presentDemands, seatReaction, validateFamilyDemands, voidOpenDemands } from './familyDemands.js';
import { attachMandateGrant } from './mandateEpisodes.js';

const AREL = 'person-0-0';
const HEIR = 'person-0-2';
const NAMAR = 'person-1-0';
const KELAN = 'person-1-2';
const NAMAR_KIN = 'person-1-3';
const ESHMUN = 'person-2-0';
const SAFRA = 'person-3-0';
const ARELS = 'family-arel';
const NAMARS = 'family-namar';
const ESHMUNS = 'family-eshmun';
const SAFRAS = 'family-safra';
const STREAM_LIMIT = 50_000_000;
const CITIES = ['Ake', 'Bor', 'Cal', 'Dur', 'Eli'].map((name, index) => ({ id: `city-${index}`, name, regionId: `region-${index}` }));
const FORGED = /^Ett krav i sparfilen är ogiltigt\.$/;
const NO_ORDERS = 'Årets handlingsutrymme är slut. För tiden framåt.';

const plain = (value) => JSON.parse(JSON.stringify(value));
const base = (options = {}) => plain(createCharacterSystem({ seed: 321, ...options }));
const ok = (result) => { assert.equal(result.ok, true, result.error); return result.state; };
const advance = (state, date) => ok(advanceCharacters(state, date));
const opinion = (state, fromId) => getPersonalOpinion(state, fromId, AREL);
const grievances = (state) => Object.fromEntries(Object.values(state.families).map((family) => [family.id, family.grievance]));
const storyOf = (state, id) => state.stories.find((story) => story.id === id);
const choice = (choices, id) => choices.find((item) => item.id === id);
let commands = 0;
const command = (state, type, payload) => executeCharacterCommand(state, { id: `demand-test-${++commands}`, expectedRevision: state.revision, type, payload });
const answer = (state, story, choiceId) => command(state, 'resolve_story', { storyId: story.id, choiceId });

// A plot stream whose next draws, as percents, pass the checks in order. Found here, so a test states what it rolls instead of a bare number.
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

const othersThan = (familyId) => [ESHMUNS, NAMARS, SAFRAS].filter((id) => id !== familyId);
const exile = (state, ids, exiled = true) => { for (const id of ids) state.families[id].exiled = exiled; };
// One house left that can demand. An exiled house makes no demand, and the other tests bring it back.
function stepAlone(state, familyId, stream = HIT) {
  exile(state, othersThan(familyId));
  state.plotRngState = stream;
  const events = [];
  demandStep(state, events, actionHooks(state));
  exile(state, othersThan(familyId), false);
  return events;
}
function opened(options = {}, familyId = NAMARS) {
  const state = base(options), events = stepAlone(state, familyId);
  const demand = state.familyDemands[0];
  return { state, demand, story: storyOf(state, demand.storyId), events };
}
const kindAndTarget = ({ kind, targetId }) => ({ kind, targetId });
const opensAt = (state, roll) => { state.plotRngState = roll; demandStep(state, [], actionHooks(state)); return state.familyDemands.length === 1; };

test('a family with no valid target draws nothing', () => {
  const state = base();
  for (const officeId of ['chancellor', 'general', 'priest']) state.offices[officeId].holderId = KELAN;
  const events = stepAlone(state, NAMARS);
  assert.equal(state.plotRngState, HIT);
  assert.deepEqual(state.familyDemands, []);
  assert.deepEqual(events, []);
});

const SKIPS = {
  'an exiled house': (state) => { state.families[NAMARS].exiled = true; },
  'a dead head': (state) => { state.people[NAMAR].diedAt = state.date; },
  'a minor head': (state) => { state.people[NAMAR].bornAt = addGameMonths(state.date, -120); },
  'a head in prison': (state) => { state.prisoners.push({ id: 'prisoner-1', personId: NAMAR, captorFamilyId: ARELS, since: state.date, ransom: 40, status: 'held', closedAt: null, reason: null }); },
  'a house with nobody free to seat': (state) => {
    state.people[NAMAR].familyId = ARELS;
    for (const [index, personId] of ['person-1-1', KELAN, NAMAR_KIN].entries()) state.prisoners.push({ id: `prisoner-${index + 1}`, personId, captorFamilyId: ARELS, since: state.date, ransom: 40, status: 'held', closedAt: null, reason: null });
  },
};
for (const [name, arrange] of Object.entries(SKIPS)) test(`${name} makes no demand and draws nothing`, () => {
  const state = base();
  arrange(state);
  exile(state, [ESHMUNS, SAFRAS]);
  assert.equal(opensAt(state, HIT), false);
  assert.equal(state.plotRngState, HIT);
});

test('the ruler\'s family and the controlled family make no demand', () => {
  const state = base({ mode: 'family', familyId: ESHMUNS });
  state.plotRngState = HIT;
  // Arel rules and Eshmun, first in id order after it, is controlled. canRule is forced, because a family that controls the crown without ruling needs a regency this test does not need.
  demandStep(state, [], { ...actionHooks(state), canRule: () => true });
  assert.deepEqual(state.familyDemands.map((demand) => demand.familyId), [NAMARS]);
});

test('the head\'s ambition picks a city or an office', () => {
  // Of the default three cities Namar's house holds as many as any house, so he has no city to want. Of five, Arel's house holds two and his one.
  assert.deepEqual(kindAndTarget(opened().demand), { kind: 'office', targetId: 'chancellor' });
  assert.deepEqual(kindAndTarget(opened({ cities: CITIES }).demand), { kind: 'city', targetId: 'city-0' });
});

test('the office target is the first seat the family does not hold', () => {
  const target = (holders) => {
    const state = base();
    for (const [officeId, holderId] of Object.entries(holders)) state.offices[officeId].holderId = holderId;
    stepAlone(state, NAMARS);
    return state.familyDemands[0]?.targetId ?? null;
  };
  assert.equal(target({}), 'chancellor');
  assert.equal(target({ chancellor: KELAN }), 'priest');
  assert.equal(target({ chancellor: KELAN, general: 'person-2-2' }), 'general');
});

test('the city target is the poorest city of another family, then the lowest id', () => {
  const state = base({ cities: CITIES });
  // City 1 is his own and the poorest. Cities 2 and 3 tie for the poorest left, listed so that only the id can pick city 2.
  state.cities['city-0'].baseRevenue = 30;
  state.cities['city-3'].baseRevenue = state.cities['city-2'].baseRevenue;
  state.cities = Object.fromEntries(Object.entries(state.cities).reverse());
  stepAlone(state, NAMARS);
  assert.deepEqual(kindAndTarget(state.familyDemands[0]), { kind: 'city', targetId: 'city-2' });
});

test('a demand opens a public story with a year to answer', () => {
  const { state, demand, story, events } = opened();
  assert.match(demand.id, /^demand-[1-9]\d*$/);
  assert.deepEqual(demand, { id: demand.id, familyId: NAMARS, kind: 'office', targetId: 'chancellor', storyId: story.id, openedAt: state.date, dueAt: addGameMonths(state.date, 12), status: 'open', closedAt: null });
  assert.equal(story.type, 'family_demand');
  assert.equal(story.status, 'open');
  assert.equal(story.title, 'Namar kräver Kansler');
  assert.equal(story.description, 'Namar av Hadara vill se familjen i Kansler. De andra husen ser vad du svarar.');
  assert.equal(story.actorId, NAMAR);
  assert.equal(story.knownBy, 'public');
  assert.equal(story.dueAt, demand.dueAt);
  assert.equal(story.demandId, demand.id);
  assert.equal(story.deadlineText, 'Utan svar räknas kravet som avvisat, och familjen tar det hårdare.');
  assert.deepEqual(events.map((event) => event.title), ['Namar kräver Kansler']);
  validateFamilyDemands(state);
});

test('the draws run in family id order and the first hit ends the step', () => {
  const first = base();
  first.plotRngState = HIT;
  demandStep(first, [], actionHooks(first));
  assert.deepEqual(first.familyDemands.map((demand) => demand.familyId), [ESHMUNS]);
  assert.equal(first.plotRngState, afterDraws(HIT, 1));

  const second = base(), missThenHit = streamWith((roll) => roll >= 99, (roll) => roll < 1);
  second.plotRngState = missThenHit;
  demandStep(second, [], actionHooks(second));
  assert.deepEqual(second.familyDemands.map((demand) => demand.familyId), [NAMARS]);
  assert.equal(second.plotRngState, afterDraws(missThenHit, 2));
});

const CHANCES = [
  ['the base at influence 45', () => {}, 34],
  ['ten more influence', (state) => { state.families[ESHMUNS].influence = 55; }, 44],
  ['an ambitious head', (state) => { state.people[ESHMUN].traits.push('ambitious'); }, 44],
  ['half the head\'s fear', (state) => { state.people[ESHMUN].fear = 20; }, 24],
  ['Svår', (state) => { state.difficulty = 'hard'; }, 51],
  ['Lätt', (state) => { state.difficulty = 'easy'; }, 17],
  ['the floor', (state) => { state.people[ESHMUN].fear = 100; }, 5],
  ['the ceiling', (state) => { state.families[ESHMUNS].influence = 100; }, 70],
  ['the ceiling after Svår', (state) => { state.families[ESHMUNS].influence = 65; state.difficulty = 'hard'; }, 70],
  ['the floor after Lätt', (state) => { state.people[ESHMUN].fear = 50; state.difficulty = 'easy'; }, 5],
];
for (const [name, arrange, chance] of CHANCES) test(`the chance is ${chance} with ${name}`, () => {
  const roll = (stream) => {
    const state = base();
    arrange(state);
    exile(state, [NAMARS, SAFRAS]);
    return opensAt(state, stream);
  };
  assert.equal(roll(within(chance - 1, chance)), true);
  assert.equal(roll(within(chance, chance + 1)), false);
});

test('the candidate is the free adult with the highest sum of skills, then the lowest id', () => {
  const pick = (arrange) => {
    const { state, story } = opened();
    arrange(state);
    return ok(answer(state, story, 'grant')).offices.chancellor.holderId;
  };
  const level = (state) => { for (const id of [NAMAR, 'person-1-1', KELAN, NAMAR_KIN]) state.people[id].skills = { command: 5, stewardship: 5, diplomacy: 5, learning: 5, intrigue: 5, prowess: 5 }; };
  assert.equal(pick(level), NAMAR);
  assert.equal(pick((state) => { level(state); state.people[NAMAR_KIN].skills.learning = 6; }), NAMAR_KIN);
  assert.equal(pick((state) => {
    level(state);
    state.people[NAMAR_KIN].skills.learning = 6;
    state.prisoners.push({ id: 'prisoner-1', personId: NAMAR_KIN, captorFamilyId: ARELS, since: state.date, ransom: 40, status: 'held', closedAt: null, reason: null });
  }), NAMAR);
});

test('granting a city moves it and angers the other houses', () => {
  const { state, story } = opened({ cities: CITIES });
  state.people[NAMAR_KIN].skills.learning += 40;
  const before = plain(state);
  const after = ok(answer(state, story, 'grant'));
  assert.equal(after.cities['city-0'].familyId, NAMARS);
  assert.equal(after.offices['governor-0'].holderId, NAMAR_KIN);
  assert.equal(after.offices['governor-0'].history.at(-1).reason, 'Familjen får sin vilja');
  // Namar: −4 at the start, +5 for the appointment, +8 for the grant. Arel loses the governor (−8) and pays the reaction (−6), like every other house.
  assert.deepEqual(grievances(after), { [ARELS]: -14, [NAMARS]: 9, [ESHMUNS]: -6, [SAFRAS]: -6 });
  assert.equal(opinion(after, ESHMUN) - opinion(before, ESHMUN), -8);
  assert.equal(opinion(after, SAFRA) - opinion(before, SAFRA), -8);
  assert.equal(after.familyDemands[0].status, 'granted');
  assert.equal(after.familyDemands[0].closedAt, state.date);
});

test('granting an office seats the candidate for one order and no silver', () => {
  const { state, story } = opened();
  state.people[NAMAR_KIN].skills.learning += 40;
  const before = plain(state);
  const after = ok(answer(state, story, 'grant'));
  assert.equal(after.offices.chancellor.holderId, NAMAR_KIN);
  // Eshmun loses the chancellor (−8) and pays the reaction (−6).
  assert.deepEqual(grievances(after), { [ARELS]: -6, [NAMARS]: 9, [ESHMUNS]: -14, [SAFRAS]: -6 });
  assert.equal(after.actionPoints, before.actionPoints - 1);
  assert.equal(after.realm.treasury, before.realm.treasury);
  assert.equal(after.familyDemands[0].status, 'granted');
  assert.equal(storyOf(after, story.id).status, 'resolved');
});

test('buying time costs 40 silver, an order and 3 of the head\'s opinion', () => {
  const { state, story } = opened();
  const before = plain(state);
  const after = ok(answer(state, story, 'compensate'));
  assert.equal(after.realm.treasury, before.realm.treasury - 40);
  assert.equal(after.actionPoints, before.actionPoints - 1);
  assert.equal(opinion(after, NAMAR) - opinion(before, NAMAR), -3);
  assert.deepEqual(grievances(after), grievances(before));
  assert.equal(after.familyDemands[0].status, 'compensated');
  assert.equal(after.familyDemands[0].closedAt, state.date);
});

test('a refusal costs the family 8, the head 12 and pleases the others by 1', () => {
  const { state, story } = opened();
  const before = plain(state);
  const after = ok(answer(state, story, 'refuse'));
  assert.deepEqual(grievances(after), { [ARELS]: 1, [NAMARS]: -12, [ESHMUNS]: 1, [SAFRAS]: 1 });
  assert.equal(opinion(after, NAMAR) - opinion(before, NAMAR), -12);
  assert.equal(after.actionPoints, before.actionPoints - 1);
  assert.equal(after.realm.treasury, before.realm.treasury);
  assert.equal(after.familyDemands[0].status, 'refused');
  assert.equal(after.familyDemands[0].closedAt, state.date);
});

for (const [traits, stress] of [[['dutiful'], 0], [[], 3]]) test(`each answer shows the ${stress} stress it charges`, () => {
  for (const choiceId of ['grant', 'compensate', 'refuse']) {
    const { state, story } = opened();
    state.people[AREL].traits = traits;
    state.people[AREL].stress = 10;
    assert.equal(choice(demandChoices(state, story, actionHooks(state)), choiceId).stress, String(stress));
    assert.equal(ok(answer(state, story, choiceId)).people[AREL].stress, 10 + stress);
  }
});

test('an answer the ruler cannot give shows why', () => {
  const { state, story } = opened();
  const hooks = actionHooks(state), enabled = demandChoices(state, story, hooks);
  assert.deepEqual(enabled.map((item) => [item.id, item.disabledReason]), [['grant', ''], ['compensate', ''], ['refuse', '']]);
  assert.deepEqual(enabled.map((item) => item.label), ['Bevilja kravet', 'Köp tid med silver', 'Avvisa kravet']);
  assert.equal(choice(demandChoices(state, story, { ...hooks, appointReason: () => 'Regenten säger nej.' }), 'grant').disabledReason, 'Regenten säger nej.');

  state.realm.treasury = 39;
  assert.equal(choice(demandChoices(state, story, hooks), 'compensate').disabledReason, 'Otillräcklig statskassa.');
  state.realm.treasury = 40;
  assert.equal(choice(demandChoices(state, story, hooks), 'compensate').disabledReason, '');

  state.actionPoints = 0;
  for (const id of ['grant', 'compensate', 'refuse']) assert.equal(choice(demandChoices(state, story, hooks), id).disabledReason, NO_ORDERS);
  assert.equal(answer(state, story, 'refuse').ok, false);

  state.actionPoints = 4;
  for (const id of ['grant', 'compensate', 'refuse']) assert.equal(choice(demandChoices(state, story, { ...hooks, canRule: () => false }), id).disabledReason, 'Kräver härskarmandat.');
});

test('the grant closes when the family has no free adult', () => {
  const { state, story } = opened();
  for (const [index, personId] of [NAMAR, 'person-1-1', KELAN, NAMAR_KIN].entries()) state.prisoners.push({ id: `prisoner-${index + 1}`, personId, captorFamilyId: ARELS, since: state.date, ransom: 40, status: 'held', closedAt: null, reason: null });
  const choices = demandChoices(state, story, actionHooks(state));
  assert.equal(choice(choices, 'grant').disabledReason, 'Familjen saknar en behörig kandidat till ämbetet.');
  assert.equal(choice(choices, 'refuse').disabledReason, '');
});

test('a granted demand spends the regent\'s one consent to an appointment', () => {
  const start = createCharacterSystem({ seed: 321 }), principal = start.people['person-0-4'], regent = start.people[AREL];
  principal.traits = ['dutiful']; regent.traits = ['ambitious']; regent.loyalty = 90;
  start.offices.ruler.holderId = principal.id; start.offices.ruler.regentId = regent.id; start.reign.rulerId = principal.id;
  start.realm.lawfulRulerId = principal.id;
  start.regencies['office:ruler'] = { id: 'office:ruler', principalId: principal.id, regentId: regent.id, phase: 'minority', startedAt: start.date, grants: [], requestAfter: {}, handoverDueAt: null };
  start.stories = [];
  delete start.mandateVersion; delete start.mandateActivatedAt; delete start.mandateSequence;
  const state = normalizeCharacterSystem(start);
  stepAlone(state, NAMARS);
  const story = state.stories.find((item) => item.type === 'family_demand');
  assert.match(choice(demandChoices(state, story, actionHooks(state)), 'grant').disabledReason, /samtycker/);
  const record = state.regencies['office:ruler'];
  record.grants.push(attachMandateGrant(record, { actionType: 'appoint', grantedAt: state.date, expiresAt: addGameMonths(state.date, 24), usedAt: null, approach: 'negotiate' }));
  const after = ok(answer(state, story, 'grant'));
  assert.equal(after.regencies['office:ruler'].grants[0].usedAt, state.date);
});

test('an ignored demand lapses on its date with a heavier penalty', () => {
  const { state, demand, story } = opened();
  const before = plain(state), events = [];
  state.date = addGameMonths(demand.dueAt, -1);
  refreshCourtStories(state, events, actionHooks(state));
  assert.equal(story.status, 'open');
  state.date = demand.dueAt;
  refreshCourtStories(state, events, actionHooks(state));
  assert.equal(demand.status, 'lapsed');
  assert.equal(demand.closedAt, demand.dueAt);
  assert.equal(story.status, 'resolved');
  assert.equal(story.choiceId, 'lapse');
  assert.deepEqual(events.map((event) => event.type), ['story_expired']);
  assert.deepEqual(grievances(state), { ...grievances(before), [NAMARS]: -14 });
  assert.equal(opinion(state, NAMAR) - opinion(before, NAMAR), -15);
  assert.equal(state.actionPoints, before.actionPoints);
  assert.equal(state.realm.treasury, before.realm.treasury);
});

test('a player cannot choose the lapse', () => {
  const { state, story } = opened();
  assert.equal(answer(state, story, 'lapse').error, 'Valet är inte giltigt.');
});

test('a year in one step and the same year in months end alike', () => {
  const { state, demand } = opened();
  const { revision: _wholeRevision, appliedCommandIds: _wholeCommands, ...whole } = advance(state, demand.dueAt);
  let split = state;
  for (let month = 1; month <= 12; month++) split = advance(split, addGameMonths(state.date, month));
  const { revision: _splitRevision, appliedCommandIds: _splitCommands, ...months } = split;
  assert.equal(whole.familyDemands[0].status, 'lapsed');
  assert.deepEqual(months, whole);
});

test('a refusal and a lapse each weigh on the ruler once, and the other answers not at all', () => {
  const pressure = (state, date) => {
    const before = state.people[AREL].stress;
    state.date = date;
    stressPressureStep(state, actionHooks(state));
    return state.people[AREL].stress - before;
  };
  const answered = (choiceId) => {
    const { state, story, demand } = opened();
    const after = ok(answer(state, story, choiceId));
    return [pressure(after, demand.dueAt), pressure(after, addGameMonths(demand.dueAt, 12))];
  };
  assert.deepEqual(answered('refuse'), [4, 0]);
  assert.deepEqual(answered('compensate'), [0, 0]);
  assert.deepEqual(answered('grant'), [0, 0]);

  const { state, demand } = opened();
  state.date = demand.dueAt;
  refreshCourtStories(state, [], actionHooks(state));
  assert.deepEqual([pressure(state, demand.dueAt), pressure(state, addGameMonths(demand.dueAt, 12))], [4, 0]);
});

test('demands stop under an NPC ruler', () => {
  const state = base({ mode: 'family', familyId: SAFRAS });
  assert.equal(actionHooks(state).canRule(), false);
  assert.equal(opensAt(state, HIT), false);
  assert.equal(state.plotRngState, HIT);
  assert.deepEqual(advance(state, state.nextAnnualDate).familyDemands, []);
});

test('the 24-month rule holds', () => {
  const { state, story } = opened();
  const answered = ok(answer(state, story, 'refuse'));
  for (const [months, opens] of [[12, false], [23, false], [24, true]]) {
    const later = plain(answered);
    later.date = addGameMonths(answered.date, months);
    stepAlone(later, NAMARS);
    assert.equal(later.familyDemands.length, opens ? 2 : 1, `${months} months`);
    assert.equal(later.plotRngState, opens ? afterDraws(HIT, 1) : HIT, `${months} months`);
  }
});

test('an open demand keeps its family from a second one', () => {
  const { state } = opened();
  state.date = addGameMonths(state.date, 30);
  stepAlone(state, NAMARS);
  assert.equal(state.familyDemands.length, 1);
  assert.equal(state.plotRngState, HIT);
});

test('Svår opens demands sooner than Lätt at a found seed', () => {
  const firstDemandYear = (difficulty) => {
    let state = base({ seed: 321 });
    state.difficulty = difficulty;
    for (let year = 1; year <= 10; year++) {
      state = advance(state, state.nextAnnualDate);
      if (state.familyDemands.length) return year;
    }
    return null;
  };
  assert.equal(firstDemandYear('hard'), 1);
  assert.equal(firstDemandYear('easy'), 2);
});

test('an accession voids open demands and closes their stories', () => {
  const { state, demand, story } = opened();
  actionHooks(state).crown(state.people[HEIR], [], 'Ett prov', 55, true);
  assert.equal(demand.status, 'void');
  assert.equal(demand.closedAt, state.date);
  assert.equal(story.status, 'closed');
  assert.equal(story.resolvedAt, state.date);
  assert.ok(story.resolution);
  // The year turn reads closedAt of every closed demand, and the save loads.
  const later = advance(state, state.nextAnnualDate);
  normalizeCharacterSystem(plain(later));
});

test('voiding leaves answered demands alone', () => {
  const { state, story } = opened();
  const answered = ok(answer(state, story, 'refuse'));
  voidOpenDemands(answered);
  assert.equal(answered.familyDemands[0].status, 'refused');
});

test('a demand whose head dies goes void', () => {
  const { state, story } = opened();
  actionHooks(state).kill([NAMAR], [], 'Ett prov');
  const after = advance(state, addGameMonths(state.date, 1));
  // A death refreshes the stories at once, so the demand falls on the day of the death.
  assert.deepEqual(after.familyDemands.map(({ status, closedAt }) => ({ status, closedAt })), [{ status: 'void', closedAt: state.date }]);
  assert.equal(storyOf(after, story.id).status, 'closed');
  normalizeCharacterSystem(plain(after));
});

test('a demand whose family leaves the realm goes void', () => {
  const { state, story } = opened();
  state.families[NAMARS].exiled = true;
  const before = plain(state);
  const after = advance(state, addGameMonths(state.date, 1));
  assert.equal(after.familyDemands[0].status, 'void');
  assert.equal(after.familyDemands[0].closedAt, after.date);
  assert.equal(storyOf(after, story.id).status, 'closed');
  assert.equal(after.families[NAMARS].grievance, before.families[NAMARS].grievance);
});

test('a demand the family got some other way goes void and costs nothing', () => {
  const { state, story } = opened();
  const after = ok(command(state, 'appoint', { officeId: 'chancellor', personId: KELAN }));
  assert.equal(after.familyDemands[0].status, 'void');
  assert.equal(storyOf(after, story.id).status, 'closed');
  const city = opened({ cities: CITIES });
  const moved = ok(command(city.state, 'appoint', { officeId: 'governor-0', personId: KELAN }));
  assert.equal(moved.familyDemands[0].status, 'void');
});

test('a player appointment that tilts the seats angers the others and an automatic one does not', () => {
  const tilted = () => { const state = base(); state.offices.chancellor.holderId = KELAN; return state; };
  const player = tilted(), before = plain(player);
  const after = ok(command(player, 'appoint', { officeId: 'spymaster', personId: NAMAR_KIN }));
  // Namar now holds four seats and every other house one. Namar gains 5 from the appointment alone.
  assert.deepEqual(grievances(after), { [ARELS]: -4, [NAMARS]: 1, [ESHMUNS]: -4, [SAFRAS]: -4 });
  assert.equal(opinion(after, ESHMUN) - opinion(before, ESHMUN), -5);
  assert.equal(opinion(after, SAFRA) - opinion(before, SAFRA), -5);
  assert.ok(actionHooks(after).opinionReasons(SAFRA, AREL).some((reason) => reason.label === 'Gynnande av Namar' && reason.value === -5));

  const automatic = tilted();
  actionHooks(automatic).assignOffice(automatic.offices.spymaster, automatic.people[NAMAR_KIN], [], 'Rikets ledning fyller ett vakant ämbete');
  assert.deepEqual(grievances(automatic), { ...grievances(before), [NAMARS]: 1 });
});

test('a family one seat ahead angers nobody and two seats ahead angers that house', () => {
  const state = base();
  const after = ok(command(state, 'appoint', { officeId: 'spymaster', personId: NAMAR_KIN }));
  // Namar three seats, Eshmun two, Arel and Safra one.
  assert.deepEqual(grievances(after), { [ARELS]: -4, [NAMARS]: 1, [ESHMUNS]: 0, [SAFRAS]: -4 });
});

test('a dismissal is no favour', () => {
  const state = base();
  for (const officeId of ['chancellor', 'priest']) state.offices[officeId].holderId = KELAN;
  const after = ok(command(state, 'dismiss', { officeId: 'priest' }));
  // Namar still stands two seats ahead of Arel, Eshmun and Safra, and pays 8 for the lost seat.
  assert.deepEqual(grievances(after), { [ARELS]: 0, [NAMARS]: -12, [ESHMUNS]: 0, [SAFRAS]: 0 });
});

test('the reaction passes over exiled houses and counts the ruler\'s seat for nobody', () => {
  const state = base(), before = plain(state);
  state.offices.chancellor.holderId = KELAN;
  state.families[SAFRAS].exiled = true;
  seatReaction(state, state.families[NAMARS], [], actionHooks(state));
  // Namar three seats, Eshmun one, Arel one: with the ruler's seat Arel would stand one behind and stay calm.
  assert.deepEqual(grievances(state), { ...grievances(before), [ARELS]: -4, [ESHMUNS]: -4 });
  assert.equal(opinion(state, SAFRA), opinion(before, SAFRA));
});

test('the reaction under force reaches every other house in the realm', () => {
  const state = base(), before = plain(state), events = [];
  state.families[SAFRAS].exiled = true;
  seatReaction(state, state.families[NAMARS], events, actionHooks(state), { force: true });
  assert.deepEqual(grievances(state), { ...grievances(before), [ARELS]: -6, [ESHMUNS]: -6 });
  assert.equal(opinion(state, ESHMUN) - opinion(before, ESHMUN), -8);
  assert.deepEqual(events.map((event) => event.title), ['Gynnande av Namar']);
});

test('a reaction nobody feels leaves no trace', () => {
  const state = base(), before = plain(state), events = [];
  seatReaction(state, state.families[NAMARS], events, actionHooks(state));
  assert.deepEqual(state, before);
  assert.deepEqual(events, []);
});

test('the court lists the open demands and the last six closed, and reading spends nothing', () => {
  const { state, demand } = opened();
  assert.deepEqual(presentDemands(state), [{ id: demand.id, familyName: 'Namar', kindLabel: 'Ämbete', targetName: 'Kansler', statusLabel: 'Obesvarat', dueAt: demand.dueAt }]);
  const before = plain(state);
  assert.deepEqual(getCharacterPresentation(state).court.demands, presentDemands(state));
  assert.deepEqual(state, before);

  const closed = ['granted', 'compensated', 'refused', 'lapsed', 'void', 'refused', 'lapsed', 'void'];
  const older = closed.map((status, index) => ({ ...demand, id: `demand-${index + 900}`, status, closedAt: state.date }));
  state.familyDemands = [...older, demand];
  const rows = presentDemands(state);
  assert.deepEqual(rows.map((row) => row.id), [demand.id, 'demand-902', 'demand-903', 'demand-904', 'demand-905', 'demand-906', 'demand-907']);
  assert.deepEqual(rows.map((row) => row.statusLabel), ['Obesvarat', 'Avvisat', 'Förfallet', 'Bortfallet', 'Avvisat', 'Förfallet', 'Bortfallet']);
});

test('a city demand presents the city', () => {
  const { state, demand } = opened({ cities: CITIES });
  assert.deepEqual(presentDemands(state), [{ id: demand.id, familyName: 'Namar', kindLabel: 'Stad', targetName: 'Ake', statusLabel: 'Obesvarat', dueAt: demand.dueAt }]);
  assert.equal(state.stories.at(-1).title, 'Namar kräver Ake');
});

const FORGERIES = {
  'a malformed id': (demand, state) => { demand.id = 'demand-x'; state.stories.at(-1).demandId = demand.id; },
  'an id past the sequence': (demand, state) => { demand.id = `demand-${state.sequence + 1}`; state.stories.at(-1).demandId = demand.id; },
  'a field too many': (demand) => { demand.loyalty = 90; },
  'a field too few': (demand) => { delete demand.closedAt; },
  'a family that does not exist': (demand) => { demand.familyId = 'family-nobody'; },
  'an inherited family name': (demand) => { demand.familyId = 'constructor'; },
  'an unknown kind': (demand) => { demand.kind = 'throne'; },
  'the ruler\'s office': (demand) => { demand.targetId = 'ruler'; },
  'a city under the office kind': (demand) => { demand.targetId = 'city-0'; },
  'an office under the city kind': (demand) => { demand.kind = 'city'; demand.targetId = 'chancellor'; },
  'an unknown status': (demand) => { demand.status = 'forgotten'; },
  'an open demand with a closing date': (demand) => { demand.closedAt = demand.openedAt; },
  'a closed demand with no date': (demand, state) => { demand.status = 'void'; state.stories.at(-1).status = 'closed'; },
  'a closing date before the opening': (demand, state) => { demand.status = 'void'; demand.closedAt = addGameMonths(demand.openedAt, -1); state.stories.at(-1).status = 'closed'; },
  'a closing date in the future': (demand, state) => { demand.status = 'void'; demand.closedAt = addGameMonths(state.date, 1); state.stories.at(-1).status = 'closed'; },
  'an opening date in the future': (demand, state) => { demand.openedAt = addGameMonths(demand.openedAt, 1); demand.dueAt = addGameMonths(demand.dueAt, 1); state.stories.at(-1).dueAt = demand.dueAt; },
  'a malformed date': (demand) => { demand.openedAt = 'yesterday'; },
  'a due date off the term': (demand, state) => { demand.dueAt = addGameMonths(demand.dueAt, 1); state.stories.at(-1).dueAt = demand.dueAt; },
  'a story that does not exist': (demand) => { demand.storyId = 'story-nobody'; },
  'a story of another type': (demand, state) => { state.stories.at(-1).type = 'coup'; },
  'a story that names another demand': (demand, state) => { state.stories.at(-1).demandId = 'demand-1'; },
  'a story due on another date': (demand, state) => { state.stories.at(-1).dueAt = addGameMonths(demand.dueAt, 12); },
  'a closed demand with an open story': (demand) => { demand.status = 'refused'; demand.closedAt = demand.openedAt; },
  'an open demand with a closed story': (demand, state) => { state.stories.at(-1).status = 'closed'; },
  'a second open demand in one family': (demand, state) => {
    const id = `demand-${++state.sequence}`, storyId = `story-${++state.sequence}`;
    state.stories.push({ ...state.stories.at(-1), id: storyId, demandId: id });
    state.familyDemands.push({ ...demand, id, storyId });
  },
  'a repeated id': (demand, state) => { state.familyDemands.push({ ...demand }); },
  'a list of something else': (demand, state) => { state.familyDemands[0] = 'demand'; },
  'an empty slot in the list': (demand, state) => { state.familyDemands[0] = null; },
  'a demand story with no record': (demand, state) => { state.familyDemands = []; },
};
for (const [name, forge] of Object.entries(FORGERIES)) test(`forged demand records are rejected: ${name}`, () => {
  const { state, demand } = opened();
  forge(demand, state);
  assert.throws(() => validateFamilyDemands(state), { name: 'Error', message: FORGED });
  assert.throws(() => normalizeCharacterSystem(plain(state)), { name: 'Error', message: FORGED });
});

test('every demand the engine writes loads again', () => {
  for (const choiceId of ['grant', 'compensate', 'refuse']) {
    const { state, story } = opened({ cities: CITIES });
    normalizeCharacterSystem(plain(state));
    normalizeCharacterSystem(plain(ok(answer(state, story, choiceId))));
  }
  const lapsed = opened(), { state, demand } = lapsed;
  normalizeCharacterSystem(plain(advance(state, demand.dueAt)));
});

test('a demand does not survive a dissolved realm in family mode', () => {
  const { state, demand, story } = opened({ mode: 'family', familyId: ARELS });
  const after = ok(applyRealmDissolution(state, { id: 'dissolve-demand', date: state.date, reason: 'Riket faller.', hostCandidates: [] }));
  assert.equal(storyOf(after, story.id).status, 'closed');
  assert.deepEqual(after.familyDemands.map(({ status, closedAt }) => ({ status, closedAt })), [{ status: 'void', closedAt: state.date }]);
  normalizeCharacterSystem(plain(after));
  const later = advance(after, demand.dueAt);
  assert.equal(later.familyDemands[0].status, 'void');
  assert.equal(later.families[NAMARS].grievance, after.families[NAMARS].grievance);
});

test('a breakdown does not survive a dissolved realm in family mode', () => {
  const state = base({ mode: 'family', familyId: ARELS });
  state.people[AREL].stress = 100;
  breakdownStep(state, [], actionHooks(state));
  const story = state.stories.find((item) => item.type === 'stress_breakdown');
  assert.equal(story.status, 'open');
  const after = ok(applyRealmDissolution(state, { id: 'dissolve-breakdown', date: state.date, reason: 'Riket faller.', hostCandidates: [] }));
  assert.equal(storyOf(after, story.id).status, 'closed');
  assert.equal(storyOf(after, story.id).resolvedAt, state.date);
  const later = advance(after, story.dueAt);
  assert.equal(storyOf(later, story.id).status, 'closed');
  assert.notEqual(storyOf(later, story.id).choiceId, 'collapse');
});

test('the court step opens the demand after the name of the year and before a breakdown', () => {
  const state = base();
  exile(state, [ESHMUNS, SAFRAS]);
  state.plotRngState = HIT;
  state.people[AREL].stress = 100;
  state.realm.prestige = 50;
  state.date = addGameMonths(state.date, 24);
  const events = [];
  courtAnnualStep(state, events, actionHooks(state));
  assert.deepEqual(events.map((event) => event.type), ['nickname', 'family_demand', 'stress_breakdown']);
});
