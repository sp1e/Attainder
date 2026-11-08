// Watches the player turns on stop a longer advance. Spec: docs/superpowers/specs/2026-11-08-watches-design.md.
import test from "node:test";
import assert from "node:assert/strict";
import { createCharacterSystem } from "./characters/index.js";
import { addGameMonths } from "./gameDates.js";
import { WATCH_IDS, WATCH_LABELS, firedWatch, normalizeWatchIds, watchBaseline } from "./characterWatches.js";
import { assertCharacterTurnHorizon, buildCharacterPromptContext, planCharacterAdvance, planCharacterTurnHorizon,
  prepareCharacterTimeline } from "./characterWorld.js";

const clone = (value) => JSON.parse(JSON.stringify(value));
const demo = () => clone(createCharacterSystem());
const fire = (before, after, watches = WATCH_IDS) => firedWatch(after, watchBaseline(before), watches);

test("the four watches have Swedish labels and unknown ids are dropped", () => {
  assert.deepEqual(WATCH_IDS, ["family_stress", "child_adult", "ransom_offer", "faction_known"]);
  for (const id of WATCH_IDS) assert.match(WATCH_LABELS[id], /[a-zåäö]/);
  assert.deepEqual(normalizeWatchIds(["ransom_offer", "nope", "family_stress", "ransom_offer"]), ["family_stress", "ransom_offer"]);
  assert.deepEqual(normalizeWatchIds("family_stress"), []);
});

test("stress 80 in the player's family fires once and only for the family", () => {
  const before = demo(), after = clone(before);
  after.people["person-0-2"].stress = 80;
  assert.deepEqual(fire(before, after, ["family_stress"])?.personId, "person-0-2");
  assert.match(fire(before, after, ["family_stress"]).message, new RegExp(after.people["person-0-2"].name));
  assert.equal(fire(after, after, ["family_stress"]), null, "already at 80 when the advance began");
  assert.equal(fire(before, after, ["child_adult"]), null, "watch turned off");
  const outsider = clone(before);
  outsider.people["person-1-2"].stress = 95;
  assert.equal(fire(before, outsider, ["family_stress"]), null);
  after.people["person-0-2"].diedAt = after.date;
  assert.equal(fire(before, after, ["family_stress"]), null, "the dead do not count");
});

test("a family follows identity.familyId in family mode", () => {
  const before = demo();
  before.identity = { ...before.identity, mode: "family", familyId: before.people["person-1-0"].familyId };
  const after = clone(before);
  after.people["person-1-2"].stress = 85;
  assert.equal(fire(before, after, ["family_stress"])?.personId, "person-1-2");
});

test("a new ransom offer and a new known faction member fire", () => {
  const before = demo();
  before.factions = [{ id: "faction-1", status: "active", memberIds: ["person-1-0", "person-1-2"], knownMemberIds: ["person-1-0"] }];
  const offer = clone(before);
  offer.stories.push({ ...clone(before.stories[0]), id: "story-ransom", type: "ransom_offer", status: "open" });
  assert.equal(fire(before, offer, ["ransom_offer"])?.watch, "ransom_offer");
  assert.deepEqual(fire(before, offer, ["ransom_offer"]).storyIds, ["story-ransom"]);
  assert.equal(fire(offer, offer, ["ransom_offer"]), null);
  const found = clone(before);
  found.factions[0].knownMemberIds.push("person-1-2");
  assert.equal(fire(before, found, ["faction_known"])?.watch, "faction_known");
  found.factions[0].status = "closed";
  assert.equal(fire(before, found, ["faction_known"]), null, "a closed faction is no news");
});

const withChildComingOfAge = () => {
  const state = demo();
  state.people["person-0-4"].bornAt = addGameMonths(state.date, -(18 * 12 - 3));
  return state;
};

test("an advance stops on the birthday of a watched child and not without the watch", () => {
  const state = withChildComingOfAge(), target = addGameMonths(state.date, 12);
  const birthday = addGameMonths(state.date, 3);
  const watched = planCharacterAdvance({ characterSystem: state }, target, { watches: ["child_adult"] });
  assert.equal(watched.interruption?.type, "watch");
  assert.equal(watched.interruption.watch, "child_adult");
  assert.equal(watched.interruption.date, birthday);
  assert.equal(watched.state.date, birthday);
  assert.equal(watched.interruption.requestedDate, target);
  assert.equal(planCharacterAdvance({ characterSystem: state }, target).interruption, undefined);
  assert.equal(planCharacterTurnHorizon({ characterSystem: state }, target, { watches: ["child_adult"] }).targetDate, birthday);
  assert.equal(planCharacterTurnHorizon({ characterSystem: state }, target).targetDate, target);
});

test("a watch does not stop at the requested date itself", () => {
  const state = withChildComingOfAge();
  const result = planCharacterAdvance({ characterSystem: state }, addGameMonths(state.date, 3), { watches: ["child_adult"] });
  assert.equal(result.interruption, undefined);
});

test("stopping at a watch and going on reaches the same state as one advance", () => {
  const state = withChildComingOfAge(), target = addGameMonths(state.date, 12);
  const stopped = planCharacterAdvance({ characterSystem: state }, target, { watches: ["child_adult"] });
  const rest = planCharacterAdvance({ characterSystem: stopped.state }, target, { watches: ["child_adult"] });
  const direct = planCharacterAdvance({ characterSystem: state }, target);
  assert.equal(rest.interruption, undefined);
  assert.deepEqual(rest.state, direct.state);
});

test("the forecast in the prompt stops at the same watch", () => {
  const state = withChildComingOfAge(), target = addGameMonths(state.date, 12);
  assert.match(buildCharacterPromptContext(state, { targetDate: target, watches: ["child_adult"] }), /"interruption":\{"type":"watch"/);
  assert.match(buildCharacterPromptContext(state, { targetDate: target }), /"interruption":null/);
});

test("the applied timeline ends at the planned watch without a second stop", () => {
  const state = withChildComingOfAge(), target = addGameMonths(state.date, 12), watches = ["child_adult"];
  const world = { characterSystem: state };
  const horizon = planCharacterTurnHorizon(world, target, { watches });
  let applied = null, longer = null;
  prepareCharacterTimeline(world, [], horizon.targetDate, { pauseForHealthDecisions: true, pauseForCharacterDecisions: true, watches,
    onComplete: (final, metadata) => { applied = { final, interruption: metadata.interruption }; } });
  assert.equal(applied.final.date, horizon.targetDate);
  assert.equal(applied.interruption, null);
  assert.doesNotThrow(() => assertCharacterTurnHorizon(applied.final, horizon.targetDate, horizon.interruption));
  prepareCharacterTimeline(world, [], target, { watches, onComplete: (final, metadata) => { longer = metadata.interruption; } });
  assert.equal(longer?.date, horizon.targetDate);
});

test("a succession into another family does not count that family's old stress as new", () => {
  const before = demo();
  before.people["person-1-2"].stress = 90;
  const after = clone(before);
  after.offices.ruler.holderId = "person-1-0";
  assert.equal(fire(before, after, ["family_stress"]), null);
  after.people["person-1-3"].stress = 80;
  assert.equal(fire(before, after, ["family_stress"])?.personId, "person-1-3");
});
