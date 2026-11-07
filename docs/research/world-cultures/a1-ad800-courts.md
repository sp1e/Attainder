# AD 800 court dossiers

Codex prepared this research batch on 7 November 2026 against main `547b23c9`. The bookmark is `0800-12-25`. The [court dossier](../../../server/seed/historical/courts/ad800-courts.json) covers the eight polities required by batch A1. Its 46 source records support 18 documented people. It adds no generated person.

The researchers completed independent source review and applied its corrections. All eight polities are research-ready. Publication is pending. The researchers opened the cited sources during this session; fresh Codex reviewers received the claims and source records without the draft reasoning.

The dossier supplies research for Claude's court importer. Research acceptance does not establish engine integration, a built scenario, gameplay verification or deployment. Claude owns those changes.

## Coverage

| Polity | Ruler | Living roster | Seat marker | Research limits |
|---|---|---:|---|---|
| Tang | Dezong | 2 | Chang'an / Xi'an | Conflicting reign endpoint; succession mapping remains uncertain |
| Abbasid caliphate | Harun ar-Rashid | 5 | Raqqa / Rafiqa area | Partial household; al-Mamun's heir status disputed |
| Byzantine Empire | Eirene of Athens | 3 | Constantinople | Includes adviser Aetios and religious leader Tarasios; requires eunuch-status handling |
| Silla | Aejang | 2 | Gyeongju | Uncle Eon-seung acts as regent; disputed additional family omitted |
| Emirate of Córdoba | al-Hakam I | 2 | Córdoba | Court-seat inference and religious-institution timing remain uncertain |
| Aghlabid emirate | Ibrahim ibn al-Aghlab | 2 | Kairouan area | Governor appointed in June 800; precise palace and move date unknown |
| Kingdom of Asturias | Alfonso II | 1 | Oviedo | Capital chronology conflicts; no secure additional household member retained |
| Benevento | Grimoald III | 1 | Benevento | Princely title; incomplete household |

The existing Carolingian and papal courts fall outside this batch. The source ids, URLs, locators, original chronologies and claim statuses appear in the JSON. `peopleWithheld` records omissions and reasons. It supplies no complete census of a historical court.

## Dates and survival

The researchers preserve each source's dating in `asWorded` and its source record. They adopt a calendar conversion only when a cited source provides it. None of the exact-day whereabouts entries claims a verified itinerary for 25 December 800.

January 1 birth dates serve the game's date format when the source gives a year, a range or no birth date. The dossier distinguishes uncertain historical years from generated simulation dates. A documented person's generated birth value leaves the person's identity documented. Claude must preserve that distinction during import.

The Tang dossier retains the competing reign endpoints 804 and 805. Both chronologies place Dezong on the throne in 800. The Abbasid dossier retains competing dates for Harun's birth, al-Mamun's birth and designation, and Abu Ishaq's birth. TDV's age 71 for Zubayda can reflect lunar years: its death AH 216 minus birth AH 145 equals 71. No contradiction is established, and the age-calendar convention remains unspecified. Silla's sources give different accession ages for Aejang; the birth-year entry remains visible with that uncertainty.

## Geometry and attribution

The controller checked all eight Getty settlement points with Shapely against their accepted feature indexes in the exact pinned Historical Basemaps GeoJSON. All eight points lie inside their respective polygons. The map commit is `4b5039e50d8d2464b065bd76ad6086cd4597108d`; the source-file SHA-256 is `9d046cdc4662109c3f803ae46e2c8cba941aa092ec86eccc7823e6cf1554920c`.

The accepted polygons represent approximate gameplay regions. They establish no vertex, frontier or uniform control. City points establish no palace, archaeological building location or exact-day itinerary. The dossier uses Kairouan as a settlement marker and does not rename it as al-Abbasiyya. Raqqa represents the residence area at Raqqa/Rafiqa.

