/*! Open Historia — wiki generator © 2026 Nicholas Krol, AGPL-3.0-or-later. */
// Renders the help into public/wiki/<slug>/index.html, one directory per page.
//
// Two sources, kept apart. A page the help catalog has (public/lang/attainder/help/, matched
// by its route) is rendered from the catalog in Swedish and English into one file; the page's
// own script and switch pick which one shows. A page the catalog lacks is rendered from the
// upstream markdown under wiki/, in English, as before. wiki/nav.json still decides which
// pages exist and in what order. The run prints how many pages came from each source.
//
// It lives in public/ rather than site/ for the same reason the guides do (see the comment in
// assemble-site.mjs): a local desktop install serves public/ at ITS root, so the wiki works
// offline inside the app too, and openhistoria.com gets the same files lifted to / by the
// assembler. One source, two surfaces, no hand-edited second copy to desync.
//
// The generated HTML is COMMITTED as well as generated. assemble-site.mjs hard-fails if a
// ROOT_PAGES entry is missing from dist-web/, and `npm run build` (desktop) and `build:web`
// never invoke this script — committing the output is what keeps all three honest without
// threading the generator through every build path.
//
// Run: node scripts/build-wiki.mjs   (also runs as the first stage of `npm run build:site`)
//      node scripts/build-wiki.mjs --check   writes nothing and exits 1 when the committed
//      public/wiki/ or public/sitemap.xml differs from a fresh build
//
// The maintenance runbook is docs/wiki.md — editing rules, the screenshot harness and its
// pitfalls, how the URL redirects work, and how to add a page.
//
// Wondering whether the wiki is out of date? `npm run wiki:check` diffs the commits recorded in
// wiki/provenance.json against the current tips of main and beta and tells you which pages cite
// files that have changed since. Update provenance.json when you finish a pass, or the next
// person will trust a stale answer.
import { readFileSync, mkdirSync, rmSync, existsSync, readdirSync, statSync, cpSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Marked } from "marked";
import { writeOrCheck } from "./i18n/jsonOutput.mjs";
import { clientScript } from "./wiki/clientScript.mjs";
import {
  HELP_LANGUAGES, LANGUAGE_NAMES, WikiBuildError, bilingual, escapeHtml as esc, headLanguageScript,
  langAttrs, loadHelpCatalog, navigationProblems, perLanguage, renderCatalogSections, sectionLabel,
} from "./wiki/helpCatalog.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SITE = "https://openhistoria.com";
const GTAG = "G-H9EQ4JFZXZ";               // same property as the landing page and the guides
const OG_IMAGE = "https://raw.githubusercontent.com/Open-Historia/open-historia/main/public/loading_screen.jpg";

// ---------------------------------------------------------------- helpers

// Heading ids double as the on-page TOC anchors and as the fragment in a shared link, so they
// have to stay stable across rebuilds — derived from the text alone, never from position.
// (Upstream pages only: a catalog page takes its anchors from the catalog's section ids.)
const slugify = (s) => String(s)
  .toLowerCase()
  .replace(/<[^>]*>/g, "")
  .replace(/[^\w\s-]/g, "")
  .trim()
  .replace(/\s+/g, "-")
  .slice(0, 60) || "section";

const stripTags = (html) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

// marked has already HTML-escaped the heading text by the time the renderer sees it, so the
// stored form must be decoded back to plain text — otherwise esc() runs over it a second time
// and an apostrophe reaches the contents list as a literal "&#39;".
const decodeEntities = (s) => String(s)
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&amp;/g, "&");

// Paths relative to `dir`, with forward slashes on every platform.
const walk = (dir, prefix = "") => readdirSync(dir).flatMap((name) => {
  const full = path.join(dir, name);
  return statSync(full).isDirectory() ? walk(full, `${prefix}${name}/`) : [`${prefix}${name}`];
});

// ---------------------------------------------------------------- markdown

// Wide tables must scroll inside their own box rather than pushing the whole page sideways —
// the systems pages carry some genuinely wide reference tables. Done as a post-pass rather than
// a custom table renderer so the stock GFM table output is used verbatim.
const wrapTables = (html) => html.replace(/<table>[\s\S]*?<\/table>/g, (t) => `<div class="table-scroll">${t}</div>`);

