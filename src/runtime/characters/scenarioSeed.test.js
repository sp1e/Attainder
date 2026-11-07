import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHistoricalCharacterSystem } from './scenarioSeed.js';
import { advanceCharacters, executeCharacterCommand, getCharacterPresentation, normalizeCharacterSystem } from './index.js';
import { addGameMonths } from '../gameDates.js';
import { validateHistoricalScenario } from '../historicalScenarios.js';
import { projectCharacterWorld } from '../characterWorld.js';

const clone = value => JSON.parse(JSON.stringify(value));
const load = id => JSON.parse(readFileSync(new URL(`../../../server/seed/historical/${id}/scenario.json`, import.meta.url), 'utf8')).data;
const optionsFor = data => ({ historicalScenario: data.world.historicalScenario, date: data.game.startDate, polityId: data.game.country, seed: 321 });
const ok = result => { assert.equal(result.ok, true, result.error); return result.state; };
const ledger = state => { const value = clone(state); delete value.revision; delete value.appliedCommandIds; return value; };

for (const id of ['egypt-3000bc', 'john-1200', 'charlemagne-800']) {
  for (const mode of ['realm', 'family']) test(`${id} ${mode}: authored court initializes deterministically in the current engine`, () => {
    const data = load(id), options = { ...optionsFor(data), mode };
    const before = clone(options);
    const state = createHistoricalCharacterSystem(options);
    assert.deepEqual(options, before);
    assert.deepEqual(createHistoricalCharacterSystem(options), state);
    assert.deepEqual(normalizeCharacterSystem(clone(state)), state);
    const court = options.historicalScenario.courtSeeds[options.polityId];
    assert.equal(state.date, options.date);
    assert.equal(state.realm.id, options.polityId);
    assert.equal(state.identity.polityId, options.polityId);
    assert.equal(state.offices.ruler.holderId, court.rulerId);
    assert.deepEqual(Object.keys(state.people), court.people.map(p => p.id));
    for (const authored of court.people) {
      const person = state.people[authored.id];
      assert.equal(person.bornAt, authored.bornAt);
      assert.equal(person.identityOrigin, authored.identityOrigin);
      assert.equal(person.originLabelSv, authored.originLabelSv);
      assert.deepEqual(person.skills, authored.mechanics.skills);
      assert.deepEqual(person.legalParentIds, authored.legalParentIds);
      assert.equal(person.spouseId, authored.spouseIds[0] ?? null);
      assert.equal(person.historicalOrigin.claims.mechanics.status, 'generated');
      assert.ok(state.families[person.familyId]);
      assert.ok(state.religions[person.religionId]);
      assert.notEqual(person.culture, 'Hadariska');
    }
    for (const city of Object.values(state.cities)) {
      assert.ok(state.offices[city.governorOfficeId]);
      assert.ok(state.families[city.familyId]);
    }
    assert.equal(state.secrets.length, 0);
    assert.ok(!state.stories.some(s => s.type === 'office_promise'));
    assert.equal(state.historicalOrigin.contentId, id);
    assert.equal(state.historicalOrigin.coverageNoteSv, options.historicalScenario.coverageNoteSv);
    assert.equal(state.historicalOrigin.contextSv, options.historicalScenario.contextSv);
    const projected = projectCharacterWorld({ ...data.world, characterSystem: state });
    assert.equal(projected.characterSystem.identity.polityId, options.polityId);
    assert.equal(projected.countryStats[options.polityId].leader, state.people[court.rulerId].name);
  });

  test(`${id}: public and household actions remain playable after JSON save loading`, () => {
    let state = normalizeCharacterSystem(clone(createHistoricalCharacterSystem(optionsFor(load(id)))));
    for (const type of ['tax_policy', 'rest']) {
      const action = getCharacterPresentation(state).actions.find(a => a.type === type && !a.disabledReason);
      assert.ok(action, type);
      const payload = Object.fromEntries((action.fields ?? []).map(field => [field.key, field.options?.[0]?.value]));
      state = ok(executeCharacterCommand(state, { id: `acceptance-${type}`, type, payload, expectedRevision: state.revision }));
      assert.deepEqual(normalizeCharacterSystem(clone(state)), state);
    }
  });

  test(`${id}: complete simulation state and streams match whole versus split year advancement`, () => {
    const state = createHistoricalCharacterSystem(optionsFor(load(id)));
    const whole = ok(advanceCharacters(state, addGameMonths(state.date, 12), { id: 'year' }));
    let split = state;
    for (let month = 1; month <= 12; month++) split = ok(advanceCharacters(split, addGameMonths(state.date, month), { id: `month-${month}` }));
    assert.deepEqual(ledger(split), ledger(whole));
    assert.deepEqual(normalizeCharacterSystem(clone(whole)), whole);
  });

  test(`${id}: an explicitly selected non-royal family keeps household authority`, () => {
    const state = createHistoricalCharacterSystem({ ...optionsFor(load(id)), mode: 'family', familyId: 'generated-house-1' });
    const view = getCharacterPresentation(state);
    assert.equal(state.identity.familyId, 'generated-house-1');
    assert.equal(view.representative.id, state.families['generated-house-1'].headId);
    const rested = ok(executeCharacterCommand(state, { id: 'household-rest', type: 'rest', payload: {}, expectedRevision: state.revision }));
    assert.equal(rested.realm.treasury, state.realm.treasury);
    assert.equal(executeCharacterCommand(rested, { id: 'foreign-tax', type: 'tax_policy', payload: { policy: 'gentle' }, expectedRevision: rested.revision }).ok, false);
  });
}

