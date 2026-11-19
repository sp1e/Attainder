// A historical polity's name apart from its key.
// Spec: docs/superpowers/specs/2026-11-19-historical-polity-names-design.md.
//
// An authored historical package keys a polity by a stable id (`byzantine-empire`) and names it apart
// (historicalScenario.polities[].nameSv, copied into polityOverrides[id].name). Everywhere else a country IS its
// name, and the key of polityOverrides doubles as the label. No imports: the map's store reads the raw world and
// uses this module without the game state's.

const text = (value) => (typeof value === "string" ? value.trim() : "");
const isHistorical = (world) => world?.historicalScenario?.kind === "historical";

// The name the scenario gives the polity with this id, or "".
export const historicalPolityName = (world, id) => {
  if (!isHistorical(world)) return "";
  const key = text(id);
  const polities = Array.isArray(world.historicalScenario.polities) ? world.historicalScenario.polities : [];
  return text(polities.find((entry) => text(entry?.id) === key)?.nameSv);
};

// The label an updated polity carries. Outside a historical package it is the key. Inside one it is the name the
// polity already has, or the scenario's when the label is missing or is the id.
export const updatedPolityName = (world, code, currentName) => {
  if (!isHistorical(world)) return code;
  const kept = text(currentName);
  return (kept && kept !== code ? kept : historicalPolityName(world, code)) || code;
};

// Repair on read: until 19 November 2026 every update of a historical polity wrote its id over its name. A label
// that is the id reads the scenario's name again; any other name stands. Returns the same object when nothing
// was overwritten, so a reader that compares references sees no change.
export const withHistoricalPolityNames = (polityOverrides, world) => {
  if (!isHistorical(world) || !polityOverrides || typeof polityOverrides !== "object") return polityOverrides;
  let repaired = null;
  for (const [key, value] of Object.entries(polityOverrides)) {
    if (!value || typeof value !== "object" || text(value.name) !== key) continue;
    const name = historicalPolityName(world, key);
    if (!name || name === key) continue;
    repaired ??= { ...polityOverrides };
    repaired[key] = { ...value, name };
  }
  return repaired ?? polityOverrides;
};
