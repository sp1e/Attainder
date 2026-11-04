import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTION_CATALOG } from './actionCatalog.js';
import { estimateAction } from './actionOdds.js';
import { refusalChance } from './actionResolution.js';
import { courtAnnualStep } from './court.js';
import { cowNobles, dreadOf, dreadRows, dreadYearStep, presentDread } from './dread.js';
import { actionHooks, advanceCharacters, createCharacterSystem, estimateCharacterAction, executeCharacterCommand, getCharacterPresentation, normalizeCharacterSystem } from './index.js';
import { npcPlotStep, plotScore } from './npcPlots.js';
import { executePrisoner, imprisonPerson } from './prisoners.js';
import { createSecret } from './secrets.js';

const REP = 'person-0-0';
const SERA = 'person-0-2';
const TAREK = 'person-0-3';
const CHILD = 'person-0-4';
const NAMAR = 'person-1-0';
const DARA = 'person-1-1';
const KELAN = 'person-1-2';
const TALIA = 'person-1-3';
const EREN = 'person-1-4';
const BAREK = 'person-2-2';
const ARELS = 'family-arel';
const NAMARS = 'family-namar';
const ESHMUNS = 'family-eshmun';
const ROW = 'Rädsla för härskaren';
const adultsOf = (family) => [0, 1, 2, 3].map((index) => `person-${family}-${index}`);
const NOBLES = [...adultsOf(1), ...adultsOf(2), ...adultsOf(3)];

const plain = (value) => JSON.parse(JSON.stringify(value));
const base = () => createCharacterSystem({ seed: 321 });
const streams = ({ rngState, actionRngState, plotRngState }) => ({ rngState, actionRngState, plotRngState });
let counter = 0;
const run = (state, type, payload) => executeCharacterCommand(state, { id: `dread-${++counter}`, expectedRevision: state.revision, type, payload });
const ok = (result) => { assert.equal(result.ok, true, result.error); return result.state; };
const seize = (state, personId) => imprisonPerson(state, personId, ARELS, [], actionHooks(state));
const execute = (state, personId) => ok(run(state, 'execute_prisoner', { prisonerId: seize(state, personId).id }));
const frighten = (state, fear, ids = NOBLES) => { for (const id of ids) state.people[id].fear = fear; return state; };
const grievances = (state) => Object.values(state.families).map((family) => family.grievance);
const nemeses = (state) => state.relationships.filter((entry) => entry.kind === 'nemesis').map((entry) => [entry.aId, entry.bId, entry.causeId]);
const fearRows = (estimate) => estimate.success.modifiers.filter((row) => row.label === ROW).map((row) => row.value);

// The state whose next draw is `next` / 2^32, and the edge of a chance, as in npcPlots.test.js.
function seedBefore(next) {
  const undoLeft = (x, k) => { let y = x; for (let i = 0; i < 32; i += k) y = (x ^ (y << k)) >>> 0; return y; };
  const undoRight = (x, k) => { let y = x; for (let i = 0; i < 32; i += k) y = (x ^ (y >>> k)) >>> 0; return y; };
  return undoLeft(undoRight(undoLeft(next >>> 0, 5), 17), 13);
}
const edgeAt = (p) => Math.ceil(p * 2 ** 32);
function opinionOf(state, fromId, toId, amount) {
  const key = `${fromId}:${toId}`;
  state.relations[key] ??= { fromId, toId, bonds: [], causes: [] };
  state.relations[key].causes.push({ id: `fixture-${++state.sequence}`, amount, label: 'Provvärde', causeId: `fixture-${state.sequence}`, startAt: state.date, expiresAt: null });
}
// Everybody outside the controlled family likes the ruler but Barek, who plots at a score of 10 − opinion, less his fear. He is cautious: 0.4 a point.
function plotAt(opinion, fear) {
  const state = base();
  for (const person of Object.values(state.people)) if (person.familyId !== ARELS) opinionOf(state, person.id, REP, 60);
  opinionOf(state, BAREK, REP, -60 + opinion);
  state.people[BAREK].fear = fear;
  state.plotRngState = seedBefore(edgeAt(0.05) - 1);
  npcPlotStep(state, [], actionHooks(state));
  return state.schemes.at(-1)?.actionId ?? null;
}

const intentFor = (actionId, state) => ({ actionId, actorId: REP, targetIds: [KELAN], means: {
  ...(actionId === 'blackmail' ? { secretId: createSecret(state, { type: 'affair', subjectId: KELAN, holderIds: [REP] }).id } : {}),
  ...(actionId === 'spread_rumor' ? { topic: 'plot' } : {}),
} });

