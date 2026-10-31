import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterSystem, getAvailableCharacterActions, getCatalogActions, getCharacterAge } from './index.js';
import { ACTION_CATALOG, ACTION_CATEGORIES, EFFECT_KINDS, MAX_AGENTS, MAX_EXTRA_SILVER, TIER_IDS, buildCatalogActions, effectDefault } from './actionCatalog.js';
import { SKILL_LABELS, TRAITS } from './content.js';
import { STAFF_ROLES } from './courtStaff.js';
import { HOOK_STRENGTHS, SECRET_TYPES } from './secrets.js';

const plain = (state) => JSON.parse(JSON.stringify(state));
const streams = (state) => [state.rngState, state.actionRngState];
const fresh = () => createCharacterSystem({ seed: 321 });
const contested = (list) => list.filter((entry) => entry.mode === 'contested');
const find = (list, id) => list.find((entry) => entry.catalogId === id);
const ROLES = ['actor', 'target'];
const SWEDISH = /[åäöÅÄÖ]|silver|handling|företrädare|familj/i;
const deepFrozen = (value) => value === null || typeof value !== 'object' || (Object.isFrozen(value) && Object.values(value).every(deepFrozen));

test('the catalog holds exactly the two contested actions of Phase 1', () => {
  assert.deepEqual(Object.keys(ACTION_CATALOG), ['sway', 'undermine']);
  for (const [id, entry] of Object.entries(ACTION_CATALOG)) {
    assert.equal(entry.id, id);
    assert.equal(entry.mode, 'contested');
    assert.ok(ACTION_CATEGORIES.includes(entry.category), `${id}: category`);
    assert.ok(['personal', 'household', 'royal'].includes(entry.actorScope), `${id}: actorScope`);
    assert.equal(entry.target, 'person');
    for (const key of ['skill', 'defenseSkill', 'secrecySkill']) assert.ok(Object.hasOwn(SKILL_LABELS, entry[key]), `${id}: ${key} is a known skill`);
    for (const side of ROLES) for (const [trait, value] of Object.entries(entry.traitModifiers[side])) {
      assert.ok(Object.hasOwn(TRAITS, trait), `${id}: ${side} trait ${trait} exists`);
      assert.ok(Number.isInteger(value) && value !== 0, `${id}: ${trait} is a non-zero integer`);
    }
    assert.deepEqual(Object.keys(entry.traitModifiers), ROLES);
    assert.deepEqual(Object.keys(entry.cost), ['orders', 'silver', 'wallet', 'stressTag']);
    assert.ok(Number.isInteger(entry.cost.orders) && entry.cost.orders >= 1);
    assert.ok(Number.isInteger(entry.cost.silver) && entry.cost.silver >= 0);
    assert.ok(['family', 'realm'].includes(entry.cost.wallet));
    assert.ok(Number.isInteger(entry.durationMonths) && entry.durationMonths >= 0);
    for (const key of ['baseSuccess', 'baseSecrecy']) assert.ok(Number.isInteger(entry[key]) && entry[key] >= 5 && entry[key] <= 95, `${id}: ${key} within the odds range`);
    assert.equal(typeof entry.utility, 'string');
    assert.ok(entry.utility.length > 0 && !/[åäöÅÄÖ]/.test(entry.utility), `${id}: utility is short English text`);
    assert.match(entry.label, /\S/);
    assert.match(entry.description, /\S/);
  }
});

