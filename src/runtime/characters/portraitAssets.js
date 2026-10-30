import atlasManifest from './portrait-atlases.json' with { type: 'json' };
import portraitManifest from './portrait-manifest.json' with { type: 'json' };

const AGE_LABELS = { child: 'barn', adult: 'vuxen', elder: 'äldre' };
const STATE_LABELS = { healthy: 'utan tydliga hälsobesvär', smallpox: 'smittkoppor', 'smallpox-recovering': 'återhämtning efter smittkoppor', 'smallpox-scars': 'ärr efter smittkoppor', fever: 'febersjukdom', wounded: 'skadad', 'injury-recovering': 'återhämtning efter skada', 'injury-scars': 'bestående skadeärr', frail: 'svag hälsa', stressed: 'hög belastning', grieving: 'sorg', exiled: 'i exil' };
const OLD_FALLBACKS = { 'fallback-female-child': 'person-0-4', 'fallback-male-child': 'person-0-5', 'fallback-female-adult': 'person-0-2', 'fallback-male-adult': 'person-0-3', 'fallback-female-elder': 'person-0-0', 'fallback-male-elder': 'person-0-1' };

function validBounds(bounds, limit) {
  return Array.isArray(bounds) && bounds.length === 7 && bounds.every((value, index) => Number.isFinite(value) && value >= 0 && value <= limit && (index === 0 || value > bounds[index - 1]));
}

/** Resolve only locally authored assets. A missing variant never changes a seed character's identity. */
export function getPortraitAsset(person, { atlases = atlasManifest, originals = portraitManifest, preferOriginal = false } = {}) {
  if (!person) return null;
  const known = new Map((originals.people || []).filter((entry) => /^person-\d+-\d+$/.test(entry.id)).map((entry) => [entry.id, entry]));
  const appearance = person.portraitState || {};
  const identityId = appearance.identityId || person.id || person.portraitId;
  const possible = [identityId, appearance.fallbackIdentityId, person.portraitId, OLD_FALLBACKS[person.portraitId]];
  const sourceIdentityId = possible.find((id) => known.has(id));
  if (!sourceIdentityId) return null;
  const original = known.get(sourceIdentityId);
  const ageGroup = appearance.ageGroup || person.portraitAgeGroup || (person.age < 18 ? 'child' : person.age >= 60 ? 'elder' : 'adult');
  const visualState = appearance.visualState || 'healthy';
  const base = {
    identityId, sourceIdentityId, ageGroup, visualState,
    usesSharedFallback: sourceIdentityId !== identityId,
    label: [person.name || 'Okänd person', AGE_LABELS[ageGroup], STATE_LABELS[visualState] || 'okänt tillstånd', appearance.lifeStatus === 'deceased' || person.diedAt ? 'minnesporträtt' : ''].filter(Boolean).join(' · '),
  };
  const needsVariant = visualState !== 'healthy' || ageGroup !== original.ageGroup;
  const atlas = atlases.characters?.[sourceIdentityId];
  const ageIndex = atlases.layout?.ageGroups?.indexOf(ageGroup) ?? -1;
  const stateIndex = atlases.layout?.states?.indexOf(visualState) ?? -1;
  const safeAtlasPath = typeof atlas?.src === 'string' && /^\/dynasties\/portraits\/variants\/[a-zA-Z0-9_-]+\.(png|webp|jpg|jpeg)$/.test(atlas.src);
  if (!preferOriginal && needsVariant && atlas && safeAtlasPath && ageIndex >= 0 && ageIndex < 3 && stateIndex >= 0 && stateIndex < 12
    && Number.isFinite(atlas.width) && atlas.width > 0 && Number.isFinite(atlas.height) && atlas.height > 0
    && validBounds(atlas.rowBounds, atlas.height) && validBounds(atlas.columnBounds, atlas.width)) {
    const row = ageIndex * 2 + Math.floor(stateIndex / 6), column = stateIndex % 6;
    const x = atlas.columnBounds[column], y = atlas.rowBounds[row];
    return { ...base, kind: 'atlas', src: atlas.src, width: atlas.width, height: atlas.height,
      rect: { x, y, width: atlas.columnBounds[column + 1] - x, height: atlas.rowBounds[row + 1] - y }, missingVariant: false };
  }
  return { ...base, kind: 'image', src: `/dynasties/portraits/${sourceIdentityId}.png`,
    width: null, height: null, rect: null, missingVariant: needsVariant, renderedAgeGroup: original.ageGroup,
    renderedVisualState: 'healthy' };
}

export function portraitAssetKey(asset) {
  return asset ? [asset.identityId, asset.src, asset.rect?.x, asset.rect?.y, asset.rect?.width, asset.rect?.height].join(':') : '';
}