test('an execution cows every noble and more of the victim\'s kin', () => {
  const state = base(), done = execute(state, KELAN);
  for (const id of [NAMAR, DARA, TALIA]) assert.equal(done.people[id].fear, 35, id);
  for (const id of [...adultsOf(2), ...adultsOf(3)]) assert.equal(done.people[id].fear, 20, id);
  for (const id of adultsOf(0)) assert.equal(done.people[id].fear, 0, `${id} belongs to the ruler's family`);
  assert.equal(done.people[EREN].fear, 0, 'a child of the victim\'s family');
  assert.equal(done.people['person-2-4'].fear, 0, 'a child of another family');
  assert.equal(dreadOf(done, actionHooks(done)), 24, '(3 × 35 + 8 × 20) / 11 rounds down');
  assert.equal(done.families[NAMARS].grievance, state.families[NAMARS].grievance - 10);
  assert.equal(done.families[ESHMUNS].grievance, state.families[ESHMUNS].grievance);
  assert.equal(done.reign.deeds.executions, state.reign.deeds.executions + 1);
  normalizeCharacterSystem(plain(done));
});

test('fear stops at 100 and grievance at −40 when an execution falls', () => {
  const state = frighten(base(), 90);
  state.families[NAMARS].grievance = -35;
  const done = execute(state, KELAN);
  assert.equal(done.people[NAMAR].fear, 100);
  assert.equal(done.people[BAREK].fear, 100);
  assert.equal(done.families[NAMARS].grievance, -40);
});

test('a prisoner is cowed only as kin of the victim', () => {
  const state = base();
  seize(state, TALIA); seize(state, BAREK);
  const done = execute(state, KELAN);
  assert.equal(done.people[TALIA].fear, 15, 'kin in prison gain the kin\'s share alone');
  assert.equal(done.people[BAREK].fear, 0, 'a stranger in prison hears nothing');
  assert.equal(done.people[NAMAR].fear, 35, 'free kin gain both');
});

test('an execution makes enemies of vengeful and brave kin', () => {
  const state = base();
  Object.assign(state.people[NAMAR], { traits: ['vengeful'] });
  Object.assign(state.people[DARA], { traits: ['brave'] });
  Object.assign(state.people[TALIA], { traits: ['calm'] });
  Object.assign(state.people[EREN], { traits: ['vengeful'] });
  Object.assign(state.people[BAREK], { traits: ['vengeful'] });
  const done = execute(state, KELAN);
  const note = done.memories.findLast((memory) => memory.type === 'execution');
  assert.deepEqual(nemeses(done), [[NAMAR, REP, note.id], [DARA, REP, note.id]], 'a calm adult, a child and a stranger stay out of it');
  normalizeCharacterSystem(plain(done));
});

test('a second execution keeps one enemy per pair and names the newer cause', () => {
  const first = execute(base(), KELAN);
  const second = execute(first, TALIA);
  const notes = second.memories.filter((memory) => memory.type === 'execution').map((memory) => memory.id);
  assert.equal(notes.length, 2);
  const enemies = nemeses(second).filter(([aId]) => aId === NAMAR);
  assert.deepEqual(enemies, [[NAMAR, REP, notes[1]]]);
  assert.equal(second.reign.deeds.executions, 2);
  normalizeCharacterSystem(plain(second));
});

test('an execution in the ruler\'s own family makes no enemy of the ruler and no fear in her', () => {
  const state = base();
  state.people[REP].traits = ['brave'];
  state.people[SERA].traits = ['vengeful'];
  state.people['person-0-1'].traits = ['calm'];
  const done = execute(state, TAREK);
  assert.deepEqual(nemeses(done).map(([aId, bId]) => [aId, bId]), [[SERA, REP]]);
  assert.equal(done.people[REP].fear, 0);
  assert.equal(done.people[SERA].fear, 15, 'her kin outside the dread still fear her');
  assert.equal(done.people[NAMAR].fear, 20, 'the other families are cowed as ever');
  normalizeCharacterSystem(plain(done));
});

// A child on the throne and the old ruler as her regent, as in regencyAuthority.test.js. The reign is the child's, as crown leaves it.
function regency() {
  const state = plain(base());
  Object.assign(state.offices.ruler, { holderId: CHILD, regentId: REP });
  state.reign.rulerId = CHILD;
  state.realm.lawfulRulerId = CHILD;
  state.regencies['office:ruler'] = { id: 'office:ruler', principalId: CHILD, regentId: REP, phase: 'minority', startedAt: state.date, grants: [], requestAfter: {}, handoverDueAt: null };
  state.stories = [];
  delete state.mandateVersion; delete state.mandateActivatedAt; delete state.mandateSequence;
  return normalizeCharacterSystem(state);
}

