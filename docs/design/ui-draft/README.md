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
- Imagery is Esri World Imagery and elevation is the Mapzen terrain tiles on AWS, the same services the game uses. The sea is painted from the elevation data, so a realm's tint ends at the coast.

## What is not

- Choosing an answer changes this page only. No rule runs, and nothing is saved.
- The faces are the 24 stand-in portraits the game ships, assigned by hand so that each member of this court has one of their own. The game reuses six of them for this court today.
- Land below sea level, such as the Dutch coast and the Tunisian salt lakes, is painted as shallow water.
- Realm names are placed by hand for this start.
- The accent switch previews the period accent only; the map and the court stay Carolingian.
