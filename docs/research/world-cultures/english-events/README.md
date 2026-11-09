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
| `integrationStatus` | `awaiting-runtime-support` until a compatible importer and display path are verified. |
| `catalogBaseline` | `commit`, `eventCount` and `sourceCount` of the runtime catalog used for deduplication. |
| `sources` | Source records, each cited by at least one retained event. |
| `events` | Independently approved English research records. |

An event retains `id`, `date`, `category`, `importance`, `sourceIds`, `selectionNote` and `review`. It uses `titleEn`, `summaryEn` and `geographyEn`. The date contains `kind`, `startYear`, `endYear`, `displayEn` and an optional `noteEn`. The `historicalStatus` field records `sourced` or `uncertain`; approval confirms the qualified claim, including any stated uncertainty.

Years are integers, negative for BC, with no year zero; `startYear` must not exceed `endYear`. Allowed date kinds are `exact`, `approximate`, `range` and `disputed`. Exact and approximate dates use equal endpoints. `exact` expresses certainty at year level and can retain an unresolved month in the display and note. A `range` must cover more than one year and retain its complete endpoints even when they extend beyond the research window. A `disputed` date retains the full span between sourced alternatives; that span does not assert a continuous event. The display and `noteEn` identify the alternatives.

Require `noteEn` whenever dating alternatives, approximate estimates or interpretation limits need explanation. A range represents one historical record and supplies no annual recurrence claim. Categories and importance follow the [research brief](../../../development/CODEX-RESEARCH-BRIEF.md#92-event-format). New identifiers use English slugs. Each event must cite at least one source from the same dataset, and every source must support a retained event. Event and source IDs must be unique within their collections and avoid collisions with the runtime catalog and other English datasets. Deduplication also checks historical episodes across both collections, even when identifiers differ.

Source records retain `id`, `title`, `institution`, `url`, `locator`, `retrievedOn`, `originalChronology`, `asWorded`, `scopedClaim` and `reuseTerms`. Official titles and quoted date phrases keep their source language. The locator identifies the passage actually read and any public-summary or extracted-text limitation. A source's scope does not expand to every claim about its subject.

Each event's `review` contains `status: approved`, `reviewedBy` and `reviewedOn`. The accompanying research note reports corrections, withheld candidates and access limits. Private execution logs and machine paths remain outside this repository.

## Integration boundary

The current `validateEventCatalog` requires nonempty Swedish display fields, and `HistoricalEventCard` renders those fields directly. The catalog loader reads only `server/seed/historical/events/catalog.json`. The existing English locale sidecar references Swedish source strings and their hashes; it cannot serve as an authoritative English event feed.

These datasets therefore remain separate from the current catalog, locale sidecars and gameplay coverage totals. Claude must provide compatible validation, loading and English rendering before claiming in-game availability. Integration must retain event IDs, source references, chronology, interpretation limits and the approved English wording. The [delivery plan](../../../superpowers/plans/2026-11-09-english-event-research.md) records the checks and ownership.