test('sway and undermine carry the exact values of the design', () => {
  const { sway, undermine } = ACTION_CATALOG;
  assert.equal(sway.label, 'Påverka');
  assert.equal(undermine.label, 'Undergräv');
  assert.deepEqual([sway.category, sway.skill, sway.defenseSkill, sway.secrecySkill, sway.durationMonths, sway.baseSuccess, sway.baseSecrecy], ['diplomacy', 'diplomacy', 'diplomacy', 'diplomacy', 0, 50, 70]);
  assert.deepEqual(sway.cost, { orders: 1, silver: 5, wallet: 'family', stressTag: 'duty' });
  assert.deepEqual(sway.traitModifiers, { actor: { gregarious: 6, honest: 3 }, target: { paranoid: -8, trusting: 8 } });
  assert.deepEqual([undermine.category, undermine.skill, undermine.defenseSkill, undermine.secrecySkill, undermine.durationMonths, undermine.baseSuccess, undermine.baseSecrecy], ['intrigue', 'intrigue', 'intrigue', 'intrigue', 3, 45, 60]);
  assert.deepEqual(undermine.cost, { orders: 1, silver: 15, wallet: 'family', stressTag: 'risky' });
  assert.deepEqual(undermine.traitModifiers, { actor: { deceitful: 8, honest: -8 }, target: { paranoid: -10 } });
});

test('the outcome envelopes match the design tier by tier', () => {
  const opinion = (min, max) => ({ kind: 'opinion', from: 'target', to: 'actor', min, max });
  assert.deepEqual(ACTION_CATALOG.sway.tiers, {
    clean_success: { effects: [opinion(10, 25)] },
    exposed_success: { effects: [opinion(10, 25)] },
    quiet_failure: { effects: [] },
    exposed_failure: { effects: [opinion(-15, -5)] },
    backfire: { effects: [opinion(-30, -15), { kind: 'stress', who: 'actor', min: 5, max: 10 }] },
  });
  const loss = { kind: 'influence', family: 'target', min: -10, max: -4 };
  const plot = (holders) => ({ kind: 'secret', type: 'plot', subject: 'actor', holders });
  const { tiers } = ACTION_CATALOG.undermine;
  const memoryOf = (tier) => tiers[tier].effects.find((effect) => effect.kind === 'memory');
  assert.deepEqual(tiers.clean_success.effects, [loss, memoryOf('clean_success'), plot(['actor'])]);
  assert.equal(memoryOf('clean_success').visibility, 'private');
  assert.deepEqual(tiers.exposed_success.effects.map((e) => e.kind), ['influence', 'opinion', 'memory', 'secret']);
  assert.deepEqual(tiers.exposed_success.effects[0], loss);
  assert.deepEqual(tiers.exposed_success.effects[1], opinion(-30, -15));
  assert.equal(tiers.exposed_success.effects[2].visibility, 'public');
  assert.deepEqual(tiers.exposed_success.effects[3], plot(['actor', 'target']));
  assert.deepEqual(tiers.quiet_failure, { effects: [] });
  assert.deepEqual(tiers.exposed_failure.effects.map((e) => e.kind), ['opinion', 'memory']);
  assert.deepEqual(tiers.exposed_failure.effects[0], opinion(-30, -15));
  assert.equal(tiers.exposed_failure.effects[1].visibility, 'public');
  assert.deepEqual(tiers.backfire.effects, [
    { kind: 'influence', family: 'actor', min: -8, max: -3 },
    opinion(-40, -20),
    { kind: 'stress', who: 'actor', min: 5, max: 15 },
    { kind: 'hook', owner: 'target', over: 'actor', strength: 'weak' },
  ]);
});

