import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { validateHistoricalCourt, validateHistoricalScenario } from './historicalScenarios.js';
import { prepareHistoricalCampaignStart } from './historicalPreparation.js';
import { createHistoricalCharacterSystem } from './characters/scenarioSeed.js';
import { getCharacterPresentation } from './characters/index.js';
import { historicalStartOption } from '../src/runtime/historicalStartOptions.js';

const DATE = '0800-12-25', POLITY = 'carolingian-realm', PAPAL = 'papal-states', ID = 'charlemagne-800';
const seedFile = name => new URL(`./seed/historical/${name}`,import.meta.url);
const readJson = name => JSON.parse(readFileSync(seedFile(name),'utf8'));
const review = readJson('ad800-review.json');
const loadPackage = () => {
  const bundle = readJson(`${ID}/scenario.json`);
  const regions = readJson(`${ID}/regions.geojson`), cities = readJson(`${ID}/cities.geojson`);
  const assetManifest = readJson(`${ID}/manifest.json`);
  const { game,world } = bundle.data, h = world.historicalScenario;
  return { bundle,regions,cities,assetManifest,game,world,h,court: h.courtSeeds[POLITY] };
};
const validate = input => validateHistoricalScenario(input,{ date: DATE,polityId: POLITY });
const regional = ids => ids.map(id => `regional-${id}`);
const ownersAt = (regions,point) => regions.features.filter(f => f.properties.owner && booleanPointInPolygon(point,f)).map(f => f.properties.owner);
const reviewPerson = id => review.people.find(p => p.id === id);
const personIn = (court,id) => court.people.find(p => p.id === id);
const COURT_IDS = ['karl','karl-den-yngre','pippin-av-italien','ludvig-av-akvitanien','rotrud'];
const UNCERTAIN_IDS = ['berta','gisela','teoderada','hiltrud','ruodhaid'];
const DOCUMENTED_IDS = [...COURT_IDS,...UNCERTAIN_IDS];

test('the package validates for its bookmark and carries the reviewed names',() => {
  const input = loadPackage(), { h,game,bundle } = input;
  assert.deepEqual(validate(input),{ ok: true,contentId: ID,contentVersion: '1.1.0',date: DATE,polityId: POLITY });
  assert.equal(h.bookmarkDate,DATE);
  assert.equal(game.country,POLITY);
  assert.deepEqual(h.playablePolityIds,[POLITY,PAPAL]);
  assert.equal(h.polities.find(p => p.id === POLITY).nameSv,'Karls rike (karolingiska riket)');
  assert.equal(bundle.scenario.id,ID);
  assert.equal(bundle.scenario.name,'Karls rike (karolingiska riket), 800 e.Kr.');
});

test('every playable polity passes both validators, and polity order follows the source features',() => {
  const input = loadPackage(), { h } = input;
  for (const polityId of h.playablePolityIds) {
    assert.deepEqual(validateHistoricalScenario(input,{ date: DATE,polityId }),{ ok: true,contentId: ID,contentVersion: '1.1.0',date: DATE,polityId });
    assert.equal(validateHistoricalCourt(h,{ date: DATE,polityId }).ok,true,polityId);
  }
  // Polity colours are assigned by list position, so the Papal States addition must not move any polity.
  assert.deepEqual(h.polities.map(p => p.id),[...new Set([POLITY,...review.mapMappings.map(m => m.polityId)])]);
  const papal = review.mapMappings.find(m => m.polityId === PAPAL);
  assert.deepEqual(h.polities.find(p => p.id === PAPAL),{ id: PAPAL,nameSv: 'Kyrkostaten',sourceIds: ['hbm',...regional(papal.sourceIds)],boundary: 'approximate',noteSv: papal.noteSv });
  assert.equal(h.courtSeeds[POLITY].successionLaw,undefined);
});

test('features 151 and 221 share one owner, one polity record and one seat',() => {
  const { regions,h,world,court } = loadPackage();
  const owner = i => regions.features.find(f => f.properties.id === `hbm-ad800-${i}`)?.properties.owner;
  assert.equal(owner(151),POLITY);
  assert.equal(owner(221),POLITY);
  assert.equal(h.polities.filter(p => p.id === POLITY).length,1);
  assert.equal(new Set(h.polities.map(p => p.id)).size,h.polities.length);
  assert.equal(Object.keys(world.polityOverrides).filter(id => id === POLITY).length,1);
  assert.deepEqual(h.settlements.filter(s => s.polityId === POLITY).map(s => s.id),['aachen']);
  assert.equal(court.seatId,'aachen');
  assert.deepEqual(court.cities.map(c => c.id),['aachen']);
});

