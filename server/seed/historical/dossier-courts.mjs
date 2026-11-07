// Turns one reviewed court dossier polity (courts/*.json) into the court shape court() in
// authored-scenarios.mjs produces. Pure: the caller reads the dossier file. AGPL-3.0-or-later.

// One fixed sentence per dossier engine limit. They describe game rules, not history, so they cite no source.
export const ENGINE_LIMIT_TEXT_SV = Object.freeze({
  'female-ruler-succession': 'Spelets tronföljd är könsneutral. Den återger inte de särskilda villkor som gällde när en kvinna regerade ensam.',
  'eunuch-status': 'Spelet saknar eunuckstatus och behandlar eunucker som andra hovmän.',
  regency: 'En vuxen förmyndare styr i härskarens namn tills härskaren blir myndig. Spelets regler väljer förmyndaren.',
  'elective-rule': 'Spelet har ingen valordning för tronen. Efterträdaren utses enligt spelets arvslag.',
  'no-sourced-household': 'Underlaget belägger inget hushåll vid hovet. De tre hovmännen är genererade för spelet.',
  'multiple-spouses': 'Spelet tillåter en make eller maka per person. Hovet visar högst ett äktenskap för varje person.',
});

// Shared with court() in authored-scenarios.mjs, so hand-authored and dossier courts stay alike.
export const claim = (status,noteSv,sourceIds = []) => ({ status,noteSv,sourceIds });
export const generated = note => claim('generated',note);
export const mechanics = generated('Spelvärden, personlighet och ämbetsregler är skapade för simuleringen.');
const MECHANICS = () => ({ archetype: 'steward',traits: ['dutiful'],skills: { command: 5,stewardship: 6,diplomacy: 5,learning: 5,intrigue: 4,prowess: 4 } });
export const DOCUMENTED_LABEL_SV = 'Dokumenterad person; spelvärden är genererade';
const STATUS_RANK = { generated: 0,uncertain: 1,sourced: 2 };
const HOUSEHOLD_COLORS = ['#7f8c5a','#8c6a5a','#5a7a8c','#8c5a7f'];
const SOURCE_FIELDS = ['title','institution','url','locator','chronology','uncertainty','license','retrievedAt'];
// Dossier relation words, rendered as "<person>: <phrase> <other>.".
const RELATION_SV = { father: 'far till',mother: 'mor till',parent: 'förälder till',son: 'son till',daughter: 'dotter till',child: 'barn till',
  wife: 'hustru till',husband: 'make till',widow: 'änka efter',widower: 'änkling efter',brother: 'bror till',sister: 'syster till',
  nephew: 'brors- eller systerson till',niece: 'brors- eller systerdotter till',uncle: 'farbror eller morbror till',aunt: 'faster eller moster till',cousin: 'kusin till' };
// Words that name a parent tie or a marriage, seen from the person (own) or from the other person (reverse).
const PARENT_WORDS = { own: ['son','daughter','child'],reverse: ['father','mother','parent'] };
const SPOUSE_WORDS = { own: ['wife','husband','spouse'],reverse: ['wife','husband','spouse'] };

export function dossierPolity(dossier,polityId) {
  const polity = dossier?.polities?.find(p => p.polityId === polityId);
  if (polity?.status !== 'ready') throw new Error(`dossier polity ${polityId} is not ready`);
  return polity;
}

function relationPhrase(entry,subject) {
  if (entry.relation === 'spouse') return subject.sex === 'female' ? 'maka till' : 'make till';
  const phrase = RELATION_SV[entry.relation];
  if (!phrase) throw new Error(`dossier person ${subject.id} has unknown kinship relation ${entry.relation}`);
  return phrase;
}
const entryNote = (entry,subject) => [`${subject.nameSv}: ${relationPhrase(entry,subject)} ${entry.ofSv}.`,entry.noteSv].filter(Boolean).join(' ');

// Merges kinship entries: every source id, the weakest status, the notes joined.
function mergedClaim(pairs) {
  const status = pairs.map(([e]) => e.status).reduce((a,b) => STATUS_RANK[b] < STATUS_RANK[a] ? b : a);
  const sourceIds = [...new Set(pairs.flatMap(([e]) => e.sourceIds))];
  return claim(status,pairs.map(([e,subject]) => entryNote(e,subject)).join(' '),sourceIds);
}

// The entries on either side of the tie that name it; without one, the identity sources carry an uncertain claim.
function relationClaim(p,ids,words,byId) {
  const unknown = ids.find(id => !byId.has(id));
  if (unknown) throw new Error(`dossier person ${p.id} names ${unknown}, who is not in the court`);
  const own = p.kinship.filter(k => ids.includes(k.ofPersonId) && words.own.includes(k.relation)).map(k => [k,p]);
  const reverse = ids.flatMap(id => byId.get(id).kinship.filter(k => k.ofPersonId === p.id && words.reverse.includes(k.relation)).map(k => [k,byId.get(id)]));
  const pairs = [...own,...reverse];
  if (pairs.length) return mergedClaim(pairs);
  return claim('uncertain','Ingen släktpost i underlaget namnger relationen. Stödet är personens identitetskällor, och relationen räknas därför som osäker.',p.identity.sourceIds);
}

