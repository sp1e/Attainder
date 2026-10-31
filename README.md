# Tides of Time

An ancient empire strategy game built on [Open Historia](https://github.com/Open-Historia/open-historia). Choose whether your campaign follows the state through successive rulers or a family that can survive losing power.

The playable prototype starts in fictional Hadara in 300 BCE with four political families, 24 characters, four cities and twelve provinces. The character interface currently uses Swedish. Public project documentation is in English.

## Play locally

Use Node.js 24, npm, and an installed, authenticated Codex CLI or Claude Code. The game uses the CLI's existing login. Model requests count toward that account's usage limits.

```sh
git clone https://github.com/sp1e/Tides-of-Time.git
cd Tides-of-Time
npm ci
npm run build
node scripts/launch-dynasties.mjs
```

On Windows, after the first build, double-click `Start-Tides-of-Time.cmd`. The launcher opens http://127.0.0.1:4167. Select Claude or Codex, then choose the state or family campaign mode. Expand the campaign seed control to set a starting seed. An empty field uses 104729. Seed 293 reproduces the starting conditions used in the smallpox gameplay check. Model narration can vary between runs.

Fresh clones store campaigns in `play-data/` and launcher logs in `reports/launcher/`. Both are ignored by Git. Set `TIDES_DATA_HOME` to use another data directory. The original development installation retains its existing sibling data directory automatically.

## Character systems

- A ruler's archetype determines available abilities. Succession changes those abilities.
- Offices & inheritance shows a read-only succession forecast: expected actual ruler, lawful claims, ability changes, regency limits and project continuity. It describes a single ruler's death at today's date; later events can change the result.
- Personality affects stress and changes how characters make decisions. Personal opinion, family support and religious affiliation remain separate.
- Memories connect decisions to later stories. Offices, family property, legal claims and actual political power can pass to different people.
- Eight recurring event types cover household pressure, education, temple donations, troubled cities, veterans, reconciliation, exile and returned favors. Participants and selection weights depend on the current campaign. Choices change resources, relationships and public administration; past support can return through a family successor.
- Illness, household infection, treatment, recovery and lasting scars follow the saved calendar. New care decisions can interrupt a longer time jump.
- OpenArt portraits follow each person's state. The 24 starting identities have 864 variants covering twelve conditions across three age groups.

The rules engine owns character outcomes. The model describes the world and can propose character actions. It cannot execute the player's decisions. Failed model generations do not silently become completed character turns.

Recurring decisions show why they appeared and when they expire. A longer turn stops at a new decision before the model narrates beyond it. If you continue without answering for twelve months, the stated free fallback applies. Events have participant and topic cooldowns to limit repetition.

## Scenarios Are Released Under CC BY 4.0

The upstream scenario-sharing rules remain in place. Scenarios posted or shared through the game are released under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/). Exported scenario files include the corresponding license record. Separately referenced maps, music and other third-party material retain their own terms.

## Development status

This is a playable development version. The local serial suite passed 3,117 tests, with no failures, one skipped test and two TODOs. A subsequent read-only forecast correction for a minor without an adult representative passed all 170 affected character tests. Recurring decisions were checked in an isolated browser fixture, including a submitted choice and its saved memory after a full page reload. Earlier production browser checks covered a real Codex year, smallpox, paid treatment and persistence after reopening. Claude was also tested through its existing CLI login.

The portrait component passed 864 rendered state/age combinations, including delayed and failed image loading. Its controls support light and dark themes and a narrow viewport.

Known limits: aging uses three visual stages. New characters share a stable family illustration. Simultaneous conditions use a primary portrait state. One child series conveys illness through expression and complexion without skin lesions. The event library currently has eight recurring templates alongside the existing political and health stories. Adult incapacity, unborn heirs, foreign family branches and broader AI action coverage need further development. These checks do not establish long-term balance or complete parity with Crusader Kings III or Old World.

```sh
node --test --test-concurrency=1 "server/**/*.test.js" "src/**/*.test.js"
npm run build
```

See [the original documentation](UPSTREAM-README.md) for upstream features and [artwork provenance](public/dynasties/ARTWORK.md) for generated assets. Historical research and design notes are under `docs/research/` and `docs/design/`; some inherited working notes are in Swedish.

## License and attribution

The code retains Open Historia's AGPL-3.0-or-later license and copyright notices. See [LICENSE](LICENSE). Tides of Time is an independent derivative project. Generated artwork is documented separately and remains subject to the applicable provider terms.
