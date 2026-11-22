// The game menu, the settings and the diagnostics name the realm and the campaign in the player's language.
// Found by the walk of 22 November 2026 in a family campaign of Karl in English: the menu read "Playing as Karls rike
// (karolingiska riket) · 0800-12-25", and the title of "Save log file + game" quoted "Karls rike (karolingiska riket),
// 800 e.Kr. · Familjen". Both names sat inside English sentences the page's dictionary has no entry for.
//
// main.jsx and settings.jsx cannot be loaded under bare node, so this test reads their source.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadNativeBook } from "../../../scripts/i18n/sweep-engine-text.mjs";

const read = (name) => fs.readFileSync(new URL(name, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const IMPORT = /import \{ readNative, useTranslatorUpdates \} from "\.\.\/\.\.\/runtime\/useTranslatorUpdates\.js";/;

test("the native book reads the realm and the campaign of the walk", () => {
  const { book } = loadNativeBook();
  assert.equal(book.translate("Karls rike (karolingiska riket)"), "Charles’s realm (Carolingian Empire)");
  assert.equal(book.translate("Karls rike (karolingiska riket), 800 e.Kr. · Familjen"), "Charles’s realm (Carolingian Empire), AD 800 · The family");
});

test("the menu and the settings get the realm's name as the native book reads it, and again when the book arrives", () => {
  const main = read("./main.jsx");
  assert.match(main, IMPORT);
  assert.match(main, /const translatorUpdates = useTranslatorUpdates\(\);/);
  assert.match(main, /countryName: readNative\(activeCountryName \|\| activeGame\?\.country \|\| "", translatorUpdates\),/);
  assert.doesNotMatch(main, /countryName: activeCountryName \|\|/);
});

test("the diagnostics name the campaign as the native book reads it", () => {
  const settings = read("./settings.jsx");
  const start = settings.indexOf("const DiagnosticsPanel = () => {");
  const panel = settings.slice(start, settings.indexOf("\n};\n", start));
  assert.ok(start > 0 && panel.length > 2000, "the panel was found");
  assert.match(settings, IMPORT);
  assert.match(panel, /const updates = useTranslatorUpdates\(\);/);
  assert.match(panel, /title=\{attachGameTitle\(enabled, readNative\(activeGameName, updates\)\)\}/);
  assert.equal((panel.match(/shortGameName\(readNative\(attachState\.name, updates\)\)/g) || []).length, 2, "both saved notices");
  assert.doesNotMatch(panel, /shortGameName\(attachState\.name\)/);
});