test('ownership follows mapMappings and nothing else',() => {
  const { regions,h } = loadPackage();
  const owned = regions.features.filter(f => f.properties.owner);
  assert.deepEqual(owned.map(f => [f.properties.id,f.properties.owner]).sort(),
    review.mapMappings.map(m => [`hbm-ad800-${m.index}`,m.polityId]).sort());
  for (const m of review.mapMappings) {
    const feature = owned.find(f => f.properties.id === `hbm-ad800-${m.index}`);
    assert.equal(feature.properties.historical.noteSv.startsWith(m.noteSv),true,`note of ${m.index}`);
    assert.deepEqual(feature.properties.historical.sourceIds,['hbm',...regional(m.sourceIds)]);
  }
  assert.equal(h.regionReview.length,review.allFeatures.length);
  for (const row of h.regionReview) {
    assert.equal(row.classification,review.allFeatures[row.sourceIndex].status);
    assert.equal(row.ownerPolityId,review.allFeatures[row.sourceIndex].approvedOwnerPolityId);
    for (const id of row.sourceIds) assert.ok(Object.hasOwn(h.sources,id),id);
  }
});

test('regression points fall inside their reviewed owners',() => {
  const { regions } = loadPackage();
  for (const row of review.sourceBasedGeometryRegression) {
    const mapping = review.mapMappings.find(m => m.index === row.expectedSourceFeatureIndex);
    assert.deepEqual(ownersAt(regions,row.longitudeLatitude),[mapping.polityId],row.site);
  }
  assert.deepEqual(ownersAt(regions,review.seat.coordinates),[POLITY]);
  for (const [name,point,owner] of [['Constantinople',[28.95,41.02],'byzantine-empire'],['Córdoba',[-4.78,37.88],'emirate-of-cordoba'],['Baghdad',[44.39,33.31],'abbasid-caliphate']])
    assert.deepEqual(ownersAt(regions,point),[owner],name);
});

test('the seat is Aachen at the Getty coordinate and the note puts Charles in Rome',() => {
  const { h,cities } = loadPackage();
  const seat = h.settlements.find(s => s.id === 'aachen'), rome = h.settlements.find(s => s.id === 'rome');
  assert.deepEqual(seat.coordinates,review.seat.coordinates);
  assert.equal(seat.noteSv,review.seat.noteSv);
  assert.match(seat.noteSv,/på bokmärkets dag var han i Rom/);
  assert.equal(seat.nameSv,'Aachen');
  assert.deepEqual(rome.coordinates,review.settlements[0].coordinates);
  assert.equal(rome.polityId,'papal-states');
  assert.equal(rome.noteSv,review.settlements[0].noteSv);
  // Rome is both a listed settlement and the Papal States seat; it appears once and carries the seat flag.
  assert.deepEqual(h.settlements.map(s => s.id),['aachen','rome']);
  const seats = Object.fromEntries(cities.features.map(f => [f.id,f.properties.seat]));
  assert.deepEqual(seats,{ aachen: true,rome: true });
});

test('the court holds exactly the ruled people',() => {
  const { court } = loadPackage();
  const documented = court.people.filter(p => p.identityOrigin === 'documented').map(p => p.id);
  assert.deepEqual([...documented].sort(),[...DOCUMENTED_IDS].sort());
  assert.deepEqual(court.people.filter(p => p.identityOrigin === 'generated').map(p => p.id),['generated-courtier-1','generated-courtier-2','generated-courtier-3']);
  assert.equal(personIn(court,'pippin-puckelryggen'),undefined);
  assert.equal(court.rulerId,'karl');
  assert.equal(court.offices.find(o => o.id === 'ruler').name,'Kejsare');
  for (const id of ['general','chancellor','priest']) {
    const office = court.offices.find(o => o.id === id);
    assert.equal(office.claims.identity.status,'generated');
    assert.equal(personIn(court,office.holderId).identityOrigin,'generated');
  }
  assert.equal(court.families.length,4);
  for (const family of court.families.filter(f => f.id !== 'royal-house')) {
    assert.match(family.name,/genererat/);
    assert.equal(family.claims.identity.status,'generated');
  }
  for (const person of court.people.filter(p => p.identityOrigin === 'generated')) assert.match(person.name,/\(genererad\)/);
});

test('each documented person has source IDs behind the identity claim',() => {
  const { court,h } = loadPackage();
  for (const id of DOCUMENTED_IDS) {
    const person = personIn(court,id), reviewed = reviewPerson(id);
    assert.equal(person.name,reviewed.nameSv);
    assert.equal(person.originLabelSv,reviewed.originLabelSv);
    assert.equal(person.claims.identity.status,'sourced');
    assert.ok(person.claims.identity.sourceIds.length > 0,id);
    assert.deepEqual([...person.claims.identity.sourceIds].sort(),regional(reviewed.sourceIds).sort(),id);
    for (const claim of Object.values(person.claims)) for (const source of claim.sourceIds) assert.ok(Object.hasOwn(h.sources,source),`${id}: ${source}`);
  }
});

