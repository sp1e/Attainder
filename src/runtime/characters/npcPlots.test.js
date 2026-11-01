import test from 'node:test';
import assert from 'node:assert/strict';
import { addGameMonths, compareGameDates } from '../gameDates.js';
import { buildCharacterPromptContext } from '../characterWorld.js';
import { ACTION_CATALOG, requiresOf } from './actionCatalog.js';
import { tierFor } from './actionResolution.js';
import { actionHooks, advanceCharacters, createCharacterSystem, estimateCharacterAction, executeCharacterCommand, getCharacterPresentation, getNextCharacterTransitionDate, normalizeCharacterSystem } from './index.js';
import { actionRandom, plotRandom } from './extensions.js';
import { npcPlotStep, plotUncoveredChoices } from './npcPlots.js';
import { imprisonPerson, isImprisoned, isLawfulSubject } from './prisoners.js';
import { activeHooks, createSecret, exposeSecret } from './secrets.js';

const REP = 'person-0-0';
const SERA = 'person-0-2';
const TAREK = 'person-0-3';
const NAMAR = 'person-1-0';
const DARA = 'person-1-1';
const KELAN = 'person-1-2';
const BAREK = 'person-2-2';
const DANEL = 'person-3-2';
const ARELS = 'family-arel';
const NAMARS = 'family-namar';
const ESHMUNS = 'family-eshmun';
const SAFRAS = 'family-safra';
const RULER_ONLY = 'Bara härskaren kan fängsla.';

const copy = (value) => JSON.parse(JSON.stringify(value));
const base = () => createCharacterSystem({ seed: 321 });
let counter = 0;
const run = (state, type, payload) => executeCharacterCommand(state, { id: `command-${++counter}`, expectedRevision: state.revision, type, payload });
const ok = (result) => { assert.equal(result.ok, true, result.error); return result.state; };
const advance = (state, date) => { const result = advanceCharacters(state, date); assert.equal(result.ok, true, result.error); return result.state; };
const withSeed = (state, seed) => Object.assign(copy(state), { actionRngState: seed });
const START = base().date;
const MONTH = addGameMonths(START, 1);
const worldContent = (state) => { const { revision: _revision, appliedCommandIds: _commands, ...content } = state; return content; };

const plotDraws = (seed, count) => { const dice = { plotRngState: seed }; return Array.from({ length: count }, () => plotRandom(dice)); };
const actionDraws = (seed, count) => { const dice = { actionRngState: seed }; return Array.from({ length: count }, () => actionRandom(dice) * 100); };
// Seeds whose first draws satisfy one check; test setup only.
function seedFor(draw, count, check) {
  for (let k = 1; k < 400000; k++) {
    const seed = Math.imul(k, 2654435761) >>> 0 || 1;
    if (check(draw(seed, count))) return seed;
  }
  throw new Error('No seed for these draws.');
}
// plotSeedWhere gets the plot draws as fractions below 1, actionSeedWhere the action draws as percentages.
const plotSeedWhere = (count, check) => seedFor(plotDraws, count, check);
const actionSeedWhere = (count, check) => seedFor(actionDraws, count, check);
// The state whose next draw is `next` / 2^32: one xorshift step undone.
function seedBefore(next) {
  const undoLeft = (x, k) => { let y = x; for (let i = 0; i < 32; i += k) y = (x ^ (y << k)) >>> 0; return y; };
  const undoRight = (x, k) => { let y = x; for (let i = 0; i < 32; i += k) y = (x ^ (y >>> k)) >>> 0; return y; };
  return undoLeft(undoRight(undoLeft(next >>> 0, 5), 17), 13);
}
// The smallest next-value whose draw is at or above the fraction p; one less is still below it.
const edgeAt = (p) => Math.ceil(p * 2 ** 32);

function opinionOf(state, fromId, toId, amount) {
  const key = `${fromId}:${toId}`;
  state.relations[key] ??= { fromId, toId, bonds: [], causes: [] };
  state.relations[key].causes.push({ id: `fixture-${++state.sequence}`, amount, label: 'Provvärde', causeId: `fixture-${state.sequence}`, startAt: state.date, expiresAt: null });
}
// Every adult outside the controlled family thinks well of the ruler, so nobody plots against him.
function calm(state) {
  for (const person of Object.values(state.people)) if (person.familyId !== ARELS) opinionOf(state, person.id, REP, 60);
  return state;
}
const step = (state) => { const events = []; npcPlotStep(state, events, actionHooks(state)); return events; };
const withPlotDraw = (state, fraction) => Object.assign(state, { plotRngState: seedBefore(edgeAt(fraction) - 1) });
const hostile = (state, personId, amount = -60) => { opinionOf(state, personId, REP, amount); return state; };

