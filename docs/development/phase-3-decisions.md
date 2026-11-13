# Phase 3 decisions

This is an extract of the Phase 3 task ledger, which Git ignores. It keeps each line as written during the work on 4 and 5 November 2026. A ruling reads: what was decided, why, and what it costs if wrong.

A deferred minor can be out of date, because a later task may have settled it. Check the code before acting on one. "Task 12" means the documentation task of the same plan, which landed in PR #10.

## Rulings (35)

- Task 2 keeps a passing panel by leaving the panel's loyalty `Meter` to Task 10 only if render tests stay green; if a panel test reads `loyalty`, Task 2 updates that test — the plan removes the field in Task 2 and rebuilds the row in Task 10 — if wrong, the meter shows empty for eight tasks on a branch nobody plays.
- forced abdication does not end the campaign — spec moment 16 asks only for the demand and the transition, and a campaign continues under the successor as `updateStatus` already does — if wrong, Simon wants a game-over screen, which is one added condition.
- `general`'s loyalty stays inside `militaryReadiness` (index.js) — the plan caps `crush` display by loyalty precision, and readiness mixes four inputs, so a player cannot read loyalty out of it — if wrong, a sharp player estimates a general's loyalty.
- a new reign's record holds `goals: []`, so an abandoned goal leaves no trace — Task 4 needs "a successor inherits no goal and no penalty" and three status labels only — if wrong, `beginReign` must carry the list over and two readers must filter by reign.
- `applyRealmDissolution` calls `onAccession(state, null, ...)` although the plan names only `crown` — a dissolved realm must not keep a reign on record — if wrong, one extra hook point in index.js.
- `Personens lojalitet` leaves the conversation card below `exact` although the brief keeps the rows — the sign gave five buckets to a player who should read three — if wrong, the player sees one row less in a card that still states the chance.
- `reward_councillor` refuses the ruler with `Härskaren kan inte belöna sig själv.` and `opinionOfRuler` is 0 for the ruler — a crowned councillor otherwise scores 98 service — if wrong, a sitting ruler in a seat serves at loyalty alone.
- `view.economy.militaryReadiness` keeps `general.loyalty × 0.25` — it is a Phase 1 world number, the player must subtract three other inputs to reach loyalty — if wrong, a sharp player reads the general's loyalty; list it under known limitations in Task 12.
- `recordDeed('executions')` counts only when the acting representative is the ruler — same rule as `charge`, so a regent's execution does not name the ruler `den Grymme` — if wrong, a regency hides executions from the nickname table.
- Task 7's `discontentOf` adds +10 for a person with a `nemesis` relationship to the ruler — nothing reads the relationship today, and moment 14 promises enemies — if wrong, an executed noble's vengeful kin join factions sooner; tunable through the Task 9 ranges.
- `lasting_work` eligibility reads the active representative's archetype, not the ruler's — that person issues the build command — if wrong, a regent's goal outlives the regency it was set under.
- a yearly goal check past `dueAt` stays met-first — a yearly check always lags, and the brief states the order — if wrong, a goal set on an annual date runs a year longer than shown.
- a scholar with an overdue aqueduct is refused `lasting_work` although the `academy` command stays open — the refusal lasts under a year, until the next yearly tick closes the work — if wrong, the scholar waits one tick to set the goal.
- `reconcile_houses` compares `familySupport` unrounded against 55 — the threshold is a rule, the panel rounds for display — if wrong, 54.6 shows 55 and misses; one `Math.round` in `housesReconciled`.
- a `reconcile_houses` goal set while a house lived stays open if the last other house dies, and costs -3 legitimacy, +10 stress at its due date — a goal is a promise made under risk — if wrong, one abandon path.
- `recordDeed('breakdowns')` counts only when the acting representative is the ruler — same rule as `charge` and `executions`, so a family head's breakdown does not name an NPC ruler `den Bräcklige` — if wrong, a regent's breakdown stays out of the nickname table.
- `breakdownStep` waits one turn when a crisis opened that day — one year turn must not open both, the brief's stated intent — if wrong, a breakdown arrives a year later than stress 100 alone would allow.
- `stressFor` and `consumeAppointConsent` join `actionHooks` outside the named hook points — a granted demand must spend the regent's consent itself, and the review found no bypass — if wrong, two hook keys to move.
- the fixture edits in `prisoners.test.js` (`hushDemands`) and `extensions.test.js` stand — review found they hide no behaviour change, and a pre-Task-6 save cannot hold a `family_demand` story — if wrong, a later round-trip test fails on a hushed fixture.
- `claimantFor` follows the written chain; the plan's Tarek example is wrong, since Tarek is Sera's spouse with empty `legalParentIds` — the definition is the rule, the example an illustration — if wrong, Task 11 scripts Moment 16 with Iset as claimant.
- spec moment 16's "the ruler's brother" is met by the sibling branch, reachable once Mira reigns with Neri alive and adult — in the opening cast Sera has no sibling and Tarek is her spouse — if wrong, Task 11 needs a generated sibling in its script state.
- tightening `validateFactions` for ultimatum, appeased and closed-outcome records moves to Task 8 — Task 8 writes those states and can test against real writes — if wrong, a forged record loads until Task 8 lands, on a branch nobody plays.
- members of a house that returns through `return_exile` stay out of the faction until the join draw — banishment broke the bond — if wrong, one rejoin line in `refreshFactions`.
- `index.js:252-255` reruns `refreshMandates` and `refreshStories` when a forced abdication crowns, outside the named hook points — it mirrors `killPeople`, adds no draw, and a story otherwise falls four months late — if wrong, one block to move.
- a crush and a deposition put every member into `knownMemberIds` — the rows those paths must write would otherwise name hidden people, and an open fight ends the secrecy — if wrong, the player learns members of a faction that no longer exists.
- a regent cannot choose `abdicate` in an ultimatum — the command refuses a regent, and the choice gave the principal a better exit than the forced route — if wrong, one `disabledReason` to drop.
- a successful crush logs public event `Faktionen slås ned`, beyond the brief — it names only the ruler and the leader, and a crushed plot deserves a line — if wrong, one log call.
- under an NPC ruler a breakdown charges no legitimacy or prestige, `rage` cows nobody, and treasury pressure reads the family's silver — `hooks.canRule()` decides who speaks for the realm — if wrong, a family head's breakdown costs less than a ruler's, which the health, orders and silver rows still make real.
- `lostOrders` stays in `state.reign`, so an NPC accession wipes a family head's lost orders — window of at most 12 months, 2 orders — if wrong, carry it through `beginReign`; listed for Task 12. Superseded on 13 November 2026: `beginReign` carries `lostOrders`, and they fall due also after the realm has ended. In realm mode a successor pays the lost orders of a ruler who withdrew.
- the script's "imprison until one is held, then execute" is one execution — the brief's sentence is one sequence, and dread 15 needs one act — if wrong, a yearly purge suppresses factions on seed 1234, which fits "fear holds nobles back" but breaks the seven-systems proof.
- constant-pinning tests (`factions.test.js` constants, `familyDemands.test.js` CHANCES) follow the tuned values — "never change the assertions" guards the balance test, and a pin of a tunable has to move with it — if wrong, the tuned values go back and Task 9 is blocked on two seeds.
- a ruler keeps a council seat after accession — no number goes wrong, and vacating it shifts every balance run — if wrong, Task 12 vacates the seat and reruns `courtBalance.test.js`; listed under known limitations. Superseded on 13 November 2026: numbers did go wrong (a ruler as her own spymaster read loyalty at her full intrigue, and an NPC realm seated its ruler as general). `crown` now empties the new ruler's council seats, and `appoint` and the realm's own appointments pass the ruler over; `courtBalance.test.js` passes unchanged.
- no second twin shifting fear and opinion — `person.fear` is a public field and opinion rows reach the view by design, so that twin fails for legal reasons; `loyalty` and `discontentOf` rest on key and text checks — if wrong, a rounded discontent under a new key passes the test.
- brief item 3's "leader measures" is wrong, they hold `Stress` and `Legitimitet`; only the `PeopleView` meter changed — review confirmed by reading the panel — if wrong, nothing, no other reader exists.
- `StoryCard` hides `description` for a choice with `odds`, and the engine keeps the sentence — `resolveStory` logs it, and it reaches `Årskrönika` — if wrong, the chronicle reads "Chans att lyckas: osäker" after a crush.