test('survival of the five daughters stays uncertain in the review wording',() => {
  const { court } = loadPackage();
  for (const id of UNCERTAIN_IDS) {
    const person = personIn(court,id), reviewed = reviewPerson(id);
    assert.equal(reviewed.aliveOnBookmark,'uncertain');
    assert.deepEqual(person.claims.survival,{ status: 'uncertain',noteSv: reviewed.uncertaintySv,sourceIds: regional(reviewed.sourceIds) });
  }
  for (const id of COURT_IDS) assert.equal(personIn(court,id).claims.survival,undefined);
});

test('the anointed kings rank ahead of Rotrud in the succession',() => {
  const { h,court } = loadPackage();
  const state = createHistoricalCharacterSystem({ historicalScenario: h,date: DATE,polityId: POLITY,seed: 9 });
  const order = getCharacterPresentation(state).succession.candidates.map(c => c.id);
  assert.deepEqual(order.slice(0,4),['karl-den-yngre','pippin-av-italien','ludvig-av-akvitanien','rotrud']);
  assert.equal(court.people.find(p => p.id === 'rotrud').claims.bornAt.status,'generated');
});

test('the character system keeps the survival claim public',() => {
  const { h } = loadPackage();
  const state = createHistoricalCharacterSystem({ historicalScenario: h,date: DATE,polityId: POLITY,seed: 9 });
  assert.equal(state.people.berta.historicalOrigin.claims.survival.status,'uncertain');
  assert.equal(state.people.berta.historicalOrigin.claims.survival.noteSv,reviewPerson('berta').uncertaintySv);
});

test('kinship uses living parents and states the dead parent in text',() => {
  const { court } = loadPackage();
  for (const id of ['karl-den-yngre','pippin-av-italien','ludvig-av-akvitanien','rotrud','berta','gisela']) {
    const person = personIn(court,id);
    assert.deepEqual(person.legalParentIds,['karl']);
    assert.equal(person.claims.legalParentIds.status,'sourced');
    assert.match(person.claims.kinship.noteSv,/Hildegard/);
  }
  for (const id of ['teoderada','hiltrud']) assert.match(personIn(court,id).claims.kinship.noteSv,/Fastrada/);
  assert.deepEqual(personIn(court,'ruodhaid').legalParentIds,['karl']);
  assert.deepEqual(personIn(court,'karl').legalParentIds,[]);
  assert.match(personIn(court,'karl').claims.kinship.noteSv,/Bertrada/);
  assert.equal(personIn(court,'karl').claims.kinship.status,'sourced');
});

test('the bookmark court contradicts no sourced death',() => {
  const { court,h } = loadPackage();
  const dead = review.people.filter(p => p.aliveOnBookmark === false).map(p => p.id);
  assert.deepEqual(dead,['liutgard','hildegard','fastrada','bertrada']);
  const ids = new Set(court.people.map(p => p.id));
  for (const id of dead) assert.ok(!ids.has(id),`${id} died before the bookmark`);
  for (const name of ['Liutgard','Hildegard','Fastrada','Bertrada']) assert.ok(!court.people.some(p => p.name.includes(name)),name);
  const karl = personIn(court,'karl');
  assert.deepEqual(karl.spouseIds,[]);
  assert.equal(court.people.filter(p => p.spouseIds.length).length,0);
  assert.match(karl.claims.spouseIds.noteSv,/Liutgard/);
  const state = createHistoricalCharacterSystem({ historicalScenario: h,date: DATE,polityId: POLITY,seed: 9 });
  assert.equal(state.people.karl.spouseId,null);
});