// An NPC scheme written by hand into a state, with its plot secret.
function plant(state, overrides = {}) {
  const actorId = overrides.actorId ?? NAMAR;
  const item = {
    id: `scheme-${++state.sequence}`, actionId: 'undermine', actorId, targetIds: [REP], means: { silver: 0, agentRoles: [] },
    startedAt: state.date, dueAt: addGameMonths(state.date, 12), nextCheckAt: addGameMonths(state.date, 1),
    status: 'active', discoveredAt: null, resolutionId: null, playerControlled: false, commandId: null, ...overrides,
  };
  if (!Object.hasOwn(overrides, 'secretId')) item.secretId = createSecret(state, { type: 'plot', subjectId: actorId, holderIds: [actorId] }).id;
  else if (overrides.secretId === null) delete item.secretId;
  state.schemes.push(item);
  return item;
}
const schemesOf = (state) => state.schemes.filter((scheme) => !scheme.playerControlled);

test('a hostile, ambitious Namar adult poisons the ruler at a found plot seed', () => {
  const state = hostile(base(), NAMAR);
  state.plotRngState = plotSeedWhere(1, ([draw]) => draw * 100 < 40);
  const treasury = state.families[NAMARS].treasury;
  step(state);
  assert.equal(state.schemes.length, 1);
  const [scheme] = state.schemes;
  assert.deepEqual([scheme.actionId, scheme.actorId, scheme.targetIds, scheme.playerControlled, scheme.status], ['poison', NAMAR, [REP], false, 'active']);
  assert.equal(scheme.commandId, `npc-plot:${state.date}:1`);
  assert.deepEqual(scheme.means, { silver: 0, agentRoles: [] });
  assert.equal(scheme.dueAt, addGameMonths(state.date, 1));
  assert.equal(state.families[NAMARS].treasury, treasury - ACTION_CATALOG.poison.cost.silver, 'the plotter family paid');
  const secret = state.secrets.find((item) => item.id === scheme.secretId);
  assert.deepEqual([secret.type, secret.subjectId, secret.holderIds, secret.evidence, secret.exposed, secret.causeId], ['plot', NAMAR, [NAMAR], 'weak', false, null]);
  assert.doesNotThrow(() => normalizeCharacterSystem(copy(state)));
});

test('above the chance nothing starts, and the plot stream moves by exactly one draw', () => {
  const state = hostile(base(), NAMAR);
  state.plotRngState = plotSeedWhere(2, ([draw]) => draw * 100 >= 40);
  const [, second] = plotDraws(state.plotRngState, 2);
  step(state);
  assert.deepEqual(state.schemes, []);
  assert.equal(plotRandom(state), second, 'one draw was spent');
});

test('a friendly court starts no plot and draws nothing', () => {
  for (const k of [1, 2, 3, 4, 5]) {
    const state = calm(base());
    state.plotRngState = Math.imul(k, 2654435761) >>> 0 || 1;
    const before = state.plotRngState;
    step(state);
    assert.deepEqual(state.schemes, []);
    assert.equal(state.plotRngState, before, `seed ${k}`);
  }
});

test('the score needs 20 to plot and 60 to poison; the chance is half the score, at most 40', () => {
  const cases = [{ opinion: -9, plots: false }, { opinion: -10, plots: true, action: 'undermine' }, { opinion: -49, plots: true, action: 'undermine' }, { opinion: -50, plots: true, action: 'poison' }];
  for (const { opinion, plots, action } of cases) {
    // Barek: intrigue 10, neither ambitious nor vengeful, so the score is 10 − opinion.
    const state = calm(base());
    opinionOf(state, BAREK, REP, -60 + opinion);
    state.plotRngState = seedBefore(edgeAt(0.05) - 1);
    const before = state.plotRngState;
    step(state);
    if (!plots) {
      assert.deepEqual(state.schemes, [], `opinion ${opinion}`);
      assert.equal(state.plotRngState, before, 'no candidate means no draw');
    } else {
      assert.equal(state.schemes.at(-1).actionId, action, `opinion ${opinion}`);
      assert.equal(state.schemes.at(-1).actorId, BAREK);
    }
  }
  // Score 30 gives a 15 percent chance: a draw at 0.15 is too high, one just below it is not.
  const edge = (draw) => { const state = calm(base()); opinionOf(state, BAREK, REP, -80); state.plotRngState = draw; step(state); return state.schemes.length; };
  assert.equal(edge(seedBefore(edgeAt(0.15))), 0);
  assert.equal(edge(seedBefore(edgeAt(0.15) - 1)), 1);
});

