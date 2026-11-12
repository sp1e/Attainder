# The Player Wiki

The wiki at [openhistoria.com/wiki/](https://openhistoria.com/wiki/) is 30 player-facing pages
covering installation, the core loop, every game system, the tools, hosting and troubleshooting.
It replaced the five orphaned guide pages that the landing page linked zero times.

This page is for maintaining it. For what it *says*, read the wiki.

---

## 1. Where everything lives

| Path | What |
|---|---|
| `public/lang/attainder/help/` | The help adapted to the current game, in Swedish and English. Data: one JSON file per page, the navigation labels and the shell text. Section 2 covers it. |
| `wiki/*.md`, `wiki/*/*.md` | The upstream help. Hand-edited markdown, one file per page. The record of the original text, and the source for a page the catalog lacks. |
| `wiki/nav.json` | Which pages exist, their order, slugs and sidebar grouping; titles and beta flags for upstream pages. The source of truth. |
| `wiki/img/*.jpg` | Screenshots, 1280px JPEG. |
| `wiki/provenance.json` | What the wiki was last verified against, and which source files each page cites. |
| `public/wiki/**` | **Generated.** Committed as well as generated — see below. |
| `public/wiki.css` | The stylesheet. `public/guides.css` is a one-line `@import` shim for old links. |
| `scripts/build-wiki.mjs` | The generator. `scripts/wiki/helpCatalog.mjs` reads the catalog and holds the language rule; `scripts/wiki/clientScript.mjs` is the script each page runs. |
| `src/runtime/wikiHelp.test.js` | Runs in `npm test`: the committed pages equal a fresh build and carry both languages. |
| `scripts/check-wiki-freshness.mjs` | Tells you what needs updating. |
| `scripts/build-wiki-preview.mjs` | Builds a relocatable copy for sharing without touching the live site. |

It lives in `public/` rather than `site/` for the same reason the old guides did (see the comment
at the top of `assemble-site.mjs`): a local desktop install serves `public/` at *its* root, so the
wiki works offline inside the app, and `assemble-site.mjs` lifts it to `/` for the website. One
source, two surfaces.

**The generated HTML is committed.** `assemble-site.mjs` hard-fails when a `ROOT_PAGES` entry is
missing from `dist-web/`, and neither `npm run build` (desktop) nor `build:web` invokes the
generator — committing the output is what keeps all three build paths honest without threading the
generator through every one of them. So: **always commit `public/wiki/` alongside your `wiki/`
edits**, and alongside a change to the help catalog.

---

## 2. Swedish and English

**Where a page comes from.** The generator matches each page of `wiki/nav.json` to the help
catalog by its route (`/wiki/<slug>/`). A page the catalog has is rendered from the catalog, in
both languages, into one `index.html`. A page the catalog lacks is rendered from its markdown under
`wiki/`, in English, and its main column is marked `lang="en"`. The build prints how many pages
came from each source and names the upstream ones. On 12 November 2026 the catalog covers all 32
pages, so no page renders from `wiki/*.md`.

**Editing a bilingual page.** The catalog is data owned by the research session. Its schema is in
`public/lang/attainder/help/README.md`: a page file holds paired `title`, `nav` and `description`
and a list of sections, each with a stable `id` and a paired `title` and Markdown `body`. The
generator only renders it. To change help text, change the catalog (or ask the research session
to), then run `npm run build:wiki` and commit `public/wiki/` with it. Do not edit the generated
HTML, and do not edit `wiki/*.md` to change a page the catalog has: that text is no longer shown.

**What the generator takes from where.**

| Text | Source |
|---|---|
| Page title, tagline, sections | The page file under `pages/`. |
| Sidebar and pager labels | Each page's `nav`. Section labels from `navigation.json`, matched to `wiki/nav.json` by `sourceTitle`. |
| Header and footer links, search box, contents and breadcrumb labels, the upstream legal notice | `shell.json` entries. |
| The note that closes a page | `shell.json` `currentGuideNote`, with a link to `primaryIssueUrl`. An upstream page keeps the "last checked" note from `wiki/provenance.json`. |
| The two labels of the language switch | `LANGUAGE_NAMES` in `scripts/wiki/helpCatalog.mjs`, the same endonyms as the game's language list. `shell.json` has no entry for them. |
| Structured data (`application/ld+json`) | `wiki/nav.json`, unchanged. |

**How one file holds two languages.** Every bilingual piece of text is marked `data-help-lang="sv"`
or `"en"` together with the matching `lang`. `<html>` carries the chosen language in the same
attribute, and `public/wiki.css` hides the other one. Both renderings of a section sit in one
`<section>` that carries the catalog's section `id`, so `#storage-and-undo` works in either
language and no id appears twice. Section ids are permanent for the same reason slugs are.

**Which language shows.** A short script in `<head>` reads `localStorage.wiki_language`, then
`localStorage.ui_language`, before the first paint. `en` gives English. Anything else, an unset
value included, gives Swedish, which is the game's first-language rule. Without script the page
reads Swedish. The switch stores `wiki_language` and leaves the game's choice alone. It is in the
header, and above the search box at 720px and narrower, where the header has no room for it.
The rule is `decideHelpLanguage` in `scripts/wiki/helpCatalog.mjs`; the script in the page is
generated from that function's source text, so the two cannot drift.

**Search.** `public/wiki/search-index.json` holds one entry per page and language, each with a
`lang` field. The search box reads the entries of the chosen language. An upstream page is listed
under both languages with its English text.

**The check.** `node scripts/build-wiki.mjs --check` writes nothing. It exits 1 and lists the
first differing files when the committed `public/wiki/` or `public/sitemap.xml` differs from a
fresh build, including a file under `public/wiki/` that a build would not write. Text is compared
with CRLF folded to LF, so a Windows checkout and CI agree. `src/runtime/wikiHelp.test.js` runs the
same comparison in `npm test`.

**Links in the catalog.** A catalog body may link to `/wiki/<slug>/` or
`/wiki/<slug>/#<section-id>`. The build fails on a page that does not exist and on a section id the
target page lacks.

---

## 3. Everyday commands

```
npm run build:wiki      # regenerate public/wiki/ from the help catalog and wiki/
node scripts/build-wiki.mjs --check   # does the committed public/wiki/ equal a fresh build?
npm run wiki:check      # what has changed upstream that the wiki cites?
npm run build:site      # full site build (runs build:wiki first)
npm run preview:site    # serve dist-site/ at localhost:4173
npm run wiki:preview    # relocatable copy in dist-wiki-preview/, for sharing
```

The generator fails the build rather than shipping something broken. It refuses to run if an
internal `/wiki/…` link points at a page that does not exist, if `nav.json` names a missing file,
if a `.md` under `wiki/` is not referenced by `nav.json`, or if the help catalog is incomplete or
disagrees with `nav.json` about the pages both list. It also regenerates
`public/sitemap.xml` from `nav.json`, so the sitemap cannot drift.

---

## 4. Showing it to people without touching the live site

`openhistoria.com` deploys from `main` through a Cloudflare Pages project that not everyone has
access to. To circulate the wiki for review without going near it:

```
npm run wiki:preview
```

That writes `dist-wiki-preview/` — the same pages with every internal link rewritten **relative**,
so the folder works from a domain root, a GitHub Pages subpath, a shared drive, or opened straight
off disk. Links that belong to the game rather than the wiki (Play, Download, the landing page)
point at the live site, since they are not in the bundle.

It matters because the real wiki addresses everything absolutely — `/wiki.css`, `/wiki/img/…`,
about 1,500 references — which is correct when served from the site root and breaks completely on
a subpath. This is the fix.

Two things the preview build does on purpose, because a review copy must not be mistaken for
the real one:

* **Analytics are stripped.** Every generated page carries the project's live GA property, and
  a preview hosted elsewhere would report its traffic into the real site's statistics —
  inventing pageviews for a domain that is not `openhistoria.com`.
* **Every page gets a "Preview build — not the live site" banner**, linking to the published
  wiki. A copy that looks identical to the live site is one screenshot away from being quoted
  as though it were published.

`<link rel="canonical">` and `og:url` still point at `openhistoria.com/wiki/` — that is
deliberate, so a search engine does not index the preview as duplicate content.

Where to put it:

| | |
|---|---|
| **Netlify Drop** | Drag the folder onto [app.netlify.com/drop](https://app.netlify.com/drop). Instant URL, no account needed for a quick share. |
| **GitHub Pages on your own fork** | Push `dist-wiki-preview/` to a `gh-pages` branch of your fork and enable Pages. Serves at a subpath, which the relative rewrite handles. Entirely separate from upstream. |
| **Your own Cloudflare Pages project** | `wrangler pages deploy dist-wiki-preview --project-name <something-else>`. Same platform, different project — it cannot affect `open-historia`. |
| **A zip** | It is ~3 MB and self-contained, with a README.txt inside explaining what it is. |

Do **not** deploy it to the `open-historia` Cloudflare project or push to `upstream/main` to
preview — both publish to the live site.

---

## 5. Answering "does the wiki need updating?"

```
npm run wiki:check -- --fetch
```

(The `--` matters: without it npm keeps `--fetch` for itself and the script never sees it.) The
check reads a remote called `upstream`; in a clone of your fork, add it once with
`git remote add upstream https://github.com/Open-Historia/open-historia.git`.

`wiki/provenance.json` records the two commits the wiki was last verified against and, per page,
the source paths whose behaviour that page describes. The check diffs those commits against the
current tips of `upstream/main` and `upstream/beta`, maps the changed files onto the pages that
cite them, and prints a worklist plus the commit subjects behind it.

It exits non-zero when pages need review, so CI could gate on it, but the useful output is the
list.

**When you finish a pass, move `verifiedAgainst` forward to the commits you actually checked
against.** A stale record is worse than no record, because the next person will trust it.

The `pages` mapping is deliberately coarse: a page lists the files whose behaviour it describes,
not everything it transitively touches. A false positive costs a re-read; a false negative ships a
wrong page.

---

## 6. Editing rules

These rules are for the upstream markdown under `wiki/`. The catalog's own rules are in its
`README.md`.

**Two builds, kept distinct.** `main` is the stable build and `beta` runs ahead of it. The gap
moves: in September 2026 main absorbed almost all of beta in one stretch, and the wiki's
stable/beta split had to be rewritten page by page. Anything that exists only on beta must be
marked, either with a page-level `"beta": true` in `nav.json` (which renders a banner and a sidebar
chip) or with an inline `<p class="beta-note">` for a section. Never state a beta feature as though
everyone has it — and when a beta feature lands on main, take its marking off, rather than leaving
players to think they still need the beta for it. `git log --no-merges upstream/main..upstream/beta`
is the quickest list of what is beta-only right now.

**Verify against source, not against `docs/`.** These developer docs have drifted in places. Where
they disagree with the code, the code wins, and the wiki should follow the code.

**Do not invent numbers.** Every constant in the wiki should be traceable to a line of source. An
earlier draft claimed an exposed spy ring costs 20 relation points; no such constant exists.

**No ASCII mock-ups.** Do not draw UI layouts with box-drawing characters. Take a screenshot, or
describe it in prose. Code blocks are for commands and formulas.

**Captions go under images.** Markdown renders `![alt](src)` plus an italic line as one paragraph;
`wiki.css` forces both to blocks so a narrow crop does not put the caption beside the image.

---

## 7. Screenshots

Captured by driving the real app — with Electron, which is already a dependency, or with
Playwright's Chromium against `node server/server.js` and a `npm run build` in `dist/`. Headless
Chromium needs `--use-angle=swiftshader --enable-unsafe-swiftshader` to give MapLibre a WebGL
context.

**Never against the real data directory.** Copy `server/data/` somewhere scratch and launch with
`OH_DATA_DIR` pointed at the copy. A capture run against a live library can destroy save data.
Clear `ELECTRON_RUN_AS_NODE` first or the app exits instantly.

The shape that works:

1. `node server/server.js` with `OH_DATA_DIR` set, on a spare port.
2. An Electron `BrowserWindow` with **GPU enabled and `show: true`** — MapLibre renders blank
   offscreen with acceleration disabled — or headless Chromium with SwiftShader, as above.
3. Inject provider config into `localStorage` rather than typing it into the UI, so no key ever
   appears in a frame.
4. Drive by clicking buttons matched on their **exact label**, preferring `button` elements. A
   looser match once hit a card's "Current Game" eyebrow text instead of its "Current" button and
   photographed the main menu for an entire pass.
5. Crop to the panel by walking up from a text anchor inside it. The app styles almost everything
   inline, so there are no classes to select on.
6. Downscale to 1280px JPEG. Raw captures are ~2.4 MB each; `public/` ships inside the desktop
   installer, so weight here is weight in every download.

**Wait on the right signal.** Do not wait on text that is already on screen. `Exit Game` appears
long before the map is drawn, and the loading screen's caption is not in `innerText` at all. The
game broadcasts `oh:map-idle` from `mapReadiness.js` — use that, or a generous fixed wait (about
45 seconds for Modern Day under SwiftShader). Every page evaluation should have a
timeout; a hung call once left an orphaned Electron window fighting the next run for the same
server.

**The loading screen** covers the map until the renderer finishes dissolving polity surfaces,
which can outlast a short wait. Temporarily setting `<Presence open={false}>` in
`src/Game/GameUI/main.jsx` in a throwaway worktree gets past it — **revert it afterwards and
verify with `git status`**, and be aware that with it removed you can photograph a half-drawn map,
which is precisely what that screen exists to prevent. Use it for panel crops, not map shots.
There is one renderer now; the legacy one and its `map_legacy_renderer` key are gone.

**A new game with no key shows the setup prompt** over everything; **Not now** dismisses it for
the session. Pasting an obviously fake key into it fills the Models list without a request being
made — record that as staged.

**The capture machine's network shows up in the pictures.** The basemap is ESRI imagery from
`server.arcgisonline.com`, flags come from a CDN, and the Community tab reads GitHub. Where those
are unreachable the shot silently loses them — note it in `provenance.json` so the next pass knows
to retake.

**Staging is fine, and should be recorded.** Some states are impractical to reach honestly —
espionage detection is a per-jump roll of a few percent, and a populated Projects board needs a
dozen turns of events. Writing those records into the scratch save is legitimate: the shapes are
the engine's and the UI is real. Mark them `"staged": true` in `provenance.json` so a future
maintainer knows to replace them from a real campaign.

---

## 8. Adding a page

1. Write `wiki/<section>/<slug>.md`. Start at `##` — the `#` title comes from `nav.json`.
2. Add an entry to `wiki/nav.json` in reading order, with `slug`, `file`, `nav`, `title` and
   `description`. Add `"beta": true` if the whole page is a beta feature.
3. Add the page to `wiki/provenance.json` under `pages`, listing the source files it describes.
4. `npm run build:wiki`, then `npm run build:site` to confirm the assembler is happy.
5. Commit both `wiki/` and `public/wiki/`.

Slugs are permanent — they are the public URL. Changing one breaks inbound links.

A page added this way renders from its markdown, in English, until the help catalog gains a page
with the same route. From then on the catalog's text is shown in both languages and the markdown
stays as the record. Every page needs its `nav.json` entry and markdown file either way: the
build refuses a catalog page whose route `nav.json` does not list.

---

## 9. URL history

The wiki absorbed the old guides. `/get-started/`, `/how-to-play/`, `/ai-setup/`, `/self-hosting/`
and `/guides/` now 301 to their `/wiki/…` homes via `site/_redirects`, **and** keep stub pages
under `public/` — `_redirects` is Cloudflare-only, and the desktop app serves `public/` at its own
root where those rules do not exist.

`/pax-historia-alternative/` deliberately keeps its own URL: it is a keyword-targeted landing page
rather than wiki content.

One rule from `site/_redirects` worth not relearning: a rule whose target matches its own pattern
makes Cloudflare discard **the entire file**. Keep paths exact.

---

## 10. Known gaps

The list below is about the upstream pages and their screenshots. The catalog pages carry no
screenshots, and `public/wiki/img/` is still copied from `wiki/img/` for the upstream pages.

Kept current in `wiki/provenance.json` and printed by `npm run wiki:check`. At the time of
writing: the September 2026 map screenshots have no basemap imagery; there are no screenshots of
Intervene, interactive events, group polls, document notices or any beta-only surface; the content
screenshots predate the current palette; no screenshot of a held time-skip segment or a held
Projects board (both are in-memory pending state that cannot be authored into a save); and neither
build was verified by playing a campaign through turns.