test('birth values stay labelled and contradict no sourced fact',() => {
  const { court } = loadPackage();
  const born = id => personIn(court,id).bornAt;
  const year = id => Number(born(id).slice(0,4));
  for (const person of court.people) {
    const reviewed = reviewPerson(person.id), claim = person.claims.bornAt;
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(person.bornAt),person.id);
    assert.notEqual(claim.status,'sourced',person.id);
    assert.match(claim.noteSv,/spelvärde/,person.id);
    if (reviewed && reviewed.birth.asWorded === null) { assert.equal(claim.status,'generated',person.id); assert.deepEqual(claim.sourceIds,[],person.id); }
    if (reviewed?.birth.asWorded?.startsWith('Inget datum')) { assert.equal(claim.status,'generated',person.id); assert.ok(claim.noteSv.includes(reviewed.birth.asWorded),person.id); }
  }
  for (const id of ['karl','ludvig-av-akvitanien']) {
    const claim = personIn(court,id).claims.bornAt, reviewed = reviewPerson(id);
    assert.equal(claim.status,'uncertain',id);
    assert.ok(claim.noteSv.includes(reviewed.birth.asWorded),id);
    assert.deepEqual(claim.sourceIds,regional(reviewed.birth.sourceIds),id);
  }
  // Einhard: seventy-second year of life at death on 28 January 814.
  assert.ok(born('karl') >= '0742-01-28' && born('karl') <= '0743-01-28');
  assert.ok(born('karl-den-yngre') < born('pippin-av-italien') && born('karl-den-yngre') < born('ludvig-av-akvitanien'),'eldest son');
  for (const id of ['pippin-av-italien','ludvig-av-akvitanien']) assert.ok(year(id) <= 781,`${id} was anointed king in 781`);
  for (const id of ['karl-den-yngre','pippin-av-italien','ludvig-av-akvitanien']) assert.ok(800 - year(id) >= 19,`${id} holds an adult role in 800`);
  for (const id of ['berta','gisela']) assert.ok(born('rotrud') < born(id),'elder daughter');
  assert.ok(year('gisela') <= 781,'baptised at Milan in 781');
  for (const id of ['karl-den-yngre','pippin-av-italien','ludvig-av-akvitanien','rotrud','berta','gisela']) assert.ok(born(id) <= '0783-04-30',`${id}: Hildegard died in 783`);
  for (const id of ['teoderada','hiltrud']) assert.ok(born(id) > '0783-07-12' && year(id) <= 794,`${id}: Fastrada married 783, died 794`);
  for (const id of DOCUMENTED_IDS.slice(1)) assert.ok(year(id) - year('karl') >= 18,`${id} is younger than an adult Charles`);
});

test('validateHistoricalScenario refuses a person whose birth date or kinship lacks a claim',() => {
  for (const [name,mutate] of [
    ['documented birth',c => { delete personIn(c,'karl').claims.bornAt; }],
    ['generated birth',c => { delete personIn(c,'rotrud').claims.bornAt; }],
    ['generated courtier birth',c => { delete personIn(c,'generated-courtier-1').claims.bornAt; }],
    ['son kinship',c => { delete personIn(c,'karl-den-yngre').claims.legalParentIds; }],
    ['daughter kinship',c => { delete personIn(c,'berta').claims.legalParentIds; }],
    ['parent outside the court',c => { personIn(c,'karl').legalParentIds = ['hildegard']; personIn(c,'karl').claims.legalParentIds = { status: 'sourced',noteSv: 'Test.',sourceIds: ['hbm'] }; }],
    ['sourced claim without a source',c => { personIn(c,'karl').claims.identity.sourceIds = []; }],
  ]) {
    const input = loadPackage();
    mutate(input.court);
    assert.equal(validate(input).code,'invalidCourt',name);
  }
});