test('difficulty scales the chance: hard plots at a draw where normal and easy do not', () => {
  const run1 = (difficulty, draw) => { const state = hostile(base(), NAMAR); state.difficulty = difficulty; state.plotRngState = seedBefore(edgeAt(draw)); step(state); return state.schemes.length; };
  // Chance 40 at normal: easy 20, normal 40, hard 60.
  assert.deepEqual(['easy', 'normal', 'hard'].map((d) => run1(d, 0.1)), [1, 1, 1]);
  assert.deepEqual(['easy', 'normal', 'hard'].map((d) => run1(d, 0.3)), [0, 1, 1]);
  assert.deepEqual(['easy', 'normal', 'hard'].map((d) => run1(d, 0.5)), [0, 0, 1]);
  assert.deepEqual(['easy', 'normal', 'hard'].map((d) => run1(d, 0.7)), [0, 0, 0]);
  // The edge of hard: 60 percent exactly does not plot, one step lower does.
  const hard = (next) => { const state = hostile(base(), NAMAR); state.difficulty = 'hard'; state.plotRngState = seedBefore(next); step(state); return state.schemes.length; };
  assert.equal(hard(edgeAt(0.6)), 0);
  assert.equal(hard(edgeAt(0.6) - 1), 1);
});

test('a plot needs a family that can pay: undermine for the score check, then the action chosen', () => {
  // Everybody else is calm; Barek's family decides.
  const poisoner = () => { const state = calm(base()); opinionOf(state, BAREK, REP, -140); state.plotRngState = seedBefore(edgeAt(0.01) - 1); return state; };
  const rich = poisoner();
  step(rich);
  assert.equal(rich.schemes[0].actionId, 'poison');
  const poor = poisoner();
  poor.families[ESHMUNS].treasury = 14;
  step(poor);
  assert.deepEqual(poor.schemes, [], 'cannot pay for undermine, not even a candidate');
  assert.equal(poor.plotRngState, poisoner().plotRngState, 'no draw');
  const short = poisoner();
  short.families[ESHMUNS].treasury = 20;
  step(short);
  assert.deepEqual(short.schemes, [], 'can pay undermine (15) but not poison (25)');
  assert.equal(short.plotRngState, poisoner().plotRngState, 'no draw either');
  // The poorer family is passed over when another candidate qualifies.
  const other = poisoner();
  hostile(other, NAMAR, -40);
  other.families[ESHMUNS].treasury = 10;
  step(other);
  assert.equal(other.schemes[0].actorId, NAMAR);
});

test('plotters are free adults outside the controlled family and outside exile', () => {
  const fresh = () => { const state = calm(base()); hostile(state, NAMAR, -120); hostile(state, KELAN, -100); state.plotRngState = seedBefore(edgeAt(0.01) - 1); return state; };
  const first = fresh();
  step(first);
  assert.equal(first.schemes[0].actorId, NAMAR, 'the best candidate');
  const jailed = fresh();
  imprisonPerson(jailed, NAMAR, ARELS, [], actionHooks(jailed), { lawful: true });
  step(jailed);
  assert.equal(jailed.schemes[0].actorId, KELAN, 'a prisoner does not plot');
  const exiled = fresh();
  exiled.families[NAMARS].exiled = true;
  step(exiled);
  assert.deepEqual(exiled.schemes, [], 'an exiled family has nobody left to plot');
  const own = calm(base());
  opinionOf(own, TAREK, REP, -150);
  own.plotRngState = seedBefore(edgeAt(0.01) - 1);
  step(own);
  assert.deepEqual(own.schemes, [], 'a member of the controlled family never plots against it');
  const tied = calm(base());
  for (const id of [NAMAR, DARA]) { tied.people[id].skills.intrigue = 12; opinionOf(tied, id, REP, -100); }
  tied.plotRngState = seedBefore(edgeAt(0.01) - 1);
  step(tied);
  assert.equal(tied.schemes[0].actorId, NAMAR, 'ties go to the lower id');
});

test('only one NPC scheme against the controlled family at a time', () => {
  const state = hostile(base(), NAMAR);
  state.plotRngState = seedBefore(edgeAt(0.01) - 1);
  plant(state, { actorId: DARA, targetIds: [SERA] });
  const before = state.plotRngState;
  step(state);
  assert.equal(schemesOf(state).length, 1, 'the active plot against the family stands alone');
  assert.equal(state.plotRngState, before, 'and costs no draw');
  const idle = hostile(base(), NAMAR);
  idle.plotRngState = before;
  plant(idle, { actorId: DARA, targetIds: [SERA], status: 'failed' });
  step(idle);
  assert.equal(schemesOf(idle).length, 2, 'a plot that is over does not block the next');
});

test('in family mode the plot aims at the representative', () => {
  const state = createCharacterSystem({ seed: 321, mode: 'family', familyId: NAMARS });
  for (const person of Object.values(state.people)) if (person.familyId !== NAMARS) opinionOf(state, person.id, 'person-1-0', 60);
  opinionOf(state, TAREK, 'person-1-0', -100);
  state.plotRngState = seedBefore(edgeAt(0.01) - 1);
  step(state);
  const [scheme] = state.schemes;
  assert.equal(scheme.actorId, TAREK);
  assert.deepEqual(scheme.targetIds, ['person-1-0'], 'the representative, not the ruler');
});

