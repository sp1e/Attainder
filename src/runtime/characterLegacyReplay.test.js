import test from "node:test";
import assert from "node:assert/strict";
import { advanceCharacters, createCharacterSystem, executeCharacterCommand, getCharacterPresentation, normalizeCharacterSystem } from "./characters/index.js";
import { createLegacyCharacterReplay, diffCharacterState, synchronizeCharacterEventDate } from "./characterWorld.js";
import { applyEventImpactsToWorld, normalizeEvents, normalizeWorldState, viewAsSeen } from "./gameState.js";
import { setRuntimeAssetEndpoints } from "./assets.js";

const plain = (value) => JSON.parse(JSON.stringify(value));
const streams = (state) => [state.rngState, state.actionRngState, state.plotRngState, state.healthRngState];
const withoutReign = (state) => { const next = plain(state); delete next.reign; return next; };
const legacy = (state) => {
  const next = plain(state);
  next.extensionsVersion = 2;
  for (const key of ["reign", "nicknames", "familyDemands", "factions"]) delete next[key];
  return next;
};

function fixture() {
  const initial = createCharacterSystem({ polityId: "Hadara", date: "-0300-01-01", seed: 17 });
  const before = advanceCharacters(initial, "-0300-02-01").state;
  const march = advanceCharacters(before, "-0300-03-01").state;
  const succession = executeCharacterCommand(march, { id: "fixture-abdication", expectedRevision: march.revision, type: "abdicate", payload: {} });
  assert.equal(succession.ok, true, succession.error);
  const final = advanceCharacters(succession.state, "-0300-04-01").state;
  const states = [initial, before, succession.state, final].map(legacy);
  const events = states.slice(1).map((state, index) => ({ id: `legacy-${index}`, date: state.date,
    source: "character-system", title: "Synthetic saved checkpoint", impacts: { characterOps: [{
      id: `legacy-patch-${index}`, kind: "patch", fromRevision: states[index].revision, toRevision: state.revision,
      changes: diffCharacterState(states[index], state),
    }] } }));
  const world = { characterSystem: states[0], polityOverrides: { Hadara: { name: "Hadara", code: "Hadara" } } };
  return { world, states, events };
}

function stage(world, events) {
  // GameUI/time.jsx stages a cloned raw snapshot with these adapter arguments.
  return applyEventImpactsToWorld({ colors: {}, world: plain(world), events,
    motion: { originDate: world.characterSystem.date, round: 1, tick: 0 } }).world;
}

test("staged legacy patches retain the historical ruler across succession without rolling outcomes", () => {
  const { world, states, events } = fixture();
  const saved = plain({ world, states, events });
  for (let count = 1; count <= events.length; count++) {
    const replay = stage(world, events.slice(0, count));
    assert.deepEqual(withoutReign(replay.characterSystem), withoutReign(normalizeCharacterSystem(states[count])));
    assert.equal(replay.characterSystem.reign.rulerId, states[count].offices.ruler.holderId);
    assert.deepEqual(streams(replay.characterSystem), streams(states[count]));
    assert.equal(getCharacterPresentation(replay.characterSystem).ruler.id, states[count].offices.ruler.holderId);
    assert.deepEqual(normalizeWorldState(plain(replay)).characterSystem, replay.characterSystem);
    assert.deepEqual(stage(replay, events.slice(0, count)).characterSystem, replay.characterSystem, "replaying stored patches twice is idempotent");
  }
  const resumed = executeCharacterCommand(stage(world, events).characterSystem, {
    id: "fixture-resume", expectedRevision: states.at(-1).revision, type: "set_reign_goal", payload: { goalType: "fill_treasury" },
  });
  assert.equal(resumed.ok, true, resumed.error);
  assert.doesNotThrow(() => normalizeCharacterSystem(plain(resumed.state)));
  assert.deepEqual({ world, states, events }, saved, "reveal does not rewrite stored outcomes or snapshots");
});

