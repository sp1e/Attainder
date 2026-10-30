import test from "node:test";
import assert from "node:assert/strict";
import { setRuntimeAssetEndpoints } from "./assets.js";
import { applyEventImpactsToWorld, normalizeEvents } from "./gameState.js";
import { initializeCampaignCharacters, advanceCharacterYear, readVisibleCharacterState,
  commitCharacterCampaign } from "./characterRuntime.js";

for (const mode of ["realm", "family"]) test(`${mode} collapse saves and reloads through runtime assets, with recoverable failed writes`, async () => {
  const originalFetch = globalThis.fetch;
  const data = {
    world: { polityOverrides: { Hadara: { name: "Hadara", status: "active" }, Qedar: { name: "Qedar", status: "active" } },
      regionOwnershipOverrides: { H1: "Hadara", Q1: "Qedar" } },
    game: { country: "Hadara", gameDate: "-0300-01-01", startDate: "-0300-01-01", round: 1 },
    events: [], actions: [], chat: [], colors: { Hadara: "#789abc", Qedar: "#abc789" }, snapshots: [],
  };
  let failEventWrite = false;
  globalThis.fetch = async (url, options = {}) => {
    const key = new URL(String(url), "http://runtime.test").pathname.split("/").at(-1);
    if (options.method === "PUT") {
      if (key === "events" && failEventWrite) {
        failEventWrite = false;
        return new Response("failure", { status: 503 });
      }
      data[key] = JSON.parse(options.body);
    }
    return new Response(JSON.stringify(data[key] ?? {}), { status: 200,
      headers: { "Content-Type": "application/json" } });
  };
  setRuntimeAssetEndpoints({ token: `collapse-runtime-${mode}` });
  try {
    const init = await initializeCampaignCharacters({ mode, seed: 41 });
    assert.equal(init.ok, true, init.error);
    const base = JSON.parse(JSON.stringify(Object.fromEntries(
      ["game", "world", "events", "actions", "chat", "colors"].map((key) => [key, data[key]]))));
    const events = normalizeEvents([{ id: "annexation", date: base.game.gameDate, title: "Hadara upphör", impacts: {
      regionTransfers: [{ regionId: "H1", fromCode: "Hadara", toCode: "Qedar" }],
      polityChanges: [{ code: "Hadara", operation: "dissolve" }],
    } }]);
    const applied = applyEventImpactsToWorld({ world: base.world, colors: base.colors, events });
    const next = { ...base, world: applied.world, colors: applied.colors, events: [...base.events, ...events] };
    failEventWrite = true;
    await assert.rejects(commitCharacterCampaign({ id: `failed-collapse-${mode}`, base, next }));
    assert.deepEqual(data.world, base.world);
    assert.deepEqual(data.events, base.events);
    await commitCharacterCampaign({ id: `collapse-${mode}`, base, next });
    const loaded = await readVisibleCharacterState({ force: true });
    assert.deepEqual(loaded, next.world.characterSystem);
    assert.equal(loaded.realm.alive, false);
    assert.equal(loaded.identity.polityId, "Hadara");
    assert.equal(loaded.status.ended, mode === "realm");
    assert.equal(data.world.countryStats.Hadara, undefined);
    assert.equal(data.snapshots[0].state.world.characterSystem.realm.alive, true);
    assert.equal(data.world.characterTransaction, null);
    assert.deepEqual(applyEventImpactsToWorld({ world: data.world, events }).world.characterSystem, loaded);
    const progression = await advanceCharacterYear();
    assert.equal(progression.ok, mode === "family", progression.error);
    if (progression.ok) {
      assert.equal(progression.state.realm.alive, false);
      assert.equal(data.game.gameDate, "-0299-01-01");
      assert.equal(data.world.countryStats.Hadara, undefined);
    }
  } finally { globalThis.fetch = originalFetch; }
});
