# Plague reaches the capital: quarantine, prayer or flight

Date: 10 November 2026. Phase 5, moment 21 of `2026-10-31-ai-game-master-design.md` ("Plague reaches the capital: quarantine, prayer or flight."). Owner mandate: continue without pause and decide by rulings.

## Problem

`health.js` models smallpox, fever, injury and bereavement one person at a time; smallpox spreads inside one household. No illness reaches the whole court at once, and the player never decides how the capital meets an epidemic. The moment asks for one outbreak and three answers: close the gates, pray, or leave.

## Rulings

1. **Historical campaigns only.** `plagueStep` runs from `courtAnnualStep` after `echoStep` when `state.historicalOrigin` is set. Hadara keeps `hadara-1.0.0` and plays byte for byte as on `main`. Cost if wrong: Hadara has no plague until a later version opts in.
2. **A court story.** `plague_outbreak` in `server/characters/plague.js`, a row in `COURT_STORIES` in the pattern of `duels.js` and `echoes.js`.
3. **Onset, no draws.** Once a year the plague arrives when an FNV-1a hash of the plot stream's state, the date and `plague` (`hashRoll`, as `paternityDraw` reads the stream) rolls below 0.04: about one outbreak in 25 years. The step reads the stream and never advances it. None while one is open, and none within 180 months of the last one. The story id is `plague-<date>`, so it takes nothing from `state.sequence`. The story keeps the stream's state at onset as `seed`, so two campaigns struck on the same date lose different people.
4. **The story.** For the active representative, due in 3 months, public, title "Pesten når huvudstaden". The onset writes a log event and a public `plague_outbreak` memory; the story's `causeId` names that memory.
5. **Who is exposed.** Every living person in `state.people` when the story resolves, the ruler and the representative included, in id order.
6. **Three choices and the expiry.**
   - `quarantine`, "Stäng stadens portar": 20 silver from the controlled family (disabled without it). Infection chance 0.10. Every other family's living head gets −5 "Stängda portar" towards the representative for 5 years.
   - `prayer`, "Bön och processioner": 5 silver (disabled without it). Infection chance 0.25. The realm gains 3 legitimacy (held at 100) and the representative loses 10 stress.
   - `flight`, "Fly till landsbygden": free. The controlled family's members are not exposed; everyone else has infection chance 0.30. The realm loses 5 legitimacy (held at 0). Every living adult of another family gets −10 "Övergav staden" towards the representative for 10 years.
   - Nobody answering counts as `none`: infection chance 0.30 for everyone, no cost.
7. **The toll.** A person is infected when `hashRoll(<story id>|<seed>|sick|<person id>)` is below the chance, and dies when `|dies|<person id>` rolls below 0.4 ("Pesten"). An infected survivor loses 25 health, never below 1, and gains 15 stress. The deaths go through `hooks.kill`, so succession runs as for any death. The resolution writes a log event and a public `plague_toll` memory naming the dead, with the outbreak memory as cause.
8. **Falling away.** The story closes without effect when the representative changes or the player no longer controls the family (`story.familyId`). Cost if wrong: an outbreak that passes unanswered and unpaid in the rare case a representative dies within three months.
9. **No version change.** `rulesVersion` and `contentVersion` stay `hadara-1.0.0`. A court story has the shape every story has, so saves need no migration.
