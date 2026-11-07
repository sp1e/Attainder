// Reviewed historical facts and explicit gameplay choices. AGPL-3.0-or-later.
// This module authors data only; runtime activation belongs to the start adapter.
import { claim,generated,mechanics,generatedPerson,generatedCourtiers,dossierCourt } from './dossier-courts.mjs';
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
const settlement = (seat,polityId) => ({ id: seat.id,nameSv: seat.nameSv,coordinates: seat.coordinates,polityId,regionId: seat.regionId,placement: seat.placement,sourceIds: seat.sourceIds,noteSv: seat.noteSv });

// spec.familyId names the ruling family, so two courts of one package never give one id to two houses.
function court({ polityId, seat, spec }) {
  const { religionId,rulerId,partnerId } = spec, rulingFamilyId = spec.familyId ?? 'royal-house';
  const person = (id,name,bornAt,familyId,sex) => generatedPerson(id,name,bornAt,familyId,religionId,sex);
  const people = [person(rulerId,spec.rulerName,spec.rulerBornAt,rulingFamilyId)];
  if (partnerId) {
    people.push(person(partnerId,spec.partnerName,spec.partnerBornAt,rulingFamilyId,'female'));
    people[0].spouseIds = [partnerId]; people[1].spouseIds = [rulerId];
  }
  for (const member of spec.household ?? []) people.push({ ...person(member.id,member.name,member.bornAt,rulingFamilyId,member.sex),legalParentIds: member.legalParentIds });
  spec.annotatePeople(people);
  const families = [{ id: rulingFamilyId,name: spec.familyName,headId: rulerId,religionId,color: '#bd9251',claims: { identity: generated('Hushållet är en administrativ spelgrupp; inga okända släktled påstås.') } }];
  const courtiers = generatedCourtiers(spec,religionId);
  people.push(...courtiers.people); families.push(...courtiers.families);
  // A family start preselects the first family, so this order decides who the player follows.
  if (spec.nonRulingFamiliesFirst) families.push(families.shift());
  const offices = [['ruler',spec.rulerOfficeName ?? 'Kung',rulerId],['general','Överbefälhavare','generated-courtier-1'],['chancellor','Kansler','generated-courtier-2'],['priest','Religiös företrädare','generated-courtier-3']].map(([id,name,holderId]) => ({ id,name,holderId,claims: { identity: id === 'ruler' && spec.rulerOfficeClaim ? spec.rulerOfficeClaim : generated('Ämbete och utnämning följer spelets regler.'), mechanics } }));
  return { polityId,rulerId,seatId: seat.id,...(spec.successionLaw ? { successionLaw: spec.successionLaw } : {}),people,families,offices,
    religions: [{ id: religionId,name: spec.religionName,leaderId: spec.religionLeaderId ?? 'generated-courtier-3',claims: { identity: spec.religionClaim, mechanics } }],
    cities: [{ id: seat.id,settlementId: seat.id,name: seat.nameSv,regionId: seat.regionId,familyId: rulingFamilyId,claims: { mechanics } }],
    mechanics: { status: 'generated',noteSv: 'Resurser, succession, familjegrupper, myndighetsålder och hovämbeten följer spelets regler. De beskriver inte belagda historiska värden.' },
    ...(spec.contextSv ? { contextSv: spec.contextSv,contextSourceIds: spec.contextSourceIds } : {}) };
}

