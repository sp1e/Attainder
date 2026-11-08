# Court renewal: generated households and newcomers at historical courts

Date: 8 November 2026. Owner mandate: continue development without pause and decide open questions through recorded rulings (Simon, 7 November 2026). Backlog row 7: "Let courts renew themselves". Phase 5 delivered the elective half; this design delivers the births half.

## Why

Historical courts start with documented people and three generated courtiers. The courtiers are all male, unmarried, 40–50 years old and each heads a one-person house. Nobody at court can marry them, so no child is ever born outside the documented ruling family. Over 100 years:

- Charlemagne's court (primogeniture) runs out of candidates and the realm ends between 856 and 868 on all eight test seeds.
- Kyrkostaten (elective) survives only because the engine crowns a generated outsider. The elected ruler then rules alone with every office vacant for decades, because nobody else lives at court.

A player who follows a realm expects new families to rise at court, marry, have children and fill offices, as the start card promises: `Styr det valda riket genom nya härskare och dynastier.`

## Goals

1. Generated adults at a historical court can marry and have children.
2. When a court thins out, new generated adults arrive, so offices and elections always have candidates.
3. Charlemagne's realm survives 100 years on the eight test seeds. Kyrkostaten keeps a court of several living adults throughout.
4. Hadara (the non-historical engine state), its full-state digests and every pinned rng value stay unchanged.
5. No shipped package changes bytes: the work lives in the engine.

## Non-goals

- Spouses for documented persons. A documented person marries only through the existing autonomous matchmaking or the player's `marry` command.
- Several spouses, concubinage, collective rule, celibacy rules per religion (beyond the office rule below), name pools (Codex has not built them).
- New UI views. Existing chronicle, people and family views show the new people and events.
- Changing the existing birth, matchmaking or death rules or their draws.

## Anti-goals

- Any change to Hadara digests, `rngState` pins or the order of existing `random(state)` calls.
- Any change to package bytes, provenance, patch fixtures or release rows.
- A court that grows without bound. Arrivals happen only below a floor; births keep their existing caps (4 children, 600 days, ages 20–42).

## Design

### Gate and stream (Ruling)

A new yearly step `courtRenewalStep(state, events)` runs only when `state.historicalOrigin` is set. It runs inside `annualStep` after `courtAnnualStep` and before the year-event description, so every earlier draw of that year keeps its order. It draws only from a new stream `lineageRngState`, created by `ensureLineageState` with the existing side-stream pattern (`Object.hasOwn` guard, seed from `rngState` with suffix `lineage-v1`, xorshift `lineageRandom`, `validateLineageState` as an integer 1..0xffffffff). `ensureLineageState` adds the stream and a counter object `courtRenewal: { newcomers: 0, spouses: 0, houses: <k0> }` only to historical states, so Hadara states never gain them. `<k0>` is the highest `<k>` among family names that match `/^Hovhus (\d+) \(genererat\)$/` at first ensure, or 0. The step reads and bumps these counters; it never scans names again. `validateLineageState` checks the stream as an integer 1..0xffffffff and the counters as non-negative integers whenever the fields are present, on any state. The step itself is gated on `state.historicalOrigin`, not on the fields. It is called where the other `ensure*` functions are called (normalize, `completeCharacterState`, start of `advanceCharacters`). An old historical save gains the stream at its first load. Cost if wrong: one module.

New people still enter the main-stream death loop from the next year, so a historical campaign diverges from the pre-change run after the first arrival or generated marriage. That is accepted: historical runs have no pinned rng values except the Kyrkostaten century test, which this work rewrites. An old historical save seeds the stream from its current `rngState`, so it differs from a replay from the start; that is accepted too, as for every earlier side stream.

### Court population (Ruling)

"Court adults" are living persons aged 18 or more whose family is not exiled, documented or generated. The floor is 6 court adults and the ceiling for generated spouses is 12. At Charlemagne's court the documented dynasty keeps the count above the floor for decades, so the first arrival there comes late; Kyrkostaten starts with 4 court adults and gets its first arrival in the first year.

### Newcomers (Ruling)

Once a year, when the court has fewer than 6 court adults, the step adds exactly one newcomer, with no draw:

- id `person-<n>` from `state.sequence`; a new family `family-<n>` named `Hovhus <k> (genererat)`, where `<k>` continues after the highest existing `Hovhus <k>` number in the state (the packages use 1–3), with a colour from the existing generated-house palette cycled by `<k>`;
- the family has treasury, estates and influence equal to the smallest values among the existing non-exiled families, so a newcomer house does not outrank an old one; with no such family it gets 110, 2 and 45 as `seedCourt` gives;
- age 25 (born 1 January, 25 years before the current date); sex alternates by newcomer count in this campaign, odd male and even female;
- name `Hovman <m> (genererad)` for a man and `Hovdam <m> (genererad)` for a woman, where `<m>` is `courtRenewal.newcomers` after the bump (from 1);
- archetype: the 7 `ARCHETYPES` keys in their defined order without `legislator`, index `(<m> - 1) mod 7`; family colour from the generated-house palette at index `(<k> - 1) mod` its length; trait `dutiful`; every skill 5; religion of the realm's ruler (or the realm's religion when the ruler is missing); culture as `seedPerson` sets it;
- every other person field (wealth, loyalty, stress, fear, health, goal, mentor, `healthConditions`, portrait identity) as `electeeRecord` in `election.js` sets it; the builder extracts one shared generated-adult record builder rather than duplicating it;
- `identityOrigin: 'generated'`, `originLabelSv: 'Genererad person'` and `historicalOrigin` through `publicPersonOrigin` with generated claims, as `electOutsider` does, with the claim note `Spelet skapade personen när hovet behövde fler vuxna.`;
- an event with the title `Ny person vid hovet` and a Swedish description naming the person and house. Its type is `arrival` if the client views render an unknown event type with its title; otherwise the builder uses the closest existing type and records the choice.

