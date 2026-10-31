# Project synchronization record

This record accompanies the 31 October 2026 archive checkpoint requested before the owner's weekly token allowance ran out.

## Branches

- Reviewed baseline: `main`, commit `c49da0450dfa50a0925953f784cc2c03a958fd50`. Includes temporary adult incapacity, research HTML and its README link.
- Current development and archive: `codex/event-chains-checkpoint`. Its first commit is `dfa278458fad058fbe402ac9f995ab7c17563572`; later archive commits on the same branch preserve the remaining sources and galleries. Event integration still has acceptance work described in [CONTINUE-HERE.md](CONTINUE-HERE.md).

## Preserved project work

| Material | Repository location |
| --- | --- |
| Game source, CLI integration, scenario, character rules and tests | `src/`, `server/`, `scripts/`, existing project files |
| Persistent event-chain engine, 32 stages and UI | Character runtime/UI files on the checkpoint branch |
| Published research/design reader | Root `research.html` |
| Original research sources | `docs/research/` |
| System design and acceptance requirements | `docs/design/` |
| Additional incapacity/event planning and candidate content | `docs/design/working-notes/` |
| Research authoring and verification scripts | `scripts/research/` |
| Original portraits, dynamic state atlases and runtime manifests | `public/dynasties/portraits/`, `src/runtime/characters/portrait*.json` |
| Both standalone galleries, transition preview and image hashes | `docs/artwork/` |
| Portrait gallery/import/verification source tools | `scripts/portraits/` |

The design copies originally outside the checkout were compared with existing repository documents; duplicate copies were not added. The original research Markdown, additional four research chapters and ten gameplay planning inputs are now recoverable from the repository. Portable scripts document explicit inputs and dependencies. The historical research generator still requires two reviewed narrative inputs for its installed-app and skills chapters; their published content is preserved in `research.html`.

## Local-only categories

Credentials, real campaign saves and machine-specific QA evidence remain local. Generated `node_modules`, build bundles, caches and logs are reproducible or disposable and intentionally ignored. External source material, including the Old World manual PDF and a third-party skills banner, is referenced rather than copied as project-owned content. No image-generation credentials or temporary service-result URLs were added.

The image audit covered the project directory, excluding runtime campaigns and obvious browser/QA screenshot directories. It found 48 tracked character images, duplicate build copies and one additional transition preview, now included. All 48 character files were compared against GitHub blob hashes; see the [artwork manifest](../artwork/asset-manifest.json).

The development pause begins after this archive is committed, pushed and the remote branch is verified. Resume only after an explicit instruction from the owner; do not infer permission from an old automation prompt or continuation checklist.
