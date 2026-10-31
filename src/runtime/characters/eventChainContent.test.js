import assert from 'node:assert/strict';
import test from 'node:test';
import content from './eventChainContent.js';
import { EVENT_CHAIN_ROLES } from './eventChains.js';

const templateIds = [
  'sickroom_seal', 'returned_seal', 'heir_margin', 'temple_steps',
  'veterans_honor', 'rival_office_grievance', 'exile_contacts', 'family_letter',
];
// These are content limits, not a second implementation of the game rules.
const effectTargets = {
  stress: 'person', opinion: 'person', skill: 'person',
  familyInfluence: 'family', familyGrievance: 'family', armyStrength: 'realm',
  unrest: 'city', infrastructure: 'city', religionSupport: 'religion',
};
const publicOnly = new Set(['armyStrength', 'unrest', 'infrastructure']);
const referenceRoles = {
  temple_steps: ['city', 'religion', 'office'],
  veterans_honor: ['office'],
  rival_office_grievance: ['office', 'rivalFamily'],
  exile_contacts: ['hostFamily'],
};
const owns = (value, key) => Object.hasOwn(value, key);
const eligible = (choice, flags) => (choice.requires || []).every((rule) => owns(flags, rule.flag) && flags[rule.flag] === rule.equals);
const conditionMatches = (rule, flags) => owns(flags, rule.flag) && flags[rule.flag] === rule.equals;
const message = (template, stage, detail) => `${template.id}/${stage.id}: ${detail}`;

