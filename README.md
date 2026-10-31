# Attainder

An ancient empire strategy game built on [Open Historia](https://github.com/Open-Historia/open-historia). Choose whether your campaign follows the state through successive rulers or a family that can survive losing power.

The playable prototype starts in fictional Hadara in 300 BCE with four political families, 24 characters, four cities and twelve provinces. The character interface currently uses Swedish. Public project documentation is in English.

## Play locally

Use Node.js 24, npm, and an installed, authenticated Codex CLI or Claude Code. The game uses the CLI's existing login. Model requests count toward that account's usage limits.

```sh
git clone https://github.com/sp1e/Attainder.git
cd Attainder
npm ci
npm run build
node scripts/launch-dynasties.mjs
```

On Windows, after the first build, double-click `Start-Attainder.cmd`. The launcher opens http://127.0.0.1:4167. Select Claude or Codex, then choose the state or family campaign mode. Expand the campaign seed control to set a starting seed. An empty field uses 104729. Seed 293 reproduces the starting conditions used in the smallpox gameplay check. Model narration can vary between runs.

Fresh clones store campaigns in `play-data/` and launcher logs in `reports/launcher/`. Both are ignored by Git. Set `ATTAINDER_DATA_HOME` to use another data directory. The older name `TIDES_DATA_HOME` still works. The original development installation retains its existing sibling data directory automatically.

## Character systems

- A ruler's archetype determines available abilities. Succession changes those abilities.
- Offices & inheritance shows a read-only succession forecast: expected actual ruler, lawful claims, ability changes, regency limits and project continuity. It describes a single ruler's death at today's date. Later events can change the result.
- A royal regent's authority and consent rules apply in both campaign modes. AI appointments and political stories use the acting adult's personality. A family guardian has a separate mandate. Blocked office promises can be deferred without payment.
- Severe illness can temporarily prevent an adult from exercising a mandate. Royal and household representatives act separately, and replacing a regent invalidates that person's consent. Recovery restores an unexpired personal ability without transferring the crown, family headship or property.
- Personality affects stress and changes how characters make decisions. Personal opinion, family support and religious affiliation remain separate.
- Memories connect decisions to later stories. Offices, family property, legal claims and actual political power can pass to different people.
- Eight recurring event types cover household pressure, education, temple donations, troubled cities, veterans, reconciliation, exile and returned favors. Participants and selection weights depend on the current campaign. Choices change resources, relationships and public administration; past support can return through a family successor.
- Illness, household infection, treatment, recovery and lasting scars follow the saved calendar. New care decisions can interrupt a longer time jump.
- OpenArt portraits follow each person's state. The 24 starting identities have 864 variants covering twelve conditions across three age groups.

The rules engine owns character outcomes. The model describes the world and can propose character actions. It cannot execute the player's decisions. Failed model generations do not silently become completed character turns.

Recurring decisions show why they appeared and when they expire. A longer turn stops at a new decision before the model narrates beyond it. If you continue without answering for twelve months, the stated free fallback applies. Events have participant and topic cooldowns to limit repetition.

## Free-text actions and odds

In the `Överblick` tab of the character panel, the card `Handla själv` takes a sentence such as `Jag försöker vinna Namars stöd med gåvor och smicker`. A low-effort model call maps the text to one action in the catalog. The engine then computes the odds, and a confirmation card shows them before anything is spent. `Välj från listan` opens every action as a menu, which also works when the model is disconnected or cannot read the text.

- Two contested actions exist: `Påverka` (sway, instant) and `Undergräv` (undermine, a three-month scheme). Command actions such as appointments stay in the same menu.
- Odds are integers from 5 to 95 for success and for secrecy, each with a list of labelled modifiers. How much of this the player sees depends on the actor's skill in the action: 12 or more shows the exact percentage, 7 to 11 shows one of five bands (`mycket låg` to `mycket hög`), and below 7 shows one of three (`osannolik`, `osäker`, `trolig`).
- Two rolls on a separate random stream pick one of five tiers: `Lyckat i det tysta`, `Lyckat men avslöjat`, `Misslyckat i det tysta`, `Misslyckat och avslöjat` and `Det slog tillbaka`. The tier fixes the effects. A second low-effort model call writes the story and can move ranged effects inside their allowed range. If that call fails, the standard text stands.
- A scheme is paid at the start, checked monthly for discovery, and resolved on its due date. `Pågående intriger` lists the family's schemes, and `Avbryt intrigen` asks for confirmation first.
- Difficulty is `Lätt`, `Normal` or `Svår`, chosen on the start card or in the scenario picker. It moves the player's contested odds by +10, 0 or −10 percentage points, and in the opposite direction for NPC actions against the player's representative. Earlier campaigns count as `Normal`.
- Model proposals pass a gate. A `realm_effect` or `npc_intent` runs only through the engine's rules, with at most 4 and 3 per model turn, and a refused proposal is listed in the timeline. Replay never calls the model.
- The panel footer shows `Modellanrop denna session`. The count lives in the open page and is not saved. It counts calls made through the local CLI only; calls through API-key providers are not counted.

The contract is in `src/runtime/characters/CONTRACT.md`. [The Phase 1 play script](docs/play-scripts/phase-1.md) walks through each feature in the running game.

## Scenarios Are Released Under CC BY 4.0

The upstream scenario-sharing rules remain in place. Scenarios posted or shared through the game are released under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/). Exported scenario files include the corresponding license record. Separately referenced maps, music and other third-party material retain their own terms.

