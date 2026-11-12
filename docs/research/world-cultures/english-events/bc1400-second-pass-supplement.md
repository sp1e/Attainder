# 1400–1301 BC: English research supplement, second pass

The [dataset](bc1400-second-pass-supplement.json) contains 4 events and 4 source records: none at importance 3 or 2, and 4 at importance 1. It takes up the four candidates that the [first pass](bc1400-supplement.md) left for a later pass.

| Date | Event | Category | Importance |
|---|---|---|---|
| c. 1400 BC | Soconusco villagers place luxury goods in burials | culture | 1 |
| c. 1400 BC | Highland villages of central Mexico make detailed ceramic figurines | culture | 1 |
| c. 1400 BC | A greenstone celt is buried as an offering at Paso de la Amada | religion | 1 |
| c. 1350–1000 BC | Kassite boundary stones record royal grants | culture | 1 |

## Evidence and chronology

Each event cites one Key Events entry of the Metropolitan Museum of Art's Heilbrunn Timeline of Art History, from the pages "Mesoamerica and Central America, 2000–1000 B.C." and "Mesopotamia, 2000–1000 B.C.". The first pass cited the Mesoamerica page. It named the Kassite boundary stones as a candidate without citing the Mesopotamia page, which sits in the same series at `https://www.metmuseum.org/toah/ht/03/wam`. Each source record names the entry by its date phrase and opening words. The research session read the page text only and examined no images, object records or primary editions.

On 12 November 2026 the live Met pages answered every request, from WebFetch and from curl, with HTTP 429 and a Vercel security checkpoint. The session made no attempt to pass the checkpoint. It read each page from its Internet Archive capture of the same URL: the Mesoamerica page from 22 April 2026 and the Mesopotamia page from 12 March 2026. Each source locator names the capture. The captured pages carry the Met's own titles and citation lines. An independent check should compare the entries with the live pages once the checkpoint lifts.

The Met dates all four entries with "ca.". The three entries at about 1400 BC become approximate dates with `noteEn`. The kudurru entry describes a monument type over the span 1350–1000 BC, so the record keeps the range and its `noteEn` says it marks no single act. The kudurru entry also covers Assyrian cylinder seals in the north; the record leaves that part out. The celt entry calls Paso de la Amada "a major village in the highlands of Chiapas". The catalog's two Paso de la Amada records place the site on the Pacific coast in the Soconusco region. The summary and geography name only Chiapas, and `noteEn` records the difference.

## Review and withholding

Duplicate checks ran against the runtime catalog (986 events) and every English dataset in this folder, by id and by historical episode. Each candidate has its own Key Events entry, so no entry covers two candidates. The Tlatilco entry names Tlapacoya and Las Bocas as well, and one record keeps all three villages.

- Soconusco burial goods: added as `ev-bc1400-soconusco-luxury-burials`. The entry is one sentence, but it names the goods (ceramic figurines, stone bowls, greenstone beads), so the summary carries more than the title. The catalog's Soconusco records, `ev-bc1900-kakaodryck-i-paso-de-la-amada` (1900–1500 BC) and `ev-bc1650-paso-de-la-amada-ballcourt-built` (1650–1600 BC), concern one site, and neither range includes 1400 BC.
- Tlatilco figurines: added as `ev-bc1400-central-mexican-figurine-villages`. The catalog's `ev-bc0900-chalcatzingo-terraces-and-reliefs` names Tlatilco only for Olmec-style ceramics about 900 BC, a different episode and date.
- Paso de la Amada celt: added as `ev-bc1400-paso-de-la-amada-celt-offering`. The two Paso de la Amada records above cover cacao use and the ballcourt, and neither range includes 1400 BC.
- Kassite boundary stones: added as `ev-bc1350-kassite-kudurru-boundary-stones`. The catalog's `ev-bc1155-kassitdynastin-faller` records the fall of the Kassite dynasty in 1155 BC, a separate episode.

No candidate was withheld. Every page opened from its archive capture.

An independent Claude check on 2026-11-12 reopened each archive capture and confirmed all four records. It retitled the figurine record, because the entry gives the figurines to highland villages in central Mexico and names Tlatilco only among the villages that establish precedence. The check kept the Paso de la Amada celt: the record never repeats the entry's "highlands of Chiapas", Chiapas holds for both the highlands and the coast, and the date note reports the conflict with the catalog. Later edits must not add "highlands" to its summary or geography.

Ruling: one institutional timeline supports each record, read from an archived capture of the cited page, and each summary stays within its entry. This supplement does not establish complete regional or annual coverage. Compatible English runtime support remains pending; the gameplay catalog, legacy locales and coverage counts remain unchanged.
