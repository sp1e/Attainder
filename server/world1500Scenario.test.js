import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { validateHistoricalCourt, validateHistoricalScenario } from './historicalScenarios.js';
import { prepareHistoricalCampaignStart } from './historicalPreparation.js';
import { historicalStartSummary } from './historicalStartSummary.js';
import { advanceCharacters, getCharacterPresentation } from './characters/index.js';
import { addGameMonths } from './gameDates.js';
import { authoredScenario, sources as sharedSources } from './seed/historical/authored-scenarios.mjs';
import { ENGINE_LIMIT_TEXT_SV } from './seed/historical/dossier-courts.mjs';

// World 1500: Aztekriket is the dossier primary and Inkariket a dossier extra.
const DATE = '1500-12-31', ID = 'world-1500';
const readJson = name => JSON.parse(readFileSync(new URL(`./seed/historical/${name}`, import.meta.url), 'utf8'));
const dossier = readJson('courts/ad1500-courts.json');
const review = readJson('ad1500-review.json');
const authored = () => authoredScenario(ID, { dossier });
const loadPackage = () => {
  const bundle = readJson(`${ID}/scenario.json`);
  const regions = readJson(`${ID}/regions.geojson`), cities = readJson(`${ID}/cities.geojson`), assetManifest = readJson(`${ID}/manifest.json`);
  const { game, world } = bundle.data;
  return { bundle, regions, cities, assetManifest, game, world, h: world.historicalScenario };
};
const COURTIERS = {
  'aztec-empire': [['Itztli', 1458], ['Cuetzpalin', 1462], ['Mazatl', 1467]],
  'inca-empire': [['Kuntur Rimaq', 1456], ['Qori Puma', 1461], ['Rumi Sunqu', 1466]],
};
const AD800_BASE_NOTE_SV = 'Världens land visas med en generaliserad nutida kustlinje. Granskade historiska områden har ungefärliga gränser. Okänd kontroll betyder att underlag saknas och säger inget om marken var bebodd eller ledig.';
const SEAT_RECORDS = ['b2-aztec-getty-tenochtitlan', 'b2-inca-getty-cuzco'];
// The spec's coverage table, with the regional- prefix the builder adds to review source ids.
const COVERAGE = [
  { area: 'Africa', status: 'unresolved', sourceIds: ['hbm', 'naturalEarth'], noteSv: 'Granskningen av år 1500 har ingen källa för Afrika. Formerna saknar godkänd ägare och kontrollen är okänd.' },
  { area: 'Asia', status: 'unresolved', sourceIds: ['regional-palace-hongzhi-range', 'regional-ming-empire-diversity', 'regional-ming-korea-border-song'], noteSv: 'Hongzhi regerar i Mingriket år 1500, men Mingrikets form står i karantän: källorna löser inte en överlappande kontroll eller utbredningen i sydväst och nordväst. Övriga former saknar godkänd ägare.' },
  { area: 'Europe', status: 'unresolved', sourceIds: ['regional-ottoman-bayezid', 'regional-ottoman-rhodes', 'regional-ottoman-kos', 'regional-ottoman-santorini', 'regional-ottoman-crimea'], noteSv: 'Osmanska rikets form avvisas för år 1500 eftersom den omfattar öar som källorna ger osmanskt styre först senare, som Rhodos och Kos 1522 och Santorini 1537. Krimkhanatets form är olöst. Övriga former saknar godkänd ägare.' },
  { area: 'Americas', status: 'partial', sourceIds: ['regional-met-aztec-autonomy-west', 'regional-smith-1990-aztec-provinces', 'regional-nmai-inka-expansion-map', 'regional-parssinen-southern-limits-614'], noteSv: 'Aztekriket och Inkariket visas ungefärligt. Tlaxcala låg självständigt inom Aztekrikets form, och Inkarikets östra kant saknar belagd gräns. Övriga samhällens kontroll är okänd.' },
  { area: 'Oceania', status: 'unresolved', sourceIds: ['hbm', 'naturalEarth'], noteSv: 'Granskningen av år 1500 har ingen källa för Oceanien, och kontrollen är okänd.' },
  { area: 'Antarctica', status: 'unresolved', sourceIds: ['naturalEarth'], noteSv: 'Fysisk geografi visas. Inget historiskt ägande eller någon befolkning tillskrivs området.' },
];

