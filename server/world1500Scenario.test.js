import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateHistoricalCourt } from './historicalScenarios.js';
import { authoredScenario, namePlayables, sources as sharedSources } from './seed/historical/authored-scenarios.mjs';

// World 1500 before the builder: Aztekriket is the dossier primary and Inkariket a dossier extra.
const DATE = '1500-12-31', ID = 'world-1500';
const dossier = JSON.parse(readFileSync(new URL('./seed/historical/courts/ad1500-courts.json', import.meta.url), 'utf8'));
const authored = () => authoredScenario(ID, { dossier });
// The builder adds the extra's polity record and the names; this mirrors that step for the court validator.
const named = () => {
  const h = authored();
  h.polities.push({ id: 'inca-empire', nameSv: 'Inkariket', sourceIds: ['hbm'], boundary: 'approximate', noteSv: 'Testpost.' });
  namePlayables(h);
  return h;
};
const COURTIERS = {
  'aztec-empire': [['Itztli', 1458], ['Cuetzpalin', 1462], ['Mazatl', 1467]],
  'inca-empire': [['Kuntur Rimaq', 1456], ['Qori Puma', 1461], ['Rumi Sunqu', 1466]],
};
const AD800_BASE_NOTE_SV = 'Världens land visas med en generaliserad nutida kustlinje. Granskade historiska områden har ungefärliga gränser. Okänd kontroll betyder att underlag saknas och säger inget om marken var bebodd eller ledig.';

test('World 1500 lists Aztekriket first and Inkariket second, with the ruled laws', () => {
  const h = authored();
  assert.deepEqual(h.playablePolityIds, ['aztec-empire', 'inca-empire']);
  assert.equal(h.courtSeeds['aztec-empire'].successionLaw, 'merit');
  assert.equal(h.courtSeeds['inca-empire'].successionLaw, 'primogeniture');
  assert.deepEqual(h.settlements.map(s => [s.id, s.polityId, s.regionId]), [['tenochtitlan', 'aztec-empire', 'hbm-ad1500-80'], ['cuzco', 'inca-empire', 'hbm-ad1500-83']]);
  assert.equal(h.polities[0].id, 'aztec-empire');
  assert.equal(h.polities[0].nameSv, 'Aztekriket');
  assert.equal(h.polities.length, 1);
});

test('the package carries the AD 1500 bookmark, era label and first content version', () => {
  const h = authored();
  assert.equal(h.contentId, ID);
  assert.equal(h.bookmarkDate, DATE);
  assert.equal(h.eraLabelSv, '1500 e.Kr.');
  assert.equal(h.contentVersion, '1.0.0');
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

test('both court seeds pass the court validator once the builder names the playables', () => {
  const h = named();
  for (const polityId of h.playablePolityIds) {
    const checked = validateHistoricalCourt(h, { date: DATE, polityId });
    assert.equal(checked.ok, true, `${polityId}: ${checked.code}`);
  }
});

test('the package texts name both realms and state the review counts', () => {
  const h = named();
  assert.equal(h.contextSv, 'Nyårsafton 1500. Spelbara riken: Aztekriket och Inkariket. Du möter dokumenterade personer med genererade spelvärden och genererade hovmän.');
  assert.equal(h.coverageNoteSv, 'Av 291 former i källkartan har 2 godkänts som ungefärliga områden. Mingriket och Osmanska riket saknar godkänd form och är inte spelbara. 2 riken är spelbara. ' + AD800_BASE_NOTE_SV);
});

test('the package has its own Historical Basemaps and Natural Earth records for AD 1500; the shared records stay as they were', () => {
  const h = authored();
  assert.match(h.sources.hbm.locator, /^geojson\/world_1500\.geojson; /);
  assert.equal(h.sources.hbm.chronology, 'Snapshot label AD 1500');
  assert.notDeepEqual(h.sources.naturalEarth, sharedSources.naturalEarth);
  assert.match(h.sources.naturalEarth.uncertainty, /1500/);
  assert.equal(sharedSources.hbm.chronology, 'Snapshot labels 3000 BC and AD 1200');
  assert.match(sharedSources.naturalEarth.uncertainty, /ancient delta/);
  for (const seatSource of ['b2-aztec-getty-tenochtitlan', 'b2-inca-getty-cuzco']) assert.match(h.sources[seatSource].license, /^ODC-By-1\.0/, seatSource);
});
