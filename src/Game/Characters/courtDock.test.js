// The court over the map, slice 6: the panel docks beside the map.
// Spec: docs/superpowers/specs/2026-11-15-court-shell-design.md, "Slice 6: the modal goes".
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (name) => fs.readFileSync(new URL(name, import.meta.url), "utf8");
// The file's line ends differ between checkouts; the tests read one form.
const panel = read("./CharactersPanel.jsx").replace(/\r\n/g, "\n");
const css = read("./characters.css").replace(/\r\n/g, "\n");
const block = (start) => {
  const at = css.indexOf(start);
  assert.notEqual(at, -1, `${start} is in the stylesheet`);
  let depth = 0;
  for (let index = css.indexOf("{", at); index < css.length; index += 1) {
    if (css[index] === "{") depth += 1;
    if (css[index] === "}") { depth -= 1; if (depth === 0) return css.slice(at, index + 1); }
  }
  throw new Error(`${start} is not closed`);
};

test("a docked panel is the shell's column, not a dialog", () => {
  assert.match(panel, /export default function CharactersPanel\(\{ open, onClose, chronicleRequest = 0, request = null, docked = false \}\)/);
  assert.match(panel, /className=\{docked \? "char-backdrop char-backdrop--docked" : "char-backdrop"\}/);
  assert.match(panel, /data-char-theme=\{docked \? "court" : theme\}/);
  assert.match(panel, /role=\{docked \? "region" : "dialog"\} aria-modal=\{docked \? undefined : "true"\}/);
  assert.match(panel, /if \(docked \|\| event\.key !== "Tab"\) return;/, "a docked panel does not trap Tab");
  assert.match(panel, /if \(!open \|\| docked\) return undefined;\s+const closeOnEscape/, "Escape outside a docked panel is the shell's to hand out");
  assert.match(panel, /onClick=\{docked \? undefined : \(event\) => \{ if \(event\.target === event\.currentTarget\) onClose\(\); \}\}/, "a docked panel has no backdrop to press");
  assert.match(panel, /new CustomEvent\("oh:court-talk-hold", \{ detail: \{ held: open && talkHold \} \}\)/, "a conversation's open request holds the year");
  assert.match(panel, /if \(!docked && open && panel && !panel\.contains\(document\.activeElement\)\)/, "a docked panel does not pull focus back");
});

test("a docked panel does not repeat the shell", () => {
  assert.match(panel, /\{!docked && <><button type="button" className="char-icon-button" onClick=\{\(\) => choose\(/, "the themes' switch belongs to the modal");
  assert.match(panel, /\{!docked && <><span className="char-mode">/, "the name, the date and the mode stand in the court bar");
  assert.match(panel, /\{!docked && <button type="button" className="char-button char-button--advance"/, "the year turns from the year line");
});

test("the panel lays itself out by its own width", () => {
  assert.match(block(".char-backdrop {"), /container: char \/ inline-size;/);
  assert.match(css, /@media \(max-width: 950px\) \{\n {2}\.char-backdrop \{ padding: 10px; \}\n\}/, "only the backdrop's own padding follows the window");
  const wide = block("@container char (max-width: 930px)"), narrow = block("@container char (max-width: 680px)");
  assert.match(wide, /\.char-person-layout \{ grid-template-columns: minmax\(190px, \.65fr\) minmax\(0, 1\.5fr\); gap: 16px; \}/);
  assert.match(narrow, /\.char-panel \{ width: 100%; height: 100%; border: 0; border-radius: 0; \}/);
  assert.doesNotMatch(wide + narrow, /\.char-backdrop \{/, "a container cannot style itself");
  assert.equal((css.match(/@media \(max-width: (950|680)px\)/g) ?? []).length, 2);
});

test("the dock stands under the band and above the year line, in the shell's look", () => {
  const dock = block(".char-backdrop.char-backdrop--docked {");
  for (const rule of ["left: 0.5rem;", "top: var(--court-row-top, 13.6rem);", "bottom: 4.5rem;", "width: min(46rem, calc(100vw - 23.5rem));", "z-index: 9998;", "padding: 0;", "background: none;", "backdrop-filter: none;"]) {
    assert.ok(dock.includes(rule), rule);
  }
  const court = block('.char-backdrop[data-char-theme="court"] {');
  for (const token of ["--char-bg: #14100c;", "--char-surface: #1f1913;", "--char-ink: #efe6d2;", "--char-muted: #c4b79c;", "--char-border: #4a3f31;", "--char-accent: #d4ac3a;", "--char-danger: #e0573a;", "color-scheme: dark;"]) {
    assert.ok(court.includes(token), token);
  }
  assert.match(court, /font-family: "EB Garamond", Georgia, serif;/);
  assert.doesNotMatch(css.slice(css.indexOf(".char-backdrop.char-backdrop--docked")), /gradient\(/);
});

test("the shell stays beside the docked panel and gives it its left column", () => {
  const main = read("../GameUI/main.jsx").replace(/\r\n/g, "\n"), shell = read("./CourtShell.jsx"), shellCss = read("./courtShell.css");
  assert.match(main, /hasCharacters && !mainMenuOpen && !activeBottomPanel && !isMobile && <Suspense fallback=\{null\}><LazyCourtShell key=\{activeGame\?\.id\} topOffset=\{TOP_BAR_OFFSET\} rightBusy=\{isAdvisorOpen\} panelOpen=\{isCharactersOpen\} onClosePanel=\{closeCourtPanel\} \/>/);
  assert.match(main, /const courtDocked = hasCharacters && !isMobile;/);
  assert.match(main, /docked=\{courtDocked\}/);
  assert.match(shell, /export default function CourtShell\(\{ topOffset = "0px", rightBusy = false, panelOpen = false, onClosePanel \}\)/);
  assert.match(shell, /\{!panelOpen && \(\s+<aside/, "the panel takes the list's place");
  assert.match(shell, /className=\{panelOpen \? "court-row court-row--docked" : "court-row"\}/);
  assert.match(shell, /setProperty\("--court-row-top", /);
  assert.match(shell, /removeProperty\("--court-row-top"\)/);
  assert.match(shell, /new ResizeObserver\(/);
  assert.match(shell, /closest\?\.\("input, textarea, select, \[contenteditable\], \.char-panel"\)/, "a key pressed inside the panel is the panel's");
  assert.match(shellCss, /\.court-row--docked \{ padding-left: calc\(min\(46rem, 100vw - 23\.5rem\) \+ 0\.6rem\); \}/);
  assert.match(shell, /else if \(panelOpen && event\.target === document\.body\) onClosePanel\?\.\(\);/, "Escape from nowhere closes the shell's own things first, then the panel");
  assert.match(shell, /if \(stale && \(panelOpen \|\| !reportChecked\.current\)\) courtYear\.close\(\);/, "a record the court has moved on from in the panel is dropped");
  assert.match(shell, /addEventListener\("oh:court-talk-hold", /);
  assert.match(main, /onClosePanel=\{closeCourtPanel\}/);
  assert.match(main, /open=\{isCharactersOpen && !\(courtDocked && \(mainMenuOpen \|\| Boolean\(activeBottomPanel\)\)\)\}/, "the dock is not drawn without the shell it stands in");
  assert.match(main, /onExit=\{\(\) => \{ setIsCharactersOpen\(false\); exitToMenu\(\); \}\}/, "leaving the game closes the panel");
  const dock = block(".char-backdrop.char-backdrop--docked {");
  assert.ok(dock.includes("pointer-events: none;"), "the dock's own box does not take the map's presses");
});
