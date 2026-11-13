# Interface draft: the whole game in one view

A design draft, not game code. It shows a look and a layout the game could take: the court as a line of medallions over a living map, what needs the player on the left, the selected person or realm on the right, and the year ahead along the bottom.

## Run it

```sh
cd docs/design/ui-draft
python -m http.server 4270 --bind 127.0.0.1
```

Open http://127.0.0.1:4270/index.html. The map needs a network connection for its tiles.

## What is real

- The map engine is the game's own, MapLibre GL JS 5.19.0, vendored under `vendor/`.
- `data/polities-800.geojson` and `data/places-800.json` come from the shipped Charlemagne AD 800 package: the eleven owned polity surfaces, the seats and the border tribes.
- `data/court-802.json` is an export of a test campaign through `getCharacterPresentation` (Karls rike, 25 December AD 802): people, skills, open decisions with their choices, offices and neighbours.
- Imagery is Esri World Imagery and elevation is the Mapzen terrain tiles on AWS, the same services the game uses.
- The coast is Natural Earth's 1:50m land, from `server/seed/historical/sources/ne_50m_land.geojson`. The polity surfaces are clipped to it and `data/sea.geojson` is its complement, so a realm's tint ends at the coast and low land stays land. Elevation deepens the open water and draws the snow line.

## What is not

- Choosing an answer changes this page only. No rule runs, and nothing is saved.
- The faces are the 24 stand-in portraits the game ships, assigned by hand so that each member of this court has one of their own. The game reuses six of them for this court today.
- The year turn passes the months and the seasons and invents no events.
- The revenue figure opens only what the game's view holds today: the total and each city's tax.
- Realm names are placed by hand for this start, and small realms are named under their seat.
- The accent switch previews the period accent only; the map and the court stay Carolingian.
