/*! Attainder historical start preparation. AGPL-3.0-or-later (see LICENSE). */
import { classifyCampaignCreation, validateHistoricalStartDate, validateHistoricalStartDates } from './historicalStarts.js';
import { validateHistoricalScenario } from './historicalScenarios.js';
import { parseGameDate } from './gameDates.js';
import { createHistoricalCharacterSystem } from './characters/scenarioSeed.js';
import { projectPreparedCharacterWorld } from './characterProjection.js';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = value => JSON.parse(JSON.stringify(value));
const fail = (code = 'invalidContent', error = 'Det historiska scenariot saknar giltiga källor, kartdata eller hov för den valda starten.') => ({ ok: false, code, error });
const conflict = () => fail('conflictingOptions', 'Startalternativen måste stämma med scenariots datum, rike och svårighetsgrad.');
export const requirePrepared = result => { if (!result.ok) throw new Error(result.error); return result; };
export const sameJson = (a, b) => {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x,i) => sameJson(x,b[i]));
  return record(a) && record(b) && Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => Object.hasOwn(b,k) && sameJson(a[k],b[k]));
};

export function validateRawStartFields(...values) {
  for (const value of values) {
    if (value === undefined) continue;
    if (!record(value)) return conflict();
    for (const key of ['startDate', 'gameDate', 'currentDate', 'date']) {
      if (!Object.hasOwn(value,key)) continue;
      const checked = validateHistoricalStartDate(value[key]);
      if (!checked.ok) return checked;
    }
  }
  return { ok: true };
}

// These hashes identify authored releases, not reserialized storage bytes.
export function historicalAssetManifest(world) {
  const h = world?.historicalScenario, provenance = world?.assetProvenance;
  const assets = ['regionsGeojson','citiesGeojson'].map(id => provenance?.[id]);
  if (assets.some((a,i) => !record(a) || a.id !== ['regionsGeojson','citiesGeojson'][i]
    || a.hashScope !== 'authored-release' || (a.currentAssetStatus !== undefined && !['unverified','modified'].includes(a.currentAssetStatus)))) return null;
  return { schemaVersion: 1, contentId: h?.contentId, contentVersion: h?.contentVersion, assets };
}

export function validatePlayableScenario({ data, meta, regions, cities } = {}) {
  if (meta?.restoreOnly) return fail('restoreOnly', 'Det återställda scenariot kan bara användas av sparade kampanjer.');
  const raw = validateRawStartFields(data?.game);
  if (!raw.ok) return raw;
  const dates = validateHistoricalStartDates(data?.game);
  if (!dates.ok) return dates;
  const game = { ...data.game, startDate: dates.startDate, gameDate: dates.gameDate };
  if (Object.hasOwn(game, 'currentDate')) {
    if (validateHistoricalStartDate(game.currentDate).date !== dates.gameDate) return conflict();
    game.currentDate = dates.gameDate;
  }
  const checked = validateHistoricalScenario({ game, world: data?.world, regions, assetManifest: historicalAssetManifest(data?.world) }, { date: dates.gameDate, polityId: game.country });
  if (!checked.ok) return checked;
  const settlements = data.world.historicalScenario.settlements;
  if (cities?.type !== 'FeatureCollection' || !Array.isArray(cities.features)
    || cities.features.length !== settlements.length
    || !settlements.every(s => cities.features.filter(f => f?.properties?.id === s.id).length === 1
      && cities.features.some(f => f.properties?.id === s.id && f.geometry?.type === 'Point'
        && sameJson(f.geometry.coordinates,s.coordinates) && f.properties.owner === s.polityId))) return fail('invalidCities');
  return { ...checked, game };
}