test('two NPCs of different houses that think worst of each other plot at a draw of 0.2', () => {
  const fresh = () => {
    const state = calm(base());
    opinionOf(state, BAREK, DANEL, -60);
    opinionOf(state, DANEL, BAREK, -20);
    opinionOf(state, 'person-2-3', 'person-3-3', -30);
    opinionOf(state, 'person-3-3', 'person-2-3', -30);
    opinionOf(state, SERA, NAMAR, -90);
    opinionOf(state, NAMAR, SERA, -90);
    return state;
  };
  const near = fresh();
  near.plotRngState = seedBefore(edgeAt(0.2) - 1);
  step(near);
  assert.equal(near.schemes.length, 1);
  assert.deepEqual([near.schemes[0].actionId, near.schemes[0].actorId, near.schemes[0].targetIds, near.schemes[0].playerControlled], ['undermine', BAREK, [DANEL], false], 'the lower opinion plots against the other');
  assert.equal(near.families[ESHMUNS].treasury, 110 - ACTION_CATALOG.undermine.cost.silver);
  assert.ok(near.secrets.find((item) => item.id === near.schemes[0].secretId && item.subjectId === BAREK));
  const far = fresh();
  far.plotRngState = seedBefore(edgeAt(0.2));
  step(far);
  assert.deepEqual(far.schemes, []);
  const flat = calm(base());
  opinionOf(flat, BAREK, DANEL, -10);
  opinionOf(flat, DANEL, BAREK, -10);
  flat.plotRngState = seedBefore(edgeAt(0.2) - 1);
  step(flat);
  assert.deepEqual(flat.schemes, [], 'a mutual opinion of exactly −10 is not below −10');
});

test('a feud skips prisoners and never involves the controlled family or a plotter who cannot pay', () => {
  const fresh = () => {
    const state = calm(base());
    opinionOf(state, BAREK, DANEL, -80);
    opinionOf(state, DANEL, BAREK, -80);
    opinionOf(state, 'person-2-3', 'person-3-3', -30);
    opinionOf(state, 'person-3-3', 'person-2-3', -30);
    state.plotRngState = seedBefore(edgeAt(0.2) - 1);
    return state;
  };
  const jailed = fresh();
  imprisonPerson(jailed, BAREK, ARELS, [], actionHooks(jailed), { lawful: true });
  step(jailed);
  assert.deepEqual([jailed.schemes[0].actorId, jailed.schemes[0].targetIds[0]], ['person-2-3', 'person-3-3'], 'the next pair');
  const poor = fresh();
  poor.families[ESHMUNS].treasury = 14;
  poor.families[SAFRAS].treasury = 14;
  step(poor);
  assert.deepEqual(poor.schemes, []);
  const busy = fresh();
  plant(busy, { actorId: BAREK, targetIds: [DANEL] });
  plant(busy, { actorId: 'person-2-3', targetIds: ['person-3-3'] });
  const before = busy.plotRngState;
  step(busy);
  assert.equal(schemesOf(busy).length, 2, 'at most two feuds');
  assert.equal(busy.plotRngState, before, 'no draw');
  const arel = calm(base());
  opinionOf(arel, SERA, DANEL, -100);
  opinionOf(arel, DANEL, SERA, -100);
  arel.plotRngState = seedBefore(edgeAt(0.2) - 1);
  step(arel);
  assert.deepEqual(arel.schemes, [], 'the controlled family is not a party to a feud');
});

test('an NPC married to a spouse he thinks no better of than 0 may start an affair', () => {
  // A new marriage stands at +33 (the family's +8 and the partner bond), so −33 is an opinion of exactly 0.
  const fresh = () => {
    const state = calm(base());
    opinionOf(state, NAMAR, DARA, -33);
    return state;
  };
  const near = fresh();
  near.plotRngState = seedBefore(edgeAt(0.08) - 1);
  step(near);
  const affairs = near.secrets.filter((item) => item.type === 'affair' && item.subjectId === NAMAR);
  assert.equal(affairs.length, 1);
  assert.deepEqual([affairs[0].holderIds, affairs[0].evidence, affairs[0].exposed], [[NAMAR], 'weak', false]);
  assert.doesNotThrow(() => normalizeCharacterSystem(copy(near)));
  const far = fresh();
  far.plotRngState = seedBefore(edgeAt(0.08));
  step(far);
  assert.equal(far.secrets.filter((item) => item.subjectId === NAMAR).length, 0);
  // An opinion of 1 or more is not enough, and a content spouse costs no draw.
  const kind = calm(base());
  opinionOf(kind, NAMAR, DARA, -32);
  kind.plotRngState = seedBefore(edgeAt(0.08) - 1);
  const draw = kind.plotRngState;
  step(kind);
  assert.equal(kind.secrets.filter((item) => item.subjectId === NAMAR).length, 0);
  assert.equal(kind.plotRngState, draw);
  // An unexposed affair is not repeated, and costs no draw either; an exposed one frees the person for a second.
  const count = (state) => state.secrets.filter((item) => item.type === 'affair' && item.subjectId === NAMAR).length;
  const repeated = copy(near);
  repeated.plotRngState = seedBefore(edgeAt(0.08) - 1);
  const before = repeated.plotRngState;
  step(repeated);
  assert.equal(count(repeated), 1);
  assert.equal(repeated.plotRngState, before);
  const out = copy(repeated);
  exposeSecret(out, out.secrets.find((item) => item.type === 'affair' && item.subjectId === NAMAR).id);
  step(out);
  assert.equal(count(out), 2);
});

