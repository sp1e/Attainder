/*! Open Historia — web library store behaviour © 2026 Nicholas Krol, AGPL-3.0-or-later (see LICENSE). */
// Run: node --test src/runtime/web/libraryStore.test.js
//
// The web store holds every save for web and Android players, and the other
// tests only read its source as text. It loads here with two stand-ins,
// redirected by a module hook:
// - idb.js becomes an in-memory table per object store. Reads hand back
//   structured clones, as IndexedDB does.
// - the web build's generated modules (the seed, the country table, the colour
//   palette) are gitignored build output that a clean checkout does not have, so
//   they are replaced by small fixed ones.
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { readFileSync } from "node:fs";
import { restoreScenarioFileForGame } from '../scenarioFile.js';
import { zipBundle } from '../bundleZip.js';
import { SHIPPED_START_FOLDERS } from '../testing/shippedHistoricalStarts.js';

const db = new Map();
globalThis.__ohWebStoreTestDb = db;
globalThis.__ohWebStoreWrites = 0;
// Every idbGet ("store:key") and idbGetAll ("store:*"), in order.
globalThis.__ohWebStoreReads = [];

const IDB_STUB = `
export const STORES = {
  scenarios: "scenarios", games: "games", mapeditorDocs: "mapeditorDocs", basemapMeta: "basemapMeta",
  basemapPayload: "basemapPayload", flags: "flags", kv: "kv", scenarioMeta: "scenarioMeta", gameMeta: "gameMeta",
};
const db = globalThis.__ohWebStoreTestDb;
const table = (name) => { if (!db.has(name)) db.set(name, new Map()); return db.get(name); };
const copy = (value) => (value === undefined ? undefined : structuredClone(value));
export const idbGet = async (store, key) => { globalThis.__ohWebStoreReads.push(store + ":" + key); return copy(table(store).get(key)); };
export const idbGetAll = async (store) => { globalThis.__ohWebStoreReads.push(store + ":*"); return [...table(store).values()].map(copy); };
export const idbGetAllKeys = async (store) => [...table(store).keys()];
export const idbPut = async (store, value) => { globalThis.__ohWebStoreWrites++; table(store).set(store === "kv" ? value.key : value.id, copy(value)); };
export const idbPutPair = async (storeA, valueA, storeB, valueB) => { await idbPut(storeA, valueA); await idbPut(storeB, valueB); };
export const idbDelete = async (store, key) => { globalThis.__ohWebStoreWrites++; table(store).delete(key); };
export const kvGet = async (key, fallback = null) => { const record = table("kv").get(key); return record ? copy(record.value) : fallback; };
export const kvPut = (key, value) => idbPut("kv", { key, value });
`;

const BUNDLED_TEST_REGIONS={type:'FeatureCollection',features:[{type:'Feature',properties:{id:'old'},geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]]}}]};

