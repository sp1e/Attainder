/*! Attainder shared character projection. AGPL-3.0-or-later. */
import { getCharacterWorldEffects } from "./characters/index.js";
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const projectPreparedCharacterWorld = (world, state) => {
  const effect = getCharacterWorldEffects(state);
  const polity = effect.polityId;
  if (state.realm.alive === false || world.polityOverrides?.[polity]?.status === "dissolved") {
    const countryStats = { ...(world.countryStats ?? {}) };
    if (world.polityOverrides?.[polity]?.status === "dissolved") delete countryStats[polity];
    const cityIds = new Set(Object.values(state.cities).map((city) => city.id));
    const markers = (world.markers ?? []).map((marker) => cityIds.has(marker.id)
      ? { ...marker, note: String(marker.note ?? "").split(/\n?\[Familjepolitik\]/)[0] } : marker);
    return { ...world, characterSystem: state, characterEconomy: effect, countryStats, markers,
      characterWorldBindings: { units: {}, revision: state.revision } };
  }
  const previous = world.characterWorldBindings ?? { units: {} };
  const bindings = { units: {}, revision: effect.revision };
  const currentSheet = world.countryStats?.[polity] ?? {};
  // Absolute values, not repeated bonuses. Custom figures retain their units
  // (talents and production) instead of pretending ancient output is modern GDP.
  const countryStats = {
    ...(world.countryStats ?? {}),
    [polity]: {
      ...currentSheet,
      leader: effect.leaderName,
      stability: clamp(effect.legitimacy, 0, 100),
      customStats: {
        ...(currentSheet.customStats ?? {}),
        treasury: effect.treasury,
        annualRevenue: effect.annualRevenue,
        production: Math.round(effect.productionMultiplier * 100),
        militaryReadiness: effect.militaryReadiness,
        orders: effect.orders,
      },
    },
  };
  const units = (world.units ?? []).map((unit) => {
    if (String(unit.ownerCode).toLowerCase() !== String(polity).toLowerCase()) return unit;
    const stored = previous.units?.[unit.id];
    const base = stored && Number(unit.strength) === stored.projected
      ? stored.base : Number(unit.strength) || 100;
    const projected = Math.round(clamp(base * clamp(effect.militaryReadiness, 0, 100) / 100, 1, 100));
    bindings.units[unit.id] = { base, projected };
    return { ...unit, strength: projected };
  });
  const cities = effect.cityEffects ?? [];
  const markers = (world.markers ?? []).map((marker) => {
    const city = cities.find((entry) => entry.id === marker.id || (entry.regionId && entry.regionId === marker.regionId));
    if (!city) return marker;
    const baseNote = String(marker.note ?? "").split(/\n?\[Familjepolitik\]/)[0];
    return { ...marker, note: `${baseNote}\n[Familjepolitik] Produktion ${Math.round(city.productionMultiplier * 100)} %, skatt ${city.taxIncome}, oro ${Math.round(city.unrest)} %.`.trim() };
  });
  return { ...world, characterSystem: state, characterWorldBindings: bindings,
    characterEconomy: effect, countryStats, units, markers };
};