test('the controlled family, widowed spouses and the seeded chancellor affair are left alone', () => {
  const state = calm(base());
  opinionOf(state, SERA, TAREK, -40);
  opinionOf(state, BAREK, 'person-2-3', -40);
  opinionOf(state, 'person-3-0', 'person-3-1', -40);
  state.people['person-3-1'].diedAt = state.date;
  const { plotRngState } = state;
  step(state);
  assert.equal(state.secrets.length, 1, 'only the seeded chancellor affair exists');
  assert.equal(state.plotRngState, plotRngState, 'nobody qualified, so nothing was drawn');
});

test('the step touches neither the main stream nor the action stream', () => {
  const state = hostile(base(), NAMAR);
  opinionOf(state, BAREK, DANEL, -80);
  opinionOf(state, DANEL, BAREK, -80);
  opinionOf(state, NAMAR, DARA, -33);
  state.plotRngState = seedBefore(edgeAt(0.01) - 1);
  const { rngState, actionRngState, plotRngState } = state;
  step(state);
  assert.ok(state.schemes.length >= 1, 'the step did something');
  assert.equal(state.rngState, rngState);
  assert.equal(state.actionRngState, actionRngState);
  assert.notEqual(state.plotRngState, plotRngState);
});

test('a year in the calendar starts the plot, and its rumors are heard as an NPC scheme', () => {
  const state = base();
  state.plotRngState = plotSeedWhere(1, ([draw]) => draw * 100 < 21);
  const year = advance(state, state.nextAnnualDate);
  const [scheme] = year.schemes;
  assert.ok(scheme, 'the Namar plot started in the annual step');
  assert.deepEqual([scheme.actionId, scheme.actorId, scheme.targetIds, scheme.playerControlled, scheme.startedAt], ['undermine', NAMAR, [REP], false, year.date]);
  assert.equal(scheme.commandId, `npc-plot:${year.date}:1`);
  assert.doesNotThrow(() => normalizeCharacterSystem(copy(year)));
  // One month on: no discovery (an action draw above the chance), a plot draw that the representative hears.
  const heard = copy(year);
  heard.actionRngState = actionSeedWhere(1, ([draw]) => draw >= 40);
  heard.plotRngState = plotSeedWhere(3, ([hear]) => hear * 100 < 9);
  const month = advance(heard, addGameMonths(year.date, 1));
  const rumor = month.rumors.find((item) => item.sourceId === scheme.id);
  assert.ok(rumor, 'the plot is rumored');
  assert.equal(rumor.sourceKind, 'scheme');
  assert.equal(month.schemes[0].playerControlled, false);
});

// A plot of the given kind in a state, found by the target's family on its first monthly check.
function uncovered({ mode, familyId, actionId, actorId, targetId }) {
  const state = createCharacterSystem({ seed: 321, ...(mode ? { mode, familyId } : {}) });
  plant(state, { actionId, actorId, targetIds: [targetId] });
  const found = advance(withSeed(state, actionSeedWhere(1, ([draw]) => draw < 3)), MONTH);
  assert.equal(found.schemes[0].status, 'discovered');
  return found;
}
const storyOf = (state) => state.stories.find((item) => item.type === 'plot_uncovered');
const choose = (state, choiceId) => ok(run(state, 'resolve_story', { storyId: storyOf(state).id, choiceId }));

test('the player can uncover an NPC plot: the secret turns strong, the family learns it and a story opens', () => {
  const found = uncovered({ actionId: 'poison', actorId: NAMAR, targetId: REP });
  const scheme = found.schemes[0];
  const story = storyOf(found);
  assert.ok(story);
  assert.deepEqual([story.status, story.actorId, story.targetId, story.knownBy, story.secretId, story.schemeId, story.dueAt], ['open', NAMAR, REP, 'public', scheme.secretId, scheme.id, addGameMonths(MONTH, 12)]);
  const secret = found.secrets.find((item) => item.id === scheme.secretId);
  assert.deepEqual([secret.evidence, secret.exposed], ['strong', false]);
  assert.deepEqual(secret.holderIds, [NAMAR, REP], 'the plotter, then the target who is also the representative');
  const view = getCharacterPresentation(found).stories.find((item) => item.id === story.id);
  assert.deepEqual(view.choices.map((choice) => choice.id), ['imprison', 'expose', 'hook', 'ignore']);
  assert.deepEqual(view.choices.map((choice) => choice.disabledReason), ['', '', '', '']);
  for (const choice of view.choices) assert.deepEqual(Object.keys(choice).sort(), ['cost', 'description', 'disabledReason', 'id', 'label', 'stress']);
  assert.doesNotThrow(() => normalizeCharacterSystem(copy(found)));
});