function kinshipClaim(p) {
  if (!p.kinship.length) return generated('Underlaget har ingen egen släktpost för personen. Familjegruppen är en spelabstraktion.');
  return mergedClaim(p.kinship.map(k => [k,p]));
}

function documentedPerson(p,familyId,religionId,byId) {
  if (p.identity.status !== 'sourced') throw new Error(`dossier person ${p.id} has no sourced identity`);
  const claims = { identity: claim('sourced',[p.roleSv.endsWith('.') ? p.roleSv : `${p.roleSv}.`,p.identity.noteSv].filter(Boolean).join(' '),p.identity.sourceIds),
    bornAt: claim(p.birth.status,p.birth.noteSv,p.birth.sourceIds),kinship: kinshipClaim(p) };
  if (p.legalParentIds.length) claims.legalParentIds = relationClaim(p,p.legalParentIds,PARENT_WORDS,byId);
  if (p.spouseIds.length) claims.spouseIds = relationClaim(p,p.spouseIds,SPOUSE_WORDS,byId);
  claims.mechanics = mechanics;
  return { id: p.id,name: p.nameSv,bornAt: p.birth.gameValue,familyId,sex: p.sex,religionId,identityOrigin: 'documented',originLabelSv: DOCUMENTED_LABEL_SV,
    legalParentIds: [...p.legalParentIds],spouseIds: [...p.spouseIds],claims,mechanics: MECHANICS() };
}

export function generatedPerson(id,name,bornAt,familyId,religionId,sex = 'male') {
  return { id,name,bornAt,familyId,sex,religionId,identityOrigin: 'generated',originLabelSv: 'Genererad person',legalParentIds: [],spouseIds: [],
    claims: { identity: generated('Personen och namnet är genererade.'),bornAt: generated('Födelsedatumet är ett spelvärde.'),
      kinship: generated('Inga dokumenterade föräldrar läggs till; familjegruppen är en spelabstraktion.'),mechanics },
    mechanics: MECHANICS() };
}

// The ruler and everyone tied to the ruler by parentage, marriage or a kinship entry, transitively.
function rulingKin(people,rulerId) {
  const links = new Map(people.map(p => [p.id,new Set()]));
  const link = (a,b) => { if (links.has(a) && links.has(b)) { links.get(a).add(b); links.get(b).add(a); } };
  // A kinship entry may name someone outside the court (ofPersonId null or an absent relative); link() skips
  // that id, because the family can only gather people the court holds.
  for (const p of people) [...p.legalParentIds,...p.spouseIds,...p.kinship.map(k => k.ofPersonId).filter(Boolean)].forEach(id => link(p.id,id));
  const kin = new Set([rulerId]), queue = [rulerId];
  while (queue.length) for (const id of links.get(queue.shift())) if (!kin.has(id)) { kin.add(id); queue.push(id); }
  return kin;
}

function familiesFor(polity,ruler,religionId) {
  const kin = rulingKin(polity.people,ruler.id), rulingFamilyId = `${ruler.id}-house`;
  const families = [{ id: rulingFamilyId,name: `${ruler.nameSv}s hus`,headId: ruler.id,religionId,color: '#bd9251',
    claims: { identity: generated('Hushållet är en administrativ spelgrupp; inga okända släktled påstås.') } }];
  const familyOf = new Map();
  for (const p of polity.people) {
    if (kin.has(p.id)) { familyOf.set(p.id,rulingFamilyId); continue; }
    const id = `${p.id}-household`;
    familyOf.set(p.id,id);
    families.push({ id,name: `${p.nameSv}s hushåll`,headId: p.id,religionId,color: HOUSEHOLD_COLORS[(families.length - 1) % HOUSEHOLD_COLORS.length],
      claims: { identity: generated('Hushållet är en spelgrupp. Underlaget belägger inget hushåll för personen.') } });
  }
  return { families,familyOf,rulingFamilyId };
}

// Three generated courtiers, each heading a generated house; they hold the general, chancellor and priest offices.
export function generatedCourtiers({ courtierNames,courtierBornAt },religionId) {
  if (!Array.isArray(courtierNames) || courtierNames.length !== 3) throw new Error('a court needs three generated courtier names');
  const people = [], families = [];
  for (let i = 1; i <= 3; i++) {
    const id = `generated-courtier-${i}`, familyId = `generated-house-${i}`;
    people.push(generatedPerson(id,courtierNames[i-1],courtierBornAt(i),familyId,religionId));
    families.push({ id: familyId,name: `Hovhus ${i} (genererat)`,headId: id,religionId,color: ['#93594d','#567b82','#776c91'][i-1],
      claims: { identity: generated('Hovfamilj utan påstådd historisk identitet eller genealogi.') } });
  }
  return { people,families };
}

