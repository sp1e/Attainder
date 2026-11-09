// A restore point (storage/snapshots.json) holds the whole world as it stood
// before a turn, and a campaign keeps twelve. Two world keys come with the
// campaign at its start and nothing in play changes them: `componentLicenses`
// (the licence texts and sources of the map components, about 1 MB on a
// historical start) and `historicalScenario` (the start's sources, court seeds
// and region review, about 300 kB). A restore point leaves them out and names
// the ones it left out; whatever restores or shows it takes them from the live
// world. The live world, and so every exported game, keeps them in full.
// Spec: docs/superpowers/specs/2026-11-09-lean-snapshots-design.md.

export const STATIC_WORLD_KEYS = Object.freeze(["componentLicenses", "historicalScenario"]);
export const OMITTED_KEYS_FIELD = "snapshotOmittedKeys";

const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

// The world a restore point stores: a shallow copy without the static keys.
// The caller clones the result, so the large values are never copied.
export const worldForSnapshot = (world) => {
  if (!isRecord(world)) return world;
  const omitted = STATIC_WORLD_KEYS.filter((key) => world[key] !== undefined);
  if (!omitted.length) return world;
  const lean = { ...world, [OMITTED_KEYS_FIELD]: omitted };
  for (const key of omitted) delete lean[key];
  return lean;
};

// The world a restore point stands for: the stored world with the keys it left
// out taken from `liveWorld`, by reference. A restore point from before this
// change names nothing and comes back as stored. Throws when the live world
// lacks a key the restore point left out, so a rollback never writes a
// campaign without its start or its licences.
export const worldFromSnapshot = (snapshotWorld, liveWorld) => {
  if (!isRecord(snapshotWorld) || !Array.isArray(snapshotWorld[OMITTED_KEYS_FIELD])) return snapshotWorld;
  const full = { ...snapshotWorld };
  delete full[OMITTED_KEYS_FIELD];
  for (const key of snapshotWorld[OMITTED_KEYS_FIELD]) {
    if (!STATIC_WORLD_KEYS.includes(key)) continue;
    if (!isRecord(liveWorld) || liveWorld[key] === undefined) {
      throw new Error(`Återställningspunkten saknar ${key} och den aktuella världen har inget att ta det från.`);
    }
    full[key] = liveWorld[key];
  }
  return full;
};
