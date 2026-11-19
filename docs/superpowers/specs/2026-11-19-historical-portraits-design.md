# The portraits of documented rulers are drawn by the game: design

## Why

Backlog row 29. A ruler at his seat on the map, and a documented ruler in his own court, was drawn with one of eight shared family faces. Eight portraits of documented rulers of AD 800 have been in the repository since 7 November 2026, each with an atlas of 36 pictures (three ages by twelve states): Eirene of Athens, Harun ar-Rashid, Dezong, Aejang, al-Hakam I, Ibrahim ibn al-Aghlab, Alfonso II and Grimoald III (`docs/artwork/gpt-imagegen-2026-11-07.md`). The batch was delivered and not wired in: the game's resolver knew only the 24 first portraits (`person-N-N`) and only atlases in one directory. That note left the integration to this session.

## Goals

- The eight rulers are drawn with their own pictures wherever a person is drawn: at the seat on the map, in the court's thread, on the person card, in the panel.
- Every age and state is the frame the production review recorded, to the pixel.
- A successor, and every person without a picture of his own, shares a portrait as before.
- No picture is generated, edited or moved.

## Non-goals

- The nine starting rulers without a picture (Karl, Leo III, John, Philip II, Muhammad al-Nasir, Jayavarman VII, the generated king of Egypt, Ahuitzotl, Huayna Capac). That needs generation, which needs the owner's yes; the count and the prices are in the backlog row.
- The other documented people of the courts.
- The two galleries under `docs/artwork/`, which describe the 24 first portraits.

## Rulings

1. **A runtime manifest of its own, built from the production manifest.** `src/runtime/characters/portrait-historical.json` holds, per ruler, the original's path and age and the atlas's path, size, bounds and inset. `scripts/build-historical-portraits.mjs` writes it from `docs/artwork/gpt-imagegen-2026-11-07-manifest.json`, whose geometry was reviewed by eye and is bound to the files' hashes; nothing measures a picture again. A test holds the two files equal and the 16 pictures to their recorded hashes and sizes.
2. **The picture is found by the ruler's id.** The portraits are filed under the dossier's ids, which are the ids of the court's persons, and a foreign realm names its ruler by the same id. No mapping table is needed. An id of the form `person-N-N` is never a historical entry, so none of the 24 first portraits can be replaced.
3. **An entry is known only when it names a picture of this game**: an id in lower case and hyphens, an original under `/dynasties/portraits/<batch>/`, an atlas under `/dynasties/portraits/<batch>/variants/`, one of the three ages. Anything else is not known, and the person shares a portrait as if the entry were not there.
4. **The frames leave the seams out.** The production frames are the cells less two pixels on every side. The resolver applies the manifest's inset to a historical atlas and none to the first 24, whose bounds were measured another way.
5. **The label says the face is invented.** A documented person's appearance is an artistic interpretation; the picture's label ends with `konstnärlig tolkning` (English `artistic interpretation`).
6. **The atlas pictures are small.** A cell is about 178 by 237 pixels, against 336 by 448 in the first atlases. The original (1086 by 1448) is drawn for the ruler as painted, healthy and at the painted age; the cells are drawn for every other age and state. Cost: a sick or aged ruler is less sharp on the person card.

## Checks

- `src/runtime/characters/portraitHistorical.test.js`: the manifest, the files' hashes and sizes, all 288 frames against the production review, the child who grows up, the label, a successor, the first 24 unchanged, entries that are not pictures of this game, and the medallion at a seat.
- `src/runtime/characters/portraitAssets.test.js`, unchanged.
- The text checks, the full suite and the build.
- Browser, the Charlemagne test campaign: the seats and the person cards of the neighbouring rulers.
