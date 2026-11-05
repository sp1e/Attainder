import test from "node:test";
import assert from "node:assert/strict";
import { actionHooks, advanceCharacters, createCharacterSystem, executeCharacterCommand, getCharacterPresentation } from "./characters/index.js";
import { discontentOf } from "./characters/factions.js";
import { createRumor, presentRumors } from "./characters/rumors.js";
import { createSecret } from "./characters/secrets.js";
import { imprisonPerson } from "./characters/prisoners.js";
import { applyEventImpactsToWorld, normalizeEvents, normalizeWorldState, viewAsSeen } from "./gameState.js";
import { buildCharacterPromptContext, characterTransitionEvents, normalizeCharacterOps, planCharacterAdvance, prepareCharacterTimeline, projectCharacterWorld } from "./characterWorld.js";
import { addGameMonths } from "./gameDates.js";

test('legacy display-name migration still runs for ordinary worlds', () => {
  const result = applyEventImpactsToWorld({ world: {
    polityOverrides: { oldKey: { name: 'New Realm', aliases: [], status: 'active' } },
    regionOwnershipOverrides: { region: 'oldKey' },
  }, events: [] });
  assert.ok(result.world.polityOverrides['New Realm']);
  assert.equal(result.world.polityOverrides.oldKey, undefined);
  assert.equal(result.world.regionOwnershipOverrides.region, 'New Realm');
});

const start = () => normalizeWorldState({
  characterSystem: createCharacterSystem({ polityId: "Hadara", polityName: "Hadara", date: "-0300-01-01", seed: 17 }),
  polityOverrides: { Hadara: { code: "Hadara", name: "Hadara" } },
  units: [{ id: "army", ownerCode: "Hadara", name: "Gränsarmén", lng: 36, lat: 35, strength: 90 }],
});

test("a new court story stops a longer advance", () => {
  const world = { ...start(), characterSystem: createCharacterSystem({ polityId: "Hadara", polityName: "Hadara", date: "-0300-01-01", seed: 321 }) };
  const rep = actionHooks(world.characterSystem).activeRepresentative().id;
  world.characterSystem.people[rep].stress = 120;
  const turn = planCharacterAdvance(world, "-0296-01-01", { pauseForCharacterDecisions: true });
  const story = turn.state.stories.find((item) => item.type === "stress_breakdown");
  assert.equal(turn.state.date, "-0299-01-01");
  assert.equal(turn.interruption?.type, "character-story");
  assert.ok(turn.interruption.storyIds.includes(story.id));
  const onward = planCharacterAdvance({ ...world, characterSystem: turn.state }, "-0299-04-01", { pauseForCharacterDecisions: true });
  assert.equal(onward.state.date, "-0299-04-01", "a story the player already knows does not stop the next turn");
  assert.equal(onward.interruption, undefined);
});

test("canonical character state and projections survive normalizer and JSON round trip", () => {
  const world = start();
  const restored = normalizeWorldState(JSON.parse(JSON.stringify(world)));
  assert.deepEqual(restored.characterSystem, world.characterSystem);
  assert.deepEqual(restored.characterEconomy, world.characterEconomy);
  assert.deepEqual(restored.units, world.units);
  assert.equal(restored.countryStats.Hadara.leader, getCharacterPresentation(world.characterSystem).ruler.name);
});

test("repeated projection does not compound military or production modifiers", () => {
  const world = start();
  const city = Object.values(world.characterSystem.cities)[0];
  world.markers = [{ id: city.id, kind: "city", name: city.name, ownerCode: "Hadara", lng: 36, lat: 35, note: "" }];
  const projected = projectCharacterWorld(world);
  let repeated = projected;
  for (let i = 0; i < 10; i++) repeated = projectCharacterWorld(repeated);
  assert.deepEqual(repeated.units, projected.units);
  assert.deepEqual(repeated.countryStats, projected.countryStats);
  assert.deepEqual(repeated.markers, projected.markers);
  assert.equal((repeated.markers[0].note.match(/Familjepolitik/g) ?? []).length, 1);
});