test("viewAsSeen restores a legacy checkpoint before and after succession during a partial reveal", async () => {
  const { world, states, events } = fixture();
  const finalWorld = normalizeWorldState({ ...world, characterSystem: states.at(-1),
    simulationHistory: [{ fromDate: states[0].date, toDate: states.at(-1).date, eventIds: events.map(({ id }) => id) }] });
  const snapshots = [{ fromDate: states[0].date, toDate: states.at(-1).date, state: { world } }];
  const saved = plain({ world: finalWorld, events, snapshots });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(snapshots), { status: 200, headers: { "Content-Type": "application/json" } });
  setRuntimeAssetEndpoints({ token: "legacy-replay-succession" });
  try {
    const checkpoint = { ...events[0], impacts: { characterOps: [{ id: "view-legacy-full", kind: "checkpoint",
      fromRevision: states[0].revision, state: states[1] }] } };
    const loadedVariants = [normalizeEvents(events), normalizeEvents([checkpoint, ...events.slice(1)])];
    for (const loaded of loadedVariants) for (const count of [1, 2]) {
      const seen = await viewAsSeen({ world: finalWorld, events: loaded, chats: [], game: { gameDate: states.at(-1).date } },
        { unseen: new Set(events.slice(count).map(({ id }) => id)) });
      assert.ok(seen.world.characterSystem, `checkpoint ${count} must keep the character panel available`);
      assert.deepEqual(withoutReign(seen.world.characterSystem), withoutReign(normalizeCharacterSystem(states[count])));
      assert.equal(seen.world.characterSystem.reign.rulerId, states[count].offices.ruler.holderId);
      assert.equal(seen.world.countryStats.Hadara.leader, getCharacterPresentation(seen.world.characterSystem).ruler.name);
      assert.equal(seen.game.gameDate, states[count].date);
      assert.equal(seen.world.characterViewUnavailable, undefined);
    }
    const complete = await viewAsSeen({ world: finalWorld, events }, { unseen: new Set() });
    assert.equal(complete.world, finalWorld);
    assert.deepEqual({ world: finalWorld, events, snapshots }, saved);
  } finally { globalThis.fetch = originalFetch; }
});

test("current-version replay still rejects an office change without a matching reign", () => {
  const { world, states, events } = fixture();
  const current = normalizeWorldState(world);
  const forged = plain(current.characterSystem);
  forged.offices.ruler.holderId = states[2].offices.ruler.holderId;
  forged.revision++;
  const event = { ...events[1], impacts: { characterOps: [{ id: "forged-office", kind: "patch",
    fromRevision: current.characterSystem.revision, toRevision: forged.revision,
    changes: diffCharacterState(current.characterSystem, forged) }] } };
  assert.throws(() => stage(current, [event]), /Regeringens uppgifter/);
  assert.throws(() => normalizeCharacterSystem(forged), /Regeringens uppgifter/);
});

test("legacy replay retains source trust, revision checks and gate metadata", () => {
  const { world, events } = fixture();
  const untrusted = { ...events[0], source: "ai", date: world.characterSystem.date };
  assert.deepEqual(stage(world, [untrusted]).characterSystem, normalizeCharacterSystem(world.characterSystem));
  assert.throws(() => stage(world, [events[1]]), /annan världsversion/);
  const badRevision = plain(events[0]);
  badRevision.impacts.characterOps[0].toRevision++;
  assert.throws(() => stage(world, [badRevision]), /revision stämmer inte/);

  const gate = plain(events[0]);
  gate.source = "ai";
  gate.date = world.characterSystem.date;
  gate.impacts.characterOps[0].gate = true;
  const migrated = createLegacyCharacterReplay(world.characterSystem)(gate, normalizeCharacterSystem(world.characterSystem));
  assert.equal(migrated.impacts.characterOps[0].gate, true);
  assert.equal(migrated.impacts.characterOps[0].id, gate.impacts.characterOps[0].id);
  assert.deepEqual(stage(world, [gate]).characterSystem, stage(world, [events[0]]).characterSystem);
});

test("legacy full checkpoints can precede patches and current checkpoints end compatibility", () => {
  const { world, states, events } = fixture();
  const checkpoint = { ...events[0], impacts: { characterOps: [{ id: "legacy-full", kind: "checkpoint",
    fromRevision: states[0].revision, state: states[1] }] } };
  // readEventsState normalizes the stored log before either reveal reader sees it.
  const loaded = normalizeEvents([checkpoint, ...events.slice(1)]);
  assert.deepEqual(loaded[0].impacts.characterOps[0].state, states[1], "event reads preserve validated raw legacy payloads");
  const replay = stage(world, loaded);
  assert.equal(replay.characterSystem.reign.rulerId, states.at(-1).offices.ruler.holderId);
  assert.deepEqual(withoutReign(replay.characterSystem), withoutReign(normalizeCharacterSystem(states.at(-1))));
  const checkpointOnly = stage(world, loaded.slice(0, 1));
  assert.equal(checkpointOnly.characterSystem.extensionsVersion, 3);
  assert.deepEqual(normalizeCharacterSystem(plain(checkpointOnly.characterSystem)), checkpointOnly.characterSystem);

  const currentCheckpoint = plain(checkpoint);
  currentCheckpoint.impacts.characterOps[0].state = normalizeCharacterSystem(states[1]);
  assert.throws(() => stage(world, [currentCheckpoint, events[1]]), /Regeringens uppgifter/);
  const malformed = plain(checkpoint);
  malformed.impacts.characterOps[0].state.offices.ruler.holderId = "missing-person";
  assert.throws(() => normalizeEvents([malformed]), /ogiltig innehavare/);
  const forged = plain(currentCheckpoint);
  forged.impacts.characterOps[0].state.reign.rulerId = states[2].offices.ruler.holderId;
  assert.throws(() => normalizeEvents([forged]), /Regeringens uppgifter/);
});

