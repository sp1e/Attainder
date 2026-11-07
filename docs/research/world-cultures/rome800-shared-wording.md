# AD 800 wording for both playable courts

Claude requested these two replacement texts in section 13 of the research brief after Phase 1 made both Karls rike and Kyrkostaten selectable. The current shared text assigns Aachen to the player without identifying the selected court. The replacements name each game seat and preserve the historical Roman coronation context.

The proposals are research-ready. A fresh source-only check confirmed seven historical occurrences against six reopened source records. A separate read-only implementation check confirmed the game representations. Claude owns the literals, the package rebuild and the release. No implementation or gameplay verification is claimed by this research change.

## Proposed literals

`server/seed/historical/authored-scenarios.mjs`, `ROME_800.noteSv`:

> Ungefärlig ortsmarkör från Getty. Staden hör till påvens område på kartan. Karls rike har Aachen som spelsäte och Kyrkostaten har Rom. Karl var här på bokmärkets dag. Titeln patricius gav den dagen vika för kejsartiteln.

`server/seed/historical/authored-scenarios.mjs`, `AUTHORED_PACKAGES["charlemagne-800"].contextSv`:

> Påven Leo III kröner Karl till kejsare i Rom på juldagen. Karl stannar där hela vintern. Du kan spela Karls rike med Aachen som spelsäte eller Kyrkostaten med Rom som spelsäte. Karls hustru Liutgard dog samma år. I spelet har Karls hov ingen kejsarinna. Du möter dokumenterade personer med genererade spelvärden och genererade hovmän.

The Rome note has 220 characters; the shared context has 334. Both texts apply to either selected polity. The separate statement about Karl’s absent empress describes the current game roster. Liutgard’s death alone would not establish a complete historical marriage history.

## Sources and chronology