test('every contested entry has all five tiers and only well-formed, known effect kinds', () => {
  assert.deepEqual(TIER_IDS, ['clean_success', 'exposed_success', 'quiet_failure', 'exposed_failure', 'backfire']);
  assert.deepEqual(EFFECT_KINDS, ['opinion', 'influence', 'stress', 'hook', 'secret', 'memory']);
  for (const [id, entry] of Object.entries(ACTION_CATALOG)) {
    assert.deepEqual(Object.keys(entry.tiers), TIER_IDS, `${id}: tiers keyed by the five tier ids in order`);
    for (const tier of TIER_IDS) {
      const envelope = entry.tiers[tier];
      assert.deepEqual(Object.keys(envelope), ['effects'], `${id}.${tier}: envelope holds only effects`);
      assert.ok(Array.isArray(envelope.effects));
      for (const effect of envelope.effects) {
        const where = `${id}.${tier}.${effect.kind}`;
        assert.ok(EFFECT_KINDS.includes(effect.kind), `${where}: known kind`);
        if (['opinion', 'influence', 'stress'].includes(effect.kind)) {
          assert.ok(Number.isInteger(effect.min) && Number.isInteger(effect.max), `${where}: integer range`);
          assert.ok(effect.min <= effect.max, `${where}: min <= max`);
        }
        if (effect.kind === 'opinion') { assert.ok(ROLES.includes(effect.from) && ROLES.includes(effect.to) && effect.from !== effect.to, `${where}: from and to`); assert.deepEqual(Object.keys(effect), ['kind', 'from', 'to', 'min', 'max']); }
        if (effect.kind === 'influence') { assert.ok(ROLES.includes(effect.family), `${where}: family`); assert.deepEqual(Object.keys(effect), ['kind', 'family', 'min', 'max']); }
        if (effect.kind === 'stress') { assert.ok(ROLES.includes(effect.who), `${where}: who`); assert.ok(effect.min >= 0, `${where}: stress never relieves`); assert.deepEqual(Object.keys(effect), ['kind', 'who', 'min', 'max']); }
        if (effect.kind === 'hook') { assert.ok(ROLES.includes(effect.owner) && ROLES.includes(effect.over) && effect.owner !== effect.over, `${where}: owner and over`); assert.ok(HOOK_STRENGTHS.includes(effect.strength), `${where}: strength`); assert.deepEqual(Object.keys(effect), ['kind', 'owner', 'over', 'strength']); }
        if (effect.kind === 'secret') { assert.ok(SECRET_TYPES.includes(effect.type), `${where}: secret type`); assert.ok(ROLES.includes(effect.subject), `${where}: subject`); assert.ok(effect.holders.length > 0 && new Set(effect.holders).size === effect.holders.length && effect.holders.every((role) => ROLES.includes(role)), `${where}: holders`); assert.deepEqual(Object.keys(effect), ['kind', 'type', 'subject', 'holders']); }
        if (effect.kind === 'memory') { assert.ok(['public', 'private'].includes(effect.visibility), `${where}: visibility`); assert.match(effect.title, /[åäö]/i, `${where}: Swedish title`); assert.deepEqual(Object.keys(effect), ['kind', 'visibility', 'title']); }
      }
    }
  }
});

test('the catalog is deeply frozen so no consumer can edit the rules', () => {
  assert.ok(deepFrozen(ACTION_CATALOG));
  assert.ok(Object.isFrozen(TIER_IDS) && Object.isFrozen(EFFECT_KINDS) && Object.isFrozen(ACTION_CATEGORIES));
});

test('effectDefault is the rounded midpoint of a ranged effect and null for the rest', () => {
  assert.equal(effectDefault({ kind: 'opinion', from: 'target', to: 'actor', min: 10, max: 25 }), 18);
  assert.equal(effectDefault({ kind: 'influence', family: 'target', min: -10, max: -4 }), -7);
  assert.equal(effectDefault({ kind: 'stress', who: 'actor', min: 5, max: 10 }), 8);
  // Math.round sends .5 towards plus infinity, so a negative midpoint of -22.5 becomes -22.
  assert.equal(effectDefault({ kind: 'opinion', from: 'target', to: 'actor', min: -30, max: -15 }), -22);
  assert.equal(effectDefault({ kind: 'opinion', from: 'target', to: 'actor', min: 4, max: 4 }), 4);
  assert.equal(effectDefault({ kind: 'hook', owner: 'target', over: 'actor', strength: 'weak' }), null);
  assert.equal(effectDefault({ kind: 'memory', visibility: 'public', title: 'Ett rykte' }), null);
  for (const entry of Object.values(ACTION_CATALOG)) for (const tier of TIER_IDS) for (const effect of entry.tiers[tier].effects) {
    const value = effectDefault(effect);
    if (['opinion', 'influence', 'stress'].includes(effect.kind)) assert.ok(value >= effect.min && value <= effect.max, `${effect.kind} default inside its range`);
  }
});