test('imprison puts the plotter in prison as a lawful arrest', () => {
  const found = uncovered({ actionId: 'poison', actorId: NAMAR, targetId: REP });
  const after = choose(found, 'imprison');
  assert.equal(isImprisoned(after, NAMAR), true);
  const record = after.prisoners.find((item) => item.personId === NAMAR);
  assert.deepEqual([record.captorFamilyId, record.status], [ARELS, 'held']);
  assert.equal(after.realm.legitimacy, found.realm.legitimacy, 'a lawful arrest costs no legitimacy');
  assert.match(after.log.find((item) => item.type === 'imprisonment').description, /efter ett avslöjat brott/);
  assert.equal(storyOf(after).status, 'resolved');
  assert.equal(storyOf(after).choiceId, 'imprison');
});

test('imprison is disabled and refused when the representative is not the ruler', () => {
  const found = uncovered({ mode: 'family', familyId: NAMARS, actionId: 'poison', actorId: TAREK, targetId: 'person-1-0' });
  const story = storyOf(found);
  const choices = getCharacterPresentation(found).stories.find((item) => item.id === story.id).choices;
  assert.equal(choices.find((choice) => choice.id === 'imprison').disabledReason, RULER_ONLY);
  assert.equal(run(found, 'resolve_story', { storyId: story.id, choiceId: 'imprison' }).ok, false);
  // The same decision through the module, with a stand-in representative in a realm campaign.
  const realm = uncovered({ actionId: 'undermine', actorId: NAMAR, targetId: REP });
  const hooks = { ...actionHooks(realm), activeRepresentative: () => realm.people[SERA] };
  assert.equal(plotUncoveredChoices(realm, storyOf(realm), hooks).find((choice) => choice.id === 'imprison').disabledReason, RULER_ONLY);
});

test('expose names treason when the target is the ruler, and Arel turns against the plotter', () => {
  const found = uncovered({ actionId: 'undermine', actorId: NAMAR, targetId: REP });
  const after = choose(found, 'expose');
  const secret = after.secrets.find((item) => item.id === found.schemes[0].secretId);
  assert.equal(secret.exposed, true);
  const event = after.log.find((item) => item.type === 'crime_exposed');
  assert.equal(event.title, 'Förräderi avslöjat');
  assert.equal(after.relations[`${REP}:${NAMAR}`].causes.find((cause) => cause.label === 'Förräderi').amount, -30, 'the victim family reacts');
  assert.ok(after.stories.some((item) => item.type === 'punish_crime' && item.actorId === NAMAR), 'the exposed crime opens a case for the ruler');
  assert.equal(after.realm.legitimacy, found.realm.legitimacy);
});

test('expose names attempted murder for a poisoning of someone other than the ruler', () => {
  const found = uncovered({ mode: 'family', familyId: NAMARS, actionId: 'poison', actorId: TAREK, targetId: 'person-1-0' });
  const after = choose(found, 'expose');
  assert.equal(after.secrets.find((item) => item.id === found.schemes[0].secretId).exposed, true);
  assert.equal(after.log.find((item) => item.type === 'crime_exposed').title, 'Mordförsök avslöjat');
});

test('expose of an undermine against someone other than the ruler makes the secret public and nothing more', () => {
  const found = uncovered({ mode: 'family', familyId: NAMARS, actionId: 'undermine', actorId: TAREK, targetId: 'person-1-0' });
  const after = choose(found, 'expose');
  assert.equal(after.secrets.find((item) => item.id === found.schemes[0].secretId).exposed, true);
  assert.equal(after.log.some((item) => item.type === 'crime_exposed'), false);
  assert.equal(after.stories.some((item) => item.type === 'punish_crime'), false);
});

// The ruler jails Namar through the catalog entry at a seed that lets it succeed.
function jail(state) {
  const intent = { actionId: 'imprison', actorId: REP, targetIds: [NAMAR] };
  const est = estimateCharacterAction(state, intent);
  assert.equal(est.ok, true, est.reason);
  const seed = actionSeedWhere(2, ([success, secrecy]) => ['clean_success', 'exposed_success'].includes(tierFor(success, secrecy, est.success.value, est.secrecy.value)));
  return ok(run(withSeed(state, seed), 'attempt_action', intent));
}

test('a plot exposed as treason makes the later arrest lawful, and a bare suspect stays unlawful', () => {
  const found = uncovered({ actionId: 'undermine', actorId: NAMAR, targetId: REP });
  const control = jail(found);
  assert.equal(isImprisoned(control, NAMAR), true);
  assert.equal(control.realm.legitimacy, found.realm.legitimacy - 5, 'an arrest on suspicion alone costs legitimacy');
  const exposed = choose(found, 'expose');
  assert.equal(isLawfulSubject(exposed, NAMAR), true);
  const jailed = jail(exposed);
  assert.equal(isImprisoned(jailed, NAMAR), true);
  assert.equal(jailed.realm.legitimacy, exposed.realm.legitimacy, 'a traitor exposed in public is jailed lawfully');
  assert.match(jailed.log.findLast((item) => item.type === 'imprisonment').description, /efter ett avslöjat brott/);
});