test('World 1500 lists Aztekriket first and Inkariket second, both under the elective law', () => {
  const h = authored();
  assert.deepEqual(h.playablePolityIds, ['aztec-empire', 'inca-empire']);
  assert.equal(h.courtSeeds['aztec-empire'].successionLaw, 'elective');
  assert.equal(h.courtSeeds['inca-empire'].successionLaw, 'elective');
  assert.deepEqual(h.settlements.map(s => [s.id, s.polityId, s.regionId]), [['tenochtitlan', 'aztec-empire', 'hbm-ad1500-80'], ['cuzco', 'inca-empire', 'hbm-ad1500-83']]);
  assert.equal(h.polities[0].id, 'aztec-empire');
  assert.equal(h.polities[0].nameSv, 'Aztekriket');
  assert.equal(h.polities.length, 1);
});

test('the dossier primary refuses to build without the dossier', () => {
  assert.throws(() => authoredScenario(ID), /world-1500: the primary aztec-empire comes from a court dossier/);
});

test('the package carries the AD 1500 bookmark, era label and content version 1.1.0', () => {
  const h = authored();
  assert.equal(h.contentId, ID);
  assert.equal(h.bookmarkDate, DATE);
  assert.equal(h.eraLabelSv, '1500 e.Kr.');
  assert.equal(h.contentVersion, '1.1.0');
  assert.equal(loadPackage().assetManifest.contentVersion, '1.1.0');
});

test('the rulers hold their dossier titles, and Huáscar belongs to Huayna Capac\'s family', () => {
  const h = authored(), aztec = h.courtSeeds['aztec-empire'], inca = h.courtSeeds['inca-empire'];
  const ruler = court => court.offices.find(o => o.id === 'ruler');
  assert.equal(aztec.rulerId, 'ahuitzotl');
  assert.deepEqual([ruler(aztec).holderId, ruler(aztec).name], ['ahuitzotl', 'Huey tlatoani']);
  assert.equal(inca.rulerId, 'huayna-capac');
  assert.deepEqual([ruler(inca).holderId, ruler(inca).name], ['huayna-capac', 'Sapa inka']);
  const person = id => inca.people.find(p => p.id === id);
  assert.equal(person('huascar').familyId, person('huayna-capac').familyId);
});

test('the Aztec religion has no leader; the Inca religion keeps the generated priest', () => {
  const h = authored();
  assert.equal(h.courtSeeds['aztec-empire'].religions[0].leaderId, null);
  assert.equal(h.courtSeeds['inca-empire'].religions[0].leaderId, 'generated-courtier-3');
  for (const id of h.playablePolityIds) assert.equal(h.courtSeeds[id].offices.find(o => o.id === 'priest').holderId, 'generated-courtier-3', id);
});

test('no Swedish text in the built AD 1500 courts contains null or undefined', () => {
  const swedish = [];
  const walk = (value, key) => {
    if (typeof value === 'string') { if (/Sv$/.test(key)) swedish.push(value); return; }
    if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) walk(v, Array.isArray(value) ? key : k);
  };
  walk(loadPackage().h.courtSeeds, '');
  assert.ok(swedish.length > 50, `found ${swedish.length} Swedish texts`);
  for (const text of swedish) assert.doesNotMatch(text, /\b(null|undefined)\b/);
  const araua = loadPackage().h.courtSeeds['inca-empire'].people.find(p => p.id === 'araua-ocllo');
  assert.ok(araua.claims.kinship.noteSv.startsWith('Araua Ocllo: hustru till Huayna Capac. '), araua.claims.kinship.noteSv);
});

test('the generated courtiers carry the ruled names and game birth years', () => {
  const h = authored();
  for (const [id, names] of Object.entries(COURTIERS)) {
    const generated = h.courtSeeds[id].people.filter(p => p.identityOrigin === 'generated');
    assert.deepEqual(generated.map(p => [p.name, p.bornAt]), names.map(([name, year]) => [`${name} (genererad)`, `${year}-01-01`]), id);
  }
});

