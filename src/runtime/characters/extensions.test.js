import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths, compareGameDates } from '../gameDates.js';
import { actionHooks, advanceCharacters, createCharacterSystem, executeCharacterCommand, normalizeCharacterSystem } from './index.js';
import { DIFFICULTIES, EXTENSIONS_VERSION, actionRandom, deriveExtendedSkills, ensureCharacterExtensions, normalizeDifficulty, plotRandom, spymasterOf, validateCharacterExtensions } from './extensions.js';
import { OPPOSITE_TRAITS, SKILL_LABELS, TRAITS } from './content.js';
import { imprisonPerson } from './prisoners.js';
// svenska-guard: ok (the word "constructor" below is a JavaScript property name, not Swedish)

// Captured with the code before this task: createCharacterSystem({ seed: 321 }).rngState and the main stream after advancing 12 and 60 months.
const PRE_CHANGE_RNG = { created: 321, after12Months: 2318062802, after60Months: 3162113386 };
const COURT_FIELDS = ['reign', 'nicknames', 'familyDemands', 'factions'];
const EXTENSION_FIELDS = ['extensionsVersion', 'difficulty', 'actionRngState', 'secrets', 'hooks', 'relationships', 'schemes', 'actionLog', 'courtStaff', 'occasions', 'prisoners', 'rumors', 'conversations', 'plotRngState', ...COURT_FIELDS];
const plain = (state) => JSON.parse(JSON.stringify(state));
function stripExtensions(state) {
  for (const key of EXTENSION_FIELDS) delete state[key];
  delete state.offices.spymaster;
  for (const person of Object.values(state.people)) { delete person.skills.intrigue; delete person.skills.prowess; }
  return state;
}
const adult = (archetype, extra = {}) => ({ archetype, traits: [], skills: { command: 6, stewardship: 6, diplomacy: 6, learning: 6 }, ...extra });

test('new campaigns carry extensions and keep the main random stream', () => {
  const state = createCharacterSystem({ seed: 321 });
  assert.equal(EXTENSIONS_VERSION, 3);
  assert.equal(state.extensionsVersion, 3);
  assert.equal(state.difficulty, 'normal');
  assert.equal(state.rngState, PRE_CHANGE_RNG.created);
  for (const person of Object.values(state.people)) for (const key of ['intrigue', 'prowess']) assert.ok(Number.isFinite(person.skills[key]), `${person.id} ${key}`);
  assert.ok(Number.isInteger(state.actionRngState) && state.actionRngState >= 1 && state.actionRngState <= 0xffffffff);
  for (const key of ['hooks', 'relationships', 'schemes', 'actionLog']) assert.deepEqual(state[key], []);
  assert.equal(state.secrets.length, 1); // the seeded chancellor affair; see the version 2 tests below
  assert.deepEqual(state.courtStaff, {});
  validateCharacterExtensions(state);
  // Adding the two skills must not shift a single draw of the main stream or touch the action stream.
  for (const [months, expected] of [[12, PRE_CHANGE_RNG.after12Months], [60, PRE_CHANGE_RNG.after60Months]]) {
    const result = advanceCharacters(state, addGameMonths(state.date, months), { id: `y${months}` });
    assert.equal(result.ok, true, result.error);
    assert.equal(result.state.rngState, expected);
    // NPC plots (npcPlots.js) start schemes whose monthly checks draw from the action stream, so it moves exactly when some scheme has had its first check (a month after its start). The main stream pin above is untouched by them.
    const checked = result.state.schemes.some((scheme) => compareGameDates(addGameMonths(scheme.startedAt, 1), result.state.date) <= 0);
    assert.equal(result.state.actionRngState === state.actionRngState, !checked);
  }
});

