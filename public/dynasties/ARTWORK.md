# Character artwork

The 24 original character portraits in `portraits/` were generated for this
project using OpenArt, model `gpt-image-2-5-sunburst`, on 2026-10-30.

Project ID: `R2DusBuwuPX4zouTqGnb`.

These are fictional people. The prompts request original ancient Mediterranean
character illustrations, not portraits or assets copied from Crusader Kings 3,
Old World, or another game. The downloaded originals are PNG images at
1008 × 1344 pixels. No visual edits have been applied after generation.

Generation prompts, history IDs, source URLs and SHA-256 hashes are recorded in
the project-level `reports/portrait-generations.json`, `portrait-retries.json`,
`portrait-results.json` and `portrait-downloads.json` files.

The `portraits/variants/` directory contains 24 reference-guided OpenArt atlases:
12 health, emotional and social states across three age groups, totaling 864
frames. The actual returned files are PNG images at 2016 x 2688 pixels, despite
the requested 4K/WebP settings. Original bytes remain unchanged. Measured cell
boundaries in `src/runtime/characters/portrait-atlases.json` support SVG view-box
selection without distorting the faces.

Variant requests, results, source URLs, SHA-256 hashes and visual-review evidence
are under project-level `reports/portrait-variants/`. One child atlas uses facial
expression and complexion instead of skin lesions; its adult and elder frames
include the non-graphic condition details. Newborn characters use a stable shared
family illustration; individually generated portraits for every newborn are not
implemented. Concurrent conditions use a priority rule, not an exhaustive set
of combination images.

Generated artwork remains subject to the applicable OpenArt/provider terms.
This file makes no separate claim of exclusivity or legal clearance.