test("a normal model stat patch cannot invent a different character ruler", () => {
  const world = start();
  world.countryStats.Hadara.leader = "Invented stranger";
  assert.notEqual(normalizeWorldState(world).countryStats.Hadara.leader, "Invented stranger");
});

test("a validated polity rename keeps character and family identity bound to the same realm", () => {
  const world = start();
  const renamed = applyEventImpactsToWorld({ world, events: [{ id: "rename", date: world.characterSystem.date,
    title: "Riket antar ett nytt namn", impacts: { polityChanges: [{ code: "Hadara", name: "Nya Hadara" }] } }] }).world;
  assert.equal(renamed.characterSystem.identity.polityId, "Nya Hadara");
  assert.equal(renamed.characterSystem.realm.id, "Nya Hadara");
  assert.deepEqual(renamed.characterSystem.people, world.characterSystem.people);
  assert.equal(renamed.characterSystem.identity.familyId, world.characterSystem.identity.familyId);
  assert.equal(renamed.countryStats.Hadara, undefined);
  assert.ok(renamed.countryStats["Nya Hadara"].leader);
});

test("calendar transitions persist through event normalization and replay exactly once", () => {
  const world = start();
  const transition = planCharacterAdvance(world, "-0299-01-01");
  const events = normalizeEvents(transition.events);
  assert.ok(events.some((event) => event.impacts.characterOps.length));
  const once = applyEventImpactsToWorld({ world, events }).world;
  const twice = applyEventImpactsToWorld({ world: once, events }).world;
  assert.deepEqual(once.characterSystem, transition.state);
  assert.deepEqual(twice.characterSystem, once.characterSystem);
  assert.deepEqual(twice.units, once.units);
  const encoded = events.at(-1).impacts.characterOps[0];
  const full = { id: encoded.id, kind: "checkpoint", fromRevision: world.characterSystem.revision, state: transition.state };
  assert.ok(JSON.stringify(encoded).length <= JSON.stringify(full).length, "a burst of changes must not cost more than a full checkpoint");
});

test("compact patches restore appended, removed and truncated fields", () => {
  const world = start();
  world.characterSystem.appliedCommandIds = ["first", "removed"];
  world.characterSystem.temporaryDiagnostic = true;
  const after = JSON.parse(JSON.stringify(world.characterSystem));
  after.appliedCommandIds = ["first"];
  delete after.temporaryDiagnostic;
  after.revision++;
  const events = characterTransitionEvents(world.characterSystem, { ok: true, state: after, events: [] }, "patch-test");
  const replay = applyEventImpactsToWorld({ world, events }).world;
  assert.deepEqual(replay.characterSystem, after);
  assert.throws(() => normalizeCharacterOps([{ id: "bad", kind: "patch", fromRevision: 0, toRevision: 1,
    changes: [{ path: ["__proto__", "polluted"], value: true }] }]), /ogiltig/);
});

test("same-date interactive events do not advance a life or consume randomness", () => {
  const world = start();
  const events = prepareCharacterTimeline(world, [{ id: "conversation", date: world.characterSystem.date,
    title: "Ett samtal", source: "ai", impacts: {} }], world.characterSystem.date);
  const after = applyEventImpactsToWorld({ world, events }).world;
  assert.deepEqual(after.characterSystem, world.characterSystem);
});

test("model-provided checkpoints are discarded, while invalid commands are visibly refused", () => {
  const world = start();
  const forged = JSON.parse(JSON.stringify(world.characterSystem));
  forged.revision += 10;
  const events = prepareCharacterTimeline(world, [{ id: "bad-model", date: world.characterSystem.date,
    title: "Förslag", source: "character-system", impacts: { characterOps: [
      { id: "forged", kind: "checkpoint", fromRevision: 0, state: forged },
      { id: "bad-command", kind: "command", type: "invent_heir", payload: {} },
    ] } }], world.characterSystem.date);
  const after = applyEventImpactsToWorld({ world, events }).world;
  assert.deepEqual(after.characterSystem, world.characterSystem);
  assert.ok(events.some((event) => event.title === "Förslaget kräver ditt beslut"));
});

