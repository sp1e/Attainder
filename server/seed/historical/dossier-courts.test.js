import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateHistoricalCourt } from '../../historicalScenarios.js';
import { dossierPolity, dossierCourt, ENGINE_LIMIT_TEXT_SV } from './dossier-courts.mjs';

const readDossier = name => JSON.parse(readFileSync(new URL(`./courts/${name}-courts.json`,import.meta.url),'utf8'));
const DOSSIERS = [readDossier('ad800'),readDossier('ad1200')];
const yearOf = dossier => Number(dossier.bookmark.slice(0,4));
const courtierNames = ['Testnamn 1 (genererad)','Testnamn 2 (genererad)','Testnamn 3 (genererad)'];
const build = (dossier,polityId,successionLaw = 'primogeniture') => dossierCourt({ dossier,polityId,bookmarkYear: yearOf(dossier),successionLaw,courtierNames,
  courtierBornAt: i => `${String(yearOf(dossier) - 40 + i).padStart(4,'0')}-01-01` });
const dossierOf = polityId => DOSSIERS.find(d => d.polities.some(p => p.polityId === polityId));
const buildFor = polityId => build(dossierOf(polityId),polityId);
const READY = DOSSIERS.flatMap(d => d.polities.filter(p => p.status === 'ready').map(p => p.polityId));
const person = (court,id) => court.people.find(p => p.id === id);
const family = (court,id) => court.families.find(f => f.id === person(court,id).familyId);
const office = (court,id) => court.offices.find(o => o.id === id);

function scenarioFor(dossier,polityId,result) {
  const polity = dossierPolity(dossier,polityId);
  return { schemaVersion: 1,kind: 'historical',calendar: 'proleptic-gregorian-no-year-zero',contentId: 'test',contentVersion: '1.0.0',
    eraLabelSv: 'Test',contextSv: 'Test',coverageNoteSv: 'Test',bookmarkDate: dossier.bookmark,sources: result.sources,
    playablePolityIds: [polityId],polities: [{ id: polityId,nameSv: polity.nameSv }],settlements: [result.seat],courtSeeds: { [polityId]: result.court } };
}
function citedIds(result) {
  const { court } = result, cited = new Set([...result.seat.sourceIds,...result.contextSourceIds]);
  for (const entry of ['people','families','offices','religions','cities'].flatMap(k => court[k])) {
    for (const c of Object.values(entry.claims)) c.sourceIds.forEach(id => cited.add(id));
  }
  return cited;
}

test('every ready dossier polity yields a court the validator accepts with its own sources', () => {
  assert.equal(READY.length,11);
  for (const polityId of READY) {
    const dossier = dossierOf(polityId), result = build(dossier,polityId), polity = dossierPolity(dossier,polityId);
    const checked = validateHistoricalCourt(scenarioFor(dossier,polityId,result),{ date: dossier.bookmark,polityId });
    assert.equal(checked.ok,true,`${polityId}: ${checked.code}`);
    const cited = citedIds(result);
    for (const id of cited) assert.ok(Object.hasOwn(result.sources,id),`${polityId} cites missing source ${id}`);
    assert.deepEqual(Object.keys(result.sources).sort(),[...cited].sort(),`${polityId} imports only cited sources`);
    assert.equal(result.seat.regionId,`hbm-ad${yearOf(dossier)}-${polity.sourceFeatureIndexes[0]}`);
    assert.equal(result.seat.placement,'inside');
    assert.equal(result.court.seatId,polity.seat.settlementId);
    assert.equal(result.contextSv,polity.contextSv);
    assert.deepEqual(result.contextSourceIds,polity.contextSourceIds);
  }
});

test('imported sources carry a review written from the dossier review block', () => {
  const dossier = dossierOf('tang-empire'), { review } = dossierPolity(dossier,'tang-empire');
  const { sources } = buildFor('tang-empire');
  for (const [id,s] of Object.entries(sources)) {
    assert.equal(s.url,dossier.sources[id].url);
    assert.ok(s.review.includes(review.checkedBy) && s.review.includes(review.checkedOn),s.review);
  }
});

test('Tang: Dezong rules as Kejsare and Li Song joins his family as his son', () => {
  const { court } = buildFor('tang-empire');
  assert.equal(court.rulerId,'dezong');
  assert.deepEqual([office(court,'ruler').name,office(court,'ruler').holderId],['Kejsare','dezong']);
  assert.equal(person(court,'li-song').familyId,person(court,'dezong').familyId);
  assert.deepEqual(person(court,'li-song').legalParentIds,['dezong']);
  assert.equal(person(court,'li-song').claims.legalParentIds.status,'sourced');
  assert.equal(person(court,'li-song').originLabelSv,'Dokumenterad person; spelvärden är genererade');
  assert.equal(court.successionLaw,'primogeniture');
  const generated = court.people.filter(p => p.identityOrigin === 'generated');
  assert.deepEqual(generated.map(p => p.id),['generated-courtier-1','generated-courtier-2','generated-courtier-3']);
  for (const p of generated) {
    assert.ok(p.name.endsWith(' (genererad)'));
    assert.equal(p.originLabelSv,'Genererad person');
  }
  assert.deepEqual(['general','chancellor','priest'].map(id => office(court,id).holderId),generated.map(p => p.id));
  assert.equal(court.religions[0].leaderId,'generated-courtier-3');
});