// Charles's household on 25 December 800. Every fact comes from ad800-review.json; birth values are game values.
const evidence = (...ids) => ids.map(id => `regional-${id}`);
const CHARLEMAGNE_SOURCES = {
  hbm: { ...sources.hbm,locator: 'geojson/world_800.geojson; README: Polygons, Conceptual limitations, Credits; CONTRIBUTING: Precision',chronology: 'Snapshot label AD 800',retrievedAt: '2026-11-07' },
  naturalEarth: sources.naturalEarth,
  aachen: { ...source('Aachen, TGN 7004799','Getty Research Institute','https://www.getty.edu/vow/TGNFullDisplay?english=Y&find=Aachen&nation=Germany&place=inhabited+place&subjectid=7004799','Coordinates; vocabulary data-services terms','Modern inhabited-place reference','[6.1053,50.7708] marks the modern place, not a palace or a physical presence.','ODC-By-1.0; Getty Thesaurus of Geographic Names, Getty Research Institute'),retrievedAt: '2026-11-07' },
  rome: { ...source('Rome, TGN 7000874','Getty Research Institute','https://www.getty.edu/vow/TGNFullDisplay?english=Y&find=Rome&nation=&place=inhabited+place&subjectid=7000874','Coordinates; vocabulary data-services terms','Modern inhabited-place reference','[12.4833,41.9000] marks the modern place, not a papal frontier.','ODC-By-1.0; Getty Thesaurus of Geographic Names, Getty Research Institute'),retrievedAt: '2026-11-07' },
};
// Rome is a listed settlement of the package and the seat of the Papal States court; review settlements[0].
const ROME_800 = { id: 'rome',nameSv: 'Rom',coordinates: [12.4833,41.9],regionId: 'hbm-ad800-222',placement: 'inside',sourceIds: ['rome',...evidence('ce-papal-states','rfa-801-coronation','einhard-28')],noteSv: 'Ungefärlig ortsmarkör från Getty. Staden hör till påvens område på kartan. Karls rike har Aachen som spelsäte och Kyrkostaten har Rom. Karl var här på bokmärkets dag. Titeln patricius gav den dagen vika för kejsartiteln.' };
const DAUGHTER_SURVIVAL_SV = 'Einhards kapitel 19 anger att Karl förlorade tre barn och nämner inte henne bland dem. Kapitel 20 visar att barnlistan är ofullständig. Källorna namnger ingen överlevande dotter. Hennes plats är inte belagd.';
const hildegardsChild = (roleSv,...ids) => claim('sourced',`${roleSv} till Karl och Hildegard. Hildegard dog 783 och ingår inte i hovet.`,evidence('einhard-18','rfa-783-deaths',...ids));
const fastradasChild = claim('sourced','Dotter till Karl och, enligt Einhards ordföljd, Fastrada. Fastrada dog 794 och ingår inte i hovet.',evidence('einhard-18','rfa-794-fastrada'));
const unknownBirth = generated('Födelsedatumet är ett spelvärde; källorna ger inget datum.');
const CHARLEMAGNE_HOUSEHOLD = {
  karl: { roleSv: 'Frankernas och langobardernas kung; kröns till kejsare i Rom på bokmärkets dag.',identitySourceIds: evidence('rfa-801-coronation','einhard-28','rfa-814-death','einhard-30','rfa-783-deaths','rfa-index-pepin'),
    bornAt: claim('uncertain','Ingen födelsedag. Einhard: 72:a levnadsåret vid döden. Riksannalerna: omkring 71:a året. Den första januari 743 är ett spelvärde.',evidence('einhard-30','rfa-814-death')),
    kinship: claim('sourced','Son till kung Pippin och Bertrada. Bertrada dog 783. Ingen av dem ingår i hovet.',evidence('rfa-index-pepin','rfa-783-deaths')),
    spouseIds: claim('sourced','Ingen hustru vid starten. Liutgard dog i Tours 4 juni 800, och ingen citerad källa namnger en hustru på bokmärkets dag.',evidence('rfa-800-itinerary','einhard-18')) },
  'karl-den-yngre': { roleSv: 'Karls äldste son med Hildegard.',identitySourceIds: evidence('rfa-811-charles','hammer-2012','einhard-18'),bornAt: unknownBirth,kinship: hildegardsChild('Son') },
  'pippin-av-italien': { roleSv: 'Kung i Italien sedan 781, Karls son.',identitySourceIds: evidence('rfa-781-kings','rfa-800-italy','einhard-19','rfa-index-pippin','einhard-18','rfa-801-aftermath'),bornAt: unknownBirth,kinship: hildegardsChild('Son') },
  'ludvig-av-akvitanien': { roleSv: 'Kung i Akvitanien sedan 781, Karls son, senare kejsare.',identitySourceIds: evidence('rfa-781-kings','rfa-814-death','rfa-778-louis','bertin-840','einhard-18'),
    bornAt: claim('uncertain','Anteckning till påsken i Cassinoilum i slutet av posten för 777, ur en handskrift som inte längre går att spåra: född i Chasseneuil. Den första januari 778 är ett spelvärde.',evidence('rfa-778-louis')),
    kinship: hildegardsChild('Son','rfa-778-louis') },
  rotrud: { roleSv: 'Karls äldsta dotter.',identitySourceIds: evidence('rfa-810-rotrude','einhard-18','einhard-19'),bornAt: unknownBirth,kinship: hildegardsChild('Dotter') },
  berta: { roleSv: 'Karls dotter med Hildegard.',identitySourceIds: evidence('einhard-18','rfa-783-deaths','einhard-19','einhard-20'),
    bornAt: claim('generated','Inget datum. Modern dog 783. Den första januari 779 är ett spelvärde.',evidence('einhard-18','rfa-783-deaths')),kinship: hildegardsChild('Dotter'),
    survival: claim('uncertain',DAUGHTER_SURVIVAL_SV,evidence('einhard-18','rfa-783-deaths','einhard-19','einhard-20')) },
  gisela: { roleSv: 'Karls dotter med Hildegard.',identitySourceIds: evidence('einhard-18','rfa-781-kings','rfa-783-deaths','einhard-19','einhard-20'),
    bornAt: claim('generated','Inget datum. Döpt i Milano 781. Modern dog 783. Den första januari 780 är ett spelvärde.',evidence('rfa-781-kings','einhard-18','rfa-783-deaths')),kinship: hildegardsChild('Dotter'),
    survival: claim('uncertain',DAUGHTER_SURVIVAL_SV,evidence('einhard-18','rfa-781-kings','rfa-783-deaths','einhard-19','einhard-20')) },
  teoderada: { roleSv: 'Karls dotter med Fastrada.',identitySourceIds: evidence('einhard-18','rfa-794-fastrada','einhard-19','einhard-20'),
    bornAt: claim('generated','Inget datum. Modern dog 794. Den första januari 785 är ett spelvärde.',evidence('einhard-18','rfa-794-fastrada')),kinship: fastradasChild,
    survival: claim('uncertain',DAUGHTER_SURVIVAL_SV,evidence('einhard-18','rfa-794-fastrada','einhard-19','einhard-20')) },
  hiltrud: { roleSv: 'Karls dotter med Fastrada.',identitySourceIds: evidence('einhard-18','rfa-794-fastrada','einhard-19','einhard-20'),
    bornAt: claim('generated','Inget datum. Modern dog 794. Den första januari 787 är ett spelvärde.',evidence('einhard-18','rfa-794-fastrada')),kinship: fastradasChild,
    survival: claim('uncertain',DAUGHTER_SURVIVAL_SV,evidence('einhard-18','rfa-794-fastrada','einhard-19','einhard-20')) },
  ruodhaid: { roleSv: 'Karls dotter med en frilla vars namn Einhard inte minns.',identitySourceIds: evidence('einhard-18'),bornAt: unknownBirth,
    kinship: claim('sourced','Dotter till Karl med en frilla vars namn Einhard inte minns.',evidence('einhard-18')),
    survival: claim('uncertain','Einhard ger inget år. Hon nämns före Liutgard, men det visar inte att hon var född år 800.',evidence('einhard-18')) },
};
function annotateCharlemagneCourt(people) {
  for (const p of people) {
    const record = CHARLEMAGNE_HOUSEHOLD[p.id];
    if (!record) continue;
    p.identityOrigin = 'documented'; p.originLabelSv = 'Dokumenterad person; spelvärden är genererade';
    p.claims.identity = claim('sourced',record.roleSv,record.identitySourceIds);
    p.claims.bornAt = record.bornAt;
    p.claims.kinship = record.kinship;
    if (p.legalParentIds.length) p.claims.legalParentIds = claim('sourced','Karl är fadern enligt Einhard.',evidence('einhard-18'));
    if (record.spouseIds) p.claims.spouseIds = record.spouseIds;
    if (record.survival) p.claims.survival = record.survival;
  }
}