test('no generated name shares a word with a documented or withheld person in the AD 1500 dossier', () => {
  const words = text => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().split(/[^\p{L}]+/u).filter(w => w.length >= 4);
  const documented = new Set(dossier.polities.flatMap(p => [...p.people.map(x => x.nameSv), ...(p.peopleWithheld ?? []).map(x => x.who)]).flatMap(words));
  assert.ok(documented.has('huascar') && documented.has('atahualpa'));
  const h = authored();
  for (const id of h.playablePolityIds) {
    for (const p of h.courtSeeds[id].people.filter(x => x.identityOrigin === 'generated')) {
      for (const word of words(p.name.replace(/ \(genererad\)$/, ''))) assert.ok(!documented.has(word), `${id}: ${p.name}`);
    }
  }
});

test('the package has its own Historical Basemaps and Natural Earth records for AD 1500; the shared records stay as they were', () => {
  const h = authored();
  assert.match(h.sources.hbm.locator, /^geojson\/world_1500\.geojson; /);
  assert.equal(h.sources.hbm.chronology, 'Snapshot label AD 1500');
  assert.notDeepEqual(h.sources.naturalEarth, sharedSources.naturalEarth);
  assert.match(h.sources.naturalEarth.uncertainty, /1500/);
  assert.equal(sharedSources.hbm.chronology, 'Snapshot labels 3000 BC and AD 1200');
  assert.match(sharedSources.naturalEarth.uncertainty, /ancient delta/);
  for (const seatSource of SEAT_RECORDS) assert.match(h.sources[seatSource].license, /^ODC-By-1\.0/, seatSource);
});

// ---- The built package ----

test('both playable polities pass the scenario and court validators in the built package', () => {
  const input = loadPackage(), { h, game, bundle } = input;
  assert.equal(game.country, 'aztec-empire');
  assert.equal(bundle.scenario.name, 'Aztekriket, 1500 e.Kr.');
  for (const polityId of h.playablePolityIds) {
    assert.deepEqual(validateHistoricalScenario(input, { date: DATE, polityId }), { ok: true, contentId: ID, contentVersion: '1.1.0', date: DATE, polityId });
    const checked = validateHistoricalCourt(h, { date: DATE, polityId });
    assert.equal(checked.ok, true, `${polityId}: ${checked.code}`);
  }
});

test('every built polity record is a state, and both courts carry the elective-rule sentence in their mechanics note', () => {
  const { h } = loadPackage();
  assert.deepEqual(h.polities.map(p => [p.id, p.kind]), [['aztec-empire', 'state'], ['inca-empire', 'state']]);
  for (const id of h.playablePolityIds) assert.ok(h.courtSeeds[id].mechanics.noteSv.includes(ENGINE_LIMIT_TEXT_SV['elective-rule']), id);
});

test('the built polity records come from the review mappings, with hbm first and no Getty record', () => {
  const { h } = loadPackage(), aztec = h.polities[0], mapping = review.mapMappings.find(m => m.index === 80);
  assert.deepEqual(h.polities.map(p => p.id), ['aztec-empire', 'inca-empire']);
  assert.equal(aztec.sourceIds[0], 'hbm');
  assert.ok(aztec.sourceIds.includes('regional-met-aztec-reign-1486-1502'));
  assert.ok(!aztec.sourceIds.some(id => /getty/.test(id)), aztec.sourceIds.join());
  assert.equal(aztec.noteSv, mapping.noteSv);
  assert.equal(aztec.nameSv, 'Aztekriket');
  assert.ok(!h.polities[1].sourceIds.some(id => /getty/.test(id)));
});

test('features 80 and 83 belong to the two realms; four features are quarantined with the review statuses', () => {
  const { regions, h } = loadPackage();
  const owner = i => regions.features.find(f => f.properties.id === `hbm-ad1500-${i}`)?.properties.owner;
  assert.equal(owner(80), 'aztec-empire');
  assert.equal(owner(83), 'inca-empire');
  assert.deepEqual(regions.features.filter(f => f.properties.owner).map(f => f.properties.id).sort(), ['hbm-ad1500-80', 'hbm-ad1500-83']);
  const status = i => h.regionReview[i].geometryStatus;
  assert.deepEqual([77, 193, 223, 290].map(status), ['quarantined-unresolved', 'quarantined-invalid-source-geometry', 'quarantined-invalid-source-geometry', 'quarantined-rejected-for-1500']);
  assert.equal(h.regionReview.filter(r => r.geometryStatus).length, 4);
  assert.equal(h.regionReview.length, review.allFeatures.length);
  for (const row of h.regionReview) for (const id of row.sourceIds) assert.ok(Object.hasOwn(h.sources, id), `${row.sourceIndex}: ${id}`);
});