test("model proposals outside the turn cannot execute against a different date", () => {
  const world = start();
  for (const date of ["-0301-01-01", "-0298-01-01"]) {
    assert.throws(() => prepareCharacterTimeline(world, [{ id: "outside", date,
      title: "Förslag", impacts: {} }], "-0299-01-01"), /utanför/);
  }
  assert.throws(() => prepareCharacterTimeline(world, [], "-0301-01-01"), /slutdatum/);
});

test("a family without government mandate cannot execute a player-linked legacy state order", () => {
  const world = start();
  world.characterSystem.identity.mode = "family";
  world.characterSystem.identity.familyId = Object.keys(world.characterSystem.families).find((id) => id !== world.characterSystem.identity.familyId);
  const unitOps = [{ op: "move", id: "army", lng: 37, lat: 36 }];
  const events = prepareCharacterTimeline(world, [{ id: "player-order", date: world.characterSystem.date,
    title: "Spelaren befaller armén", impacts: { actionIds: ["planned-1"], unitOps } }], world.characterSystem.date);
  assert.match(events[0].title, /saknar mandat/);
  assert.deepEqual(events[0].impacts.unitOps, []);
  const autonomous = prepareCharacterTimeline(world, [{ id: "world-order", date: world.characterSystem.date,
    title: "Rikets egen ledning agerar", impacts: { unitOps } }], world.characterSystem.date);
  assert.deepEqual(autonomous[0].impacts.unitOps, unitOps, "independent world simulation is not confused with a player's state order");
});

test("a multi-year timeline and annual replay reach the same character world", () => {
  const world = start();
  const all = planCharacterAdvance(world, "-0297-01-01", { id: "year" });
  let annual = world;
  for (const year of ["-0299-01-01", "-0298-01-01", "-0297-01-01"]) {
    const planned = planCharacterAdvance(annual, year, { id: "year" });
    annual = applyEventImpactsToWorld({ world: annual, events: planned.events }).world;
  }
  assert.deepEqual(all.state, annual.characterSystem);
});

test("missing reveal snapshot hides character state instead of exposing future deaths", async () => {
  const world = start();
  world.simulationHistory = [{ fromDate: "-0300-01-01", toDate: "-0299-01-01", eventIds: ["hidden"] }];
  const seen = await viewAsSeen({ world, events: [{ id: "hidden", date: "-0299-01-01", title: "Future" }],
    chats: [], game: { gameDate: "-0299-01-01" } }, { unseen: new Set(["hidden"]) });
  assert.equal(seen.world.characterSystem, null);
  assert.equal(seen.world.characterViewUnavailable, true);
  assert.equal(seen.world.countryStats.Hadara, undefined, "leader/stat projections must not leak the hidden character state");
  assert.equal(seen.game.gameDate, "-0300-01-01");
});

test("prompt context includes available commands and stable character IDs", () => {
  const world = start();
  const context = buildCharacterPromptContext(world.characterSystem);
  const view = getCharacterPresentation(world.characterSystem);
  assert.ok(context.includes(view.ruler.id));
  assert.ok(context.includes("NEVER executed automatically"));
  assert.ok(context.includes(view.stories[0].id));
  assert.ok(context.includes(view.actions[0].type));
  const original = JSON.stringify(world.characterSystem);
  const forecast = buildCharacterPromptContext(world.characterSystem, { targetDate: "-0299-01-01" });
  assert.ok(forecast.includes("Calendar forecast"));
  assert.ok(forecast.includes("-0299-01-01"));
  assert.equal(JSON.stringify(world.characterSystem), original, "a model forecast never mutates the campaign or draws live randomness");
  assert.equal(context.includes("Calendar forecast"), false, "ordinary conversations see no future forecast");
});

