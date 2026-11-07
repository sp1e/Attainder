// Reviewed historical facts and explicit gameplay choices. AGPL-3.0-or-later.
// This module authors data only; runtime activation belongs to the start adapter.
export const SOURCE_REVISION = '4b5039e50d8d2464b065bd76ad6086cd4597108d';
export const EGYPT_CORE_NOTE_SV = 'Kartan visar ett ungefärligt egyptiskt kärnområde som utvecklarna har valt och beskurit. Kontroll längre söderut är oklar; områdets kant återger ingen belagd exakt gräns.';
export const EGYPT_CORE_SOURCE_IDS = ['egypt','egyptCore','nubiaMet','nubiaMpi','nubiaUcl','hbm'];
export const EGYPT_CORE_TRANSFORM = { operation: 'intersection',maskBbox: [-180,24.2,180,90],authorship: 'developer',coverage: 'selective-core',
  note: 'Developer-selected latitude north of the Elephantine/First Cataract frontier region; conservative display omission, not a historical boundary. Remaining upstream edges stay approximate.',sourceIds: EGYPT_CORE_SOURCE_IDS };
const source = (title,institution,url,locator,chronology,uncertainty,license = 'Reference only; no source prose or images redistributed') =>
  ({ title,institution,url,locator,chronology,uncertainty,license,retrievedAt: '2026-11-05',review: 'Reviewed for the stated claim; boundaries and biographies require separate evidence.' });
