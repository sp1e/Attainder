# The heir challenges a rival to a duel

Date: 10 November 2026. Phase 5, moment 23 of `2026-10-31-ai-game-master-design.md` ("The heir challenges a rival to a duel."). Owner mandate: continue without pause and decide by rulings.

## Problem

Nothing in the engine lets two people fight each other. Prowess (`skills.prowess`) only feeds the general's seat and the imprison action, and a hated rival only costs opinion. The heir is the person whose life the player cares about most after the ruler, so a challenge forces a real choice: let the heir risk death, send a champion, or forbid it and anger the heir.

## Rulings

1. **Historical campaigns only.** The step runs when `state.historicalOrigin` is set, as court renewal and cadet branches do. Hadara keeps `hadara-1.0.0` and plays byte for byte as on `main`. Cost if wrong: Hadara has no duels until a later version opts in.
2. **The heir.** The first of `rulerCandidates()`: a living, free adult who is not the ruler and belongs to the player's controlled family. An heir who is the active representative (a regent, or a household head in family mode) issues no challenge, since no one else would decide on it. In family mode a realm heir of another house never challenges on the player's behalf.
3. **The rival.** The living, free adult outside the heir's house whom the heir likes least, at an opinion of −25 or lower (`DUEL_HATRED`) or bound to the heir as rivals (`bonds.js`); the earlier id on a tie. Measured over 300 years of Charlemagne seeds 777, 321 and 5, an heir hated someone at −40 in 4, 0 and 4 years and at −25 in 11, 9 and 19. The ruler and the active representative are never challenged.
4. **Pace.** At most one challenge at court in five years, whoever the heir is. The story id names the heir and the day (`duel-<heir>-<date>`), so it takes nothing from `state.sequence`.
5. **The story.** A court story `duel_challenge` for the active representative, due in three months, public. Title "`<heir>` utmanar `<rival>` på duell"; the description gives both prowess values.
6. **Three choices.**
   - `allow`, "Låt duellen ske": the heir fights.
   - `champion`, "Sänd en kämpe": the free adult of the controlled family with the highest prowess above the heir's, other than the heir and the representative, fights instead, for 15 silver from the family. Disabled without such a person or the silver.
   - `forbid`, "Förbjud duellen": no fight; the heir gains 20 stress and −20 "Förbjuden duell" towards the representative for 10 years. A memory of the refusal (`duel_forbidden`) carries the opinion.
   - Nobody answering in time counts as `allow`: the heir goes ahead.
7. **The fight.** The fighter wins with a chance of 0.5 + 0.05 × (fighter's prowess − rival's prowess), held inside 0.15 to 0.85. The loser dies with a chance of 0.25 ("Föll i en duell"), and is otherwise injured (an `injury` condition, severity 2).
8. **No draws.** Both rolls come from a hash of the story id (`<id>|win`, `<id>|wound`), so the outcome of a given challenge is fixed and no random stream moves. The injury takes its severity and rolls from the same hash; `createCondition` in `health.js` accepts injected rolls and draws when given none, as before.
9. **Aftermath.** The winner loses 10 stress. A surviving loser gets −30 "Duellen" towards the winner for 20 years. An heir who wins in person raises the realm's prestige by 5. A public event names winner, loser and the outcome, and a `duel` memory names both fighters whether the loser lives or falls. The dead loser's kin get no opinion of the winner from the duel; that needs its own ruling, because −30 would let the next heir challenge the winner in turn.
10. **Falling away.** The story closes without effect when the heir or rival dies or is imprisoned, or the representative changes.
11. **Frequency.** Over 300 years of Charlemagne seeds 777, 321 and 5, with nobody answering (so every challenge went ahead), the court saw 3, 2 and 5 duels, and every save loaded.
12. **No version change.** `rulesVersion` and `contentVersion` stay `hadara-1.0.0`. Saves need no migration: a court story has the shape every story has.

## Tests

`src/runtime/characters/duels.test.js`:

- Karl den yngre, hating the head of Hovhus 1 at −60, challenges him once; a second step adds nothing; no stream moves; the save loads.
- No challenge in Hadara, at −24, or against a brother in the heir's own house.
- The court waits five years after a challenge (59 months: none; 60: one).
- Forbidding stresses the heir by 20 and gives −20 "Förbjuden duell" towards the ruler.
- A fight the heir wins by the hashed roll injures the rival (severity 2) and gives −30 "Duellen"; a fight the heir loses on a fatal roll kills the heir ("Föll i en duell") and leaves a `duel` memory. The fight moves no stream; the grief after a death draws from the health stream as any death does.
- Forbidding writes the `duel_forbidden` memory the opinion cites.
- The champion is disabled without a better fighter or 15 silver; Pippin fights in the heir's place and the family pays.
- An unanswered challenge goes ahead; a challenge whose rival died closes without a fight.