## Development status

This is a playable development version. The local serial suite on 31 October 2026 ran 3,543 tests: 3,540 passed, none failed, one was skipped and two are TODOs. Phase 1 (free-text actions, odds, schemes, the model gate and the panel) has automated tests and a manual [play script](docs/play-scripts/phase-1.md); the play script has not been completed against a live model yet. Regent authority checks cover both campaign modes, appointment consent, independent family guardians, exact promise deadlines and saved-state validation. Recurring decisions were checked in an isolated browser fixture, including a submitted choice and its saved memory after a full page reload. Earlier production browser checks covered a real Codex year, smallpox, paid treatment and persistence after reopening. Claude was also tested through its existing CLI login.

The portrait component passed 864 rendered state/age combinations, including delayed and failed image loading. Its controls support light and dark themes and a narrow viewport.

Regent acceptance checks covered 48 combinations of campaign position, theme and viewport. In both state and family campaigns, appointing an official spent ten state silver and consumed one consent. A full page reload preserved the result without another transaction. These checks used isolated campaign fixtures.

Incapacity checks covered 28 combinations of seven scenarios, theme and viewport. Private recovery spent ten family silver. Public religious support spent twenty state silver. Each submitted choice persisted once, and a page reload produced no further writes. Calendar tests also covered a birthday, recovery and multiple deaths on the same date. No live model turn was used in these checks.

Known limits: aging uses three visual stages. New characters share a stable family illustration. Simultaneous conditions use a primary portrait state. One child series conveys illness through expression and complexion without skin lesions. The event library currently has eight recurring templates alongside the existing political and health stories. Unborn heirs, foreign family branches and broader AI action coverage need further development. These checks do not establish long-term balance or complete parity with Crusader Kings III or Old World.

```sh
node --test --test-concurrency=1 "server/**/*.test.js" "src/**/*.test.js"
npm run build
```

Read the [research and system design report](research.html) for the original CK3/Old World analysis and design proposals. This self-contained HTML report is in Swedish and preserves the research snapshot from 30 October 2026; its implementation-status statements are historical. Download it and open it in a browser to use the chapter navigation and light/dark themes.

See [the original documentation](UPSTREAM-README.md) for upstream features and [artwork provenance](public/dynasties/ARTWORK.md) for generated assets. Historical research and design notes are under `docs/research/` and `docs/design/`; some inherited working notes are in Swedish.

## License and attribution

The code retains Open Historia's AGPL-3.0-or-later license and copyright notices. See [LICENSE](LICENSE). Attainder is an independent derivative project. Generated artwork is documented separately and remains subject to the applicable provider terms.