export const sources = {
  hbm: source('Historical Basemaps','André Ourednik and contributors',`https://github.com/aourednik/historical-basemaps/tree/${SOURCE_REVISION}`,'README: Polygons, Conceptual limitations, Credits; CONTRIBUTING: Precision','Snapshot labels 3000 BC and AD 1200','World-scale approximate reconstruction; some source labels rejected; no feature-level boundary bibliography.','GPL-3.0-only; original source, full licence and notices accompany the release'),
  naturalEarth: source('Natural Earth physical land 1:50m','Natural Earth contributors','https://www.naturalearthdata.com/downloads/50m-physical-vectors/50m-land/','Land polygons; terms-of-use page','Generalized present-day physical geography','Physical reference only; neither ancient delta geometry nor proof of settlement or sovereignty.','Public domain; https://www.naturalearthdata.com/about/terms-of-use/'),
  egypt: source('Early Dynastic Period','Egyptian Ministry of Tourism and Antiquities','https://egymonuments.gov.eg/historical-periods/early-dynastic-period/','Date heading and first three paragraphs','Approximately 3100–2686 BC','Gradual unification and Memphis capital; no exact-year king or measured frontier.'),
  egyptCore: source('The Origins of Urban Society','Nadine Moeller, Cambridge University Press','https://www.cambridge.org/core/books/archaeology-of-urbanism-in-ancient-egypt/origins-of-urban-society/7827A646AACBAEEEFCC7CF442E904D2B','Chapter 4, sections 4.1 and 4.2.6, Figures 4.1 and 4.15; DOI 10.1017/CBO9781139942119.006','Formative Egyptian settlement; Elephantine fortress figure second half of First Dynasty–early Second Dynasty','Supports broad Nile Valley/Delta and southern frontier-region context. No exact-year continuous frontier or clipping vertices supplied.'),
  nubiaMet: source('Sudan, 8000–2000 BC','Metropolitan Museum of Art','https://www.metmuseum.org/pt/toah/ht/02/afs.html','Lower Nubia timeline and Key Events, ca. 2800–2200 BC','A-Group ca. 3700–2800 BC; Egyptian domination between first and third cataracts ca. 2800–2200 BC','Later domination cannot establish full upstream southern extent in 3000 BC; chronology differs from MPI and UCL.'),
  nubiaMpi: source('Nubia: History and Archaeology','Max Planck Institute for the History of Science','https://nubianrockart.mpiwg-berlin.mpg.de/nubia/history_archaeology/overview.html','Opening two paragraphs; updated April 2009','A-Group disappearance and Egyptian settlements around 3100 BC','Qualified expulsion hypothesis and settlement presence do not prove continuous sovereignty. Chronology differs from Met and UCL.'),
  nubiaUcl: source('Timeline: Nubia','University College London, Digital Egypt','https://www.ucl.ac.uk/museums-static/digitalegypt/nubia/timeline.html','Rows about 3000 BC and 2800–2200 BC','End of A-Group about 3000 BC; Lower Nubia unknown in 2800–2200 BC','Unknown archaeological/control record is not empty land; no inferred annexation date or frontier.'),
  horus: source('Stela of King Raneb, 60.144','Metropolitan Museum of Art','https://www.metmuseum.org/art/collection/search/545799','Curatorial discussion of early Horus names','Object circa 2880 BCE; naming convention Dynasty 0–3','Supports religious royal context, not Raneb as king in 3000 BC.'),
  memphis: source('Mīt Ruhaynah, TGN 7001186','Getty Research Institute','https://www.getty.edu/vow/TGNFullDisplay?english=Y&find=Heidelberg&nation=&place=inhabited+place&subjectid=7001186','Coordinates and Note; vocabulary data-services Licensing and Citations','Modern village reference near ancient Memphis','[31.2500,29.8500] marks the modern village adjoining the ruins; early royal residence not located.','ODC-By-1.0; Getty Thesaurus of Geographic Names, Getty Research Institute'),
  john: source('John','Westminster Abbey','https://www.westminster-abbey.org/abbey-commemorations/royals/john','Opening paragraphs, Marriage, Coronation','King from 1199; marriage 24 August 1200 in source historical chronology','Birth year uncertain; source favors 1167. Game dates use chosen proleptic Gregorian day labels.'),
  isabella: source('Isabella of Angoulême','Nicholas Vincent, Oxford Dictionary of National Biography','https://academic.oup.com/oxford-dictionary-of-national-biography/reference/63486/reference-article-abstract/580767093','Public extract, first paragraphs; DOI 10.1093/ref:odnb/14483','Circa 1188–1246; marriage 24 August 1200','Approximate birth year. The gameplay birthday 1 January is an estimate, not a recorded date.'),
  angevin: source('How did Magna Carta come about?','UK Parliament','https://www.parliament.uk/about/living-heritage/evolutionofparliament/originsofparliament/birthofparliament/overview/magnacarta/magnacartahow/','Opening paragraphs','John inherited English crown, Normandy, Aquitaine, Anjou and Irish lordship in 1199','Titles support a composite realm; they do not establish uniform control, all Ireland or surveyed borders.'),
  angevinJurisdiction: source('Magna Carta preparation materials','The National Archives; Dr Matt Phillips','https://cdn.nationalarchives.gov.uk/documents/education/magna-carta-preparation-pack.pdf','Printed page 13, Angevin Kingship; page 14, marriage','Angevin kingship and August 1200 marriage','French possessions involved vassalage to the French crown; gameplay aggregate is not a single legal jurisdiction.'),
  brittany: source('War and peace: hired troops and military aid in Byzantine and English treaties, c.900–1200','Historical Research; Cardiff University institutional repository','https://orca.cardiff.ac.uk/id/eprint/165780/1/BM%20HR.pdf','Full published text, printed page 423 (PDF page 15), first paragraph, notes 123–126','Treaty of Le Goulet, 1200','Arthur accepted as John’s liegeman; supports composite allegiance, not direct uniform rule in Brittany.','CC-BY-4.0 on published title page; reference only, no article text redistributed'),
  windsorResidence: source('Who built Windsor Castle?','Royal Collection Trust','https://www.rct.uk/visit/windsor-castle/who-built-windsor-castle','Origins, paragraphs 1–3','Royal residence before 1200; Henry II apartments in late twelfth century','A gameplay seat; no claim that John or Isabella was physically present on the chosen day.'),
  windsor: source('Windsor, TGN 7011919','Getty Research Institute','https://www.getty.edu/vow/TGNFullDisplay?english=N&find=&nation=Uganda&place=&subjectid=7011919','Coordinates; hierarchy identifies England; vocabulary data-services terms','Modern inhabited-place reference','[-0.6000,51.4833] locates Windsor town approximately, not a medieval throne room.','ODC-By-1.0; Getty Thesaurus of Geographic Names, Getty Research Institute'),
};
const claim = (status,noteSv,sourceIds = []) => ({ status,noteSv,sourceIds });
const generated = note => claim('generated',note);
const mechanics = generated('Spelvärden, personlighet och ämbetsregler är skapade för simuleringen.');