test('missing biography uses a labeled generated birth date and invents no recorded culture or genealogy', () => {
  const options = optionsFor(load('john-1200'));
  const person = options.historicalScenario.courtSeeds[options.polityId].people[0];
  delete person.bornAt;
  delete person.claims.bornAt;
  const state = createHistoricalCharacterSystem(options), generated = state.people[person.id];
  assert.equal(generated.identityOrigin, 'documented');
  assert.equal(generated.historicalOrigin.claims.bornAt.status, 'generated');
  assert.deepEqual(generated.historicalOrigin.claims.bornAt.sourceIds, []);
  assert.deepEqual(generated.biologicalParentIds, []);
  assert.deepEqual(generated.legalParentIds, []);
  assert.equal(generated.culture, 'Ej belagd');
});

test('court size is authored data; a one-family court works with vacant generated council seats', () => {
  const options = optionsFor(load('egypt-3000bc')), h = options.historicalScenario, court = h.courtSeeds[options.polityId];
  court.people = court.people.slice(0, 2);
  court.families = court.families.slice(0, 1);
  court.offices = court.offices.filter(o => o.id === 'ruler');
  court.religions[0].leaderId = null;
  const state = createHistoricalCharacterSystem(options);
  assert.equal(Object.keys(state.people).length, 2);
  assert.equal(Object.keys(state.families).length, 1);
  assert.equal(state.offices.general.holderId, null);
  assert.deepEqual(normalizeCharacterSystem(clone(state)), state);
  assert.ok(getCharacterPresentation(state).ruler);
});

test('sourced young spouse retains her birth date and relationship without weakening action adulthood gates', () => {
  const state = createHistoricalCharacterSystem(optionsFor(load('john-1200')));
  const view = getCharacterPresentation(state), spouse = view.people.find(p => p.id === 'isabella');
  assert.equal(spouse.age, 12);
  assert.equal(spouse.spouseId, 'john');
  const result = executeCharacterCommand(state, { id: 'young-office', type: 'appoint', expectedRevision: state.revision, payload: { officeId: 'general', personId: 'isabella' } });
  assert.equal(result.ok, false);
  assert.match(result.error, /myndig|vuxen/);
});

test('historical provenance exposes only public fields and never nested secrets, faction members or loyalty', () => {
  const options = optionsFor(load('john-1200'));
  options.historicalScenario.secrets = 'PRIVATE_SCENARIO';
  options.historicalScenario.courtSeeds[options.polityId].people[0].claims.identity.secret = 'PRIVATE_CLAIM';
  options.historicalScenario.courtSeeds[options.polityId].people[0].mechanics.skills.secret = 'PRIVATE_SKILL';
  const state = createHistoricalCharacterSystem(options);
  state.historicalOrigin.hidden = 'PRIVATE_ORIGIN';
  state.people.john.historicalOrigin.factionMembers = ['PRIVATE_FACTION'];
  state.people.john.historicalOrigin.claims.identity.loyalty = 'PRIVATE_LOYALTY';
  const view = getCharacterPresentation(state), json = JSON.stringify(view);
  for (const marker of ['PRIVATE_SCENARIO', 'PRIVATE_CLAIM', 'PRIVATE_SKILL', 'PRIVATE_ORIGIN', 'PRIVATE_FACTION', 'PRIVATE_LOYALTY']) assert.ok(!json.includes(marker), marker);
  assert.equal(view.people.find(p => p.id === 'john').loyalty, undefined);
  assert.equal(view.historicalOrigin.contentId, 'john-1200');
  assert.equal(view.people.find(p => p.id === 'john').originLabelSv, state.people.john.originLabelSv);
});

