/*! Attainder historical content schema. AGPL-3.0-or-later (see LICENSE). */
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { validateHistoricalStartDate } from './historicalStarts.js';
import { compareGameDates, parseGameDate, formatGameDate } from './gameDates.js';
import { ARCHETYPES, TRAITS, SKILL_LABELS } from './characters/content.js';

export const HISTORICAL_SCHEMA_VERSION = 1;
export const isHistoricalWorld = world => world?.historicalScenario?.kind === 'historical';
const record = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const text = x => typeof x === 'string' && x.trim().length > 0;
const list = x => Array.isArray(x) ? x : [];
const unique = xs => xs.length === new Set(xs).size;
const failure = code => ({ ok: false, code, error: 'Det historiska scenariot saknar giltiga källor, kartdata eller hov för den valda starten.' });
const polygons = g => g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : [];
const coordinate = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;
const ids = xs => list(xs).map(x => x?.id);
const validIds = xs => Array.isArray(xs) && xs.length > 0 && ids(xs).every(text) && unique(ids(xs));

export function validHistoricalGeometry(geometry) {
  const components = polygons(geometry);
  return components.length > 0 && components.every(p => Array.isArray(p) && p.length > 0 && p.every(r =>
    Array.isArray(r) && r.length >= 4 && r.every(coordinate)
    && r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1]
    && new Set(r.map(x => x.join(','))).size >= 3));
}

// Select the largest component first. A whole-feature bbox puts Tonga near 0°.
// Centers are display anchors, never evidence for a capital or political control.
export function historicalGeometryCenter(geometry) {
  let best = null, size = -1;
  for (const p of polygons(geometry)) {
    const ring = p?.[0];
    if (!ring?.length) continue;
    const xs = ring.map(c => c[0]), ys = ring.map(c => c[1]);
    const bounds = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    const area = (bounds[2] - bounds[0]) * (bounds[3] - bounds[1]);
    if (area > size) { size = area; best = [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2]; }
  }
  return best;
}