function court({ polityId, seat, spec }) {
  const { religionId,rulerId,partnerId } = spec;
  const person = (id,name,bornAt,familyId,sex = 'male') => ({ id,name,bornAt,familyId,sex,religionId,
    identityOrigin: 'generated',originLabelSv: 'Genererad person',legalParentIds: [],spouseIds: [],
    claims: { identity: generated('Personen och namnet är genererade.'), bornAt: generated('Födelsedatumet är ett spelvärde.'), kinship: generated('Inga dokumenterade föräldrar läggs till; familjegruppen är en spelabstraktion.'), mechanics },
    mechanics: { archetype: 'steward', traits: ['dutiful'], skills: { command: 5,stewardship: 6,diplomacy: 5,learning: 5,intrigue: 4,prowess: 4 } } });
  const people = [person(rulerId,spec.rulerName,spec.rulerBornAt,'royal-house'),
    person(partnerId,spec.partnerName,spec.partnerBornAt,'royal-house','female')];
  people[0].spouseIds = [partnerId]; people[1].spouseIds = [rulerId];
  spec.annotatePeople(people);
  const families = [{ id: 'royal-house',name: spec.familyName,headId: rulerId,religionId,color: '#bd9251',claims: { identity: generated('Hushållet är en administrativ spelgrupp; inga okända släktled påstås.') } }];
  for (let i = 1; i <= 3; i++) {
    const id = `generated-courtier-${i}`, familyId = `generated-house-${i}`;
    people.push(person(id,spec.courtierNames[i-1],spec.courtierBornAt(i),familyId));
    families.push({ id: familyId,name: `Hovhus ${i} (genererat)`,headId: id,religionId,color: ['#93594d','#567b82','#776c91'][i-1],claims: { identity: generated('Hovfamilj utan påstådd historisk identitet eller genealogi.') } });
  }
  const offices = [['ruler','Kung',rulerId],['general','Överbefälhavare','generated-courtier-1'],['chancellor','Kansler','generated-courtier-2'],['priest','Religiös företrädare','generated-courtier-3']].map(([id,name,holderId]) => ({ id,name,holderId,claims: { identity: id === 'ruler' && spec.rulerOfficeClaim ? spec.rulerOfficeClaim : generated('Ämbete och utnämning följer spelets regler.'), mechanics } }));
  return { polityId,rulerId,seatId: seat.id,people,families,offices,
    religions: [{ id: religionId,name: spec.religionName,leaderId: 'generated-courtier-3',claims: { identity: spec.religionClaim, mechanics } }],
    cities: [{ id: seat.id,settlementId: seat.id,name: seat.nameSv,regionId: seat.regionId,familyId: 'royal-house',claims: { mechanics } }],
    mechanics: { status: 'generated',noteSv: 'Resurser, succession, familjegrupper, myndighetsålder och hovämbeten följer spelets regler. De beskriver inte belagda historiska värden.' } };
}

const COVERAGE_BASE_NOTE_SV = 'Världens land visas med en generaliserad nutida kustlinje. Granskade historiska områden har ungefärliga gränser. Okänd kontroll betyder att underlag saknas, inte att marken är obebodd eller ledig.';