test('cyclic authored parent relationships are rejected before constructing runtime state', () => {
  const options = optionsFor(load('john-1200'));
  const [first, second] = options.historicalScenario.courtSeeds[options.polityId].people;
  first.legalParentIds = [second.id];
  second.legalParentIds = [first.id];
  for (const person of [first, second]) person.claims.legalParentIds = { status: 'generated', sourceIds: [], noteSv: 'Syntetiskt släktskap.' };
  assert.throws(() => createHistoricalCharacterSystem(options), /historiska/);
});

test('normalization checks optional historical metadata without changing save compatibility versions', () => {
  const state = createHistoricalCharacterSystem(optionsFor(load('john-1200')));
  assert.equal(state.rulesVersion, 'hadara-1.0.0');
  assert.equal(state.contentVersion, 'hadara-1.0.0');
  const malformed = clone(state);
  malformed.historicalOrigin.bookmarkDate = '0000-01-01';
  assert.throws(() => normalizeCharacterSystem(malformed), /historiska/);
  assert.deepEqual(normalizeCharacterSystem(clone(state)), state);
});

test('schema-valid person-4 court is refused before a generated birth can overwrite its identity', () => {
  const data = load('egypt-3000bc'), options = { ...optionsFor(data), seed: 1 };
  const h = options.historicalScenario, court = h.courtSeeds[options.polityId];
  const remap = id => id === 'generated-courtier-3' ? 'person-4' : id;
  for (const person of court.people) {
    person.id = remap(person.id);
    person.legalParentIds = person.legalParentIds.map(remap);
    person.spouseIds = person.spouseIds.map(remap);
  }
  for (const family of court.families) family.headId = remap(family.headId);
  for (const religion of court.religions) religion.leaderId = remap(religion.leaderId);
  for (const office of court.offices) office.holderId = remap(office.holderId);
  const regions = JSON.parse(readFileSync(new URL('../../../server/seed/historical/egypt-3000bc/regions.geojson', import.meta.url), 'utf8'));
  assert.equal(validateHistoricalScenario({ ...data, regions, assetManifest: h.assetManifest }, options).ok, true);
  const before = clone(options);
  assert.throws(() => createHistoricalCharacterSystem(options), /Det historiska hovets uppgifter.*\./);
  assert.deepEqual(options, before);
});

test('malformed optional historical coverage is rejected on JSON load before presentation', () => {
  const state = createHistoricalCharacterSystem({ ...optionsFor(load('egypt-3000bc')), seed: 1 });
  const valid = clone(state);
  assert.deepEqual(normalizeCharacterSystem(valid), state);
  assert.ok(getCharacterPresentation(normalizeCharacterSystem(valid)).historicalOrigin.coverage.length);
  for (const coverage of [[null], [false], [[]], [{}], { area: 'Africa' }, [{ ...state.historicalOrigin.coverage[0], sourceIds: [null] }]]) {
    const malformed = clone(state);
    malformed.historicalOrigin.coverage = coverage;
    const before = clone(malformed);
    assert.throws(() => normalizeCharacterSystem(clone(malformed)), /Sparfilens historiska ursprungsuppgifter är ogiltiga\./);
    assert.deepEqual(malformed, before);
  }
  const absent = clone(state);
  delete absent.historicalOrigin.coverage;
  assert.deepEqual(normalizeCharacterSystem(absent), absent);
  assert.ok(getCharacterPresentation(normalizeCharacterSystem(absent)).ruler);
});

test('a BC/AD transition uses the generic no-year-zero calendar with complete split-advance parity', () => {
  const options = optionsFor(load('egypt-3000bc')), h = options.historicalScenario;
  options.date = h.bookmarkDate = '-0001-12-31';
  for (const person of h.courtSeeds[options.polityId].people) person.bornAt = '-0035-01-01';
  const state = createHistoricalCharacterSystem(options);
  const whole = ok(advanceCharacters(state, '0001-12-31', { id: 'year' }));
  const january = ok(advanceCharacters(state, '0001-01-01', { id: 'january' }));
  const split = ok(advanceCharacters(january, '0001-12-31', { id: 'rest' }));
  assert.deepEqual(ledger(split), ledger(whole));
  assert.equal(whole.date, '0001-12-31');
});

