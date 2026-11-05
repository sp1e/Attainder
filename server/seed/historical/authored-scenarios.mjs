// Reviewed historical facts and explicit gameplay choices. AGPL-3.0-or-later.
// This module authors data only; runtime activation belongs to the start adapter.
export const SOURCE_REVISION = '4b5039e50d8d2464b065bd76ad6086cd4597108d';
const source = (title,institution,url,locator,chronology,uncertainty,license = 'Reference only; no source prose or images redistributed') =>
  ({ title,institution,url,locator,chronology,uncertainty,license,retrievedAt: '2026-11-05',review: 'Reviewed for the stated claim; boundaries and biographies require separate evidence.' });
export const sources = {
  hbm: source('Historical Basemaps','André Ourednik and contributors',`https://github.com/aourednik/historical-basemaps/tree/${SOURCE_REVISION}`,'README: Polygons, Conceptual limitations, Credits; CONTRIBUTING: Precision','Snapshot labels 3000 BC and AD 1200','World-scale approximate reconstruction; some source labels rejected; no feature-level boundary bibliography.','GPL-3.0-only; original source, full licence and notices accompany the release'),
  naturalEarth: source('Natural Earth physical land 1:50m','Natural Earth contributors','https://www.naturalearthdata.com/downloads/50m-physical-vectors/50m-land/','Land polygons; terms-of-use page','Generalized present-day physical geography','Physical reference only; neither ancient delta geometry nor proof of settlement or sovereignty.','Public domain; https://www.naturalearthdata.com/about/terms-of-use/'),
  egypt: source('Early Dynastic Period','Egyptian Ministry of Tourism and Antiquities','https://egymonuments.gov.eg/historical-periods/early-dynastic-period/','Date heading and first three paragraphs','Approximately 3100–2686 BC','Gradual unification and Memphis capital; no exact-year king or measured frontier.'),
  horus: source('Stela of King Raneb, 60.144','Metropolitan Museum of Art','https://www.metmuseum.org/art/collection/search/545799','Curatorial discussion of early Horus names','Object circa 2880 BCE; naming convention Dynasty 0–3','Supports religious royal context, not Raneb as king in 3000 BC.'),
  memphis: source('Mīt Ruhaynah, TGN 7001186','Getty Research Institute','https://www.getty.edu/vow/TGNFullDisplay?english=Y&find=Heidelberg&nation=&place=inhabited+place&subjectid=7001186','Coordinates and Note; vocabulary data-services Licensing and Citations','Modern village reference near ancient Memphis','[31.2500,29.8500] marks the modern village adjoining the ruins; early royal residence not located.','ODC-By-1.0; Getty Thesaurus of Geographic Names, Getty Research Institute'),
  john: source('John','Westminster Abbey','https://www.westminster-abbey.org/abbey-commemorations/royals/john','Opening paragraphs, Marriage, Coronation','King from 1199; marriage 24 August 1200 in source historical chronology','Birth year uncertain; source favors 1167. Game dates use chosen proleptic Gregorian day labels.'),
  isabella: source('Isabella of Angoulême','Nicholas Vincent, Oxford Dictionary of National Biography','https://academic.oup.com/oxford-dictionary-of-national-biography/reference/63486/reference-article-abstract/580767093','Public extract, first paragraphs; DOI 10.1093/ref:odnb/14483','Circa 1188–1246; marriage 24 August 1200','Approximate birth year. The gameplay birthday 1 January is an estimate, not a recorded date.'),
  angevin: source('How did Magna Carta come about?','UK Parliament','https://www.parliament.uk/about/living-heritage/evolutionofparliament/originsofparliament/birthofparliament/overview/magnacarta/magnacartahow/','Opening paragraphs','John inherited English crown, Normandy, Aquitaine, Anjou and Irish lordship in 1199','Titles support a composite realm; they do not establish uniform control, all Ireland or surveyed borders.'),
  angevinJurisdiction: source('Magna Carta preparation materials','The National Archives; Dr Matt Phillips','https://cdn.nationalarchives.gov.uk/documents/education/magna-carta-preparation-pack.pdf','Printed page 13, Angevin Kingship; page 14, marriage','Angevin kingship and August 1200 marriage','French possessions involved vassalage to the French crown; gameplay aggregate is not a single legal jurisdiction.'),
  brittany: source('War and peace: hired troops and military aid in Byzantine and English treaties, c.900–1200','Historical Research, Oxford Academic','https://academic.oup.com/histres/article/96/274/409/7277167','Accessible publisher excerpt around notes 121–126; full-page retrieval unavailable','Treaty of Le Goulet, 1200','Arthur accepted as John’s liegeman; supports composite allegiance, not direct uniform rule in Brittany.'),
  windsorResidence: source('Who built Windsor Castle?','Royal Collection Trust','https://www.rct.uk/visit/windsor-castle/who-built-windsor-castle','Origins, paragraphs 1–3','Royal residence before 1200; Henry II apartments in late twelfth century','A gameplay seat; no claim that John or Isabella was physically present on the chosen day.'),
  windsor: source('Windsor, TGN 7011919','Getty Research Institute','https://www.getty.edu/vow/TGNFullDisplay?english=N&find=&nation=Uganda&place=&subjectid=7011919','Coordinates; hierarchy identifies England; vocabulary data-services terms','Modern inhabited-place reference','[-0.6000,51.4833] locates Windsor town approximately, not a medieval throne room.','ODC-By-1.0; Getty Thesaurus of Geographic Names, Getty Research Institute'),
};
const claim = (status,noteSv,sourceIds = []) => ({ status,noteSv,sourceIds });
const generated = note => claim('generated',note);
const mechanics = generated('Spelvärden, personlighet och ämbetsregler är skapade för simuleringen.');