// Both validators must refuse what the engine refuses at start time, so the start card never offers a failing start.
const bothResults = input => [validate(input),validateHistoricalCourt(input.h,{ date: DATE,polityId: POLITY })];
const probe = mutate => { const input = loadPackage(); mutate(input.court); return bothResults(input); };
const generatedClaim = () => ({ status: 'generated',noteSv: 'Prov.',sourceIds: [] });
const relate = (court,id,key,ids) => { const person = personIn(court,id); person[key] = ids; person.claims[key] = generatedClaim(); };
const marry = (court,a,b) => { for (const [x,y] of [[a,b],[b,a]]) relate(court,x,'spouseIds',[...personIn(court,x).spouseIds,y]); };
const mechanicsOf = court => personIn(court,'karl').mechanics;
// Renames one entity and every reference to it, so a probe changes the id and nothing else.
const REFERENCES = {
  people: c => [[c,'rulerId'],...c.offices.map(o => [o,'holderId']),...c.families.map(f => [f,'headId']),...c.religions.map(r => [r,'leaderId'])],
  families: c => [...c.people,...c.cities].map(x => [x,'familyId']),
  religions: c => [...c.people,...c.families].map(x => [x,'religionId']),
  offices: () => [],cities: () => [],
};
const RENAMED = { people: 'generated-courtier-3',families: 'generated-house-3',religions: 'latin-church',offices: 'priest',cities: 'aachen' };
function rename(court,kind,from,to) {
  court[kind].find(e => e.id === from).id = to;
  for (const [row,key] of REFERENCES[kind](court)) if (row[key] === from) row[key] = to;
  for (const p of kind === 'people' ? court.people : []) for (const key of ['legalParentIds','spouseIds']) p[key] = p[key].map(id => id === from ? to : id);
}
const ACCEPTED = [
  ['the bare documented prefix',c => { personIn(c,'rotrud').originLabelSv = 'Dokumenterad person'; }],
  ['a person id that only resembles the runtime sequence',c => rename(c,'people','generated-courtier-3','person-7a')],
  ['one reciprocal spouse',c => marry(c,'generated-courtier-1','generated-courtier-2')],
  ['an absent sex',c => { delete personIn(c,'rotrud').sex; }],
  ['absent mechanics',c => { delete personIn(c,'karl').mechanics; }],
  ['a three-generation parent chain',c => { relate(c,'generated-courtier-2','legalParentIds',['generated-courtier-1']); relate(c,'generated-courtier-3','legalParentIds',['generated-courtier-2']); }],
  ['the office spymaster',c => { c.offices.find(o => o.id === 'priest').id = 'spymaster'; }],
  ...['people','families','religions','cities'].map(kind => [`a renamed ${kind} id with every allowed character`,c => rename(c,kind,RENAMED[kind],'renamed_id:1.x-y')]),
  ['a 151-character city id, whose governor office id fits 160 characters',c => rename(c,'cities','aachen','a'.repeat(151))],
  ['successionLaw merit',c => { c.successionLaw = 'merit'; }],
  ['successionLaw primogeniture',c => { c.successionLaw = 'primogeniture'; }],
  ['an absent successionLaw',c => { delete c.successionLaw; }],
];
for (const [name,mutate] of ACCEPTED) test(`both validators accept ${name}`,() => {
  for (const result of probe(mutate)) assert.equal(result.ok,true,`${name}: ${result.code}`);
});
const REFUSED = [
  ['a generated person labelled Kung',c => { personIn(c,'generated-courtier-1').originLabelSv = 'Kung'; }],
  ['a generated person with an extended label',c => { personIn(c,'generated-courtier-1').originLabelSv = 'Genererad person, kung'; }],
  ['a documented person without the documented prefix',c => { personIn(c,'rotrud').originLabelSv = 'Prinsessa'; }],
  ['a documented person with the generated label',c => { personIn(c,'rotrud').originLabelSv = 'Genererad person'; }],
  ['a generated person named Odo without the generated suffix',c => { personIn(c,'generated-courtier-1').name = 'Odo'; }],
  ['the runtime person id person-7',c => rename(c,'people','generated-courtier-3','person-7')],
  ['a blank name',c => { personIn(c,'rotrud').name = '  '; }],
  ['a second reciprocal spouse',c => { marry(c,'generated-courtier-1','generated-courtier-2'); marry(c,'generated-courtier-1','generated-courtier-3'); }],
  ['sex other',c => { personIn(c,'rotrud').sex = 'other'; }],
  ['an unknown trait',c => { mechanicsOf(c).traits.push('unknown-trait'); }],
  ['an empty trait list',c => { mechanicsOf(c).traits = []; }],
  ['an inherited trait key',c => { mechanicsOf(c).traits = ['toString']; }],
  ['an unknown archetype',c => { mechanicsOf(c).archetype = 'wizard'; }],
  ['an inherited archetype key',c => { mechanicsOf(c).archetype = 'constructor'; }],
  ['a negative skill',c => { mechanicsOf(c).skills.command = -1; }],
  ['a missing skill',c => { delete mechanicsOf(c).skills.prowess; }],
  ['null mechanics',c => { personIn(c,'karl').mechanics = null; }],
  ['a two-person parent cycle',c => { relate(c,'generated-courtier-2','legalParentIds',['generated-courtier-1']); relate(c,'generated-courtier-1','legalParentIds',['generated-courtier-2']); }],
  ['a three-person parent cycle',c => { relate(c,'generated-courtier-2','legalParentIds',['generated-courtier-1']); relate(c,'generated-courtier-3','legalParentIds',['generated-courtier-2']); relate(c,'generated-courtier-1','legalParentIds',['generated-courtier-3']); }],
  ['the office steward',c => { c.offices.find(o => o.id === 'priest').id = 'steward'; }],
  ['a 152-character city id, whose governor office id exceeds 160 characters',c => rename(c,'cities','aachen','a'.repeat(152))],
  // For offices these probes prove only the office whitelist, which refuses any id outside it before its shape matters.
  ...Object.keys(RENAMED).flatMap(kind => ['with space','__proto__','constructor','prototype'].map(id => [`the ${kind} id "${id}"`,c => rename(c,kind,RENAMED[kind],id)])),
  ['successionLaw tanistry',c => { c.successionLaw = 'tanistry'; }],
  ['a null successionLaw',c => { c.successionLaw = null; }],
];
for (const [name,mutate] of REFUSED) test(`both validators refuse ${name}`,() => {
  for (const result of probe(mutate)) assert.equal(result.code,'invalidCourt',name);
});
// Renames the playable polity wherever its id is a whole JSON string, keys and values alike.
const renamedPolity = to => {
  const { game,world,regions,assetManifest } = loadPackage();
  const input = JSON.parse(JSON.stringify({ game,world,regions,assetManifest }).replaceAll(JSON.stringify(POLITY),JSON.stringify(to)));
  const options = { date: DATE,polityId: to };
  return [validateHistoricalScenario(input,options),validateHistoricalCourt(input.world.historicalScenario,options)];
};
test('both validators accept a renamed playable polity id with every allowed character',() => {
  for (const result of renamedPolity('carolingian_realm:1.x')) assert.equal(result.ok,true,result.code);
});
for (const id of ['carolingian realm','__proto__']) test(`both validators refuse the playable polity id "${id}"`,() => {
  for (const result of renamedPolity(id)) assert.equal(result.code,'invalidPolity',id);
});