test('the review sources keep their worded chronology, fall back where the review is silent, and only cited ones enter', () => {
  const { h } = loadPackage();
  assert.equal(h.sources['regional-met-aztec-reign-1486-1502'].chronology, 'ca. 1486; r. 1486–1502');
  assert.equal(h.sources['regional-met-aztec-autonomy-west'].chronology, 'Overview period; no exact day');
  assert.equal(h.sources['regional-met-aztec-autonomy-west'].uncertainty, 'The review records no separate uncertainty for this source.');
  assert.equal(h.sources['regional-ottoman-rhodes'].uncertainty, review.sources['ottoman-rhodes'].uncertainty);
  assert.match(h.sources['regional-met-aztec-autonomy-west'].review, /^AD 1500 map review: checked by Codex independent check on 2026-11-07\. Locator read: /);
  for (const id of ['regional-ming-seat-unesco', 'regional-ottoman-modon', 'regional-getty-tenochtitlan-7668941', 'regional-getty-cuzco-7005819']) assert.ok(!Object.hasOwn(h.sources, id), id);
  const cited = new Set([...h.polities.flatMap(p => p.sourceIds), ...h.coverage.flatMap(c => c.sourceIds),
    ...review.geometryQuarantine.flatMap(q => q.sourceIds.map(id => `regional-${id}`))]);
  assert.deepEqual(Object.keys(h.sources).filter(id => id.startsWith('regional-') && !cited.has(id)), []);
});

test('the six coverage rows follow the spec table', () => {
  assert.deepEqual(loadPackage().h.coverage, COVERAGE);
});

test('the package texts name both realms and state the review counts', () => {
  const { h, bundle } = loadPackage();
  assert.equal(h.contextSv, 'Nyårsafton 1500. Spelbara riken: Aztekriket och Inkariket. Du möter dokumenterade personer med genererade spelvärden och genererade hovmän.');
  assert.equal(bundle.scenario.description, h.contextSv);
  assert.equal(h.coverageNoteSv, 'Av 291 former i källkartan har 2 godkänts som ungefärliga områden. Mingriket och Osmanska riket saknar godkänd form och är inte spelbara. 2 riken är spelbara. ' + AD800_BASE_NOTE_SV);
});

test('both Getty seat records are city sources and appear in the ODC-By notice', () => {
  const { h, assetManifest, world } = loadPackage();
  const cityAsset = assetManifest.assets.find(a => a.id === 'citiesGeojson'), getty = world.componentLicenses.find(c => c.id === 'getty-tgn');
  assert.deepEqual(cityAsset.sourceIds, SEAT_RECORDS);
  for (const id of SEAT_RECORDS) {
    assert.match(h.sources[id].license, /^ODC-By-1\.0/, id);
    assert.ok(getty.modifications.some(line => line.includes(h.sources[id].url)), id);
  }
});

