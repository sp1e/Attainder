import test from "node:test";
import assert from "node:assert/strict";
import { createCharacterSystem } from "./characters/index.js";
import { applyEventImpactsToWorld, normalizeWorldState } from "./gameState.js";
import { executeCharacterWorldCommand, getExternalCharacterHosts, prepareCharacterTimeline } from "./characterWorld.js";

const date = "-0300-01-01";
const fixture = (mode) => normalizeWorldState({
  characterSystem: createCharacterSystem({ polityId: "Hadara", mode, date, seed: 41 }),
  polityOverrides: { Hadara: { name: "Hadara", status: "active" },
    Qedar: { name: "Qedar", status: "active" },
    OldKingdom: { name: "OldKingdom", status: "dissolved" } },
  regionOwnershipOverrides: { "HAD.1": "Hadara", "QED.1": "Qedar" },
  countryStats: { Qedar: { leader: "Rima", stability: 71, customStats: { treasury: 900 } } },
  units: [{ id: "qedar-guard", ownerCode: "Qedar", name: "Vakterna", lng: 36, lat: 35, strength: 77 }],
});
const annex = (eventDate = date) => ({ id: "accepted-annexation", date: eventDate,
  title: "Hadara upphör", description: "Den sista provinsens suveränitet överförs till Qedar.",
  impacts: { regionTransfers: [{ regionId: "HAD.1", fromCode: "Hadara", toCode: "Qedar" }],
    polityChanges: [{ code: "Hadara", operation: "dissolve" }] } });
const host = (world, event) => applyEventImpactsToWorld({ world, events: [event] });

test("accepted annexation ends realm play without recreating a stat sheet; retry and save reload agree", () => {
  const before = fixture("realm");
  const once = host(before, annex()).world;
  assert.equal(once.polityOverrides.Hadara.status, "dissolved");
  assert.equal(once.characterSystem.realm.alive, false);
  assert.equal(once.characterSystem.status.ended, true);
  assert.equal(once.characterSystem.identity.polityId, "Hadara");
  assert.equal(once.countryStats.Hadara, undefined);
  assert.deepEqual(once.countryStats.Qedar, before.countryStats.Qedar);
  assert.deepEqual(once.units, before.units);
  assert.deepEqual(Object.keys(once.characterSystem.people), Object.keys(before.characterSystem.people));
  assert.deepEqual(host(once, annex()).world.characterSystem, once.characterSystem);
  const restored = normalizeWorldState(JSON.parse(JSON.stringify(once)));
  assert.deepEqual(restored.characterSystem, once.characterSystem);
  assert.equal(restored.countryStats.Hadara, undefined);
});

test("a surviving family keeps its identity and private property after its realm disappears", () => {
  const before = fixture("family");
  const familyId = before.characterSystem.identity.familyId;
  const once = host(before, annex()).world;
  assert.equal(once.characterSystem.realm.alive, false);
  assert.equal(once.characterSystem.status.ended, false);
  assert.deepEqual(once.characterSystem.identity, before.characterSystem.identity);
  assert.equal(once.characterSystem.families[familyId].wealth, before.characterSystem.families[familyId].wealth);
  assert.equal(once.characterSystem.offices.ruler.holderId, null);
  assert.deepEqual(getExternalCharacterHosts(once).map((entry) => entry.id), ["Qedar"]);
  assert.deepEqual(host(once, annex()).world.characterSystem, once.characterSystem);
  assert.deepEqual(normalizeWorldState(JSON.parse(JSON.stringify(once))).characterSystem, once.characterSystem);
});

test("military occupation does not dissolve legal sovereignty or end either campaign mode", () => {
  for (const mode of ["realm", "family"]) {
    const before = fixture(mode);
    const event = { id: "occupation", date, title: "Qedar intar staden", impacts: {
      regionControlOps: [{ op: "control", regionId: "HAD.1", fromCode: "Hadara", toCode: "Qedar" }],
      polityChanges: [{ code: "Hadara", operation: "dissolve" }],
    } };
    const after = host(before, event).world;
    assert.equal(after.regionOwnershipOverrides["HAD.1"], "Qedar");
    assert.equal(after.regionSovereigntyOverrides["HAD.1"], "Hadara");
    assert.equal(after.polityOverrides.Hadara.status, "active");
    assert.equal(after.characterSystem.realm.alive, true);
    assert.equal(after.characterSystem.status.ended, false);
    assert.equal(after.characterSystem.revision, before.characterSystem.revision);
  }
});

test("an invalid dissolution request cannot grant family exile or remove a living government", () => {
  const before = fixture("family");
  const event = { ...annex(), impacts: { polityChanges: annex().impacts.polityChanges } };
  const after = host(before, event).world;
  assert.deepEqual(after.characterSystem, before.characterSystem);
  assert.equal(after.polityOverrides.Hadara.status, "active");
});

test("the model timeline stops at actual realm collapse, before later orders or years", () => {
  const before = fixture("realm");
  let final;
  const events = prepareCharacterTimeline(before, [annex("-0300-06-01"), {
    id: "future-order", date: "-0300-07-01", title: "En senare order", impacts: {},
  }], "-0299-01-01", { applyHostEvent: host, onComplete: (state) => { final = state; } });
  assert.equal(final.date, "-0300-06-01");
  assert.equal(final.status.ended, true);
  assert.equal(events.some((event) => event.id === "future-order"), false);
  const canonicalIds = events.map((event, index) => ({ ...event, id: `event-canonical-${index}` }));
  const replay = applyEventImpactsToWorld({ world: before, events: canonicalIds }).world;
  assert.deepEqual(replay.characterSystem, final, "canonical event allocation must not alter dissolution identity");
});

