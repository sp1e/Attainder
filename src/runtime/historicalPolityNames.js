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

const fold = (value) => text(value).toLowerCase();
const listOf = (value) => (Array.isArray(value) ? value.map(text).filter(Boolean) : []);
const unique = (values) => values.filter((value, index) => values.findIndex((other) => fold(other) === fold(value)) === index);

// A rename of a scenario's polity changes its label and keeps its key (backlog row 30). Upstream a country IS its
// name, so a rename re-keys the polity and rewrites every store from the old key to the new; done to a historical
// polity that turned its id into a name, and it happened whenever an update merely repeated the polity's own name.
//
// Returns null when `id` is not a polity of a historical scenario (the caller renames the upstream way), else
// { outcome, polityOverrides, from, to }:
//   "same"     the name is the polity's own (its id, its label or the scenario's name): nothing changes;
//   "refused"  another polity answers to the name (its key, label, alias, former name or scenario name);
//   "renamed"  the label is the new name, and the old label stays as an alias and a former name, so text
//              written under it still finds the polity.
export const renameHistoricalPolity = (world, id, newName) => {
  const key = text(id);
  const to = text(newName);
  const overrides = world?.polityOverrides;
  const scenarioName = historicalPolityName(world, key);
  if (!scenarioName || !to || !overrides || typeof overrides !== "object" || !overrides[key]) return null;
  const record = overrides[key];
  const from = text(record.name) || scenarioName;
  const same = { outcome: "same", polityOverrides: overrides, from, to: from };
  if ([key, from].some((own) => fold(own) === fold(to))) return same;

  const polities = Array.isArray(world.historicalScenario.polities) ? world.historicalScenario.polities : [];
  const answersTo = (otherKey, other) => [
    otherKey, other?.name, ...listOf(other?.aliases), ...listOf(other?.formerNames),
    text(polities.find((entry) => text(entry?.id) === otherKey)?.nameSv),
  ].some((name) => fold(name) === fold(to));
  const clash = Object.entries(overrides).find(([otherKey, other]) => otherKey !== key && answersTo(otherKey, other));
  if (clash) return { outcome: "refused", polityOverrides: overrides, from, to, clash: clash[0] };

  const notNew = (name) => fold(name) !== fold(to);
  return {
    outcome: "renamed",
    from,
    to,
    polityOverrides: {
      ...overrides,
      [key]: {
        ...record,
        name: to,
        aliases: unique([...listOf(record.aliases), from]).filter(notNew),
        formerNames: unique([...listOf(record.formerNames), from]).filter(notNew),
      },
    },
  };
};
