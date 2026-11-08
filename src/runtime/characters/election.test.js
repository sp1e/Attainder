import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createHistoricalCharacterSystem } from './scenarioSeed.js';
import { actionHooks, advanceCharacters, createCharacterSystem, executeCharacterCommand, getCharacterAge, getCharacterPresentation, getSuccessionForecast, normalizeCharacterSystem } from './index.js';
import { ARCHETYPES, SKILL_LABELS } from './content.js';
import { ELECTION_REASON_SV, electOutsider, electiveCandidates, generatedAdultRecord, markGeneratedOrigin, nextSuccessionLaw } from './election.js';
import { addGameMonths } from '../gameDates.js';

const clone = value => JSON.parse(JSON.stringify(value));
const load = id => JSON.parse(readFileSync(new URL(`../../../server/seed/historical/${id}/scenario.json`, import.meta.url), 'utf8')).data;
const start = (folder, polityId, law, { seed = 321, date } = {}) => {
  const data = load(folder), h = clone(data.world.historicalScenario);
  if (law) h.courtSeeds[polityId].successionLaw = law;
  return createHistoricalCharacterSystem({ historicalScenario: h, date: date ?? data.game.startDate, polityId, mode: 'realm', seed });
};
const inca = (law = 'elective') => start('world-1500', 'inca-empire', law);
const papal = (law = 'elective', options) => start('charlemagne-800', 'papal-states', law, options);
const kill = (state, ids) => { actionHooks(state).kill(ids, [], 'Prov'); return state; };
const courtiers = ['generated-courtier-1', 'generated-courtier-2', 'generated-courtier-3'];
const candidateIds = state => getCharacterPresentation(state).succession.candidates.map(c => c.id);
const ok = result => { assert.equal(result.ok, true, result.error); return result.state; };
const command = (state, type, id) => executeCharacterCommand(state, { id, expectedRevision: state.revision, type });

test('elective ranking puts adult kin first, kin minors second and married-in persons with outsiders last', () => {
  const state = inca();
  state.date = '1510-01-01';
  assert.equal(getSuccessionForecast(state).expectedRuler.id, 'huascar');
  const expected = ['huascar', 'araua-ocllo', ...courtiers];
  assert.deepEqual(candidateIds(state), expected);
  assert.deepEqual(candidateIds(inca()), expected);
  // Probe court: one adult kinsman, one kin minor, one minor of an outside family.
  const probe = inca(), base = probe.people.huascar;
  probe.people['probe-kinsman'] = { ...clone(base), id: 'probe-kinsman', bornAt: '1475-01-01', legalParentIds: [] };
  probe.people['probe-outside-minor'] = { ...clone(base), id: 'probe-outside-minor', familyId: 'generated-house-1', bornAt: '1494-01-01', legalParentIds: [] };
  const people = Object.values(probe.people).filter(p => p.id !== 'huayna-capac');
  const ids = electiveCandidates(probe, probe.people['huayna-capac'], people, () => 0).map(p => p.id);
  assert.deepEqual(ids.slice(0, 2), ['probe-kinsman', 'huascar']);
  assert.ok(!ids.includes('probe-outside-minor'));
});

test("the old ruler's children in their mother's house rank as kin, and their mother stands with the outsiders", () => {
  const probe = inca(), base = probe.people.huascar;
  const outside = (id, bornAt, legalParentIds) => ({ ...clone(base), id, familyId: 'generated-house-1', bornAt, legalParentIds });
  probe.people['probe-mother'] = outside('probe-mother', '1470-01-01', []);
  probe.people['probe-son'] = outside('probe-son', '1480-01-01', ['huayna-capac', 'probe-mother']);
  probe.people['probe-daughter'] = outside('probe-daughter', '1495-01-01', ['huayna-capac', 'probe-mother']);
  const people = Object.values(probe.people).filter(p => p.id !== 'huayna-capac');
  const ids = electiveCandidates(probe, probe.people['huayna-capac'], people, () => 0).map(p => p.id);
  assert.deepEqual(ids, ['probe-son', 'huascar', 'probe-daughter', 'araua-ocllo', ...courtiers, 'probe-mother']);
});