| Source record | Passage and supported scope |
|---|---|
| `getty-rome` | [Rome, TGN 7000874](https://www.getty.edu/vow/TGNFullDisplay?english=Y&find=Rome&nation=&place=inhabited+place&subjectid=7000874). TGN 7000874, Rome (inhabited place), coordinate rows Lat and Long directly below the heading. The Rome inhabited-place record gives latitude 41.9000 and longitude 12.4833 in decimal degrees. This supports the existing approximate modern place marker only. |
| `ce-papal-states` | [States of the Church](https://www.newadvent.org/cathen/14257a.htm). Patrimony of St. Peter, consecutive paragraphs covering the 781 agreement: the paragraph reporting Charlemagne's acknowledgement of Adrian's sovereignty in the Duchy of Rome, the following district list, and the caveat about surviving documents; web text lines 79-84. The 1912 article includes the Duchy of Rome among the pope's territories in its account of the 781 agreement. This provides limited historical context for the existing game map assigning Rome to papal-states. |
| `rfa-801-coronation` | [Annales regni Francorum, edited by Friedrich Kurze (1895)](https://archive.org/stream/annalesregnifran00anna/annalesregnifran00anna_djvu.txt). Printed page 112, s.a. 800-801: the Rome Christmas statement immediately before 801 and the coronation paragraph beginning DCCCI; web text lines 7584-7600. Charles celebrated Christmas in Rome. Pope Leo placed the crown on him during mass, and Charles received the imperial title in place of patricius. The annalist changes the year number to 801 at Christmas. |
| `einhard-28` | [Einhard, The Life of Charlemagne, chapter 28, translated by Samuel Epes Turner (1880)](https://sourcebooks.fordham.edu/basis/einhard.asp). Chapter 28, Charlemagne Crowned Emperor, first two paragraphs; web text lines 195-196. Einhard places Charles in Rome for the whole winter and says he received the imperial titles there on a great feast day. |
| `osborne-rome` | [John Osborne, Rome in the Ninth Century, chapter 2: Rome in 800: The Pontificate of Leo III (2023)](https://www.cambridge.org/core/books/abs/rome-in-the-ninth-century/rome-in-800-the-pontificate-of-leo-iii/94D9DA0153DF855322CF10B3645A4651). Public Summary, first sentence, on the publisher's page for chapter 2 (chapter pp. 10-50); web text line 467; DOI 10.1017/9781009415422.002. The public summary dates Pope Leo III's reign to 795-816 and states that he crowned Charlemagne as Roman emperor on 25 December 800. The primary annal and Einhard establish Rome as the event location. |
| `rfa-800-itinerary` | [Annales regni Francorum, edited by Friedrich Kurze (1895), s.a. 800](https://archive.org/stream/annalesregnifran00anna/annalesregnifran00anna_djvu.txt). Printed page 111, revised annal s.a. 800, paragraph starting with the spring departure from Aachen and continuing to Liutgard's illness, death and burial in Tours; web text lines 7519-7528. The annal for 800 identifies Liutgard as Charles's wife and reports her death and burial at Tours. The proposal retains only her death during that year. |

All six source records were retrieved on 7 November 2026. They are references only; no source prose or image is redistributed. The coordinate marker and its existing Getty ODC-By-1.0 attribution remain unchanged. The source-only reviewer also rendered the annal pages to check the OCR reading.

Ruling: preserve the annal’s Christmas-year heading 801 and use Osborne’s public summary for the explicit 25 December 800 alignment. The proposal makes no Julian-to-proleptic-Gregorian conversion. Treating the two year labels as a contradiction or silently changing one would lose the source convention. Only the Cambridge public summary was read; no claim relies on the chapter behind the access restriction.

Ruling: keep the Catholic Encyclopedia’s 1912 reconstruction and documentary-survival caveat explicit. The historical passage supplies bounded context for papal Rome. The sentence about the map is separately supported by the current game assignment; it establishes no surveyed frontier or uniform modern sovereignty.

Keep the current `ROME_800.sourceIds`: `rome`, `regional-ce-papal-states`, `regional-rfa-801-coronation` and `regional-einhard-28`. The existing `regional-osborne-rome` record supplies the exact bookmark alignment and should accompany the day-specific wording when Claude attaches references. The proposed shared context also uses `regional-rfa-800-itinerary` for Liutgard’s death in 800. The final source IDs and their scope remain Claude’s implementation responsibility.

## Separate implementation check

The read-only check used the current authored source and built Charlemagne 1.1.0 data after Phase 1. `carolingian-realm` has Aachen as its seat and `papal-states` has Rome. The playable list and start-option generation include both. Karl’s court has `partnerId: null`, no spouse link and no empress office in its start roster. Both courts contain documented identities with generated mechanics and additional generated courtiers. Rome is assigned to `papal-states` with an approximate boundary in the review and built map. These are code/data observations, separate from historical source claims; no browser test was run.

The inspected authored-source Git blob is `77c25f36fd492902876e55101b51f46c3c6638ab`. Both original strings in the private proposal match the inspected literals. The built package still contains the old wording, so publishing this note alone does not change a player’s copy.

## Review and handoff

The independent historical review records seven checked, seven confirmed, zero corrected and zero unsupported occurrences. It reopened all six records, including two passages in the same annal URL. The technical map and game-representation observations are excluded from those counts. The controller reconciled exact claim/source coverage and the frozen packet/report hashes.

Ruling: deliver the proposed literals through research documentation and leave the optional review-file note edit to the implementation handoff. The builder takes the Rome note from `ROME_800`, so editing only `settlements[0].noteSv` would leave the player-facing text unchanged. The cost is one remaining duplicate note for Claude to align while implementing the release.

Claude must update both authored literals, align the optional review note as appropriate, create the new frozen provenance record, set the bookmark content version to `1.2.0` and rebuild Charlemagne. The brief states that installed 1.1.0 copies then upgrade on the next library read. Those release actions and their verification are outside this research change.

## Publication

[PR #24](https://github.com/sp1e/Attainder/pull/24) merged as `4c1c95d1d40ef97e65090f64df5db844a881a994`, verified on remote main. [The required CI check](https://github.com/sp1e/Attainder/actions/runs/42386554185/job/128445079183) passed with 4,915 tests total, 4,913 passed, zero failed and two TODO; the build completed in 26.93 seconds. Publication delivers the proposals and their evidence. Claude's authored literals, frozen provenance, version bump, rebuild and gameplay checks remain separate work.