// A new campaign saves only the chosen polity's court. Polities, settlements and
// sources stay whole because the country list and the map read them. A court with its own
// start text replaces the package text in the campaign record. The world briefing takes it
// in the builder's layout (context, calendar note, coverage note) only while the briefing
// still holds the package text; a briefing the player edited stays as written.
const briefingLayout = (contextSv, h) => [contextSv, h.calendarNoteSv, h.coverageNoteSv].join('\n');
export function narrowToChosenCourt(world, polityId) {
  const h = world.historicalScenario, court = h.courtSeeds[polityId];
  const historicalScenario = { ...h, playablePolityIds: [polityId], courtSeeds: { [polityId]: court } };
  if (typeof court?.contextSv !== 'string') return { ...world, historicalScenario };
  const narrowed = { ...world, historicalScenario: { ...historicalScenario, contextSv: court.contextSv } };
  if (world.startingTimelineText !== briefingLayout(h.contextSv, h)) return narrowed;
  return { ...narrowed, startingTimelineText: briefingLayout(court.contextSv, h) };
}

const ENGINE_DIFFICULTY = Object.freeze({ easy: 'easy', standard: 'normal', normal: 'normal', hard: 'hard' });
const WORLD_RUNTIME_KEYS = ['characterSystem','characterWorldBindings','characterEconomy','simulationHistory','lastJumpMode','lastJumpSummary','lastJumpTargetDate','countryStats','transactions'];
export function prepareHistoricalCampaignStart({ request = {}, sourceGame = null, scenario } = {}) {
  const classification = classifyCampaignCreation({ ...request, sourceGame });
  if (!classification.ok) return classification;
  if (classification.kind === 'copy') return { ok: true, kind: 'copy', data: clone(sourceGame.data), scenarioId: sourceGame.scenarioId };
  if (request.seedGameId && !request.scenarioId) return fail('scenarioRequired', 'Välj ett historiskt scenario för en ändrad kampanjstart.');
  if (!scenario) return fail();
  const raw = validateRawStartFields(scenario.data?.game, request.gamePatch, request.historicalStart);
  if (!raw.ok) return raw;
  const authored = validatePlayableScenario(scenario);
  if (!authored.ok) return authored;
  const data = clone(scenario.data), options = request.historicalStart ?? {}, patch = request.gamePatch ?? {};
  const game = { ...authored.game, ...patch, round: 1 };
  const date = options.date ?? game.gameDate, polityId = options.polityId ?? game.country;
  const mode = options.mode ?? 'realm', difficulty = options.difficulty ?? ENGINE_DIFFICULTY[game.difficulty ?? 'standard'];
  if (validateHistoricalStartDate(date).date !== validateHistoricalStartDate(game.gameDate).date
    || polityId !== game.country || !['realm','family'].includes(mode)
    || !['easy','normal','hard'].includes(difficulty)
    || (Object.hasOwn(options,'difficulty') && Object.hasOwn(patch,'difficulty') && ENGINE_DIFFICULTY[patch.difficulty] !== difficulty)
    || (Object.hasOwn(options,'seed') && (!Number.isInteger(options.seed) || options.seed < 1 || options.seed > 4294967295))
    || (options.familyId !== undefined && (typeof options.familyId !== 'string' || !options.familyId))) return conflict();
  game.difficulty = difficulty === 'normal' ? 'standard' : difficulty;
  const dates = validateHistoricalStartDates(game);
  if (!dates.ok) return dates;
  // A new historical campaign has one selected narration language. Existing
  // saves and copies do not pass through this initialization branch.
  const language = typeof game.language === 'string' && game.language.trim()
    ? game.language.trim() : (typeof data.world.language === 'string' ? data.world.language.trim() : '');
  if (language) {
    game.language = language;
    data.world.language = language;
  }
  data.game = { ...game, startDate: dates.startDate, gameDate: dates.gameDate, characterMode: mode, characterSeed: options.seed ?? 104729 };
  if (Object.hasOwn(game,'currentDate')) data.game.currentDate = dates.gameDate;
  for (const key of WORLD_RUNTIME_KEYS) delete data.world[key];
  for (const key of ['actions','advisor','chat','events']) data[key] = [];
  for (const key of ['snapshots','snapshotsIndex','intercepts']) delete data[key];
  const checked = validatePlayableScenario({ ...scenario, data });
  if (!checked.ok) return checked;
  try {
    const state = createHistoricalCharacterSystem({ historicalScenario: data.world.historicalScenario, date: dates.gameDate, polityId, mode, familyId: options.familyId, seed: data.game.characterSeed, difficulty });
    data.world = narrowToChosenCourt(data.world, polityId);
    data.world = projectPreparedCharacterWorld(data.world, state);
    if ([state.startedAt, state.date].some(d => d !== data.game.startDate) || state.identity.polityId !== data.game.country) return conflict();
    return { ok: true, kind: 'new', data, scenarioId: scenario.meta?.id };
  } catch (error) { return fail('invalidCourt', error.message); }
}

