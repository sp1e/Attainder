# Historical scenario content

The first two authored packages cover Egypt around 3000 BC and John of England on the game's chosen day of 31 December 1200. They live under `server/seed/historical/`. Task 2 supplies content, provenance, validation and opt-in map behavior. The current default and new-game flow remain unchanged until the later activation task. A source citation establishes only the claim described beside it.

| Content ID | Game bookmark | Playable polity | Household |
| --- | --- | --- | --- |
| `egypt-3000bc` | `-3000-01-01` | Early Dynastic Egypt | Generated king, partner and court families |
| `john-1200` | `1200-12-31` | John's realms, a composite gameplay aggregate | Documented John and Isabella; generated supporting court |

These days select a simulation snapshot. The sources do not establish an Egyptian event on 1 January 3000 BC, a Gregorian conversion of the medieval wedding date, or the royal couple's presence at Windsor on the chosen day. The schema uses the game's proleptic Gregorian calendar without year zero. It retains source chronology, including approximate years, centuries, BP estimates and paired Islamic/AD dates. The supported start-policy range begins in 3300 BC; these packages supply no researched 3300 BC bookmark or interval interpolation.

## Egypt and its generated household

The Egyptian Ministry places unification and Memphis within the Early Dynastic period, approximately 3100–2686 BC. This supports the state and capital around 3000 BC. It does not identify a king for that exact year. The authored king, spouse, family groups, names and relationships therefore carry generated-origin claims. The ruler's title is **kung**. The religious context draws on the Met's account of early Horus names; religious offices and numerical resources follow game rules. [Egyptian Ministry, Early Dynastic Period](https://egymonuments.gov.eg/historical-periods/early-dynastic-period/), [Met, Stela of King Raneb](https://www.metmuseum.org/art/collection/search/545799).

The Memphis marker copies Getty's modern Mit Rahina reference point, `[31.25, 29.85]`, with attribution and ODC-By terms. The Swedish note describes its approximate position beside the ancient site. It makes no claim to an excavated early palace. [Getty TGN 7001186](https://www.getty.edu/vow/TGNFullDisplay?english=Y&find=Heidelberg&nation=&place=inhabited+place&subjectid=7001186), [Getty vocabulary licensing](https://www.getty.edu/research-conservation/tools-databases/vocabularies/data-services/).

The conversion accepts upstream Egypt feature 19 as a disclosed world-scale approximation. Neither the ministry nor the map publisher provides evidence for each frontier vertex. The package retains that limitation in the polity, region and source records. It does not assign Ur's polygon to Uruk, select Menes from a legend, or backdate a later Egyptian titulary.

## John, Isabella and composite allegiance

Westminster Abbey dates John's accession to 1199 and his marriage to Isabella of Angoulême to 24 August 1200. The chosen bookmark follows that marriage and her October coronation. John and Isabella have sourced identity and spouse claims. John's 1167 birth year remains uncertain; Isabella's circa-1188 birth becomes an explicitly estimated `1188-01-01` engine date. The package adds no future children and no invented royal parentage. Generated court families represent gameplay households. [Westminster Abbey, John](https://www.westminster-abbey.org/abbey-commemorations/royals/john), [Nicholas Vincent, Oxford DNB, Isabella](https://academic.oup.com/oxford-dictionary-of-national-biography/reference/63486/reference-article-abstract/580767093).

Windsor serves as a gameplay seat because the Royal Collection Trust describes royal accommodation there before 1200. Its point uses Getty's Windsor inhabited-place record, `[-0.6, 51.4833]`, rather than the earlier restrictive Heritage Gateway coordinate lead. The point marks the town; the household's location on the chosen day remains unknown. [Royal Collection Trust, Windsor origins](https://www.rct.uk/visit/windsor-castle/who-built-windsor-castle), [Getty TGN 7011919](https://www.getty.edu/vow/TGNFullDisplay?english=N&find=&nation=Uganda&place=&subjectid=7011919).

Ruling: **Johns riken (angevinskt välde)** denotes composite simulation control. Parliament identifies his English crown and French possessions; the National Archives explains the French vassal relationship. The reviewed Oxford publisher excerpt describes Arthur as John's liegeman under the 1200 settlement. The continental geometry therefore includes a Brittany/Arthur qualification. This model does not claim uniform direct administration. If the abstraction proves inadequate, a later revision must split separately sourced jurisdictions. [UK Parliament, John's possessions](https://www.parliament.uk/about/living-heritage/evolutionofparliament/originsofparliament/birthofparliament/overview/magnacarta/magnacartahow/), [National Archives, printed pages 13–14](https://cdn.nationalarchives.gov.uk/documents/education/magna-carta-preparation-pack.pdf), [Historical Research, passage near notes 121–126](https://academic.oup.com/histres/article/96/274/409/7277167).

The authored mapping accepts both components of upstream Angevin feature 275. Regression points include Windsor, Rouen, Bordeaux, Angers and Rennes; negative points include Edinburgh, Gwynedd, Cardiff, Dublin, Connacht, Paris and Toulouse. The source contains no Irish component. The package discloses that omission rather than inventing Irish control geometry. These rounded points test coarse placement. They are not historical settlement coordinates or proof of exact local borders.

## Worldwide political coverage

The packages preserve a record for each of the 424 upstream features: original properties, geometry hash, review classification, evidence IDs, mapping decision and any quarantine. `ad1200-review.json` and `bc3000-review.json` hold authored research inputs. The build ships their scoped decisions in `world.historicalScenario.regionReview`, alongside the referenced sources. An unresolved label remains unresolved after review; a recognizable name does not establish its chronology or frontier.

| Area | Around 3000 BC | AD 1200 |
| --- | --- | --- |
| Africa | Approximate Egypt. Pre-Kerma and other societal evidence cannot create a Kerma kingdom at this date. Broad Bantu distribution withheld. | Approximate, partial Almohad coverage. Fatimid ownership rejected; Ayyubid identity does not inherit its old polygon. Other control remains unresolved. |
| Asia | Proto-Elamite, Early Harappan and other cultural evidence retains unknown political control. Ur/Uruk territorial mismatch withheld. | Approximate Western Xia and Khmer regions. Wrong-era Liao, Mongol, Buyid, Ghaznavid, Pyu and Delhi labels withheld. Song, Chola, Khwarazm and Bagan extent conflicts remain unresolved. |
| Europe | Cultural context, including early Cycladic and Minoan evidence, establishes no common rulers. | John's composite realms and France feature 277 use approximate feudal-region abstractions. Remaining unreviewed control stays unknown. |
| Americas | Caral-Supe and Valdivia support regional societies; their polygons gain no invented monarch. | Approximate Chimú core around Chan Chan. Wari, Tiwanaku and Toltec imperial ownership rejected for this date. |
| Oceania | Indigenous Australian and Tasmanian presence does not establish one sovereign. Later Polynesian distribution is not backdated. | Tonga's chiefly influence remains distinct from island-by-island sovereignty; ownership geometry withheld. |
| Antarctica | Physical reference only; no population or control claim. | Same. |

The medieval approximation decisions use coarse regional alignment and core-location checks, while retaining the publisher's boundary uncertainty. Supporting sources include [Met, China timeline](https://www.metmuseum.org/zh/toah/ht/07/eac), [Met, Khmer chronology](https://www.metmuseum.org/fr/toah/ht/07/sse.html), [Met, Maghrib chronology](https://www.metmuseum.org/pt/toah/ht/07/afw), [Met, France chronology](https://www.metmuseum.org/fr/toah/ht/07/euwf.html), and [UNESCO, Chan Chan](https://whc.unesco.org/en/list/366/). The Chan Chan regression uses UNESCO's published coordinate, not the earlier rounded point that fell across the source boundary.

The Bronze Age review covers all 25 named source features. It separates two supported local settings, 13 cultural/contextual classifications, five unresolved labels and five rejected date/distribution claims. These counts describe review decisions, not historical states or population coverage. Direct references and remaining questions appear in the review input. Among them: [UNESCO, Caral-Supe](https://whc.unesco.org/en/list/1269), [Iranica, Proto-Elamite](https://www.iranicaonline.org/articles/elam-iii/), [Kerma mission, Pre-Kerma](https://kerma.ch/pre-kerma-agglomeration/), and [National Museum of Australia, early Tasmania](https://www.nma.gov.au/defining-moments/resources/the-black-line).

## Physical land and geometry authority

The independent physical backdrop uses Natural Earth's 1:50m land at commit `ca96624a56bd078437bca8184e78163e5039ad19`. It restores Pacific land absent from the historical polygons. This is generalized present-day land, including its omissions at that scale; it does not reconstruct ancient coastlines, river courses or settlement. [Natural Earth land](https://www.naturalearthdata.com/downloads/50m-physical-vectors/50m-land/), [publisher terms](https://www.naturalearthdata.com/about/terms-of-use/).

The converter subtracts accepted political polygons from that land and marks the remainder **Okänd historisk kontroll**. These computational pieces receive no administrative borders or polity records. Unknown control does not mean uninhabited or available land. Tests check that a single reviewed region owns each seat in the shared placement pipeline and that unknown pieces create no polity labels.

Historical geometry remains authoritative at close zoom, even if an imported region ID matches a modern tile. Historical map rendering, flag resolution, country-list assembly and place search suppress modern fallback. A missing historical city asset leaves an empty city layer. Modern saves retain their existing behavior. The map selection card labels unknown control and marks accepted regions as approximate.

The conversion quarantines AD 1200 features 214 (Goryeo, self-intersection) and 240 (degenerate unnamed geometry). It assigns no replacement ownership. Natural Earth keeps the land visible. The generated release has valid polygons under an independent Shapely audit; runtime tests also cover holes, closed rings, dateline component handling and source-based placement. Browser appearance and campaign interaction remain the later integration task's responsibility.

## Schema and court contract

`validateHistoricalScenario({ game, world, regions, assetManifest }, { date, polityId })` performs pure structural checks. Success returns `{ ok: true, contentId, contentVersion, date, polityId }`. Failures return a code and one Swedish refusal. It verifies canonical supported dates, exact bookmark availability, source references, unique IDs, region owners, world overrides, settlement placement, playable courts, identity origin, claim certainty and asset metadata. It never treats a URL as proof that a human reviewed its claim.

`world.historicalScenario` schema version 1 contains:

- Content identity, exact bookmark and calendar; optional researched validity endpoints require source IDs.
- Sources with title, author/institution, URL, locator, retrieval date, original chronology, uncertainty and reuse terms.
- Polities, playable polity IDs, settlements, continental coverage notes, per-source-feature review and the asset manifest.
- `courtSeeds[polityId]` with `people`, `families`, `religions`, `offices` and `cities` arrays; `rulerId` and `seatId` link those records.
- Claim records `{ status: 'sourced' | 'uncertain' | 'generated', sourceIds, noteSv }`. A documented person still has generated mechanics and may have uncertain dates.

Each person carries `identityOrigin`, a Swedish origin label, family/religion IDs, authored birthdate, `legalParentIds`, `spouseIds`, claim metadata and generated mechanical inputs. The factory in Task 3 must convert these seeds to the existing character engine shape. Court provenance describes public authorship; it must not receive private loyalty, secrets or other hidden runtime facts. Family grouping, succession, official roles and resources remain authored mechanics. A contested settlement requires no forced owner: use `polityId: null`, `placement: 'contested'`, competing polity IDs, a source and an explanatory note. It cannot silently become the controlled court seat.

## Reproduction and component terms

Run `node scripts/build-historical-scenarios.mjs` to rebuild, or append `--check` to compare committed bytes without writing. The converter uses local pinned inputs and no clock or network. Each bookmark contains `scenario.json`, `regions.geojson`, `cities.geojson` and `manifest.json`. Input hashes cover upstream files and authored review inputs; asset hashes cover compact JSON followed by LF. Source-feature hashes use `JSON.stringify(geometry)` in the pinned file's property order. Git attributes preserve input and output bytes across platforms.

Historical Basemaps uses commit `4b5039e50d8d2464b065bd76ad6086cd4597108d`. Its root license supplies GPL version 3; its README preserves collection credits and warns that reconstruction remains incomplete. The release includes the original selected GeoJSON, full license, README and contributor notice, plus modification descriptions. This records the publisher's stated terms and source chain; it does not certify historical precision or the rights of each earlier collection contributor. [Pinned upstream source and notices](https://github.com/aourednik/historical-basemaps/tree/4b5039e50d8d2464b065bd76ad6086cd4597108d).

The bundle's CC BY record covers authored content. `componentLicenses` identifies embedded GPL geometry, Natural Earth public-domain physical data and Getty ODC-By location data. Both stores retain these records and asset provenance in world state. JSON exports preserve them; ZIP and suggestion exports include component notices and corresponding source entries. Re-importing and exporting on either adapter preserves original source hashes, license text and transformation records. Ordinary authored scenarios retain their existing CC BY behavior. Application AGPL notices remain in place.

Annual historical-event research, the turn-end reference popup, additional dates and more detailed political frontiers remain separate work. This release does not fill those gaps with generated history.