test("family progression continues after annexation without restoring public income or changing conqueror stats", () => {
  const before = fixture("family");
  let final;
  const events = prepareCharacterTimeline(before, [annex()], "-0299-01-01",
    { applyHostEvent: host, onComplete: (state) => { final = state; } });
  const after = applyEventImpactsToWorld({ world: before, events }).world;
  assert.equal(final.date, "-0299-01-01");
  assert.equal(final.realm.alive, false);
  assert.equal(final.status.ended, false);
  assert.deepEqual(after.characterSystem, final);
  assert.equal(after.countryStats.Hadara, undefined);
  assert.deepEqual(after.countryStats.Qedar, before.countryStats.Qedar);
  assert.equal(after.characterEconomy.annualRevenue, 0);
});

test("foreign refuge cannot target an invented or no-longer-active polity", () => {
  const world = host(fixture("family"), annex()).world;
  for (const polityId of ["Invented sanctuary", "Hadara", "OldKingdom"]) {
    const response = executeCharacterWorldCommand(world, { id: `refuge-${polityId}`, type: "seek_refuge",
      expectedRevision: world.characterSystem.revision, payload: { polityId } });
    assert.equal(response.ok, false);
    assert.match(response.error, /aktivt rike/);
  }
  const stale = JSON.parse(JSON.stringify(world));
  stale.polityOverrides.Qedar.status = "dissolved";
  assert.equal(executeCharacterWorldCommand(stale, { id: "stale-refuge", type: "seek_refuge",
    expectedRevision: stale.characterSystem.revision, payload: { polityId: "Qedar" } }).ok, false);
});

test("an accepted foreign refuge survives a real host rename and is lost when that host dissolves", () => {
  const before = fixture("family");
  const familyId = before.characterSystem.identity.familyId;
  before.characterSystem.families[familyId].influence = 100;
  const collapsed = host(before, annex()).world;
  const response = executeCharacterWorldCommand(collapsed, { id: "actual-refuge", type: "seek_refuge",
    expectedRevision: collapsed.characterSystem.revision, payload: { polityId: "Qedar" } });
  assert.equal(response.ok, true, response.error);
  assert.equal(response.state.families[familyId].hostPolityId, "Qedar");
  const sheltered = { ...collapsed, characterSystem: response.state };
  const renamed = host(sheltered, { id: "host-rename", date, title: "Ett nytt rikesnamn", impacts: {
    polityChanges: [{ code: "Qedar", operation: "rename", name: "Nya Qedar" }],
  } }).world;
  assert.equal(renamed.characterSystem.families[familyId].hostPolityId, "Nya Qedar");
  assert.equal(renamed.characterSystem.families[familyId].refugeAcceptedAt, date);
  assert.equal(renamed.characterSystem.log.some((event) => event.type === "refuge_lost"), false);
  assert.equal(renamed.characterSystem.identity.polityId, "Hadara");
  const hostCollapse = { id: "host-collapse", date, title: "Skyddsvärden upphör", impacts: {
    regionTransfers: ["HAD.1", "QED.1"].map((regionId) => ({ regionId, fromCode: "Nya Qedar", toCode: "Tamar" })),
    polityChanges: [{ code: "Nya Qedar", operation: "dissolve" }],
  } };
  const lost = host(renamed, hostCollapse).world;
  assert.equal(lost.characterSystem.families[familyId].hostPolityId, null);
  assert.equal(lost.characterSystem.families[familyId].exiled, true);
  assert.equal(lost.characterSystem.status.ended, false);
  assert.equal(lost.characterSystem.log.filter((event) => event.type === "refuge_lost").length, 1);
  assert.deepEqual(host(lost, hostCollapse).world.characterSystem, lost.characterSystem);
  assert.deepEqual(normalizeWorldState(JSON.parse(JSON.stringify(lost))).characterSystem, lost.characterSystem);
});

test("a model-proposed refuge remains advisory after annexation and replays with canonical event IDs", () => {
  const before = fixture("family");
  const familyId = before.characterSystem.identity.familyId;
  before.characterSystem.families[familyId].influence = 100;
  const proposal = annex();
  proposal.impacts.characterOps = [{ id: "model-refuge", kind: "command", type: "seek_refuge",
    payload: { polityId: "Qedar" } }];
  let final;
  const events = prepareCharacterTimeline(before, [proposal], date,
    { applyHostEvent: host, onComplete: (state) => { final = state; } });
  assert.equal(final.families[familyId].hostPolityId, null);
  assert.ok(events.some((event) => event.title === "Förslaget kräver ditt beslut"));
  const replay = applyEventImpactsToWorld({ world: before,
    events: events.map((event, index) => ({ ...event, id: `canonical-refuge-${index}` })) }).world;
  assert.deepEqual(replay.characterSystem, final);
  assert.deepEqual(applyEventImpactsToWorld({ world: replay, events }).world.characterSystem, final);
});
