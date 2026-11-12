// The bilingual help catalog (public/lang/attainder/help/) as the wiki generator reads it, and
// the rule that picks the language a help page opens in. scripts/build-wiki.mjs renders with
// these; src/runtime/wikiHelp.test.js imports the pure functions.
//
// The catalog is data owned by the research session. Nothing here edits it: a page it has is
// rendered in Swedish and English into one file, a page it lacks keeps its upstream markdown.
import path from "node:path";
import { readJson } from "../i18n/jsonOutput.mjs";

// Swedish first: it is the language a page reads without script, so its rendering comes first
// in the markup as well.
export const HELP_LANGUAGES = ["sv", "en"];

// The switch is labelled with each language's own name, the same endonyms the game's Options
// list shows (LANGUAGES in src/runtime/i18n.js; the test compares them). shell.json has no
// entry for the switch.
export const LANGUAGE_NAMES = { sv: "Svenska", en: "English" };

export const WIKI_LANGUAGE_KEY = "wiki_language";
export const UI_LANGUAGE_KEY = "ui_language";

// A problem in the sources that a person has to fix. The command prints the message alone;
// any other error is a bug in the generator and keeps its stack.
export class WikiBuildError extends Error {}

export const escapeHtml = (s) => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// ---------------------------------------------------------------- the language rule

// Which language a help page opens in. The page's own switch stores `wiki_language`; the game
// stores `ui_language`. The switch wins, then the game's choice: "en" is English and anything
// else, an unset value included, is Swedish, which is the game's first-language rule
// (src/runtime/i18n.js). Written without modern syntax and without outside names, because its
// source text is also the script every page runs: see headLanguageScript.
export function decideHelpLanguage(wikiLanguage, uiLanguage) {
  var clean = function (value) { return typeof value === "string" ? value.trim() : ""; };
  var own = clean(wikiLanguage);
  var chosen = own === "sv" || own === "en" ? own : clean(uiLanguage);
  return chosen === "en" ? "en" : "sv";
}

// The inline script in <head>. It runs before the first paint, so the page never shows one
// language and then the other. Kept in step with decideHelpLanguage by construction: the
// function's own source text is pasted in, so the test of the function is a test of the page.
// Blocked storage (private mode, a sandboxed frame) leaves both values null and reads Swedish.
// The title is switched here as well, which is why the script sits after <title>.
export const headLanguageScript = () => {
  const decide = decideHelpLanguage.toString().replace(/\r\n/g, "\n");
  return `(function () {
  var root = document.documentElement, own = null, game = null;
  try {
    own = localStorage.getItem("${WIKI_LANGUAGE_KEY}");
    game = localStorage.getItem("${UI_LANGUAGE_KEY}");
  } catch (error) { /* Storage is blocked: the page reads Swedish. */ }
  var lang = (${decide})(own, game);
  root.setAttribute("data-help-lang", lang);
  root.lang = lang;
  var title = root.getAttribute("data-title-" + lang);
  if (title) document.title = title;
})();`;
};

// ---------------------------------------------------------------- bilingual markup

export const langAttrs = (lang) => `data-help-lang="${lang}" lang="${lang}"`;

// One block per language, Swedish first. The stylesheet hides the one that is not chosen.
export const perLanguage = (render) => HELP_LANGUAGES.map((lang) => render(lang)).join("\n");

// A short paired text inside a link, a heading or a sentence. A name that is the same in both
// languages ("GitHub", "Open Historia") is written once.
export const bilingual = (text) => (text.sv === text.en
  ? escapeHtml(text.sv)
  : HELP_LANGUAGES.map((lang) => `<span ${langAttrs(lang)}>${escapeHtml(text[lang])}</span>`).join(""));

// ---------------------------------------------------------------- loading

const isPair = (value) => Boolean(value)
  && HELP_LANGUAGES.every((lang) => typeof value[lang] === "string" && value[lang].trim() !== "");

// Section ids become DOM ids and the fragment of a shared link, in both languages.
const SECTION_ID = /^[a-z0-9][a-z0-9-]*$/;

const pageProblems = (page, entry) => {
  const problems = [];
  const where = entry.file;
  if (page.schema !== "attainder-help-page-v1") problems.push(`${where}: schema is ${page.schema}`);
  if (page.route !== entry.route) problems.push(`${where}: route ${page.route} differs from the manifest's ${entry.route}`);
  for (const field of ["title", "nav", "description"]) {
    if (!isPair(page[field])) problems.push(`${where}: ${field} needs text in sv and en`);
  }
  const seen = new Set();
  for (const section of page.sections || []) {
    if (!SECTION_ID.test(section.id || "")) problems.push(`${where}: section id "${section.id}" cannot be an anchor`);
    if (seen.has(section.id)) problems.push(`${where}: section id "${section.id}" is used twice`);
    seen.add(section.id);
    if (!isPair(section.title) || !isPair(section.body)) problems.push(`${where}: section "${section.id}" needs a title and a body in sv and en`);
  }
  return problems;
};