// One marked setup for both sources. An upstream page asks for heading ids and gets its
// headings back for the contents list. A catalog body does not: its anchors are the catalog's
// section ids, and a slug made from a translated heading would differ between the languages
// and could repeat an id within the page.
const createMarkdown = () => {
  // Collected per parse, then reset — marked has no per-parse state we can hang this off.
  let headings = null;
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        // h1 is the page title, rendered from nav.json above the body — a second one in the
        // markdown would be a duplicate, so only h2/h3 get ids and TOC entries.
        if (depth === 1 || !headings) return `<h${depth}>${text}</h${depth}>\n`;
        const id = slugify(stripTags(text));
        if (depth === 2 || depth === 3) headings.push({ depth, id, text: decodeEntities(stripTags(text)) });
        return `<h${depth} id="${id}">${text}</h${depth}>\n`;
      },
    },
  });
  return (md, { headingIds = false } = {}) => {
    headings = headingIds ? [] : null;
    const html = wrapTables(marked.parse(md));
    const found = headings || [];
    headings = null;
    return { html, headings: found };
  };
};

// ---------------------------------------------------------------- load the sources

// One flat, ordered list drives prev/next paging; the hub is always first. `help` is the
// catalog's page for the same route, or null when the page renders from upstream markdown.
const listPages = (nav, catalog) => {
  const withHelp = (page) => ({ ...page, help: catalog.pages.get(page.url) || null });
  const pages = [withHelp({ ...nav.hub, url: "/wiki/", section: null, sectionLabel: null, nav: nav.hub.nav || "Overview" })];
  for (const section of nav.sections) {
    const label = sectionLabel(catalog, section.title);
    for (const page of section.pages) {
      pages.push(withHelp({ ...page, url: `/wiki/${page.slug}/`, section: section.title, sectionLabel: label }));
    }
  }
  return pages;
};

const assertSources = (srcDir, nav, pages, catalog) => {
  const seen = new Set();
  for (const page of pages) {
    if (seen.has(page.url)) throw new WikiBuildError(`wiki/nav.json: duplicate page url ${page.url}`);
    seen.add(page.url);
    if (!existsSync(path.join(srcDir, page.file))) {
      throw new WikiBuildError(`wiki/nav.json lists ${page.file}, which does not exist under wiki/.`);
    }
  }
  // Every .md under wiki/ must be reachable from the nav. A page nobody links is a page nobody
  // reads, and it would silently miss the sidebar, the sitemap and the search index.
  const listed = new Set(pages.map((p) => p.file.replace(/\\/g, "/")));
  const orphans = walk(srcDir).filter((f) => f.endsWith(".md") && !listed.has(f));
  if (orphans.length > 0) {
    throw new WikiBuildError(`Unreferenced wiki page(s): ${orphans.join(", ")} — add them to wiki/nav.json or delete them.`);
  }
  const navSections = nav.sections.map((s) => ({ title: s.title, routes: s.pages.map((p) => `/wiki/${p.slug}/`) }));
  const problems = navigationProblems(catalog, navSections);
  if (problems.length > 0) {
    throw new WikiBuildError(`The help catalog and wiki/nav.json disagree:\n  ${problems.join("\n  ")}`);
  }
};

// The game is under active development on two channels at once, so any upstream page here can
// be overtaken between one release and the next. Rather than a vague "may be out of date", each
// carries the date and the two commits the wiki was last checked against — the same record
// wiki:check reads, so the note cannot drift from the truth and cannot be forgotten. It is
// also why the build is repeatable: the date comes from this file, never from the clock.
const verifiedNoteHtml = (srcDir) => {
  const prov = JSON.parse(readFileSync(path.join(srcDir, "provenance.json"), "utf8"));
  const verified = prov.verifiedAgainst || {};
  return [
    verified.date ? `Last checked against the game on <b>${esc(verified.date)}</b>` : "Last checked against the game",
    verified.main ? `main <code>${esc(verified.main.slice(0, 8))}</code>` : null,
    verified.beta ? `beta <code>${esc(verified.beta.slice(0, 8))}</code>` : null,
  ].filter(Boolean).join(" · ");
};