test('the action stream is seeded per campaign from polity, start date and the main stream value', () => {
  const fnv = (text) => { let n = 2166136261; for (let i = 0; i < text.length; i++) n = Math.imul(n ^ text.charCodeAt(i), 16777619); return n >>> 0 || 1; };
  const a = createCharacterSystem({ seed: 321 }), b = createCharacterSystem({ seed: 999 }), c = createCharacterSystem({ seed: 321, polityId: 'other' }), d = createCharacterSystem({ seed: 321, date: '-0250-01-01' });
  assert.equal(a.actionRngState, fnv('hadara|-0300-01-01|321|actions'));
  // (a) same polity and start date, different campaign seed: different action stream.
  assert.equal(a.identity.polityId, b.identity.polityId); assert.equal(a.startedAt, b.startedAt);
  assert.notEqual(a.actionRngState, b.actionRngState);
  assert.equal(b.actionRngState, fnv('hadara|-0300-01-01|999|actions'));
  assert.notEqual(a.actionRngState, c.actionRngState);
  assert.notEqual(a.actionRngState, d.actionRngState);
  assert.equal(a.actionRngState, createCharacterSystem({ seed: 321 }).actionRngState);
  // (b) the same save migrated twice, and a JSON round trip of it, land on the same action stream.
  const advanced = advanceCharacters(a, addGameMonths(a.date, 12), { id: 'y1' }).state;
  const old = stripExtensions(plain(advanced));
  const first = normalizeCharacterSystem(old), second = normalizeCharacterSystem(old), viaJson = normalizeCharacterSystem(JSON.parse(JSON.stringify(old)));
  assert.equal(first.actionRngState, second.actionRngState);
  assert.equal(first.actionRngState, viaJson.actionRngState);
  assert.equal(first.actionRngState, normalizeCharacterSystem(plain(first)).actionRngState);
  // A migration reads the save's current main-stream value, so it differs from the creation-time seed.
  assert.equal(first.actionRngState, fnv(`hadara|-0300-01-01|${PRE_CHANGE_RNG.after12Months}|actions`));
  assert.notEqual(first.actionRngState, a.actionRngState);
  // (c) ensure draws nothing: the main stream value is untouched, on creation-shaped and on advanced saves alike.
  for (const save of [stripExtensions(plain(createCharacterSystem({ seed: 321 }))), old]) {
    const before = save.rngState, copy = plain(save);
    ensureCharacterExtensions(copy); ensureCharacterExtensions(copy);
    assert.equal(copy.rngState, before);
    assert.equal(old.rngState, PRE_CHANGE_RNG.after12Months);
  }
});

test('createCharacterSystem stores a known difficulty and falls back to normal', () => {
  assert.equal(createCharacterSystem({ difficulty: 'hard' }).difficulty, 'hard');
  assert.equal(createCharacterSystem({ difficulty: 'easy' }).difficulty, 'easy');
  for (const value of ['god', '', undefined, null, 7, ['hard'], { toString: () => 'hard' }, 'constructor', '__proto__']) assert.equal(createCharacterSystem({ difficulty: value }).difficulty, 'normal', String(value));
  assert.deepEqual({ ...DIFFICULTIES }, { easy: 'Lätt', normal: 'Normal', hard: 'Svår' });
  assert.equal(normalizeDifficulty('hard'), 'hard');
  assert.equal(normalizeDifficulty('toString'), 'normal');
});

test('a 1.0 save migrates once and replays identically', () => {
  const old = stripExtensions(plain(createCharacterSystem({ seed: 321 })));
  const rngBefore = old.rngState;
  const migrated = normalizeCharacterSystem(old);
  assert.equal(migrated.rngState, rngBefore);
  assert.equal(migrated.extensionsVersion, 3);
  assert.equal(migrated.difficulty, 'normal');
  assert.deepEqual(migrated, normalizeCharacterSystem(migrated));
  assert.deepEqual(migrated, normalizeCharacterSystem(plain(migrated)));
  // A fresh campaign and a migrated 1.0 save of the same campaign end up identical.
  // The only difference is the chancellor's affair, which seeds new campaigns only. The stripped save keeps the sequence number the affair spent.
  const fresh = plain(createCharacterSystem({ seed: 321 })); fresh.secrets = [];
  assert.deepEqual(migrated, normalizeCharacterSystem(fresh));
  const target = addGameMonths(migrated.date, 12);
  const direct = advanceCharacters(migrated, target, { id: 'y1' }), viaJson = advanceCharacters(JSON.parse(JSON.stringify(migrated)), target, { id: 'y1' });
  assert.equal(direct.ok, true, direct.error);
  assert.deepEqual(direct.state, viaJson.state);
  assert.equal(direct.state.rngState, PRE_CHANGE_RNG.after12Months);
});