function officesFor(polity,rulerId) {
  const title = polity.titleClaim;
  const titleClaim = claim(title.status,title.noteSv ?? `Ämbetsnamnet ${polity.rulerTitleSv} återger härskarens titel i källorna.`,title.sourceIds);
  return [['ruler',polity.rulerTitleSv,rulerId],['general','Överbefälhavare','generated-courtier-1'],['chancellor','Kansler','generated-courtier-2'],['priest','Religiös företrädare','generated-courtier-3']]
    .map(([id,name,holderId]) => ({ id,name,holderId,claims: { identity: id === 'ruler' ? titleClaim : generated('Ämbete och utnämning följer spelets regler.'),mechanics } }));
}

function seatFor(polity,polityId,bookmarkYear) {
  const s = polity.seat;
  return { id: s.settlementId,nameSv: s.nameSv,coordinates: [...s.coordinates],polityId,regionId: `hbm-ad${bookmarkYear}-${polity.sourceFeatureIndexes[0]}`,
    placement: 'inside',sourceIds: [...s.sourceIds],noteSv: s.noteSv };
}

function citedSourceIds(court,seat,contextSourceIds) {
  const cited = new Set([...seat.sourceIds,...contextSourceIds]);
  for (const entry of ['people','families','offices','religions','cities'].flatMap(k => court[k])) {
    for (const c of Object.values(entry.claims)) c.sourceIds.forEach(id => cited.add(id));
  }
  return [...cited];
}

// Dossier sources lack the validator's review field; the polity's review block supplies it.
function sourcesFor(dossier,polity,ids) {
  const { review } = polity;
  if (review?.status !== 'checked') throw new Error(`dossier polity ${polity.polityId} review is not checked`);
  return Object.fromEntries(ids.map(id => {
    const s = dossier.sources[id];
    if (!s) throw new Error(`dossier polity ${polity.polityId} cites unknown source ${id}`);
    const missing = SOURCE_FIELDS.find(k => typeof s[k] !== 'string' || !s[k].trim());
    if (missing) throw new Error(`dossier source ${id} lacks ${missing}`);
    const record = Object.fromEntries(SOURCE_FIELDS.map(k => [k,s[k]]));
    return [id,{ ...record,review: `Dossier review: checked by ${review.checkedBy} on ${review.checkedOn}.` }];
  }));
}

function coverageLines(polity) {
  const notes = [polity.successionNoteSv,polity.engineLimitNoteSv,polity.engineRepresentationNoteSv].filter(Boolean);
  return [...notes,...(polity.engineLimits ?? []).map(id => {
    if (!ENGINE_LIMIT_TEXT_SV[id]) throw new Error(`dossier polity ${polity.polityId} has unknown engine limit ${id}`);
    return ENGINE_LIMIT_TEXT_SV[id];
  })];
}

function courtFor(polity,polityId,seat,{ successionLaw,courtierNames,courtierBornAt }) {
  const rulers = polity.people.filter(p => p.isRuler);
  if (rulers.length !== 1) throw new Error(`dossier polity ${polityId} needs exactly one ruler`);
  const ruler = rulers[0], religion = polity.religion, religionId = religion.id;
  const byId = new Map(polity.people.map(p => [p.id,p]));
  const { families,familyOf,rulingFamilyId } = familiesFor(polity,ruler,religionId);
  const people = polity.people.map(p => documentedPerson(p,familyOf.get(p.id),religionId,byId));
  const courtiers = generatedCourtiers({ courtierNames,courtierBornAt },religionId);
  people.push(...courtiers.people); families.push(...courtiers.families);
  return { polityId,rulerId: ruler.id,seatId: seat.id,...(successionLaw ? { successionLaw } : {}),people,families,offices: officesFor(polity,ruler.id),
    religions: [{ id: religionId,name: religion.nameSv,leaderId: religion.leaderPersonId ?? 'generated-courtier-3',
      claims: { identity: claim(religion.status,religion.claimSv,religion.sourceIds),mechanics } }],
    cities: [{ id: seat.id,settlementId: seat.id,name: seat.nameSv,regionId: seat.regionId,familyId: rulingFamilyId,claims: { mechanics } }],
    mechanics: { status: 'generated',noteSv: 'Resurser, succession, familjegrupper, myndighetsålder och hovämbeten följer spelets regler. De beskriver inte belagda historiska värden.' } };
}

export function dossierCourt({ dossier,polityId,bookmarkYear,successionLaw,courtierNames,courtierBornAt }) {
  const polity = dossierPolity(dossier,polityId);
  const seat = seatFor(polity,polityId,bookmarkYear);
  const court = courtFor(polity,polityId,seat,{ successionLaw,courtierNames,courtierBornAt });
  const contextSourceIds = [...polity.contextSourceIds];
  return { seat,court,sources: sourcesFor(dossier,polity,citedSourceIds(court,seat,contextSourceIds)),
    contextSv: polity.contextSv,contextSourceIds,coverageLinesSv: coverageLines(polity) };
}
