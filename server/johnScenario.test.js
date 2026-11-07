import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateHistoricalCourt, validateHistoricalScenario } from './historicalScenarios.js';
import { prepareHistoricalCampaignStart } from './historicalPreparation.js';
import { createHistoricalCharacterSystem } from './characters/scenarioSeed.js';
import { historicalStartOption } from '../src/runtime/historicalStartOptions.js';
import { ENGINE_LIMIT_TEXT_SV } from './seed/historical/dossier-courts.mjs';

// John 1.1.0: Johns riken and the three reviewed AD 1200 dossier courts. The package is also the built-in scenario `default`.
const DATE = '1200-12-31', POLITY = 'johns-realms', ID = 'john-1200';
const readJson = name => JSON.parse(readFileSync(new URL(`./seed/historical/${name}`, import.meta.url), 'utf8'));
const loadPackage = () => {
  const bundle = readJson(`${ID}/scenario.json`);
  const regions = readJson(`${ID}/regions.geojson`), cities = readJson(`${ID}/cities.geojson`), assetManifest = readJson(`${ID}/manifest.json`);
  const { game, world } = bundle.data;
  return { bundle, regions, cities, assetManifest, game, world, h: world.historicalScenario };
};
const dossier = readJson('courts/ad1200-courts.json');
const dossierPolity = id => dossier.polities.find(p => p.polityId === id);
// [id, name, ruler, law, seat, Getty record] in the ruled order after Johns riken.
const DOSSIER_POLITIES = [
  ['khmer-angkor', 'Khmerriket', 'jayavarman-vii', 'merit', 'angkor-thom', 'a2-getty-angkor-thom'],
  ['almohad', 'Almohaderna', 'muhammad-al-nasir', 'merit', 'marrakech', 'a2-west-getty-marrakech'],
  ['france-capetian', 'Frankrike', 'philip-ii', 'primogeniture', 'paris', 'a2-west-getty-paris'],
];
const PLAYABLE_IDS = [POLITY, ...DOSSIER_POLITIES.map(([id]) => id)];
const JOHN_CONTEXT_SV = 'Johan av England efter äktenskapet med Isabella. Dokumenterade identiteter, ungefärliga födelsedatum och genererade hovmän.';

test('John 1.1.0 lists four playable polities in the ruled order, and each passes both validators', () => {
  const input = loadPackage(), { h, game, bundle } = input;
  assert.equal(h.contentVersion, '1.1.0');
  assert.equal(input.assetManifest.contentVersion, '1.1.0');
  assert.deepEqual(h.playablePolityIds, PLAYABLE_IDS);
  assert.equal(game.country, POLITY);
  assert.equal(bundle.scenario.name, 'Johns riken (angevinskt välde), 1200 e.Kr.');
  for (const polityId of PLAYABLE_IDS) {
    assert.deepEqual(validateHistoricalScenario(input, { date: DATE, polityId }), { ok: true, contentId: ID, contentVersion: '1.1.0', date: DATE, polityId });
    assert.equal(validateHistoricalCourt(h, { date: DATE, polityId }).ok, true, polityId);
  }
  // Polity colours follow list position, so the new playables keep the reviewed order of the map.
  assert.deepEqual(h.polities.map(p => p.id), [POLITY, 'western-xia', 'khmer-angkor', 'almohad', 'france-capetian', 'chimu']);
});

test('the dossier courts carry the ruled laws, rulers, titles, seats and start texts', () => {
  const { h } = loadPackage();
  assert.deepEqual(DOSSIER_POLITIES.map(([id]) => id), dossier.polities.filter(p => p.status === 'ready').map(p => p.polityId));
  assert.deepEqual(h.playablePolityIds.map(id => [id, h.courtSeeds[id].successionLaw ?? 'primogeniture']),
    [[POLITY, 'primogeniture'], ...DOSSIER_POLITIES.map(([id, , , law]) => [id, law])]);
  for (const [id, name, ruler, , seat] of DOSSIER_POLITIES) {
    const court = h.courtSeeds[id], polity = dossierPolity(id);
    assert.equal(h.polities.find(p => p.id === id).nameSv, name, id);
    assert.equal(court.rulerId, ruler, id);
    assert.equal(court.seatId, seat, id);
    assert.equal(court.offices.find(o => o.id === 'ruler').name, polity.rulerTitleSv, id);
    assert.equal(court.contextSv, polity.contextSv, id);
    assert.deepEqual(court.contextSourceIds, polity.contextSourceIds, id);
    assert.equal(h.settlements.find(s => s.id === seat).regionId, `hbm-ad1200-${polity.sourceFeatureIndexes[0]}`, id);
  }
  assert.deepEqual(h.settlements.map(s => s.id), ['windsor', ...DOSSIER_POLITIES.map(([, , , , seat]) => seat)]);
});

