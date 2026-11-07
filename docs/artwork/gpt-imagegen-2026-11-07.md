# Historical portrait production: AD 800

This batch supplies eight original portraits and eight 36-cell atlases for the
documented rulers selected from the reviewed AD 800 court dossier. OpenAI's
built-in imagegen tool generated the images on 7 November 2026. This batch made
no OpenArt calls. Existing project portraits supplied the visual direction:
realistic oil painting, warm earth colours, dark brown backgrounds and close
three-quarter portraits.

The dossier at research commit `806ca6eeddfc9ab414e95d303261fb78b3342fa2`
establishes identities and records date uncertainty. These images invent facial
appearances, clothing details and expressions. They do not establish historical
likenesses, costume accuracy, illnesses, injuries or survival to the depicted ages.
The artist chose Alfonso II's adult appearance at age 50 from a generated game
value; that choice supplies no historical birth year. Aejang's original depicts
a child around 12. His adult and elder portraits serve hypothetical game states.

| Dossier identity | Original age group | Depicted adult age | Age basis |
|---|---|---|---|
| eirene-of-athens | adult | 48 | Approximate dossier birth year |
| harun-ar-rashid | adult | 35 | Artistic choice within the dossier's 34–37 range |
| dezong | adult | 58 | Dossier birth year; exact birthday unknown |
| aejang | child | 35 | Adult atlas is hypothetical; original is about 12 |
| al-hakam-i | adult | 29 | Dossier birth year; exact birthday unknown |
| ibrahim-ibn-al-aghlab | adult | 43 | Approximation from the dossier's 757–758 range |
| alfonso-ii-asturias | adult | 50 | Generated game value, not historical evidence |
| grimoald-iii-benevento | adult | 35 | Artistic approximation from uncertain birth decade |

## Files and layout

Assets live under `public/dynasties/portraits/gpt-imagegen-2026-11-07/`.
Originals use `<dossier-id>.png`; atlases use `variants/<dossier-id>.png`.
The production manifest supplies hashes, dimensions, measured row and column
boundaries, and the exact rectangle for each age/state pair. The images retain
the bytes returned by imagegen. No resizing, cropping or retouching follows
generation.

Each atlas has six columns and six rows. Rows 1–2 depict children, rows 3–4
adults and rows 5–6 elders. In each pair, the first row contains healthy,
smallpox, smallpox-recovering, smallpox-scars, fever and wounded. The second
contains injury-recovering, injury-scars, frail, stressed, grieving and exiled.
This order matches the existing atlas contract.

For seven characters, child medical states use gentle expressions and complexion
instead of lesions or injury details. Eirene's child sheet uses restrained spots
and clean dressings. These choices preserve the existing project's two child
detail conventions. Several healed-scar states have subtle marks and need the
interface's state labels to distinguish them at small sizes.

The tool returned 1086 × 1448 pixels for all 16 images, despite larger sizes
in the prompts. The manifest records actual dimensions for each file. The new
atlas cells have less detail than the existing 2016 × 2688 atlases. Integration
should use the recorded geometry and keep portraits near their native cell size.

## Integration boundary

The production manifest is a delivery contract, not an installed runtime manifest.
The historical dossier IDs do not satisfy the existing runtime's `person-N-N`
identity filter, and the current safe atlas path rule excludes this nested
production directory. Claude owns that separate integration. It must define
an explicit historical-identity mapping or extend the resolver with regression
coverage, retain historical uncertainty, and verify live state transitions.

No historical ID replaces an existing `person-*` asset. This batch changes no
gameplay code, research dossier, save or current runtime portrait manifest.
The existing galleries continue to describe their original 24-character archive.

The [prompt set](gpt-imagegen-2026-11-07-prompts.json) records the final original
and atlas prompts. The [production manifest](gpt-imagegen-2026-11-07-manifest.json)
records technical delivery data. Production checks cover file integrity, complete
age/state coverage, rectangle bounds and visual inspection; they do not constitute
gameplay integration or historical costume review.

## Verification on 7 November 2026

- Opened and decoded all 16 PNG files; all have opaque backgrounds and distinct
  SHA-256 hashes. Their total size is 43,273,402 bytes.
- Compared each workspace file with its imagegen output; all 16 match byte for byte.
- Inspected all eight original portraits and all 288 atlas cells for identity,
  age order, framing, condition order and unwanted labels.
- Validated all 288 inset rectangles against the actual image dimensions.
  A two-pixel view-box inset excludes cell seams without editing the PNG files.
- Ran the existing portrait resolver tests: 7 passed, 0 failed. These tests cover
  the unchanged runtime; they do not integrate the new historical identities.
- Recorded 16 successful generations. Harun's atlas needed one additional
  attempt after an output safety rejection; the successful prompt uses child
  expressions and complexion instead of medical marks.

The old importer selected internal facial or clothing edges as row boundaries in
several new sheets. This batch therefore uses visually reviewed, hash-bound
geometry in its own manifest. Do not replace those bounds with the old importer's
unrestricted seam detection.
