# Development checkpoint: Phase 3 of the AI game master

Updated on 5 November 2026.

## Historical foundation checkpoint

Tasks 1–4 are accepted through `5e3f515`. Task 5 integrates the historical defaults, start validation, save restoration and start UI. Its local serial suite ran 4,618 tests: 4,615 passed, none failed, one was skipped and two are TODOs, in 157.44 seconds. Independent Task 5 review remains pending. The browser verification in Task 6 has not run. Year-by-year historical research and the turn-end reference popup remain separate backlog work.

## Branch state

Phase 3 tasks 1 to 10 are on `main`. PR #9 squash-merged them as `9a780f7` on 5 November 2026, ahead of schedule because the weekly token limit was nearly spent. `phase-3/court-and-power` keeps the individual commits. Each task passed its own review. The whole-branch review found two reproduced issues; both now have reviewed fixes. The final follow-up review of `08d3518..55283dc` approved the branch with no new Critical, Important or Minor findings. The required test/build check passed in [CI run 42020869295](https://github.com/sp1e/Attainder/actions/runs/42020869295). [PR #12](https://github.com/sp1e/Attainder/pull/12) merged the fixes, and the remote `main` commit was verified as `6f4f7c0de84ea58010e5ea597ff0325f572ea4eb`. The retained remote branch `fix/phase-3-review` ends at `55283dc`; its tested production code remains `cfa225238c5065441e4642481ab507629e498e73`. Nobody has run the Phase 3 play script; the owner deferred the Hadara script behind the historical foundation.

- Phase 3, engine: `reign.js`, `court.js`, `council.js`, `dread.js`, `nicknames.js`, `breakdowns.js`, `familyDemands.js`, `factions.js`.
- Phase 3, model boundary: `buildCharacterPromptContext` adds `court: view.court` and one rule paragraph.
- Phase 3, panel: `CourtSections.jsx`, with the reign card, `Rådet`, `Krav från familjerna` and `Faktioner`.
- Tuned constants: `DISCONTENT_THRESHOLD` 15, demand base chance 34. On eight seeds over ten years every system fires, and an ultimatum fires on seven.
- Phase 3 limitations: a forced abdication does not end a realm campaign; a player can infer an NPC's ambition from traits; `general.loyalty` stays in `militaryReadiness`; an NPC accession wipes a family head's `lostOrders`; a ruler keeps a council seat after accession; no opening ruler has a sibling, so the spec's "ruler's brother" appears once Mira reigns with Neri alive.

Phases 0, 1 and 2 are on `main`. PR #4 squash-merged Phase 2 as `ef0ab7c` on 3 November 2026, and `phase-2/intrigue` keeps its 28 individual commits. Development moved to the owner's private desktop on 4 November 2026. Campaign saves from the earlier computer stayed there.