const loadContext = (root, catalogOverride) => {
  const srcDir = path.join(root, "wiki");
  if (!existsSync(path.join(srcDir, "nav.json"))) {
    throw new WikiBuildError("wiki/nav.json is missing — it is the source of truth for page order, the sidebar and the sitemap.");
  }
  const nav = JSON.parse(readFileSync(path.join(srcDir, "nav.json"), "utf8"));
  const catalog = catalogOverride || loadHelpCatalog(path.join(root, "public", "lang", "attainder", "help"));
  const pages = listPages(nav, catalog);
  assertSources(srcDir, nav, pages, catalog);
  // The adapted guide is named by its own hub page; without one the upstream name stands.
  const hub = pages[0];
  const guideName = hub.help ? hub.help.title : { sv: hub.title, en: hub.title };
  return {
    srcDir, nav, pages, catalog, guideName,
    shell: catalog.shell,
    renderMarkdown: createMarkdown(),
    verifiedNote: verifiedNoteHtml(srcDir),
  };
};

// ---------------------------------------------------------------- shared shell

const navText = (page, lang) => (page.help ? page.help.nav[lang] : page.nav);
const sectionText = (page, lang) => (page.sectionLabel ? page.sectionLabel[lang] : page.section);

const sidebarHtml = (ctx, current) => {
  const item = (page) => {
    const on = page.url === current ? ' class="on" aria-current="page"' : "";
    if (page.help) return `<li><a href="${page.url}"${on}>${bilingual(page.help.nav)}</a></li>`;
    // Beta-only pages are marked in the sidebar too — a reader on the stable build should be
    // able to see that a feature is not missing from their game by accident. (Upstream pages
    // only: the catalog states availability in the page itself.)
    const chip = page.beta ? ' <em>beta</em>' : "";
    return `<li><a href="${page.url}" lang="en"${on}>${esc(page.nav)}${chip}</a></li>`;
  };
  const sections = ctx.nav.sections.map((section) => {
    const label = sectionLabel(ctx.catalog, section.title);
    const title = label ? `<span>${bilingual(label)}</span>` : `<span lang="en">${esc(section.title)}</span>`;
    const items = section.pages.map((p) => item(ctx.pages.find((q) => q.url === `/wiki/${p.slug}/`))).join("");
    return `
        <li class="sec">
          ${title}
          <ul>${items}</ul>
        </li>`;
  }).join("");
  return `<ul class="wiki-nav">
        <li class="sec"><ul>${item(ctx.pages[0])}</ul></li>${sections}
      </ul>`;
};

// One pager per language: its accessible label is an attribute and cannot hold both.
const pagerHtml = (ctx, index) => {
  const prev = ctx.pages[index - 1];
  const next = ctx.pages[index + 1];
  if (!prev && !next) return "";
  const link = (page, cls, key, lang) => (page
    ? `<a class="${cls}" href="${page.url}"><span>${esc(ctx.shell[key][lang])}</span><b>${esc(navText(page, lang))}</b></a>`
    : "<span></span>");
  return perLanguage((lang) => `<nav class="wiki-pager" ${langAttrs(lang)} aria-label="${esc(ctx.shell.pagination[lang])}">
        ${link(prev, "prev", "previous", lang)}
        ${link(next, "next", "next", lang)}
      </nav>`);
};

// Structured data is left as upstream wrote it, from nav.json.
const breadcrumbJsonLd = (page) => {
  const items = [
    { name: "Open Historia", item: `${SITE}/` },
    { name: "Wiki", item: `${SITE}/wiki/` },
  ];
  if (page.url !== "/wiki/") items.push({ name: page.title, item: SITE + page.url });
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: it.item })),
  }, null, 2);
};

