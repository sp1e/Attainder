# Living map, slice 3: implementation plan

**Goal:** In a historical campaign on the flat map the camera leans and turns, the campaign opens leaned, and a compass brings the view back.

**Spec:** `docs/superpowers/specs/2026-11-13-living-map-design.md`, "Slice 3: the camera leans".

**Architecture:** The numbers and the rules are pure functions in `historicalCartography.js`. `World.jsx` passes the camera handlers and the terrain exaggeration to `<Map>` and lays the camera flat when leaning stops being allowed. `Nations.jsx` gives the opening framing its pitch. A small component inside `<Map>` draws the compass.

## Global constraints

- A scenario that is not historical gets the same `<Map>` props, the same terrain and the same opening camera as before, and no compass.
- No new player text. The compass is labelled `Reset`, a string every language pack already carries.
- `buildWorldStyle(…)` keeps its call shape.

## Task 1: the rules

**Files:** `src/Game/Map/historicalCartography.js`, `historicalCartography.test.js`.

- `HISTORICAL_REST_PITCH = 42`, `HISTORICAL_MAX_PITCH = 55`, `STOCK_TERRAIN_EXAGGERATION = 15`, `HISTORICAL_TERRAIN_EXAGGERATION = 8`
- `cameraMayLean({ historical, globe }): boolean`: historical and not the globe
- `cameraHandlers(lean): object`: `{ dragRotate, touchPitch, pitchWithRotate }` all `false` without lean; all `true` plus `maxPitch: 55` with it
- `restPitch(lean): number`: 42 or 0
- `terrainExaggeration(historical): number`: 8 or 15
- `cameraOffRest({ bearing, pitch }, rest): boolean`: the bearing is more than half a degree from north (in either direction, 359.8 counts as north) or the pitch more than one degree from `rest`

## Task 2: the map

**Files:** `src/Game/Map/World.jsx`, `src/Game/Map/Nations.jsx`.

- `World.jsx`: `const lean = cameraMayLean({ historical, globe: isGlobe })`; `<Map {...cameraHandlers(lean)}>` in place of the three fixed props; the terrain memo takes `terrainExaggeration(historical)`; an effect lays the camera flat (`jumpTo({ pitch: 0, bearing: 0 })`) when `lean` is false and the camera is not flat, and `handleMapLoad` does the same for a map that mounts with a remembered pitch.
- `Nations.jsx`: the two opening framings (`fitBounds` and `jumpTo`) take `pitch: restPitch(cameraMayLean({ historical, globe: isGlobe }))`.

Source tests in `historicalCartography.test.js`.

## Task 3: the compass

**Files:** create `src/Game/Map/CameraCompass.jsx`; `World.jsx` mounts it inside `<Map>` when `lean`.

`CameraCompass({ rest })` reads the map from `useMap()`, listens to `move`, keeps `{ off, bearing }` in state (set only when either changes by a whole degree), and renders nothing while the camera is at rest. The button stands over the search button (`hudDock.js`), carries `aria-label` and `title` `Reset`, turns its needle by `-bearing`, and on a press calls `easeTo({ bearing: 0, pitch: rest, duration: 500 })`.

## Task 4: evidence

Targeted tests, the build, the full suite, and a browser run on the Charlemagne campaign: the opening view, a right-drag, the compass and its press, and the console.

## Review focus

- A historical campaign with the globe on: no lean, no compass, the camera flat.
- The player switches from the flat map to the globe while leaned: the camera is laid flat.
- 3D terrain off in Settings, or no network: the camera still leans over a flat map.
- A scenario that is not historical: the same props and camera as before.
- An event or a search moves the camera: the pitch is kept, the bearing returns to north.

## Review outcome

An independent review of the first build found two things, fixed in the same change:

- `pitchWithRotate` is read only when MapLibre creates the map. A map created before the campaign was known to be historical would turn but never lean. Whether the camera may lean is now part of the map's key.
- The compass read the camera when it mounted, before the opening framing had leaned it, and showed for a moment at every start. It now waits for the camera's first move.

Noted and left: the realm names are drawn on the sea-level plane, so over high ground they sit a little off the raised land (about 13 km at the Alps, on names that span hundreds); Shift and an arrow key lean any map, as before this change.
