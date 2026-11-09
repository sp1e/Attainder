# The handover to a new ruler

Date: 9 November 2026. Phase 4, moment 10 of `2026-10-31-ai-game-master-design.md` ("A new ruler with different traits takes over, and the strategy has to change."). Owner mandate: continue without pause and decide by rulings.

## Problem

At an accession the log says "X tillträder" and names the new archetype. The player then has to compare two people across the panel to see what changed: another ruler's ability, other traits, other skills. The reign's goals are gone too, since `beginReign` starts a fresh record. Nothing on the reign card says so.

## Rulings

1. **Read only.** `server/characters/handover.js` exports `reignHandover(state, hooks)`, with a shim in `src/runtime/characters/`. It draws nothing, writes nothing and adds no state, so saves, `rulesVersion` and `contentVersion` stay as they are.
2. **The predecessor.** The last entry of `state.offices.ruler.history` is the sitting ruler's accession, dated the day `state.reign` starts. The predecessor is the person in the nearest earlier entry, skipping vacant entries (an interregnum). There is no handover when that person is the sitting ruler (a dissolution writes the holder once more before a restoration), when no earlier person exists (the campaign start), or when the last entry is not the sitting ruler's or is dated before `state.reign.startedAt` (an old save whose record `defaultReign` dated to the day it loaded).
3. **When it shows.** During the first 12 months of the reign (`reignMonths < 12`), while a ruler sits.
4. **What it shows.**
   - The ability: the old and new archetype with its ability, when the archetype changed.
   - The traits the old ruler had and the new one lacks, and the traits that are new.
   - Up to three skills that moved by 2 or more, largest move first and `SKILL_LABELS` order on a tie. Only skills both people have count.
   - That the old reign's goals no longer apply, since the record starts over.
5. **Nothing to show.** When the archetype, the traits and the skills all match, the function returns null.
6. **Where.** `getCharacterPresentation` adds `handover`. The reign card renders it above the goals as "Ett nytt styre".

## Tests

`src/runtime/characters/handover.test.js`:

- Seed 2, the `abdicate` command: Arel av Hadara (commander, `dutiful`, `ambitious`) hands over to Sera Arel (diplomat, `compassionate`, `gregarious`). The handover names both, both abilities, the traits and the skills Diplomati 4 → 8, Intrig 4 → 7, Befäl 4 → 6.
- No handover at the campaign start, after 12 months, without a ruler, or when the two rulers match.
- An interregnum entry between the two is skipped. A ruler who held the throne just before and an old save's reign record give no handover.
- The presentation carries `handover`, and the panel test renders "Ett nytt styre".