test('a regent who orders her kin\'s death neither fears herself nor turns on the ruler', () => {
  const state = regency();
  state.people[REP].traits = ['vengeful'];
  state.people[SERA].traits = ['brave'];
  state.people['person-0-1'].traits = ['calm'];
  const done = execute(state, TAREK);
  assert.equal(done.people[REP].fear, 0);
  assert.equal(done.people[SERA].fear, 15, 'the rest of the kin still fear');
  assert.deepEqual(nemeses(done).map(([aId, bId]) => [aId, bId]), [[SERA, CHILD]], 'the rest of the kin still turn on the ruler');
});

test('an execution counts as a deed only when the ruler orders it herself', () => {
  const regent = execute(regency(), KELAN);
  assert.equal(regent.reign.deeds.executions, 0);
  assert.equal(regent.reign.deeds.cruel, 0, 'charge holds the regent\'s cruelty to the same rule');
  const ruler = execute(base(), KELAN);
  assert.equal(ruler.reign.deeds.executions, 1);
  assert.equal(ruler.reign.deeds.cruel, 1);
});

test('the court learns of an execution after its memory and before the death', () => {
  const state = base(), record = seize(state, KELAN), hooks = actionHooks(state), seen = [];
  const memory = (...args) => { seen.push(['memory', state.reign.deeds.executions]); return hooks.memory(...args); };
  const kill = (...args) => { seen.push(['kill', state.reign.deeds.executions, state.people[KELAN].diedAt]); return hooks.kill(...args); };
  executePrisoner(state, { prisonerId: record.id }, [], { ...hooks, memory, kill });
  assert.deepEqual(seen, [['memory', 0], ['kill', 1, null]]);
});

test('dread is the rounded mean fear of free adults outside the ruler\'s family', () => {
  const state = base(), hooks = actionHooks(state);
  assert.equal(dreadOf(state, hooks), 0);
  state.people[NAMAR].fear = 18;
  assert.equal(dreadOf(state, hooks), 2, '18 / 12 rounds up');
  // None of these people counts.
  for (const id of [...adultsOf(0), EREN]) state.people[id].fear = 100;
  assert.equal(dreadOf(state, hooks), 2);
  state.people[BAREK].fear = 100;
  seize(state, BAREK);
  assert.equal(dreadOf(state, hooks), 2, 'a prisoner, out of eleven: 18 / 11');
  state.people[NAMAR].diedAt = state.date;
  assert.equal(dreadOf(state, hooks), 0, 'the dead: 0 / 10');
});

test('dread follows the crown and is 0 with nobody to fear', () => {
  const state = base(), hooks = actionHooks(state);
  frighten(state, 30, adultsOf(1));
  state.offices.ruler.holderId = NAMAR;
  assert.equal(dreadOf(state, hooks), 0, 'the frightened family took the throne');
  frighten(state, 30, adultsOf(0));
  assert.equal(dreadOf(state, hooks), 10, 'twelve others, four of them frightened');
  state.offices.ruler.holderId = null;
  assert.equal(dreadOf(state, hooks), 15, 'with no ruler every family counts: eight of sixteen frightened');
  for (const person of Object.values(state.people)) person.diedAt = state.date;
  assert.equal(dreadOf(state, hooks), 0);
});

test('cowNobles raises the same people as dread counts, up to 100', () => {
  const state = base(), hooks = actionHooks(state);
  state.people[NAMAR].fear = 95;
  seize(state, BAREK);
  cowNobles(state, 10, hooks);
  assert.equal(state.people[NAMAR].fear, 100);
  assert.equal(state.people[DARA].fear, 10);
  assert.equal(state.people[BAREK].fear, 0, 'in prison');
  assert.equal(state.people[SERA].fear, 0, 'the ruler\'s family');
  assert.equal(state.people[EREN].fear, 0, 'a child');
});

