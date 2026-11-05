# Historical world direction

Date: 5 November 2026. Authority: the owner's direct instruction in the development chat.

## Binding product requirements

- Use the real world, as Open Historia does: real geography and historical polities appropriate to the campaign's starting date.
- Replace the fictional Hadara world as the playable default. The earlier AI game master design's fictional-world assumption no longer applies.
- Offer new campaign starts from the Bronze Age through about AD 1200. Offer no modern-era campaign starts.
- Keep the character, dynasty, court and AI game master systems. Outcomes after the start can diverge from recorded history through play.
- Keep English developer documentation and Swedish player text, including å, ä and ö.

## Builder rulings

- Ruling: use 3300 BC as the initial lower start-year boundary and AD 1200 as the upper start year, inclusive; reject year zero. The owner gave an era rather than an exact lower year. If wrong, change the shared range constant, labels and boundary tests.
- Ruling: enforce the starting-date range at each new-game boundary, including imported scenarios and the browser storage adapter. Hiding a modern bookmark alone leaves other start paths open. If wrong, one of those paths needs a product exception.
- Ruling: preserve existing campaign files and generic calendar support. The request defines the period for starting a new game and does not authorize deleting campaigns. If wrong, the owner must decide a separate migration or end-date rule.
- Ruling: keep Hadara fixtures for deterministic engine tests while replacing the player-facing default. They test court rules without claiming historical accuracy. If wrong, rename or replace those fixtures after the historical start model stabilizes.
- Ruling: finish the two review fixes already in progress, then prioritize the historical campaign foundation ahead of the remaining Hadara browser script and Phases 4 through 7. Both fixes concern rules shared by historical campaigns. If wrong, their small review branch can be reverted without the historical feature work.

## Implementation requirements

The next plan must identify the shared scenario/new-game paths before editing them. It must cover the start UI, server creation and import, browser storage, real-map assets, historical initialization, save compatibility and model prompts. Do not present invented coordinates, borders, rulers or dates as researched history. Use primary or institutional sources for historical starting content and keep the provenance with the content.

Use one shared range rule and calendar parsing that supports BC dates without year zero. Reject invalid starts with a Swedish sentence before writing a campaign. Preserve upstream map attribution and licenses.

Real-world coastline and placement must replace the current twelve fictional rectangular provinces. Historical polity ownership and the court's controlled polity must agree. Generated minor characters may continue to serve gameplay; distinguish generated people from documented historical figures in the content model.

## Acceptance

- A fresh installation offers a real-world historical campaign and no fictional Hadara or modern campaign start.
- The start flow exposes the supported historical period and uses the selected date in the world, character state and prompt.
- Boundary tests accept the earliest and latest supported start years and refuse earlier years, later years, year zero and malformed dates through each new-game entry point.
- A saved campaign still loads without replacing its people, map or stored replay outcomes.
- Browser verification covers the real map, starting polity, date selection, one public command, one household command and a model-driven turn through Codex.

The exact end date of a running campaign remains a separate design decision. This direction does not introduce an AD 1200 automatic game-over rule.

## Historical events at turn end

The owner added a research and gameplay requirement on 5 November: research notable real events for each year in the supported historical period and show the current year's real events in a popup when a turn ends, alongside dynamic campaign events. `docs/development/DEVELOPMENT-BACKLOG.md` records the research deliverable and acceptance criteria. Distinguish historical reference from alternate campaign outcomes; source the events and preserve dating uncertainty. Research and implementation are pending.
