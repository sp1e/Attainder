import atlasManifest from './portrait-atlases.json' with { type: 'json' };
import portraitManifest from './portrait-manifest.json' with { type: 'json' };
import historicalManifest from './portrait-historical.json' with { type: 'json' };

const AGE_LABELS = { child: 'barn', adult: 'vuxen', elder: 'äldre' };
const STATE_LABELS = { healthy: 'utan tydliga hälsobesvär', smallpox: 'smittkoppor', 'smallpox-recovering': 'återhämtning efter smittkoppor', 'smallpox-scars': 'ärr efter smittkoppor', fever: 'febersjukdom', wounded: 'skadad', 'injury-recovering': 'återhämtning efter skada', 'injury-scars': 'bestående skadeärr', frail: 'svag hälsa', stressed: 'hög belastning', grieving: 'sorg', exiled: 'i exil' };
const OLD_FALLBACKS = { 'fallback-female-child': 'person-0-4', 'fallback-male-child': 'person-0-5', 'fallback-female-adult': 'person-0-2', 'fallback-male-adult': 'person-0-3', 'fallback-female-elder': 'person-0-0', 'fallback-male-elder': 'person-0-1' };

// The portraits of documented rulers (docs/superpowers/specs/2026-11-19-historical-portraits-design.md): each has an
// original and an atlas of its own in a batch's directory, under the ruler's id in the court dossier. The manifest
// is built from the batch's production manifest (scripts/build-historical-portraits.mjs). An entry is known only
// when it names a picture of this game: a path under /dynasties/portraits/<batch>/ and one of the three ages.
const SHARED_ID = /^person-\d+-\d+$/;
const SHARED_ATLAS = /^\/dynasties\/portraits\/variants\/[a-zA-Z0-9_-]+\.(png|webp|jpg|jpeg)$/;
const HISTORICAL_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const HISTORICAL_ORIGINAL = /^\/dynasties\/portraits\/[a-z0-9-]+\/[a-z0-9-]+\.png$/;
const HISTORICAL_ATLAS = /^\/dynasties\/portraits\/[a-z0-9-]+\/variants\/[a-z0-9-]+\.png$/;
const MAX_ATLAS_INSET = 8;

function historicalPeople(manifest) {
  const characters = manifest?.characters && typeof manifest.characters === 'object' ? manifest.characters : {};
  return Object.entries(characters)
    .filter(([id, entry]) => HISTORICAL_ID.test(id) && !SHARED_ID.test(id) && typeof entry?.src === 'string' && HISTORICAL_ORIGINAL.test(entry.src) && Object.hasOwn(AGE_LABELS, entry.ageGroup))
    .map(([id, entry]) => [id, { id, ageGroup: entry.ageGroup, historical: entry }]);
}

function validBounds(bounds, limit) {
  return Array.isArray(bounds) && bounds.length === 7 && bounds.every((value, index) => Number.isFinite(value) && value >= 0 && value <= limit && (index === 0 || value > bounds[index - 1]));
}

/** Resolve only locally authored assets. A missing variant never changes a seed character's identity. */
export function getPortraitAsset(person, { atlases = atlasManifest, originals = portraitManifest, historical = historicalManifest, preferOriginal = false } = {}) {
  if (!person) return null;
  const known = new Map([
    ...(originals.people || []).filter((entry) => SHARED_ID.test(entry.id)).map((entry) => [entry.id, entry]),
    ...historicalPeople(historical),
  ]);
  const appearance = person.portraitState || {};
  const identityId = appearance.identityId || person.id || person.portraitId;
  const possible = [identityId, appearance.fallbackIdentityId, person.portraitId, OLD_FALLBACKS[person.portraitId]];
  const sourceIdentityId = possible.find((id) => known.has(id));
  if (!sourceIdentityId) return null;
  const original = known.get(sourceIdentityId);
  // A documented ruler's own pictures, or null for one of the 24 first portraits.
  const own = original.historical ?? null;
  const ageGroup = appearance.ageGroup || person.portraitAgeGroup || (person.age < 18 ? 'child' : person.age >= 60 ? 'elder' : 'adult');
  const visualState = appearance.visualState || 'healthy';
  const base = {
    identityId, sourceIdentityId, ageGroup, visualState,
    usesSharedFallback: sourceIdentityId !== identityId,
    label: [person.name || 'Okänd person', AGE_LABELS[ageGroup], STATE_LABELS[visualState] || 'okänt tillstånd', appearance.lifeStatus === 'deceased' || person.diedAt ? 'minnesporträtt' : '',
      // The face of a documented person is invented: the label says so.
      own ? 'konstnärlig tolkning' : ''].filter(Boolean).join(' · '),
    interpretation: Boolean(own),
  };
  const needsVariant = visualState !== 'healthy' || ageGroup !== original.ageGroup;
  const atlas = own ? own.atlas : atlases.characters?.[sourceIdentityId];
  const ageIndex = atlases.layout?.ageGroups?.indexOf(ageGroup) ?? -1;
  const stateIndex = atlases.layout?.states?.indexOf(visualState) ?? -1;
  const safeAtlasPath = typeof atlas?.src === 'string' && (own ? HISTORICAL_ATLAS : SHARED_ATLAS).test(atlas.src);
  // The batch's frames leave the seam between two cells out: so many pixels on every side.
  const inset = own && Number.isInteger(atlas?.inset) && atlas.inset >= 0 && atlas.inset <= MAX_ATLAS_INSET ? atlas.inset : 0;
  if (!preferOriginal && needsVariant && atlas && safeAtlasPath && ageIndex >= 0 && ageIndex < 3 && stateIndex >= 0 && stateIndex < 12
    && Number.isFinite(atlas.width) && atlas.width > 0 && Number.isFinite(atlas.height) && atlas.height > 0
    && validBounds(atlas.rowBounds, atlas.height) && validBounds(atlas.columnBounds, atlas.width)) {
    const row = ageIndex * 2 + Math.floor(stateIndex / 6), column = stateIndex % 6;
    const x = atlas.columnBounds[column], y = atlas.rowBounds[row];
    return { ...base, kind: 'atlas', src: atlas.src, width: atlas.width, height: atlas.height,
      rect: { x: x + inset, y: y + inset, width: atlas.columnBounds[column + 1] - x - 2 * inset, height: atlas.rowBounds[row + 1] - y - 2 * inset }, missingVariant: false };
  }
  return { ...base, kind: 'image', src: own ? own.src : `/dynasties/portraits/${sourceIdentityId}.png`,
    width: null, height: null, rect: null, missingVariant: needsVariant, renderedAgeGroup: original.ageGroup,
    renderedVisualState: 'healthy' };
}

export function portraitAssetKey(asset) {
  return asset ? [asset.identityId, asset.src, asset.rect?.x, asset.rect?.y, asset.rect?.width, asset.rect?.height].join(':') : '';
}