function validSources(sources) {
  return record(sources) && Object.keys(sources).length > 0 && Object.values(sources).every(s =>
    record(s) && ['title','institution','url','locator','retrievedAt','license','chronology','uncertainty','review'].every(k => text(s[k]))
    && /^https:\/\//.test(s.url) && /^\d{4}-\d{2}-\d{2}$/.test(s.retrievedAt));
}
const sourceRefs = (refs, sources, allowEmpty = false) => Array.isArray(refs) && (allowEmpty || refs.length > 0)
  && unique(refs) && refs.every(id => Object.hasOwn(sources, id));
function validClaims(claims, sources) {
  return record(claims) && Object.keys(claims).length > 0 && Object.values(claims).every(c =>
    record(c) && ['sourced','uncertain','generated'].includes(c.status) && text(c.noteSv)
    && sourceRefs(c.sourceIds, sources, c.status === 'generated'));
}
// Biography uses the shared calendar, not the permitted new-campaign year range.
const validBirth = (value,date) => typeof value === 'string' && /^-?\d{1,6}-\d{2}-\d{2}$/.test(value)
  && formatGameDate(parseGameDate(value)) === value && compareGameDates(value,date) <= 0;
// A documented person's family ties read as history, so a generated claim cannot carry them.
const claimedRelation = (p, key) => !p[key].length
  || (Object.hasOwn(p.claims,key) && (p.identityOrigin !== 'documented' || p.claims[key].status !== 'generated'));
const validLabel = p => p.identityOrigin === 'generated' ? p.originLabelSv === 'Genererad person'
  : p.identityOrigin === 'documented' && text(p.originLabelSv) && p.originLabelSv.startsWith('Dokumenterad person');
// A generated person carries the marker in the name as well as in the label.
const generatedName = p => p.identityOrigin !== 'generated' || (typeof p.name === 'string' && p.name.endsWith(' (genererad)'));

// Engine id rules. validateEngineSeed in characters/scenarioSeed.js imports these and stays as
// defence in depth; the validator mirrors it so the start card never offers a court the engine refuses.
export const RESERVED_IDS = ['__proto__','constructor','prototype'];
export const ENGINE_OFFICE_IDS = ['ruler','general','chancellor','priest','spymaster'];
export const safeId = x => typeof x === 'string' && /^[a-zA-Z0-9_:.-]{1,160}$/.test(x) && !RESERVED_IDS.includes(x);
const known = (table, key) => typeof key === 'string' && Object.hasOwn(table,key);
const validMechanics = m => m === undefined || (record(m) && known(ARCHETYPES,m.archetype)
  && Array.isArray(m.traits) && m.traits.length > 0 && m.traits.every(t => known(TRAITS,t))
  && Object.keys(SKILL_LABELS).every(k => Number.isFinite(m.skills?.[k]) && m.skills[k] >= 0));
// The runtime allocator owns person-<number>; a later birth would overwrite such an authored person.
const enginePerson = p => !/^person-\d+$/.test(p.id) && text(p.name) && p.spouseIds.length <= 1
  && (p.sex === undefined || ['female','male'].includes(p.sex)) && validMechanics(p.mechanics);
// Callers have checked that every legal parent id names a person in the court.
function acyclicParents(people) {
  const done = new Set(), path = new Set();
  const visit = id => {
    if (path.has(id)) return false;
    if (done.has(id)) return true;
    path.add(id);
    const ok = people.get(id).legalParentIds.every(visit);
    path.delete(id); done.add(id);
    return ok;
  };
  return [...people.keys()].every(visit);
}
function validEngineShape(court, people) {
  return ['people','families','religions','offices','cities'].every(k => court[k].every(e => safeId(e.id)))
    // seedCourt opens one governor office per city under the id governor:<city id>.
    && court.cities.every(c => safeId(`governor:${c.id}`))
    && court.people.every(enginePerson) && acyclicParents(people)
    && court.offices.every(o => ENGINE_OFFICE_IDS.includes(o.id))
    && (court.successionLaw === undefined || ['primogeniture','merit'].includes(court.successionLaw));
}
function validCourt(court, polityId, h, date) {
  if (!record(court) || court.polityId !== polityId || !h.settlements.some(s => s.id === court.seatId && s.polityId === polityId)) return false;
  if (!['people','families','religions','offices','cities'].every(k => validIds(court[k]))) return false;
  const people = new Map(court.people.map(p => [p.id,p]));
  const families = new Set(ids(court.families)), religions = new Set(ids(court.religions));
  if (!people.has(court.rulerId) || court.offices.find(o => o.id === 'ruler')?.holderId !== court.rulerId) return false;
  if (!court.people.every(p => ['documented','generated'].includes(p.identityOrigin) && validLabel(p) && generatedName(p)
    && families.has(p.familyId) && religions.has(p.religionId) && validClaims(p.claims, h.sources)
    && p.claims.identity?.status === (p.identityOrigin === 'generated' ? 'generated' : 'sourced')
    && p.claims.mechanics?.status === 'generated'
    && (!Object.hasOwn(p,'bornAt') || (Object.hasOwn(p.claims,'bornAt') && validBirth(p.bornAt,date)))
    && (p.identityOrigin !== 'documented' || Object.hasOwn(p.claims,'kinship'))
    && ['legalParentIds','spouseIds'].every(k => Array.isArray(p[k]) && unique(p[k])
      && claimedRelation(p,k) && p[k].every(id => id !== p.id && people.has(id)))
    && p.spouseIds.every(id => list(people.get(id).spouseIds).includes(p.id)))) return false;
  if (!validEngineShape(court, people)) return false;
  if (!court.families.every(f => people.get(f.headId)?.familyId === f.id
    && (f.religionId === undefined || religions.has(f.religionId)) && validClaims(f.claims, h.sources))) return false;
  if (!court.offices.every(o => (o.holderId === null || people.has(o.holderId)) && validClaims(o.claims, h.sources))) return false;
  if (!court.religions.every(r => (r.leaderId == null || people.has(r.leaderId)) && validClaims(r.claims, h.sources))) return false;
  if (!court.cities.every(c => h.settlements.some(s => s.id === c.settlementId && s.regionId === c.regionId && s.polityId === polityId)
    && families.has(c.familyId) && validClaims(c.claims, h.sources))) return false;
  return court.mechanics?.status === 'generated' && text(court.mechanics.noteSv);
}
function validSettlements(h, regionMap) {
  return validIds(h.settlements) && h.settlements.every(s => {
    if (!coordinate(s.coordinates) || !text(s.nameSv) || !text(s.noteSv) || !sourceRefs(s.sourceIds,h.sources)) return false;
    const region = regionMap.get(s.regionId);
    if (!region) return false;
    if (s.placement === 'contested') return s.polityId === null && list(s.candidatePolityIds).length >= 2
      && unique(s.candidatePolityIds) && s.candidatePolityIds.every(id => h.polities.some(p => p.id === id));
    return s.placement === 'inside' && h.polities.some(p => p.id === s.polityId)
      && region.properties.owner === s.polityId && booleanPointInPolygon(s.coordinates,region);
  });
}

// Pure court boundary for callers that already validated the scenario assets.
// Geometry and redistribution checks still belong to validateHistoricalScenario.
export function validateHistoricalCourt(h, { date, polityId } = {}) {
  try {
    if (!record(h) || h.schemaVersion !== 1 || h.kind !== 'historical'
      || h.calendar !== 'proleptic-gregorian-no-year-zero'
      || !['contentId', 'contentVersion', 'eraLabelSv', 'contextSv', 'coverageNoteSv'].every(k => text(h[k]))
      || !validSources(h.sources)) return failure('invalidContent');
    for (const value of [date, h.bookmarkDate, ...(h.validFrom || h.validTo ? [h.validFrom, h.validTo] : [])]) {
      const checked = validateHistoricalStartDate(value);
      if (!checked.ok || checked.date !== value) return failure('invalidDate');
    }
    if (h.validFrom || h.validTo) {
      if (!sourceRefs(h.dateSourceIds, h.sources) || compareGameDates(h.validFrom, h.validTo) > 0
        || compareGameDates(date, h.validFrom) < 0 || compareGameDates(date, h.validTo) > 0) return failure('unsupportedDate');
    } else if (date !== h.bookmarkDate) return failure('unsupportedDate');
    if (!safeId(polityId) || !h.playablePolityIds?.includes(polityId) || !h.polities?.some(p => p.id === polityId && text(p.nameSv))) return failure('invalidPolity');
    if (!validCourt(h.courtSeeds?.[polityId], polityId, h, date)) return failure('invalidCourt');
    return { ok: true, contentId: h.contentId, contentVersion: h.contentVersion, date, polityId };
  } catch { return failure('invalidContent'); }
}

/** Structural validation only. Human source review lives beside the authored data. */
export function validateHistoricalScenario(input, options = {}) {
  try {
    const { game, world, regions, assetManifest } = input ?? {};
    const h = world?.historicalScenario;
    if (!record(h) || h.schemaVersion !== 1 || h.kind !== 'historical' || h.calendar !== 'proleptic-gregorian-no-year-zero'
      || !['contentId','contentVersion','eraLabelSv','contextSv','coverageNoteSv'].every(k => text(h[k]))) return failure('invalidContent');
    const date = options?.date, polityId = options?.polityId;
    for (const value of [date,h.bookmarkDate,...(h.validFrom ? [h.validFrom] : []),...(h.validTo ? [h.validTo] : [])]) {
      const parsed = validateHistoricalStartDate(value);
      if (!parsed.ok || parsed.date !== value) return failure('invalidDate');
    }
    if (h.validFrom || h.validTo) {
      if (!h.validFrom || !h.validTo || !sourceRefs(h.dateSourceIds,h.sources) || compareGameDates(h.validFrom,h.validTo) > 0
        || compareGameDates(date,h.validFrom) < 0 || compareGameDates(date,h.validTo) > 0) return failure('unsupportedDate');
    } else if (date !== h.bookmarkDate) return failure('unsupportedDate');
    if (game?.startDate !== date || (game?.currentDate ?? game?.gameDate) !== date
      || (game?.gameDate !== undefined && game.gameDate !== date)) return failure('dateMismatch');
    if (!validSources(h.sources)) return failure('invalidSources');
    if (!validIds(h.polities) || !h.polities.every(p => text(p.nameSv) && sourceRefs(p.sourceIds,h.sources) && ['approximate','uncertain'].includes(p.boundary))) return failure('invalidPolities');
    const polityIds = new Set(ids(h.polities));
    if (!Object.keys(world.polityOverrides ?? {}).every(id => polityIds.has(id))) return failure('invalidPolities');
    if (!Array.isArray(h.playablePolityIds) || !h.playablePolityIds.length || !unique(h.playablePolityIds)
      || !h.playablePolityIds.every(id => polityIds.has(id) && safeId(id)) || !h.playablePolityIds.includes(polityId)) return failure('invalidPolity');
    if (regions?.type !== 'FeatureCollection' || !Array.isArray(regions.features) || !regions.features.length) return failure('invalidGeometry');
    const regionMap = new Map();
    for (const region of regions.features) {
      const p = region?.properties;
      if (!text(p?.id) || regionMap.has(p.id) || !validHistoricalGeometry(region.geometry)) return failure('invalidGeometry');
      if (p.owner && !polityIds.has(p.owner)) return failure('invalidOwner');
      if (!['owned','unresolved','non-state','disputed','physical'].includes(p.historical?.status)
        || !sourceRefs(p.historical?.sourceIds,h.sources)
        || (p.owner ? p.historical.status !== 'owned' : p.historical.status === 'owned')) return failure('invalidOwnership');
      regionMap.set(p.id,region);
    }
    for (const [id,owner] of Object.entries(world.regionOwnershipOverrides ?? {})) {
      if (!regionMap.has(id) || regionMap.get(id).properties.owner !== owner) return failure('invalidOwner');
    }
    if (!h.playablePolityIds.every(id => regions.features.some(f => f.properties.owner === id) && record(world.polityOverrides?.[id]))) return failure('missingMapPolity');
    if (!validSettlements(h,regionMap)) return failure('invalidSettlement');
    if (!h.playablePolityIds.every(id => validCourt(h.courtSeeds?.[id],id,h,date))) return failure('invalidCourt');
    const areas = ['Africa','Asia','Europe','Americas','Oceania','Antarctica'];
    if (!Array.isArray(h.coverage) || !unique(h.coverage.map(c => c.area)) || !areas.every(area => h.coverage.some(c => c.area === area))
      || !h.coverage.every(c => ['partial','unresolved','non-state'].includes(c.status) && text(c.noteSv) && sourceRefs(c.sourceIds,h.sources))) return failure('invalidCoverage');
    if (assetManifest?.schemaVersion !== 1 || assetManifest.contentId !== h.contentId || assetManifest.contentVersion !== h.contentVersion
      || !validIds(assetManifest.assets) || !['regionsGeojson','citiesGeojson'].every(id => assetManifest.assets.some(a => a.id === id))
      || !assetManifest.assets.every(a => sourceRefs(a.sourceIds,h.sources)
      && a.crs === 'OGC:CRS84' && text(a.revision) && /^[a-f0-9]{64}$/.test(a.sha256) && text(a.license)
      && Array.isArray(a.transformations) && a.transformations.length > 0)) return failure('invalidAssets');
    return { ok: true, contentId: h.contentId, contentVersion: h.contentVersion, date, polityId };
  } catch { return failure('invalidContent'); }
}