// Leo III's court on 25 December 800. Sourced facts come from the church record of ad800-review.json;
// the birth value, the household and the courtiers are generated.
function annotateLeoCourt(people) {
  const leo = people.find(p => p.id === 'leo-iii');
  leo.identityOrigin = 'documented'; leo.originLabelSv = 'Dokumenterad person; spelvärden är genererade';
  leo.claims.identity = claim('sourced','Biskop av Rom sedan 795.',evidence('ce-leo3','osborne-rome','rfa-801-coronation'));
  leo.claims.bornAt = generated('Ingen källa ger födelseår. Den första januari 750 är ett spelvärde.');
}
// Merit is the engine's closest analogue to a papal election; a later phase adds an elective law.
const PAPAL_STATES_800 = { polityId: 'papal-states',seat: ROME_800,successionLaw: 'merit',
  court: {
    religionId: 'latin-church',rulerId: 'leo-iii',partnerId: null,household: [],
    rulerName: 'Leo III',rulerBornAt: '0750-01-01',rulerOfficeName: 'Påve',familyId: 'leo-household',familyName: 'Leos hushåll',
    nonRulingFamiliesFirst: true,
    courtierNames: ['Sergius (genererad)','Johannes (genererad)','Theodorus (genererad)'],courtierBornAt: i => `0${755+i}-01-01`,
    annotatePeople: annotateLeoCourt,
    rulerOfficeClaim: claim('sourced','Leo III valdes till påve den 26 december 795.',evidence('ce-leo3')),
    contextSv: 'Påven Leo III kröner Karl till kejsare i Rom på juldagen. Kyrkostaten har Rom som spelsäte. Leo III valdes till påve i december 795.',
    contextSourceIds: evidence('rfa-801-coronation','osborne-rome','ce-leo3'),
    religionName: 'Den latinska kyrkan',religionLeaderId: 'leo-iii',
    religionClaim: claim('sourced','Leo III, biskop av Rom sedan 795, krönte Karl vid julmässan. Kyrkans spelorganisation är förenklad.',evidence('ce-leo3','rfa-801-coronation')),
  },
};