test("the ruler's adoption of his nephew leaves the nephew's father among the kin", () => {
  let state = inca();
  state.date = '1510-01-01';
  const base = state.people.huascar;
  state.people['probe-brother'] = { ...clone(base), id: 'probe-brother', bornAt: '1460-01-01', legalParentIds: [], skills: { ...base.skills, diplomacy: 20, stewardship: 20 } };
  state.people['probe-nephew'] = { ...clone(base), id: 'probe-nephew', bornAt: '1505-01-01', legalParentIds: ['probe-brother'] };
  assert.equal(candidateIds(state)[0], 'probe-brother');
  state = ok(executeCharacterCommand(state, { id: 'adopt-nephew', expectedRevision: state.revision, type: 'adopt', payload: { childId: 'probe-nephew' } }));
  assert.deepEqual(state.people['probe-nephew'].legalParentIds, ['probe-brother', 'huayna-capac']);
  assert.deepEqual(candidateIds(state).slice(0, 3), ['probe-brother', 'huascar', 'probe-nephew']);
});

test("Huayna Capac's successor is not Araua Ocllo once Huáscar is adult", () => {
  const state = inca();
  state.date = '1510-01-01';
  kill(state, ['huayna-capac']);
  assert.equal(state.offices.ruler.holderId, 'huascar');
});

test('at the bookmark the elected Inca successor is Huáscar under a regency', () => {
  const state = inca();
  assert.equal(state.date, '1500-12-31');
  assert.equal(getSuccessionForecast(state).expectedRuler.id, 'huascar');
  assert.equal(state.realm.legalHeirId, 'huascar');
  kill(state, ['huayna-capac']);
  assert.equal(state.offices.ruler.holderId, 'huascar');
  const regent = state.people[state.offices.ruler.regentId];
  assert.ok(regent && !regent.diedAt && getCharacterAge(regent, state.date) >= 18);
});

test('a death with no adult creates one generated electee and keeps the realm', () => {
  const state = papal();
  const before = new Set(Object.keys(state.people));
  kill(state, [...courtiers, 'leo-iii']);
  const added = Object.keys(state.people).filter(id => !before.has(id));
  assert.equal(added.length, 1);
  const electee = state.people[added[0]];
  assert.equal(electee.name, 'Vald härskare 1 (genererad)');
  assert.equal(electee.originLabelSv, 'Genererad person');
  assert.equal(electee.identityOrigin, 'generated');
  assert.equal(getCharacterAge(electee, state.date), 40);
  assert.deepEqual(electee.skills, Object.fromEntries(Object.keys(SKILL_LABELS).map(key => [key, 5])));
  assert.equal(state.families[electee.familyId].name, 'Valt hus 1 (genererat)');
  assert.equal(state.families[electee.familyId].headId, electee.id);
  assert.equal(state.offices.ruler.holderId, electee.id);
  assert.equal(state.realm.alive, true);
  assert.equal(state.status.ended, false);
  assert.equal(state.offices.ruler.history.at(-1).reason, 'Valet föll på en person utanför hovet');
  assert.equal(ELECTION_REASON_SV, 'Valet föll på en person utanför hovet');
  const successions = state.log.filter(e => e.type === 'succession');
  assert.equal(successions.length, 1);
  assert.equal(successions[0].title, 'Vald härskare 1 (genererad) tillträder');
  assert.deepEqual(normalizeCharacterSystem(clone(state)), state);
});

test('an election writes no legal succession from the dead ruler to himself', () => {
  const state = kill(papal(), [...courtiers, 'leo-iii']);
  const history = state.realm.claimHistory;
  assert.ok(!history.some(entry => entry.type === 'legal_succession' && entry.fromId === entry.toId), JSON.stringify(history));
  assert.equal(history.at(-1).type, 'lawful_accession');
  assert.equal(history.at(-1).toId, state.offices.ruler.holderId);
});

