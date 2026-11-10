// Foreign realms live beside the court. Spec: docs/superpowers/specs/2026-11-10-foreign-realms-design.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHistoricalCharacterSystem } from './scenarioSeed.js';
import { advanceCharacters, getCharacterPresentation, normalizeCharacterSystem } from './index.js';
import { FOREIGN, foreignHeir, foreignOpinion, foreignRealmStep } from './foreignRealms.js';
import { courtAnnualStep } from './court.js';
import { addGameMonths } from '../gameDates.js';

const plain = (value) => JSON.parse(JSON.stringify(value));
const DATA = JSON.parse(readFileSync(new URL('../../../server/seed/historical/charlemagne-800/scenario.json', import.meta.url), 'utf8')).data;
const streams = (s) => [s.rngState, s.actionRngState, s.plotRngState, s.lineageRngState, s.healthRngState];
const realmOf = (state, id) => state.foreignRealms.find((realm) => realm.id === id);
function court() {
  return createHistoricalCharacterSystem({ historicalScenario: plain(DATA.world.historicalScenario), date: DATA.game.startDate, polityId: 'carolingian-realm', mode: 'realm', seed: 777 });
}
// The yearly step on its own, with a log that keeps what it is given.
function years(state, count) {
  const events = [], hooks = { logEvent: (list, type, title, description) => list.push({ type, title, description }) };
  for (let i = 0; i < count; i++) { state.date = addGameMonths(state.date, 12); foreignRealmStep(state, events, hooks); }
  return events;
}

test('a historical court starts with the eight nearest courts of its package, ruling families only', () => {
  const state = court();
  assert.deepEqual(state.foreignRealms.map((realm) => realm.id), ['papal-states', 'kingdom-of-asturias', 'duchy-of-benevento', 'emirate-of-cordoba',
    'aghlabid-emirate', 'byzantine-empire', 'abbasid-caliphate', 'tang-empire']);
  const rome = realmOf(state, 'papal-states');
  assert.deepEqual({ seat: rome.seatName, near: rome.distanceKm > 1000 && rome.distanceKm < 1200, ruler: rome.people[rome.rulerId].name }, { seat: 'Rom', near: true, ruler: 'Leo III' });
  const abbasid = realmOf(state, 'abbasid-caliphate');
  assert.deepEqual(Object.keys(abbasid.people), ['harun-ar-rashid', 'zubayda-bint-jafar', 'muhammad-al-amin', 'abdallah-al-mamun', 'muhammad-abu-ishaq']);
  assert.ok(state.foreignRealms.every((realm) => Object.values(realm.people).every((person) => person.origin === 'documented')));
  assert.ok(!Object.keys(state.people).some((id) => id === 'leo-iii'), 'foreign people stay out of the court');
  const shown = getCharacterPresentation(state).foreignRealms;
  assert.deepEqual(shown[0], { id: 'papal-states', name: rome.name, seatName: 'Rom', distanceKm: rome.distanceKm, neighbor: true, rulerName: 'Leo III', rulerAge: 50, heirName: null, opinion: 0 });
  assert.equal(shown.at(-1).neighbor, false);
});

test('the heir follows the law: a son under primogeniture, the eldest adult man under merit', () => {
  const state = court();
  const cordoba = realmOf(state, 'emirate-of-cordoba'), abbasid = realmOf(state, 'abbasid-caliphate');
  assert.equal(foreignHeir(cordoba, cordoba.people['al-hakam-i'], state.date).id, 'abd-al-rahman-ii');
  assert.equal(foreignHeir(abbasid, abbasid.people['harun-ar-rashid'], state.date), null, 'no son is sixteen in 800');
  assert.equal(foreignHeir(abbasid, abbasid.people['harun-ar-rashid'], addGameMonths(state.date, 120)).id, 'abdallah-al-mamun');
  const rome = realmOf(state, 'papal-states');
  assert.equal(foreignHeir(rome, rome.people['leo-iii'], state.date), null);
});

