// One colour per realm of a historical start.
// Spec: docs/superpowers/specs/2026-11-19-realm-colours-design.md.
//
// scripts/build-historical-scenarios.mjs deals six colours to a package's polities by index, so a package with
// more than six realms repeats them: Charlemagne's ten share four colours in pairs, and two of the pairs border
// each other. The colour lives in polityOverrides[id].color, in the package and in every save made from it. The
// repair is made on read, in the game state's normalizer and in the map's store, like the names
// (historicalPolityNames.js). No imports: the map's store reads the raw world.

// The six colours the builder deals, in its order.
export const BUILDER_REALM_COLOURS = Object.freeze(["#c49b53", "#ad6c5c", "#678b72", "#8f759e", "#66869d", "#a78c5a"]);

// What a realm takes when an earlier realm of its start already holds its colour, in the order they are handed
// out. The same muted family as the six. The first four go to Charlemagne's Silla, Tang, Byzantium and
// Kyrkostaten: no blue or green for Byzantium, whose coasts would read as sea (seen in the first browser run).
export const EXTRA_REALM_COLOURS = Object.freeze([
  "#b9728c", "#c57f45", "#9c4f72", "#6f9a52", "#6f73a6", "#4f9a94", "#6aa6ba", "#94704f", "#5a7fb5", "#b4a03f",
]);

const colourKey = (value) => (typeof value === "string" ? value.trim().toLowerCase() : "");
const BUILDER = new Set(BUILDER_REALM_COLOURS);

// The world's polity records with each scenario realm in a colour of its own. A realm keeps its colour unless it
// is one of the builder's six and an earlier realm of the scenario (in the scenario's order) holds the same one;
// then it takes the first extra colour no realm of the scenario holds. A colour that is not the builder's is a
// choice someone made and stands, shared or not. Returns the object it was given when nothing changes.
export const withDistinctPolityColors = (polityOverrides, world) => {
  if (world?.historicalScenario?.kind !== "historical" || !polityOverrides || typeof polityOverrides !== "object") {
    return polityOverrides;
  }
  const ids = (Array.isArray(world.historicalScenario.polities) ? world.historicalScenario.polities : [])
    .map((polity) => (typeof polity?.id === "string" ? polity.id.trim() : ""))
    .filter((id) => id && polityOverrides[id] && typeof polityOverrides[id] === "object");
  const held = new Set(ids.map((id) => colourKey(polityOverrides[id].color)).filter(Boolean));
  const seen = new Set();
  let repaired = null;
  for (const id of ids) {
    const colour = colourKey(polityOverrides[id].color);
    if (!colour) continue;
    if (!seen.has(colour) || !BUILDER.has(colour)) {
      seen.add(colour);
      continue;
    }
    const next = EXTRA_REALM_COLOURS.find((candidate) => !held.has(candidate));
    if (!next) continue; // More shared colours than extras: the rest keep what they have.
    held.add(next);
    seen.add(next);
    repaired ??= { ...polityOverrides };
    repaired[id] = { ...polityOverrides[id], color: next };
  }
  return repaired ?? polityOverrides;
};
