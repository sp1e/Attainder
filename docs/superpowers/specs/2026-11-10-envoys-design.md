# An envoy to a king who remembers

Date: 10 November 2026. Phase 6, moment 27 of `2026-10-31-ai-game-master-design.md` ("The player negotiates in free text with a king who remembers a betrayal from twenty years ago."). Builds on `2026-11-10-foreign-realms-design.md`, `2026-11-10-marriage-alliance-design.md` and `2026-11-10-fabricated-claim-design.md`, and follows the court conversation design (`server/characters/conversation.js`). Owner mandate: continue without pause and decide by rulings.

## Problem

A foreign realm keeps dated memories of the player's realm ("Svek i kriget", "Förlorat land", "Stod vid vår sida"), but the player can only read their sum. The court conversation lets the player argue in free text with a person at court; no such channel reaches a foreign ruler.

## Rulings

1. **Historical campaigns only.** Hadara keeps `hadara-1.0.0` and plays byte for byte as on `main`.
2. **Two parts.** Part one (this spec's engine) adds the request, its odds, its resolution and the brief. Part two adds the model calls and the view; it reuses the court conversation's pattern: the model reads the player's free text into a request and writes the ruler's reply, and never sets odds.
3. **The request.** `envoy_request` is a public command: it needs the ruler's or a regent's mandate and costs one order. The payload is `{ realmId, kind, offerSilver, arguments, argumentScore }`.
   - `kind` is `reconcile` (base 35) or `peace` (base 30, only while the realm is at war with the player).
   - `arguments` is a list of at most eight `{ kind, refId }`, `kind` being `offer` or `shared_memory`.
   - A realm can be asked once every twelve months.
4. **The ruler remembers.** Each live memory of the realm is a row of the odds, labelled with its text and year ("Svek i kriget (805)"), worth its amount divided by 4, rounded half away from zero so that a grievance and a favor of the same size weigh alike; the memory rows together are held to −20…20. The player sees what the king holds against the realm and what he owes it.
5. **Arguments.** An offer counts from 20 silver: it adds floor(silver / 4), at most 15, and is paid from the state treasury only on acceptance. An offer above 60 silver, which could buy nothing more, is refused, and so is a request when the year's orders are spent. A shared memory counts when it names a live memory of the realm with a positive amount (`refId` is `<date>|<label>`); citing one with a negative amount costs 5, at most 10 in all. With at least one argument that counts, the model's score adds min(10, score). The chance is held to 5…95.
6. **The roll.** Acceptance is rolled by `hashRoll` of the realm id, the date, the kind and the plot stream state. No stream moves.
7. **Outcomes.**
   - *Reconcile accepted:* the realm keeps the memory "Försoning" worth +25 for 20 years.
   - *Peace accepted:* the war and the claim end with no loss of prestige; the realm keeps "Fred genom förhandling" worth +10 for 10 years.
   - *Refused:* nothing but the order and the twelve-month wait. A refused peace leaves the war running.
8. **The record.** The realm stores `lastEnvoy = { date, kind, value, accepted }`. A save validates it.
9. **The brief.** For part two the engine gives the model the realm's name, the ruler's name and age, the opinion, each live memory with label, year and sign, and whether the realm is allied, claimed or at war. The brief carries no roll, no odds and nothing about other realms.
10. **No draws, no version change.** `rulesVersion` and `contentVersion` stay `hadara-1.0.0`.