test('the Egypt, John and Charlemagne packages pass both validators for every playable polity',() => {
  for (const id of ['egypt-3000bc','john-1200','charlemagne-800']) {
    const bundle = readJson(`${id}/scenario.json`), { game,world } = bundle.data, h = world.historicalScenario;
    const input = { game,world,regions: readJson(`${id}/regions.geojson`),assetManifest: readJson(`${id}/manifest.json`) };
    for (const polityId of h.playablePolityIds) {
      const options = { date: h.bookmarkDate,polityId };
      assert.equal(validateHistoricalScenario(input,options).ok,true,`${id} ${polityId}`);
      assert.equal(validateHistoricalCourt(h,options).ok,true,`${id} ${polityId}`);
    }
  }
});

test('a family start offers a non-ruling house and never the ruler as representative',() => {
  const { bundle,h,court,regions,cities } = loadPackage();
  const option = historicalStartOption(bundle,regions,cities);
  const polity = option.polities[0];
  assert.equal(polity.id,POLITY);
  const offered = polity.families.map(f => f.id);
  const ruling = personIn(court,court.rulerId).familyId;
  assert.notEqual(offered[0],ruling,'the start card preselects the first family');
  assert.ok(offered.filter(id => id !== ruling).length >= 1);
  for (const familyId of offered.filter(id => id !== ruling)) {
    const state = createHistoricalCharacterSystem({ historicalScenario: h,date: DATE,polityId: POLITY,mode: 'family',familyId,seed: 9 });
    const view = getCharacterPresentation(state);
    assert.equal(state.identity.familyId,familyId);
    assert.equal(view.representative.id,state.families[familyId].headId);
    assert.notEqual(view.representative.id,court.rulerId);
  }
  const unnamed = createHistoricalCharacterSystem({ historicalScenario: h,date: DATE,polityId: POLITY,mode: 'family',seed: 9 });
  assert.equal(unnamed.identity.familyId,offered[0]);
  assert.notEqual(getCharacterPresentation(unnamed).representative.id,court.rulerId);
  assert.equal(unnamed.offices.ruler.holderId,court.rulerId);
});

test('a prepared family start without a chosen house keeps the ruler in office and out of the player seat',() => {
  const { bundle,regions,cities,court } = loadPackage();
  const scenario = { data: bundle.data,meta: bundle.scenario,regions,cities };
  const result = prepareHistoricalCampaignStart({ request: { historicalStart: { date: DATE,polityId: POLITY,mode: 'family' } },scenario });
  assert.equal(result.ok,true,result.error);
  const state = result.data.world.characterSystem;
  assert.notEqual(state.identity.familyId,personIn(court,court.rulerId).familyId);
  assert.notEqual(getCharacterPresentation(state).representative.id,court.rulerId);
});

test('a realm start follows Charles under the title of emperor',() => {
  const { h,court } = loadPackage();
  const state = createHistoricalCharacterSystem({ historicalScenario: h,date: DATE,polityId: POLITY,seed: 9 });
  const view = getCharacterPresentation(state);
  assert.equal(state.identity.familyId,'royal-house');
  assert.equal(view.representative.id,'karl');
  assert.equal(state.offices.ruler.name,'Kejsare');
  assert.equal(state.offices.ruler.holderId,court.rulerId);
  assert.equal(state.cities.aachen.familyId,'royal-house');
  assert.equal(state.realm.successionLaw,'primogeniture');
});

