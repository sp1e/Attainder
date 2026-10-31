# Portrait tools

These six scripts preserve the portrait tools previously stored outside the
repository. They build galleries or import existing images. They do not call
an image-generation model.

All six passed Python syntax compilation. Both browser verifiers passed offline
against the archived HTML files in `docs/artwork/`, including image loading and
theme switching. The adapted builders and importers have not been executed.
The archived galleries were copied from existing files.

## Build galleries from tracked assets

`build_portrait_gallery.py` and `build_dynamic_portrait_gallery.py` use
`src/runtime/characters/portrait-manifest.json`, `portrait-atlases.json`, and
the images under `public/dynasties/portraits/`. They need Python 3 and its
standard library. They locate the repository relative to the script; override
that location with `--repo PATH`.

The output path is required. Image links are relative to the chosen HTML file.
Keep both galleries in one directory with the filenames shown below so their
cross-link works. Moving an HTML file alone can break its image links.
The existing keyboard theme controls, system preference and saved theme choice
are preserved. Syntax compilation creates no HTML.

```text
python scripts/portraits/build_portrait_gallery.py --output OUTPUT/karaktarsgalleri.html
python scripts/portraits/build_dynamic_portrait_gallery.py --output OUTPUT/karaktarsgalleri-dynamiskt.html
```

Replace `OUTPUT` with an explicitly chosen destination that follows the current
project or user output policy. The scripts have no personal directory defaults.

## Verify a local gallery

`verify_portrait_gallery.py` and `verify_dynamic_portrait_gallery.py` need the
Python Playwright package and its Chromium browser. Pass an existing local HTML
file with `--gallery PATH` and a private artifact directory with
`--output-dir PATH`. The scripts save screenshots and `verification.json`.
Network requests are blocked. These checks target the existing collection of
24 original portraits and 24 atlases, rather than arbitrary collection sizes.

## Import explicitly supplied generation results

`download_portraits.py` uses the Python standard library:

- `--input PATH`: private JSON object containing a `portraits` list. Each record
  has `id`, `status`, and `resources`; a completed resource has a `url`.
- `--retry-input PATH`: optional private list of replacement records, matched by `id`.
- `--output-dir PATH` and `--report PATH`: required destinations.
- `--allow-download`: required to fetch missing PNG files from the OpenArt CDN.

`import_portrait_variants.py` also needs NumPy and Pillow:

- `--input PATH`: private JSON list containing `id` and `result`. Each result
  contains `status` and `resources`. Optional `childMedicalDetail` is preserved.
- `--output-dir PATH`, `--manifest-output PATH`, and `--report PATH`: required destinations.
- `--allow-download`: required to fetch missing atlas images from the CDN.
- `--bounds-input PATH`: optional JSON map keyed by character ID, with `sha256`
  and `rowBounds` and/or `columnBounds`. An override must match the image hash.
  Each supplied axis needs seven strictly increasing integer boundaries,
  beginning at zero and ending at the image edge.

The old geometry exception depended on a hardcoded generation ID. To reproduce
that reviewed geometry, supply its boundaries and image hash explicitly.
The tracked `portrait-atlases.json` contains the approved image rectangles;
automatic seam detection alone does not guarantee the same result. The importer
does not crop or edit image bytes. Its public manifest still points to
`/dynasties/portraits/variants/`. If you import elsewhere, place the images at
that served location before using the manifest in the game.

Importers read raw result files without modifying them. Reports contain local
paths, hashes and image measurements, but omit source URLs and generation or
resource IDs. Keep raw manifests, credentials and private reports out of version
control. Existing image files are reused; choose a fresh destination to import
a replacement result. Incomplete results are reported as pending. Check the
image count and geometry before replacing the tracked manifest.
