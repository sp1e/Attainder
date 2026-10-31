# Character artwork archive

All 24 original character portraits and all 24 state atlases are tracked under `public/dynasties/portraits/`. Each atlas contains 36 portraits: twelve visual states across three age groups, for 864 atlas variants. The game maps these regions through `src/runtime/characters/portrait-atlases.json`; `portrait-manifest.json` identifies the original portraits.

On 31 October 2026, all 48 local PNG files matched GitHub's blob hashes at checkpoint `dfa278458fad058fbe402ac9f995ab7c17563572`. Their total size is 261,702,151 bytes. These image files are also present on the reviewed `main` baseline `c49da04`. [asset-manifest.json](asset-manifest.json) records every path, size, dimension, SHA-256 and Git blob hash.

- [Original character gallery](karaktarsgalleri.html) displays the 24 portraits.
- [Dynamic portrait gallery](karaktarsgalleri-dynamiskt.html) lets you inspect conditions and age groups.
- [Transition preview](portrait-transition-preview.png) shows healthy, smallpox, recovery and scar appearances for one character. It is a presentation sheet, not a separate runtime atlas.

Open the HTML files from a complete checkout so their relative image links resolve. Both galleries retain keyboard-accessible theme controls and saved theme preferences. Offline checks covered actual image loading, 864 valid atlas rectangles, controls and light/dark layouts. They do not establish that every generated expression or skin detail has equal visual quality.

A project-folder audit found no additional unique character originals or source/retry variants outside the tracked images. Build copies matched the tracked assets. Browser QA screenshots and a third-party skill collection banner are not character assets and are excluded from this archive.

The portable source tools are in [scripts/portraits](../../scripts/portraits/README.md). See [artwork provenance](../../public/dynasties/ARTWORK.md) for generation details and limitations.