- Design: `docs/superpowers/specs/2026-10-31-ai-game-master-design.md`. Plans: `docs/superpowers/plans/`, with `2026-10-31-phase-2-intrigue.md` for this phase.
- Phase 0 (event chains): save-validation fixes in `validateEventChains`, rollback and journal tests, and `eventChainIntegration.test.js`.
- Phase 1: the action catalog with `Påverka` and `Undergräv`, labelled odds with skill-based precision, two-roll resolution into five tiers, multi-month schemes, on-demand court staff, the `realm_effect` and `npc_intent` gate, the low-effort `interpret` and `narrate` calls, and the `Handla själv` card. Details are in `docs/play-scripts/phase-1.md` and the contract.
- Phase 2, engine: extensions version 2 with the plot stream `state.plotRngState` and the vacant `Spionmästare` office (`extensions.js`); secrets, grips and crimes (`secrets.js`, `crimes.js`); feasts (`occasions.js`); five more contested actions, `Förgifta`, `Snoka`, `Utpressa`, `Sprida rykte` and `Fängsla` (`actionCatalog.js`, `actionOdds.js`, `actionResolution.js`); prisoners, ransom offers and revolt preparations (`prisoners.js`); rumors heard by the spymaster (`rumors.js`); yearly NPC plots, feuds and affairs, and the `plot_uncovered` decision (`npcPlots.js`); court conversations (`conversation.js`).
- Phase 2, model boundary: the `extract_conversation_request` and `reply_as_character` calls, the `converse_request` command that only `submitConversationRequest` can send, and the Phase 2 facts in the year prompt (`characterModelCalls.js`, `characterWorld.js`). Rumor truth and an estimate's true values never reach a prompt.
- Phase 2, panel: the `Intriger` tab (`IntrigueView.jsx`), `Samtala` and the conversation card (`ConversationView.jsx`), the feast card in `Överblick`, and the prisoner and plot decisions in `Beslut`.
- The contract for all of this is `src/runtime/characters/CONTRACT.md`. `rulesVersion` and `contentVersion` stay `hadara-1.0.0`; `state.extensionsVersion` is 2, and a version 1 save migrates additively on load. Old campaigns load as `Normal`.
- The yearly auto-fill of vacant offices skips `Spionmästare`. Filling it would shift the main random stream and change existing dynasty tests, so the ruler appoints it. A realm run by NPCs has no spymaster.
- Command sequence: on-demand court staff, secrets, hooks, occasions, prisoners, rumors and conversations take ids from `state.sequence`, so the text-sorted person order can differ from a pre-Phase 1 run of the same save. Replay uses stored patches, so no saved campaign changes. Numeric sorts would change `annualStep` randomness order and are left for a `rulesVersion` bump.

## Verification

- Historical foundation Task 4 local checks on 5 November 2026, accepted through `5e3f515`: 253 targeted tests passed with zero failures in 12,187.8953 ms; production build passed in 31.51 seconds with the inherited Babel large-file note and chunk-size advisory. The final run includes the self-review follow-up that removed two additional future-history prescriptions and one associated writing sentence from the historical jump path. The validated hidden-faction fixture also passed its 27-test context suite after its final fixture correction. Captures cover 16 interactive requests and 12 assembled historical jump prompts plus 12 legacy controls. The complete suite and browser acceptance were not rerun for Task 4.
- Historical foundation Task 3 checks on 5 November 2026, accepted through `808361e`: focused engine/runtime/calendar/policy/schema/package suite 1,386 pass; full serial suite 4,584 tests, 4,581 pass, 0 fail, 1 skipped, 2 todo in 115,930.7581 ms. Production build passed in 31.50 seconds with the inherited Babel large-file note and chunk-size advisory. Targeted ESLint reported no diagnostics. The installed-layout test imports the real schema/factory without `src/` and constructs both authored courts. All six original Hadara full-state hashes remain unchanged. These checks do not include historical start UI or browser acceptance, which remain Tasks 5–6.

