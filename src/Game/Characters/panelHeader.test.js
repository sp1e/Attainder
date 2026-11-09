// Run: node --test src/Game/Characters/panelHeader.test.js
// The panel header on a 390 px phone: the civic mark stays inside its box and the close icon sits in
// the middle of its circle. Checked in a browser on 9 November 2026 (Phase 0 panel check).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const jsx = readFileSync(new URL("./CharactersPanel.jsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./characters.css", import.meta.url), "utf8");
const rule = (selector) => {
  const at = css.indexOf(`${selector} {`);
  assert.notEqual(at, -1, `${selector} has a rule`);
  return css.slice(at, css.indexOf("}", at));
};

test("the close button draws its cross as an icon, not as a text glyph", () => {
  const button = jsx.match(/<button[^>]*className="char-icon-button char-close"[^>]*>([\s\S]*?)<\/button>/);
  assert.ok(button, "the close button exists");
  assert.match(button[0], /aria-label="Stäng Rike & familjer"/);
  assert.match(button[1], /^<CloseMark \/>$/);
  assert.match(jsx, /function CloseMark\(\) \{\s*return <svg [^>]*aria-hidden="true"/);
});

test("icon buttons centre what they hold", () => {
  assert.match(rule(".char-icon-button"), /display: inline-grid; place-items: center; padding: 0;/);
});

test("the civic mark shrinks with its box on a narrow screen", () => {
  assert.match(rule(".char-brand-mark svg"), /display: block; max-width: 100%; height: auto;/);
});
