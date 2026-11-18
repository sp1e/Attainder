// A chip under an event names its place in the player's language in its title too.
// Spec: docs/superpowers/specs/2026-11-18-english-first-design.md (ruling 4), found by the walk of 18 November 2026:
// "Show Furstendömet Benevento on the map" on an English install.
//
// time.jsx cannot be loaded under bare node, so this test reads its source.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./time.jsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("the chip's title reads the name through the native book, and again when the book arrives", () => {
  const start = source.indexOf("const LinkPill = ");
  const chip = source.slice(start, source.indexOf("// A document that came with an event", start));
  assert.ok(start > 0 && chip.length > 200, "the chip was found");
  assert.match(chip, /const updates = useTranslatorUpdates\(\);/);
  assert.match(chip, /title=\{`Show \$\{readNative\(link\.label, updates\)\} on the map`\}/);
  assert.doesNotMatch(chip, /title=\{`Show \$\{link\.label\}/);
  assert.match(source, /import \{ readNative, useTranslatorUpdates \} from "\.\.\/\.\.\/runtime\/useTranslatorUpdates\.js";/);
});
