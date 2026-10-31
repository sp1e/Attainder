# Research reader source layout

These scripts preserve the authoring and verification workflow for the Swedish research/design snapshot dated 30 October 2026. They do not update the game's implementation status. The repository's root README describes current development.

The four research reports in `docs/research/` retain their original text, dates and qualifications. The archived scripts were inspected and syntax-checked; the adapted build and browser verifier have not been executed as part of this archive task. Existing `research.html` and existing Markdown files were not regenerated.

## Inputs

`--source-root` points to a repository checkout containing:

```text
docs/research/RESEARCH.md
docs/research/ck3-character-research.md
docs/research/old-world-character-research.md
docs/research/design-och-handelsemotorer.md
docs/research/open-historia-architecture.md
docs/design/SYSTEMDESIGN.md
docs/design/ACCEPTANS.md
docs/design/GLOSSARY.md
docs/design/rules-review.md
docs/design/integration-plan.md
```

Two additional Markdown inputs are required explicitly: `--installed-summary` and `--skills-summary`. Raw installed-app evidence, skill scans and machine inventories are not included. Supply reviewed, portable narrative summaries. The already-public `installed` and `skills` chapters in root `research.html` preserve the published narrative and can serve as the reference for reconstructing these inputs. Preserve their dated evidence limits. Do not substitute private machine reports without reviewing their contents and removing personal paths.

The original manual PDF and skill-review attachments are not bundled. The reader links to the public Steam manual page and labels the skill attachments as omitted. Its editable-summary links navigate to the corresponding embedded chapters, so output does not require copies of the source tree beside it.

## Build a separate draft

Python 3.10 or newer is required. The builder uses the standard library only. From the repository root, pass a new output directory outside both the checkout and the source root:

```sh
python scripts/research/build_research_reader.py --source-root . --installed-summary ../reviewed-inputs/installed-app-status.md --skills-summary ../reviewed-inputs/SKILL-REVIEW-SV.md --output-dir ../research-reader-draft
```

The builder refuses an existing output directory. It writes `research.html` and `source-index.json` only there. It does not replace the published root page. The output retains historical design-status text; review input privacy, links and the archival notice before considering a generated draft for publication. The published page's later archival banner and exact HTML bytes are not reproduced by this historical generator.

## Verify a draft

The verifier needs the Python `playwright` package and an already-installed Chromium browser. It does not install dependencies. It starts a temporary loopback HTTP server for the reader's directory, blocks browser requests to other hosts, uses fresh browser contexts and shuts down the server afterward. Source sites are not fetched.

```sh
python scripts/research/verify_research_reader.py --reader ../research-reader-draft/research.html --qa-dir ../research-reader-private-qa
```

The QA directory must be new and outside this repository. It receives screenshots and `verification.json`; keep those artifacts private. The checks cover the twelve historical chapters, themes, keyboard switching, local links, selected contrast pairs and a narrow viewport. They do not verify game behavior or establish a complete accessibility assessment.

Remaining dependencies are the two reviewed narrative inputs, Python Playwright and its browser. No original private scans, installed-app records or manual attachment are required for the portable source archive itself.