// The released rows of Egypt 1.0.0, John 1.2.0, Charlemagne 1.3.0 and world-1500 1.1.0 as [file, bytes, sha256]; a change needs a version bump.
const RELEASED_ROWS = [
  ['egypt-3000bc/regions.geojson', 2033872, '324681692eda15eb8d8927cdec6b3a2f72f279da6ab37ef046927c7e198fcefd'],
  ['egypt-3000bc/cities.geojson', 406, '9640cbde26814a1ca01560d66f9a4b67a87a47c75471513b39dc03acc0fca3a8'],
  ['egypt-3000bc/scenario.json', 3895204, 'f52f7d4cb8a6ba6120b9078b767d6629b0ac4fe7a14474f147a987968afd16ef'],
  ['egypt-3000bc/manifest.json', 2489, '42368ead19cce444dc110ca3d9f7602011da79633f2f051aaa78630b49c7bb13'],
  ['john-1200/regions.geojson', 2077205, '94308b5d9fabf18b87b3742f82dbc35d7286beb03a4d61e65e86f725d4c2d440'],
  ['john-1200/cities.geojson', 1953, 'cefed90d6abde489be1fde2273d97ab54336a2825c24dc928b412c7e0cf0ece5'],
  ['john-1200/scenario.json', 4552922, '5fd663f2d4a9654ef5c93425d1d3ea6254ecfa025189d8fa13dd93d306ce37eb'],
  ['john-1200/manifest.json', 2871, '2cf760fd6db97830033eee971f17ca4f2eb68603cfe017fcc918f7a4fa7d3206'],
  ['charlemagne-800/regions.geojson', 2191514, '83cd982d563954d49d110bd616e71196a4369b0f7f659c209945514514e3217c'],
  ['charlemagne-800/cities.geojson', 4560, 'eef2d09798684f6f5dd83a16d791a206b307ced19a7416468e6fa0f1564d5d7b'],
  ['charlemagne-800/scenario.json', 4644916, '8e6ff6676365b65f4ceb6aef69a151c89138c82306c928d68ccf1c7eea49c6e2'],
  ['charlemagne-800/manifest.json', 2930, 'a1ed836eddca995f39c8e4ff9e9e3f6f3918f3f19c04be635be86a364403f98f'],
  ['world-1500/regions.geojson', 2049578, 'd4e90914ae1fc8e8c37c060115d1dad5fb54506e7cc1b3fce04b68f40bfb99a9'],
  ['world-1500/cities.geojson', 830, '5466fb0f0a5aa4ae067732dc405fa6a4e7c45eb95ea583b942da88507f31f52d'],
  ['world-1500/scenario.json', 4749067, '8fcf577a460b40bb51c63915bb324a4a5578dd0aacd06b4e0d61c63bd4760fe7'],
  ['world-1500/manifest.json', 2854, '602e3d4d8a1137e6f67b41fff3cdf77b72d68c7b78620f4f04beff8c1b3b8f1b'],
];

test('releases.json pins world_1500 and every released row, and each file keeps its bytes', () => {
  const releases = readJson('releases.json');
  const source = releases.sources.find(s => s.file === 'sources/hbm-world_1500.geojson');
  assert.equal(source.sha256, 'd01ffc9b80629787f13d2b1c2f881f005bc0164433548e30f5c058ddee0bfc7b');
  assert.deepEqual(releases.outputs.map(o => [o.file, o.bytes, o.sha256]), RELEASED_ROWS);
  for (const [file, bytes, sha256] of RELEASED_ROWS) {
    const content = readFileSync(new URL(`./seed/historical/${file}`, import.meta.url));
    assert.deepEqual([content.length, createHash('sha256').update(content).digest('hex')], [bytes, sha256], file);
  }
});

// ---- Installed, listed and played ----

const prepared = (polityId, mode) => {
  const { bundle, regions, cities } = loadPackage();
  const scenario = { data: bundle.data, meta: { ...bundle.scenario, id: ID }, regions, cities };
  return prepareHistoricalCampaignStart({ request: { historicalStart: { date: DATE, polityId, mode }, gamePatch: { country: polityId } }, scenario });
};

test('the start summary lists Aztekriket and Inkariket under Amerika in the late Middle Ages', () => {
  const { bundle } = loadPackage();
  const summary = historicalStartSummary({ meta: bundle.scenario, data: bundle.data });
  assert.equal(summary.invalid, undefined);
  assert.deepEqual([summary.contentId, summary.date, summary.eraId, summary.eraLabelSv], [ID, DATE, 'late-middle-ages', '1500 e.Kr.']);
  assert.deepEqual(summary.polities.map(p => [p.id, p.nameSv, p.regionId, p.ruler.name]),
    [['aztec-empire', 'Aztekriket', 'americas', 'Ahuitzotl'], ['inca-empire', 'Inkariket', 'americas', 'Huayna Capac']]);
});