test('migration fills only what is missing and never overwrites existing values', () => {
  const old = stripExtensions(plain(createCharacterSystem({ seed: 321 })));
  // A valid record, because normalize now validates secrets too.
  const kept = { id: 'secret-900', type: 'heresy', subjectId: 'person-0-0', holderIds: ['person-1-0'], evidence: 'weak', causeId: null, exposed: false, createdAt: old.date };
  old.difficulty = 'hard'; old.actionRngState = 12345; old.secrets = [kept];
  old.people['person-0-0'].skills.intrigue = 17;
  const state = normalizeCharacterSystem(old);
  assert.equal(state.difficulty, 'hard');
  assert.equal(state.actionRngState, 12345);
  assert.deepEqual(state.secrets, [kept]);
  assert.equal(state.people['person-0-0'].skills.intrigue, 17);
  assert.equal(state.people['person-0-0'].skills.prowess, deriveExtendedSkills(old.people['person-0-0'], state.date).prowess);
});

test('commands and time steps on an old save add the extensions without drawing from the main stream', () => {
  const old = stripExtensions(plain(createCharacterSystem({ seed: 321 })));
  const command = executeCharacterCommand(old, { id: 'old-tax', expectedRevision: old.revision, type: 'tax_policy', payload: { policy: 'gentle' } });
  assert.equal(command.ok, true, command.error);
  const advanced = advanceCharacters(old, addGameMonths(old.date, 12), { id: 'y1' });
  assert.equal(advanced.ok, true, advanced.error);
  for (const result of [command, advanced]) {
    assert.equal(result.state.extensionsVersion, 3);
    assert.equal(result.state.difficulty, 'normal');
    validateCharacterExtensions(result.state);
    for (const person of Object.values(result.state.people)) assert.ok(Number.isFinite(person.skills.intrigue) && Number.isFinite(person.skills.prowess));
  }
  assert.equal(command.state.rngState, old.rngState);
  assert.equal(advanced.state.rngState, PRE_CHANGE_RNG.after12Months);
});

test('children born during play start with the minimum of both new skills', () => {
  let state = createCharacterSystem({ seed: 321 }), newborns = 0;
  for (let year = 1; year <= 30; year++) {
    const result = advanceCharacters(state, addGameMonths(state.date, 12), { id: `year-${year}` });
    assert.equal(result.ok, true, result.error);
    state = result.state;
    for (const person of Object.values(state.people).filter((p) => /^person-\d+$/.test(p.id) && p.bornAt === state.date)) { newborns++; assert.deepEqual([person.skills.intrigue, person.skills.prowess], [1, 1], person.id); }
  }
  assert.ok(newborns > 0, 'the seed produces at least one birth within 30 years');
  validateCharacterExtensions(state);
});

test('a child can be educated in the new skills and grows them through the existing yearly step', () => {
  for (const focus of ['intrigue', 'prowess']) {
    const state = createCharacterSystem({ seed: 321 }), child = state.people['person-0-4'], mentor = state.people['person-0-2'];
    const taught = executeCharacterCommand(state, { id: `teach-${focus}`, expectedRevision: state.revision, type: 'educate', payload: { childId: child.id, mentorId: mentor.id, focus } });
    assert.equal(taught.ok, true, taught.error);
    const grown = advanceCharacters(taught.state, addGameMonths(state.date, 12), { id: `grow-${focus}` });
    assert.equal(grown.ok, true, grown.error);
    assert.ok(grown.state.people[child.id].skills[focus] > child.skills[focus], focus);
    validateCharacterExtensions(grown.state);
  }
});