test('an exposed poisoning makes the poisoner, not the victim, a lawful subject', () => {
  const found = uncovered({ actionId: 'poison', actorId: NAMAR, targetId: REP });
  const exposed = choose(found, 'expose');
  assert.equal(exposed.memories.some((item) => item.type === 'crime' && item.participants[0] === NAMAR && item.participants[1] === REP), true);
  assert.equal(isLawfulSubject(exposed, NAMAR), true);
  assert.equal(isLawfulSubject(exposed, REP), false, 'the victim is the second participant of the crime memory');
  assert.equal(isLawfulSubject(found, NAMAR), false, 'nothing is public before the choice');
});

test('the charge is fixed when the plot is uncovered, even if the ruler dies before the choice', () => {
  const found = uncovered({ actionId: 'undermine', actorId: NAMAR, targetId: REP });
  assert.equal(storyOf(found).targetWasRuler, true);
  const dead = copy(found);
  actionHooks(dead).kill([REP], [], 'Sjukdom');
  assert.notEqual(dead.offices.ruler.holderId, REP, 'the crown has passed');
  const after = choose(dead, 'expose');
  assert.equal(after.log.find((item) => item.type === 'crime_exposed').title, 'Förräderi avslöjat');
  const family = uncovered({ mode: 'family', familyId: NAMARS, actionId: 'undermine', actorId: TAREK, targetId: 'person-1-0' });
  assert.equal(storyOf(family).targetWasRuler, false);
});

test('a crime case opened mid-month lapses on the same day in a long jump and in monthly stepping', () => {
  const dom = (state) => ({ ...copy(state), revision: 0, appliedCommandIds: [] });
  let found = uncovered({ actionId: 'undermine', actorId: NAMAR, targetId: REP });
  found = advance(found, '-0300-02-15');
  found = choose(found, 'expose');
  const crimeCase = found.stories.find((item) => item.type === 'punish_crime');
  assert.ok(crimeCase, 'the exposed treason opens a case');
  const end = addGameMonths(found.date, 30);
  const whole = advance(copy(found), end);
  let split = copy(found);
  for (let m = 1; m <= 30; m++) split = normalizeCharacterSystem(copy(advance(split, addGameMonths(found.date, m))));
  const closed = (state) => state.stories.find((item) => item.id === crimeCase.id);
  assert.equal(closed(whole).status, 'closed');
  assert.equal(closed(whole).resolvedAt, closed(split).resolvedAt);
  assert.deepEqual(dom(split), dom(whole));
  assert.equal(closed(whole).resolvedAt, crimeCase.dueAt, 'closed on its due date');
});

test('hook gives the representative a strong hook over the plotter that an action can use', () => {
  const found = uncovered({ actionId: 'poison', actorId: NAMAR, targetId: REP });
  const after = choose(found, 'hook');
  const hook = after.hooks.find((item) => item.ownerId === REP && item.targetId === NAMAR);
  assert.ok(hook);
  assert.deepEqual([hook.strength, hook.usedAt, hook.causeId], ['strong', null, storyOf(found).causeId]);
  assert.deepEqual(activeHooks(after, REP, NAMAR).map((item) => item.id), [hook.id]);
  assert.doesNotThrow(() => normalizeCharacterSystem(copy(after)));
});

test('ignore changes nothing but the story', () => {
  const found = uncovered({ actionId: 'poison', actorId: NAMAR, targetId: REP });
  const after = choose(found, 'ignore');
  const strip = (state) => { const { stories: _stories, log: _log, sequence: _sequence, ...rest } = worldContent(state); return rest; };
  assert.deepEqual(strip(after), strip(found));
  assert.equal(isImprisoned(after, NAMAR), false);
  assert.equal(storyOf(after).status, 'resolved');
});

test('the story lapses after a year, and when the plotter dies or is jailed', () => {
  const found = uncovered({ actionId: 'poison', actorId: NAMAR, targetId: REP });
  const year = advance(found, addGameMonths(found.date, 12));
  assert.equal(storyOf(year).status, 'closed');
  assert.equal(storyOf(year).resolution, 'Ärendet förföll utan beslut.');
  const jailed = copy(found);
  imprisonPerson(jailed, NAMAR, ARELS, [], actionHooks(jailed), { lawful: true });
  assert.equal(advance(jailed, addGameMonths(found.date, 1)).stories.find((item) => item.type === 'plot_uncovered').status, 'closed');
  // Nothing else falls due for a long while, so the due date itself is the next step (a long jump then closes the story on the same day as monthly stepping).
  const quiet = copy(found);
  quiet.nextAnnualDate = addGameMonths(found.date, 60);
  assert.equal(compareGameDates(getNextCharacterTransitionDate(quiet, addGameMonths(found.date, 24)), storyOf(found).dueAt), 0);
});

