# A wonder gives prestige for generations

Date: 10 November 2026. Phase 6, moment 25 of `2026-10-31-ai-game-master-design.md` ("A wonder gives prestige for generations."). Owner mandate: continue without pause and decide by rulings. The first Phase 6 moment, since it needs no foreign realm.

## Problem

`realm.prestige` (`reign.js`) pays one legitimacy a year per 20 points above a floor of 10 and decays by one a year to that floor. Goals, duels and breakdowns move it, and every gain fades. The academy and the aqueduct are lasting works, but neither touches prestige, and only one archetype can order each. The moment asks for a work any ruler can order whose fame outlives the builder.

## Rulings

1. **Historical campaigns only.** The action `build_wonder` appears and runs only when `state.historicalOrigin` is set. Hadara keeps `hadara-1.0.0` and plays byte for byte as on `main`. Cost if wrong: Hadara has no wonders until a later version opts in.
2. **A public project.** `build_wonder` is a public command: it needs the ruler's or a regent's mandate (`requireRule`), is reserved under a regency and is one a greedy regent refuses, like the academy and the aqueduct. It charges 100 silver and one order from the state treasury and opens a public project of kind `wonder` that completes after 120 months. A change of ruler or dynasty does not stop it; the succession forecast lists it with the other public works.
3. **Three kinds.** The payload names `wonderKind`: `cathedral` ("Rikets katedral"), `palace` ("Det kungliga palatset") or `library` ("Det stora biblioteket"). The kinds differ in name only. Each kind is built once; one wonder is under construction at a time; at most three stand.
4. **Completion.** The realm gains 15 prestige when the project completes, through the existing project step, which also logs "`<title>` står färdigt".
5. **For generations.** Every standing wonder lifts the prestige floor by 20: `prestigeStep(state, lift)` keeps prestige at least `10 + lift` (held at 100), so one wonder holds prestige at 30 and pays one legitimacy a year for the rest of the campaign, two pay two, three pay three. Prestige above the lifted floor still decays by one a year. Without a wonder `lift` is 0 and the step is unchanged.
6. **Storage.** A completed wonder is a completed project of kind `wonder` with its `wonderKind`, so saves need no new field and no migration.
7. **No draws, no version change.** Nothing draws from a random stream. `rulesVersion` and `contentVersion` stay `hadara-1.0.0`.
8. **Not in scope.** Wonders do not count towards the reign goal of a lasting work, do not change revenue and cannot be destroyed. Cost if wrong: a later moment adds those links.