test('derived skills follow archetype and traits', () => {
  const intrigue = (person) => deriveExtendedSkills(person).intrigue, prowess = (person) => deriveExtendedSkills(person).prowess;
  assert.ok(intrigue(adult('schemer')) > intrigue(adult('scholar')));
  assert.ok(prowess(adult('commander')) > prowess(adult('steward')));
  // intrigue = round(2 + diplomacy * 0.4 + learning * 0.2 + archetype + traits) = 5.6 for an unremarkable adult at 6/6
  assert.equal(intrigue(adult('scholar')), 6);
  assert.deepEqual(Object.fromEntries(['schemer', 'diplomat', 'legislator'].map((a) => [a, intrigue(adult(a))])), { schemer: 11, diplomat: 8, legislator: 7 });
  assert.deepEqual(Object.fromEntries(['ambitious', 'vengeful', 'dutiful', 'compassionate', 'cautious'].map((t) => [t, intrigue(adult('scholar', { traits: [t] }))])), { ambitious: 7, vengeful: 7, dutiful: 5, compassionate: 5, cautious: 6 });
  // prowess = round(2 + command * 0.6 + archetype + traits) = 5.6 at command 6
  assert.equal(prowess(adult('steward')), 6);
  assert.deepEqual(Object.fromEntries(['commander', 'guardian', 'builder'].map((a) => [a, prowess(adult(a))])), { commander: 10, guardian: 8, builder: 7 });
  assert.deepEqual(Object.fromEntries(['vengeful', 'cautious', 'ambitious'].map((t) => [t, prowess(adult('steward', { traits: [t] }))])), { vengeful: 7, cautious: 5, ambitious: 6 });
  // Always an integer from 1 to 20, whatever the inputs look like.
  const extremes = [adult('schemer', { skills: { command: 99, diplomacy: 99, learning: 99 }, traits: ['ambitious', 'vengeful'] }), adult('scholar', { skills: { command: 0, diplomacy: 0, learning: 0 }, traits: ['dutiful', 'compassionate', 'cautious'] }), { skills: {} }, {}];
  for (const person of extremes) for (const value of Object.values(deriveExtendedSkills(person))) assert.ok(Number.isInteger(value) && value >= 1 && value <= 20, JSON.stringify(person));
  assert.deepEqual(deriveExtendedSkills(extremes[0]), { intrigue: 20, prowess: 20 });
  assert.deepEqual(deriveExtendedSkills(extremes[1]), { intrigue: 1, prowess: 1 });
});

test('children under 18 get half, rounded, with a minimum of 1', () => {
  const born = (years) => ({ ...adult('schemer'), bornAt: addGameMonths('-0300-01-01', -years * 12), diedAt: null });
  const date = '-0300-01-01';
  assert.deepEqual(deriveExtendedSkills(born(17), date), { intrigue: 6, prowess: 3 });
  assert.deepEqual(deriveExtendedSkills(born(18), date), { intrigue: 11, prowess: 6 });
  assert.deepEqual(deriveExtendedSkills(born(10), date), deriveExtendedSkills(born(17), date));
  assert.deepEqual(deriveExtendedSkills({ ...born(5), skills: { command: 0, diplomacy: 0, learning: 0 }, archetype: 'steward' }, date), { intrigue: 1, prowess: 1 });
  const fresh = createCharacterSystem({ seed: 321 });
  for (const person of Object.values(fresh.people)) {
    const full = deriveExtendedSkills(person), expected = person.id.endsWith('-4') || person.id.endsWith('-5') ? { intrigue: Math.max(1, Math.round(full.intrigue / 2)), prowess: Math.max(1, Math.round(full.prowess / 2)) } : full;
    assert.deepEqual({ intrigue: person.skills.intrigue, prowess: person.skills.prowess }, expected, person.id);
  }
});

test('content gains the two skills and the new traits', () => {
  assert.equal(SKILL_LABELS.intrigue, 'Intrig');
  assert.equal(SKILL_LABELS.prowess, 'Kampförmåga');
  const added = { honest: 'Ärlig', deceitful: 'Bedräglig', trusting: 'Godtrogen', paranoid: 'Misstänksam', brave: 'Modig', craven: 'Feg', calm: 'Lugn', wrathful: 'Vredgad', generous: 'Generös', cruel: 'Grym', diligent: 'Flitig', lazy: 'Lat', content: 'Förnöjsam', zealous: 'Nitisk', cynical: 'Cynisk', just: 'Rättvis', arbitrary: 'Godtycklig', curious: 'Nyfiken' };
  for (const [id, name] of Object.entries(added)) {
    assert.equal(TRAITS[id]?.name, name, id);
    assert.match(TRAITS[id].description, /^[^.]+\.$/, `${id} has a one-sentence description`);
  }
  assert.deepEqual(OPPOSITE_TRAITS, [['honest', 'deceitful'], ['trusting', 'paranoid'], ['brave', 'craven'], ['calm', 'wrathful'], ['generous', 'greedy'], ['compassionate', 'cruel'], ['diligent', 'lazy'], ['content', 'ambitious'], ['zealous', 'cynical'], ['just', 'arbitrary']]);
  for (const trait of OPPOSITE_TRAITS.flat()) assert.ok(TRAITS[trait], `${trait} is a defined trait`);
  // Existing people get no new traits in this phase.
  const known = new Set(['ambitious', 'cautious', 'compassionate', 'dutiful', 'greedy', 'vengeful', 'gregarious', 'devout']);
  for (const person of Object.values(createCharacterSystem({ seed: 321 }).people)) for (const trait of person.traits) assert.ok(known.has(trait), `${person.id} ${trait}`);
});