test('dread lowers an NPC\'s plot score', () => {
  const plotter = { traits: [], skills: { intrigue: 10 } }, opinion = -20;
  const score = (fear, traits = []) => plotScore({ ...plotter, fear, traits }, opinion);
  assert.equal(score(0), 30);
  assert.equal(score(20), 27, '0.15 a point');
  assert.equal(score(20, ['cautious']), 22, '0.4 a point');
  assert.equal(score(20, ['craven']), 22, '0.4 a point');
  assert.equal(score(20, ['cautious', 'craven']), 22, 'the weight counts once');
  assert.equal(score(20, ['vengeful']), 42);

  // Barek's score at opinion −10 is 20, the lowest that plots; at −50 it is 60, the lowest that poisons.
  assert.equal(plotAt(-10, 0), 'undermine');
  assert.equal(plotAt(-10, 5), null, 'fear 5 takes the cautious plotter to 18');
  assert.equal(plotAt(-50, 0), 'poison');
  assert.equal(plotAt(-50, 5), 'undermine', 'a frightened plotter dares less');
});

test('a frightened actor refuses less often', () => {
  const actor = { traits: [], loyalty: 50 };
  assert.deepEqual([0, 25, 50, 100].map((fear) => refusalChance({ ...actor, fear }, 0)), [20, 15, 10, 0]);
  assert.equal(refusalChance({ ...actor, fear: 100, loyalty: 0 }, 0), 20, 'fear counts against a disloyal actor too');
  assert.equal(refusalChance({ ...actor, fear: 100, loyalty: 100 }, 0), 0, 'the chance never falls below 0');

  // The order itself uses it: the log keeps the chance the actor drew against.
  const orderedAt = (fear) => {
    const state = base();
    Object.assign(state.people[SERA], { loyalty: 0, traits: [], fear });
    const after = ok(run(state, 'attempt_action', { actionId: 'sway', actorId: SERA, targetIds: [KELAN] }));
    return after.actionLog.at(-1).estimate.refusal;
  };
  assert.equal(orderedAt(0) - orderedAt(50), 10);
});

test('the fear row helps sway, blackmail and imprison and only those', () => {
  const helped = ['sway', 'blackmail', 'imprison'];
  for (const actionId of Object.keys(ACTION_CATALOG)) {
    const calm = base(), afraid = frighten(base(), 57, [KELAN]);
    const quiet = estimateCharacterAction(calm, intentFor(actionId, calm)), estimate = estimateCharacterAction(afraid, intentFor(actionId, afraid));
    assert.equal(estimate.ok, true, `${actionId}: ${estimate.reason}`);
    assert.deepEqual(fearRows(estimate), helped.includes(actionId) ? [5] : [], actionId);
    assert.equal(estimate.success.value, quiet.success.value + (helped.includes(actionId) ? 5 : 0), actionId);
    assert.equal(estimate.secrecy.value, quiet.secrecy.value, actionId);
  }
  const shown = frighten(base(), 57, [KELAN]);
  assert.ok(estimateCharacterAction(shown, intentFor('sway', shown)).display.modifiers.some((row) => row.label === ROW), 'the player reads the row');
});

test('the fear row grows a point per ten fear and stops at 10', () => {
  const sway = ACTION_CATALOG.sway;
  const table = [[0, []], [9, []], [10, [1]], [19, [1]], [57, [5]], [100, [10]], [150, [10]]];
  for (const [fear, values] of table) assert.deepEqual(dreadRows(sway, { fear }).map((row) => row.value), values, `fear ${fear}`);
  assert.deepEqual(dreadRows(sway, { fear: 20 }), [{ label: ROW, value: 2 }]);
  assert.deepEqual(dreadRows(ACTION_CATALOG.poison, { fear: 100 }), []);
});

test('an NPC gains no fear row', () => {
  const state = frighten(base(), 57, [KELAN]);
  const estimate = estimateAction(state, { actionId: 'sway', actorId: BAREK, targetIds: [KELAN], means: {} }, actionHooks(state).npcEstimateContext(BAREK));
  assert.equal(estimate.ok, true, estimate.reason);
  assert.deepEqual(fearRows(estimate), []);
});

test('the fear row keeps the feast rows and the feast the odds carry', () => {
  const state = ok(run(frighten(base(), 57, [KELAN]), 'hold_feast', {}));
  const estimate = estimateCharacterAction(state, intentFor('blackmail', state));
  assert.equal(estimate.ok, true, estimate.reason);
  assert.deepEqual(fearRows(estimate), [5]);
  assert.ok(estimate.success.modifiers.some((row) => row.label === 'Gästabudet ger tillträde'));
  assert.ok(estimate.secrecy.modifiers.some((row) => row.label === 'Hemlighållning: många vittnen på gästabudet'));
  assert.equal(estimate.occasionId, state.occasions[0].id);
});

