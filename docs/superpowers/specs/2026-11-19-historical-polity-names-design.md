# A historical polity keeps its name: design

## Why

The walk through English mode on 18 November 2026 found place chips titled `Show byzantine-empire on the map`. The cause is older than the chips and is not a matter of language.

An authored historical package keys a polity by a stable id (`byzantine-empire`) and names it apart (`historicalScenario.polities[].nameSv`, copied into `polityOverrides[id].name`). Upstream, a country is its name: the key of `polityOverrides` doubles as the label. The code that applies an event's `polityChanges` wrote `name: code` on every update (`applyPolityAndTerritoryImpacts` in `src/runtime/gameState.js`). In a historical campaign every update of a realm therefore replaced its name with its id.

Measured on the Charlemagne test campaign: at 25 December AD 802 two of ten realms were labelled by their ids; after five model-written years, at 25 December AD 806, five were (`aghlabid-emirate`, `emirate-of-cordoba`, `abbasid-caliphate`, `tang-empire`, `byzantine-empire`). Each had been updated by an event; the five that kept their names had not. The id shows wherever the realm is named: the map's own label (`ABBASID-CALIPHATE`), the chips under an event, the lists.

## Goals

- An update of a historical polity leaves its name as it is.
- A campaign whose labels were already overwritten reads the scenario's names again, without a migration step.
- Nothing changes outside a historical package.

## Non-goals

- A rename by the model was left as upstream has it when this was written; ruling 4 took it up the same day (backlog row 30).
- Events already saved keep what the model wrote in them (`places: [{ kind: "country", name: "byzantine-empire" }]`). Their chips read the realm's name through the repaired label.

## Rulings

1. **On update, a historical polity carries the name it has.** If that name is missing or is the id, it carries the scenario's name for the id. Outside a historical package the label is the key, as before. Cost if wrong: one function (`updatedPolityName`).
2. **The repair is made on read, in both readers.** `normalizeWorldState` gives a polity the scenario's name when its label equals its key and the scenario names that id otherwise. The map's store reads the raw world without that normalizer (`src/Game/Map/useWorldState.js`), so it makes the same repair; the first browser run after the fix showed the chips under the events corrected and the map's own labels still hyphenated. The rule lives once, in `src/runtime/historicalPolityNames.js`, and returns the object it was given when nothing was overwritten, because the store compares references. A label that is anything else stands: a scenario edited as a copy, or a later rename. The repaired world is what the next write stores, so a save heals when it is next written. Cost if wrong: a polity an author named exactly by its id gets the scenario's name; no package does that.
3. **The scenario's name is the Swedish source name.** It is read in English through the book like every other name of the package.
4. **A rename changes the label and keeps the key** (added 19 November 2026, backlog row 30). Upstream a rename re-keys the polity and rewrites every store from the old key to the new. The tests written for this ruling showed two things the non-goal had not known: an update that merely repeated a polity's own name (`code: "byzantine-empire", name: "Bysantinska riket"`) re-keyed it from its id to its name, and a rename to another realm's name was not refused, because the upstream check compares keys and the realms' keys are ids. `renameHistoricalPolity` (`src/runtime/historicalPolityNames.js`) answers for a scenario's polity: the polity's own id, label or nothing new is no rename; a name another polity answers to (its key, label, alias, former name or scenario name) is refused; otherwise the label becomes the new name and the old label stays as an alias and a former name, so text written under either finds the polity. A polity the scenario does not list (one the model founded) is renamed the upstream way. The review of the first version found that the old label did not in fact find the polity in the next event: the owner resolver was rebuilt only after an upstream rename, and the preview used while an event is read dropped the name being replaced, so a transfer to `Bysantinska riket` right after the rename founded a second polity. The test had hidden it by placing a polity change in between. The resolver is now rebuilt after any event that changed a polity, the preview keeps the replaced name as an alias, and a scenario's polity that has no record of its own is renamed by label too. Left: a label that is a modern country's English name is not folded onto its polity by the alias map (`COUNTRY_NAME_KEYS` in `ownerNames.js`), so a later event that uses it founds a second polity.

## Checks

- `src/runtime/gameState.historicalPolityName.test.js`: an update by id, an update by name, a name given apart from the scenario's, the repair on read, a world without a historical package, the map store's repair, and for ruling 4 a repeated name, a rename followed by events under both names, and a refused rename.
- The full suite and the build.
- Browser, the Charlemagne test campaign at AD 806 in English: the map's labels and the chips under the events name the five realms. The README's banner and screenshot are taken again from that run.