test('Johns riken keeps John\'s start text as its court text, and the package text names the four realms', () => {
  const { h, bundle, world } = loadPackage();
  assert.equal(h.courtSeeds[POLITY].contextSv, JOHN_CONTEXT_SV);
  assert.deepEqual(h.courtSeeds[POLITY].contextSourceIds, ['john', 'isabella']);
  assert.equal(h.contextSv, 'Nyårsafton 1200. Spelbara riken: Johns riken (angevinskt välde), Khmerriket, Almohaderna och Frankrike. Du möter dokumenterade personer med genererade spelvärden och genererade hovmän.');
  assert.equal(bundle.scenario.description, h.contextSv);
  assert.equal(world.startingTimelineText.split('\n')[0], h.contextSv);
  assert.match(h.coverageNoteSv, /^4 riken är spelbara\. /);
});

test('the French court holds Philip II, Ingeborg, Louis VIII and Blanche in one family, and a start keeps both marriages', () => {
  const { h } = loadPackage(), court = h.courtSeeds['france-capetian'];
  const person = id => court.people.find(p => p.id === id);
  assert.deepEqual(person('philip-ii').spouseIds, ['ingeborg-denmark']);
  assert.deepEqual(person('louis-viii').legalParentIds, ['philip-ii']);
  assert.deepEqual(person('louis-viii').spouseIds, ['blanche-castile']);
  const rulingFamily = person('philip-ii').familyId;
  for (const id of ['ingeborg-denmark', 'louis-viii', 'blanche-castile']) assert.equal(person(id).familyId, rulingFamily, id);
  for (const mode of ['realm', 'family']) {
    const state = createHistoricalCharacterSystem({ historicalScenario: h, date: DATE, polityId: 'france-capetian', mode, seed: 9 });
    assert.equal(state.offices.ruler.holderId, 'philip-ii', mode);
    assert.equal(state.realm.successionLaw, 'primogeniture', mode);
    assert.equal(state.people['philip-ii'].spouseId, 'ingeborg-denmark', mode);
    assert.equal(state.people['louis-viii'].spouseId, 'blanche-castile', mode);
  }
});

test('each dossier court states what the game simplifies, in the dossier words, in its mechanics note', () => {
  const { h } = loadPackage();
  for (const [id] of DOSSIER_POLITIES) {
    const polity = dossierPolity(id), note = h.courtSeeds[id].mechanics.noteSv;
    const lines = [polity.successionNoteSv, polity.engineLimitNoteSv, polity.engineRepresentationNoteSv, ...polity.engineLimits.map(limit => ENGINE_LIMIT_TEXT_SV[limit])].filter(Boolean);
    assert.ok(lines.length > 0, id);
    assert.ok(note.startsWith(h.courtSeeds[POLITY].mechanics.noteSv), id);
    for (const line of lines) assert.ok(note.includes(line), `${id}: ${line}`);
  }
});

test('the generated courtiers carry the ruled names and game birth years 20 to 45 years before 1200; family starts follow them', () => {
  const { h } = loadPackage();
  const names = {
    'khmer-angkor': [['Mratan Shivadasa', '1160'], ['Mratan Rudrapala', '1165'], ['Vap Kirtindra', '1170']],
    almohad: [['Ali ibn Yintan', '1158'], ['Umar ibn Wakkak', '1163'], ['Abd al-Haqq ibn Ziyad', '1168']],
    'france-capetian': [['Hugues de Montfort', '1157'], ['Raoul de Beaumont', '1162'], ['Pierre de Chaumont', '1166']],
  };
  for (const [id] of DOSSIER_POLITIES) {
    const court = h.courtSeeds[id], generated = court.people.filter(p => p.identityOrigin === 'generated');
    assert.deepEqual(generated.map(p => [p.name, p.bornAt]), names[id].map(([name, year]) => [`${name} (genererad)`, `${year}-01-01`]), id);
    assert.match(court.families[0].id, /^generated-house-/, id);
    const family = createHistoricalCharacterSystem({ historicalScenario: h, date: DATE, polityId: id, mode: 'family', seed: 9 });
    assert.equal(family.identity.familyId, court.families[0].id, id);
    assert.equal(family.offices.ruler.holderId, court.rulerId, id);
  }
});

test('every new seat cites its Getty record in the city asset and in the ODC-By notice', () => {
  const { h, assetManifest, world } = loadPackage();
  const cityAsset = assetManifest.assets.find(a => a.id === 'citiesGeojson'), getty = world.componentLicenses.find(c => c.id === 'getty-tgn');
  assert.deepEqual(cityAsset.sourceIds, ['windsor', ...DOSSIER_POLITIES.map(([, , , , , record]) => record)]);
  for (const id of cityAsset.sourceIds) {
    assert.match(h.sources[id].license, /^ODC-By-1\.0/, id);
    assert.ok(getty.modifications.some(line => line.includes(h.sources[id].url)), id);
  }
  const hbm = world.componentLicenses.find(c => c.id === 'historical-basemaps');
  for (const line of hbm.modifications) assert.doesNotMatch(line, /seat markers/);
});