function court({ polityId, seat, ancient }) {
  const religionId = ancient ? 'horus-context' : 'latin-church';
  const rulerId = ancient ? 'generated-king' : 'john';
  const partnerId = ancient ? 'generated-partner' : 'isabella';
  const person = (id,name,bornAt,familyId,sex = 'male') => ({ id,name,bornAt,familyId,sex,religionId,
    identityOrigin: 'generated',originLabelSv: 'Genererad person',legalParentIds: [],spouseIds: [],
    claims: { identity: generated('Personen och namnet är genererade.'), bornAt: generated('Födelsedatumet är ett spelvärde.'), kinship: generated('Inga dokumenterade föräldrar läggs till; familjegruppen är en spelabstraktion.'), mechanics },
    mechanics: { archetype: 'steward', traits: ['dutiful'], skills: { command: 5,stewardship: 6,diplomacy: 5,learning: 5,intrigue: 4,prowess: 4 } } });
  const people = [person(rulerId,ancient ? 'Kung Meri (genererad)' : 'Johan av England',ancient ? '-3036-01-01' : '1167-12-24','royal-house'),
    person(partnerId,ancient ? 'Iset (genererad)' : 'Isabella av Angoulême',ancient ? '-3032-01-01' : '1188-01-01','royal-house','female')];
  people[0].spouseIds = [partnerId]; people[1].spouseIds = [rulerId];
  if (!ancient) {
    for (const p of people) { p.identityOrigin = 'documented'; p.originLabelSv = 'Dokumenterad person; spelvärden är genererade';
      p.claims.identity = claim('sourced','Personens identitet och roll stöds av källan.',[p.id === 'john' ? 'john' : 'isabella']);
      p.claims.bornAt = claim('uncertain',p.id === 'john' ? 'Födelseåret är osäkert; 1167 används i spelet.' : 'Född cirka 1188; den första januari är valt som spelvärde.',['john','isabella']);
      p.claims.spouseIds = claim('sourced','Äktenskapet ingicks den 24 augusti 1200 enligt källans kalender.',['john','isabella']);
    }
  } else for (const p of people) p.claims.spouseIds = generated('Äktenskapet och släktskapet är genererade.');
  const families = [{ id: 'royal-house',name: ancient ? 'Det genererade kungahuset' : 'Kungahuset',headId: rulerId,religionId,color: '#bd9251',claims: { identity: generated('Hushållet är en administrativ spelgrupp; inga okända släktled påstås.') } }];
  for (let i = 1; i <= 3; i++) {
    const id = `generated-courtier-${i}`, familyId = `generated-house-${i}`;
    people.push(person(id, ancient ? ['Senu (genererad)','Heka (genererad)','Teti (genererad)'][i-1] : ['Robert (genererad)','Alice (genererad)','William (genererad)'][i-1],ancient ? `-30${40+i}-01-01` : `${1150+i}-01-01`,familyId));
    families.push({ id: familyId,name: `Hovhus ${i} (genererat)`,headId: id,religionId,color: ['#93594d','#567b82','#776c91'][i-1],claims: { identity: generated('Hovfamilj utan påstådd historisk identitet eller genealogi.') } });
  }
  const offices = [['ruler',ancient ? 'Kung' : 'Kung',rulerId],['general','Överbefälhavare','generated-courtier-1'],['chancellor','Kansler','generated-courtier-2'],['priest','Religiös företrädare','generated-courtier-3']].map(([id,name,holderId]) => ({ id,name,holderId,claims: { identity: id === 'ruler' && !ancient ? claim('sourced','Johan var kung av England vid starten.',['john']) : generated('Ämbete och utnämning följer spelets regler.'), mechanics } }));
  return { polityId,rulerId,seatId: seat.id,people,families,offices,
    religions: [{ id: religionId,name: ancient ? 'Horusanknuten kungamakt' : 'Den latinska kyrkan',leaderId: 'generated-courtier-3',claims: { identity: ancient ? claim('sourced','Tidig kunglig Horussymbolik; mekaniken förenklar olika religiösa praktiker.',['horus']) : claim('sourced','Kunglig kröning vid Westminster; kyrkans spelorganisation är förenklad.',['john']), mechanics } }],
    cities: [{ id: seat.id,settlementId: seat.id,name: seat.nameSv,regionId: seat.regionId,familyId: 'royal-house',claims: { mechanics } }],
    mechanics: { status: 'generated',noteSv: 'Resurser, succession, familjegrupper, myndighetsålder och hovämbeten följer spelets regler. De beskriver inte belagda historiska värden.' } };
}