test('Byzantium: Eirene rules as Kejsarinna and Tarasios and Aetios keep generated households', () => {
  const { court } = buildFor('byzantine-empire');
  assert.equal(court.rulerId,'eirene-of-athens');
  assert.equal(person(court,'eirene-of-athens').sex,'female');
  assert.equal(office(court,'ruler').name,'Kejsarinna');
  assert.equal(family(court,'tarasios').name,'Tarasioss hushåll');
  assert.equal(family(court,'aetios').name,'Aetioss hushåll');
  for (const id of ['tarasios','aetios']) {
    assert.notEqual(person(court,id).familyId,person(court,'eirene-of-athens').familyId);
    assert.equal(family(court,id).headId,id);
    assert.equal(family(court,id).claims.identity.status,'generated');
  }
  assert.equal(court.religions[0].leaderId,'tarasios');
  assert.equal(court.families[0].id,person(court,'eirene-of-athens').familyId,'the dossier court lists the ruling family first; authored-scenarios.mjs moves the generated houses ahead of it');
});

test('Silla: the regent uncle joins the young king\'s family through a kinship entry', () => {
  const { court } = buildFor('silla');
  assert.equal(court.rulerId,'aejang');
  assert.equal(person(court,'kim-eon-seung').familyId,person(court,'aejang').familyId);
});

test('France: Louis VIII and Blanche join Philip II\'s family as a married pair', () => {
  const dossier = dossierOf('france-capetian'), polity = dossierPolity(dossier,'france-capetian');
  const { court } = buildFor('france-capetian');
  const ruling = person(court,'philip-ii').familyId;
  for (const id of ['louis-viii','blanche-castile','ingeborg-denmark']) assert.equal(person(court,id).familyId,ruling,id);
  assert.deepEqual(person(court,'louis-viii').spouseIds,['blanche-castile']);
  assert.deepEqual(person(court,'blanche-castile').spouseIds,['louis-viii']);
  assert.equal(person(court,'blanche-castile').sex,'female');
  const ingeborg = polity.people.find(p => p.id === 'ingeborg-denmark'), philip = polity.people.find(p => p.id === 'philip-ii');
  const naming = [...ingeborg.kinship.filter(k => k.ofPersonId === 'philip-ii'),...philip.kinship.filter(k => k.ofPersonId === 'ingeborg-denmark')];
  const claim = person(court,'ingeborg-denmark').claims.spouseIds;
  if (naming.length) assert.equal(claim.status,naming[0].status);
  else assert.deepEqual([claim.status,claim.sourceIds],['uncertain',ingeborg.identity.sourceIds]);
});

test('dossierPolity refuses blocked polities', () => {
  assert.throws(() => dossierPolity(dossierOf('western-xia'),'western-xia'),/dossier polity western-xia is not ready/);
  assert.throws(() => dossierPolity(dossierOf('chimu'),'chimu'),/dossier polity chimu is not ready/);
  assert.throws(() => buildFor('chimu'),/dossier polity chimu is not ready/);
});

test('every engine limit in the dossiers has a Swedish game-rule sentence and reaches the coverage lines', () => {
  const limits = new Set(DOSSIERS.flatMap(d => d.polities.flatMap(p => p.engineLimits ?? [])));
  assert.ok(limits.size > 0);
  assert.ok(Object.isFrozen(ENGINE_LIMIT_TEXT_SV));
  for (const id of limits) assert.ok(typeof ENGINE_LIMIT_TEXT_SV[id] === 'string' && ENGINE_LIMIT_TEXT_SV[id].trim(),id);
  const polity = dossierPolity(dossierOf('france-capetian'),'france-capetian');
  const { coverageLinesSv } = buildFor('france-capetian');
  assert.deepEqual(coverageLinesSv,[polity.successionNoteSv,polity.engineLimitNoteSv,ENGINE_LIMIT_TEXT_SV['multiple-spouses']]);
  const abbasid = dossierPolity(dossierOf('abbasid-caliphate'),'abbasid-caliphate');
  assert.deepEqual(buildFor('abbasid-caliphate').coverageLinesSv,[abbasid.successionNoteSv,abbasid.engineRepresentationNoteSv]);
});