test("legacy succession replay follows an intervening model event's date synchronization", async () => {
  const initial = createCharacterSystem({ polityId: "Hadara", date: "-0300-01-01", seed: 17 });
  const february = advanceCharacters(initial, "-0300-02-01").state;
  const modelEvent = { id: "interleaved-model", title: "Synthetic dated event", source: "ai", date: "-0300-02-15", impacts: {} };
  const synced = synchronizeCharacterEventDate({ characterSystem: february }, modelEvent).world.characterSystem;
  const succession = executeCharacterCommand(synced, { id: "interleaved-abdication", expectedRevision: synced.revision, type: "abdicate", payload: {} });
  assert.equal(succession.ok, true, succession.error);
  const final = advanceCharacters(succession.state, "-0300-03-01").state;
  assert.deepEqual([initial.revision, february.revision, synced.revision, succession.state.revision], [0, 1, 2, 3]);
  const patch = (before, after, id) => ({ id, title: "Synthetic saved outcome", source: "character-system", date: after.date,
    impacts: { characterOps: [{ id: `${id}-patch`, kind: "patch", fromRevision: before.revision, toRevision: after.revision,
      changes: diffCharacterState(before, after) }] } });
  const currentEvents = [patch(initial, february, "interleaved-first"), modelEvent,
    patch(synced, succession.state, "interleaved-succession"), patch(succession.state, final, "interleaved-last")];
  const events = [patch(legacy(initial), legacy(february), "interleaved-first"), modelEvent,
    patch(legacy(synced), legacy(succession.state), "interleaved-succession"), patch(legacy(succession.state), legacy(final), "interleaved-last")];
  const world = { characterSystem: legacy(initial) };
  const saved = plain({ world, events });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify([{ fromDate: initial.date, toDate: final.date, state: { world } }]),
    { status: 200, headers: { "Content-Type": "application/json" } });
  setRuntimeAssetEndpoints({ token: "legacy-interleaved-date-sync" });
  try {
    const checkpoint = { ...events[0], impacts: { characterOps: [{ id: "interleaved-full", kind: "checkpoint",
      fromRevision: initial.revision, state: legacy(february) }] } };
    const variants = [normalizeEvents(events), normalizeEvents([checkpoint, ...events.slice(1)])];
    for (const loaded of variants) for (let count = 1; count <= events.length; count++) {
      const control = stage({ characterSystem: initial }, currentEvents.slice(0, count));
      const replay = stage(world, loaded.slice(0, count));
      assert.deepEqual(withoutReign(replay.characterSystem), withoutReign(control.characterSystem));
      assert.equal(replay.characterSystem.reign.rulerId, control.characterSystem.reign.rulerId);
      assert.deepEqual(streams(replay.characterSystem), streams(control.characterSystem));
      assert.deepEqual(stage(replay, loaded.slice(0, count)).characterSystem, replay.characterSystem);
    }
    const invalid = plain(events);
    invalid[2].impacts.characterOps[0].fromRevision = 0;
    assert.throws(() => stage(world, invalid), /annan världsversion/, "date synchronization must not bypass a mismatched revision");
    const finalWorld = normalizeWorldState({ characterSystem: legacy(final),
      simulationHistory: [{ fromDate: initial.date, toDate: final.date, eventIds: events.map(({ id }) => id) }] });
    const seen = await viewAsSeen({ world: finalWorld, events: normalizeEvents(events), game: { gameDate: final.date } },
      { unseen: new Set([events.at(-1).id]) });
    assert.ok(seen.world.characterSystem, "partial reveal retains the panel after the interleaved succession");
    assert.equal(seen.world.characterSystem.revision, 3);
    assert.equal(seen.world.characterSystem.reign.rulerId, "person-0-2");
    assert.equal(seen.game.gameDate, modelEvent.date);
    assert.deepEqual(streams(seen.world.characterSystem), streams(succession.state));
    assert.deepEqual({ world, events }, saved);
  } finally { globalThis.fetch = originalFetch; }
});
