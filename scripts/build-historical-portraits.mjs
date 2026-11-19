// Writes (or with --check, compares) src/runtime/characters/portrait-historical.json: what the game needs to draw the
// portraits of documented rulers, taken from the production manifest that was delivered with the pictures
// (docs/artwork/gpt-imagegen-2026-11-07-manifest.json). The manifest's geometry was reviewed by eye and is bound to
// the files' hashes; nothing here measures a picture again.
// Spec: docs/superpowers/specs/2026-11-19-historical-portraits-design.md.
//
//   node scripts/build-historical-portraits.mjs
//   node scripts/build-historical-portraits.mjs --check
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PRODUCTION_MANIFEST = "docs/artwork/gpt-imagegen-2026-11-07-manifest.json";
export const RUNTIME_MANIFEST = "src/runtime/characters/portrait-historical.json";

/** Pure: the runtime manifest for a production manifest. */
export function historicalPortraits(production) {
  return {
    version: 1,
    source: PRODUCTION_MANIFEST,
    appearance: "artistic-interpretation",
    characters: Object.fromEntries(production.characters.map((character) => [character.id, {
      ageGroup: character.originalAgeGroup,
      src: character.original.src,
      atlas: {
        src: character.atlas.src,
        width: character.atlas.width,
        height: character.atlas.height,
        rowBounds: character.atlas.rowBounds,
        columnBounds: character.atlas.columnBounds,
        inset: character.atlas.viewBoxInsetPixels,
      },
    }])),
  };
}

export const serialize = (manifest) => `${JSON.stringify(manifest, null, 2)}\n`;
const readText = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8").replace(/\r\n/g, "\n");

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const wanted = serialize(historicalPortraits(JSON.parse(readText(PRODUCTION_MANIFEST))));
  if (process.argv.includes("--check")) {
    const current = fs.existsSync(path.join(ROOT, RUNTIME_MANIFEST)) ? readText(RUNTIME_MANIFEST) : "";
    if (current !== wanted) {
      console.error(`${RUNTIME_MANIFEST} differs from ${PRODUCTION_MANIFEST}. Run node scripts/build-historical-portraits.mjs and commit the file.`);
      process.exit(1);
    }
  } else {
    fs.writeFileSync(path.join(ROOT, RUNTIME_MANIFEST), wanted);
  }
  console.log(JSON.stringify({ characters: Object.keys(JSON.parse(wanted).characters).length }));
}
