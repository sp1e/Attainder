# A choice from ten years earlier comes back

Date: 10 November 2026. Phase 5, moment 22 of `2026-10-31-ai-game-master-design.md` ("An event chain remembers a choice from ten years earlier."). Owner mandate: continue without pause and decide by rulings.

## Problem

The player's decisions in directed stories and event chains leave a memory and an opinion cause. The cause expires after ten years (`opinionCause` defaults to `years = 10`). Reconciliation can bring back a slight at any age and the returned favour waits three years, but no rule looks at a decision because a decade has passed, and none carries it to the witness's child. The moment asks for a story that brings it back, with a person who was there or that person's child.

## Rulings

1. **Historical campaigns only.** The step runs when `state.historicalOrigin` is set, as duels, court renewal and cadet branches do. Hadara keeps `hadara-1.0.0` and plays byte for byte as on `main`. Cost if wrong: Hadara has no echoes until a later version opts in.
2. **A court story, not a ninth chain template.** The echo is the court story `decision_echo` in `server/characters/echoes.js`, in the row pattern of `deathbed.js` and `duels.js`. A new chain template would join the weighted draw of `scheduleEventChain`, and its validation ties every source memory to `story_patronage`. The story's `causeId` names the old memory, so the chain of causes runs from the echo back to the decision. Cost if wrong: the echo does not show in the chain history panel.
3. **The decision.** A memory of type `story_choice`, `story_patronage`, `story_fracture` or `chain_choice` that is at least 120 and less than 132 months old. The yearly step sees each memory in one year only. The memory counts when an opinion cause in `state.relations` names it as `causeId` with an amount of at least 5 either way: the decision moved what someone thought of the person who decided. Expired causes count; that expiry is what the story is about. Every cause that names the memory is a candidate, since a chain choice can leave one per role. The largest amount wins among candidates that pass rulings 4 and 5, then the older memory, the lower memory id and the lower witness id. A memory that loses or that the pace of ruling 6 holds back does not come back later; cost if wrong: fewer echoes than decisions.
4. **Who decided.** The cause's `toId`, who must belong to the controlled family today. A decision of a house the player no longer controls does not come back.
5. **Who remembers.** The cause's `fromId`, when alive, free and adult. Otherwise that person's eldest living, free, adult legal child, who carries the memory on. Never the ruler, the active representative or the one who decided; nobody remembers to their own face. A shielded witness passes the memory to the child, and a shielded child to the next.
6. **Pace.** One echo open at a time, and none within 36 months of the last one. The story id is `echo-<memory id>`, so it takes nothing from `state.sequence`, and a memory never echoes twice.
7. **The story.** For the active representative, due in six months, public. Title "`<carrier>` minns ett beslut från `<year>`". The description quotes the old memory's title and names the dead witness when a child carries the memory.
8. **A kind decision** (amount above 0), two choices.
   - `embrace`, "Knyt banden fastare": the carrier gains +15 towards the representative, "Ett minne från tio år sedan", 20 years.
   - `ask`, "Be om en gentjänst": the controlled family gains 8 influence (held at 100); the carrier gets −5 "Gentjänsten är utkrävd" towards the representative, 10 years.
   - Nobody answering counts as `embrace`.
9. **A harsh decision** (amount below 0), three choices.
   - `amends`, "Gottgör det gamla": 15 silver from the family, the carrier gains +20 "Gottgjort", 20 years. Disabled without the silver.
   - `apologize`, "Be om ursäkt offentligt": the family loses 5 influence (held at 0), the carrier gains +12 "En offentlig ursäkt", 20 years.
   - `stand`, "Stå fast vid beslutet": the carrier gets −15 "Ett gammalt agg", 20 years. A grudge that deep can turn into a rival bond through `bondStep` and, against the heir, a duel.
   - Nobody answering counts as `stand`.
10. **Falling away.** The story closes without effect when the carrier dies or is imprisoned, the representative changes, or the player no longer controls the family that decided (`story.familyId`).
11. **No draws, no version change.** Selection reads memories and relations in a fixed order. `rulesVersion` and `contentVersion` stay `hadara-1.0.0`. Saves need no migration: a court story has the shape every story has.