test('children born in the simulation have generated identity and no Hadara name-pool biography', () => {
  const options = { ...optionsFor(load('egypt-3000bc')), seed: 1 };
  const state = createHistoricalCharacterSystem(options);
  const year = ok(advanceCharacters(state, addGameMonths(state.date, 12), { id: 'birth-year' }));
  const child = Object.values(year.people).find(person => !state.people[person.id]);
  assert.ok(child);
  assert.equal(child.identityOrigin, 'generated');
  assert.equal(child.originLabelSv, 'Genererad person');
  assert.match(child.name, /^Barn /);
  assert.equal(child.historicalOrigin.claims.bornAt.status, 'generated');
  assert.equal(child.historicalOrigin.claims.kinship.status, 'generated');
  assert.deepEqual(normalizeCharacterSystem(clone(year)), year);
});

for (const [name, mutate] of [
  ['unsupported date', o => { o.date = '1200-01-01'; }],
  ['unknown polity', o => { o.polityId = 'unknown'; }],
  ['unknown family', o => { o.familyId = 'unknown'; }],
  ['inconsistent ruler', o => { o.historicalScenario.courtSeeds[o.polityId].rulerId = 'isabella'; }],
  ['invalid mechanics', o => { o.historicalScenario.courtSeeds[o.polityId].people[0].mechanics.skills.command = -1; }],
  ['missing family', o => { o.historicalScenario.courtSeeds[o.polityId].people[0].familyId = 'missing'; }],
  ['unsupported spouse shape', o => { o.historicalScenario.courtSeeds[o.polityId].people[0].spouseIds.push('generated-courtier-1'); }],
]) test(`factory rejects ${name} without mutating input`, () => {
  const options = optionsFor(load('john-1200')); mutate(options); const before = clone(options);
  assert.throws(() => createHistoricalCharacterSystem(options), /historiska.*[.]/i);
  assert.deepEqual(options, before);
});

test('seeded religions keep their public claims through save, load and presentation', () => {
  const options = optionsFor(load('charlemagne-800')), authored = options.historicalScenario.courtSeeds[options.polityId].religions[0];
  const state = createHistoricalCharacterSystem(options);
  assert.deepEqual(state.religions[authored.id].historicalOrigin.claims.identity, authored.claims.identity);
  assert.match(authored.claims.identity.noteSv, /^Leo III/);
  const loaded = normalizeCharacterSystem(clone(state));
  loaded.religions[authored.id].historicalOrigin.privateNote = 'HIDDEN';
  loaded.religions[authored.id].historicalOrigin.claims.research = { status: 'sourced', noteSv: 'HIDDEN', sourceIds: [] };
  const presented = getCharacterPresentation(loaded).religions.find(r => r.id === authored.id);
  assert.deepEqual(presented.historicalOrigin, state.religions[authored.id].historicalOrigin);
  assert.doesNotMatch(JSON.stringify(presented), /HIDDEN/);
});

test('survival claims reach the presented person through save and load', () => {
  const options = optionsFor(load('charlemagne-800')), court = options.historicalScenario.courtSeeds[options.polityId];
  const people = getCharacterPresentation(normalizeCharacterSystem(clone(createHistoricalCharacterSystem(options)))).people;
  const authored = court.people.filter(p => p.claims.survival);
  assert.equal(authored.length, 5);
  for (const person of authored) assert.deepEqual(people.find(p => p.id === person.id).historicalOrigin.claims.survival, person.claims.survival);
});

test('a saved historical religion without claims normalizes and presents as it did', () => {
  const state = createHistoricalCharacterSystem(optionsFor(load('john-1200')));
  for (const religion of Object.values(state.religions)) delete religion.historicalOrigin;
  const loaded = normalizeCharacterSystem(clone(state));
  assert.deepEqual(loaded.religions, state.religions);
  assert.equal(getCharacterPresentation(loaded).religions.every(r => !Object.hasOwn(r, 'historicalOrigin')), true);
});

test('real assets and court agree at the accepted schema boundary', () => {
  for (const id of ['egypt-3000bc', 'john-1200', 'charlemagne-800']) {
    const data = load(id), options = optionsFor(data);
    const regions = JSON.parse(readFileSync(new URL(`../../../server/seed/historical/${id}/regions.geojson`, import.meta.url), 'utf8'));
    assert.equal(validateHistoricalScenario({ ...data, regions, assetManifest: options.historicalScenario.assetManifest }, options).ok, true);
  }
});
