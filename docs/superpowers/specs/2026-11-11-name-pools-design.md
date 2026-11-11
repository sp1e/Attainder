# Name pools for generated people

## Intent

Children born in a historical campaign are named `Barn person-12 (Karls hus)`, and court staff take names from the fictional Hadara list (`Adara`, `Belen` …). Research brief section 8.3 asks for attested name pools per culture, and the first pool is published: `server/seed/historical/name-pools/frankish-saint-germain-823-829.json`, 14 male and 14 female names from the Saint-Germain-des-Prés survey. This change lets a package court carry a pool and lets the engine name generated people from it.

## Design

- **Package.** A court seed may carry `namePool: { id, male, female }`, two lists of plain names. `validNamePool` in `server/characters/namePools.js` checks it: a lowercase id, 1 to 200 distinct names per sex, each at most 40 characters, without parentheses, and no other keys. `validCourt` refuses a court with a malformed pool.
- **Builder.** An authored court spec or a dossier playable names its pool with `namePoolId`. `namePoolIds(contentId)` lists those ids, the build script reads exactly those files from `name-pools/`, and `courtNamePool` maps a file to the court pool. A pool file the builder does not name changes no output, so a research PR that adds a pool keeps CI green.
- **Campaign.** `createHistoricalCharacterSystem` copies the chosen court's pool to `state.namePool`. A save may hold it only in a historical campaign (`Sparfilens namnlista är ogiltig.`).
- **Children.** A historical child with a pool is named `<pool name for its sex> (<house>)`; without one it keeps `Barn <id> (<house>)`. The name uses the roll `newChild` already drew, so no stream moves differently.
- **Staff.** `ensureStaff` takes the n-th name of the pool, male names first, in place of `NAME_POOL`.
- **Hadara** has no pool and stays byte-identical.

## Rulings

- Pools attach by an explicit `namePoolId` in builder code, not by the dossier's `namePoolId`, so new research files never change a build by themselves. Cost if wrong: one line per court to wire.
- The three hand-named generated courtiers of each authored court keep their names. The Frankish pool records an estate population, which fits children and staff better than a royal household. Cost if wrong: a later rebuild swaps three names.
- This change wires no package yet. The Charlemagne release that adds the faith traditions (brief section 13) also sets `namePoolId: 'frankish-saint-germain-823-829'` on Karls rike, so the package is rebuilt once.

## Acceptance

`src/runtime/characters/namePools.test.js` and `server/seed/historical/name-pools.test.js`: a pooled court seeds the pool, a child takes a pool name with the same streams as without one, staff take pool names, Hadara keeps its names, saves keep a pool and refuse a broken one or one in Hadara, the validator refuses malformed pools, and every published pool file maps to a valid court pool.