export function authoredScenario(ancient) {
  const polityId = ancient ? 'egypt-early-dynastic' : 'johns-realms';
  const contentId = ancient ? 'egypt-3000bc' : 'john-1200';
  const date = ancient ? '-3000-01-01' : '1200-12-31';
  const seat = { id: ancient ? 'memphis' : 'windsor',nameSv: ancient ? 'Ineb-Hedj (Memfis)' : 'Windsor',coordinates: ancient ? [31.25,29.85] : [-0.6,51.4833],polityId,regionId: ancient ? 'hbm-bc3000-19' : 'hbm-ad1200-275',placement: 'inside',sourceIds: ancient ? ['egypt','memphis'] : ['windsor','windsorResidence'],noteSv: ancient ? 'Ungefärlig placering vid dagens Mit Rahina; det tidiga palatsets läge är okänt.' : 'Ungefärlig ortsmarkör. Vald som spelsäte; kungaparets närvaro denna dag är inte belagd.' };
  return { schemaVersion: 1,kind: 'historical',contentId,contentVersion: '1.0.0',calendar: 'proleptic-gregorian-no-year-zero',bookmarkDate: date,
    eraLabelSv: ancient ? 'Cirka 3000 f.Kr.' : '1200 e.Kr.',
    contextSv: ancient ? 'Egypten, cirka 3000 f.Kr. Kungahuset är genererat och gränserna är ungefärliga.' : 'Johan av England efter äktenskapet med Isabella. Dokumenterade identiteter, ungefärliga födelsedatum och genererade hovmän.',
    calendarNoteSv: 'Startdagen är vald för simuleringen. Källornas datering och kalenderkonventioner finns kvar i proveniensen.',
    coverageNoteSv: 'Världens land visas med en generaliserad nutida kustlinje. Granskade historiska områden har ungefärliga gränser. Okänd kontroll betyder att underlag saknas, inte att marken är obebodd eller ledig.',
    sources: { ...sources },polities: [{ id: polityId,nameSv: ancient ? 'Egypten' : 'Johns riken (angevinskt välde)',sourceIds: ancient ? ['egypt','hbm'] : ['john','angevin','angevinJurisdiction','hbm'],boundary: 'approximate',noteSv: ancient ? 'Rekonstruerad utbredning; den lokala gränsen är inte belagd.' : 'Spelaggregat av skilda besittningar; franska länsförhållanden och oklart lokalt herravälde kvarstår.' }],
    playablePolityIds: [polityId],settlements: [seat],courtSeeds: { [polityId]: court({ polityId,seat,ancient }) },
  };
}