test('a second election numbers the house 2', () => {
  const state = kill(papal(), [...courtiers, 'leo-iii']);
  kill(state, [state.offices.ruler.holderId]);
  const holder = state.people[state.offices.ruler.holderId];
  assert.equal(holder.name, 'Vald härskare 2 (genererad)');
  assert.equal(state.families[holder.familyId].name, 'Valt hus 2 (genererat)');
});

test('primogeniture and merit still end the realm', () => {
  for (const law of ['primogeniture', 'merit']) {
    const state = papal(law);
    const count = Object.keys(state.people).length;
    kill(state, [...courtiers, 'leo-iii']);
    assert.equal(state.offices.ruler.holderId, null, law);
    assert.equal(state.realm.alive, false, law);
    assert.equal(state.status.ended, true, law);
    assert.equal(Object.keys(state.people).length, count, law);
  }
});

test('the forecast reports an election from outside and creates nobody', () => {
  const state = kill(papal(), courtiers);
  const before = JSON.stringify(state);
  const forecast = getSuccessionForecast(state);
  assert.equal(JSON.stringify(state), before);
  assert.equal(forecast.electionFromOutside, true);
  assert.equal(forecast.status, 'no-successor');
  assert.equal(forecast.authority, 'Ingen vuxen vid hovet är behörig. Valet faller på en genererad person utanför hovet.');
  assert.equal(state.realm.legalHeirId, null);
  assert.equal(getSuccessionForecast(kill(papal('merit'), courtiers)).electionFromOutside, false);
});

test('abdication with an empty elective court still refuses', () => {
  const state = kill(papal(), courtiers);
  const count = Object.keys(state.people).length;
  const result = command(state, 'abdicate', 'abdicate-empty');
  assert.equal(result.ok, false);
  assert.equal(result.error, 'Det finns ingen giltig efterträdare.');
  assert.equal(Object.keys(result.state.people).length, count);
});

test('the legislator cycles three laws', () => {
  assert.equal(nextSuccessionLaw('primogeniture'), 'merit');
  assert.equal(nextSuccessionLaw('merit'), 'elective');
  assert.equal(nextSuccessionLaw('elective'), 'primogeniture');
  assert.equal(nextSuccessionLaw('tanistry'), 'primogeniture');
  let state = papal('merit');
  state.people['leo-iii'].archetype = 'legislator';
  const laws = [];
  for (const n of [1, 2, 3]) {
    state = ok(command(state, 'succession_law', `law-${n}`));
    laws.push(state.realm.successionLaw);
    // The ability has a yearly cooldown and costs an order; reset both to test the cycle alone.
    state.people['leo-iii'].cooldowns = {}; state.actionPoints = 4; state.realm.treasury = 500;
  }
  assert.deepEqual(laws, ['elective', 'primogeniture', 'merit']);
  assert.equal(ARCHETYPES.legislator.description, 'Byt tronföljd i ordningen förstfödslorätt, förtjänst och val. Familjerna reagerar.');
});

test('the heir claim names the law in Swedish', () => {
  const state = inca();
  const heirClaims = Object.values(state.families).flatMap(f => f.claims).filter(c => c.kind === 'heir' && c.status === 'active');
  assert.ok(heirClaims.length && heirClaims.every(c => c.origin.endsWith('enligt val')));
});

test('the election draws nothing', () => {
  const run = law => {
    const state = papal(law, { seed: 7 });
    return ok(advanceCharacters(state, addGameMonths(state.date, 12)));
  };
  const merit = run('merit'), elective = run('elective');
  assert.equal(merit.people['leo-iii'].diedAt, null);
  assert.equal(elective.people['leo-iii'].diedAt, null);
  assert.equal(elective.rngState, merit.rngState);
  assert.equal(JSON.stringify(elective.people), JSON.stringify(merit.people));
});