// The eight reviewed AD 800 dossier courts, in dossier order. Each court is built from courts/ad800-courts.json;
// the succession law and the three generated courtiers (courtier-names.md) are game choices.
// options pass on to dossierCourt; { religionLeader: null } leaves the religion without a leader.
const dossierPlayable = (polityId,successionLaw,courtierNames,courtierYears,options = {}) => ({ polityId,successionLaw,
  dossier: { courtierNames: courtierNames.map(name => `${name} (genererad)`),courtierBornAt: i => `${String(courtierYears[i-1]).padStart(4,'0')}-01-01`,...options } });
const AD800_DOSSIER_PLAYABLES = [
  dossierPlayable('tang-empire','primogeniture',['Zhao Huaiyuan','Li Shouyi','Chen Junzhi'],[760,764,768]),
  dossierPlayable('abbasid-caliphate','merit',['Sa\'id ibn Mansur','Ali ibn Hamza','Hasan ibn Ziyad'],[758,763,767]),
  dossierPlayable('byzantine-empire','merit',['Bardas Ioannou','Stephanos Kalokyres','Theodotos Melissenos'],[757,762,770]),
  dossierPlayable('silla','primogeniture',['Kim Yeong-jong','Pak Sun-won','Seol Gye-hun'],[762,765,768]),
  dossierPlayable('emirate-of-cordoba','primogeniture',['Sulayman ibn Umar','Yahya ibn Hakam','Isa ibn Faraj'],[759,764,769]),
  dossierPlayable('aghlabid-emirate','primogeniture',['Asad ibn Musa','Muhammad ibn Salim','Abd Allah ibn Rashid'],[758,761,766]),
  dossierPlayable('kingdom-of-asturias','merit',['Gundemaro','Sisnando','Teodomiro'],[760,763,771]),
  dossierPlayable('duchy-of-benevento','merit',['Ansfrid','Rodoald','Garibald'],[756,762,767]),
];
// The three reviewed AD 1200 dossier courts in the ruled order; Western Xia and Chimú stay blocked in the dossier.
const AD1200_DOSSIER_PLAYABLES = [
  dossierPlayable('khmer-angkor','merit',['Mratan Shivadasa','Mratan Rudrapala','Vap Kirtindra'],[1160,1165,1170]),
  dossierPlayable('almohad','merit',['Ali ibn Yintan','Umar ibn Wakkak','Abd al-Haqq ibn Ziyad'],[1158,1163,1168]),
  dossierPlayable('france-capetian','primogeniture',['Hugues de Montfort','Raoul de Beaumont','Pierre de Chaumont'],[1157,1162,1166]),
];
// "A, B och C"
const listSv = names => `${names.slice(0,-1).join(', ')} och ${names.at(-1)}`;

