// The library catalog's row for the active game follows the game's own writes: the top bar reads its date and round from that row.
import test from "node:test";
import assert from "node:assert/strict";

// library.js installs its listener when it loads, so the window exists before the imports below.
globalThis.window ??= Object.assign(new EventTarget(), { location: new URL("http://runtime.test/") });
const { setRuntimeAssetEndpoints } = await import("./assets.js");
const { initializeCampaignCharacters, advanceCharacterYear } = await import("./characterRuntime.js");
const { getLibraryState, refreshLibraryCatalog } = await import("./library.js");

const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

test("a character year turn moves the active game's catalog date and round", async () => {
  const originalFetch = globalThis.fetch;
  const data = {
    world: { units: [] },
    game: { country: "Hadara", gameDate: "0800-12-25", startDate: "0800-12-25", round: 1 },
    events: [], actions: [], chat: [], colors: { Hadara: "#789abc" }, snapshots: [],
  };
  let catalogReads = 0;
  globalThis.fetch = async (url, options = {}) => {
    const path = new URL(String(url), "http://runtime.test").pathname;
    if (path === "/api/library") {
      catalogReads += 1;
      return json({ activeGameId: "g1", scenarios: [], games: [
        { id: "g1", name: "Karl", scenarioId: "s1", country: data.game.country, currentDate: data.game.gameDate, round: data.game.round },
        { id: "g2", name: "Annan", scenarioId: "s1", country: "Hadara", currentDate: "0750-01-01", round: 3 },
      ] });
    }
    const key = path.split("/").at(-1);
    if (options.method === "PUT") data[key] = JSON.parse(options.body);
    return json(data[key] ?? {});
  };
  try {
    await refreshLibraryCatalog({ force: true });
    setRuntimeAssetEndpoints({ token: "library-follows-game" });
    assert.equal(getLibraryState().activeGame.currentDate, "0800-12-25");
    const init = await initializeCampaignCharacters({ mode: "realm", seed: 41 });
    assert.equal(init.ok, true, init.error);
    const reads = catalogReads;
    const year = await advanceCharacterYear();
    assert.equal(year.ok, true, year.error);
    assert.equal(data.game.gameDate, "0801-12-25");
    const { activeGame, games } = getLibraryState();
    assert.equal(activeGame.currentDate, data.game.gameDate, "the top bar's date follows the saved game");
    assert.equal(activeGame.round, data.game.round);
    assert.equal(games.find((game) => game.id === "g1").currentDate, data.game.gameDate, "the list row follows too");
    assert.equal(games.find((game) => game.id === "g2").currentDate, "0750-01-01", "another save keeps its date");
    assert.equal(catalogReads, reads, "the turn reads no catalog");

    const settled = getLibraryState();
    window.dispatchEvent(new CustomEvent("oh:game-updated", { detail: { game: data.game } }));
    assert.equal(getLibraryState(), settled, "a write that moves neither date nor round leaves the state as it is");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