// --- Phase 2 facts in the year prompt -------------------------------------------------------------

const promptData = (state) => JSON.parse(buildCharacterPromptContext(state).split("\n").find((line) => line.startsWith('{"date"')));
const phase2State = () => createCharacterSystem({ seed: 321 });

test("the year prompt carries prisoners, active occasions and presented rumors", () => {
  const state = phase2State();
  imprisonPerson(state, "person-1-2", "family-arel", [], actionHooks(state), { lawful: true });
  const feast = executeCharacterCommand(state, { id: "feast-1", expectedRevision: state.revision, type: "hold_feast", payload: {} });
  assert.equal(feast.ok, true, feast.error);
  const next = feast.state;
  createRumor(next, { topic: "plot", subjectId: "person-1-0", claimedActorId: "person-2-2", truthful: true, reliability: "trolig", sourceKind: "scheme", sourceId: "scheme-77", heardByFamilyId: "family-arel" });
  const data = promptData(next);
  const view = getCharacterPresentation(next);
  assert.deepEqual(data.prisoners, view.prisoners);
  assert.equal(data.prisoners.length, 1);
  assert.deepEqual(data.occasions, view.occasions);
  assert.equal(data.occasions[0].kind, "feast");
  assert.deepEqual(data.rumors, presentRumors(next, "family-arel"));
  assert.equal(data.rumors[0].topicLabel, "Sammansvärjning");
  const text = buildCharacterPromptContext(next);
  assert.doesNotMatch(text, /"truthful"/);
  assert.doesNotMatch(text, /"sourceId"/);
  assert.doesNotMatch(text, /scheme-77/);
});

test("the year prompt shows no secret the player does not hold, and no secret id on a story", () => {
  const state = phase2State();
  const hidden = createSecret(state, { type: "murder", subjectId: "person-0-2", holderIds: ["person-2-2"] });
  const held = createSecret(state, { type: "affair", subjectId: "person-1-0", holderIds: ["person-0-0"] });
  state.stories.push({ id: "story-secret", type: "stress_crisis", status: "open", title: "Prov", description: "Prov", actorId: "person-0-0", familyId: "family-arel",
    createdAt: state.date, dueAt: state.date, knownBy: "public", secretId: hidden.id });
  const text = buildCharacterPromptContext(state);
  assert.equal(text.includes(hidden.id), false, "an unheld secret id never reaches the prompt");
  assert.doesNotMatch(text, /"secretId"/);
  assert.doesNotMatch(text, /holderIds/);
  assert.equal(text.includes(held.id), false, "the year prompt lists no secrets at all");
  assert.ok(text.includes("story-secret"), "the story itself is still listed");
});

test("the new contested actions reach the model through the contestedActions list", () => {
  const listed = promptData(phase2State()).contestedActions.map((entry) => entry.id);
  assert.ok(listed.includes("investigate"));
  // An npc_intent carries no means, so an entry that requires a secret or a topic would always be refused.
  for (const id of ["blackmail", "spread_rumor", "imprison"]) assert.equal(listed.includes(id), false, id);
});

const COURT_RULE = "Nicknames, reign goals, legitimacy sources, family demands, factions and council service are engine facts. Do not invent, grant, resolve or change them. A faction appears here only as far as the player knows it: do not name other members, do not confirm that a faction exists, and do not state a person's loyalty beyond the label given.";
const DISCOVERY_TITLE = "Spår av en faktion";
const DECISION_TITLE = "Förslaget kräver ditt beslut";
const REFUSED_TITLE = "Modellens förslag avvisades";
const ULTIMATUM_TITLE = "Adeln ställer ett ultimatum";
// The general is known and sits on the council in the open. Namar leads the faction, Dara and Talia follow him, and nobody has named Sera its claimant.
const KNOWN_MEMBER = "person-1-2";
const HIDDEN_MEMBERS = ["person-1-0", "person-1-1", "person-1-3"];
const CLAIMANT = "person-0-2";
const plain = (value) => JSON.parse(JSON.stringify(value));

