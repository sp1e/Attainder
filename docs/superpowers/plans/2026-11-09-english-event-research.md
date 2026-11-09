# English event research delivery

The owner's correction on 9 November 2026 requires English-only text for new research. This replaces the earlier Swedish authoring and bilingual delivery requirement for subsequent batches. Existing published records retain their language and identifiers.

## Delivery boundary

Codex researches, reviews and publishes English event datasets under `docs/research/world-cultures/english-events/`. Claude owns the runtime, validator and tests. The current importer requires Swedish fields, so each new dataset declares `integrationStatus: awaiting-runtime-support`.

Research approval and runtime integration remain separate states. A published research dataset does not increase the current gameplay catalog or its coverage totals. Codex does not place English text in Swedish fields or create empty translation placeholders.

## Work sequence

1. Read the current catalog, previously published English datasets, and earlier discovery, access and withholding records. Deduplicate both identifiers and historical episodes across these collections. Select distinct historical questions within one century. Preserve rejected operations and unresolved claims.
2. Open the institutional or scholarly sources during this research session. Record the exact passage, its own chronology, access limitations and the claim it supports. Preserve full date ranges and competing chronologies.
3. Author English event and source records. Explain the event's significance. Keep unsupported claims outside the deliverable.
4. Freeze the candidate and source records. A fresh independent reviewer opens the cited sources and checks each claim, chronology, significance and English wording. Preserve the original review and any correction checks.
5. Integrate approved records using the distinct research schema. Verify identifiers, source closure, dates, categories, importance, review metadata, UTF-8 and absence of private paths or credentials. Each event must cite at least one source in the same dataset, and every source must support a retained event. New event and source IDs must be unique within their collections and avoid collisions with the runtime catalog and other English datasets. Compare integrated historical fields with the frozen approved payload.
6. Run the existing catalog/report checks to confirm that runtime data remains intact. Read the diff, commit and push, verify the remote head, require passing CI, merge and verify the resulting files.
7. Continue the next independent research batch during review and CI. A completed PR does not require another owner confirmation.

## Current parallel assignments

- 2200–2101 BC: investigate significant new political or regional developments after deduplication against the previous batch.
- AD 300–399: investigate regional gaps, prioritizing areas outside the existing Roman-heavy selection.

Each century receives its own PR. Sources and historical significance determine the retained count; an empty or sparse year does not justify invented precision or filler.

## Acceptance

The independent review and integration checks must pass before publication. Every retained source must support a retained event. English display fields must preserve uncertainty and match the reviewed payload. The status file must state both the approved research counts and the unchanged gameplay catalog counts, and name the importer work that remains for Claude.