test('foreign realms age, marry, bear children and pass the crown without drawing from a stream', () => {
  const state = court(), before = streams(state);
  const events = years(state, 80);
  assert.deepEqual(streams(state), before);
  assert.ok(events.some((event) => event.type === 'foreign_succession' && event.title.endsWith('tar makten i Kyrkostaten')));
  for (const realm of state.foreignRealms) {
    assert.equal(realm.people[realm.rulerId].diedAt, null, `${realm.id} has a living ruler`);
    assert.ok(Object.keys(realm.people).length <= FOREIGN.peopleLimit);
    for (const person of Object.values(realm.people)) assert.ok(!/till .* till /.test(person.name), `the name ${person.name} does not nest`);
  }
  const people = state.foreignRealms.flatMap((realm) => Object.values(realm.people));
  assert.ok(people.some((person) => /^(Dotter|Son) /.test(person.name)), 'children are born');
  assert.ok(people.some((person) => person.name.startsWith('Gemål ')), 'rulers marry');
  const again = court();
  years(again, 80);
  assert.deepEqual(again.foreignRealms, state.foreignRealms, 'the same campaign lives the same foreign years');
});

test('the yearly court step runs the foreign realms, and the save survives a long campaign', () => {
  const start = court();
  const result = advanceCharacters(start, addGameMonths(start.date, 12 * 30), { id: 'thirty-years' });
  assert.equal(result.ok, true, result.error);
  assert.notDeepEqual(result.state.foreignRealms, start.foreignRealms);
  assert.deepEqual(normalizeCharacterSystem(plain(result.state)).foreignRealms, result.state.foreignRealms);
});

test('opinion sums the live memories and is held to a hundred', () => {
  const state = court(), rome = realmOf(state, 'papal-states');
  rome.memories.push({ date: state.date, label: 'Svek', amount: -30, until: addGameMonths(state.date, 240) });
  rome.memories.push({ date: state.date, label: 'Gammal gåva', amount: 50, until: state.date });
  assert.equal(foreignOpinion(state, 'papal-states'), -30);
  rome.memories.push({ date: state.date, label: 'Allians', amount: 200, until: addGameMonths(state.date, 12) });
  assert.equal(foreignOpinion(state, 'papal-states'), 100);
  assert.equal(foreignOpinion(state, 'nowhere'), 0);
  normalizeCharacterSystem(plain(state));
});

test('saves: an older historical save gains an empty list, Hadara refuses one, and a broken realm is refused', () => {
  const old = plain(court());
  delete old.foreignRealms;
  assert.deepEqual(normalizeCharacterSystem(old).foreignRealms, []);
  const hadara = plain(court());
  delete hadara.historicalOrigin;
  assert.throws(() => normalizeCharacterSystem(hadara), /grannriken/);
  delete hadara.foreignRealms;
  assert.equal(Object.hasOwn(normalizeCharacterSystem(hadara), 'foreignRealms'), false);
  assert.equal(getCharacterPresentation(normalizeCharacterSystem(hadara)).foreignRealms, undefined);
  const broken = plain(court());
  broken.foreignRealms[0].rulerId = 'nobody';
  assert.throws(() => normalizeCharacterSystem(broken), /grannriken/);
  const seat = plain(court());
  seat.foreignRealms[0].seatName = { name: 'Rom' };
  assert.throws(() => normalizeCharacterSystem(seat), /grannriken/);
  const reused = plain(court()), rome = reused.foreignRealms[0];
  rome.people[`${rome.id}-born-3`] = { ...rome.people[rome.rulerId], id: `${rome.id}-born-3` };
  assert.throws(() => normalizeCharacterSystem(reused), /grannriken/, 'a born id ahead of the counter would be overwritten');
});

test('a court whose ruler is generated still seeds a realm with that ruler', () => {
  const scenario = plain(DATA.world.historicalScenario), rome = scenario.courtSeeds['papal-states'];
  rome.rulerId = 'generated-courtier-1';
  const state = createHistoricalCharacterSystem({ historicalScenario: scenario, date: DATA.game.startDate, polityId: 'carolingian-realm', mode: 'realm', seed: 777 });
  const realm = realmOf(state, 'papal-states');
  assert.equal(realm.people[realm.rulerId].origin, 'generated');
  normalizeCharacterSystem(plain(state));
});

test('the neighbors live on after the realm of the player falls', () => {
  const state = court(), rome = realmOf(state, 'papal-states');
  state.realm.alive = false;
  const ruler = rome.people[rome.rulerId];
  for (let i = 0; i < 80 && rome.people[rome.rulerId] === ruler; i++) { state.date = addGameMonths(state.date, 12); courtAnnualStep(state, [], { logEvent: () => {} }); }
  assert.notEqual(rome.rulerId, 'leo-iii');
});
