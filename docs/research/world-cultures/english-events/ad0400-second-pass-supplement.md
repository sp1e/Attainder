# AD 400–499: English research supplement, second pass

The [dataset](ad0400-second-pass-supplement.json) contains 3 events and 3 source records, 2 at importance 2 and 1 at importance 1. It takes up the four candidates that the [first pass](ad0400-supplement.md) left for a later pass.

| Date | Event | Category | Importance |
|---|---|---|---|
| c. 5th century AD | Construction and painting of the Ajanta caves begin | culture | 2 |
| 434 | The Huns under Attila move west | war | 2 |
| c. AD 450 | Royal tombs at Monte Albán hold ceramic funerary urns | culture | 1 |

## Evidence and chronology

Each event cites one Key Events entry of the Metropolitan Museum of Art's Heilbrunn Timeline of Art History, from the pages "South Asia, 1–500 A.D.", "Eastern Europe and Scandinavia, 1–500 A.D." and "Mexico, 1–500 A.D.". Each source record names the entry by its date phrase and opening words. The research session read the page text only; no images, object records or primary editions were examined.

On 12 November 2026 the live Met pages returned HTTP 429 from a Vercel security checkpoint. The session made no attempt to get past it and read Internet Archive captures of the same URLs instead: South Asia dated 2025-10-24, Mexico dated 2026-02-06, and for the withheld candidate Western and Central Europe dated 2025-12-17 and Great Britain and Ireland dated 2026-04-21. The archive holds no 2025 or 2026 capture of `/toah/ht/05/eue`, so the Eastern Europe source cites the Met's `.html` form of that URL, captured on 2025-08-05. Each locator names its capture date and archive URL. The archive refused a first rapid batch of requests; after a pause the session fetched each capture once.

The Ajanta entry reads "ca. 5th century A.D.", and the record keeps it as the range 401–500 with a note naming Harisena's reign (c. 460–478). Attila's westward move carries the entry's own year, 434; the note keeps 451 and 453 as later stages of the same entry. Monte Albán's tombs keep the entry's "ca. 450" as an approximate date, and the summary keeps the entry's hedge on what the urns depict.

## Review and withholding

The Angle and Saxon settlement of about 430 was withheld. The entry "ca. 430 A.D.", beginning "Angles and Saxons, tribes from southern Denmark", on "Western and Central Europe, 1–500 A.D.", describes the settlement of eastern Britain. `ev-0410-roman-legions-leave-britain` already covers that episode: its summary ends with the mercenary revolt that leads to large Germanic settlements in southeast England. The two Met entries describe the arrival differently, as raiders in the 430 entry and as invited mercenaries in the 410 entry, and a second record would repeat the settlement.

The three retained records passed the duplicate checks. `ev-0370-hunnernas-framryckning-vid-donau` covers the Hun advance of 370–379, which drives the Visigoths into Roman provinces; Attila's campaign of 434 falls outside that range. `ev-bc0500-monte-alban-grundas` (c. 500 BC) and `ev-0050-montealban-dominerar-oaxaca` (c. AD 50) concern the same site with single approximate years, and neither includes 450. No catalog or English record mentions Ajanta, Harisena or the Vakataka. The checks ran against the runtime catalog of 986 events and every English dataset in this folder, by id and by historical episode. The review fields anticipate the independent Claude check that follows this delivery.

An independent Claude check on 2026-11-12 reopened each archive capture and confirmed all three records. It corrected one date note: the Ajanta entry places the work under Vakataka patronage, "particularly under Harisena", and does not call him the leading patron.

Ruling: one institutional timeline, read from an archive capture, supports each record, and each summary stays within its entry. This supplement does not establish complete regional or annual coverage. Compatible English runtime support remains pending; the gameplay catalog, legacy locales and coverage counts remain unchanged.