const GENERATED = {
  "countryNames.js": `export default { USA: "United States", RUS: "Russia" };`,
  "defaultScenario.js": `export default ${JSON.stringify({
    meta: { name: "Modern Day" },
    data: {
      actions: [], advisor: [], chat: [], events: [], prompts: {},
      game: { country: "Testland", gameDate: "2016-01-01", startDate: "2016-01-01" },
      world: { builtInMap: "test-map", builtInRevision: 2, ownerSchema: 4, polityOverrides: { Testland: { name: "Testland" } } },
    },
    colors: { Testland: [1, 2, 3] },
  })};`,
  // An empty regionsUrl keeps usesBuiltInMap false, so nothing is fetched.
  "defaultScenarioMeta.js": `export const builtInMap = "test-map"; export const builtInRevision = 2; export const regionsUrl = ${JSON.stringify('data:application/json,'+encodeURIComponent(JSON.stringify(BUNDLED_TEST_REGIONS)))}; export const earlierMaps = {};`,
  "fallbackColors.js": `export default { Palette: [9, 9, 9] };`,
};
const moduleUrl = (source) => `data:text/javascript,${encodeURIComponent(source)}`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (String(context.parentURL ?? "").includes("/runtime/web/")) {
      if (specifier === "./idb.js") return { url: moduleUrl(IDB_STUB), shortCircuit: true };
      const generated = /\/generated\/([^/]+)$/.exec(specifier);
      if (generated && GENERATED[generated[1]]) return { url: moduleUrl(GENERATED[generated[1]]), shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const store = await import("./libraryStore.js");

const reset = async () => {
  db.clear();
  await store.ensureSeeded();
};

const call = async (handler, method, path, body) => {
  const segments = path.split("/").filter(Boolean);
  const response = await handler({ method, segments, body, query: new URLSearchParams() });
  assert.ok(response, `${method} ${path} was not handled`);
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
};
const scenarios = (method, path, body) => call(store.handleScenarios, method, path, body);
const games = (method, path, body) => call(store.handleGames, method, path, body);

test('web historical scenario retains component terms, original sources and asset hashes through import/export', async () => {
  await reset();
  const { readFile } = await import('node:fs/promises');
  const original = JSON.parse(await readFile(new URL('../../../server/seed/historical/egypt-3000bc/scenario.json', import.meta.url),'utf8'));
  const first = ok(await scenarios('POST','import',original)).scenario.id;
  const exported = ok(await scenarios('GET',`${first}/export`));
  const second = ok(await scenarios('POST','import',exported)).scenario.id;
  const roundtrip = ok(await scenarios('GET',`${second}/export`));
  for (const b of [exported,roundtrip]) {
    assert.deepEqual(b.componentLicenses,original.componentLicenses);
    assert.deepEqual(b.assets.regionsGeojson.provenance,original.assets.regionsGeojson.provenance);
    assert.deepEqual(b.data.world.historicalScenario,original.data.world.historicalScenario);
    assert.deepEqual(b.assets.regionsGeojson.data,original.assets.regionsGeojson.data);
    assert.equal(b.license.scope,'authored-content');
  }
});
const ok = (reply) => {
  assert.ok(reply.status < 300, `HTTP ${reply.status}: ${JSON.stringify(reply.data)}`);
  return reply.data;
};

const HISTORICAL = JSON.parse(readFileSync(new URL('../../../server/seed/historical/john-1200/scenario.json', import.meta.url), 'utf8'));
const REGIONS = HISTORICAL.assets.regionsGeojson.data;
const CITIES = HISTORICAL.assets.citiesGeojson.data;
const BACKGROUND = { kind: "image", opacity: 0.5 };

// A bundle in the shape both exporters write today: the geometry as parsed JSON.
const scenarioBundle = (name, extra = {}) => ({
  ...structuredClone(HISTORICAL),
  scenario: { ...HISTORICAL.scenario, id: "hub-map", name },
  assets: {
    ...structuredClone(HISTORICAL.assets),
    backgroundData: { contentType: "application/json", data: BACKGROUND, fileName: "background.json", mode: "embedded" },
    ...extra,
  },
});

const scenarioAsset = async (id, key) => {
  try {
    const response = await store.handleScenarios({ method: "GET", segments: [id, "assets", key], query: new URLSearchParams() });
    return response.status === 200 ? JSON.parse(await response.text()) : null;
  } catch {
    return null;
  }
};

test("a hub Update keeps the geometry, cities and basemap a current bundle carries as JSON", async () => {
  await reset();
  const imported = ok(await scenarios("POST", "import", scenarioBundle("Hub Map")));
  const id = imported.scenario.id;
  assert.deepEqual(await scenarioAsset(id, "regionsGeojson"), REGIONS);

  const updatedRegions = structuredClone(REGIONS);
  updatedRegions.features[0].properties.edited = true;
  const bundle = scenarioBundle("Hub Map v2");
  bundle.assets.regionsGeojson.data = updatedRegions;
  const updated = ok(await scenarios("PUT", `${id}/import`, bundle));

  assert.equal(updated.scenario.name, "Hub Map v2");
  assert.equal(updated.assetStatus.regionsGeojson, true);
  assert.equal(updated.assetStatus.citiesGeojson, true);
  assert.equal(updated.assetStatus.backgroundData, true);
  assert.deepEqual(await scenarioAsset(id, "regionsGeojson"), updatedRegions);
  assert.deepEqual(await scenarioAsset(id, "citiesGeojson"), CITIES);
  assert.deepEqual(await scenarioAsset(id, "backgroundData"), BACKGROUND);
});

test("a hub Update still clears an asset the new bundle leaves out", async () => {
  await reset();
  const id = ok(await scenarios("POST", "import", scenarioBundle("Hub Map"))).scenario.id;
  const bundle = scenarioBundle("Hub Map v2");
  bundle.assets.backgroundData = { fileName: "background.json", mode: "default" };
  const updated = ok(await scenarios("PUT", `${id}/import`, bundle));
  assert.equal(updated.assetStatus.backgroundData, false);
  assert.equal(updated.assetStatus.regionsGeojson, true);
  assert.equal(await scenarioAsset(id, "backgroundData"), null);
});

// ---- links to the community hub (server/hubProvenance.js, shared with the desktop store) ----

const HUB_FILE = (version) => `https://github.com/user-attachments/files/${version}/hub-map.zip`;
const HUB_RELEASE = (version) => `https://github.com/Open-Historia/Open-historia-scenarios/releases/download/scenarios-1/p42-${version}-hub-map-0a1b2c3d.zip`;
// A post's file as the game hands it to the import: the bundle, stamped with
// where it came from. Without a release it is a link as it was made when the
// game still downloaded the post's own attachment, which is what every older
// save holds.
const hubBundle = (name, version = 1) => ({ ...scenarioBundle(name), hubOrigin: { postId: 42, bundleUrl: HUB_FILE(version) } });
const checkedBundle = (name, version) => ({ ...scenarioBundle(name), hubOrigin: { postId: 42, bundleUrl: HUB_FILE(version), release: HUB_RELEASE(version) } });
const PUBLISH_KEY = "oh-3f2a9c1e5d7b9a01";

test("a link keeps the checked copy it was downloaded from, and an Update gives an old link one", async () => {
  await reset();
  const id = ok(await scenarios("POST", "import", hubBundle("Hub Map"))).scenario.id;
  assert.equal(ok(await scenarios("GET", id)).scenario.hubOrigin.release, undefined, "an old link names no checked copy");
  const edited = ok(await scenarios("PUT", id, { name: "My Hub Map" })).scenario;
  assert.ok(edited.hubOrigin.editedAt);
  assert.equal(edited.hubOrigin.release, undefined, "an edit does not make an old link a checked one");

  // The Update its card asks for: the hub's checked file replaces the copy,
  // the player's changes with it, and the link says which copy it was.
  const updated = ok(await scenarios("PUT", `${id}/import`, checkedBundle("Hub Map", 1))).scenario;
  assert.equal(updated.name, "Hub Map");
  assert.equal(updated.hubOrigin.release, HUB_RELEASE(1));
  assert.equal(updated.hubOrigin.editedAt, undefined);
  assert.deepEqual(await scenarioAsset(id, "regionsGeojson"), REGIONS, "and the map is still there");
  ok(await scenarios("PUT", id, { hubPublished: { key: PUBLISH_KEY, postIds: [55] } }));
  const editedAgain = ok(await scenarios("PUT", id, { name: "Mine Again" })).scenario;
  assert.equal(editedAgain.hubOrigin.release, HUB_RELEASE(1), "bookkeeping and a later edit keep it");
  assert.ok(editedAgain.hubOrigin.editedAt);

  const imported = ok(await scenarios("POST", "import", checkedBundle("Second Copy", 2))).scenario;
  assert.equal(imported.hubOrigin.release, HUB_RELEASE(2), "an import keeps the copy it came from");
  const elsewhere = ok(await scenarios("POST", "import", {
    ...scenarioBundle("Elsewhere"),
    hubOrigin: { postId: 42, bundleUrl: HUB_FILE(3), release: "https://evil.example/releases/download/x/hub-map.zip" },
  })).scenario;
  assert.equal(elsewhere.hubOrigin.postId, 42);
  assert.equal(elsewhere.hubOrigin.release, undefined, "an address outside the hub's releases is not kept as one");
});

test("a game exported from a hub copy hands on the post and its file, never this library's download of it", async () => {
  await reset();
  const scenarioId = ok(await scenarios("POST", "import", checkedBundle("Hub Map", 1))).scenario.id;
  const gameId = ok(await games("POST", "", { name: "Campaign", scenarioId, setActive: true })).game.id;
  const exported = ok(await games("GET", `${gameId}/export`)).scenarioRef.hubOrigin;
  assert.deepEqual(Object.keys(exported).sort(), ["bundleUrl", "postId", "syncedAt"]);
  assert.equal(exported.bundleUrl, HUB_FILE(1));

  // Unlinked, the scenario is the player's own: nothing is handed on.
  assert.equal(ok(await scenarios("PUT", scenarioId, { hubOrigin: null })).scenario.hubOrigin, null);
  assert.equal(ok(await games("GET", `${gameId}/export`)).scenarioRef.hubOrigin, null);
});

test('historical web starts create a complete court and invalid requests make no writes', async () => {
  await reset();
  ok(await games('GET','')); // Materialize the installation's empty game manifest before the request baseline.
  { const before=structuredClone(db), writes=globalThis.__ohWebStoreWrites;
    assert.equal((await games('POST','',{gamePatch:{gameDate:null}})).status,400);
    assert.deepEqual(db,before); assert.equal(globalThis.__ohWebStoreWrites,writes); assert.equal(db.get('games')?.size ?? 0,0); }
  { const before=structuredClone(db), writes=globalThis.__ohWebStoreWrites;
    const response=await store.handleRuntimeJson({method:'PUT',segments:['json','game'],body:{gameDate:'2016-01-01'}});
    assert.equal(response.status,400); assert.deepEqual(db,before); assert.equal(globalThis.__ohWebStoreWrites,writes); }
  const { readFile } = await import('node:fs/promises');
  for (const bookmark of SHIPPED_START_FOLDERS) {
    const bundle = JSON.parse(await readFile(new URL(`../../../server/seed/historical/${bookmark}/scenario.json`,import.meta.url),'utf8'));
    const invalid=structuredClone(bundle); invalid.data.world.polityOverrides.modern={name:'Modern'};
    { const before=structuredClone(db), writes=globalThis.__ohWebStoreWrites;
      assert.equal((await scenarios('POST','import',invalid)).status,400); assert.deepEqual(db,before); assert.equal(globalThis.__ohWebStoreWrites,writes); }
    const scenarioId = ok(await scenarios('POST','import',bundle)).scenario.id;
    ok(await scenarios('PUT',scenarioId,{worldPatch:{characterSystem:{people:{sentinel:{id:'sentinel'}}},simulationHistory:[{id:'old'}]},storage:{events:[{id:'old'}]}}));
    const malformed=structuredClone(bundle); malformed.data.game.gameDate=null;
    const badCover=structuredClone(bundle); badCover.assets.cover={mode:'embedded',encoding:'base64',data:'@@@'};
    const forged=structuredClone(bundle); forged.data.game.startDate=forged.data.game.gameDate='2016-01-01'; forged.restoreOnly=true; forged.skipValidation=true;
    for (const run of [()=>scenarios('POST','',{gamePatch:{gameDate:null}}),()=>scenarios('PUT',scenarioId,{gamePatch:{startDate:'1531-01-01'}}),
      ()=>scenarios('POST','import',malformed),()=>scenarios('POST','import',badCover),()=>scenarios('POST','import',forged),()=>scenarios('PUT',`${scenarioId}/import`,malformed),
      ()=>store.handleScenarios({method:'DELETE',segments:[scenarioId,'assets','citiesGeojson'],query:new URLSearchParams()})]) {
      const before=structuredClone(db), writes=globalThis.__ohWebStoreWrites;
      assert.equal((await run()).status,400); assert.deepEqual(db,before); assert.equal(globalThis.__ohWebStoreWrites,writes);
    }
    const { buildPromptContext } = await import('../../Game/AI/promptContext.js');
    const { renderTemplateCached } = await import('../../Game/AI/promptLayout.js');
    const prompts=JSON.parse(await readFile(new URL('../../Game/AI/defaultPrompts.json',import.meta.url),'utf8'));
    const checkLanguage = async (game, expected) => {
      assert.equal(game.data.game.language,expected); assert.equal(game.data.world.language,expected);
      const context=await buildPromptContext(game.data,{requiredKeys:['language']}); assert.equal(context.language,expected);
      assert.ok(renderTemplateCached(prompts.tasks.jumpForward,context).text.includes('Write everything the player reads in '+expected));
    };
    const created = ok(await games('POST','',{scenarioId,gamePatch:{language:'Swedish'}}));
    await checkLanguage(created,'Swedish');
    await checkLanguage(ok(await games('POST','',{scenarioId})),'Svenska');
    await checkLanguage(ok(await games('POST','',{scenarioId,gamePatch:{language:'French'}})),'French');
    assert.equal(created.data.world.characterSystem.date,bundle.data.game.gameDate);
    assert.equal(created.data.world.characterSystem.people.sentinel,undefined);
    assert.equal(created.data.world.simulationHistory,undefined); assert.deepEqual(created.data.events,[]);
    for (const request of [
      {scenarioId,gamePatch:{gameDate:null}},{scenarioId,gamePatch:{startDate:'0000-01-01'}},
      {scenarioId,gamePatch:{gameDate:'1531-01-01'}},{scenarioId,gamePatch:{gameDate:'-3301-01-01'}},
      {scenarioId,gamePatch:{gameDate:'1200-12-31junk'}},{scenarioId,gamePatch:null},
      {scenarioId,seedGameId:'missing'},{scenarioId,historicalStart:null},
      {scenarioId,historicalStart:{mode:'bad'}},{scenarioId,historicalStart:{polityId:'unknown'}},
      {scenarioId,historicalStart:{difficulty:'hard'},gamePatch:{difficulty:'easy'}}
    ]) {
      const before = structuredClone(db);
      const writes = globalThis.__ohWebStoreWrites;
      const result = await games('POST','',request);
      assert.equal(result.status,400);
      assert.deepEqual(db,before);
      assert.equal(globalThis.__ohWebStoreWrites,writes);
    }
  }
  const synthetic=JSON.parse(await readFile(new URL('../../../server/seed/historical/egypt-3000bc/scenario.json',import.meta.url),'utf8'));
  synthetic.scenario.id='synthetic-boundary'; synthetic.scenario.name='TEST ONLY: synthetic lower boundary';
  synthetic.data.game.startDate=synthetic.data.game.gameDate='-3300-01-01';
  synthetic.data.world.historicalScenario.bookmarkDate='-3300-01-01';
  for (const court of Object.values(synthetic.data.world.historicalScenario.courtSeeds)) for (const person of court.people) if (person.bornAt) person.bornAt=person.bornAt.replace(/^-([0-9]{4})/,(_,year)=>'-'+String(Number(year)+300).padStart(4,'0'));
  const id=ok(await scenarios('POST','import',synthetic)).scenario.id;
  assert.equal(ok(await games('POST','',{scenarioId:id})).data.world.characterSystem.date,'-3300-01-01');
});

test('game-bound restore preserves legacy state, isolates colliding maps and refuses wrong companions', async () => {
  await reset();
  const legacy = { schema:'open-historia-game-bundle/1', game:{name:'Legacy'},
    scenarioRef:{scenarioId:'default'}, data:{game:{country:'Testland',gameDate:'2032-11-15',language:'French'},world:{language:'German',characterSystem:{people:{a:{name:'A'}}}},events:[{patch:{value:7}}]} };
  const companion = scenarioBundle('Old map'); companion.scenario.id='default';
  const before=structuredClone(db);
  const wrong=structuredClone(companion); wrong.scenario.id='other';
  assert.equal((await games('POST','restore',{bundle:legacy,scenarioBundle:wrong})).status,400);
  assert.deepEqual(db,before);
  const restored=ok(await games('POST','restore',{bundle:legacy,scenarioBundle:companion}));
  assert.notEqual(restored.game.scenarioId,'default');
  assert.deepEqual(restored.data.world,legacy.data.world);
  assert.deepEqual(restored.data.events,legacy.data.events);
  const scenario=ok(await scenarios('GET',restored.game.scenarioId));
  assert.equal(scenario.scenario.restoreOnly,true);
  const snapshot=structuredClone(db);
  assert.equal((await games('POST','',{scenarioId:restored.game.scenarioId})).status,400);
  assert.deepEqual(db,snapshot);
});

test('old default game-only import remains unresolved through copy and accepts its original companion', async () => {
  await reset();
  const bundle={schema:'open-historia-game-bundle/1',game:{name:'Old default'},scenarioRef:{scenarioId:'default'},data:{game:{gameDate:'2032-11-15'},world:{characterSystem:{people:{a:{name:'A'}}}},events:[{patch:{n:1}}]}};
  const companion=scenarioBundle('Old map'); companion.scenario.id='default';
  const imported=ok(await games('POST','import',bundle));
  assert.equal(imported.game.scenarioMissing,true);
  const stamped=structuredClone(bundle); stamped.data.world.builtInMap='test-map'; stamped.data.world.assetProvenance={regionsGeojson:{currentAssetStatus:'modified'}};
  assert.equal(ok(await games('POST','import',stamped)).game.scenarioMissing,true);
  const copy=ok(await games('POST','',{seedGameId:imported.game.id}));
  assert.equal(copy.game.scenarioMissing,true);
  assert.equal(ok(await games('GET',`${copy.game.id}/export`)).scenarioRef.scenarioId,'default');
  const restored=ok(await games('POST',`${copy.game.id}/scenario/restore`,companion));
  assert.notEqual(restored.game.scenarioId,'default');
  assert.deepEqual(restored.data.world,bundle.data.world); assert.deepEqual(restored.data.events,bundle.data.events);
});

test('an unresolved imported map keeps its recorded hub origin on re-export', async () => {
  await reset();
  const origin={postId:42,bundleUrl:HUB_FILE(1)};
  const game=ok(await games('POST','import',{schema:'open-historia-game-bundle/1',scenarioRef:{scenarioId:'absent',hubOrigin:origin},data:{game:{gameDate:'2032-11-15'}}}));
  const exported=ok(await games('GET',`${game.game.id}/export`));
  assert.equal(exported.scenarioRef.hubOrigin.bundleUrl,origin.bundleUrl);
});

test('a decoded missing-map file restores its game without switching the active campaign', async () => {
  await reset();
  const active=ok(await games('POST','import',{schema:'open-historia-game-bundle/1',game:{name:'Active'},data:{game:{gameDate:'2032-11-15'}}}));
  ok(await games('PUT','active',{gameId:active.game.id}));
  const bundle={schema:'open-historia-game-bundle/1',game:{name:'Waiting'},scenarioRef:{scenarioId:'old-map'},data:{game:{gameDate:'2032-11-15'},world:{characterSystem:{people:{a:{name:'A'}}}},events:[{patch:{n:1}}]}};
  const waiting=ok(await games('POST','import',bundle));
  const companion=scenarioBundle('Old map'); companion.scenario.id='old-map';
  const file=await zipBundle({'scenario.json':JSON.stringify(companion)});
  const restored=await restoreScenarioFileForGame({file,gameId:waiting.game.id,restore:async(id,scenario)=>ok(await games('POST',`${id}/scenario/restore`,scenario))});
  assert.equal(ok(await games('GET','')).activeGameId,active.game.id);
  assert.deepEqual(restored.data.world,bundle.data.world); assert.deepEqual(restored.data.events,bundle.data.events);
  assert.equal(restored.game.scenarioMissing,false);
});

test('hollow and malformed game imports are refused by both import and companion restore', async () => {
  await reset();
  db.set('games',new Map([['hollow',{id:'hollow',meta:{id:'hollow',scenarioId:'default'},json:{game:{},world:{}}}]]));
  const companion=structuredClone(HISTORICAL); companion.scenario.id='default';
  { const before=structuredClone(db), writes=globalThis.__ohWebStoreWrites;
    assert.equal((await games('POST','hollow/scenario/restore',companion)).status,400);
    assert.deepEqual(db,before); assert.equal(globalThis.__ohWebStoreWrites,writes); }
  for (const data of [{},{game:{}},{game:{country:'Testland'}},{game:{gameDate:null,startDate:'2032-11-15'}}]) {
    const bundle={schema:'open-historia-game-bundle/1',data};
    const before=structuredClone(db), writes=globalThis.__ohWebStoreWrites;
    assert.equal((await games('POST','import',bundle)).status,400);
    assert.equal((await games('POST','restore',{bundle,scenarioBundle:HISTORICAL})).status,400);
    assert.deepEqual(db,before); assert.equal(globalThis.__ohWebStoreWrites,writes);
  }
  const game=ok(await games('POST','import',{schema:'open-historia-game-bundle/1',data:{game:{gameDate:'2032-11-15'}}}));
  assert.deepEqual(game.data.world,{});
  assert.deepEqual(ok(await games('GET',game.game.id)).data.world,{});
  assert.deepEqual(ok(await games('GET',`${game.game.id}/export`)).data.world,{});
});

test('runtime map edits validate before writes and retain a valid historical city asset', async () => {
  await reset();
  const scenarioId=ok(await scenarios('POST','import',HISTORICAL)).scenario.id;
  ok(await games('POST','',{scenarioId,setActive:true}));
  const put=async body=>store.handleRuntimeJson({method:'PUT',segments:['json','citiesGeojson'],body});
  const before=structuredClone(db), writes=globalThis.__ohWebStoreWrites;
  assert.equal((await put({type:'FeatureCollection',features:[]})).status,400);
  assert.deepEqual(db,before); assert.equal(globalThis.__ohWebStoreWrites,writes);
  const result=await put(CITIES); assert.equal(result.status,200);
  assert.deepEqual(await result.json(),CITIES);
});

test('non-default map collisions remain unresolved and empty companions cannot restore', async () => {
  await reset();
  const futureBundle={schema:'open-historia-game-bundle/1',scenarioRef:{scenarioId:'future-map'},data:{game:{gameDate:'2032-11-15'}}};
  const futureGame=ok(await games('POST','import',futureBundle));
  const arriving=structuredClone(HISTORICAL); arriving.scenario.id='future-map'; ok(await scenarios('POST','import',arriving));
  assert.equal(ok(await games('GET',futureGame.game.id)).game.scenarioMissing,true,'later original-ID installation must not bind the old game');
  const installed=ok(await scenarios('POST','import',HISTORICAL)).scenario.id;
  const bundle={schema:'open-historia-game-bundle/1',game:{name:'Collision'},scenarioRef:{scenarioId:installed},data:{game:{gameDate:'2032-11-15'},world:{characterSystem:{people:{a:{name:'A'}}}},events:[{patch:{n:1}}]}};
  const existingMap=await scenarioAsset(installed,'regionsGeojson');
  const imported=ok(await games('POST','import',bundle));
  assert.equal(imported.game.scenarioMissing,true);
  assert.equal(ok(await games('GET',`${imported.game.id}/export`)).scenarioRef.scenarioId,installed);
  const placeholder=structuredClone(HISTORICAL); placeholder.scenario.id=imported.game.scenarioId;
  ok(await scenarios('POST','import',placeholder));
  assert.equal(ok(await games('GET',imported.game.id)).game.scenarioMissing,true);
  assert.equal(ok(await games('GET',`${imported.game.id}/export`)).scenarioRef.scenarioId,installed);
  const previous=ok(await games('GET','')).activeGameId;
  ok(await games('PUT','active',{gameId:imported.game.id}));
  const worldBefore=structuredClone(db.get('games').get(imported.game.id).json.world);
  const emptyRegions=await store.handleRuntimeJson({method:'GET',segments:['json','regionsGeojson']});
  assert.deepEqual(await emptyRegions.json(),{type:'FeatureCollection',features:[]});
  await assert.rejects(store.getScenarioPmtilesOverride('regions'));
  assert.deepEqual(db.get('games').get(imported.game.id).json.world,worldBefore);
  ok(await games('PUT','active',{gameId:previous}));
  const companion=structuredClone(HISTORICAL); companion.scenario.id=installed; delete companion.assets.regionsGeojson;
  const hashCompanion=structuredClone(HISTORICAL); hashCompanion.scenario.id=installed;
  const hashSave=structuredClone(bundle); hashSave.data.world.assetProvenance={regionsGeojson:{hashScope:'authored-release',sha256:'f'.repeat(64)}};
  const hashWaiting=ok(await games('POST','import',hashSave));
  { const before=structuredClone(db),writes=globalThis.__ohWebStoreWrites;
    assert.equal((await games('POST','restore',{bundle:hashSave,scenarioBundle:hashCompanion})).status,400);
    assert.equal((await games('POST',`${hashWaiting.game.id}/scenario/restore`,hashCompanion)).status,400);
    assert.deepEqual(db,before); assert.equal(globalThis.__ohWebStoreWrites,writes); }
  const empty=structuredClone(companion); empty.assets.regionsGeojson={mode:'embedded',data:{type:'FeatureCollection',features:[]}};
  const invalidEncoded=structuredClone(companion); invalidEncoded.assets.regionsGeojson={mode:'embedded',encoding:'base64',data:'@@@'};
  const invalidCover=structuredClone(HISTORICAL); invalidCover.scenario.id=installed; invalidCover.assets.cover={mode:'embedded',data:'@@@',encoding:'base64',contentType:'application/octet-stream'};
  const mixedNull=structuredClone(HISTORICAL); mixedNull.scenario.id=installed; mixedNull.assets.regionsGeojson.data.features.push(null);
  const mixedBroken=structuredClone(HISTORICAL); mixedBroken.scenario.id=installed; mixedBroken.assets.regionsGeojson.data.features.push({type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:'broken'}});
  for (const map of [companion,empty,invalidEncoded,invalidCover,mixedNull,mixedBroken]) {
    const before=structuredClone(db), writes=globalThis.__ohWebStoreWrites;
    const combined=await games('POST','restore',{bundle,scenarioBundle:map});
    const existing=await games('POST',`${imported.game.id}/scenario/restore`,map);
    assert.deepEqual([combined.status,existing.status],[400,400]);
    assert.deepEqual(db,before); assert.equal(globalThis.__ohWebStoreWrites,writes);
  }
  assert.deepEqual(await scenarioAsset(installed,'regionsGeojson'),existingMap);
});

test('identified bundled maps and base64 geometry restore actual map assets', async () => {
  await reset();
  const active=ok(await games('POST','import',{schema:'open-historia-game-bundle/1',data:{game:{gameDate:'2032-11-15'}}}));
  ok(await games('PUT','active',{gameId:active.game.id}));
  const saved={schema:'open-historia-game-bundle/1',game:{name:'Bundled'},scenarioRef:{scenarioId:'legacy-known-map'},data:{game:{gameDate:'2032-11-15'},world:{builtInMap:'test-map'},events:[{patch:{n:1}}]}};
  const companion={schema:'open-historia-scenario-bundle/2',scenario:{id:'legacy-known-map'},data:{game:{},world:{builtInMap:'test-map'}},assets:{}};
  const first=ok(await games('POST','restore',{bundle:saved,scenarioBundle:companion}));
  assert.deepEqual(await scenarioAsset(first.game.scenarioId,'regionsGeojson'),BUNDLED_TEST_REGIONS);
  const waiting=ok(await games('POST','import',saved));
  const linked=ok(await games('POST',`${waiting.game.id}/scenario/restore`,companion));
  assert.deepEqual(await scenarioAsset(linked.game.scenarioId,'regionsGeojson'),BUNDLED_TEST_REGIONS);
  const conflict=structuredClone(companion); conflict.assets.regionsGeojson={mode:'embedded',data:{type:'FeatureCollection',features:[]}};
  const conflictWaiting=ok(await games('POST','import',saved));
  {const before=structuredClone(db), writes=globalThis.__ohWebStoreWrites;
    assert.equal((await games('POST','restore',{bundle:saved,scenarioBundle:conflict})).status,400);
    assert.equal((await games('POST',`${conflictWaiting.game.id}/scenario/restore`,conflict)).status,400);
    assert.deepEqual(db,before); assert.equal(globalThis.__ohWebStoreWrites,writes);}
  const missingEdited=structuredClone(companion); missingEdited.data.world.assetProvenance={regionsGeojson:{currentAssetStatus:'modified'}};
  {const before=structuredClone(db), writes=globalThis.__ohWebStoreWrites;
    assert.equal((await games('POST','restore',{bundle:saved,scenarioBundle:missingEdited})).status,400);
    assert.equal((await games('POST',`${conflictWaiting.game.id}/scenario/restore`,missingEdited)).status,400);
    assert.deepEqual(db,before); assert.equal(globalThis.__ohWebStoreWrites,writes);}
  const unknown=structuredClone(companion); unknown.data.world.builtInMap='unknown-map';
  const unknownSave=structuredClone(saved); unknownSave.data.world.builtInMap='unknown-map';
  const unknownWaiting=ok(await games('POST','import',unknownSave));
  {const before=structuredClone(db), writes=globalThis.__ohWebStoreWrites;
    assert.equal((await games('POST','restore',{bundle:unknownSave,scenarioBundle:unknown})).status,400);
    assert.equal((await games('POST',`${unknownWaiting.game.id}/scenario/restore`,unknown)).status,400);
    assert.deepEqual(db,before); assert.equal(globalThis.__ohWebStoreWrites,writes);}
  const encoded=structuredClone(HISTORICAL); encoded.scenario.id='legacy-known-map';
  encoded.assets.regionsGeojson.data=Buffer.from(JSON.stringify(encoded.assets.regionsGeojson.data)).toString('base64');
  encoded.assets.regionsGeojson.encoding='base64';
  const plain=structuredClone(saved); plain.data.world={};
  assert.ok(ok(await games('POST','restore',{bundle:plain,scenarioBundle:encoded})).game.id);
  assert.equal(ok(await games('GET','')).activeGameId,active.game.id);
});

test('scenario export size includes embedded tile archives before ZIP download', async () => {
  await reset();
  const id=ok(await scenarios('POST','import',HISTORICAL)).scenario.id;
  const record=db.get('scenarios').get(id);
  record.pmtiles={regions:new Uint8Array(26*1024*1024)};
  const game=ok(await games('POST','',{scenarioId:id}));
  const ref=ok(await games('GET',`${game.game.id}/export`)).scenarioRef;
  assert.ok(ref.scenarioBytes > 32*1024*1024,'the ZIP ceiling must see the embedded archive');
});
/*! Runtime snapshots travel through the UI ZIP and remain opaque. */
test('runtime snapshots survive UI ZIP export, import and active runtime reads', async () => {
  await reset();
  const scenarioId=ok(await scenarios('POST','import',structuredClone(HISTORICAL))).scenario.id;
  const created=ok(await games('POST','',{scenarioId,setActive:true}));
  const original=[{id:'snap-1',state:{world:{characterSystem:{rngState:123,opaque:{unknown:['x',9]}}}},turn:{events:[{id:'event-1',date:'1200-12-31',impacts:{opaque:'unchanged'}}]}}];
  const putRuntime = async (key,body) => {
    const reply=await store.handleRuntimeJson({method:'PUT',segments:['json',key],body});
    assert.equal(reply.status,200);
  };
  const getRuntime = async key => (await (await store.handleRuntimeJson({method:'GET',segments:['json',key]})).json());
  await putRuntime('snapshots',original);
  assert.deepEqual(await getRuntime('snapshots'),original);
  const previousFetch=globalThis.fetch;
  globalThis.fetch=async (input,options={}) => {
    const url=new URL(String(input),'http://localhost');
    const segments=url.pathname.split('/').filter(Boolean);
    const handler=segments[1] === 'games' ? store.handleGames : segments[1] === 'scenarios' ? store.handleScenarios : null;
    if (!handler) return previousFetch(input,options);
    return handler({method:options.method ?? 'GET',segments:segments.slice(2),body:options.body ? JSON.parse(options.body) : undefined,query:url.searchParams});
  };
  try {
    const { buildGameZipBlob, readGameZip }=await import('../gameZip.js');
    const { writeGameSnapshotsText }=await import('../library.js');
    const zip=await buildGameZipBlob(created.game.id);
    const decoded=await readGameZip(await zip.blob.arrayBuffer());
    assert.ok(decoded.snapshotsText,'UI ZIP contains snapshots.json');
    assert.deepEqual(JSON.parse(decoded.snapshotsText),original);
    const restored=ok(await games('POST','restore',{bundle:decoded.bundle,scenarioBundle:decoded.scenarioBundle}));
    await writeGameSnapshotsText(restored.game.id,decoded.snapshotsText);
    ok(await games('PUT','active',{gameId:restored.game.id}));
    assert.deepEqual(await getRuntime('snapshots'),original);
    const copied=ok(await games('POST','',{seedGameId:restored.game.id,setActive:true}));
    assert.deepEqual(await getRuntime('snapshots'),original);
    const newGame={...copied.data.game,language:'French'};
    await Promise.all([writeGameSnapshotsText(copied.game.id,JSON.stringify(original)),putRuntime('game',newGame)]);
    assert.deepEqual(await getRuntime('snapshots'),original);
    assert.equal((await getRuntime('game')).language,'French');
    const stored=db.get('games').get(copied.game.id);
    stored.json.snapshots=structuredClone(original); delete stored.snapshots;
    assert.deepEqual(await getRuntime('snapshots'),original,'old nested snapshots remain readable');
    assert.deepEqual(ok(await games('GET',`${copied.game.id}/snapshots`)),original);
    await writeGameSnapshotsText(copied.game.id,'[]');
    assert.deepEqual(await getRuntime('snapshots'),[],'an explicit empty top-level list wins over stale nested data');
  } finally { globalThis.fetch=previousFetch; }
});

test('game-only UI ZIP restores unresolved without changing the active game', async () => {
  await reset();
  const scenarioId=ok(await scenarios('POST','import',structuredClone(HISTORICAL))).scenario.id;
  const active=ok(await games('POST','',{scenarioId,setActive:true}));
  const legacy={schema:'open-historia-game-bundle/1',game:{name:'Legacy'},scenarioRef:{scenarioId},data:{game:{gameDate:'2032-11-15',language:'French'},world:{language:'German'},events:[]}};
  const {readGameZip}=await import('../gameZip.js');
  const decoded=await readGameZip(await (await zipBundle({'game.json':JSON.stringify(legacy)})).arrayBuffer());
  const request=JSON.parse(JSON.stringify({bundle:decoded.bundle,scenarioBundle:decoded.scenarioBundle}));
  const restored=ok(await games('POST','restore',request));
  assert.equal(restored.game.scenarioMissing,true); assert.equal(ok(await games('GET','')).activeGameId,active.game.id);
  assert.equal(restored.data.world.language,'German'); assert.equal(restored.data.game.language,'French');
  assert.equal((await games('POST','restore',{bundle:legacy,scenarioBundle:null})).status,400);
  const bad=await readGameZip(await (await zipBundle({'game.json':JSON.stringify(legacy),'scenario.json':'null'})).arrayBuffer());
  assert.equal((await games('POST','restore',{bundle:bad.bundle,scenarioBundle:bad.scenarioBundle})).status,400);
  await assert.rejects(readGameZip(await (await zipBundle({'game.json':JSON.stringify(legacy),'scenario.json':''})).arrayBuffer()));
});

test('owner migration discards nested and top-level stale snapshots, while canonical empty wins normally', async () => {
  await reset();
  const scenarioId=ok(await scenarios('POST','import',structuredClone(HISTORICAL))).scenario.id;
  for (const [id,top] of [['migration-nested',undefined],['migration-both',[{id:'top-old'}]],['migration-empty',[]]]) {
    const created=ok(await games('POST','',{id,scenarioId,setActive:true}));
    const record=db.get('games').get(created.game.id);
    record.json.world={ownerSchema:1,polityOverrides:{USA:{name:'United States'}}};
    record.json.game={...record.json.game,country:'USA'};
    record.json.snapshots=[{id:'nested-old'}];
    if(top === undefined) delete record.snapshots; else record.snapshots=top;
    assert.deepEqual(ok(await games('GET',`${created.game.id}/snapshots`)),[],`${id} export endpoint`);
    const response=await store.handleRuntimeJson({method:'GET',segments:['json','snapshots']});
    assert.deepEqual(await response.json(),[],id);
    const saved=db.get('games').get(created.game.id);
    assert.equal(saved.json.world.ownerSchema,4);
    assert.equal(Object.hasOwn(saved.json,'snapshots'),false);
    assert.equal(Object.hasOwn(saved,'snapshots'),false);
  }
  const current=ok(await games('POST','',{id:'migration-current',scenarioId,setActive:true}));
  const record=db.get('games').get(current.game.id);
  record.snapshots=[]; record.json.snapshots=[{id:'stale-nested'}];
  const response=await store.handleRuntimeJson({method:'GET',segments:['json','snapshots']});
  assert.deepEqual(await response.json(),[]);
});

test('snapshot export does not migrate an unresolved game before its map is bound', async () => {
  await reset();
  const scenarioId=ok(await scenarios('POST','import',structuredClone(HISTORICAL))).scenario.id;
  const legacy={schema:'open-historia-game-bundle/1',game:{name:'Legacy pending map'},scenarioRef:{scenarioId},
    data:{game:{gameDate:'2032-11-15',country:'USA'},world:{ownerSchema:1,polityOverrides:{USA:{name:'United States'}}},events:[]}};
  const game=ok(await games('POST','import',legacy));
  assert.equal(game.game.scenarioMissing,true);
  const points=[{id:'opaque-before-map',state:{world:{country:'USA'}}}];
  ok(await games('PUT',`${game.game.id}/snapshots`,points));
  assert.deepEqual(ok(await games('GET',`${game.game.id}/snapshots`)),points);
  assert.equal(db.get('games').get(game.game.id).json.world.ownerSchema,1);
});

test('unresolved web game cannot write a colliding scenario or read its stats', async () => {
  for (const [hasOriginal,savedStats] of [[true,{savedDefinition:'original'}],[true,undefined],[false,{savedDefinition:'original'}],[false,undefined]]) {
    await reset();
    const legacy={schema:'open-historia-game-bundle/1',game:{name:'Legacy'},...(hasOriginal ? {scenarioRef:{scenarioId:'old-map'}} : {}),
      data:{game:{gameDate:'2016-01-01'},world:{ownerSchema:4},events:[],...(savedStats ? {stats:savedStats} : {})}};
    const imported=ok(await games('POST','import',legacy));
    assert.equal(imported.game.scenarioMissing,true);
    const reserved=imported.game.scenarioId;
    const unrelated=structuredClone(HISTORICAL); unrelated.scenario.id=reserved;
    unrelated.assets.stats={mode:'embedded',data:{foreignDefinition:'unrelated'}};
    assert.equal(ok(await scenarios('POST','import',unrelated)).scenario.id,reserved);
    ok(await games('PUT','active',{gameId:imported.game.id}));
    const before=structuredClone(db), writes=globalThis.__ohWebStoreWrites;
    for(const [key,body] of [
      ['regionsGeojson',REGIONS],['citiesGeojson',CITIES],['backgroundData',{kind:'image',opacity:0.123}],
    ]) {
      const response=await store.handleRuntimeJson({method:'PUT',segments:['json',key],body});
      assert.equal(response.status,400,key);
      assert.deepEqual(db,before,key); assert.equal(globalThis.__ohWebStoreWrites,writes,key);
    }
    const response=await store.handleRuntimeJson({method:'GET',segments:['json','stats']});
    assert.equal(response.status,200); assert.deepEqual(await response.json(),savedStats ?? {});
    assert.deepEqual(db,before); assert.equal(globalThis.__ohWebStoreWrites,writes);
  }
});

test('bound game and no-active-game editor retain runtime map writes and scenario stats', async () => {
  await reset();
  const runtime=(method,key,body) => store.handleRuntimeJson({method,segments:['json',key],body});
  const authored=structuredClone(HISTORICAL); authored.assets.stats={mode:'embedded',data:{scenarioDefinition:'bound'}};
  const scenarioId=ok(await scenarios('POST','import',authored)).scenario.id;
  // The generic test seed is intentionally legacy-only; install a valid default
  // scenario so this positive control tests the editor rather than start policy.
  const valid=structuredClone(db.get('scenarios').get(scenarioId)); valid.id='default'; valid.meta.id='default';
  db.get('scenarios').set('default',valid);
  const editor=await runtime('PUT','backgroundData',{kind:'image',opacity:0.25});
  assert.equal(editor.status,200,'scenario editor works without an active game');
  ok(await games('POST','',{scenarioId,setActive:true}));
  const stats=await runtime('GET','stats'); assert.deepEqual(await stats.json(),{scenarioDefinition:'bound'});
  for(const [key,body] of [['regionsGeojson',REGIONS],['citiesGeojson',CITIES],['backgroundData',{kind:'image',opacity:0.5}]]) {
    const response=await runtime('PUT',key,body); assert.equal(response.status,200,key);
    assert.deepEqual(await response.json(),body,key);
  }
});


test('unresolved saved stats never come from a colliding scenario', async () => {
  for (const savedStats of [{savedDefinition:'original'},undefined]) {
    await reset();
    const legacy={schema:'open-historia-game-bundle/1',game:{name:'Stats legacy'},scenarioRef:{scenarioId:'old-map'},
      data:{game:{gameDate:'2016-01-01'},world:{ownerSchema:4},events:[],...(savedStats ? {stats:savedStats} : {})}};
    const game=ok(await games('POST','import',legacy));
    const other=structuredClone(HISTORICAL); other.scenario.id=game.game.scenarioId;
    other.assets.stats={mode:'embedded',data:{foreignDefinition:'unrelated'}};
    assert.equal(ok(await scenarios('POST','import',other)).scenario.id,game.game.scenarioId);
    ok(await games('PUT','active',{gameId:game.game.id}));
    const before=structuredClone(db),writes=globalThis.__ohWebStoreWrites;
    const result=await store.handleRuntimeJson({method:'GET',segments:['json','stats']});
    assert.equal(result.status,200); assert.deepEqual(await result.json(),savedStats ?? {});
    assert.deepEqual(db,before); assert.equal(globalThis.__ohWebStoreWrites,writes);
  }
});

test('a web library read replaces an older shipped start in place and leaves deleted starts, player copies and campaigns alone', async t => {
  await reset();
  // The upgrade reports itself on console.info; the test keeps the lines instead of printing them.
  const info = console.info, logged = [];
  console.info = (...args) => { logged.push(args.join(' ')); };
  t.after(() => { console.info = info; });
  const id = 'charlemagne-800';
  const record = () => db.get('scenarios').get(id), manifest = () => db.get('kv').get('scenario-manifest').value;
  // The stored city file is an object, or its JSON text when the asset arrived encoded.
  const rome = () => { const stored = record().geojson.citiesGeojson, cities = typeof stored === 'string' ? JSON.parse(stored) : stored;
    return { cities, feature: cities.features.find(f => f.id === 'rome') }; };
  const shipped = structuredClone(record());
  ok(await scenarios('PUT','selected',{scenarioId:'egypt-3000bc'}));
  // An earlier release installed Charlemagne. The player chose Egypt and started a campaign at AD 800.
  const gameId = ok(await games('POST','',{name:'Karl',scenarioId:id,setActive:false,
    historicalStart:{date:'0800-12-25',polityId:'carolingian-realm',mode:'realm',seed:7,difficulty:'normal'},
    gamePatch:{country:'carolingian-realm',difficulty:'standard',language:'Swedish'}})).game.id;
  // That release shipped 1.0.0, so the installed start and the campaign both carry it.
  record().json.world.historicalScenario.contentVersion = '1.0.0';
  { const { cities, feature } = rome(); feature.properties.seat = false;
    if (typeof record().geojson.citiesGeojson === 'string') record().geojson.citiesGeojson = JSON.stringify(cities); }
  db.get('games').get(gameId).json.world.historicalScenario.contentVersion = '1.0.0';
  // The player has started this start five times and renamed a country on it.
  Object.assign(record().meta,{ playCount: 5, countryNameOverrides: { 'papal-states': 'Påvens land' } });
  const before = { manifest: structuredClone(manifest()), campaign: JSON.stringify(db.get('games').get(gameId)),
    campaignMeta: structuredClone(db.get('gameMeta').get(gameId)), egypt: structuredClone(db.get('scenarios').get('egypt-3000bc')) };
  assert.equal(before.manifest.selectedScenarioId,'egypt-3000bc');
  // (a) The next read replaces the old copy where it stands, map files included.
  await store.ensureSeeded();
  assert.equal(record().json.world.historicalScenario.contentVersion,'1.2.0');
  assert.ok(JSON.stringify(record().json) === JSON.stringify(shipped.json),'the installed copy is the shipped 1.2.0');
  assert.equal(rome().feature.properties.seat,true,'the shipped city file makes Rome a seat');
  assert.deepEqual(logged,['[historical start] charlemagne-800 updated to 1.2.0']);
  assert.equal(record().meta.createdAt,shipped.meta.createdAt);
  assert.equal(record().meta.playCount,5,'the play count stays');
  assert.deepEqual(record().meta.countryNameOverrides,{ 'papal-states': 'Påvens land' },'the renamed country stays');
  assert.equal(record().meta.name,shipped.meta.name,'the name comes from the package');
  assert.deepEqual(manifest(),before.manifest,'order and selection stand');
  // (d) The campaign started from 1.0.0 keeps its own data, and Egypt, already current, is not written.
  assert.ok(JSON.stringify(db.get('games').get(gameId)) === before.campaign,'the campaign keeps its own scenario data');
  assert.deepEqual(db.get('gameMeta').get(gameId),before.campaignMeta);
  assert.ok(JSON.stringify(db.get('scenarios').get('egypt-3000bc')) === JSON.stringify(before.egypt),'Egypt is not written');
  // (c) A current copy is not written at all.
  { const snapshot = JSON.stringify([...db.get('scenarios')]), writes = globalThis.__ohWebStoreWrites;
    await store.ensureSeeded();
    assert.ok(JSON.stringify([...db.get('scenarios')]) === snapshot); assert.equal(globalThis.__ohWebStoreWrites,writes); }
  // (e) A scenario under the id that is not this start, and the copy a restored campaign uses, stay as they are.
  for (const [label,change] of [
    ['a player import that reuses the id',stored => { Object.assign(stored.json.world.historicalScenario,{ contentId: 'player-start',contentVersion: '1.0.0' }); }],
    ['a scenario without historical content',stored => { delete stored.json.world.historicalScenario; }],
    ['the copy a restored campaign uses',stored => { stored.json.world.historicalScenario = { ...shipped.json.world.historicalScenario,contentVersion: '1.0.0' }; stored.meta.restoreOnly = true; }],
  ]) {
    change(record());
    const snapshot = JSON.stringify(record()), writes = globalThis.__ohWebStoreWrites;
    await store.ensureSeeded();
    assert.ok(JSON.stringify(record()) === snapshot,label); assert.equal(globalThis.__ohWebStoreWrites,writes,label);
  }
  // (b) A start the player deleted stays deleted.
  ok(await games('DELETE',gameId)); ok(await scenarios('DELETE',id));
  await store.ensureSeeded();
  assert.equal(record(),undefined); assert.equal(manifest().order.includes(id),false);
  assert.equal(db.get('kv').get('historical-bookmarks-charlemagne-800').value,true);
});

const library = async () => ok(await call(store.handleLibrary,'GET',''));
const catalogEntry = (catalog, id) => catalog.scenarios.find(s => s.id === id);

test('the web catalog carries each historical start summary and derives historicalStart from it', async () => {
  await reset();
  const entry = catalogEntry(await library(),'charlemagne-800');
  assert.deepEqual(entry.historicalSummary.polities.map(p => p.id),['carolingian-realm','papal-states','tang-empire','abbasid-caliphate','byzantine-empire','silla','emirate-of-cordoba','aghlabid-emirate','kingdom-of-asturias','duchy-of-benevento']);
  assert.equal(entry.historicalSummary.schema,3);
  assert.equal(entry.historicalSummary.sourceStamp,null);
  assert.equal(entry.historicalSummary.name,entry.name);
  assert.deepEqual(entry.historicalStart,{ date: '0800-12-25', contentId: entry.historicalSummary.contentId });
  assert.equal(db.get('scenarioMeta').get('charlemagne-800').historicalStart,undefined,'the meta row keeps the summary only');
  const modern = catalogEntry(await library(),'default');
  assert.equal(modern.historicalSummary,null); assert.equal(modern.historicalStart,null);
});

test('a scenario meta stored without a summary gains one on the next catalog read, from one record read', async () => {
  await reset();
  const id = 'charlemagne-800', metas = db.get('scenarioMeta');
  // The row an earlier release wrote: historicalStart, no historicalSummary.
  const { historicalSummary, ...old } = metas.get(id);
  metas.set(id,{ ...old, historicalStart: { date: '0800-12-25', contentId: historicalSummary.contentId } });
  globalThis.__ohWebStoreReads = [];
  const entry = catalogEntry(await library(),id);
  assert.deepEqual(metas.get(id).historicalSummary,historicalSummary);
  assert.deepEqual(entry.historicalSummary,historicalSummary);
  assert.deepEqual(globalThis.__ohWebStoreReads.filter(read => read.startsWith('scenarios:')),[`scenarios:${id}`]);
  // A summary stored under schema 1, without per-polity start text, is projected again; a current one is not.
  metas.get(id).historicalSummary = { ...historicalSummary, schema: 1, polities: historicalSummary.polities.map(polity => { const old = { ...polity }; delete old.contextSv; return old; }) };
  globalThis.__ohWebStoreReads = [];
  await library();
  assert.equal(metas.get(id).historicalSummary.schema,3);
  // Every AD 800 court ships its own start text, and the projection carries each one.
  const { courtSeeds,playablePolityIds } = db.get('scenarios').get(id).json.world.historicalScenario;
  assert.deepEqual(metas.get(id).historicalSummary.polities.map(p => p.contextSv),playablePolityIds.map(polityId => courtSeeds[polityId].contextSv));
  assert.ok(metas.get(id).historicalSummary.polities.every(p => typeof p.contextSv === 'string' && p.contextSv.length > 50));
  assert.deepEqual(globalThis.__ohWebStoreReads.filter(read => read.startsWith('scenarios:')),[`scenarios:${id}`]);
  globalThis.__ohWebStoreReads = [];
  await library();
  assert.deepEqual(globalThis.__ohWebStoreReads.filter(read => read.startsWith('scenarios:')),[]);
  // A summary stored under schema 2, without polity kinds, is projected again with each kind.
  metas.get(id).historicalSummary = { ...historicalSummary, schema: 2, polities: historicalSummary.polities.map(polity => { const old = { ...polity }; delete old.kind; return old; }) };
  globalThis.__ohWebStoreReads = [];
  await library();
  assert.equal(metas.get(id).historicalSummary.schema,3);
  assert.ok(metas.get(id).historicalSummary.polities.every(p => p.kind === 'state'));
  assert.deepEqual(globalThis.__ohWebStoreReads.filter(read => read.startsWith('scenarios:')),[`scenarios:${id}`]);
});

test('a stored start whose papal ruler is gone stays in the catalog as invalid and in the library bar', async () => {
  await reset();
  const id = 'charlemagne-800', court = db.get('scenarios').get(id).json.world.historicalScenario.courtSeeds['papal-states'];
  court.people = court.people.filter(person => person.id !== court.rulerId);
  // A record written past putScenario has no meta row until the next catalog read projects one.
  db.get('scenarioMeta').delete(id);
  const catalog = await library();
  const entry = catalogEntry(catalog,id);
  assert.equal(entry.historicalSummary.invalid,true);
  assert.deepEqual(entry.historicalStart,{date:'0800-12-25',contentId:'charlemagne-800'});
  for (const other of ['egypt-3000bc','world-1500']) {
    assert.equal(catalogEntry(catalog,other).historicalSummary.invalid,undefined,other);
    assert.ok(catalogEntry(catalog,other).historicalStart,other);
  }
});

// A default record written before both stamps shared one clock read, on the first content revision,
// with one campaign on it, stored as the old code left it. gapMs is how far its updatedAt sits past its createdAt.
const legacyDefaultOnRevisionOne = async (gapMs) => {
  await reset();
  const record = db.get("scenarios").get("default"), createdAt = "2026-09-07T12:00:00.000Z", gameId = "legacy-campaign";
  if (!db.has("games")) db.set("games", new Map());
  db.get("games").set(gameId, { id: gameId, meta: { id: gameId, name: "Campaign", scenarioId: "default", createdAt, updatedAt: createdAt },
    json: { game: { country: "Testland", gameDate: "2016-05-01" }, world: { builtInMap: "test-map" } } });
  record.meta = { ...record.meta, createdAt, updatedAt: new Date(Date.parse(createdAt) + gapMs).toISOString() };
  record.json.world = { ...record.json.world, builtInRevision: 1, polityOverrides: { Oldland: { name: "Oldland" } } };
  await store.ensureSeeded();
  const scenarioIds = [...db.get("scenarios").keys()];
  const bound = db.get("games").get(gameId).meta.scenarioId;
  return { scenarioIds, bound, world: db.get("scenarios").get("default").json.world };
};

test("a web default whose stamps sit 1 ms apart is refreshed in place and keeps its campaign", async () => {
  const { scenarioIds, bound, world } = await legacyDefaultOnRevisionOne(1);
  assert.deepEqual(scenarioIds.filter((id) => id.startsWith("modern-day-")), [], "an untouched default is not forked");
  assert.equal(bound, "default", "its campaign stays on the built-in");
  assert.equal(world.builtInRevision, 2);
  assert.equal(world.polityOverrides.Oldland, undefined, "the built-in has the seed's content");
});

test("a web default whose stamps sit 5 s apart is kept as the player's edited copy", async () => {
  const { scenarioIds, bound, world } = await legacyDefaultOnRevisionOne(5000);
  assert.deepEqual(scenarioIds.filter((id) => id.startsWith("modern-day-")), ["modern-day-edited"]);
  assert.equal(bound, "modern-day-edited", "its campaign goes with the edited copy");
  assert.equal(world.builtInRevision, 2);
  assert.equal(db.get("scenarios").get("modern-day-edited").json.world.polityOverrides.Oldland.name, "Oldland");
});
