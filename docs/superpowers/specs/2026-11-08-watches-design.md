# Watches stop the year

Date: 2026-11-08. Owner mandate: continue without pause and decide by rulings. Idea 2 of `docs/Featureförslag_Attainder_2026-11-08.md`.

## Problem

`planCharacterAdvance` (`src/runtime/characterWorld.js`) stops a longer advance for two reasons: a new open health-care story and a new open decision story (`character_event`, `event_chain`, `stress_breakdown`, `family_demand`, `faction_ultimatum`). Everything else that happens during a year reaches the player in the year report, after the moment to act has passed.

## Rulings

1. **Four watches.** The player turns each on or off. All start off.
   - `family_stress`: a living member of the player's family reaches stress 80 (`CRISIS_STRESS`) who was below 80 when the advance began.
   - `child_adult`: a living member of the player's family who was a child when the advance began comes of age (`isAdultCharacter`).
   - `ransom_offer`: a new open `ransom_offer` story. Ultimatums already stop the year as decision stories.
   - `faction_known`: the player learns of a new faction member (a new entry in a live faction's `knownMemberIds`). The feature list proposed "a known faction reaches strength 40". Strength is derived from members the player has not discovered, so a strength rule would leak hidden members. Ruling: watch discoveries instead, which the player already sees in the court view.
2. **The player's family.** `state.identity.familyId` in family mode, otherwise the ruler's family.
3. **Baseline.** Each watch compares against the state at the start of the advance. A person already at stress 80, an adult, an open offer or a known member does not stop the year again.
4. **Order and dates.** The health-care stop and the decision stop come first, unchanged. A watch stops the advance only before `requestedDate`, like them, and only at a calendar boundary. A coming of age is a boundary already (`getNextCharacterTransitionDate` lists majority dates), so `child_adult` stops on the birthday. Stress, ransom offers and discoveries change at the boundaries that cause them.
5. **Interruption.** `{ type: "watch", watch: <id>, date, storyIds: [], requestedDate, message }`. The message is Swedish and names the person when there is one, for example "Turen stannade när Agnes Vala nådde stress 80. Du bevakar stress i familjen."
6. **No draws, no state.** Watches only read state. `advanceCharacters` runs the same boundaries as before; the advance just ends earlier. The choice lives in the client, per campaign, in `localStorage` under `attainder-character-watches:<campaignId>`. Engine state, hashes and `rulesVersion` stay.
7. **One choice per turn.** The jump reads the watches once and carries them through the horizon, the forecast in the prompt and the post-model timeline, so a toggle during a running turn cannot move the stop.
8. **Planned stop survives.** A watch stop planned before the model call ends at the model's stop date, where `requestedDate` equals the date and the timeline does not fire it again. The planned interruption is kept when its date equals the final date, as the planned care stop already is.
9. **Panel.** Four checkboxes under "Bevakningar" in the campaign strip of Rike & familjer. The notice title for a watch stop reads "Tiden stannade vid en bevakning".

## Out of scope

Thresholds the player can set. Watches on other families. The dev-only `advanceCharacterYear` reads the same watches.
