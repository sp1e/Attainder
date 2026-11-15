// Rulers at their seats: which ruler stands at which city of a historical campaign's map, and the picture a medallion
// shows. Spec: docs/superpowers/specs/2026-11-13-living-map-design.md, slice 6.
import { getPortraitAsset } from "../../runtime/characters/portraitAssets.js";
import { nameInitials } from "../Characters/nameInitials.js";

/** The seats of a package's cities: one per realm, the first the package marks as a seat. */
export function seatsOf(cities) {
  const seats = [];
  const taken = new Set();
  for (const feature of Array.isArray(cities?.features) ? cities.features : []) {
    const properties = feature?.properties ?? {};
    const polityId = String(properties.owner ?? "");
    const [longitude, latitude] = feature?.geometry?.type === "Point" ? feature.geometry.coordinates ?? [] : [];
    if (properties.seat !== true || !polityId || taken.has(polityId) || !Number.isFinite(longitude) || !Number.isFinite(latitude)) continue;
    taken.add(polityId);
    seats.push({ polityId, cityName: String(properties.name ?? properties.city ?? ""), longitude, latitude });
  }
  return seats;
}

// The portraits a person without one of his own shares: four of women (person-N-4) and four of men (person-N-5), each
// with variants by age. The court picks among them the same way (server/characters/portraitState.js).
const SHARED_PORTRAIT_FAMILIES = 4;
const stableHash = (value) => {
  let hash = 2166136261;
  for (const char of String(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
};
const sharedPortraitId = (id, sex) => `person-${stableHash(id) % SHARED_PORTRAIT_FAMILIES}-${sex === "male" ? 5 : 4}`;
const ageGroupOf = (age) => (age < 18 ? "child" : age >= 60 ? "elder" : "adult");

/**
 * A foreign ruler as the portrait lookup wants a person. The campaign keeps no portrait for him, so he takes a shared
 * one by sex, picked by his id, at his age. A row without the ruler's id or sex (a presentation from before it
 * carried them) gives a person with a name only, who is drawn as initials: the map does not guess at a face.
 */
export function foreignRulerPerson(realm) {
  const name = String(realm?.rulerName ?? "");
  if (!realm?.rulerId || !(realm.rulerSex === "male" || realm.rulerSex === "female")) return { name };
  const age = Number.isFinite(realm.rulerAge) ? realm.rulerAge : 40;
  return {
    id: realm.rulerId,
    name,
    sex: realm.rulerSex,
    age,
    portraitState: {
      identityId: realm.rulerId,
      fallbackIdentityId: sharedPortraitId(realm.rulerId, realm.rulerSex),
      ageGroup: ageGroupOf(age),
      visualState: "healthy",
      lifeStatus: "alive",
    },
  };
}

/**
 * The medallions of a campaign: the player's realm with its own ruler, and each foreign realm whose court the campaign
 * keeps. The player's realm comes last, so its medallion is drawn over a neighbour's.
 */
export function seatRulers({ cities = null, view = null, playerPolity = "" } = {}) {
  if (!view) return [];
  const foreign = new Map((Array.isArray(view.foreignRealms) ? view.foreignRealms : []).map((realm) => [realm.id, realm]));
  const rulers = [];
  let own = null;
  for (const seat of seatsOf(cities)) {
    if (playerPolity && seat.polityId === playerPolity) {
      if (view.ruler) own = { ...seat, own: true, realmName: String(view.identity?.realmName ?? ""), rulerName: String(view.ruler.name ?? ""), person: view.ruler };
      continue;
    }
    const realm = foreign.get(seat.polityId);
    if (!realm) continue;
    rulers.push({ ...seat, own: false, realmName: String(realm.name ?? ""), rulerName: String(realm.rulerName ?? ""), person: foreignRulerPerson(realm) });
  }
  return own ? [...rulers, own] : rulers;
}

/**
 * What a medallion shows: the person's portrait (a whole image or a crop of an atlas), or initials. A picture of
 * another age than the person's (the variant is missing) is not shown: a shared portrait's own picture is a child's.
 * `manifests` is for tests.
 */
export function medallionOf(person, readName, manifests) {
  const asset = getPortraitAsset(person, manifests);
  if (asset?.kind === "atlas") return { kind: "atlas", src: asset.src, rect: asset.rect, width: asset.width, height: asset.height };
  if (asset?.kind === "image" && (asset.renderedAgeGroup ?? asset.ageGroup) === asset.ageGroup) return { kind: "image", src: asset.src };
  return { kind: "initials", text: nameInitials(person?.name, readName) };
}
