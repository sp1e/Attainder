# Development checkpoint: Phase 2 of the AI game master

Updated on 4 November 2026.

## Branch state

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

Review Phase 2 as merged, then write the Phase 3 plan (court and power) in `docs/superpowers/plans/`.

## Known Phase 2 limitations

- A player can infer that a rumor is fabricated. A rumor about `Otrohet` or `Oäkta börd` can only come from `Sprida rykte`, and one without a claimant is shown as `osäker`.

## Still open

Phase 0 did not cover these checks:

1. Participant or mandate changes during a chain.
2. JSON advances: an integration test that saves a chain to JSON between two `advanceCharacters` calls.
3. More than 1,000 newer memories through `advanceCharacters`.
4. Immutable historical roles and story/source uniqueness.
5. The panel in both themes and narrow layouts, with one submitted public choice and one submitted private choice, each followed by a reload.

Claude ran the play scripts through a browser. A person has not played them yet.

Two rules hold for every change. A normal read, validation or presentation call never chooses a branch, spends money or draws randomness. Model output never performs the player's decision: it reaches the save only through a command, and replay never calls the model.

The reference implementation for chains is in `src/runtime/characters/eventChains.js`, with data in `eventChainContent.js` and host integration in `src/runtime/characterWorld.js`. `docs/design/event-chains.md` records the current contract and limits.

Use existing Claude Code/Codex CLI logins. Do not publish credentials, private campaign state or machine-specific QA reports. Install dependencies with `npm ci`, fetch the map files with `node scripts/fetch-map-assets.mjs --ensure` and build with `npm run build`; generated dependencies, map files and bundles are reproducible and intentionally ignored. Preserve upstream AGPL attribution. Public documentation is English; current game text and the historical research report are Swedish.
