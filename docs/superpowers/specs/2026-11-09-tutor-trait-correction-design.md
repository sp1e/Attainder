# A tutor who corrects a trait

Date: 9 November 2026. Phase 4, moment 5 ("The heir is cruel and lazy. The player chooses a tutor and hopes education corrects it."). Owner mandate: continue without pause and decide by rulings.

## Problem

`educate` lets the player give a child a mentor and a skill focus. At 18 the yearly step in `server/characters/index.js` copies the mentor's archetype and, on one draw from `state.rngState` below 0.4, sets the child's traits to `[own first trait, mentor's first trait]`. The step never looks at what the traits mean:

- A cruel child taught by a compassionate mentor can come of age both `cruel` and `compassionate`, a pair `OPPOSITE_TRAITS` in `content.js` names as opposites.
- A mentor whose second trait opposes the child's gets no say.
- The player cannot see what the choice of tutor may change.

No NPC calls `educate`; a newborn's mentor is its mother. Measured over 150 years (Charlemagne seeds 777 and 321, Hadara seed 321), no person holds an opposed pair today, and no child has a mentor other than the mother. The change reaches only children the player educates.

## Rulings

1. **Module.** `server/characters/tutoring.js` holds the rule, with a shim `src/runtime/characters/tutoring.js`.
   - `traitCorrection(child, mentor)` returns `{ from, to }` or null: the first trait in the mentor's own order whose opposite (`OPPOSITE_TRAITS`) the child holds.
   - `traitsAtAdulthood(child, mentor, draw)` returns `{ traits, corrected }` or null.
2. **The same draw.** The adulthood step keeps its single `random(state)` call, in the same place and only while the mentor lives. No draw is added, moved or removed.
3. **Correction.** With a correction and a draw below `CORRECTION_CHANCE` (0.6), the mentor's trait replaces the opposed trait in the child's list, in its place; the other traits stay.
4. **Old rule.** Without a correction, a draw below 0.4 gives `[own first trait, mentor's first trait]` as today, so a run without player tutors keeps its state byte for byte.
5. **Showing it.**
   - The `educate` event names the prospect when there is one: "Läraren är medkännande: vid myndigheten byter X draget Grym mot Medkännande med 60 % chans."
   - The adulthood event names a correction that took: "X har lagt bort draget Grym och är nu medkännande."
   - Text stays Swedish, in the player's terms; the chance is the rule's own number, not a hidden value.
6. **No version change.** `rulesVersion` and `contentVersion` stay `hadara-1.0.0`. Saves need no migration: the rule reads fields every person already has.

## Tests

`src/runtime/characters/tutoring.test.js`:

- `traitCorrection` finds the opposite in the mentor's order and returns null when nothing opposes.
- A cruel and lazy child with a compassionate mentor: a draw of 0.5 gives `['compassionate', 'lazy']`; a draw of 0.7 gives null.
- Without an opposite, a draw of 0.3 gives `[own first, mentor first]` and 0.5 gives null.
- Through `advanceCharacters`: a player-educated cruel child comes of age corrected or not by the stream's own draw, and the run draws as many numbers as main (same `rngState` as a run where the mentor holds no opposite).
- The `educate` and adulthood events carry the Swedish lines above.