// Leo III's court. Every sourced value comes from the church record of ad800-review.json.
const church = review.church;
const papalCourt = () => loadPackage().h.courtSeeds[PAPAL];
const sourcedBy = (claim,ids) => { assert.equal(claim.status,'sourced'); assert.deepEqual(claim.sourceIds,regional(ids)); for (const id of ids) assert.ok(church.sourceIds.includes(id),id); };

test('Leo III rules the Papal States from Rome as a documented pope',() => {
  const court = papalCourt(), leo = personIn(court,'leo-iii');
  assert.equal(court.polityId,PAPAL);
  assert.equal(court.seatId,church.seatSettlementId);
  assert.equal(court.rulerId,'leo-iii');
  assert.equal(court.successionLaw,'merit');
  assert.equal(church.aliveOnBookmark,true);
  assert.equal(leo.name,church.popeNameSv);
  assert.equal(leo.identityOrigin,'documented');
  assert.match(leo.originLabelSv,/^Dokumenterad person/);
  assert.equal(leo.claims.identity.noteSv,`${church.positionSv}.`);
  sourcedBy(leo.claims.identity,['ce-leo3','osborne-rome','rfa-801-coronation']);
  const ruler = court.offices.find(o => o.id === 'ruler');
  assert.equal(ruler.name,'Påve');
  assert.equal(ruler.holderId,'leo-iii');
  assert.ok(ruler.claims.identity.noteSv.includes(church.electedAsWorded));
  sourcedBy(ruler.claims.identity,['ce-leo3']);
  assert.deepEqual(court.religions.map(r => [r.id,r.name,r.leaderId]),[['latin-church','Den latinska kyrkan','leo-iii']]);
  sourcedBy(court.religions[0].claims.identity,['ce-leo3','rfa-801-coronation']);
});

test('Leo III has a generated birth value, no parents and no spouse',() => {
  const leo = personIn(papalCourt(),'leo-iii');
  assert.equal(leo.bornAt,'0750-01-01');
  assert.deepEqual(leo.claims.bornAt,{ status: 'generated',noteSv: 'Ingen källa ger födelseår. Den första januari 750 är ett spelvärde.',sourceIds: [] });
  assert.equal(leo.claims.kinship.status,'generated');
  assert.deepEqual(leo.legalParentIds,[]);
  assert.deepEqual(leo.spouseIds,[]);
  assert.equal(leo.claims.spouseIds,undefined);
});

test('Leo III keeps a generated household of his own and three generated courtiers',() => {
  const { h } = loadPackage(), court = h.courtSeeds[PAPAL];
  assert.deepEqual(court.people.map(p => p.id),['leo-iii','generated-courtier-1','generated-courtier-2','generated-courtier-3']);
  for (const person of court.people.filter(p => p.id !== 'leo-iii')) {
    assert.equal(person.identityOrigin,'generated');
    assert.equal(person.originLabelSv,'Genererad person');
    assert.ok(person.name.endsWith(' (genererad)'),person.name);
  }
  const household = court.families.find(f => f.id === 'leo-household');
  assert.equal(household.name,'Leos hushåll');
  assert.equal(household.headId,'leo-iii');
  assert.equal(household.claims.identity.status,'generated');
  assert.equal(personIn(court,'leo-iii').familyId,'leo-household');
  assert.ok(!court.families.some(f => f.id === 'royal-house'),'two courts never share a ruling family id');
  assert.notEqual(court.families[0].id,'leo-household','the start card preselects a non-ruling house');
  assert.deepEqual(court.cities.map(c => [c.id,c.familyId,c.regionId]),[['rome','leo-household','hbm-ad800-222']]);
  for (const row of [...court.people,...court.families,...court.offices,...court.religions,...court.cities])
    for (const claim of Object.values(row.claims)) for (const id of claim.sourceIds) assert.ok(Object.hasOwn(h.sources,id),`${row.id}: ${id}`);
});

test('a realm start of the Papal States follows Leo III under merit succession',() => {
  const { h } = loadPackage();
  const state = createHistoricalCharacterSystem({ historicalScenario: h,date: DATE,polityId: PAPAL,seed: 9 });
  const view = getCharacterPresentation(state);
  assert.equal(state.realm.id,PAPAL);
  assert.equal(state.realm.successionLaw,'merit');
  assert.equal(state.identity.familyId,'leo-household');
  assert.equal(view.representative.id,'leo-iii');
  assert.equal(state.offices.ruler.name,'Påve');
  assert.equal(state.offices.ruler.holderId,'leo-iii');
  assert.equal(state.religions['latin-church'].leaderId,'leo-iii');
  assert.equal(state.cities.rome.familyId,'leo-household');
  assert.equal(view.succession.law,'merit');
});