### Generated spouses (Ruling)

After newcomers, and only while the court has fewer than 12 court adults, the step walks living generated persons (`identityOrigin === 'generated'`) in id order. The step runs after this year's matchmaking. A person qualifies when they are aged 18–35, have no living spouse, are not the active representative, hold neither the `ruler` nor the `priest` office, and the matchmaking test finds no partner for them: no living adult of the opposite sex, under 40, without a living spouse, other than the active representative, and not `closeKin`. The ceiling is checked again before each new spouse. For each qualifying person the step makes one `lineageRandom` draw; below 0.25 it creates a spouse:

- opposite sex; age three years younger for a wife and three years older for a husband, never below 18;
- joins the person's family, so children (who take the mother's family) belong to that house;
- name `Gemål <g> (genererad)`, where `<g>` is `courtRenewal.spouses` after the bump (from 1); the marriage event names both partners;
- archetype `steward`, trait `dutiful`, every skill 4, religion and culture of the partner, the other fields and origin fields as for a newcomer, with the claim note `Spelet skapade personen som make eller maka.`;
- both `spouseId`s set, a `partner` bond, and the existing `marriage` event and memory.

The ruler and priest exclusions keep popes and priests from gaining a generated spouse; the existing matchmaking keeps its rules (a non-goal to change). Births then follow from the existing birth step in later years, with its existing caps.

Accepted consequences: a spouse without legal parents who joins the partner's house counts as close kin to the members of that house, so a widowed spouse cannot remarry inside it; the spouse can become family head through the existing mandate refresh.

### Interaction with succession

The step runs after the year's deaths, so a ruler who dies with no candidate under primogeniture or merit still ends the realm before any arrival that year; the floor keeps that case rare, and the elective law keeps its outsider rule.

Newcomers and generated children are ordinary candidates. Under `elective` they rank in the third group; their children rank as kin only once one of them rules. Under primogeniture and merit they let a dynasty pass to a new house when the old one dies out, through the existing outsider rule of `rulerCandidates`. The elected-outsider rule stays as the last resort.

### Presentation

No new views. The people list, family list and chronicle show the newcomers, spouses and children. The engine-limit text of the start card does not change.

## Acceptance

- Hadara: `sharedCharacters.test.js` digests, `PRE_CHANGE_RNG` and all stream-equality tests unchanged; a Hadara state has no `lineageRngState`.
- Unit tests: newcomer below the floor and none at or above it; one newcomer per year at most; alternating sex and counters; family numbering after `Hovhus 3`; generated spouse only under the conditions above, never for ruler or priest, never when matchmaking has a partner; spouse joins the family; the step draws nothing from `rngState`; old historical save gains `lineageRngState`.
- Century tests on all eight `SEEDS`: Charlemagne (Karls rike, realm mode) alive on 25 December 900; Kyrkostaten alive with at least 4 court adults on 25 December 900; at least one generated child born at each of the two courts within the century. Offices stay the player's to fill.
- Package `--check` scripts exit 0 with no package byte change.
- Browser check on server and web: start Karls rike in realm mode, advance one year, and see 0 console errors on both adapters.

## Left to the builder

File layout (a new `server/characters/renewal.js` with src re-export is expected), exact palette, the event description wording within the rules above, and test helper structure.

## Builder-check rulings (8 November 2026)

The builder check raised 15 points; all were settled here without the owner, under the standing mandate.

1. Growth: generated spouses stop at 12 court adults. Cost if wrong: one constant.
2. The spouse step runs after this year's matchmaking and uses the matchmaking partner test.
3. Counters live in `courtRenewal`; names are scanned once, at first ensure.
4. Spouses are named `Gemål <g> (genererad)`.
5. A parentless spouse counts as close kin within the house; accepted.
6. A realm that ends in the same year's deaths stays ended; accepted.
7. Documented people count toward the floor; Charlemagne's first arrival comes late.
8. Fallback family values 110/2/45.
9. Other person fields follow `electeeRecord` through one shared builder.
10. The event type falls back to an existing type if `arrival` does not render.
11. Cycle offsets: `(<m> - 1) mod 7`, `(<k> - 1) mod palette length`.
12. Old saves seed from the current `rngState`; the fields are validated wherever present.
13. Replay and extension-field tests run on Hadara; the builder confirms.
14. The spouse age window is 18–35.
15. Matchmaking may still marry a generated ruler; only the new step excludes rulers and priests.
