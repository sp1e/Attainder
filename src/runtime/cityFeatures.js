export const EMPTY_CITY_FEATURE_COLLECTION = Object.freeze({
  type: "FeatureCollection",
  features: Object.freeze([]),
});

const toFiniteNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export const isPrimaryCityCapital = (properties = {}) => {
  const value = properties.capital;
  if (value === true) return true;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["primary", "capital", "true", "yes", "1"].includes(normalized)) return true;
  }
  return Array.isArray(properties.tags)
    && properties.tags.some((tag) => String(tag).trim().toLowerCase() === "capital");
};

export const normalizeCustomCityFeature = (feature) => {
  if (!feature || feature?.geometry?.type !== "Point") return null;
  const coordinates = feature.geometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  const lon = Number(coordinates[0]);
  const lat = Number(coordinates[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;

  const properties = feature.properties && typeof feature.properties === "object"
    ? feature.properties
    : {};
  const label = String(properties.city ?? properties.name ?? "").trim();
  if (!label) return null;

  const primaryCapital = isPrimaryCityCapital(properties);
  const authoredTier = Math.trunc(toFiniteNumber(properties.tier, 0));
  const normalizedTier = Math.max(
    1,
    Math.min(4, primaryCapital ? Math.max(3, authoredTier || 3) : authoredTier || 1),
  );

  return {
    ...feature,
    properties: {
      ...properties,
      city: label,
      name: label,
      population: Math.max(0, toFiniteNumber(properties.population, 0)),
      tier: normalizedTier,
      _ohTier: normalizedTier,
      _ohCapital: primaryCapital,
    },
  };
};

export const normalizeCustomCityFeatureCollection = (value) => ({
  type: "FeatureCollection",
  features: Array.isArray(value?.features)
    ? value.features.map(normalizeCustomCityFeature).filter(Boolean)
    : [],
});

export const customCityFeatureCount = (value) =>
  Array.isArray(value?.features) ? value.features.length : 0;

// A failed read is served the same empty collection as a deliberately emptied one.
export const resolveCityLayerSource = ({ customCities, collection, readSucceeded, historical = false }) => {
  if (historical) return collection == null ? "loading" : "custom";
  if (!customCities) return "stock";
  if (collection === null || collection === undefined) return "loading";
  return readSucceeded ? "custom" : "stock";
};

const storedCityName = (feature) => String(feature?.properties?.city ?? feature?.properties?.name ?? "").trim();
const collectionFeatures = (collection) => (Array.isArray(collection?.features) ? collection.features : []);

// What the player reads for each custom city: { lowercased stored name: its reading }, only where the reading
// differs. `read` is the page's native book (readNative). A package stores its cities under their Swedish names,
// and the stored name stays the key everything else matches on (world.cityRenames, world.cityPopulations).
export const cityNameReadings = (collection, read) => {
  const readings = {};
  for (const feature of collectionFeatures(collection)) {
    const name = storedCityName(feature);
    if (!name) continue;
    const answer = read(name);
    const reading = typeof answer === "string" ? answer.trim() : "";
    if (reading && reading !== name) readings[name.toLowerCase()] = reading;
  }
  return readings;
};

// The label overrides for the map: a reading, and over it an AI rename (world.cityRenames, keyed by the lowercased
// name the model wrote). A model that read the English name renamed the same city, so a rename made under a
// reading lands on the stored name too.
export const cityLabelOverrides = (readings, renames = {}) => {
  const overrides = { ...readings };
  const storedByReading = new Map(Object.entries(readings || {}).map(([stored, reading]) => [reading.toLowerCase(), stored]));
  for (const [from, to] of Object.entries(renames || {})) {
    overrides[from] = to;
    if (storedByReading.has(from)) overrides[storedByReading.get(from)] = to;
  }
  return overrides;
};

// The same collection with each city under the name the player reads, for the place search. With nothing to read
// it is the collection itself.
export const cityFeaturesAsRead = (collection, readings) => {
  if (!readings || !Object.keys(readings).length) return collection;
  return {
    ...collection,
    features: collectionFeatures(collection).map((feature) => {
      const reading = readings[storedCityName(feature).toLowerCase()];
      return reading ? { ...feature, properties: { ...feature.properties, city: reading, name: reading } } : feature;
    }),
  };
};