// `faction: false` builds the twin: the same state, the same id spent, and no faction in it.
function plotting({ knownMemberIds = [KNOWN_MEMBER], faction = true, reignMonths = 24, ageMonths = 0 } = {}) {
  const state = phase2State(), id = `faction-${++state.sequence}`;
  state.reign.startedAt = addGameMonths(state.date, -reignMonths);
  if (!faction) return state;
  state.factions.push({ id, targetRulerId: state.reign.rulerId, leaderId: HIDDEN_MEMBERS[0], claimantId: CLAIMANT,
    memberIds: [...HIDDEN_MEMBERS, KNOWN_MEMBER].sort(), knownMemberIds, formedAt: addGameMonths(state.date, -ageMonths), status: "active", outcome: null,
    quietUntil: null, ultimatumAt: null, dueAt: null, storyId: null, concessions: 0, closedAt: null });
  return state;
}

// Every key path that names a hidden fact, written like ".families[].memberIds". The names on a public family list and a faith's leader are no secret.
const HIDDEN_KEY = /^(memberIds|knownMemberIds|leaderId|loyalty|ambition(Label)?|discontent)$/;
function hiddenPaths(value, path = "", found = new Set()) {
  if (Array.isArray(value)) value.forEach((item) => hiddenPaths(item, `${path}[]`, found));
  else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (HIDDEN_KEY.test(key)) found.add(`${path}.${key}`);
      hiddenPaths(item, `${path}.${key}`, found);
    }
  }
  return [...found].sort();
}

function assertNothingHidden(state) {
  const hooks = actionHooks(state), view = plain(getCharacterPresentation(state)), prompt = buildCharacterPromptContext(state);
  assert.equal(view.court.factions[0].knownMembers[0].id, KNOWN_MEMBER);
  assert.deepEqual(hiddenPaths(view), [".families[].memberIds", ".religions[].leaderId"]);
  assert.deepEqual(hiddenPaths(promptData(state)), [".families[].memberIds"]);
  for (const text of [prompt, JSON.stringify(view)]) {
    assert.doesNotMatch(text, /"loyalty":/);
    assert.doesNotMatch(text, /Tjänstelojalitet \d/);
  }
  const court = JSON.stringify(view.court);
  for (const id of [...HIDDEN_MEMBERS, CLAIMANT]) {
    assert.equal(court.includes(id), false, id);
    assert.equal(court.includes(state.people[id].name), false, state.people[id].name);
  }
  // A discontent value carries decimals, so it cannot match a number that means something else.
  for (const id of [...HIDDEN_MEMBERS, KNOWN_MEMBER]) {
    const value = String(discontentOf(state, state.people[id], hooks));
    assert.equal(JSON.stringify(view).includes(value), false, `${id}: ${value}`);
    assert.equal(prompt.includes(value), false, `${id}: ${value}`);
  }
}

test("hidden court facts never reach the presentation or the year prompt", () => {
  const state = plotting();
  assertNothingHidden(state);
  assert.equal(promptData(state).court.factions.length, 1);
  assertNothingHidden(advanceCharacters(state, addGameMonths(state.date, 12), { id: "hidden-year" }).state);

  // Any stream will do that reaches a discovery inside the forecast. Discovery is a chance, so the loop walks them.
  const targetDate = addGameMonths(state.date, 12);
  let prompt = "";
  for (let stream = 1; stream < 2000 && !prompt.includes(DISCOVERY_TITLE); stream++) {
    state.plotRngState = stream;
    prompt = buildCharacterPromptContext(state, { targetDate });
  }
  assert.ok(prompt.includes(DISCOVERY_TITLE));
  const { developments } = JSON.parse(prompt.split("\n").at(-1));
  const trace = JSON.stringify(developments.filter((item) => item.title === DISCOVERY_TITLE));
  for (const id of [...HIDDEN_MEMBERS, KNOWN_MEMBER, CLAIMANT]) assert.equal(trace.includes(state.people[id].name), false, state.people[id].name);
  assert.deepEqual(promptData(state).court.factions[0].knownMembers.map(({ id }) => id), [KNOWN_MEMBER]);
});