const COVERAGE_BASE_NOTE_SV = 'Världens land visas med en generaliserad nutida kustlinje. Granskade historiska områden har ungefärliga gränser. Okänd kontroll betyder att underlag saknas, inte att marken är obebodd eller ledig.';
// The AD 800 wording of the base note; later packages share it.
const COVERAGE_BASE_NOTE_AD800_SV = 'Världens land visas med en generaliserad nutida kustlinje. Granskade historiska områden har ungefärliga gränser. Okänd kontroll betyder att underlag saknas och säger inget om marken var bebodd eller ledig.';

// The AD 1500 courts come from courts/ad1500-courts.json; Aztekriket is primary because it comes first there.
// The dossier names no temple leader on the bookmark, so the Aztec religion has none.
const WORLD_1500_SOURCES = {
  hbm: { ...sources.hbm,locator: 'geojson/world_1500.geojson; README: Polygons, Conceptual limitations, Credits; CONTRIBUTING: Precision',chronology: 'Snapshot label AD 1500',retrievedAt: '2026-11-07' },
  naturalEarth: { ...sources.naturalEarth,uncertainty: 'Physical reference only; neither the coastline of 1500 nor proof of settlement or sovereignty.',retrievedAt: '2026-11-07' },
};
const AZTEC_1500 = dossierPlayable('aztec-empire','merit',['Itztli','Cuetzpalin','Mazatl'],[1458,1462,1467],{ religionLeader: null });
const INCA_1500 = dossierPlayable('inca-empire','primogeniture',['Kuntur Rimaq','Qori Puma','Rumi Sunqu'],[1456,1461,1466]);

