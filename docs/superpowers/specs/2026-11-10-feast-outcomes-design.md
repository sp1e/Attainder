# A feast where someone seduces, someone quarrels and someone is poisoned

Date: 10 November 2026. Phase 5, moment 20 of `2026-10-31-ai-game-master-design.md` ("A feast where someone seduces, someone quarrels and someone is poisoned."). Owner mandate: continue without pause and decide by rulings.

## Problem

`hold_feast` (`server/characters/occasions.js`) charges 30 silver and one order, opens a one-month occasion with every free adult as a guest, gives each guest family's head +5 towards the host and lends intrigue actions against guests +15 success and −5 secrecy. Nothing happens among the guests themselves. The moment asks for three things to happen at the table: a seduction, a quarrel and a poisoning, each with consequences that the rest of the game already knows how to carry (affair secrets, lover relationships, grudges, crimes).

## Rulings

1. **Historical campaigns only.** `feastOutcomes` runs at the end of `holdFeast` when `state.historicalOrigin` is set. Hadara keeps `hadara-1.0.0`; a Hadara feast does what it did on `main`. Cost if wrong: Hadara feasts stay quiet until a later version opts in.
2. **Settled when the feast is held.** The engine has no monthly step for occasions, so the three outcomes happen inside the `hold_feast` command, dated the feast's first day. The month of intrigue odds is unchanged.
3. **No draws.** Every choice and roll comes from an FNV-1a hash of the occasion id (`hashRoll` from `duels.js`), with suffixes `|seduce|<person id>`, `|poison`, `|death` and `|caught`. The occasion id comes from `state.sequence` as before, so no random stream moves.
4. **The guests** are the occasion's `guestIds`, all free adults. The active representative and the host (the household representative who pays) take no part: never seduced, seducer, quarreller, poisoner or victim. The player decides for that person, and a host poisoned at their own table by a hash would be a loss the player could not answer.
5. **The seduction.** The seduced is a married guest whose spouse lives and whom they like at 0 or less, with no hidden affair already; the lowest `|seduce|<id>` hash picks among them. The seducer is the guest of the other sex, not the spouse and not close kin, whom the seduced likes most; the lower id on a tie. Effects:
   - An `affair` secret about the seduced, held by both lovers and the host, weak evidence. The player's host can use it for blackmail; a seduced wife's next child may be the lover's (`paternity.js`).
   - A `lover` relationship between the two.
   - +20 "Gästabudets natt" each way for 10 years.
   - When the seduced wife later bears a child of the affair and the paternity draw names a lover, `paternity.js` names the seducer, as long as he can still be the father.
   - Nobody fits: no seduction.
6. **The quarrel.** Among pairs of guests from different houses, the pair whose opinions of each other add up lowest, below 0; the lower ids on a tie. Each gets −15 "Grälet på gästabudet" towards the other for 10 years and 10 stress. Only pairs with a stored relation are read; a pair with none sums to 0.
7. **The poisoning.** The poisoner is the guest outside the controlled family who likes another guest least, at −40 or lower; the lower ids on a tie. The poisoning happens when `|poison` rolls below 0.5.
   - The victim dies when `|death` rolls below 0.3 ("Förgiftad på gästabudet"). Otherwise the victim loses 20 health, never below 1, and gains 20 stress.
   - The crime is `attempted_murder` when the victim lives, `kinslaying` when the victim dies at a relative's hand (`hooks.related`), else `murder`. The poisoning memory stores it, and `crimeOfSecret` reads it there, so a secret that `investigate` or blackmail exposes later carries the same crime.
   - A `murder` secret (the victim died) or `plot` secret (the victim lived) about the poisoner, held by the poisoner.
   - When `|caught` rolls below 0.4 the poisoner is found out: `exposeCrime` exposes the secret as that crime. The victim's house turns on the poisoner, and the ruler, when the player holds the mandate, gets the usual punishment case.
   - Otherwise the secret stays hidden for `investigate` to find.
8. **Order.** Seduction, quarrel, then poisoning, so a death at the table does not change who seduced or quarrelled. The quarrel's −15 counts when the poisoner is chosen: a guest at −30 who quarrels reaches −45 and can poison the same evening.
9. **Records.** Each outcome writes a log event and a memory (`feast_seduction`, `feast_quarrel`, `feast_poisoning`) whose cause is the feast's memory. The seduction's memory is known to the two lovers and the host; the others are public.
10. **No version change.** `rulesVersion` and `contentVersion` stay `hadara-1.0.0`. Secrets, relationships, memories and conditions use their existing shapes, so saves need no migration.
