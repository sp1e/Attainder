// The script at the end of every wiki page: the language switch and the search box. It is
// written as text because it runs in the reader's browser, not in the build, and in the same
// plain style as the search script it grew out of, so it has no dependency and needs no
// bundler. The head script (helpCatalog.mjs) has already picked the language by the time
// this runs; this one changes it on request.
import { HELP_LANGUAGES, WIKI_LANGUAGE_KEY } from "./helpCatalog.mjs";

// The few shell texts the script sets itself, per language: the search box's placeholder and
// label (attributes cannot hold two languages), the "no matches" line and the section name
// of the hub in a result. "<" is escaped so no text can close the script element.
const scriptTexts = (shell) => JSON.stringify(Object.fromEntries(HELP_LANGUAGES.map((lang) => [lang, {
  placeholder: shell["search-placeholder"][lang],
  label: shell["search-label"][lang],
  none: shell["no-matches"][lang],
  guide: shell.guide[lang],
}]))).replace(/</g, "\\u003c");

export const clientScript = (shell) => `
// The language switch and client-side search over a generated index: no dependency, no
// server, no network call beyond the index itself. The index holds one entry per page and
// language, and is small enough that a plain substring scan is instant.
(function () {
  var TEXT = ${scriptTexts(shell)};
  var root = document.documentElement;
  var buttons = document.querySelectorAll("[data-help-set]");
  var input = document.getElementById("wikiSearch");
  var list = document.getElementById("wikiResults");
  var index = null, pending = false;

  function current() { return root.getAttribute("data-help-lang") === "en" ? "en" : "sv"; }

  // Titles and section names come from JSON and go into innerHTML.
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function load() {
    if (index || pending) return;
    pending = true;
    fetch("/wiki/search-index.json")
      .then(function (r) { return r.json(); })
      .then(function (data) { index = data; pending = false; render(); })
      .catch(function () { pending = false; });
  }

  function render() {
    if (!input || !list) return;
    var lang = current();
    var q = input.value.trim().toLowerCase();
    if (!q || !index) { list.hidden = true; list.innerHTML = ""; return; }
    var hits = [];
    for (var i = 0; i < index.length && hits.length < 12; i++) {
      var page = index[i];
      if (page.lang !== lang || page.haystack.indexOf(q) === -1) continue;
      // A title match is what the reader almost always meant, so float those first.
      hits.push({ page: page, rank: page.title.toLowerCase().indexOf(q) === -1 ? 1 : 0 });
    }
    hits.sort(function (a, b) { return a.rank - b.rank; });
    if (hits.length === 0) {
      list.innerHTML = "<li class='none'>" + esc(TEXT[lang].none) + "</li>";
    } else {
      list.innerHTML = hits.map(function (h) {
        return "<li><a href='" + esc(h.page.url) + "'>" + esc(h.page.title) +
               "<span>" + esc(h.page.section || TEXT[lang].guide) + "</span></a></li>";
      }).join("");
    }
    list.hidden = false;
  }

  // Everything that follows the language and is not plain markup: the document title, the
  // pressed state of the switch, the search box's attributes and the open result list.
  function apply(lang) {
    root.setAttribute("data-help-lang", lang);
    root.lang = lang;
    var title = root.getAttribute("data-title-" + lang);
    if (title) document.title = title;
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute("aria-pressed", String(buttons[i].getAttribute("data-help-set") === lang));
    }
    if (input) {
      input.placeholder = TEXT[lang].placeholder;
      input.setAttribute("aria-label", TEXT[lang].label);
    }
    render();
  }

  // The two renderings of a section differ in length. Keep the section being read where it
  // is on screen, so the switch does not throw the reader to another passage.
  function sectionInView() {
    var sections = document.querySelectorAll(".help-section");
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].getBoundingClientRect().bottom > 0) return sections[i];
    }
    return null;
  }

  function choose(lang) {
    var held = sectionInView();
    var before = held ? held.getBoundingClientRect().top : 0;
    // Only the wiki's own key: the game's choice in Options is not changed from here.
    try { localStorage.setItem("${WIKI_LANGUAGE_KEY}", lang); } catch (error) { /* Storage is blocked: the choice lasts for this page. */ }
    apply(lang);
    if (held) window.scrollBy({ top: held.getBoundingClientRect().top - before, behavior: "instant" });
  }

  for (var b = 0; b < buttons.length; b++) {
    buttons[b].addEventListener("click", function () { choose(this.getAttribute("data-help-set")); });
  }
  apply(current());

  if (!input || !list) return;
  input.addEventListener("focus", load);
  input.addEventListener("input", function () { load(); render(); });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { input.value = ""; list.hidden = true; input.blur(); }
    if (e.key === "Enter") { var a = list.querySelector("a"); if (a) window.location.href = a.getAttribute("href"); }
  });
  document.addEventListener("click", function (e) {
    if (!list.hidden && !input.contains(e.target) && !list.contains(e.target)) list.hidden = true;
  });
})();
`;