// One authored record per package. Everything that differs between packages lives here.
// extraPlayables: further playable polities as { polityId, seat, court, successionLaw? }; seat has the primary seat's fields.
// A dossier playable is { polityId, successionLaw, dossier: { courtierNames, courtierBornAt, religionLeader? } } and takes its seat and court from the dossier.
// The primary may be one too: the package then carries successionLaw and dossier in place of seat and court.
// contextSv and coverageNotePrefixSv may be functions of the playable polity names; namePlayables() fills them in.
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
    sources,polityId: 'johns-realms',contentVersion: '1.1.0',bookmarkDate: '1200-12-31',eraLabelSv: '1200 e.Kr.',
    seat: { id: 'windsor',nameSv: 'Windsor',coordinates: [-0.6,51.4833],regionId: 'hbm-ad1200-275',placement: 'inside',sourceIds: ['windsor','windsorResidence'],noteSv: 'Ungefärlig ortsmarkör. Vald som spelsäte; kungaparets närvaro denna dag är inte belagd.' },
    extraPlayables: AD1200_DOSSIER_PLAYABLES,
    contextSv: names => `Nyårsafton 1200. Spelbara riken: ${listSv(names)}. Du möter dokumenterade personer med genererade spelvärden och genererade hovmän.`,
    coverageNotePrefixSv: names => `${names.length} riken är spelbara. `,
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
      contextSv: 'Johan av England efter äktenskapet med Isabella. Dokumenterade identiteter, ungefärliga födelsedatum och genererade hovmän.',
      contextSourceIds: ['john','isabella'],
      religionClaim: claim('sourced','Kunglig kröning vid Westminster; kyrkans spelorganisation är förenklad.',['john']),
    },
  },
  'charlemagne-800': {
    sources: CHARLEMAGNE_SOURCES,polityId: 'carolingian-realm',contentVersion: '1.2.0',bookmarkDate: '0800-12-25',eraLabelSv: '800 e.Kr.',
    seat: { id: 'aachen',nameSv: 'Aachen',coordinates: [6.1053,50.7708],regionId: 'hbm-ad800-151',placement: 'inside',sourceIds: ['aachen',...evidence('rfa-800-itinerary','rfa-801-coronation','einhard-28')],noteSv: 'Ungefärlig ortsmarkör från Getty. Vald som spelsäte. Karl lämnade Aachen i mars 800 och återvände under året, men på bokmärkets dag var han i Rom.' },
    otherSettlements: [settlement(ROME_800,'papal-states')],
    extraPlayables: [PAPAL_STATES_800,...AD800_DOSSIER_PLAYABLES],
    contextSv: names => `Juldagen år 800. Spelbara riken: ${listSv(names)}. Du möter dokumenterade personer med genererade spelvärden och genererade hovmän.`,
    calendarNoteSuffixSv: ' Riksannalerna räknar året från jul och för kröningen under 801.',
    coverageNotePrefixSv: names => `Av 225 former i källkartan har 11 godkänts som ungefärliga områden. ${names.length} riken är spelbara. Karls hov visar Bertas, Giselas, Teoderadas, Hiltruds och Ruodhaids överlevnad som osäker. Leo III:s födelsedatum och hovmän är genererade. `,
    coverageBaseNoteSv: COVERAGE_BASE_NOTE_AD800_SV,
    polity: { nameSv: 'Karls rike (karolingiska riket)',sourceIds: ['hbm',...evidence('einhard-15','rfa-781-kings','rfa-800-itinerary','rfa-800-italy','rfa-797-barcelona','rfa-801-barcelona','rfa-799-brittany','rfa-806-venice','rfa-810-venice','rfa-810-treaty','rfa-801-aftermath','ce-papal-states')],extra: {},noteSv: 'Spelaggregat över Karls områden. Pippin och Ludvig smordes 781 till kungar i Italien och Akvitanien. Likformigt styre är inte belagt, och kartan ger ingen exakt gräns.' },
    court: {
      religionId: 'latin-church',rulerId: 'karl',partnerId: null,
      rulerName: 'Karl (Karl den store)',rulerBornAt: '0743-01-01',rulerOfficeName: 'Kejsare',familyName: 'Karls hus',
      household: [
        { id: 'karl-den-yngre',name: 'Karl den yngre',bornAt: '0772-01-01',sex: 'male',legalParentIds: ['karl'] },
        { id: 'pippin-av-italien',name: 'Pippin av Italien',bornAt: '0776-01-01',sex: 'male',legalParentIds: ['karl'] },
        { id: 'ludvig-av-akvitanien',name: 'Ludvig av Akvitanien',bornAt: '0778-01-01',sex: 'male',legalParentIds: ['karl'] },
        { id: 'rotrud',name: 'Rotrud',bornAt: '0778-07-01',sex: 'female',legalParentIds: ['karl'] },
        { id: 'berta',name: 'Berta',bornAt: '0779-01-01',sex: 'female',legalParentIds: ['karl'] },
        { id: 'gisela',name: 'Gisela',bornAt: '0780-01-01',sex: 'female',legalParentIds: ['karl'] },
        { id: 'teoderada',name: 'Teoderada',bornAt: '0785-01-01',sex: 'female',legalParentIds: ['karl'] },
        { id: 'hiltrud',name: 'Hiltrud',bornAt: '0787-01-01',sex: 'female',legalParentIds: ['karl'] },
        { id: 'ruodhaid',name: 'Ruodhaid',bornAt: '0788-01-01',sex: 'female',legalParentIds: ['karl'] },
      ],
      nonRulingFamiliesFirst: true,
      courtierNames: ['Odo (genererad)','Ansgar (genererad)','Rikulf (genererad)'],courtierBornAt: i => `0${750+i}-01-01`,
      annotatePeople: annotateCharlemagneCourt,
      rulerOfficeClaim: claim('sourced','Leo III satte kronan på Karl vid julmässan i Rom. Titeln patricius gav den dagen vika för kejsartiteln.',evidence('rfa-801-coronation','einhard-28')),religionName: 'Den latinska kyrkan',
      contextSv: 'Påven Leo III kröner Karl till kejsare i Rom på juldagen. Karl stannar där hela vintern. Karls rike har Aachen som spelsäte. Karls hustru Liutgard dog samma år. I spelet har Karls hov ingen kejsarinna.',
      contextSourceIds: evidence('rfa-801-coronation','osborne-rome','einhard-28','rfa-800-itinerary'),
      religionClaim: claim('sourced','Leo III, biskop av Rom sedan 795, krönte Karl. Leo angreps i Rom 25 april 799 och sökte upp Karl i Paderborn. I december 800 hördes anklagelser mot honom i Rom inför Karl. Ingen anklagare styrkte dem och Leo svor sig fri två dagar före kröningen. Hovets religiösa företrädare vid starten är genererad.',evidence('ce-leo3','osborne-rome','adelson-baker','rfa-800-rome','rfa-801-coronation')),
    },
  },
  // The builder replaces the polity's sourceIds and noteSv with the review's mapping of feature 80.
  'world-1500': {
    sources: WORLD_1500_SOURCES,...AZTEC_1500,bookmarkDate: '1500-12-31',eraLabelSv: '1500 e.Kr.',
    extraPlayables: [INCA_1500],
    contextSv: names => `Nyårsafton 1500. Spelbara riken: ${listSv(names)}. Du möter dokumenterade personer med genererade spelvärden och genererade hovmän.`,
    coverageNotePrefixSv: names => `Av 291 former i källkartan har 2 godkänts som ungefärliga områden. Mingriket och Osmanska riket saknar godkänd form och är inte spelbara. ${names.length} riken är spelbara. `,
    coverageBaseNoteSv: COVERAGE_BASE_NOTE_AD800_SV,
    polity: { nameSv: 'Aztekriket',sourceIds: ['hbm'],extra: {},noteSv: 'Ungefärligt område i källkartan.' },
  },
};

