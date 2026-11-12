# Swedish and English text

**New research from 9 November 2026:** The owner corrected the delivery instruction to English only. Subsequent event research uses the [English research format](english-events/README.md). The 113 English-first events entered the catalog on 11 November 2026 with Swedish display fields and English sidecar text. The bilingual deliveries and their verified source revisions below remain the record of earlier work.

The owner requires Swedish and English throughout the game, selected in Options. Codex supplies the translated text. Claude integrates it with the runtime, model calls and package builders. The [implementation plan](../../superpowers/plans/2026-11-08-bilingual-game-text.md) tracks the work.

## First delivery

The first delivery of [`server/seed/historical/locales/en.json`](../../../server/seed/historical/locales/en.json) translated all 2,055 Swedish display fields in the original 449-event catalog. The schema is `attainder-historical-translations-v1`; `locale` is `en`, `sourceLocale` is `sv`, and `sourceRevision` identifies the source snapshot. Each entry contains `id`, `sv`, `en` and `source`. Its source record provides `path`, `eventId`, an event-relative JSON `fieldPath` and `textSha256` for the exact Swedish string. IDs follow `event/<eventId>/<source-field-path>`.

A separate bilingual reviewer checked every field. Two initial meaning issues were corrected and checked again: the Turkic soldiers at Ghazna and the uncertainty of an archaeological church identification. All nine input groups are approved with no unresolved findings. The integration readback matches all source values and translation keys, and the existing catalog check and 45 focused historical-event tests pass. This delivery covers event display text; other translation groups are still being prepared.

## Second delivery

The second delivery expanded the English sidecar to 3,716 entries: the unchanged 2,055 event entries plus 1,661 fields from court dossiers, map reviews, the culture inventory and the name pool. Record entries use `record/<source-file>/<stable-entity-path>` IDs. Their `source` contains `path`, a document-relative `jsonPointer` and `textSha256`. The pointer supports readback against the pinned source revision; the stable ID identifies the translation. An input whose text no longer matches its hash needs review before reuse.

[`server/seed/historical/locales/sv.json`](../../../server/seed/historical/locales/sv.json) adds Swedish explanatory text for all 416 event-source locators and 416 institution fields. It uses the same schema with `locale: sv` and `sourceLocale: en`. Its entries retain both language forms and identify their source by `sourceId` plus a source-relative `fieldPath`. Here `textSha256` hashes the English original. Official institution names, bibliography titles, section quotations and archival identifiers retain their original forms.

All 2,493 fields in this delivery received a separate bilingual review. Four exact corrections preserve the Swedish word discussed in a title explanation, institutional attribution, the attacking side in a military reference, and the electors' role in a succession reference. The original findings and the scoped correction checks remain in the review record. No findings remain open. Of the inventory's 1,011 names, 246 keep their original forms and 765 receive translated forms; this changes no research status or playable-country claim.

This delivery leaves the historical source data and prior event translations unchanged. Rules, interface text and current-game help are the next translation groups. Runtime integration and visible language-switch testing remain separate work.

## Help delivery

[`public/lang/attainder/help/manifest.json`](../../../public/lang/attainder/help/manifest.json) indexes 32 adapted guide pages, shared shell text and navigation. All 398 paired fields are available in Swedish and English. Pages keep the original canonical routes; each adapted section has a stable ID shared by both languages. Their Markdown bodies describe the current historical game and distinguish dynasty controls from general country panels that are unavailable in dynasty campaigns. The adapted sections do not preserve every upstream anchor; legacy anchor aliases remain an integration decision.

The review checked every page in both languages and its source evidence. Corrections cover panel availability, movement examples for historical eras, the actual espionage detection formula, project secrecy, and the difference between confirming an action and confirming its outcome. All 561 page evidence references still occur verbatim in revision `8dd14ac4d22c6a693b5065a3dd533da500110462`. The source snapshot and upstream help hashes remain pinned separately.

The [catalog README](../../../public/lang/attainder/help/README.md) describes the schemas and integration requirements. This delivery supplies JSON text; the wiki generator and runtime do not yet consume it. Claude still needs to connect the selected Options locale, both rendered help variants, navigation, search indexes and document language, then verify them in the browser. Original upstream help, attribution and AGPL notices remain in place. Interface and rules translations continue as a separate delivery.

## Later event batches

The century batches through BC0100 added 2,078 English event fields and 758 Swedish source-panel fields after the first two deliveries. The AD200 and BC2400 supplements each add ten English event fields and six Swedish source-panel fields. Those batches brought the sidecars to 5,814 English entries and 1,602 Swedish entries.