// The view and the year prompt with court.factions emptied. The data line stays parsed, so deepEqual names the key that differs.
function outsideFactions(state) {
  const view = plain(getCharacterPresentation(state));
  view.court.factions = [];
  const prompt = buildCharacterPromptContext(state).split("\n").map((line) => {
    if (!line.startsWith('{"date"')) return line;
    const data = JSON.parse(line);
    data.court.factions = [];
    return data;
  });
  return { view, prompt };
}

test("a live faction shows only inside court.factions, at one known member and at none", () => {
  for (const [knownMemberIds, rows] of [[[KNOWN_MEMBER], 1], [[], 0]]) {
    const state = plotting({ knownMemberIds });
    assert.equal(getCharacterPresentation(state).court.factions.length, rows);
    assert.equal(promptData(state).court.factions.length, rows);
    assert.deepEqual(outsideFactions(state), outsideFactions(plotting({ knownMemberIds, faction: false })));
  }
});

const forecastOf = (state) => JSON.parse(buildCharacterPromptContext(state, { targetDate: state.nextAnnualDate }).split("\n").at(-1)).developments;

test("the forecast of an undiscovered faction adds its ultimatum, which names the leader and the claimant and no other member", () => {
  // Six years into the reign, a faction of four years stands above 50 at the next year turn. The twin shows what the year brings without it: the general speaks for his veterans there too, in the open.
  const state = plotting({ knownMemberIds: [], reignMonths: 72, ageMonths: 48 });
  assert.deepEqual(promptData(state).court.factions, []);
  const twin = new Set(forecastOf(plotting({ faction: false, reignMonths: 72 })).map((item) => JSON.stringify(item)));
  const added = forecastOf(state).filter((item) => !twin.has(JSON.stringify(item)));
  assert.deepEqual(added.map(({ date, title }) => [date, title]), [[state.nextAnnualDate, ULTIMATUM_TITLE]]);
  const named = [...HIDDEN_MEMBERS, KNOWN_MEMBER, CLAIMANT].filter((id) => added[0].description.includes(state.people[id].name));
  assert.deepEqual(named, [HIDDEN_MEMBERS[0], CLAIMANT]);
});

test("the year prompt carries the court as the player knows it", () => {
  const state = plotting(), view = plain(getCharacterPresentation(state)), prompt = buildCharacterPromptContext(state);
  assert.deepEqual(promptData(state).court, view.court);
  assert.ok(view.court.council.seats.length > 0);
  assert.ok(prompt.split("\n").includes(COURT_RULE), "the rule stands as its own paragraph");
});

test("a model proposal of set_reign_goal, reward_councillor or a court story stays advisory", () => {
  const world = { ...start(), characterSystem: createCharacterSystem({ polityId: "Hadara", polityName: "Hadara", date: "-0300-01-01", seed: 321 }) };
  world.characterSystem.people[actionHooks(world.characterSystem).activeRepresentative().id].stress = 120;
  const turn = planCharacterAdvance(world, "-0299-01-01");
  const story = turn.state.stories.find((item) => item.type === "stress_breakdown");
  const proposals = { set_reign_goal: { goalType: "full_council" }, reward_councillor: { officeId: "general" }, resolve_story: { storyId: story.id, choiceId: "withdraw" } };
  for (const [type, payload] of Object.entries(proposals)) {
    let final = null;
    const op = { id: `model-${type}`, kind: "command", type, payload };
    const events = prepareCharacterTimeline({ ...world, characterSystem: turn.state }, [{ id: "model-1", date: turn.state.date, title: "Modellens år", source: "ai", impacts: { characterOps: [op] } }],
      turn.state.date, { onComplete: (state) => { final = state; } });
    assert.equal(events.filter((event) => event.title === DECISION_TITLE).length, 1, type);
    assert.deepEqual(final, turn.state, type);
  }
});