// An extra playable's seat may already be a listed settlement (Rome); it is then emitted once, from that list.
function extraSeats(a,seats) {
  const others = a.otherSettlements ?? [];
  return (a.extraPlayables ?? []).flatMap(e => {
    const seat = seats[e.polityId], listed = others.find(s => s.id === seat.id);
    if (listed && JSON.stringify(listed) !== JSON.stringify(seat)) throw new Error(`Seat ${seat.id} of ${e.polityId} differs from its listed settlement`);
    return listed ? [] : [seat];
  });
}

// A family start preselects the first family; a dossier court puts its generated houses first, so the player
// follows a generated courtier and never a documented household that may have no heirs.
const generatedHousesFirst = families => [...families.filter(f => f.id.startsWith('generated-house-')),...families.filter(f => !f.id.startsWith('generated-house-'))];

// Two dossier courts may cite one source; they must then carry the same record.
function addDossierSources(target,sources) {
  for (const [id,record] of Object.entries(sources)) {
    if (Object.hasOwn(target,id) && JSON.stringify(target[id]) !== JSON.stringify(record)) throw new Error(`Dossier source ${id} differs between courts`);
    target[id] = record;
  }
}

// The court of a dossier playable. Its mechanics note adds the dossier's own lines on what the game simplifies.
function dossierPlayableCourt(e,dossier,bookmarkYear,sources) {
  if (!dossier) throw new Error(`${e.polityId}: a dossier playable needs the dossier file`);
  const built = dossierCourt({ dossier,polityId: e.polityId,bookmarkYear,successionLaw: e.successionLaw,...e.dossier });
  addDossierSources(sources,built.sources);
  const court = { ...built.court,families: generatedHousesFirst(built.court.families),
    mechanics: { ...built.court.mechanics,noteSv: [built.court.mechanics.noteSv,...built.coverageLinesSv].join(' ') },
    contextSv: built.contextSv,contextSourceIds: built.contextSourceIds };
  return { seat: built.seat,court };
}