test('a discovery that does not concern the controlled family opens no story', () => {
  const otherHouse = createCharacterSystem({ seed: 321 });
  plant(otherHouse, { actorId: BAREK, targetIds: [NAMAR] });
  const own = createCharacterSystem({ seed: 321 });
  plant(own, { actorId: NAMAR, targetIds: [REP], secretId: null });
  const player = createCharacterSystem({ seed: 321 });
  plant(player, { actorId: TAREK, targetIds: [NAMAR], playerControlled: true });
  for (const [name, state] of [['a plot against another house', otherHouse], ['a scheme with no plot secret', own], ['the player\'s own scheme', player]]) {
    const found = advance(withSeed(state, actionSeedWhere(1, ([draw]) => draw < 3)), MONTH);
    assert.equal(found.schemes[0].status, 'discovered', name);
    assert.equal(found.stories.some((item) => item.type === 'plot_uncovered'), false, name);
    const secret = found.secrets.find((item) => item.id === found.schemes[0].secretId);
    if (secret) assert.deepEqual([secret.evidence, secret.holderIds], ['weak', [found.schemes[0].actorId]], name);
  }
});

test('a whole advance equals the same months in single steps with a save in between', () => {
  const dom = (state) => ({ ...copy(state), revision: 0, appliedCommandIds: [] });
  let plots = 0, stories = 0, affairs = 0, resolved = 0;
  for (const k of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const state = hostile(base(), NAMAR, -10);
    opinionOf(state, BAREK, DANEL, -80);
    opinionOf(state, DANEL, BAREK, -80);
    opinionOf(state, NAMAR, DARA, -33);
    if (k % 2) plant(state, { actorId: KELAN, targetIds: [REP], dueAt: addGameMonths(state.date, 40) });
    state.plotRngState = Math.imul(k, 2654435761) >>> 0 || 1;
    state.actionRngState = Math.imul(k + 99, 2246822519) >>> 0 || 1;
    const start = normalizeCharacterSystem(copy(state));
    const whole = advance(copy(start), addGameMonths(start.date, 38));
    let split = copy(start);
    for (let m = 1; m <= 38; m++) split = normalizeCharacterSystem(copy(advance(split, addGameMonths(start.date, m))));
    assert.deepEqual(dom(split), dom(whole), `seed ${k}`);
    plots += whole.schemes.filter((scheme) => scheme.commandId?.startsWith('npc-plot:')).length;
    resolved += whole.schemes.filter((scheme) => scheme.commandId?.startsWith('npc-plot:') && scheme.status === 'resolved').length;
    stories += whole.stories.filter((item) => item.type === 'plot_uncovered').length;
    affairs += whole.secrets.filter((item) => item.type === 'affair' && item.subjectId === NAMAR).length;
  }
  assert.ok(plots > 0, 'the comparison covered real NPC plots');
  assert.ok(resolved > 0, 'and a resolved one, so the due-date resolution is covered');
  assert.ok(stories > 0, 'and an uncovered one');
  assert.ok(affairs > 0, 'and an affair');
});

test('validateSchemes accepts a plot secret about the actor and refuses any other', () => {
  const state = base();
  const scheme = plant(state);
  assert.doesNotThrow(() => normalizeCharacterSystem(copy(state)));
  const forge = (change) => { const forged = copy(state); change(forged.schemes[0], forged); return forged; };
  const cases = {
    'a number': (item) => { item.secretId = 5; },
    'an unknown id': (item) => { item.secretId = 'secret-999'; },
    'a secret about someone else': (item, forged) => { item.secretId = createSecret(forged, { type: 'plot', subjectId: BAREK, holderIds: [BAREK] }).id; },
    'null': (item) => { item.secretId = null; },
  };
  for (const [name, change] of Object.entries(cases)) assert.throws(() => normalizeCharacterSystem(forge(change)), /plans hemlighet/, name);
  // means.secretId is blackmail leverage, a different field with its own check.
  const leverage = copy(state);
  delete leverage.schemes[0].secretId;
  leverage.schemes[0].means.secretId = scheme.secretId;
  assert.doesNotThrow(() => normalizeCharacterSystem(leverage));
});

test('the model is offered no contested action that an NPC cannot take', () => {
  const prompt = buildCharacterPromptContext(base());
  const listed = JSON.parse(/"contestedActions":(\[.*?\])\}/s.exec(prompt)[1]).map((entry) => entry.id);
  assert.equal(listed.includes('imprison'), false, 'imprison needs the ruler and the realm treasury');
  assert.deepEqual(listed, Object.values(ACTION_CATALOG).filter((entry) => !entry.actorOffice && entry.cost.wallet !== 'realm' && !requiresOf(entry).length).map((entry) => entry.id));
  assert.ok(listed.includes('poison') && listed.includes('undermine'));
});
