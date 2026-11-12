# English event research

The owner requested English-only text for new research on 9 November 2026. Codex publishes source-reviewed event datasets here. Claude integrates them with the game's event importer and display code.

## Format

Each century batch uses `schema: attainder-historical-event-research-en-v1` and `locale: en`. The top-level fields are:

| Field | Meaning |
|---|---|
| `schema` | The research format identifier above; distinct from the runtime catalog schema. |
| `locale` | `en`. |
| `preparedOn` | ISO date of this delivery. |
| `batchId` | Stable identifier for the century and research pass. |
| `researchWindow` | Inclusive `startYear` and `endYear` used to select event start years. |
| `integrationStatus` | `awaiting-runtime-support` until the records enter the runtime catalog, then `integrated`. |
| `catalogBaseline` | `commit`, `eventCount` and `sourceCount` of the runtime catalog used for deduplication. |
| `sources` | Source records, each cited by at least one retained event. |
| `events` | Independently approved English research records. |

An event retains `id`, `date`, `category`, `importance`, `sourceIds`, `selectionNote` and `review`. It uses `titleEn`, `summaryEn` and `geographyEn`. The date contains `kind`, `startYear`, `endYear`, `displayEn` and an optional `noteEn`. The `historicalStatus` field records `sourced` or `uncertain`; approval confirms the qualified claim, including any stated uncertainty.

Years are integers, negative for BC, with no year zero; `startYear` must not exceed `endYear`. Allowed date kinds are `exact`, `approximate`, `range` and `disputed`. Exact and approximate dates use equal endpoints. `exact` expresses certainty at year level and can retain an unresolved month in the display and note. A `range` must cover more than one year and retain its complete endpoints even when they extend beyond the research window. A `disputed` date retains the full span between sourced alternatives; that span does not assert a continuous event. The display and `noteEn` identify the alternatives.

Require `noteEn` whenever dating alternatives, approximate estimates or interpretation limits need explanation. A range represents one historical record and supplies no annual recurrence claim. Categories and importance follow the [research brief](../../../development/CODEX-RESEARCH-BRIEF.md#92-event-format). New identifiers use English slugs. Each event must cite at least one source from the same dataset, and every source must support a retained event. Event and source IDs must be unique within their collections and avoid collisions with the runtime catalog and other English datasets. Deduplication also checks historical episodes across both collections, even when identifiers differ.

Source records retain `id`, `title`, `institution`, `url`, `locator`, `retrievedOn`, `originalChronology`, `asWorded`, `scopedClaim` and `reuseTerms`. Official titles and quoted date phrases keep their source language. The locator identifies the passage actually read and any public-summary or extracted-text limitation. A source's scope does not expand to every claim about its subject.

Each event's `review` contains `status: approved`, `reviewedBy` and `reviewedOn`. The accompanying research note reports corrections, withheld candidates and access limits. Private execution logs and machine paths remain outside this repository.

## Integration boundary

The current `validateEventCatalog` requires nonempty Swedish display fields, and `HistoricalEventCard` renders those fields directly. The catalog loader reads only `server/seed/historical/events/catalog.json`. The English locale sidecar references Swedish source strings and their hashes.

On 11 November 2026 all 52 supplements in this folder entered the runtime catalog, and each now reads `integrationStatus: integrated`. The 113 events keep their IDs, dates, categories, importance, source references, selection notes, reviews and historical status. Their Swedish display fields come from [`english-first-sv.json`](../../../../server/seed/historical/events/english-first-sv.json), which remains the record of that translation. The approved English wording sits in `server/seed/historical/locales/en.json`, and the 167 sources gain Swedish source-panel text in `locales/sv.json`. Both sidecars point at research commit `5e8f0bdbaab1784492aa5f631297acfce856057c`.

On 12 November 2026 the five second-pass supplements for AD 400, AD 600, BC0600, BC1400 and BC1600 followed the same path: 18 events and 18 sources, with Swedish display fields in the catalog and the sidecars at research commit `fdad48d561829f01849b528cb9c6530a287248fb`.

A later English batch follows the same path: translate its display fields into Swedish, add the events and sources to the catalog, add the sidecar entries and advance the source revision. In-game availability in each language still needs runtime verification. The [delivery plan](../../../superpowers/plans/2026-11-09-english-event-research.md) records the checks and ownership.