- Phase 3 follow-up publication on 5 November 2026: final branch review `08d3518..55283dc` approved, with no new Critical, Important or Minor findings; required test/build CI passed in [CI run 42020869295](https://github.com/sp1e/Attainder/actions/runs/42020869295); [PR #12](https://github.com/sp1e/Attainder/pull/12) merged; remote `main` verified as `6f4f7c0de84ea58010e5ea597ff0325f572ea4eb`. The local production-code measurements below remain unchanged.
- Phase 3 review follow-up on 5 November 2026, tested code `cfa225238c5065441e4642481ab507629e498e73`: full serial suite 4,410 tests, 4,407 pass, 0 fail, 1 skipped, 2 todo, in 111,035.0005 ms. Build passed in 33.08 seconds with the inherited chunk-size warning. Full lint: 18 errors and 71 warnings, unchanged; targeted replay ESLint: no diagnostics. The scoped re-review approved the interleaved-date fix with no open Critical or Important findings. These checks do not include the deferred Phase 3 browser script or the Phase 0 visual check.
- Earlier follow-up measurements: annual accounting at `e5358ac` passed 51 focused tests and 24 complete-state parity scenarios; full serial suite 4,404 total, 4,401 pass, 0 fail, 1 skipped, 2 todo; build passed in 36.77 seconds. Legacy replay at `063fa87` passed 185 focused tests; full serial suite 4,409 total, 4,406 pass, 0 fail, 1 skipped, 2 todo, in 113,742.2782 ms; build passed in 31.57 seconds. Its first review then found an intervening model event's date synchronization missing from compatibility replay. Fix `cfa2252` passed the new regression and all 186 focused tests before the final suite above.
- Phase 3 on 5 November 2026: `npm test` at `1698e61` ran 4,370 pass, 0 fail. The runtime suite at `62c7bd4` ran 2,280 of 2,280. Panel tests at `054d46a` ran 106 of 106. CI `test` passed on PR #9.
- Phase 0 gaps on 4 November 2026, branch `test/phase-0-gaps`: 93 tests cover participant and mandate changes during a chain (50), JSON saves between two `advanceCharacters` calls (6), more than 1,000 newer memories (5), and immutable historical roles with story and source uniqueness (32). The last group found a real bug: `validateEventChains` loaded forged saves with swapped roles, rewritten role families, renamed source keys, rewritten city references, repeated steps, step actors outside the cast, deleted chains and spare chain memories. `eventChains.js` now rejects each of them. Full suite after merging main: 3,934 tests, 3,931 pass, 0 fail, 1 skipped, 2 todo.
- Codex on 4 November 2026: a local Codex 0.166.0 answered through `generateWithLocalModel` in plain text in 8 seconds and with a schema in 5 seconds, using the existing ChatGPT login. The global Codex 0.117.0 on this computer stays as it is, and the game shows `Behöver uppdateras` for it. A full model year through Codex has not run.
- Phase 2 review on 4 November 2026, branch `fix/phase-2-review`: an independent reviewer reported nine findings against main, and I confirmed all nine in the code. The fixes hide a collapsed plan from a target who never saw it, lift the spymaster's discovery cap only when his bonus is above 0, tell the reply prompt when a speaker has nothing to tell, refuse a hook an active scheme holds, keep prisoners out of new directed stories and event chains, refuse saves with a held prisoner on the throne or in an office, move an open ransom demand to the new captor, stop an actor reusing a secret that already gave a hook, and require 20 silver before an offer grounds an argument. Against main, 24 prisoner-free campaigns over 960 campaign years kept every saved stream and the whole state. The 32 saved states in this checkout that have a prisoner list load on both engines. Serial suite: 3,841 tests, 3,838 pass, 0 fail, 1 skipped, 2 todo, in 102 seconds. `npm run lint`: 18 errors and 71 warnings, unchanged. Still open: a directed story or chain that is already open stays open when its actor goes to prison later.
- After the play scripts and their fixes on 4 November 2026: 3,821 tests, 3,818 pass, 0 fail, 1 skipped, 2 todo, in 96 seconds. `npm run lint`: 18 errors and 71 warnings, unchanged. `npm run build`: exit code 0.
- Fresh clone on 4 November 2026, Node 24, with the Claude Code detection fix: 3,812 tests, 3,809 pass, 0 fail, 1 skipped, 2 todo, in 91 seconds. `npm run lint`: 18 errors and 71 warnings, unchanged. `npm run build`: exit code 0.
- Live smoke check on the same day: Claude Code read `Jag försöker vinna Namars stöd med gåvor och smicker` in one model call, and the game showed the odds card for `Påverka` against Namar. I cancelled the action, so nothing resolved. The browser console showed no errors once the map files were in place. This check covers one card of Part 3 in the Phase 1 play script.
- Full serial suite on 3 November 2026 at commit `ce1e63e`, after the final review fixes: 3,811 tests, 3,808 pass, 0 fail, 1 skipped, 2 todo, in 172 seconds. Phase 1 ended at 3,543 tests, so Phase 2 added 268. `server/payloadUpdate.test.js` can fail on Windows with an `EPERM` rename; it passed in this run.
- `npm run lint`: 18 errors and 71 warnings, the same as `origin/main`. Phase 2 adds no lint finding. An earlier run showed 20 errors, because the name `useHook` in `secrets.js` made the React hooks rule fire in `actionResolution.js` and `conversation.js`; both files now import it as `consumeHook`.
- `npm run build`: exit code 0.

## Play scripts

Both scripts ran against Claude Code on 4 November 2026, driven through a browser. Every part passed.

**Phase 1**

| Part | Result | Notes |
|---|---|---|
| 1, 2 | Pass | |
| 3 | Pass | `Påverka` against Namar av Hadara. Success `osäker`, secrecy `osäker`. The model read the text in 4.4 seconds. |
| 4 | Pass | Tier `Misslyckat och avslöjat`, story `Arels ord faller till marken`. |
| 5 | Pass | The script said the game stays open after a reload. A reload returns to the main menu, so the script now says to click `Current`. |
| 6 | Pass | `Undergräv` against Dara Namar at `osannolik`. The target found out, so the chronicle shows `Undergräv: planen avslöjades`. The model year took 118 seconds. |
| 7 | Pass | |
| 8 | Pass | After `Clear list` an English modal about Gemini opened. Dynasty campaigns no longer show it. |
| 9 | Pass | The pre-Phase 1 save from `728eaec` loaded as `Normal`, and a model year ran in 125 seconds. The old build needed two local patches to reach Claude and to finish its year: the Claude detection and the `sold` guard below. |

**Phase 2**

| Part | Result | Notes |
|---|---|---|
| 1 to 3 | Pass | |
| 4 | Pass | Poison against Tarek Arel: success `osäker`, secrecy `osäker`. `Gästabudet ger tillträde: +` and `Hemlighållning: många vittnen på gästabudet: −` showed in both the free-text and the menu card. |
| 5 | Pass | Tier `Förgifta: misslyckat i det tysta`. Tarek lived. The model year took 182 seconds. |
| 6 | Pass | The spymaster heard `Sammansvärjning: Sera Arel`, named culprit Danel Safra, reliability `trolig`. A rumor about Talia Namar succeeded and shows `Påstådd aktör: okänd`. |
| 7 | Pass | A support request with 20 silver at `osäker` ended in `Sera Arel avvisar förfrågan.` The reply agreed with the note, and the repeat was refused. Focus landed on the person's heading, because a decided request hides `Samtala`. |
| 8 | Pass | `Fängsla` against Kelan Namar: success `jämn`, secrecy `mycket låg`, tier `Lyckat men avslöjat`. |
| 9 | Pass | The offer `Lösen för Kelan Namar` came after one year. `Ta emot lösen` freed the prisoner. |
| 10 | Pass | `Personen finns inte i spelet: Zorbas.` |
| 11 | Pass | On `Svår` a rumor came after one year and `Komplott avslöjad: Kelan Namar` after two. `Behåll kunskapen som grepp` gave `Grepp över Kelan Namar`, `Styrka: starkt`. |
| 12 | Pass | |

The play scripts reached four of the five tiers. `Det slog tillbaka` did not come up, and unit tests cover it.

**Bugs the scripts found, all fixed**

- A Claude Code installed through npm was reported as missing, because the bridge looked for `claude.exe` only in `~/.local/bin` and on `PATH`.
- `LEGAL_TRANSFER_LANGUAGE` matched the Swedish word `sold` (a soldier's pay). A character campaign treats its final attempt as strict, so the whole year was lost after 158 seconds. The check now needs `sold to`.
- Codex older than the flags the bridge sends read `Inloggad och tillgänglig` and then failed on every call. Codex 0.117.0 lacks `--ignore-user-config`; 0.166.0 has it. The status now reads `Behöver uppdateras` with the update command. A real Codex call has not run on this computer.
- `Planen avgörs 1/4 300 f.Kr..` had two periods, `Statskassan förändras med 30.1 silver.` used a decimal point, and the skill list showed `prowess` in English.
- A failed year showed the model call's English error. The panel now shows a Swedish sentence and logs the original.
- The panel header still read `Open Historia · Dynastier`.

## Next step

Codex has taken over development for now. Current priorities are in `docs/development/DEVELOPMENT-BACKLOG.md`; the earlier queue is in `docs/development/CODEX-HANDOVER.md`.

The owner changed the setting on 5 November: use the real world and historical polities, with new starts from the Bronze Age through about AD 1200 and no modern starts. `docs/superpowers/specs/2026-11-05-historical-world-direction.md` supersedes the fictional Hadara default. The Phase 3 follow-up is merged. Follow `docs/superpowers/plans/2026-11-05-historical-campaign-foundation.md`. Tasks 1–2 are accepted through `6397177`: pure start policy and sourced Egypt/AD 1200 packages. Task 3 is accepted through `808361e`. Its mechanical shared-engine relocation was published as `d9633af`; historical construction uses that same engine. Task 4 is locally tested and pending independent review: the four interactive calls and both assembled jump prompts consume visible historical context, with alternate outcomes after the start. Tasks 5–6 remain open: combined guards/defaults/UI, then browser evidence. Complete Task 4 review before Task 5; Task 5 still owns activation of the historical default and start guards. The foundation is not feature-complete. Prioritize it before the remaining Hadara browser script and Phase 4.

The owner also requested year-by-year historical research for approximately 3300 BC through AD 1200 and a turn-end popup showing the real events of the current year alongside dynamic campaign events. The backlog records the research scope, source/date uncertainty, coverage gaps and game acceptance criteria. A private research pilot and independent checking have begun. There are no release-approved event records, no reviewed whole year and no implemented popup.

## Phase 3 review rulings

- Annual reporting counts actual base receipts plus the chancellor's paid delta, including treasury clamps and rounding. Loyalty drift and court ordering stay unchanged. The existing year event retains its ID, position and public shape; the one-decimal aggregate reveals no separate numerical service or loyalty field. Other story/plot payments retain their own events. This fixes the unexplained chancellor residual without changing payment outcomes.
- Legacy replay reconstructs stored outcomes before migrating checkpoints. Normalization validates and retains raw legacy full-checkpoint payloads. Compatibility handling follows the adapter after each event's date synchronization and host reconciliation, including model events without character operations. Current-version checkpoints and authorized commands end that handling. Current-version reign mismatches, revision mismatches and invalid source/gate metadata still fail validation. No new random draw, model call, persistent provenance or version bump is involved. An unsupported legacy shape needs a separate compatibility regression.

## Known Phase 2 limitations

- A player can infer that a rumor is fabricated. A rumor about `Otrohet` or `Oäkta börd` can only come from `Sprida rykte`, and one without a claimant is shown as `osäker`.

## Still open

One Phase 0 check remains: the panel in both themes and narrow layouts, with one submitted public choice and one submitted private choice, each followed by a reload.

Claude ran the play scripts through a browser. A person has not played them yet.

Two rules hold for every change. A normal read, validation or presentation call never chooses a branch, spends money or draws randomness. Model output never performs the player's decision: it reaches the save only through a command, and replay never calls the model.

The reference implementation for chains is in `src/runtime/characters/eventChains.js`, with data in `eventChainContent.js` and host integration in `src/runtime/characterWorld.js`. `docs/design/event-chains.md` records the current contract and limits.

Use existing Claude Code/Codex CLI logins. Do not publish credentials, private campaign state or machine-specific QA reports. Install dependencies with `npm ci`, fetch the map files with `node scripts/fetch-map-assets.mjs --ensure` and build with `npm run build`; generated dependencies, map files and bundles are reproducible and intentionally ignored. Preserve upstream AGPL attribution. Public documentation is English; current game text and the historical research report are Swedish.