## Deferred minors (31)

- Task 1: minor (deferred): the `abandoned` loop in `beginReign` is a dead write; remove it and the `abandoned` status in Task 4.
- Task 1: minor (deferred): `reign.rulerId === offices.ruler.holderId` can be validated once dissolution closes the reign; add in Task 4.
- Task 1: minor (deferred): Task 2 pins the `courtAnnualStep` call, order after `npcPlotStep`, and the alive guard.
- Task 1: minor (deferred): court.js comment "Called last by crown" is now wrong; fix in Task 2.
- Task 1: minor (deferred): `state.reign.lawful` in `applyRealmDissolution` throws on a raw pre-version-3 state; `hostTransition` could run `ensureCharacterExtensions`; no player reaches it.
- Task 1: minor (deferred): household `blockedReason` on an ended realm campaign reads "Kalendern kan fortsätta."; copy pass.
- Task 2: minor (deferred): order pin reads source text; replace with a behavioural test once a court step draws from `plotRandom` (Task 6).
- Task 2: minor (deferred): `filledSeats` still offers the ruler's own seat, which always refuses; filter it out.
- Task 2: minor (deferred): `rewardCouncillor` compares with the ruler, so a regent in a seat can reward herself; compare with `activeRepresentative`.
- Task 3: minor (deferred): `seedBefore` is copied into 7 test files; a shared test helper would remove the copy.
- Task 4: minor (deferred): plan lines 68 and 164 still name `abandoned`; plan text only, code is settled.
- Task 4: minor (deferred): regencyVeto can block a regent's build after `lasting_work` is set; the veto reads the regency, the goal reads the representative.
- Task 4: minor (deferred): `reign.js:124` refuses a builder with an overdue aqueduct with "Härskaren kan inte bygga ett sådant verk."; copy pass.
- Task 5: minor (deferred to Task 9): family mode under an NPC ruler charges legitimacy and prestige to the NPC's realm, `rage` frightens the player's own kin, and `treasury < 20` pressure reads a treasury the player cannot touch; decide copy and effects for a non-ruling representative.
- Task 5: minor (deferred to Task 6): family-mode dissolution leaves a breakdown open; add `COURT_STORY_TYPES` to the closing list in `applyRealmDissolution`.
- Task 5: minor (deferred to Task 9): `lostOrders` lives in `state.reign`, so an NPC accession wipes a family head's lost orders.
- Task 5: minor (deferred to Task 6): `demandPressure` calls `addGameMonths(demand.closedAt, 12)`; Task 6 guarantees `closedAt` on `refused` and `lapsed`.
- Task 5: minor (deferred to Task 7): `factionPressure` must read `presentFactions`; a comment marks the line.
- Task 6: minor (deferred to Task 8): dissolution closes court stories by raw assignment and skips `onClose`; void the faction record in `onAccession`, or expose a close-all through the row.
- Task 6: minor (deferred): `yearOnStream` and `hushDemands` duplicate one fixture with a dangling `storyId`; one shared helper.
- Task 6: minor (deferred): "automatic one does not" calls `assignOffice` directly; drive one year turn under an NPC ruler with a vacant seat.
- Task 6: minor (deferred): `council.test.js:120` advances `next` inside an assertion.
- Task 6: minor (deferred): `validateFamilyDemands` does not compare `story.actorId` with `family.headId`.
- Task 7: minor (deferred): "ännu en person" on the first discovery; plan-mandated copy.
- Task 7: minor (deferred to Task 10): a known faction that dissolves vanishes without text; consider a line.
- Task 7: minor (deferred to Task 12): plan names only `factions.test.js`; Tasks 7 and 8 also use `factionsPresent.test.js` and `factionUltimatum.test.js`.
- Task 8: minor (deferred): a forced expiry can fire inside `killPeople` when dates coincide; deterministic, and the event order reads oddly.
- Task 8: minor (deferred): `NO_MANDATE`, `NO_ORDERS`, `NO_FUNDS` repeat strings across modules; the codebase's habit.
- Task 10: minor (deferred): `court.legitimacy.sources`, `court.dread.value` and `faction.knownMembers.length` read without guards; `presentCourt` always supplies them.
- Task 10: minor (deferred): `entries`, `number` copied; `Section` exported from the court module.
- Task 10: minor (deferred): `aria-labelledby` points at the whole button; a label id gives a shorter name.