// Playable polities: the primary first, then each extra in authored order. An extra playable takes its polity
// record and map feature from the review file; the builder adds both.
// dossier: the parsed court dossier, required when the package has dossier playables.
export function authoredScenario(contentId,{ dossier = null } = {}) {
  if (!Object.hasOwn(AUTHORED_PACKAGES,contentId)) throw new Error(`Unknown historical scenario: ${contentId}`);
  const a = AUTHORED_PACKAGES[contentId], polityId = a.polityId, extras = a.extraPlayables ?? [], year = Number(a.bookmarkDate.slice(0,4));
  const calendarNoteSv = 'Startdagen är vald för simuleringen. Källornas datering och kalenderkonventioner finns kvar i proveniensen.' + (a.calendarNoteSuffixSv ?? '');
  const sources = { ...a.sources }, seats = {};
  // A dossier primary builds exactly as a dossier extra does, before the extras, so its sources come first.
  const primary = a.dossier ? dossierPlayableCourt(a,dossier,year,sources) : null, seat = primary?.seat ?? settlement(a.seat,polityId);
  const courtSeeds = { [polityId]: primary?.court ?? court({ polityId,seat,spec: a.court }) };
  for (const e of extras) {
    if (e.dossier) ({ seat: seats[e.polityId],court: courtSeeds[e.polityId] } = dossierPlayableCourt(e,dossier,year,sources));
    else { seats[e.polityId] = settlement(e.seat,e.polityId); courtSeeds[e.polityId] = court({ polityId: e.polityId,seat: seats[e.polityId],spec: { ...e.court,successionLaw: e.successionLaw } }); }
  }
  const namedLater = typeof a.contextSv === 'function';
  return { schemaVersion: 1,kind: 'historical',contentId,contentVersion: a.contentVersion ?? '1.0.0',calendar: 'proleptic-gregorian-no-year-zero',bookmarkDate: a.bookmarkDate,
    eraLabelSv: a.eraLabelSv,contextSv: namedLater ? null : a.contextSv,
    calendarNoteSv,
    coverageNoteSv: namedLater ? null : a.coverageNotePrefixSv + (a.coverageBaseNoteSv ?? COVERAGE_BASE_NOTE_SV),
    sources,polities: [{ id: polityId,nameSv: a.polity.nameSv,sourceIds: a.polity.sourceIds,boundary: 'approximate',...a.polity.extra,noteSv: a.polity.noteSv }],
    playablePolityIds: [polityId,...extras.map(e => e.polityId)],settlements: [seat,...extraSeats(a,seats),...(a.otherSettlements ?? [])],courtSeeds,
  };
}

// The package texts that name the playable polities. The builder calls this once every polity record is in place.
export function namePlayables(h) {
  const a = AUTHORED_PACKAGES[h.contentId];
  if (typeof a.contextSv !== 'function') return;
  const names = h.playablePolityIds.map(id => {
    const polity = h.polities.find(p => p.id === id);
    if (!polity) throw new Error(`${h.contentId}: playable polity ${id} has no polity record`);
    return polity.nameSv;
  });
  h.contextSv = a.contextSv(names);
  h.coverageNoteSv = a.coverageNotePrefixSv(names) + (a.coverageBaseNoteSv ?? COVERAGE_BASE_NOTE_SV);
}