test('dread 40 costs legitimacy and goodwill each year', () => {
  const after = (fear, edit = () => {}) => { const state = frighten(base(), fear); edit(state); dreadYearStep(state, actionHooks(state)); return state; };
  const untouched = frighten(base(), 39);
  assert.deepEqual(plain(after(39)), plain(untouched), 'dread 39 costs nothing');

  const heavy = after(40), fresh = base();
  assert.equal(heavy.realm.legitimacy, fresh.realm.legitimacy - 1);
  assert.deepEqual(grievances(heavy), grievances(fresh).map((value, index) => (index === 0 ? value : value - 1)), 'the ruler\'s family keeps its goodwill');
  assert.deepEqual(streams(heavy), streams(fresh));

  const floor = after(40, (state) => { state.realm.legitimacy = 0; state.families[NAMARS].grievance = -40; });
  assert.equal(floor.realm.legitimacy, 0);
  assert.equal(floor.families[NAMARS].grievance, -40);
});

test('the court step weighs dread after the council has drifted', () => {
  const after = (fear) => {
    const state = frighten(base(), fear);
    state.families[NAMARS].grievance = -9;
    courtAnnualStep(state, [], actionHooks(state));
    return state;
  };
  const calm = after(0), heavy = after(40);
  assert.equal(calm.families[NAMARS].grievance, -9);
  assert.equal(heavy.families[NAMARS].grievance, -10);
  assert.equal(heavy.realm.legitimacy, calm.realm.legitimacy - 1);
  assert.equal(heavy.people[KELAN].loyalty, calm.people[KELAN].loyalty, 'the general drifted on the grievance of −9');
});

test('a real year turn weighs the dread after the fear has faded', () => {
  // Fear fades by 2 before the court step: 42 stays at dread 40, 41 falls to 39.
  const year = (fear) => { const state = frighten(base(), fear); return ok(advanceCharacters(state, state.nextAnnualDate)); };
  const heavy = year(42), light = year(41);
  assert.equal(dreadOf(heavy, actionHooks(heavy)), 40);
  assert.equal(heavy.realm.legitimacy, light.realm.legitimacy - 1);
  assert.equal(heavy.families[ESHMUNS].grievance, light.families[ESHMUNS].grievance - 1);
});

test('the view names the dread in three words, and reading it changes nothing', () => {
  const labels = { 0: 'Ingen fruktar kronan', 14: 'Ingen fruktar kronan', 15: 'Adeln är på sin vakt', 39: 'Adeln är på sin vakt', 40: 'Adeln lever i skräck', 100: 'Adeln lever i skräck' };
  for (const [fear, label] of Object.entries(labels)) {
    const state = frighten(base(), Number(fear)), before = plain(state);
    assert.deepEqual(presentDread(state, actionHooks(state)), { value: Number(fear), label });
    assert.deepEqual(getCharacterPresentation(state).court.dread, { value: Number(fear), label });
    assert.deepEqual(plain(state), before);
  }
});

test('no fear changes nothing', () => {
  // The refusal formula of Phase 2.
  for (const [loyalty, opinion, traits, chance] of [[50, 0, [], 20], [68, 10, [], 10], [20, -30, ['ambitious'], 51], [90, 40, ['dutiful'], 0]]) {
    assert.equal(refusalChance({ traits, loyalty, fear: 0 }, opinion), chance);
  }
  // The plot score of Phase 2.
  assert.equal(plotScore({ traits: ['ambitious', 'vengeful'], skills: { intrigue: 7 }, fear: 0 }, -5), 42);
  assert.equal(plotScore({ traits: ['cautious'], skills: { intrigue: 3 }, fear: 0 }, 10), -7);
  // The odds: fear below 10 adds no row and moves no value.
  for (const actionId of Object.keys(ACTION_CATALOG)) {
    const none = base(), some = frighten(base(), 9, [KELAN]);
    const quiet = estimateCharacterAction(none, intentFor(actionId, none)), estimate = estimateCharacterAction(some, intentFor(actionId, some));
    assert.deepEqual(fearRows(quiet), [], actionId);
    assert.deepEqual([estimate.success.value, estimate.success.modifiers], [quiet.success.value, quiet.success.modifiers], actionId);
  }
  // The year: nothing moves, and the court step adds no event.
  const state = base(), before = plain(state);
  dreadYearStep(state, actionHooks(state));
  assert.deepEqual(plain(state), before);
  const later = ok(advanceCharacters(state, state.nextAnnualDate));
  assert.equal(dreadOf(later, actionHooks(later)), 0);
});