test('a prepared start reaches each AD 1500 realm in realm and family mode', () => {
  const { h } = loadPackage();
  for (const polityId of h.playablePolityIds) for (const mode of ['realm', 'family']) {
    const result = prepared(polityId, mode), label = `${polityId} ${mode}`;
    assert.equal(result.ok, true, `${label}: ${result.error}`);
    const state = result.data.world.characterSystem;
    assert.deepEqual([state.identity.polityId, state.identity.mode, state.date], [polityId, mode, DATE], label);
    assert.equal(state.offices.ruler.holderId, h.courtSeeds[polityId].rulerId, label);
    assert.deepEqual(result.data.world.historicalScenario.playablePolityIds, [polityId], label);
    assert.equal(result.data.game.country, polityId, label);
  }
});

test('the Inca realm start puts Huayna Capac on the throne with Huáscar as heir', () => {
  const state = prepared('inca-empire', 'realm').data.world.characterSystem;
  assert.equal(state.offices.ruler.holderId, 'huayna-capac');
  assert.equal(state.people['huayna-capac'].name, 'Huayna Capac');
  assert.equal(state.realm.legalHeirId, 'huascar');
  assert.equal(state.people.huascar.name, 'Huáscar');
});

test('the Aztec religion is leaderless on the bookmark, and the generated priest leads it after one played year', () => {
  const start = prepared('aztec-empire', 'realm').data.world.characterSystem;
  assert.equal(start.offices.ruler.holderId, 'ahuitzotl');
  const faithId = dossier.polities.find(p => p.polityId === 'aztec-empire').religion.id;
  assert.equal(start.religions[faithId].leaderId, null);
  const year = advanceCharacters(start, addGameMonths(DATE, 12), { id: 'aztec-first-year' });
  assert.equal(year.error, null);
  assert.equal(year.ok, true);
  assert.equal(year.state.date, addGameMonths(DATE, 12));
  assert.ok(year.events.length > 0, 'the year leaves events');
  assert.equal(year.state.religions[faithId].leaderId, 'generated-courtier-3');
  assert.ok(getCharacterPresentation(year.state));
});

// A desktop data folder; each boot is a separate start of the app that runs `body`, then prints the start ids in the catalog.
const bootDesktop = (root, body = '') => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `
  import * as store from ${JSON.stringify(new URL('./libraryStore.js', import.meta.url).href)};
  store.ensureScenarioStore();
  ${body}
  console.log(JSON.stringify(store.getScenarioCatalog().scenarios.filter(s => s.historicalStart).map(s => s.id)));
`], { env: { ...process.env, OH_DATA_DIR: root }, stdio: 'pipe', encoding: 'utf8' }).trim().split('\n').at(-1));

const withDesktopLibrary = run => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'attainder-world-1500-'));
  try { run(root); } finally { rmSync(root, { recursive: true, force: true }); }
};
const INSTALLED = ['default', 'egypt-3000bc', 'charlemagne-800', ID];

test('a desktop library read installs AD 1500 once beside the three starts, and a deleted copy stays deleted', () => withDesktopLibrary(root => {
  assert.deepEqual(bootDesktop(root), INSTALLED);
  assert.deepEqual(bootDesktop(root), INSTALLED, 'a second read adds nothing');
  assert.deepEqual(bootDesktop(root, `store.deleteScenario('${ID}');`), INSTALLED.slice(0, 3));
  assert.deepEqual(bootDesktop(root), INSTALLED.slice(0, 3), 'the marker keeps a deleted start deleted');
}));

test('the installed desktop copy starts both AD 1500 realms in realm and family mode', () => withDesktopLibrary(root => {
  const starts = bootDesktop(root, `for (const polityId of ['aztec-empire', 'inca-empire']) for (const mode of ['realm', 'family']) {
    const made = store.createGame({ scenarioId: '${ID}', setActive: false, historicalStart: { date: '${DATE}', polityId, mode, seed: 7, difficulty: 'normal' },
      gamePatch: { country: polityId, difficulty: 'standard', language: 'Swedish' } });
    const { identity, date } = store.getGameDetails(made.game.id).data.world.characterSystem;
    if (identity.polityId !== polityId || identity.mode !== mode || date !== '${DATE}') throw new Error(polityId + ' ' + mode + ' started as ' + JSON.stringify(identity));
  }`);
  assert.deepEqual(starts, INSTALLED);
}));