test('getCatalogActions lists every command once, then sway and undermine', () => {
  const state = fresh();
  const commands = getAvailableCharacterActions(state);
  assert.ok(commands.length > 5, 'the fixture offers real commands');
  const list = getCatalogActions(state);
  assert.deepEqual(list.map((entry) => entry.catalogId), [...commands.map((action) => action.type), 'sway', 'undermine']);
  assert.equal(new Set(list.map((entry) => entry.catalogId)).size, list.length, 'each catalog id appears once');
  list.slice(0, commands.length).forEach((entry, index) => {
    const { catalogId, mode, ...rest } = entry;
    assert.equal(catalogId, commands[index].type);
    assert.equal(mode, 'command');
    assert.deepEqual(rest, commands[index], 'a command entry is the command action plus catalogId and mode');
  });
  assert.deepEqual(contested(list).map((entry) => entry.catalogId), ['sway', 'undermine']);
});

test('a contested entry carries its rules and the target, silver and agent fields', () => {
  const state = fresh();
  const list = getCatalogActions(state);
  const representative = state.people['person-0-0'];
  const adults = Object.values(state.people).filter((p) => !p.diedAt && p.id !== representative.id && getCharacterAge(p, state.date) >= 18);
  assert.ok(adults.length > 10);
  for (const id of ['sway', 'undermine']) {
    const entry = find(list, id);
    assert.equal(entry.mode, 'contested');
    assert.equal(entry.disabledReason, '', `${id}: payable with the starting treasury`);
    const { catalogId, fields, disabledReason, ...rules } = entry;
    assert.equal(catalogId, id);
    assert.deepEqual(rules, ACTION_CATALOG[id], 'the entry carries every rule of the catalog');
    assert.deepEqual(fields.map((field) => [field.key, field.type]), [['targetId', 'select'], ['silver', 'number'], ['agentRoles', 'multiselect']]);
    const [target, silver, agents] = fields;
    assert.equal(target.label, 'Mål');
    assert.ok(target.options.length > 0);
    assert.ok(target.options.every((option) => option.value && option.label && option.value !== representative.id), 'the representative is never a target');
    // Undermine never targets the actor's own family; sway may.
    const eligible = adults.filter((person) => entry.targetFamily !== 'other' || person.familyId !== representative.familyId);
    for (const person of eligible) assert.ok(target.options.some((option) => option.value === person.id), `${person.id} can be a target`);
    assert.equal(target.options.length, eligible.length, `${id}: only eligible people are offered`);
    for (const option of target.options) { const person = state.people[option.value]; assert.ok(person && !person.diedAt, `${option.value} lives`); }
    assert.deepEqual([silver.label, silver.min, silver.max], ['Extra silver', 0, 60]);
    assert.deepEqual([agents.label, agents.max], ['Agenter', 2]);
    assert.deepEqual(agents.options, Object.entries(STAFF_ROLES).map(([value, label]) => ({ value, label })));
  }
});

test('children and the dead are never offered as targets', () => {
  const state = fresh();
  state.people['person-1-1'].diedAt = state.date;
  const ids = find(getCatalogActions(state), 'sway').fields[0].options.map((option) => option.value);
  assert.ok(!ids.includes('person-1-1'), 'a dead adult');
  assert.ok(!ids.includes('person-0-5') && !ids.includes('person-1-4'), 'children under 18');
  assert.ok(ids.includes('person-1-0'));
});

test('a family with 0 silver sees both contested actions with a Swedish reason', () => {
  const state = fresh();
  state.families['family-arel'].treasury = 0;
  const list = getCatalogActions(state);
  for (const id of ['sway', 'undermine']) {
    const entry = find(list, id);
    assert.ok(entry, `${id} is never hidden`);
    assert.match(entry.disabledReason, SWEDISH);
    assert.ok(entry.disabledReason.endsWith('.'));
  }
  assert.equal(find(list, 'undermine').disabledReason, 'Det behövs 15 silver; tillgängligt 0.');
  assert.equal(find(list, 'sway').disabledReason, 'Det behövs 5 silver; tillgängligt 0.');
});