test('actionRandom is a separate xorshift stream that never touches the main one', () => {
  const state = createCharacterSystem({ seed: 321 }), mainBefore = state.rngState;
  let reference = state.actionRngState | 0;
  for (let i = 0; i < 2000; i++) {
    reference ^= reference << 13; reference ^= reference >>> 17; reference ^= reference << 5;
    const expectedState = reference >>> 0 || 1, value = actionRandom(state);
    assert.equal(state.actionRngState, expectedState);
    assert.equal(value, expectedState / 4294967296);
    assert.ok(value >= 0 && value < 1);
    assert.ok(state.actionRngState >= 1 && state.actionRngState <= 0xffffffff);
    reference = expectedState | 0;
  }
  assert.equal(state.rngState, mainBefore);
  // Even a zero or negative seed value cannot lock the stream at zero.
  const odd = { actionRngState: 0 }; actionRandom(odd); assert.equal(odd.actionRngState, 1);
});

test('forged extensions are rejected', () => {
  const DIFFICULTY = /^Sparfilens svårighetsgrad är ogiltig\.$/, ACTION_STATE = /^Handlingarnas slumptillstånd är ogiltigt\.$/, COLLECTIONS = /^Karaktärstilläggens samlingar är ogiltiga\.$/;
  const VERSION = /^Karaktärstilläggens version stöds inte\.$/, EXTENDED_SKILL = /^En person har ogiltig intrig eller kampförmåga\.$/;
  // The existing check on SKILL_LABELS fires first for a value the extension range check would also refuse.
  const SKILL = /^En person har ogiltig kompetens\.$/;
  const forgeries = {
    'unknown difficulty': [(s) => { s.difficulty = 'god'; }, DIFFICULTY],
    'prototype key as difficulty': [(s) => { s.difficulty = 'constructor'; }, DIFFICULTY],
    'zero action state': [(s) => { s.actionRngState = 0; }, ACTION_STATE],
    'oversized action state': [(s) => { s.actionRngState = 2 ** 32; }, ACTION_STATE],
    'fractional action state': [(s) => { s.actionRngState = 1.5; }, ACTION_STATE],
    'object instead of secrets list': [(s) => { s.secrets = {}; }, COLLECTIONS],
    'string instead of hooks list': [(s) => { s.hooks = 'x'; }, COLLECTIONS],
    'null relationships': [(s) => { s.relationships = null; }, COLLECTIONS],
    'array as court staff': [(s) => { s.courtStaff = []; }, COLLECTIONS],
    'unsupported extensions version': [(s) => { s.extensionsVersion = 4; }, VERSION],
    'negative intrigue': [(s) => { s.people['person-0-0'].skills.intrigue = -1; }, SKILL],
    'prowess above 20': [(s) => { s.people['person-1-1'].skills.prowess = 21; }, EXTENDED_SKILL],
    'text as prowess': [(s) => { s.people['person-1-1'].skills.prowess = '12'; }, SKILL],
    'null intrigue': [(s) => { s.people['person-2-3'].skills.intrigue = null; }, SKILL],
  };
  for (const [name, [forge, message]] of Object.entries(forgeries)) {
    const raw = plain(createCharacterSystem({ seed: 321 })); forge(raw);
    assert.throws(() => normalizeCharacterSystem(raw), { name: 'Error', message }, name);
  }
  // Direct calls reach every branch, including the `< 0` side of the range check that normalize never gets to.
  const bad = plain(createCharacterSystem({ seed: 321 }));
  bad.people['person-0-0'].skills.intrigue = -1;
  assert.throws(() => validateCharacterExtensions(bad), { name: 'Error', message: EXTENDED_SKILL });
  bad.people['person-0-0'].skills.intrigue = 4; bad.people['person-1-1'].skills.prowess = 21;
  assert.throws(() => validateCharacterExtensions(bad), { name: 'Error', message: EXTENDED_SKILL });
  bad.people['person-1-1'].skills.prowess = 5; bad.difficulty = 'god';
  assert.throws(() => validateCharacterExtensions(bad), { name: 'Error', message: DIFFICULTY });
  bad.difficulty = 'normal'; bad.secrets = {};
  assert.throws(() => validateCharacterExtensions(bad), { name: 'Error', message: COLLECTIONS });
  bad.secrets = []; bad.actionRngState = 0;
  assert.throws(() => validateCharacterExtensions(bad), { name: 'Error', message: ACTION_STATE });
  bad.actionRngState = 1; bad.extensionsVersion = 0;
  assert.throws(() => validateCharacterExtensions(bad), { name: 'Error', message: VERSION });
});

