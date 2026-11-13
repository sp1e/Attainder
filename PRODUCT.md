# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The owner plays first: one experienced player at a desktop screen of 2560×1440, in long sessions, who knows the rules. He confirmed this on 13 November 2026. No other audience is confirmed. A person who is not a developer cannot install the game today.

## Product Purpose

Attainder is a historical strategy game about a court. The player follows a realm through its rulers, or a family that can survive losing power, from a real historical start between 3300 BC and AD 1530. A year of play is a handful of orders, the decisions the court puts to the player, and a year turn that a language model narrates. The rules engine decides every outcome; the model describes the world and proposes.

The owner's stated goal on 13 November 2026 is a version that plays without wrong state on his own machine, before any installer for others.

## Positioning

The court is people with memories, opinions, offices, claims and health, and every event the player reads follows from rules the game can show. Historical starts carry documented rulers and mark generated people as generated.

## Operating Context

- Four shipped starts: Egypt about 3000 BC, Charlemagne AD 800 (the default), John's realms AD 1200, and the Aztec and Inca realms AD 1500. Seventeen playable polities.
- Two campaign modes: follow the realm, or follow the family.
- Two languages, Swedish and English, chosen in Options. The engine writes Swedish and the interface reads it in English at display time.
- The game runs from a local server in a browser tab, on a world map inherited from Open Historia. A year turn with the model takes several minutes.
- The player's year: at most four orders, open decisions with deadlines, running schemes, then the year turn. A longer time jump stops at a new decision.

## Capabilities and Constraints

- Today's interface is a map screen with Open Historia's controls and one panel, `Realm & families`, that covers the map. The panel has seven tabs: Overview, People, Families, Offices & succession, Decisions, Intrigue and Chronicle.
- The owner named four problems with it on 13 November 2026: the map and the court are never seen together; it is unclear what to do next; too much text and too many numbers hide what needs him; and it has no sense of period.
- A redesign may rethink the structure freely. Every function stays.
- The theme has one common base for the whole game and an accent that follows the start's period and culture.
- Odds are shown at three precisions that depend on the actor's skill. Generated people and uncertain dates carry a visible label.
- Portraits follow each person's state. The README counts 864 variants for 24 starting identities.
- Undecided: what an extinct house's city and estates become; whether the dead loser's kin resent the winner of a duel.

## Brand Commitments

- The name is Attainder. The packaging and some screens still say Open Historia.
- Player text is plain and exact about uncertainty: `Documented person; game values are generated`, `Birth date uncertain`.

## Evidence on Hand

- Screens of the current interface from the build of 13 November 2026 (campaign Charles's realm, 25 December AD 802).
- Play scripts under `docs/play-scripts/`, the interface reference `docs/game-ui.md`, and the engine contract `src/runtime/characters/CONTRACT.md`.
- No player other than the owner and the agent has played. No user research exists.

## Product Principles

1. The rules decide and the game can show why.
2. What needs the player comes first; the rest is one step away.
3. The realm on the map and the people at court are one situation.
4. Documented and generated are never confused.
5. The period is felt without costing legibility.