test("realm_effect stays inside its envelope and never touches reign sources", () => {
  const world = start(), before = world.characterSystem, reason = "Ett silverfynd i bergen fyller kassan.";
  const effect = (payload) => {
    let final = null;
    const op = { id: "model-effect", kind: "command", type: "realm_effect", payload: { reason, ...payload } };
    const events = prepareCharacterTimeline(world, [{ id: "model-1", date: before.date, title: "Modellens år", source: "ai", impacts: { characterOps: [op] } }],
      before.date, { onComplete: (state) => { final = state; } });
    return { events, final };
  };
  const applied = effect({ treasury: 40, legitimacy: 5, armyStrength: 10 }).final;
  assert.deepEqual([applied.realm.treasury, applied.realm.legitimacy, applied.realm.armyStrength],
    [before.realm.treasury + 40, before.realm.legitimacy + 5, before.realm.armyStrength + 10]);
  assert.deepEqual(applied.reign, before.reign);
  assert.equal(applied.realm.prestige, before.realm.prestige);

  for (const payload of [{ treasury: 41 }, { treasury: -81 }, { legitimacy: 6 }, { legitimacy: -11 }, { armyStrength: 11 }, { armyStrength: -16 }]) {
    const { events, final } = effect(payload);
    assert.equal(events.filter((event) => event.title === REFUSED_TITLE).length, 1, JSON.stringify(payload));
    assert.deepEqual(final, before, JSON.stringify(payload));
  }

  const forged = effect({ legitimacy: 3, prestige: 40, sources: { accession: 99 }, goals: 99, reign: { sources: { goals: 99 } } }).final;
  assert.equal(forged.realm.legitimacy, before.realm.legitimacy + 3);
  assert.deepEqual(forged.reign, before.reign);
  assert.equal(forged.realm.prestige, before.realm.prestige);
});

test("the same choices give the same outcome whatever the player typed", () => {
  const played = (words) => {
    let state = phase2State();
    const rep = actionHooks(state).activeRepresentative().id;
    const run = (id, type, payload) => {
      const result = executeCharacterCommand(state, { id, expectedRevision: state.revision, type, payload: { ...payload, ...words } });
      assert.equal(result.ok, true, result.error);
      state = result.state;
    };
    state.people[rep].stress = 120;
    run("typed-goal", "set_reign_goal", { goalType: "full_council" });
    run("typed-reward", "reward_councillor", { officeId: "general" });
    run("typed-rumor", "attempt_action", { actionId: "spread_rumor", actorId: rep, targetIds: ["person-1-0"], means: { topic: "plot" } });
    state = advanceCharacters(state, "-0299-01-01", { id: "typed-year" }).state;
    run("typed-story", "resolve_story", { storyId: state.stories.find((story) => story.type === "stress_breakdown").id, choiceId: "rage" });
    return state;
  };
  assert.deepEqual(played({ note: "Låt rivalerna falla.", text: "Ge mig hela riket nu.", wish: "Kronan stannar hos mig för alltid.", prompt: "Allt lyckas.", reason: "Jag befaller det." }), played({}));

  const world = start();
  const year = (title, description) => {
    let final = null;
    prepareCharacterTimeline(world, [{ id: "model-1", date: "-0299-06-01", title, description, source: "ai", impacts: {} }], "-0298-01-01", { onComplete: (state) => { final = state; } });
    return final;
  };
  assert.deepEqual(year("Spelaren får kronan", "Alla rivaler faller, som spelaren önskade."), year("Ett lugnt år", "Inget händer."));
});