The 52 English-first supplements add 113 events and 167 sources. Their Swedish display fields come from [`english-first-sv.json`](../../../server/seed/historical/events/english-first-sv.json); the English sidecar takes the supplement's original English, with `textSha256` over the Swedish catalog text. The 538 new English entries cover four fields per event plus 86 date notes. The 334 new Swedish entries give an explanatory locator and institution text for each source; official names and quoted section titles keep their original form. The sidecars now contain 6,352 English entries and 1,936 Swedish entries, covering all display fields for 986 events and all locators and institution fields for 968 sources. All prior translation entries are unchanged.

Both sidecars identify source revision `5e8f0bdbaab1784492aa5f631297acfce856057c`, the research-data commit on the retained `research/english-first-integrate` branch. All 8,288 source strings and UTF-8 hashes were checked against that exact Git revision. A later event batch must commit its research data before advancing this pointer, then verify every existing and added entry against the new snapshot.

## Translation contract

Historical text is delivered as locale sidecars beside the authoritative historical data. Interface and rules text is delivered as data alongside the existing language packs. A translation entry retains both language forms, a stable ID, the source reference and a SHA-256 of the exact source string. UTF-8 source-text hashes remain useful across checkout line-ending conventions; a file's working-copy byte hash is not a portable identity.

Historical event IDs and source field paths identify event text. Other historical records use entity IDs where available, with the original JSON pointer supplied for readback. Map features that share a polity use their distinct feature identity. Array position alone is not a durable identity for an entity.

The translated text preserves numbers, dates, alternatives, uncertainty, attribution, generated-person labels and the scope of source evidence. Century wording is checked against the record's full numeric range; translation never changes the stored endpoints. A century-wide range does not become an exact event year. Translation does not approve new historical claims or repair existing research. English display text writes eras as AD and BC, as the game's own text does; quoted titles, section headings and source locators keep the era labels of their source.

Original quotations, bibliographic titles and attested personal-name forms keep their original language. Established English forms can be used for display names, while the canonical person or polity ID remains unchanged. Explanatory source locators receive Swedish text for the Swedish source panel; quoted section titles and archival identifiers remain recognizable.

## Interface and rules text

The authoritative rules text is under `server/characters/`. The corresponding runtime modules largely re-export it. Builders, court dossiers and review files supply historical start descriptions; generated scenarios and release files are copies, so they are not translated separately.

The existing English and Swedish dictionaries are reused when the source text and context match. Some Swedish values correspond to several English keys, so reversing the entire dictionary would be ambiguous. A classification record distinguishes translated player text, reused entries, unchanged proper names, technical identifiers and development-only text.

Template expressions require care. Variables and canonical values keep their meaning, and grammar-bearing alternatives need complete translated forms. A translated sentence surrounding an embedded Swedish noun or suffix is incomplete. Display translation must not rewrite saved state, rule identifiers, enum values, command payloads or randomness.

Technical model instructions can remain English. The request for player-facing output must follow the selected locale. An English-mode variant must ask for English narration, refusals and reasons; simply translating an instruction to "write in Swedish" would preserve the defect. Structured response keys remain canonical in both modes.

## Runtime integration requirements

The source audit identified these existing paths for Claude to address:

- `src/runtime/translator.js` returns immediately for English, so Swedish additions need an explicit translation path.
- `src/Game/DynastyStartCard.jsx` excludes its whole card through `data-no-translate`.
- `src/runtime/startDynastyCampaign.js` hardcodes the campaign language to Swedish.
- `src/Game/Characters/characterModelCalls.js` uses `languageMode: 'none'` and several prompts require Swedish. `src/runtime/characterWorld.js` also requests a Swedish reason.
- `src/Game/Characters/ActionBox.jsx` treats several ordinary English words as internal-error signals. This can hide valid English refusal messages.
- Historical consumers explicitly read Swedish display fields. They need locale lookup with a defined fallback, including the start card's court mechanics notes.

The source inventory is pinned to its recorded revision. Source-text hashes detect later wording changes. New source text needs a translated entry or an explicit retained-name or non-display classification before it is counted as covered.

## Verification boundary

Data verification checks source-field coverage, exact key closure, duplicate keys, empty translations, UTF-8 readback and unchanged variables and numbers. A separate bilingual reviewer checks meaning and English or Swedish quality. Numeric differences caused by century wording are reviewed rather than silently discarded.

Prepared translations, merged data and tested runtime language switching are separate milestones. Runtime acceptance includes new and restored campaigns in both languages, an Options language change, a historical event popup with sources, an action outcome or refusal, and generated narration. The current text delivery does not establish that those runtime checks have passed.
