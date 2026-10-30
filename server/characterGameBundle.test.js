import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = path.resolve(repository, "../reports/test-artifacts");

// A fresh process is essential: OH_DATA_DIR is captured at module import. No
// live library, HTTP server, browser profile or installed application is used.
async function roundtripWorker() {
  const assert = (await import("node:assert/strict")).default;
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { createHash } = await import("node:crypto");
  const { registerHooks } = await import("node:module");
  const root = path.resolve(process.env.OH_DATA_DIR);
  const output = path.resolve(process.env.OH_CHARACTER_TEST_OUTPUT);
  assert.equal(root, path.join(output, "desktop-data"));
  const store = await import("./server/libraryStore.js");
  const { createDynastyScenarioBundle, createDynastyWorld } = await import("./src/runtime/dynastyScenario.js");
  const { advanceCharacters, executeCharacterCommand, getCharacterPresentation } = await import("./src/runtime/characters/index.js");
  const { addGameMonths } = await import("./src/runtime/gameDates.js");
  const { normalizeWorldState } = await import("./src/runtime/gameState.js");
  const { characterTransitionEvents } = await import("./src/runtime/characterWorld.js");
  const { installFakeIndexedDb } = await import("./src/runtime/web/fakeIndexedDb.js");
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const response = (value) => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
  let webStore;
  let transport = "desktop";
  globalThis.fetch = async (url, options = {}) => {
    const pathname = new URL(String(url), "http://isolated.invalid").pathname;
    const [, api, resource, ...segments] = pathname.split("/");
    if (api === "api" && ["games", "scenarios"].includes(resource)) {
      if (transport === "web") {
        const handler = resource === "games" ? webStore.handleGames : webStore.handleScenarios;
        return handler({ method: options.method || "GET", segments, query: new URLSearchParams() });
      }
      const id = decodeURIComponent(segments[0] || "");
      if (resource === "games" && segments[1] === "export") return response(store.exportGameBundle(id));
      if (resource === "games" && segments[1] === "snapshots") return response(store.readGameSnapshots(id));
      if (resource === "scenarios" && segments[1] === "export") return response(store.exportScenarioBundle(id));
    }
    // Settings and diagnostics cannot consult a real user profile in this test.
    return new Response("Isolated test: endpoint unavailable", { status: 503 });
  };
  const { buildGameZipBlob, readGameZip } = await import("./src/runtime/gameZip.js");

  // The real web store and idb.js run against the repository's IndexedDB test
  // driver. Only generated build-time defaults are replaced, as in its tests.
  installFakeIndexedDb();
  const seed = createDynastyScenarioBundle();
  seed.data.world.ownerSchema = 4;
  const generated = {
    "countryNames.js": "export default {};",
    "fallbackColors.js": "export default {Hadara:'#b99755'};",
    "defaultScenarioMeta.js": "export const builtInMap='test-map'; export const builtInRevision=1; export const regionsUrl=''; export const earlierMaps={};",
    "defaultScenario.js": `export default ${JSON.stringify({ meta: { name: "Isolated test" }, data: seed.data, colors: { Hadara: "#b99755" } })};`,
  };
  registerHooks({ resolve(specifier, context, nextResolve) {
    const match = /\/generated\/([^/]+)$/.exec(specifier);
    if (String(context.parentURL).includes("/runtime/web/") && match && generated[match[1]]) {
      return { url: `data:text/javascript,${encodeURIComponent(generated[match[1]])}`, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  } });
  webStore = await import("./src/runtime/web/libraryStore.js");
  await webStore.ensureSeeded();
  const webCall = async (resource, method, route, body) => {
    const handler = resource === "games" ? webStore.handleGames : webStore.handleScenarios;
    const reply = await handler({ method, segments: route.split("/").filter(Boolean), body, query: new URLSearchParams() });
    const data = await reply.json();
    assert.ok(reply.ok, `Web ${resource}/${route}: ${JSON.stringify(data)}`);
    return data;
  };
  await webCall("games", "POST", "", { name: "Unrelated isolated campaign", scenarioId: "default", setActive: true });
  const summaries = [];
  for (const mode of ["realm", "family"]) {
    transport = "desktop";
    const scenario = store.importScenarioBundle(createDynastyScenarioBundle(), { setSelected: false });
    const campaign = store.createGame({ id: `portable-${mode}`, name: `Portable ${mode}`, scenarioId: scenario.scenario.id, setActive: true });
    const id = campaign.game.id;
    let world = createDynastyWorld({ mode, seed: 321 });
    let state = world.characterSystem;
    // Controlled governance fixture: an actual core-resolved coup supplies
    // disputed claims/memories; minority supplies a nonempty regency record.
    state.stories.push({ id: "portable-seizure", type: "coup", title: "Maktövertagande",
      description: "En politisk utmanare", actorId: "person-1-0", targetId: "person-0-0", familyId: "family-namar",
      createdAt: state.date, dueAt: addGameMonths(state.date, 12), status: "open", knownBy: "public" });
    const seizure = executeCharacterCommand(state, { id: `portable-coup-${mode}`, expectedRevision: state.revision,
      type: "resolve_story", payload: { storyId: "portable-seizure", choiceId: "yield" } });
    assert.equal(seizure.ok, true, seizure.error);
    state = seizure.state;
    const principal = state.people["person-1-4"];
    const regent = state.people["person-1-0"];
    principal.bornAt = addGameMonths(state.date, -10 * 12);
    principal.health = 100;
    regent.health = 100;
    state.offices.ruler.holderId = principal.id;
    state.offices.ruler.regentId = regent.id;
    state.regencies["office:ruler"] = { id: "office:ruler", principalId: principal.id, regentId: regent.id,
      phase: "minority", startedAt: state.date, grants: [], requestAfter: {}, handoverDueAt: null };
    // Reproducible exposure from the real calendar, not a free disease command.
    state.healthRngState = 1;
    const before = normalizeWorldState({ ...world, ownerSchema: 4, characterSystem: state });
    const year = advanceCharacters(state, addGameMonths(state.date, 12), { id: `portable-year-${mode}` });
    assert.equal(year.ok, true, year.error);
    state = year.state;
    assert.ok(state.memories.length > 0);
    assert.ok(Object.values(state.families).some((family) => family.claims.length > 0));
    assert.ok(Object.keys(state.regencies).length > 0);
    const patient = Object.values(state.people).find((person) => person.healthConditions.some((condition) => condition.kind === "smallpox" && condition.stage === "active"));
    assert.ok(patient, "the fixture must contain a real calendar-generated active smallpox case");
    const initialPortrait = getCharacterPresentation(state).people.find((person) => person.id === patient.id).portraitState;
    assert.equal(initialPortrait.visualState, "smallpox");
    const events = characterTransitionEvents(before.characterSystem, year, `portable-year-${mode}`);
    world = normalizeWorldState({ ...before, characterSystem: state });
    const game = { country: "Hadara", gameDate: state.date, startDate: before.characterSystem.date, round: 2 };
    store.updateGame(id, { world, game, storage: { events, actions: [], chat: [], advisor: [] } });
    const snapshots = [{ id: `portable-snapshot-${mode}`, round: 1, fromDate: before.characterSystem.date, toDate: state.date,
      state: { world: before, game: { ...game, gameDate: before.characterSystem.date, round: 1 }, events: [], actions: [], chat: [] } }];
    store.writeGameSnapshots(id, snapshots);

    const directBundle = store.exportGameBundle(id);
    const directImport = store.importGameBundle(clone(directBundle));
    assert.notEqual(directImport.game.id, id);
    assert.deepEqual(directImport.data.world.characterSystem, state);
    assert.deepEqual(directImport.data.events, events);
    assert.equal(store.getGameCatalog().activeGameId, id);
    assert.equal(directBundle.data.snapshots, undefined, "restore points intentionally travel as a separate ZIP entry");

    const zip = await buildGameZipBlob(id);
    assert.equal(zip.carriesScenario, true);
    const bytes = new Uint8Array(await zip.blob.arrayBuffer());
    fs.writeFileSync(path.join(output, `${mode}-desktop.zip`), bytes);
    const decoded = await readGameZip(bytes);
    assert.deepEqual(decoded.bundle.data.world.characterSystem, state);
    assert.deepEqual(JSON.parse(decoded.snapshotsText), snapshots);
    assert.ok(decoded.scenarioBundle.assets.regionsGeojson);
    const importedScenario = store.importScenarioBundle(decoded.scenarioBundle, { setSelected: false });
    decoded.bundle.scenarioRef.scenarioId = importedScenario.scenario.id;
    const zipImport = store.importGameBundle(decoded.bundle);
    store.writeGameSnapshots(zipImport.game.id, JSON.parse(decoded.snapshotsText));
    assert.deepEqual(store.exportGameBundle(zipImport.game.id).data.world.characterSystem, state);
    assert.deepEqual(store.readGameSnapshots(zipImport.game.id), snapshots);
    assert.equal(store.getGameCatalog().activeGameId, id);

    const webActiveBefore = (await webCall("games", "GET", "")).activeGameId;
    const webScenario = await webCall("scenarios", "POST", "import", decoded.scenarioBundle);
    const webBundle = clone(decoded.bundle);
    webBundle.scenarioRef.scenarioId = webScenario.scenario.id;
    const webImported = await webCall("games", "POST", "import", webBundle);
    await webCall("games", "PUT", `${webImported.game.id}/snapshots`, JSON.parse(decoded.snapshotsText));
    const webExported = await webCall("games", "GET", `${webImported.game.id}/export`);
    assert.deepEqual(webExported.data.world.characterSystem, state);
    assert.deepEqual(webExported.data.events, events);
    assert.deepEqual(await webCall("games", "GET", `${webImported.game.id}/snapshots`), snapshots);
    assert.equal((await webCall("games", "GET", "")).activeGameId, webActiveBefore);
    transport = "web";
    const webZip = await buildGameZipBlob(webImported.game.id);
    const webBytes = new Uint8Array(await webZip.blob.arrayBuffer());
    fs.writeFileSync(path.join(output, `${mode}-web-adapter.zip`), webBytes);
    const webDecoded = await readGameZip(webBytes);
    assert.deepEqual(webDecoded.bundle.data.world.characterSystem, state);
    assert.deepEqual(JSON.parse(webDecoded.snapshotsText), snapshots);
    const returnedScenario = store.importScenarioBundle(webDecoded.scenarioBundle, { setSelected: false });
    webDecoded.bundle.scenarioRef.scenarioId = returnedScenario.scenario.id;
    const backOnDesktop = store.importGameBundle(webDecoded.bundle);
    store.writeGameSnapshots(backOnDesktop.game.id, JSON.parse(webDecoded.snapshotsText));
    assert.deepEqual(backOnDesktop.data.world.characterSystem, state);
    assert.equal(store.getGameCatalog().activeGameId, id);
    const continued = advanceCharacters(backOnDesktop.data.world.characterSystem, addGameMonths(state.date, 12), { id: "after-import" });
    const expected = advanceCharacters(state, addGameMonths(state.date, 12), { id: "after-import" });
    assert.equal(continued.ok, true, continued.error);
    assert.deepEqual(continued, expected, "the next year must remain deterministic after desktop/web/ZIP import");
    const continuedPortrait = getCharacterPresentation(continued.state).people.find((person) => person.id === patient.id).portraitState;
    assert.equal(continuedPortrait.identityId, initialPortrait.identityId);
    const initialCondition = patient.healthConditions.find((condition) => condition.kind === "smallpox" && condition.stage === "active");
    const finalCondition = continued.state.people[patient.id].healthConditions.find((condition) => condition.id === initialCondition.id);
    assert.ok(["scarred", "resolved"].includes(finalCondition.stage));
    assert.equal(continuedPortrait.visualState, finalCondition.stage === "scarred" ? "smallpox-scars" : "healthy");
    summaries.push({ mode, people: Object.keys(state.people).length, claims: Object.values(state.families).reduce((sum, family) => sum + family.claims.length, 0),
      regencies: Object.keys(state.regencies).length, memories: state.memories.length, revision: state.revision, rngState: state.rngState,
      healthRngState: state.healthRngState, healthConditions: Object.values(state.people).reduce((sum, person) => sum + person.healthConditions.length, 0),
      healthPortraitBefore: initialPortrait.variantKey, healthPortraitAfter: continuedPortrait.variantKey,
      characterStateSha256: hash(state), desktopZipBytes: bytes.length, webAdapterZipBytes: webBytes.length,
      directBundle: "passed", desktopZip: "passed", desktopToWebAdapter: "passed", webAdapterZipToDesktop: "passed", nextYearDeterminism: "passed" });
  }
  fs.writeFileSync(path.join(output, "result.json"), JSON.stringify({ generatedAt: new Date().toISOString(),
    scope: "Real server bundle store and client ZIP code; real web handlers/idb.js with repository fakeIndexedDb. No OS download dialog, real browser IndexedDB or HTTP server.", cases: summaries }, null, 2));
  process.stdout.write("\n@@" + JSON.stringify({ output, cases: summaries }));
}

test("character campaigns round-trip through desktop bundles, real ZIP code, and the web storage adapter", () => {
  mkdirSync(artifacts, { recursive: true });
  const output = mkdtempSync(path.join(artifacts, "character-bundle-"));
  assert.ok(output.startsWith(artifacts + path.sep));
  const data = path.join(output, "desktop-data");
  const script = `(${roundtripWorker.toString()})().catch(error => { console.error(error); process.exitCode = 1; });`;
  let out;
  try {
    out = execFileSync(process.execPath, ["--input-type=module", "-e", script], { cwd: repository,
      env: { ...process.env, OH_DATA_DIR: data, OH_CHARACTER_TEST_OUTPUT: output }, encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"], timeout: 60000, maxBuffer: 1024 * 1024 });
  } catch (error) { assert.fail(`Isolated bundle test failed:\n${error.stderr || error.message}`); }
  const result = JSON.parse(out.slice(out.lastIndexOf("\n@@") + 3));
  assert.equal(result.cases.length, 2);
  const persisted = JSON.parse(readFileSync(path.join(output, "result.json"), "utf-8"));
  assert.deepEqual(persisted.cases, result.cases);
  console.info(`Character export/import evidence: ${output}`);
});
