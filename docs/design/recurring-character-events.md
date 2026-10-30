# Recurring character events: implementation plan

> For agentic workers: use `subagent-driven-development` for implementation, then independent specification and code reviews.

**Goal:** Give Hadara's characters recurring decisions whose participants, consequences and later callbacks depend on the campaign.

**Architecture:** A pure ESM module selects eligible stories using a saved random stream. The existing character engine applies choices, costs and memories. The runtime stops a long turn at a new decision before requesting model narration.

**Stack:** JavaScript, React, Node's test runner and the existing Open Historia runtime.

This document specifies one integrated milestone. It extends the character contract in `src/runtime/characters/CONTRACT.md`. The numbers below are prototype balance values, not claims about Crusader Kings III or Old World's formulas.

## Requirements

| Event | Eligible situation | Consequences |
| --- | --- | --- |
| Household tension | An adult relative is under stress | Pay for relief, demand service or let the question rest; affect stress, opinion and family influence |
| Promising student | A child in the player's family is old enough for study | Fund extra learning or retain current education; support can be remembered in adulthood |
| Temple petition | A living religious leader seeks support | A private donation changes religious support and personal opinion |
| Governor audit | A governor oversees a troubled city and the player has state authority | Fund improvements, censure the governor or accept rising unrest |
| Veteran petition | The general represents an army below its strength threshold | Spend public money, demand service or accept a loss of strength |
| Reconciliation | The participants share a known memory of betrayal, insult or a new dispute | Improve the relationship at a private cost or refuse; keep the original memory |
| Exile contacts | The family has an accepted, valid host | Spend family money to build influence without gaining control of the host |
| Returned favor | Earlier support is at least three years old | Accept a personal payment, seek political support or release the obligation; a family successor may carry the obligation |

Select real participants. Personality changes selection weights and the stress of choices. Preserve personal opinion, family support and religious support as separate values. Reject an unaffordable or unauthorized choice without changing the input state.

Use an independent saved RNG stream. Allow at most one newly scheduled event per year and two open recurring events. Apply a 36-month template cooldown and a 24-month participant cooldown. A resolved causal memory must not generate repeat claims. Normalize old pre-release saves without drawing randomness or inventing past events; reject unsupported versions and malformed references.

Recheck the participants and mandate when a player submits a choice. Close stale questions after death, a relevant office change, loss of authority or a change of player representative. After twelve months, apply the stated free fallback. Continuing time counts as declining to answer before that deadline.

Display the participant's current portrait, trigger, deadline and relevant source memory. Show costs and stress before submission. Use the existing keyboard controls and light/dark themes. Keep RNG and selection internals out of the presentation and model prompt.

Before calling the model for a long turn, calculate the first new care or recurring decision. Apply and replay the same horizon. Care interruptions take precedence when both kinds appear together. The model cannot select the player's choice or change canonical character outcomes.

## Files and responsibilities

- `src/runtime/characters/storyDirector.js`: selection, eligibility, saved director state, choices and story lifecycle.
- `src/runtime/characters/index.js`: integration with the existing calendar, authority, wallets, opinions and memories.
- `src/runtime/characterWorld.js`, `characterRuntime.js` and `src/Game/AI/gameplay.js`: forecast, turn cutoff and recorded outcomes.
- `src/Game/Characters/CharactersPanel.jsx`: decision context and interruption text.
- Focused character and runtime tests: determinism, stale actors, permissions, migration, callback claims and replay.

Keep the existing development checkout and branch. Preserve upstream attribution. Publish verified changes to the configured project repository; exclude campaign data, credentials and local reports.

## Verification and review

- [x] Finish the implementation and test the eight templates through the actual character command path.
- [x] Test JSON reload, old-save defaults, malformed state, long versus stepped time and multi-generation progression.
- [x] Check long-turn interruption and replay against the pre-model horizon.
- [x] Complete independent specification review and resolve findings.
- [x] Complete independent code-quality review and resolve findings.
- [x] Run the full local suite, relevant lint and production build.
- [x] Check the rendered decision UI in both themes and a narrow viewport, including a submitted choice.

Release procedure: update public documentation, commit the tested source, then verify that the remote main branch contains the same commit.

Human balance acceptance and a broader historical event catalogue remain separate work. These eight templates do not establish full parity with either reference game.