test('ensureCharacterExtensions is idempotent and leaves a complete state untouched', () => {
  const state = createCharacterSystem({ seed: 321 }), before = plain(state);
  ensureCharacterExtensions(state); ensureCharacterExtensions(state);
  assert.deepEqual(state, before);
});

const fnv = (text) => { let n = 2166136261; for (let i = 0; i < text.length; i++) n = Math.imul(n ^ text.charCodeAt(i), 16777619); return n >>> 0 || 1; };
const execute = (state, id, type, payload) => executeCharacterCommand(state, { id, expectedRevision: state.revision, type, payload });
const SPYMASTER = { id: 'spymaster', name: 'Spionmästare', kind: 'council', holderId: null, regentId: null, history: [], publicBudget: 0 };

const COURT_LISTS = COURT_FIELDS.filter((key) => key !== 'reign');
const NO_DEEDS = { cruel: 0, betrayal: 0, generous: 0, risky: 0, surrender: 0, executions: 0, breakdowns: 0, goalsMet: 0 };
const migratedReign = (save) => ({ rulerId: save.offices.ruler.holderId, startedAt: save.date, lawful: true, deeds: NO_DEEDS, goals: [], sources: { accession: save.realm.legitimacy, goals: 0, prestige: 0 }, lostOrders: 0 });
const streams = ({ rngState, actionRngState, plotRngState }) => ({ rngState, actionRngState, plotRngState });
const withoutCourt = (state) => { const rest = plain(state); for (const key of [...COURT_FIELDS, 'extensionsVersion']) delete rest[key]; return rest; };

test('new campaigns are on extensions version 3 with an empty court ledger', () => {
  const state = createCharacterSystem({ seed: 321 });
  assert.equal(EXTENSIONS_VERSION, 3);
  assert.equal(state.extensionsVersion, 3);
  for (const key of COURT_LISTS) assert.deepEqual(state[key], [], key);
  assert.deepEqual(state.reign, { rulerId: 'person-0-0', startedAt: '-0300-01-01', lawful: true, deeds: NO_DEEDS, goals: [], sources: { accession: 65, goals: 0, prestige: 0 }, lostOrders: 0 });
  assert.equal(state.realm.prestige, 10);
  assert.equal(state.rngState, PRE_CHANGE_RNG.created);
  validateCharacterExtensions(state);
});

// A year into a campaign, with what Phase 2 can leave in flight: the open office promise, an active scheme and a prisoner.
function midCampaignSave() {
  const year = advanceCharacters(createCharacterSystem({ seed: 321 }), addGameMonths('-0300-01-01', 12), { id: 'first-year' });
  assert.equal(year.ok, true, year.error);
  const started = execute(year.state, 'mid-scheme', 'attempt_action', { actionId: 'undermine', actorId: 'person-0-0', targetIds: ['person-1-0'] });
  assert.equal(started.ok, true, started.error);
  const state = started.state;
  imprisonPerson(state, 'person-1-1', 'family-arel', [], actionHooks(state), { lawful: true });
  assert.ok(state.stories.some((story) => story.status === 'open'), 'an open story');
  assert.ok(state.schemes.some((scheme) => scheme.status === 'active'), 'an active scheme');
  assert.ok(state.prisoners.some((record) => record.status === 'held'), 'a prisoner');
  return state;
}