// Collected from a rendered body for the broken-link guard. `hash` is kept for catalog
// bodies only: the catalog can be corrected, while an upstream page's anchors were written
// for upstream's headings and are checked to the page, as they always were.
const wikiLinks = (html, from, { anchors = false } = {}) => [...html.matchAll(/href="(\/wiki\/[^"#]*)(?:#([^"]*))?"/g)]
  .map((m) => ({ from, to: m[1], hash: anchors ? m[2] || "" : "" }));

// ---------------------------------------------------------------- an upstream page

const upstreamTocHtml = (list) => {
  // A two-entry contents list is noise, not navigation.
  if (list.filter((h) => h.depth === 2).length < 2) return "";
  const items = list.map((h) =>
    `<li class="d${h.depth}"><a href="#${h.id}">${esc(h.text)}</a></li>`).join("");
  return `<nav class="wiki-toc" aria-label="On this page"><b>On this page</b><ul>${items}</ul></nav>`;
};

// A page the catalog lacks: the upstream markdown, in English, as it has always rendered.
const upstreamArticle = (ctx, page) => {
  const md = readFileSync(path.join(ctx.srcDir, page.file), "utf8");
  const { html: body, headings } = ctx.renderMarkdown(md, { headingIds: true });
  const isHub = page.url === "/wiki/";
  const crumbTail = isHub
    ? `<span aria-hidden="true">/</span> Wiki`
    : `<span aria-hidden="true">/</span> <a href="/wiki/">Wiki</a> <span aria-hidden="true">/</span> ${esc(page.title)}`;
  const top = `<nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/">Open Historia</a> ${crumbTail}
    </nav>
    <h1>${esc(page.title)}</h1>
    <p class="tagline">${esc(page.description)}</p>
    ${page.beta ? `<p class="beta-note"><b>Beta channel only.</b> This system is not in the stable release yet. To try it, install the
      <a href="https://github.com/Open-Historia/open-historia/releases/tag/desktop-beta">beta build</a>, which installs alongside
      the stable app and keeps its own saves.</p>` : ""}
    ${upstreamTocHtml(headings)}
    ${body}`;
  const bottom = `<p class="wiki-stale">Open Historia is under active development on two channels, and this
      wiki is written by hand — a page can fall behind a release. ${ctx.verifiedNote}. If something
      here does not match what you see in the game, trust the game and
      <a href="https://discord.gg/QaqAK7fQAg" target="_blank" rel="noopener">say so on Discord</a>.</p>`;
  // Title, headings and the opening prose are what a reader searches by; indexing the whole
  // page would balloon the file for matches nobody scrolls to.
  const haystack = [page.title, page.description, headings.map((h) => h.text).join(" "),
    stripTags(body).toLowerCase().slice(0, 1200)].join(" ").toLowerCase();
  return {
    top, bottom,
    mainAttrs: ' lang="en"',
    titles: null,
    title: isHub ? `${page.title} — Open Historia` : `${page.title} — Open Historia Wiki`,
    shareTitle: `${page.title} — Open Historia Wiki`,
    description: page.description,
    links: wikiLinks(body, page.file),
    // The English text is listed under both languages, so the page is found from either.
    search: (lang) => ({ title: page.title, section: sectionText(page, lang), haystack }),
  };
};

// ---------------------------------------------------------------- a catalog page

const catalogTocHtml = (ctx, help) => {
  // A two-entry contents list is noise, not navigation.
  if (help.sections.length < 2) return "";
  return perLanguage((lang) => {
    const label = esc(ctx.shell.contents[lang]);
    const items = help.sections.map((s) => `<li class="d2"><a href="#${s.id}">${esc(s.title[lang])}</a></li>`).join("");
    return `<nav class="wiki-toc" ${langAttrs(lang)} aria-label="${label}"><b>${label}</b><ul>${items}</ul></nav>`;
  });
};

const catalogCrumbsHtml = (ctx, page) => perLanguage((lang) => {
  const guide = esc(ctx.shell.guide[lang]);
  const tail = page.url === "/wiki/"
    ? `<span aria-hidden="true">/</span> ${guide}`
    : `<span aria-hidden="true">/</span> <a href="/wiki/">${guide}</a> <span aria-hidden="true">/</span> ${esc(page.help.title[lang])}`;
  return `<nav class="breadcrumbs" ${langAttrs(lang)} aria-label="${esc(ctx.shell.breadcrumb[lang])}">
      <a href="/">Open Historia</a> ${tail}
    </nav>`;
});

// What the search box matches for one language, by the same rule as an upstream page.
const catalogHaystack = (help, bodies, lang) => {
  const text = decodeEntities(stripTags(bodies.map((body) => body[lang]).join(" ")));
  return [help.title[lang], help.description[lang], help.sections.map((s) => s.title[lang]).join(" "),
    text.slice(0, 1200)].join(" ").toLowerCase();
};

// A page of the help catalog, in Swedish and English. The catalog's own decisions
// (shell.json, adaptationDecisions) apply: no upstream beta banner, and the catalog's guide
// note in place of upstream's two-channel note.
const catalogArticle = (ctx, page) => {
  const help = page.help;
  const { html: body, bodies } = renderCatalogSections(help, (md) => ctx.renderMarkdown(md).html);
  const titleIn = (lang) => (page.url === "/wiki/" ? help.title[lang] : `${help.title[lang]} — ${ctx.guideName[lang]}`);
  const titles = Object.fromEntries(HELP_LANGUAGES.map((lang) => [lang, titleIn(lang)]));
  const issues = esc(ctx.catalog.issueUrl);
  return {
    top: `${catalogCrumbsHtml(ctx, page)}
    <h1>${bilingual(help.title)}</h1>
    <p class="tagline">${bilingual(help.description)}</p>
    ${catalogTocHtml(ctx, help)}
    ${body}`,
    bottom: `<p class="wiki-stale">${bilingual(ctx.catalog.currentGuideNote)}
      <a href="${issues}" target="_blank" rel="noopener">${issues.replace(/^https?:\/\//, "")}</a></p>`,
    mainAttrs: "",
    titles,
    // Without script the page reads Swedish, so the static head is Swedish as well.
    title: titles.sv,
    shareTitle: titles.sv,
    description: help.description.sv,
    links: wikiLinks(body, `the help catalog's ${help.file}`, { anchors: true }),
    search: (lang) => ({ title: help.title[lang], section: sectionText(page, lang), haystack: catalogHaystack(help, bodies, lang) }),
  };
};

// ---------------------------------------------------------------- page shell

const headHtml = (page, article) => {
  const url = SITE + page.url;
  return `<head>
  <meta charset="UTF-8" />
  <!-- Visit counters: asked for first, loaded only after a yes (consent.js). -->
  <script defer src="/consent.js"></script>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#111113" />
  <link rel="icon" type="image/jpeg" href="/logo.png" />
  <title>${esc(article.title)}</title>
  <!-- Swedish or English, chosen before the first paint: the page's own switch, then the game's Options. -->
  <script>
${headLanguageScript()}
  </script>
  <link rel="canonical" href="${url}" />
  <meta name="description" content="${esc(article.description)}" />

  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Open Historia" />
  <meta property="og:url" content="${url}" />
  <meta property="og:title" content="${esc(article.shareTitle)}" />
  <meta property="og:description" content="${esc(article.description)}" />
  <meta property="og:image" content="${OG_IMAGE}" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:width" content="1280" />
  <meta property="og:image:height" content="720" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(article.shareTitle)}" />
  <meta name="twitter:description" content="${esc(article.description)}" />
  <meta name="twitter:image" content="${OG_IMAGE}" />

  <link rel="stylesheet" href="/fonts/fonts.css" />
  <link rel="stylesheet" href="/wiki.css" />

  <script type="application/ld+json">
${breadcrumbJsonLd(page)}
  </script>
</head>`;
};

// Two real buttons. Swedish is pressed in the markup because that is what the page reads
// without script; the page script corrects it. The switch is written twice and the
// stylesheet shows one: last in the header, where it stays under the pointer when the other
// labels change length, and above the search box on a phone, where the header has no room
// for it (at 375px it pushed the brand and the Play button onto two lines).
const languageSwitchHtml = (place) => {
  const button = (lang) => `<button type="button" data-help-set="${lang}" lang="${lang}" aria-pressed="${lang === "sv"}">${esc(LANGUAGE_NAMES[lang])}</button>`;
  return `<div class="lang-switch lang-switch-${place}" role="group">${HELP_LANGUAGES.map(button).join("")}</div>`;
};

const siteHeaderHtml = (ctx) => {
  const t = (id) => bilingual(ctx.shell[id]);
  return `<header>
  <div class="wrap nav">
    <a class="brand" href="/"><img class="mark" src="/icon-192.png" alt="" width="28" height="28" /> Open Historia</a>
    <nav class="nav-links">
      <a href="/#features">${t("features")}</a>
      <a class="nav-keep" href="/wiki/">${t("guide")}</a>
      <a href="/#download">${t("download")}</a>
      <a href="https://github.com/Open-Historia/open-historia" target="_blank" rel="noopener">${t("github")}</a>
      <a class="nav-cta" href="/play/">${t("play")}</a>
      ${languageSwitchHtml("header")}
    </nav>
  </div>
</header>`;
};

// The upstream attribution, the licence and the complete upstream legal notice stay on every
// page, the notice once per language with Open Historia as its subject.
const footerHtml = (ctx) => {
  const t = (id) => bilingual(ctx.shell[id]);
  const legal = ctx.shell["upstream-legal-notice"];
  return `<footer>
  <div class="wrap">
    <img class="mark" src="/icon-192.png" alt="" width="22" height="22" loading="lazy" /> <b>${t("upstream-name")}</b> · ${t("license")} ·
    <a href="/">${t("home")}</a> ·
    <a href="/wiki/">${t("guide")}</a> ·
    <a href="https://github.com/Open-Historia/open-historia" target="_blank" rel="noopener">${t("github")}</a> ·
    <a href="https://discord.gg/QaqAK7fQAg" target="_blank" rel="noopener">${t("upstream-discord")}</a> ·
    <a href="/privacy/">${t("privacy")}</a> ·
    <a href="/privacy/#choices" data-consent-open>${t("privacy-choices")}</a> ·
    <a href="/sitemap.xml">${t("sitemap")}</a>
    ${perLanguage((lang) => `<p class="foot-legal" ${langAttrs(lang)}>${esc(legal[lang])}</p>`)}
  </div>
</footer>`;
};

const renderPage = (ctx, page, index, article) => {
  // The titles ride on <html> so the head script and the switch can set the right one.
  const titleAttrs = article.titles
    ? HELP_LANGUAGES.map((lang) => ` data-title-${lang}="${esc(article.titles[lang])}"`).join("")
    : "";
  const search = ctx.shell["search-placeholder"].sv;
  return `<!doctype html>
<html lang="sv" data-help-lang="sv"${titleAttrs}>
${headHtml(page, article)}
<body>
${siteHeaderHtml(ctx)}

<div class="wrap wiki-layout">
  <aside class="wiki-sidebar">
    ${languageSwitchHtml("side")}
    <div class="wiki-search">
      <input type="search" id="wikiSearch" placeholder="${esc(search)}" aria-label="${esc(ctx.shell["search-label"].sv)}" autocomplete="off" />
      <ul id="wikiResults" hidden></ul>
    </div>
    ${sidebarHtml(ctx, page.url)}
  </aside>

  <main class="wiki-main"${article.mainAttrs}>
    ${article.top}
    ${pagerHtml(ctx, index)}
    ${article.bottom}
  </main>
</div>

${footerHtml(ctx)}

<script>${clientScript(ctx.shell)}</script>
</body>
</html>
`;
};

// ---------------------------------------------------------------- build

// A typo'd internal link is invisible until a reader hits a 404, so fail the build on it. A
// catalog link's fragment is checked too, where the target's anchors are known for certain:
// another catalog page's section ids.
const assertLinks = (ctx, links) => {
  const byUrl = new Map(ctx.pages.map((p) => [p.url, p]));
  const isBroken = (link) => {
    const target = byUrl.get(link.to.endsWith("/") ? link.to : `${link.to}/`);
    if (!target) return true;
    return Boolean(link.hash && target.help && !target.help.sections.some((s) => s.id === link.hash));
  };
  const broken = links.filter(isBroken);
  if (broken.length > 0) {
    const lines = broken.map((b) => `Broken wiki link in ${b.from}: ${b.to}${b.hash ? `#${b.hash}` : ""}`);
    throw new WikiBuildError([...new Set(lines)].join("\n"));
  }
};

// Regenerated from nav.json every build. It used to be hand-maintained, which is exactly how a
// sitemap ends up advertising URLs that no longer exist.
const sitemapUrls = (ctx) => [
  ...(ctx.nav.extraSitemap || []),
  ...ctx.pages.map((p) => ({ loc: p.url, changefreq: "monthly", priority: p.url === "/wiki/" ? "0.9" : "0.7" })),
];

const sitemapXml = (urls) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${SITE}${u.loc}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join("\n")}
</urlset>
`;

// Everything a build produces, in memory: each text file by its path from the repository
// root, plus the folder of screenshots that is copied as it is. Nothing is written here, so
// the same result serves both the build and --check. `catalog` replaces the catalog on disk;
// the test uses it to render a page the catalog lacks.
export const buildWikiFiles = ({ root = repoRoot, catalog } = {}) => {
  const ctx = loadContext(root, catalog);
  const files = new Map();
  const searchIndex = [];
  const links = [];
  ctx.pages.forEach((page, index) => {
    const article = page.help ? catalogArticle(ctx, page) : upstreamArticle(ctx, page);
    links.push(...article.links);
    const dir = page.url === "/wiki/" ? "public/wiki" : `public/wiki/${page.slug}`;
    files.set(`${dir}/index.html`, renderPage(ctx, page, index, article));
    // One entry per page and language; the search box reads the entries of the chosen one.
    for (const lang of HELP_LANGUAGES) searchIndex.push({ url: page.url, lang, ...article.search(lang) });
  });
  assertLinks(ctx, links);
  const urls = sitemapUrls(ctx);
  files.set("public/wiki/search-index.json", JSON.stringify(searchIndex));
  files.set("public/sitemap.xml", sitemapXml(urls));
  return {
    files,
    imgDir: path.join(ctx.srcDir, "img"),
    urlCount: urls.length,
    catalogPages: ctx.pages.filter((p) => p.help).map((p) => p.url),
    upstreamPages: ctx.pages.filter((p) => !p.help).map((p) => p.url),
  };
};

const writeToDisk = (root, built) => {
  const outDir = path.join(root, "public", "wiki");
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  for (const [rel, text] of built.files) writeOrCheck({ file: path.join(root, rel), text, check: false });
  if (existsSync(built.imgDir)) cpSync(built.imgDir, path.join(outDir, "img"), { recursive: true });
};

// The paths, from the repository root, where the committed output differs from `built`.
// Text is compared with CRLF folded to LF (a checkout with core.autocrlf has CRLF in the
// working copy); screenshots are compared byte for byte. A file under public/wiki/ that a
// build would not write is a difference too, so a removed page cannot linger.
const compareWithDisk = (root, built) => {
  const differences = [];
  const expected = new Set(built.files.keys());
  for (const [rel, text] of built.files) {
    if (!writeOrCheck({ file: path.join(root, rel), text, check: true })) differences.push(rel);
  }
  const images = existsSync(built.imgDir) ? walk(built.imgDir) : [];
  for (const name of images) {
    const rel = `public/wiki/img/${name}`;
    expected.add(rel);
    const committed = path.join(root, rel);
    const same = existsSync(committed) && readFileSync(committed).equals(readFileSync(path.join(built.imgDir, name)));
    if (!same) differences.push(rel);
  }
  const outDir = path.join(root, "public", "wiki");
  const onDisk = existsSync(outDir) ? walk(outDir).map((name) => `public/wiki/${name}`) : [];
  for (const rel of onDisk) {
    if (!expected.has(rel)) differences.push(`${rel} (a build does not write this file)`);
  }
  return differences;
};

// Builds the wiki. With `check`, writes nothing and reports in `differences` what a build
// would change; without it, writes the files and `differences` is empty.
export const runWikiBuild = ({ root = repoRoot, check = false, catalog } = {}) => {
  const built = buildWikiFiles({ root, catalog });
  const differences = check ? compareWithDisk(root, built) : [];
  if (!check) writeToDisk(root, built);
  return { ...built, differences };
};

// ---------------------------------------------------------------- command line

const SHOWN_DIFFERENCES = 10;

const main = () => {
  const check = process.argv.includes("--check");
  let result;
  try {
    result = runWikiBuild({ check });
  } catch (error) {
    if (!(error instanceof WikiBuildError)) throw error;
    console.error(error.message);
    process.exit(1);
  }
  const sources = `${result.catalogPages.length} page(s) from the help catalog, ${result.upstreamPages.length} from wiki/*.md` +
    (result.upstreamPages.length > 0 ? ` (${result.upstreamPages.join(", ")})` : "");
  if (!check) {
    console.log(`Built public/wiki/: ${sources}, search index, sitemap with ${result.urlCount} URL(s).`);
    return;
  }
  if (result.differences.length === 0) {
    console.log(`public/wiki/ and public/sitemap.xml match a fresh build: ${sources}.`);
    return;
  }
  console.error(`${result.differences.length} committed file(s) differ from a fresh build. Run \`npm run build:wiki\` and commit the result.`);
  for (const rel of result.differences.slice(0, SHOWN_DIFFERENCES)) console.error(`  ${rel}`);
  if (result.differences.length > SHOWN_DIFFERENCES) console.error(`  … and ${result.differences.length - SHOWN_DIFFERENCES} more`);
  process.exit(1);
};

// The test imports this file for runWikiBuild; only a direct `node scripts/build-wiki.mjs`
// runs the build. Compared through realpath, and without case on Windows, where the drive
// letter of the two spellings can differ.
const invokedDirectly = () => {
  if (!process.argv[1] || !existsSync(process.argv[1])) return false;
  const fold = (file) => (process.platform === "win32" ? realpathSync(file).toLowerCase() : realpathSync(file));
  return fold(process.argv[1]) === fold(fileURLToPath(import.meta.url));
};

if (invokedDirectly()) main();