// One authored record per package. Everything that differs between packages lives here.
const AUTHORED_PACKAGES = {
  'egypt-3000bc': {
    sources,polityId: 'egypt-early-dynastic',bookmarkDate: '-3000-01-01',eraLabelSv: 'Cirka 3000 f.Kr.',
    seat: { id: 'memphis',nameSv: 'Ineb-Hedj (Memfis)',coordinates: [31.25,29.85],regionId: 'hbm-bc3000-19',placement: 'inside',sourceIds: ['egypt','memphis'],noteSv: 'Ungefärlig placering vid dagens Mit Rahina; det tidiga palatsets läge är okänt.' },
    contextSv: `Egypten, cirka 3000 f.Kr. Kungahuset är genererat. ${EGYPT_CORE_NOTE_SV}`,
    coverageNotePrefixSv: `${EGYPT_CORE_NOTE_SV} `,
    polity: { nameSv: 'Egypten',sourceIds: EGYPT_CORE_SOURCE_IDS,extra: { coverage: 'selective-core',geometryTransform: EGYPT_CORE_TRANSFORM },noteSv: EGYPT_CORE_NOTE_SV },
    court: {
      religionId: 'horus-context',rulerId: 'generated-king',partnerId: 'generated-partner',
      rulerName: 'Kung Meri (genererad)',rulerBornAt: '-3036-01-01',partnerName: 'Iset (genererad)',partnerBornAt: '-3032-01-01',
      familyName: 'Det genererade kungahuset',courtierNames: ['Senu (genererad)','Heka (genererad)','Teti (genererad)'],courtierBornAt: i => `-30${40+i}-01-01`,
      annotatePeople: people => { for (const p of people) p.claims.spouseIds = generated('Äktenskapet och släktskapet är genererade.'); },
      rulerOfficeClaim: null,religionName: 'Horusanknuten kungamakt',
      religionClaim: claim('sourced','Tidig kunglig Horussymbolik; mekaniken förenklar olika religiösa praktiker.',['horus']),
    },
  },
  'john-1200': {
    sources,polityId: 'johns-realms',bookmarkDate: '1200-12-31',eraLabelSv: '1200 e.Kr.',
    seat: { id: 'windsor',nameSv: 'Windsor',coordinates: [-0.6,51.4833],regionId: 'hbm-ad1200-275',placement: 'inside',sourceIds: ['windsor','windsorResidence'],noteSv: 'Ungefärlig ortsmarkör. Vald som spelsäte; kungaparets närvaro denna dag är inte belagd.' },
    contextSv: 'Johan av England efter äktenskapet med Isabella. Dokumenterade identiteter, ungefärliga födelsedatum och genererade hovmän.',
    coverageNotePrefixSv: '',
    polity: { nameSv: 'Johns riken (angevinskt välde)',sourceIds: ['john','angevin','angevinJurisdiction','hbm'],extra: {},noteSv: 'Spelaggregat av skilda besittningar; franska länsförhållanden och oklart lokalt herravälde kvarstår.' },
    court: {
      religionId: 'latin-church',rulerId: 'john',partnerId: 'isabella',
      rulerName: 'Johan av England',rulerBornAt: '1167-12-24',partnerName: 'Isabella av Angoulême',partnerBornAt: '1188-01-01',
      familyName: 'Kungahuset',courtierNames: ['Robert (genererad)','Alice (genererad)','William (genererad)'],courtierBornAt: i => `${1150+i}-01-01`,
      annotatePeople: people => {
        for (const p of people) { p.identityOrigin = 'documented'; p.originLabelSv = 'Dokumenterad person; spelvärden är genererade';
          p.claims.identity = claim('sourced','Personens identitet och roll stöds av källan.',[p.id === 'john' ? 'john' : 'isabella']);
          p.claims.bornAt = claim('uncertain',p.id === 'john' ? 'Födelseåret är osäkert; 1167 används i spelet.' : 'Född cirka 1188; den första januari är valt som spelvärde.',['john','isabella']);
          p.claims.spouseIds = claim('sourced','Äktenskapet ingicks den 24 augusti 1200 enligt källans kalender.',['john','isabella']);
        }
      },
      rulerOfficeClaim: claim('sourced','Johan var kung av England vid starten.',['john']),religionName: 'Den latinska kyrkan',
      religionClaim: claim('sourced','Kunglig kröning vid Westminster; kyrkans spelorganisation är förenklad.',['john']),
    },
  },
};

export function authoredScenario(contentId) {
  if (!Object.hasOwn(AUTHORED_PACKAGES,contentId)) throw new Error(`Unknown historical scenario: ${contentId}`);
  const a = AUTHORED_PACKAGES[contentId], polityId = a.polityId, seat = { id: a.seat.id,nameSv: a.seat.nameSv,coordinates: a.seat.coordinates,polityId,regionId: a.seat.regionId,placement: a.seat.placement,sourceIds: a.seat.sourceIds,noteSv: a.seat.noteSv };
  return { schemaVersion: 1,kind: 'historical',contentId,contentVersion: '1.0.0',calendar: 'proleptic-gregorian-no-year-zero',bookmarkDate: a.bookmarkDate,
    eraLabelSv: a.eraLabelSv,contextSv: a.contextSv,
    calendarNoteSv: 'Startdagen är vald för simuleringen. Källornas datering och kalenderkonventioner finns kvar i proveniensen.',
    coverageNoteSv: a.coverageNotePrefixSv + COVERAGE_BASE_NOTE_SV,
    sources: { ...a.sources },polities: [{ id: polityId,nameSv: a.polity.nameSv,sourceIds: a.polity.sourceIds,boundary: 'approximate',...a.polity.extra,noteSv: a.polity.noteSv }],
    playablePolityIds: [polityId],settlements: [seat],courtSeeds: { [polityId]: court({ polityId,seat,spec: a.court }) },
  };
}