test('a version-2 save migrates once to version 3 and replays a year identically', () => {
  const live = midCampaignSave(), old = plain(live);
  for (const key of COURT_FIELDS) delete old[key];
  old.extensionsVersion = 2;
  const once = normalizeCharacterSystem(plain(old)), twice = normalizeCharacterSystem(plain(once)), viaJson = normalizeCharacterSystem(JSON.parse(JSON.stringify(old)));
  assert.deepEqual(twice, once);
  assert.deepEqual(viaJson, once);
  for (const migrated of [once, twice, viaJson]) assert.deepEqual(streams(migrated), streams(old));
  assert.equal(once.extensionsVersion, 3);
  assert.deepEqual(once.reign, migratedReign(old));
  for (const key of COURT_LISTS) assert.deepEqual(once[key], [], key);
  // The migration adds the four fields and changes nothing else in the save.
  assert.deepEqual(withoutCourt(once), withoutCourt(old));
  const target = addGameMonths(once.date, 12);
  const replay = (save) => { const result = advanceCharacters(save, target, { id: 'replayed-year' }); assert.equal(result.ok, true, result.error); return result.state; };
  const direct = replay(once);
  assert.deepEqual(replay(twice), direct);
  assert.deepEqual(replay(viaJson), direct);
  assert.deepEqual(replay(JSON.parse(JSON.stringify(once))), direct);
  // The main stream of a migrated save follows the same year as the save that was never stripped.
  assert.equal(direct.rngState, replay(live).rngState);
});

test('a version outside 1 to 3 stays refused', () => {
  for (const version of [0, 4, '2']) {
    const raw = plain(createCharacterSystem({ seed: 321 }));
    raw.extensionsVersion = version;
    assert.throws(() => normalizeCharacterSystem(raw), { name: 'Error', message: /^Karaktärstilläggens version stöds inte\.$/ }, String(version));
  }
});

test('new campaigns are on extensions version 3 with an empty intrigue ledger', () => {
  const state = createCharacterSystem({ seed: 321 });
  assert.equal(state.extensionsVersion, 3);
  for (const key of ['occasions', 'prisoners', 'rumors', 'conversations']) assert.deepEqual(state[key], [], key);
  assert.equal(state.plotRngState, fnv('hadara|-0300-01-01|321|plots'));
  assert.ok(state.plotRngState >= 1 && state.plotRngState <= 0xffffffff);
  assert.deepEqual(state.offices.spymaster, SPYMASTER);
  assert.equal(spymasterOf(state), null);
  assert.equal(state.secrets.length, 1);
  const [affair] = state.secrets;
  assert.deepEqual({ type: affair.type, subjectId: affair.subjectId, holderIds: affair.holderIds, evidence: affair.evidence, causeId: affair.causeId, exposed: affair.exposed }, { type: 'affair', subjectId: 'person-2-2', holderIds: ['person-2-2'], evidence: 'strong', causeId: null, exposed: false });
  assert.equal(state.offices.chancellor.holderId, 'person-2-2');
  // The seed draws no randomness: both existing streams keep their creation values.
  assert.equal(state.rngState, PRE_CHANGE_RNG.created);
  assert.equal(state.actionRngState, fnv('hadara|-0300-01-01|321|actions'));
  validateCharacterExtensions(state);
});

test('a version-1 save migrates once', () => {
  const old = plain(createCharacterSystem({ seed: 321 }));
  for (const key of ['occasions', 'prisoners', 'rumors', 'conversations', 'plotRngState', ...COURT_FIELDS]) delete old[key];
  delete old.offices.spymaster; old.extensionsVersion = 1;
  const rngBefore = old.rngState, actionBefore = old.actionRngState, secretsBefore = plain(old.secrets);
  const once = normalizeCharacterSystem(plain(old)), twice = normalizeCharacterSystem(plain(once));
  assert.deepEqual(twice, once);
  assert.equal(once.extensionsVersion, 3);
  assert.equal(once.rngState, rngBefore);
  assert.equal(once.actionRngState, actionBefore);
  assert.equal(once.plotRngState, fnv(`hadara|-0300-01-01|${rngBefore}|plots`));
  assert.deepEqual(once.offices.spymaster, SPYMASTER);
  assert.deepEqual(once.reign, migratedReign(old));
  // Migration seeds no affair and spends no sequence number.
  assert.deepEqual(once.secrets, secretsBefore);
  assert.equal(once.sequence, old.sequence);
  const target = addGameMonths(once.date, 12);
  const direct = advanceCharacters(once, target, { id: 'y1' }), viaJson = advanceCharacters(JSON.parse(JSON.stringify(once)), target, { id: 'y1' });
  assert.equal(direct.ok, true, direct.error);
  assert.deepEqual(direct.state, viaJson.state);
});