test('the silver check follows the cost of each action at its boundary', () => {
  const state = fresh();
  state.families['family-arel'].treasury = 14.9;
  let list = getCatalogActions(state);
  assert.equal(find(list, 'sway').disabledReason, '');
  assert.equal(find(list, 'undermine').disabledReason, 'Det behövs 15 silver; tillgängligt 14.');
  state.families['family-arel'].treasury = 15;
  list = getCatalogActions(state);
  assert.equal(find(list, 'undermine').disabledReason, '');
});

test('the silver check uses the family the player controls, not the realm treasury', () => {
  const state = createCharacterSystem({ seed: 321, mode: 'family', familyId: 'family-namar' });
  state.families['family-namar'].treasury = 3;
  state.families['family-arel'].treasury = 500;
  state.realm.treasury = 500;
  const list = getCatalogActions(state);
  assert.equal(find(list, 'sway').disabledReason, 'Det behövs 5 silver; tillgängligt 3.');
  assert.ok(!find(list, 'sway').fields[0].options.some((option) => option.value === state.families['family-namar'].headId), 'the Namar representative is not a target');
  assert.ok(find(list, 'sway').fields[0].options.some((option) => option.value === 'person-0-0'));
});

test('no orders left disables the contested actions with the command wording', () => {
  const state = fresh();
  state.actionPoints = 0;
  for (const id of ['sway', 'undermine']) assert.equal(find(getCatalogActions(state), id).disabledReason, 'Årets handlingsutrymme är slut. För tiden framåt.');
});

test('with no capable representative the contested entries stay listed and say why', () => {
  const state = fresh();
  state.people[state.families['family-arel'].headId].diedAt = state.date;
  assert.deepEqual(getAvailableCharacterActions(state), [], 'the command menu is empty without a representative');
  const list = getCatalogActions(state);
  assert.deepEqual(list.map((entry) => entry.catalogId), ['sway', 'undermine']);
  for (const entry of list) assert.equal(entry.disabledReason, 'Familjen saknar en handlingsförmögen företrädare.');
});

test('a guardian who exercises a family mandate is the representative and is excluded as a target', () => {
  const state = createCharacterSystem({ seed: 321, mode: 'family', familyId: 'family-arel' });
  const family = state.families['family-arel'];
  family.headId = 'person-0-4';
  family.guardianId = 'person-0-2';
  state.regencies['family:family-arel'] = { id: 'family:family-arel', principalId: 'person-0-4', regentId: 'person-0-2', phase: 'minority', startedAt: state.date, grants: [], requestAfter: {}, handoverDueAt: null };
  const commands = getAvailableCharacterActions(state);
  assert.equal(commands.find((action) => action.type === 'rest').actorId, 'person-0-2', 'the command menu also acts through the guardian');
  const entry = find(getCatalogActions(state), 'sway');
  assert.equal(entry.disabledReason, '');
  const ids = entry.fields[0].options.map((option) => option.value);
  assert.ok(!ids.includes('person-0-2'), 'the guardian is the actor');
  assert.ok(!ids.includes('person-0-4'), 'the child head is under age');
  assert.ok(ids.includes('person-0-0') && ids.includes('person-1-0'));
});

test('an ended campaign keeps the entries and gives the ending reason', () => {
  const state = fresh();
  state.status = { ended: true, reason: 'Riket saknar en giltig fortsättning.' };
  const list = getCatalogActions(state);
  assert.deepEqual(list.map((entry) => entry.catalogId), ['sway', 'undermine']);
  for (const entry of list) assert.equal(entry.disabledReason, 'Riket saknar en giltig fortsättning.');
  state.status = { ended: true, reason: '' };
  assert.equal(find(getCatalogActions(state), 'sway').disabledReason, 'Kampanjen är avslutad.');
});

test('calling it twice leaves the state deep-equal and both random streams unchanged', () => {
  const state = fresh();
  const before = plain(state), rng = streams(state);
  const first = getCatalogActions(state);
  const second = getCatalogActions(state);
  assert.deepEqual(plain(state), before);
  assert.deepEqual(streams(state), rng);
  assert.deepEqual(first, second);
  assert.deepEqual(plain(first), plain(second), 'the result survives a JSON round trip');
});