test('the dossier sources enter the package with a review line from the dossier review, and only cited ones', () => {
  const { h } = loadPackage();
  const cited = new Set();
  for (const [id] of DOSSIER_POLITIES) {
    const { review: checked } = dossierPolity(id), court = h.courtSeeds[id];
    const own = new Set([...court.contextSourceIds, ...h.settlements.find(s => s.id === court.seatId).sourceIds]);
    for (const row of [...court.people, ...court.families, ...court.offices, ...court.religions]) for (const claim of Object.values(row.claims)) claim.sourceIds.forEach(sourceId => own.add(sourceId));
    for (const sourceId of own) {
      assert.ok(Object.hasOwn(h.sources, sourceId), `${id}: ${sourceId}`);
      if (Object.hasOwn(dossier.sources, sourceId)) assert.equal(h.sources[sourceId].review, `Dossier review: checked by ${checked.checkedBy} on ${checked.checkedOn}.`);
      cited.add(sourceId);
    }
  }
  const imported = Object.keys(h.sources).filter(id => Object.hasOwn(dossier.sources, id));
  assert.deepEqual(imported.filter(id => !cited.has(id)), []);
});

test('the Khmer and Chimú review sources keep the Met wording, add Getty\'s competing reign end and narrow the Chimú claim', () => {
  const review = readJson('ad1200-review.json'), { h } = loadPackage();
  assert.match(review.sources.khmer.scopedClaim, /1181–ca\. 1243/);
  assert.match(review.sources.khmer.scopedClaim, /Getty/);
  assert.match(review.sources.khmer.scopedClaim, /1181–about 1218/);
  assert.equal(review.sources.khmer.url, 'https://www.metmuseum.org/fr/toah/ht/07/sse.html');
  assert.match(review.sources.chimu.scopedClaim, /D'Altroy/);
  assert.match(review.sources.chimu.scopedClaim, /unresolved/);
  assert.equal(h.sources['regional-khmer'].title, review.sources.khmer.scopedClaim);
  assert.equal(h.sources['regional-chimu'].title, review.sources.chimu.scopedClaim);
});

test('the start card offers the four AD 1200 realms and a prepared start reaches France', () => {
  const { bundle, regions, cities } = loadPackage();
  const option = historicalStartOption(bundle, regions, cities);
  assert.deepEqual(option.polities.map(p => [p.id, p.name, p.ruler.id]), [[POLITY, 'Johns riken (angevinskt välde)', 'john'],
    ...DOSSIER_POLITIES.map(([id, name, ruler]) => [id, name, ruler])]);
  const scenario = { data: bundle.data, meta: { ...bundle.scenario, id: 'default' }, regions, cities };
  const result = prepareHistoricalCampaignStart({ request: { historicalStart: { date: DATE, polityId: 'france-capetian', mode: 'realm' }, gamePatch: { country: 'france-capetian' } }, scenario });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.data.world.characterSystem.offices.ruler.holderId, 'philip-ii');
  assert.equal(result.data.world.historicalScenario.contextSv, dossierPolity('france-capetian').contextSv);
  assert.deepEqual(result.data.world.historicalScenario.playablePolityIds, ['france-capetian']);
});

test('the new John texts keep Swedish letters and the house style', () => {
  const { h } = loadPackage();
  const claims = rows => rows.flatMap(r => Object.values(r.claims).map(c => c.noteSv));
  const courts = PLAYABLE_IDS.map(id => h.courtSeeds[id]);
  const texts = [h.contextSv, ...h.settlements.map(s => s.noteSv), ...courts.flatMap(court => [court.contextSv, court.mechanics.noteSv,
    ...claims(court.people), ...claims(court.offices), ...claims(court.religions), ...claims(court.families),
    ...court.people.map(p => p.name), ...court.families.map(f => f.name), ...court.offices.map(o => o.name)])].filter(Boolean);
  for (const text of texts) {
    // House style allows a dash only inside a year interval, as the Almohad seat note writes 1147–1269.
    assert.ok(!/[–—]/.test(text.replace(/\b\d{3,4}–\d{3,4}\b/g, '')), text);
    assert.ok(!/inte [^.]{1,60}, utan /i.test(text), text);
    assert.ok(!/\b(manader|riksniva|fodelse|fodelsedatum|spelvarde|okand)\b/i.test(text), text);
  }
  assert.match(texts.join(' '), /[åäö]/);
});