test('the ruler can appoint and dismiss a spymaster', () => {
  const state = createCharacterSystem({ seed: 321 });
  const appointed = execute(state, 'spy-1', 'appoint', { officeId: 'spymaster', personId: 'person-0-2' });
  assert.equal(appointed.ok, true, appointed.error);
  assert.equal(spymasterOf(appointed.state)?.id, 'person-0-2');
  const dismissed = execute(appointed.state, 'spy-2', 'dismiss', { officeId: 'spymaster' });
  assert.equal(dismissed.ok, true, dismissed.error);
  assert.equal(spymasterOf(dismissed.state), null);
  assert.equal(dismissed.state.offices.spymaster.holderId, null);
  // A dead holder does not count as spymaster.
  const dead = plain(appointed.state); dead.people['person-0-2'].diedAt = dead.date;
  assert.equal(spymasterOf(dead), null);
});

test('plotRandom is a separate xorshift stream that never touches the other two', () => {
  const state = createCharacterSystem({ seed: 321 }), mainBefore = state.rngState, actionBefore = state.actionRngState;
  let reference = state.plotRngState | 0;
  for (let i = 0; i < 500; i++) {
    reference ^= reference << 13; reference ^= reference >>> 17; reference ^= reference << 5;
    const expectedState = reference >>> 0 || 1, value = plotRandom(state);
    assert.equal(state.plotRngState, expectedState);
    assert.equal(value, expectedState / 4294967296);
    assert.ok(value >= 0 && value < 1);
    reference = expectedState | 0;
  }
  assert.equal(state.rngState, mainBefore);
  assert.equal(state.actionRngState, actionBefore);
  const odd = { plotRngState: 0 }; plotRandom(odd); assert.equal(odd.plotRngState, 1);
});

test('forged version-2 fields are rejected', () => {
  const STATE = /^Intrigens slumptillstånd är ogiltigt\.$/, COLLECTIONS = /^Karaktärstilläggens samlingar är ogiltiga\.$/;
  const forgeries = {
    'zero plot state': [(s) => { s.plotRngState = 0; }, STATE],
    'oversized plot state': [(s) => { s.plotRngState = 2 ** 32; }, STATE],
    'fractional plot state': [(s) => { s.plotRngState = 1.5; }, STATE],
    'object instead of prisoners': [(s) => { s.prisoners = {}; }, COLLECTIONS],
    'text instead of rumors': [(s) => { s.rumors = 'x'; }, COLLECTIONS],
    'null occasions': [(s) => { s.occasions = null; }, COLLECTIONS],
    'object instead of nicknames': [(s) => { s.nicknames = {}; }, COLLECTIONS],
    'text instead of family demands': [(s) => { s.familyDemands = 'x'; }, COLLECTIONS],
    'null factions': [(s) => { s.factions = null; }, COLLECTIONS],
    'number instead of conversations': [(s) => { s.conversations = 7; }, COLLECTIONS],
  };
  for (const [name, [forge, message]] of Object.entries(forgeries)) {
    const raw = plain(createCharacterSystem({ seed: 321 })); forge(raw);
    assert.throws(() => normalizeCharacterSystem(raw), { name: 'Error', message }, name);
  }
});

test('the realm does not fill the spymaster office on its own, even when the player family does not rule', () => {
  const start = createCharacterSystem({ mode: 'family', seed: 71 });
  const result = advanceCharacters(start, addGameMonths(start.date, 60), { id: 'five-years' });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.state.offices.spymaster.holderId, null);
  assert.deepEqual(result.state.offices.spymaster.history, []);
  assert.equal(spymasterOf(result.state), null);
});
