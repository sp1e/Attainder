# One colour per realm of a start: design

## Why

Backlog row 27. `scripts/build-historical-scenarios.mjs` deals six colours to a package's polities by index (`i % 6`). Three packages have six realms or fewer. Charlemagne has ten, so four colours are held by two realms each: Karls rike and Silla, the Aghlabids and Tang, Asturias and Byzantium, Benevento and Kyrkostaten. The last pair border each other in Italy, and the map drew them as one realm with a line through it.

The colour lives in `polityOverrides[id].color`, in the package and in every save made from it (`colors.json` is empty in a historical campaign). The map reads it for the realm's fill.

## Goals

- Each realm of a start is drawn in a colour no other realm of that start holds.
- Campaigns already started get the same colours as new ones, without a migration step.
- A colour somebody chose stays.

## Non-goals

- No new release of Charlemagne for this. A release changes what new campaigns get and nothing in a campaign already started; the repair below covers both. When the package is next rebuilt for another reason, the builder can deal distinct colours and the repair has nothing left to do.
- Two different colours that look alike are left: Karls rike's gold (`#c49b53`) and the Abbasids' khaki (`#a78c5a`) do not border each other.
- Units and markers take their colours from `colors.json`, as before.

## Rulings

1. **The repair is made on read, in both readers**, like the names of 19 November (`2026-11-19-historical-polity-names-design.md`): `normalizeWorldState` and the map's store. The rule lives once, in `src/runtime/historicalPolityColors.js`, and returns the object it was given when nothing changes. The repaired world is what the next write stores.
2. **Only the builder's shared colours are replaced.** A realm of the scenario keeps its colour unless it is one of the builder's six and an earlier realm of the scenario, in the scenario's order, holds the same one. The first holder keeps its own. A colour that is not one of the six is somebody's choice (the model's, a cheat's, an edited copy's) and stands, shared or not. A polity the scenario does not list is left alone. Cost if wrong: a realm keeps a colour it shares.
3. **A realm that gives its colour up takes the first extra colour no realm of the scenario holds**, from a fixed list of ten in the muted family of the six. The order is fixed, so the same save always gets the same colours. For Charlemagne: Silla `#b9728c`, Tang `#c57f45`, Byzantium `#9c4f72`, Kyrkostaten `#6f9a52`.
4. **The first four extras were chosen by looking at the map.** Byzantium first took a teal and read as sea along its coasts; it takes a porphyry red. Kyrkostaten first took an olive and sat too close to the gold on both sides of it; it takes a green.

## Checks

- `src/runtime/historicalPolityColors.test.js`: the builder's six as the packages were built; Charlemagne's ten realms in ten colours with the first holders unchanged; the three other packages and an already repaired save returned as they were; a chosen colour, a held extra, a polity outside the scenario and a world without a package; both readers.
- The full suite and the build.
- Browser, the Charlemagne test campaign at AD 806: Byzantium, Kyrkostaten and Benevento each in their own colour. The README's banner and screenshot are taken again.