function assertGraph(template) {
  assert.equal(template.stages.length, 4, `${template.id}: four stages`);
  const stages = new Map(template.stages.map((stage) => [stage.id, stage]));
  assert.equal(stages.size, template.stages.length, `${template.id}: duplicate stage id`);
  const visited = new Set(), visiting = new Set();
  function visit(id) {
    assert.ok(stages.has(id), `${template.id}: undeclared next stage ${id}`);
    assert.ok(!visiting.has(id), `${template.id}: cycle at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const choice of stages.get(id).choices) {
      assert.ok(choice.next === null || typeof choice.next === 'string', `${id}/${choice.id}: invalid next`);
      if (choice.next !== null) visit(choice.next);
    }
    visiting.delete(id);
    visited.add(id);
  }
  visit(template.stages[0].id);
  assert.equal(visited.size, stages.size, `${template.id}: unreachable declared stage`);
  return stages;
}

function reachableHistories(template) {
  const stages = assertGraph(template);
  const histories = new Map([...stages.keys()].map((id) => [id, []]));
  function walk(id, flags) {
    const stage = stages.get(id);
    histories.get(id).push(flags);
    const active = stage.choices.filter((choice) => choice.id !== 'close' && eligible(choice, flags));
    assert.ok(active.length, message(template, stage, `no active alternative for ${JSON.stringify(flags)}`));
    for (const choice of active) {
      for (const key of Object.keys(choice.flags)) {
        assert.ok(!owns(flags, key), message(template, stage, `${choice.id} overwrites prior flag ${key}`));
      }
      if (choice.next !== null) walk(choice.next, { ...flags, ...choice.flags });
    }
  }
  walk(template.stages[0].id, {});
  return histories;
}

function assertCopy(text, allowed, label) {
  assert.equal(typeof text, 'string', `${label}: text required`);
  assert.ok(text.trim().length, `${label}: empty text`);
  assert.doesNotMatch(text, /\uFFFD|\bundefined\b|\bNaN\b/, `${label}: broken text`);
  const rendered = text.replace(/\{([^{}]+)\}/g, (_, role) => {
    assert.ok(allowed.has(role), `${label}: unresolved placeholder ${role}`);
    return `Name_${role}`;
  });
  assert.doesNotMatch(rendered, /[{}]/, `${label}: malformed placeholder`);
}

function assertEffects(template, stage, choice) {
  const label = message(template, stage, choice.id);
  const people = new Set(EVENT_CHAIN_ROLES[template.id]);
  for (const effect of choice.effects) {
    assert.ok(owns(effectTargets, effect.kind), `${label}: unsupported effect ${effect.kind}`);
    assert.deepEqual(Object.keys(effect).sort(), (effect.kind === 'skill' ? ['kind', 'target', 'delta', 'skill'] : ['kind', 'target', 'delta']).sort(), `${label}: unsupported effect fields`);
    assert.ok(Number.isFinite(effect.delta) && effect.delta !== 0, `${label}: finite nonzero delta required`);
    const target = effectTargets[effect.kind];
    if (target === 'person') {
      assert.ok(people.has(effect.target) || effect.target === 'decisionActor', `${label}: unresolved person effect target ${effect.target}`);
      assert.notEqual(effect.target, 'deceased', `${label}: cannot change a dead historical participant`);
      if (effect.kind === 'opinion') assert.notEqual(effect.target, 'decisionActor', `${label}: self-opinion`);
    } else {
      assert.equal(effect.target, target, `${label}: incorrect ${effect.kind} target`);
      if (target === 'city' || target === 'religion') assert.ok(referenceRoles[template.id]?.includes(target), `${label}: missing bound ${target}`);
    }
    if (publicOnly.has(effect.kind)) assert.equal(choice.scope, 'public', `${label}: public-only effect`);
    if (effect.kind.startsWith('family')) assert.equal(choice.scope, 'family', `${label}: household effect requires household scope`);
    if (effect.kind === 'skill') {
      assert.ok(['learning', 'diplomacy', 'command', 'stewardship'].includes(effect.skill), `${label}: unsupported skill`);
      assert.equal(effect.delta, 1, `${label}: modest positive skill gain`);
    } else if (effect.kind === 'infrastructure') {
      assert.equal(effect.delta, 1, `${label}: modest infrastructure gain`);
    } else {
      assert.ok(Math.abs(effect.delta) <= 20, `${label}: excessive effect magnitude`);
    }
  }
}

test('catalogue contains eight distinct templates matching the declared role contracts', () => {
  assert.equal(content.length, 8);
  assert.deepEqual(content.map((entry) => entry.id).sort(), [...templateIds].sort());
  assert.deepEqual(Object.keys(EVENT_CHAIN_ROLES).sort(), [...templateIds].sort());
  assert.equal(new Set(content.map((entry) => entry.title)).size, 8, 'distinct chain titles');
  assert.equal(new Set(content.map((entry) => entry.stages[0].prompt)).size, 8, 'distinct opening scenes');
  for (const template of content) {
    const roles = EVENT_CHAIN_ROLES[template.id];
    assert.ok(roles.length >= 2);
    assert.equal(new Set(roles).size, roles.length);
  }
});

for (const template of content) {
  test(`${template.id}: graph declares four reachable acyclic stages`, () => {
    assertGraph(template);
    for (const stage of template.stages) {
      assert.match(stage.id, /^[a-z][a-z0-9_]*$/);
      assert.ok(Number.isInteger(stage.delayMonths) && [1, 3, 6, 12].includes(stage.delayMonths));
    }
    if (template.id === 'sickroom_seal') assert.ok(template.stages.every((stage) => stage.delayMonths === 1), 'sickroom follows short real illness windows');
  });

  test(`${template.id}: each stage offers different active consequences and a genuinely free close`, () => {
    for (const stage of template.stages) {
      const label = message(template, stage, 'choice contract');
      assert.equal(stage.choices.length, 3, label);
      assert.equal(new Set(stage.choices.map((choice) => choice.id)).size, 3, label);
      const close = stage.choices.find((choice) => choice.id === 'close');
      assert.ok(close, label);
      assert.equal(close.scope, 'none', label);
      assert.equal(close.amount, 0, label);
      assert.equal(close.next, null, label);
      assert.equal(close.tag, 'neutral', label);
      assert.deepEqual(close.effects, [], label);
      assert.deepEqual(close.flags, {}, label);
      assert.deepEqual(close.requires || [], [], label);
      const active = stage.choices.filter((choice) => choice.id !== 'close');
      assert.equal(active.length, 2, label);
      assert.notEqual(active[0].label, active[1].label, label);
      const signature = (choice) => JSON.stringify([choice.scope, choice.amount, [...choice.effects].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))]);
      assert.notEqual(signature(active[0]), signature(active[1]), `${label}: merely cosmetic alternatives`);
      for (const choice of active) {
        assert.ok(['public', 'family'].includes(choice.scope), label);
        assert.ok(choice.effects.length > 0, label);
      }
      for (const choice of stage.choices) {
        assert.ok(Number.isInteger(choice.amount) && choice.amount >= 0 && choice.amount <= 25, `${label}: modest nonnegative cost`);
        assert.ok(['neutral', 'duty', 'generous'].includes(choice.tag), `${label}: unknown stress tag`);
        assert.ok(choice.flags && !Array.isArray(choice.flags) && typeof choice.flags === 'object', label);
        for (const [key, value] of Object.entries(choice.flags)) {
          assert.match(key, /^[a-z][a-z0-9_]*$/, label);
          assert.equal(typeof value, 'string', label);
          assert.ok(value.trim(), label);
        }
      }
    }
  });

  test(`${template.id}: effects have supported targets, scopes and modest magnitudes`, () => {
    for (const stage of template.stages) for (const choice of stage.choices) assertEffects(template, stage, choice);
  });

  test(`${template.id}: copy resolves declared people and bound references without mislabeling the payer`, () => {
    const allowed = new Set([...EVENT_CHAIN_ROLES[template.id], 'family', ...(referenceRoles[template.id] || [])]);
    assertCopy(template.title, allowed, template.id);
    for (const stage of template.stages) {
      for (const field of ['title', 'prompt']) assertCopy(stage[field], allowed, `${stage.id}/${field}`);
      for (const variant of stage.variants) assertCopy(variant.prompt, allowed, `${stage.id}/variant`);
      for (const choice of stage.choices) {
        const label = `${stage.id}/${choice.id}`;
        for (const field of ['label', 'description']) assertCopy(choice[field], allowed, `${label}/${field}`);
        if (choice.requires?.length) assertCopy(choice.availabilityReason, allowed, `${label}/availabilityReason`);
        const payment = choice.description.match(/(Familjen|Statskassan) betalar (\d+) silver/);
        if (payment) {
          assert.equal(choice.scope, payment[1] === 'Familjen' ? 'family' : 'public', `${label}: payer contradicts scope`);
          assert.equal(choice.amount, Number(payment[2]), `${label}: quoted cost contradicts actual cost`);
        }
        if (/Ingen silverkostnad|utan silverkostnad/.test(choice.description)) assert.equal(choice.amount, 0, `${label}: false free-cost claim`);
      }
    }
  });

  test(`${template.id}: flags and variant conditions are reachable from prior choices on actual branches`, () => {
    const histories = reachableHistories(template);
    for (const stage of template.stages) {
      const incoming = histories.get(stage.id);
      assert.ok(incoming.length, message(template, stage, 'unreachable through eligible choices'));
      for (const choice of stage.choices) {
        const rules = choice.requires || [];
        for (const rule of rules) {
          assert.deepEqual(Object.keys(rule).sort(), ['equals', 'flag']);
          assert.equal(typeof rule.flag, 'string');
          assert.equal(typeof rule.equals, 'string');
        }
        assert.ok(incoming.some((flags) => eligible(choice, flags)), message(template, stage, `${choice.id}: unreachable flag requirements`));
      }
      for (const [index, variant] of stage.variants.entries()) {
        assert.deepEqual(Object.keys(variant.when).sort(), ['equals', 'flag']);
        assert.ok(incoming.some((flags) => conditionMatches(variant.when, flags)
          && !stage.variants.slice(0, index).some((earlier) => conditionMatches(earlier.when, flags))),
        message(template, stage, 'unreachable or shadowed prompt variant'));
      }
    }
  });
}

// Negative fixtures prove that the contract checks reject relevant defects.
// They clone content locally and never alter the exported production catalogue.
test('contract rejects a cycle, dangling destination and disconnected stage', () => {
  for (const mutation of [
    (copy) => { copy.stages[0].choices[0].next = copy.stages[0].id; },
    (copy) => { copy.stages[0].choices[0].next = 'missing_stage'; },
    (copy) => { for (const choice of copy.stages[0].choices) choice.next = null; },
  ]) {
    const copy = structuredClone(content[0]);
    mutation(copy);
    assert.throws(() => assertGraph(copy));
  }
});

test('contract rejects a branch where neither active choice is eligible', () => {
  const copy = structuredClone(content[0]);
  for (const choice of copy.stages[1].choices.filter((entry) => entry.id !== 'close')) {
    choice.requires = [{ flag: 'opening', equals: 'impossible_value' }];
  }
  assert.throws(() => reachableHistories(copy), /no active alternative/);
});

test('contract rejects unknown copy roles and authority-changing effect intents', () => {
  assert.throws(() => assertCopy('Fråga {unboundHeir}.', new Set(['principal']), 'fixture'), /unresolved placeholder/);
  assert.throws(() => assertCopy('Fråga {principal.', new Set(['principal']), 'fixture'), /malformed placeholder/);
  const template = content[0], stage = template.stages[0];
  for (const effect of [
    { kind: 'appoint', target: 'regent', delta: 1 },
    { kind: 'stress', target: 'unboundHeir', delta: -5 },
    { kind: 'armyStrength', target: 'realm', delta: 1 },
  ]) {
    assert.throws(() => assertEffects(template, stage, { id: 'fixture', scope: 'family', effects: [effect] }));
  }
});