export function validateSavedGameBundle(bundle) {
  const refusal = () => fail('invalidSave', 'Filen måste innehålla en sparad kampanj med ett giltigt speldatum.');
  if (!record(bundle) || bundle.schema !== 'open-historia-game-bundle/1' || !record(bundle.data) || !record(bundle.data.game)) return refusal();
  const { data } = bundle, game = data.game;
  const date = Object.hasOwn(game,'gameDate') ? game.gameDate : game.startDate;
  if (typeof date !== 'string' || !parseGameDate(date) || (Object.hasOwn(game,'startDate') && (typeof game.startDate !== 'string' || !parseGameDate(game.startDate)))) return refusal();
  if (Object.hasOwn(data,'world') && !record(data.world)) return refusal();
  if (data.world?.characterSystem !== undefined && !record(data.world.characterSystem)) return refusal();
  for (const key of ['actions','advisor','chat','events','snapshots']) if (Object.hasOwn(data,key) && !Array.isArray(data[key])) return refusal();
  for (const key of ['prompts','colors','flags','tags','stats','snapshotsIndex','intercepts']) if (Object.hasOwn(data,key) && !record(data[key])) return refusal();
  return { ok: true };
}

// Generic legacy maps may use unwrapped antimeridian longitudes, unlike authored starts.
// Validate every polygon and ring without rewriting the supplied collection.
function validCompanionGeometry(geometry) {
  const polygons = geometry?.type === 'Polygon' ? [geometry.coordinates]
    : geometry?.type === 'MultiPolygon' ? geometry.coordinates : null;
  return Array.isArray(polygons) && polygons.length > 0 && polygons.every(polygon =>
    Array.isArray(polygon) && polygon.length > 0 && polygon.every(ring =>
      Array.isArray(ring) && ring.length >= 4
      && ring.every(point => Array.isArray(point) && point.length >= 2 && point.every(Number.isFinite) && Math.abs(point[1]) <= 90)
      && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1]
      && new Set(ring.map(point => `${point[0]},${point[1]}`)).size >= 3));
}

export function companionMap(companion, fallbackRegions = null) {
  const asset = companion?.assets?.regionsGeojson;
  if (asset?.mode !== 'embedded' && companion?.data?.world?.assetProvenance?.regionsGeojson?.currentAssetStatus === 'modified') {
    return fail('missingMap', 'Scenariot saknar en giltig karta för den sparade kampanjen.');
  }
  let regions = fallbackRegions;
  if (asset?.mode === 'embedded') {
    regions = asset.data;
    if (asset.encoding === 'base64' || typeof regions === 'string') {
      try {
        const bytes = Uint8Array.from(atob(regions), character => character.charCodeAt(0));
        regions = JSON.parse(new TextDecoder().decode(bytes));
      } catch { regions = null; }
    }
  } else if (asset && asset.mode !== 'default') regions = null;
  if (regions?.type !== 'FeatureCollection' || !Array.isArray(regions.features)
    || !regions.features.length || !regions.features.every(feature => feature?.type === 'Feature' && validCompanionGeometry(feature.geometry))) {
    return fail('missingMap', 'Scenariot saknar en giltig karta för den sparade kampanjen.');
  }
  return { ok: true, regions };
}