test('the result does not alias the frozen catalog or the command list', () => {
  const state = fresh();
  const commands = getAvailableCharacterActions(state);
  const list = getCatalogActions(state);
  const sway = find(list, 'sway');
  sway.tiers.clean_success.effects[0].min = 999;
  sway.cost.silver = 999;
  assert.equal(ACTION_CATALOG.sway.tiers.clean_success.effects[0].min, 10);
  assert.equal(ACTION_CATALOG.sway.cost.silver, 5);
  assert.equal(find(getCatalogActions(state), 'sway').cost.silver, 5);
  const same = buildCatalogActions(state, commands, { representativeId: 'person-0-0', familyId: 'family-arel' });
  same[0].label = 'Ändrad';
  assert.notEqual(commands[0].label, 'Ändrad', 'a command entry is a copy');
});

test('buildCatalogActions takes the representative from its context and refuses to guess', () => {
  const state = fresh();
  const given = buildCatalogActions(state, [], { representativeId: 'person-0-0', familyId: 'family-arel' });
  assert.deepEqual(given.map((entry) => entry.disabledReason), ['', '']);
  const without = buildCatalogActions(state, []);
  assert.deepEqual(without.map((entry) => entry.disabledReason), ['Familjen saknar en handlingsförmögen företrädare.', 'Familjen saknar en handlingsförmögen företrädare.']);
  const child = buildCatalogActions(state, [], { representativeId: 'person-0-5', familyId: 'family-arel' });
  assert.equal(child[0].disabledReason, 'Familjen saknar en handlingsförmögen företrädare.', 'a child cannot exercise a mandate');
  const noFamily = buildCatalogActions(state, [], { representativeId: 'person-0-0', familyId: 'family-missing' });
  assert.equal(noFamily[0].disabledReason, 'Ingen behörig resursägare finns.');
});

test('undermine carries targetFamily other and sway carries none', () => {
  assert.equal(ACTION_CATALOG.undermine.targetFamily, 'other');
  assert.equal(Object.hasOwn(ACTION_CATALOG.sway, 'targetFamily'), false);
  for (const entry of Object.values(ACTION_CATALOG)) if (Object.hasOwn(entry, 'targetFamily')) assert.equal(entry.targetFamily, 'other');
  assert.equal(find(getCatalogActions(fresh()), 'undermine').targetFamily, 'other', 'the listed entry carries the flag');
});

test('the undermine target select leaves out the actor\'s own family while sway keeps it', () => {
  const state = fresh();
  const list = getCatalogActions(state);
  const own = (option) => state.people[option.value].familyId === 'family-arel';
  const undermine = find(list, 'undermine').fields[0].options;
  const sway = find(list, 'sway').fields[0].options;
  assert.ok(undermine.length > 0 && !undermine.some(own), 'no Arel member can be undermined by Arel');
  assert.ok(undermine.some((option) => option.value === 'person-1-0'), 'other houses stay on the list');
  assert.ok(sway.some(own), 'a household member can still be swayed');
  assert.equal(find(list, 'undermine').disabledReason, '');
});

test('undermine is disabled when only the actor\'s own family has eligible people', () => {
  const state = fresh();
  for (const person of Object.values(state.people)) if (person.familyId !== 'family-arel') person.diedAt = state.date;
  const list = getCatalogActions(state);
  assert.equal(find(list, 'sway').disabledReason, '', 'sway still has household targets');
  assert.equal(find(list, 'undermine').disabledReason, 'Ingen behörig deltagare finns.');
  assert.deepEqual(find(list, 'undermine').fields[0].options, []);
});

test('the silver and agent limits of the fields are the exported constants', () => {
  assert.deepEqual([MAX_EXTRA_SILVER, MAX_AGENTS], [60, 2]);
  const [, silver, agents] = find(getCatalogActions(fresh()), 'sway').fields;
  assert.deepEqual([silver.max, agents.max], [MAX_EXTRA_SILVER, MAX_AGENTS]);
});