test('a family start of the Papal States follows a generated house and keeps Leo III in office',() => {
  const { h } = loadPackage();
  const state = createHistoricalCharacterSystem({ historicalScenario: h,date: DATE,polityId: PAPAL,mode: 'family',seed: 9 });
  assert.equal(state.identity.familyId,h.courtSeeds[PAPAL].families[0].id);
  assert.notEqual(getCharacterPresentation(state).representative.id,'leo-iii');
  assert.equal(state.offices.ruler.holderId,'leo-iii');
  assert.equal(state.realm.successionLaw,'merit');
});

test('the start card offers both AD 800 polities and a prepared start reaches the Papal States',() => {
  const { bundle,regions,cities } = loadPackage();
  const option = historicalStartOption(bundle,regions,cities);
  assert.deepEqual(option.polities.map(p => [p.id,p.name,p.ruler.id]),[[POLITY,'Karls rike (karolingiska riket)','karl'],[PAPAL,'Kyrkostaten','leo-iii']]);
  const scenario = { data: bundle.data,meta: bundle.scenario,regions,cities };
  const result = prepareHistoricalCampaignStart({ request: { historicalStart: { date: DATE,polityId: PAPAL,mode: 'realm' },gamePatch: { country: PAPAL } },scenario });
  assert.equal(result.ok,true,result.error);
  assert.equal(result.data.world.characterSystem.identity.polityId,PAPAL);
  assert.equal(result.data.world.characterSystem.offices.ruler.holderId,'leo-iii');
});

test('the package context and coverage say that the Papal States are playable',() => {
  const { h } = loadPackage();
  assert.match(h.contextSv,/Kyrkostaten/);
  assert.match(h.coverageNoteSv,/Kyrkostaten/);
});

test('coverage notes state what each continent withholds and cite real sources',() => {
  const { h } = loadPackage();
  const note = area => h.coverage.find(c => c.area === area).noteSv;
  assert.match(note('Africa'),/eftersom källan inte ger någon utbredning/);
  assert.match(note('Asia'),/Parhae/);
  assert.doesNotMatch(note('Asia'),/Balhae/);
  assert.deepEqual(h.coverage.map(c => c.area),['Africa','Asia','Europe','Americas','Oceania','Antarctica']);
  for (const row of h.coverage) {
    assert.ok(row.sourceIds.length > 0,row.area);
    for (const id of row.sourceIds) assert.ok(Object.hasOwn(h.sources,id),`${row.area}: ${id}`);
  }
  assert.match(note('Europe'),/Pippin puckelryggen/);
  assert.match(note('Europe'),/Avar/i);
  assert.match(note('Africa'),/Idris/);
  assert.match(note('Africa'),/Makuria/);
  assert.match(note('Asia'),/Valabhi/);
  assert.match(note('Asia'),/Tibet/);
  assert.match(note('Americas'),/Tolt/);
  assert.match(note('Americas'),/Wari/);
  assert.match(note('Oceania'),/okänd/i);
  assert.equal(h.coverage.find(c => c.area === 'Americas').status,'unresolved');
  assert.equal(h.coverage.find(c => c.area === 'Oceania').status,'unresolved');
});

test('player text keeps Swedish letters and the house style',() => {
  const { h } = loadPackage();
  const claims = rows => rows.flatMap(r => Object.values(r.claims).map(c => c.noteSv));
  const courts = Object.values(h.courtSeeds);
  assert.equal(courts.length,2);
  const texts = [h.contextSv,h.calendarNoteSv,h.coverageNoteSv,h.eraLabelSv,...h.coverage.map(c => c.noteSv),...h.polities.map(p => p.noteSv),
    ...h.settlements.map(s => s.noteSv),...courts.flatMap(court => [...claims(court.people),...claims(court.offices),...claims(court.religions),...claims(court.families),
      ...court.people.map(p => p.name),...court.families.map(f => f.name),...court.offices.map(o => o.name)])].filter(Boolean);
  for (const text of texts) {
    assert.ok(!/[–—]/.test(text),text);
    assert.ok(!/inte [^.]{1,60}, utan /i.test(text),text);
    assert.ok(!/, inte att /i.test(text),text);
    assert.ok(!/\b(manader|riksniva|fodelse|fodelsedatum|spelvarde|okand)\b/i.test(text),text);
  }
  assert.match(texts.join(' '),/[åäö]/);
});

test('the calendar note carries the annalist year',() => {
  const { h } = loadPackage();
  assert.match(h.calendarNoteSv,/801/);
  assert.match(h.calendarNoteSv,/Startdagen är vald/);
});