export function companionCoverType(companion) {
  const cover=companion?.assets?.cover;
  if (!cover || cover.mode === 'default') return null;
  if (cover.mode !== 'embedded' || typeof cover.data !== 'string') return '';
  let bytes;
  try { bytes=Uint8Array.from(atob(cover.data),character=>character.charCodeAt(0)); } catch { return ''; }
  if (!bytes.length) return '';
  const declared=String(cover.contentType ?? '').split(';')[0].trim().toLowerCase();
  if (['image/avif','image/gif','image/jpeg','image/png','image/webp'].includes(declared)) return declared;
  if (bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff) return 'image/jpeg';
  if ([137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value)) return 'image/png';
  const prefix=String.fromCharCode(...bytes.slice(0,12));
  if (prefix.startsWith('GIF87a') || prefix.startsWith('GIF89a')) return 'image/gif';
  if (prefix.startsWith('RIFF') && prefix.slice(8,12)==='WEBP') return 'image/webp';
  if (prefix.slice(4,8)==='ftyp' && ['avif','avis'].includes(prefix.slice(8,12))) return 'image/avif';
  return '';
}

// The built-in's revision on a map, 1 when unstamped (server/libraryStore.js builtInRevisionOf).
const builtInRevisionOf = world => { const value = Number(world?.builtInRevision); return Number.isInteger(value) && value > 0 ? value : 1; };

// A save binds to a companion on its own map. A later revision of that map carries newer content and the
// same geometry, so a campaign started on revision 1 restores from a revision 2 export; an earlier one does not.
function sameBuiltInEdition(saved, incoming) {
  if (saved?.builtInMap !== undefined && incoming.builtInMap !== saved.builtInMap) return false;
  return saved?.builtInRevision === undefined || builtInRevisionOf(incoming) >= builtInRevisionOf(saved);
}

export function validateCompanion(bundle, companion, { fallbackRegions = null } = {}) {
  const checked = validateSavedGameBundle(bundle);
  if (!checked.ok) return checked;
  const ref = bundle.scenarioRef;
  if (!record(ref) || typeof ref.scenarioId !== 'string' || !ref.scenarioId.trim()
    || !record(companion) || !/^[a-z][a-z0-9-]*-scenario-bundle(?:\/2)?$/.test(companion.schema)
    || companion.scenario?.id !== ref.scenarioId || !record(companion.data?.game) || !record(companion.data?.world)) return fail('wrongCompanion', 'Scenariot måste höra till den sparade kampanjen.');
  const expected = ref.hubOrigin, supplied = companion.hubOrigin;
  if (supplied && expected && ['postId','bundleUrl','release'].some(k => expected[k] !== undefined && !sameJson(expected[k],supplied[k]))) return fail('wrongEdition', 'Scenariots utgåva stämmer inte med den sparade kampanjen.');
  if (!sameBuiltInEdition(bundle.data.world, companion.data.world)) return fail('wrongEdition', 'Scenariots utgåva stämmer inte med den sparade kampanjen.');
  const savedAsset=bundle.data.world?.assetProvenance?.regionsGeojson;
  const worldAsset=companion.data.world?.assetProvenance?.regionsGeojson, descriptorAsset=companion.assets?.regionsGeojson?.provenance;
  if (companion.assets?.regionsGeojson?.mode !== 'embedded' && savedAsset?.currentAssetStatus === 'modified') return fail('missingMap', 'Scenariot saknar en giltig karta för den sparade kampanjen.');
  if (worldAsset && descriptorAsset && !sameJson(worldAsset,descriptorAsset)) return fail('wrongEdition', 'Scenariots utgåva stämmer inte med den sparade kampanjen.');
  const incomingAsset=worldAsset ?? descriptorAsset;
  if (savedAsset?.hashScope === 'authored-release' && incomingAsset?.hashScope === 'authored-release'
    && savedAsset.sha256 && incomingAsset.sha256 && savedAsset.sha256 !== incomingAsset.sha256) return fail('wrongEdition', 'Scenariots utgåva stämmer inte med den sparade kampanjen.');
  const map=companionMap(companion,fallbackRegions);
  if (!map.ok) return map;
  if (companionCoverType(companion) === '') return fail('invalidCover', 'Scenariots omslagsbild är ogiltig.');
  return { ok: true };
}