const shellProblems = (shell, note) => {
  const needed = ["contents", "pagination", "previous", "next", "features", "guide", "download", "github",
    "play", "search-placeholder", "search-label", "breadcrumb", "home", "privacy", "privacy-choices",
    "sitemap", "no-matches", "license", "upstream-name", "upstream-discord", "upstream-legal-notice"];
  const problems = needed.filter((id) => !isPair(shell[id])).map((id) => `shell.json: entry "${id}" needs text in sv and en`);
  if (!isPair(note)) problems.push("shell.json: currentGuideNote needs text in sv and en");
  return problems;
};

// Reads the catalog the manifest names. `pages` is keyed by route ("/wiki/<slug>/"), which is
// how the generator matches a catalog page to a page of wiki/nav.json.
export const loadHelpCatalog = (helpDir) => {
  const read = (name) => readJson(path.join(helpDir, name));
  const manifest = read("manifest.json");
  const pages = new Map();
  const problems = [];
  for (const entry of manifest.pages) {
    const page = read(entry.file);
    problems.push(...pageProblems(page, entry));
    pages.set(entry.route, { ...page, file: entry.file });
  }
  const shellFile = read(manifest.shell.file);
  const shell = Object.fromEntries(shellFile.entries.map((entry) => [entry.id, entry.text]));
  problems.push(...shellProblems(shell, shellFile.currentGuideNote));
  if (problems.length > 0) {
    throw new WikiBuildError(`The help catalog cannot be rendered:\n  ${problems.join("\n  ")}`);
  }
  return {
    manifest,
    pages,
    navigation: read(manifest.navigation.file),
    shell,
    currentGuideNote: shellFile.currentGuideNote,
    issueUrl: shellFile.primaryIssueUrl,
  };
};

// wiki/nav.json decides which pages exist and in what order, because it also lists the pages
// the catalog lacks. navigation.json supplies the section labels and must agree with it on
// the pages both know. `navSections` is nav.json's sections with each page's route.
export const navigationProblems = (catalog, navSections) => {
  const problems = [];
  const known = new Set(navSections.flatMap((section) => section.routes));
  for (const route of catalog.pages.keys()) {
    if (route !== "/wiki/" && !known.has(route)) problems.push(`catalog page ${route} has no entry in wiki/nav.json`);
  }
  const inCatalog = (route) => catalog.pages.has(route);
  for (const section of catalog.navigation.sections) {
    const upstream = navSections.find((candidate) => candidate.title === section.sourceTitle);
    if (!upstream) {
      problems.push(`navigation.json section "${section.id}" names "${section.sourceTitle}", which wiki/nav.json lacks`);
      continue;
    }
    const mine = section.pages.map((page) => page.route).filter(inCatalog).join(" ");
    if (mine !== upstream.routes.filter(inCatalog).join(" ")) {
      problems.push(`navigation.json section "${section.id}" lists other pages, or another order, than wiki/nav.json`);
    }
  }
  return problems;
};

// The paired label of a nav.json section, or null when navigation.json does not have it.
export const sectionLabel = (catalog, sourceTitle) => {
  const section = catalog.navigation.sections.find((candidate) => candidate.sourceTitle === sourceTitle);
  return section && isPair(section.title) ? section.title : null;
};

// ---------------------------------------------------------------- rendering a catalog page

// Both renderings of each section share one wrapper, and the wrapper carries the section's
// id. An anchor therefore works in either language and no id appears twice in a page.
// `renderMarkdown` is the generator's own marked setup, so a catalog body gets the same
// tables, links and images as an upstream page. Returns the markup and, per section, each
// language's rendered body, which the search index reads.
export const renderCatalogSections = (page, renderMarkdown) => {
  const bodies = page.sections.map((section) => Object.fromEntries(
    HELP_LANGUAGES.map((lang) => [lang, renderMarkdown(section.body[lang])]),
  ));
  const html = page.sections.map((section, index) => {
    const renderings = perLanguage((lang) => `<div ${langAttrs(lang)} data-help-section="${section.id}">
<h2>${escapeHtml(section.title[lang])}</h2>
${bodies[index][lang]}</div>`);
    return `<section id="${section.id}" class="help-section">\n${renderings}\n</section>`;
  }).join("\n");
  return { html, bodies };
};
