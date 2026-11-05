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

const db = new Map();
globalThis.__ohWebStoreTestDb = db;
globalThis.__ohWebStoreWrites = 0;

const IDB_STUB = `
export const STORES = {
  scenarios: "scenarios", games: "games", mapeditorDocs: "mapeditorDocs", basemapMeta: "basemapMeta",
  basemapPayload: "basemapPayload", flags: "flags", kv: "kv", scenarioMeta: "scenarioMeta", gameMeta: "gameMeta",
};
const db = globalThis.__ohWebStoreTestDb;
const table = (name) => { if (!db.has(name)) db.set(name, new Map()); return db.get(name); };
const copy = (value) => (value === undefined ? undefined : structuredClone(value));
export const idbGet = async (store, key) => copy(table(store).get(key));
export const idbGetAll = async (store) => [...table(store).values()].map(copy);
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
  for (const bookmark of ['egypt-3000bc','john-1200']) {
    const bundle = JSON.parse(await readFile(new URL(`../../../server/seed/historical/${bookmark}/scenario.json`,import.meta.url),'utf8'));
    const invalid=structuredClone(bundle); invalid.data.world.polityOverrides.modern={name:'Modern'};
    { const before=structuredClone(db), writes=globalThis.__ohWebStoreWrites;
      assert.equal((await scenarios('POST','import',invalid)).status,400); assert.deepEqual(db,before); assert.equal(globalThis.__ohWebStoreWrites,writes); }
    const scenarioId = ok(await scenarios('POST','import',bundle)).scenario.id;
    ok(await scenarios('PUT',scenarioId,{worldPatch:{characterSystem:{people:{sentinel:{id:'sentinel'}}},simulationHistory:[{id:'old'}]},storage:{events:[{id:'old'}]}}));
    const malformed=structuredClone(bundle); malformed.data.game.gameDate=null;
    const badCover=structuredClone(bundle); badCover.assets.cover={mode:'embedded',encoding:'base64',data:'@@@'};
    const forged=structuredClone(bundle); forged.data.game.startDate=forged.data.game.gameDate='2016-01-01'; forged.restoreOnly=true; forged.skipValidation=true;
    for (const run of [()=>scenarios('POST','',{gamePatch:{gameDate:null}}),()=>scenarios('PUT',scenarioId,{gamePatch:{startDate:'1201-01-01'}}),
      ()=>scenarios('POST','import',malformed),()=>scenarios('POST','import',badCover),()=>scenarios('POST','import',forged),()=>scenarios('PUT',`${scenarioId}/import`,malformed),
      ()=>store.handleScenarios({method:'DELETE',segments:[scenarioId,'assets','citiesGeojson'],query:new URLSearchParams()})]) {
      const before=structuredClone(db), writes=globalThis.__ohWebStoreWrites;
      assert.equal((await run()).status,400); assert.deepEqual(db,before); assert.equal(globalThis.__ohWebStoreWrites,writes);
    }
    const created = ok(await games('POST','',{scenarioId}));
    assert.equal(created.data.world.characterSystem.date,bundle.data.game.gameDate);
    assert.equal(created.data.world.characterSystem.people.sentinel,undefined);
    assert.equal(created.data.world.simulationHistory,undefined); assert.deepEqual(created.data.events,[]);
    for (const request of [
      {scenarioId,gamePatch:{gameDate:null}},{scenarioId,gamePatch:{startDate:'0000-01-01'}},
      {scenarioId,gamePatch:{gameDate:'1201-01-01'}},{scenarioId,gamePatch:{gameDate:'-3301-01-01'}},
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
    scenarioRef:{scenarioId:'default'}, data:{game:{country:'Testland',gameDate:'2032-11-15'},world:{characterSystem:{people:{a:{name:'A'}}}},events:[{patch:{value:7}}]} };
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
  for (const map of [companion,empty,invalidEncoded,invalidCover]) {
    const before=structuredClone(db), writes=globalThis.__ohWebStoreWrites;
    assert.equal((await games('POST','restore',{bundle,scenarioBundle:map})).status,400);
    assert.equal((await games('POST',`${imported.game.id}/scenario/restore`,map)).status,400);
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