test('the election kill and the electee draw nothing', () => {
  const streams = state => ({ rng: state.rngState, health: state.healthRngState, action: state.actionRngState, plot: state.plotRngState });
  const elective = kill(papal('elective', { seed: 7 }), [...courtiers, 'leo-iii']);
  const merit = kill(papal('merit', { seed: 7 }), [...courtiers, 'leo-iii']);
  assert.equal(elective.people[elective.offices.ruler.holderId].name, 'Vald härskare 1 (genererad)');
  assert.equal(merit.realm.alive, false);
  assert.deepEqual(streams(elective), streams(merit));
  const state = papal('elective', { seed: 7 }), before = streams(state);
  assert.equal(typeof before.rng, 'number');
  electOutsider(state, state.people['leo-iii']);
  assert.deepEqual(streams(state), before);
});

test('realm kind', () => {
  assert.equal(createCharacterSystem().realm.kind, 'state');
  const data = load('john-1200'), h = clone(data.world.historicalScenario);
  h.polities.find(p => p.id === data.game.country).kind = 'chiefdom';
  const chiefdom = createHistoricalCharacterSystem({ historicalScenario: h, date: data.game.startDate, polityId: data.game.country, seed: 321 });
  assert.equal(chiefdom.realm.kind, 'chiefdom');
  const saved = clone(createCharacterSystem({ seed: 321 }));
  delete saved.realm.kind;
  const loaded = normalizeCharacterSystem(saved);
  assert.equal(loaded.realm.kind, 'state');
  assert.equal(loaded.rngState, saved.rngState);
  saved.realm.kind = 'empire';
  assert.throws(() => normalizeCharacterSystem(saved), { message: 'Sparfilens rikestyp är okänd.' });
});

test('the presentation shows kind and law', () => {
  const view = getCharacterPresentation(papal());
  assert.deepEqual(view.realm, { kind: 'state', kindLabelSv: 'stat', successionLaw: 'elective', successionLawLabelSv: 'val' });
  assert.equal(view.succession.lawLabel, 'Val efter förmåga bland vuxna i härskarens hus, därefter husets barn efter ålder och sist hovets övriga vuxna');
});

const ELECTEE_DIGESTS = { historical: '42a51e677cf99c74a2b9d210c929de42afe72b111b9fbfe71146e36754eb9d70', hadara: 'f02fccac0a3d487421c28f29d475892d3d07b7cc04f9cb8df51451ddd12fd309' };
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('the shared builder writes the electee exactly as before', () => {
  const historical = papal('elective', { seed: 7 }), person = electOutsider(historical, historical.people['leo-iii']);
  assert.equal(sha([person, historical.families[person.familyId]]), ELECTEE_DIGESTS.historical);
  const hadara = createCharacterSystem({ seed: 7 }), other = electOutsider(hadara, hadara.people[hadara.offices.ruler.holderId]);
  assert.equal(sha([other, hadara.families[other.familyId]]), ELECTEE_DIGESTS.hadara);
});

test('the shared builder gives every skill one value and marks only historical people', () => {
  const state = papal();
  const person = generatedAdultRecord(state, { id: 'probe', name: 'Prov (genererad)', familyId: 'leo-household', bornAt: '0775-01-01', sex: 'female', culture: 'Ej belagd', religionId: 'latin-church', archetype: 'diplomat', skill: 4 });
  assert.deepEqual(person.skills, Object.fromEntries(Object.keys(SKILL_LABELS).map(key => [key, 4])));
  assert.equal(person.archetype, 'diplomat');
  assert.equal(person.originLabelSv, 'Genererad person');
  assert.equal(markGeneratedOrigin(state, person, 'Not.').historicalOrigin.claims.identity.noteSv, 'Not.');
  assert.equal(person.identityOrigin, 'generated');
  const hadara = createCharacterSystem({ seed: 7 }), plainPerson = generatedAdultRecord(hadara, { ...person, skill: 5 });
  assert.equal(markGeneratedOrigin(hadara, plainPerson, 'Not.').identityOrigin, undefined);
});
