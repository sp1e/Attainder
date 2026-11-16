// The court over the map, slice 7: the map's own controls take the shell's ground.
// Spec: docs/superpowers/specs/2026-11-15-court-shell-design.md, "Slice 7".
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (name) => fs.readFileSync(new URL(name, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const css = read("./courtShell.css");
const start = css.indexOf(":root[data-court-hud] {");
const hud = css.slice(start, css.indexOf("}", start) + 1);
const declared = (block) => [...block.matchAll(/(--oh-hud-[a-z-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]);

test("the court bar gives the map's own controls the shell's ground while it stands", () => {
  const bar = read("./CourtTopBar.jsx");
  assert.match(bar, /useEffect\(\(\) => \{\s+document\.documentElement\.setAttribute\("data-court-hud", ""\);\s+return \(\) => document\.documentElement\.removeAttribute\("data-court-hud"\);\s+\}, \[\]\);/);
});

test("the shell's ground is ink and the shell's rule, with a flat shadow", () => {
  assert.notEqual(start, -1, "the properties are redefined under the attribute");
  const values = Object.fromEntries(declared(hud));
  assert.deepEqual(values, {
    "--oh-hud-bg": "rgba(20, 16, 12, 0.9)",
    "--oh-hud-bg-strong": "rgba(20, 16, 12, 0.94)",
    "--oh-hud-border": "#4a3f31",
    "--oh-hud-shadow": "0 6px 18px rgba(0, 0, 0, 0.35)",
    "--oh-hud-shadow-soft": "0 6px 18px rgba(0, 0, 0, 0.35)",
  });
  assert.doesNotMatch(hud, /--oh-hud-blur/, "the glass blur stays: two controls keep a grey ground of their own and need it");
  assert.doesNotMatch(hud, /gradient\(|inset /, "no gradient and no inset light");
});

test("every property the shell redefines is one the upstream stylesheet defines and a control reads", () => {
  const upstream = new Set(declared(read("../../styles.css")).map(([name]) => name));
  // Read by the controls: a property nothing reads would be a rule that changes nothing.
  const readers = ["../GameUI/time.jsx", "../GameUI/main.jsx", "../GameUI/libraryBar.jsx", "../GameUI/other.jsx", "../GameUI/settings.jsx", "../GameUI/search.jsx"].map(read).join("\n");
  for (const [name] of declared(hud)) {
    assert.ok(upstream.has(name), `${name} is an upstream property`);
    assert.ok(readers.includes(`var(${name})`), `${name} is read by a control`);
  }
});
