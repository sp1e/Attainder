# Development backlog

Updated 5 November 2026. The owner's current requests take precedence over the earlier fictional-world design. This file records planned work; it does not claim implementation or research completion.

| Order | Work | State |
| --- | --- | --- |
| 1 | Merge the reviewed Phase 3 fixes. | Complete: [PR #12](https://github.com/sp1e/Attainder/pull/12) merged; final review `08d3518..55283dc` approved with no new Critical, Important or Minor findings; required test/build CI passed in [CI run 42020869295](https://github.com/sp1e/Attainder/actions/runs/42020869295); remote `main` verified as `6f4f7c0`. Retained remote branch `fix/phase-3-review`: `55283dc`. |
| 2 | Replace the playable fictional world and modern default with real-world historical campaign starts, from the Bronze Age through about AD 1200; offer no modern starts. | Current: written plan `docs/superpowers/plans/2026-11-05-historical-campaign-foundation.md` prepared; begin Task 1. Follow six tasks: campaign-start policy, historical content, initializer, prompts, combined guards/defaults/UI, browser evidence. Foundation implementation remains pending. |
| 3 | Research historical events year by year and add an end-turn historical-events popup. | Added at the owner's request; research and implementation pending. |
| 4 | Continue family/succession, life/events, diplomacy/war and religion phases against the historical setting. | Replan after the historical foundation. |

## Historical events at turn end

The owner requested deep research into notable events for each year from approximately 3300 BC through AD 1200, and a turn-ending experience like Total War: alongside dynamically generated events, show a popup describing which real historical event or events occurred in the campaign's current year.

### Research deliverable

- Cover all 4,500 calendar years in the range, with no year zero, in an explicit coverage index.
- Research worldwide political changes, wars, migrations, religious and cultural developments, discoveries, technology and major natural events. Select events for historical significance and record the selection rationale.
- Store each event's stable ID, Swedish title and summary, year or date range, geography, category, importance and source references. Preserve the original dating, calendar convention and uncertainty.
- Prefer primary evidence and institutional or scholarly sources. Record source titles, URLs and precise locators; check competing chronologies rather than choosing an exact year without evidence.
- Distinguish exact-year events from approximate dates, ranges and disputed dates. Do not spread one approximate event across several years as though each entry were independently attested.
- Track researched years with no securely dated event, years with incomplete coverage and source conflicts. A gap in the dataset does not mean that nothing happened in that year. Do not invent an event to fill a row.
- Review the source material and dating before marking a period complete. Publish the data, provenance and remaining coverage gaps with each researched milestone.

### Game deliverable

- At turn completion, look up the current campaign year and show one or more matching historical events, in addition to the game's dynamic events.
- Identify the material as real-world historical reference, for example `I verklighetens historia`, so players can distinguish it from their campaign's alternate outcomes.
- Show the event's date certainty and provide source details. Do not present an archaeological date range as a fact tied to one precise year.
- Use the researched dataset for lookup; no extra model call or live research request is needed at turn end. Missing evidence must not cause the model to invent a historical popup.
- Preserve deterministic simulation, saves and stored replay. Historical reference cards must not force the campaign to repeat a real death, war or succession that contradicts its state.
- Define notification deduplication, reload/replay behavior and multi-year turns in the written implementation plan. Test the BC/AD boundary, approximate dates, empty coverage, multiple events in a year and repeated loading of a completed turn.
- Provide a browsable history record so dismissed reference cards remain accessible.

### Acceptance evidence

The research needs an audited coverage report for the requested years. The feature needs engine/data tests and a browser run that ends a turn, displays the current year's sourced historical popup beside dynamic events, reloads the campaign and replays without another model call or duplicate notification.

## Related documents

- `docs/superpowers/specs/2026-11-05-historical-world-direction.md`: current setting and start-date authority.
- `docs/superpowers/specs/2026-10-31-ai-game-master-design.md`: character and AI systems, subject to the newer setting direction.
- `docs/development/CONTINUE-HERE.md`: measured progress and the next implementation step.