Coordinate data credit: J. Paul Getty Trust, Getty Research Institute, [Getty Thesaurus of Geographic Names (TGN)](https://www.getty.edu/research-conservation/tools-databases/vocabularies/data-services/), under ODC-By 1.0. Each seat links to its TGN record and to the licensing claim. Getty's data-service terms apply to vocabulary data. Other cited works remain reference-only; the batch redistributes no source images, maps or extended source prose.

## Rulings for import

- Ruling: retain partial documented households and empty spouse arrays. The sources cannot date every relative or partner to the bookmark. Treating omissions as celibacy would add unsupported personal history.
- Ruling: retain uncertain and generated birth-date labels. January 1 serves the simulation format. Presenting these dates as historical birthdays would invent precision.
- Ruling: record `none-fits` where neither available succession law represents the sourced practice. Tang and Silla retain uncertain `primogeniture` approximations. Forcing other courts into either law would misstate designation, political choice or palace coups.
- Ruling: preserve Silla's regency. Sources place Eon-seung in that role. Removing it would give the child king unsupported personal control.
- Ruling: retain Tang's conflicting reign endpoint. Two inspected sources give 805 and another gives 804. Suppressing the disagreement would overstate chronological certainty.
- Ruling: keep religious claims local and scoped. A royal monastery, temple environment or patriarchate does not establish one universal hierarchy. A broader label could grant unsupported authority to an officeholder.
- Ruling: add the engine-limit code `eunuch-status` for Aetios. PBE identifies him as a eunuch. The importer must preserve that fact and must not assign ordinary fertility from `sex: male`; Claude decides the implementation. Otherwise the simulation could create unsupported reproduction.
- Ruling: include Tarasios as a documented religious leader without asserting membership in the imperial private household. Confusing those roles would invent a residence relationship.
- Ruling: use Raqqa as Harun's city marker and Kairouan as Ibrahim's settlement-area marker. The residence evidence supports those areas, while palace precision remains limited. Treating either marker as an identified palace would overstate spatial knowledge.
- Ruling: preserve the Oviedo chronology conflict. Arias places the royal seat in 791 and Getty dates capital status to 810. The seat claim remains uncertain; a certain label would conceal the disagreement.
- Ruling: retain the stable `duchy-of-benevento` id and propose `Furste` / `Furstendömet Benevento` for display. The inspected scholarly biography uses a princely title. The existing review label requires Claude's correction; no geometry change follows.
- Ruling: retain proposed name-pool identifiers with `namePoolStatus: proposed-unbuilt`. No pool file forms part of A1. Treating those ids as available assets would break import assumptions or trigger fictional replacements.
- Ruling: preserve the distinction between a concubine, an external mother and a linked spouse. The Abbasid sources document those roles separately. Converting external mothers into spouses would invent marriage relationships and survival dates.
- Ruling: separate historical source checks from physical geometry checks. The source-only reviewers confirmed the historical notes; the controller and an independent structural reviewer verified polygon inclusion against the actual map bytes. The dossier retains those geometry results and removes the unsupported comparison with Kairouan's modern centre. Combining these checks would misstate what a historical source establishes.

## Corrections outside the research edit scope

The dossier proposes a correction to `ad800-review.json`, `mapMappings[2].nameSv`: use the princely Benevento display name after Claude checks dependent labels. Codex has not edited that review file. The existing identifier remains stable.

The Byzantine context now contains historical statements, while its uncertain succession claim holds the engine-law assessment. The western corrections replace unread sources, remove the unsupported older-brother assertion and narrow the mosque and Ewanzia claims. Harun's marriage link now cites TDV Zubayda, and Zubayda's age note allows lunar-year reckoning. The final scoped reviewer confirmed these changes and requested a narrower Aghlabid place note; that correction has been applied.

| Review round | Checked occurrences | Confirmed | Corrected | Unsupported |
|---|---:|---:|---:|---:|
| Initial blind checks | 160 | 153 | 6 | 1 |
| Supplement | 4 | 3 | 0 | 1 |
| Final scoped check | 16 | 15 | 1 | 0 |

The dossier preserves the initial counts by polity as audit history. Later rounds recheck changed claims and cover specified notes; they do not increase a unique-claim total. The initial unsupported assertion was dropped. The supplement's unsupported dossier-compliance assertion was replaced with the narrower Getty licensing premise, which the final reviewer confirmed. The final check covered Aejang's personal-name change and the Aghlabid palace aliases. All requested historical corrections have been applied. Source review establishes the historical claims at their recorded precision; separate structural checks establish polygon inclusion and file structure.

## Next work

The controller will complete publication checks. Claude needs to wire the court importer, implement or resolve the listed engine limits, add the proposed name pools in the appropriate workstream, and verify built scenarios in play. A2 covers the five AD 1200 courts after A1 publication.
