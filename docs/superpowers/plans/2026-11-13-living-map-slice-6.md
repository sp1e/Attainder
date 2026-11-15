# Living map, slice 6: implementation plan

**Goal:** In a historical campaign each realm's ruler stands at the realm's seat as a medallion that opens the court.

**Spec:** `docs/superpowers/specs/2026-11-13-living-map-design.md`, "Slice 6: rulers at their seats".

**Architecture:** A pure module turns the package's cities and the court's presentation into a list of medallions. A component inside `<Map>` loads the two inputs, keeps them current, and renders one MapLibre marker per medallion. The engine's presentation of a foreign realm gains the ruler's id and sex.

## Global constraints

- A scenario that is not historical, and a campaign without a character system, get no markers and no extra reads.
- No new player text: a medallion's label is the ruler's name and the realm's name.
- The character engine stays out of the page's first download: the component imports it with `import()`.
- A press on a medallion must not reach the map's own click handler.

## Task 1: the engine's two facts

**Files:** `server/characters/foreignRealms.js`, its test.

`presentForeignRealms` rows also carry `rulerId` and `rulerSex`.

## Task 2: the list

**Files:** create `src/Game/Map/seatRulers.js`, `src/Game/Map/seatRulers.test.js`.

- `seatsOf(cities): Array<{ polityId, cityName, longitude, latitude }>`: the features with `seat === true`, an `owner` and a point with finite coordinates; the first per owner.
- `foreignRulerPerson(realm): person`: `{ id, name, sex, age, portraitState }` for the portrait component's asset lookup, with the shared portrait identity of the ruler's id and sex and the age group of the ruler's age; without a `rulerId`, a person with the name only.
- `seatRulers({ cities, view, playerPolity }): Array<{ polityId, own, cityName, longitude, latitude, realmName, rulerName, person }>`: the player's realm with `view.ruler`; a foreign realm when `view.foreignRealms` has it; the player's realm last, so it is drawn over the others.
- `medallionOf(person): { kind: "image" | "atlas", src, rect?, width?, height? } | { kind: "initials", text }`.

Tests: seats without the flag, without an owner or without a point are left out; a second seat of a realm is left out; the player's realm takes `view.ruler` and is last; a realm the court does not keep is left out; a foreign ruler gets a shared portrait of the right sex and an age group by age; a view without a ruler gives no medallion for the player's realm; `medallionOf` gives an image or an atlas crop for a person with a portrait and initials for one without.

## Task 3: the map

**Files:** create `src/Game/Map/SeatRulers.jsx`; `src/Game/Map/World.jsx` mounts it inside `<Map>` when `historical`.

`SeatRulers` reads the cities (`readJson(JSON_URLS.citiesGeojson)`) and the visible character state (`readVisibleCharacterState`, through `import()`), again when the world's character revision changes and on `oh:characters-updated` and `oh:cities-updated`. It renders a react-map-gl `Marker` per medallion, anchored at the bottom over the city sign. The marker's click stops the native event and dispatches `oh:open-characters`.

Source tests in `seatRulers.test.js`.

## Task 4: evidence

Targeted tests, the build, the full suite alone, and a browser run on the Charlemagne campaign: the opening view, Italy close in (Rome and Benevento), a press on a foreign ruler and on the player's, and the console.

## Review focus

- A read that fails or arrives after a newer one: no stale medallions, no unhandled rejection.
- The campaign changes ruler (succession): the medallion follows without a reload.
- A press on a medallion: the court opens and no province popup does.
- A leaned and turned camera: the medallions stay upright over their seats.
- The page's first download: the character engine is still a separate chunk.

## Review outcome

An independent review of the first build found these, fixed in the same change:

- The cities file is never cached, and the component read it on every change of the court: two reads of the whole file at each turn. The cities are now read once per campaign and when the city editor announces a change; the court is read when its revision moves.
- A campaign change left the old campaign's court in the component until the first read came back. Both reads now follow the active campaign and are cleared when it changes.
- Reading the court can start the recovery of an interrupted transaction. The map now waits while one is pending.
- MapLibre gives a marker's wrapper the role of a button named "Map marker", around the real button. The wrapper is now presentational, and a double press no longer zooms the map.
- A foreign ruler whose sex the presentation does not give was drawn with a woman's portrait, and a ruler whose age variant is missing as a child. Both are now drawn as initials.

Found while checking the plan: the character engine is already part of the page's first download (`src/Game/AI/gameplay.js` imports it), so importing it on demand here keeps the map's chunk small but changes nothing for the first download.
