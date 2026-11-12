import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { buildWikiFiles, runWikiBuild } from '../../scripts/build-wiki.mjs';
import { clientScript } from '../../scripts/wiki/clientScript.mjs';
import {
  HELP_LANGUAGES, LANGUAGE_NAMES, WikiBuildError, bilingual, decideHelpLanguage, escapeHtml,
  headLanguageScript, loadHelpCatalog,
} from '../../scripts/wiki/helpCatalog.mjs';
import { LANGUAGES } from './i18n.js';

// The help pages under public/wiki/ are generated and committed. These tests read the
// committed files, so a catalog edit without a rebuild fails here.

const root = fileURLToPath(new URL('../../', import.meta.url));
const helpDir = path.join(root, 'public', 'lang', 'attainder', 'help');
const catalog = loadHelpCatalog(helpDir);
const manifest = JSON.parse(fs.readFileSync(path.join(helpDir, 'manifest.json'), 'utf8'));

// "/wiki/" is public/wiki/index.html; "/wiki/time/" is public/wiki/time/index.html.
// Read with CRLF folded: a checkout with core.autocrlf has CRLF in the working copy.
const committedPage = (route) => fs.readFileSync(path.join(root, 'public', route, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const count = (text, part) => text.split(part).length - 1;
const committedRoutes = () => JSON.parse(fs.readFileSync(path.join(root, 'wiki', 'nav.json'), 'utf8'))
  .sections.flatMap((section) => section.pages.map((page) => `/wiki/${page.slug}/`)).concat('/wiki/');

test('the committed wiki and sitemap are what a fresh build gives', () => {
  const { differences } = runWikiBuild({ check: true });
  assert.deepEqual(differences, [], 'run `npm run build:wiki` and commit public/wiki/');
});

test('every catalog page is rendered in Swedish and English with shared section ids', () => {
  assert.equal(manifest.pages.length, manifest.counts.pages);
  for (const entry of manifest.pages) {
    const page = catalog.pages.get(entry.route);
    const html = committedPage(entry.route);
    assert.ok(html.includes(`<h1>${bilingual(page.title)}</h1>`), `${entry.route}: both titles in the heading`);
    for (const lang of HELP_LANGUAGES) {
      assert.ok(html.includes(` data-title-${lang}="${escapeHtml(page.title[lang])}`), `${entry.route}: ${lang} document title`);
    }
    for (const section of page.sections) {
      // The id sits once, on the wrapper; each language has one rendering inside it.
      assert.equal(count(html, `<section id="${section.id}" class="help-section">`), 1, `${entry.route}#${section.id}`);
      for (const lang of HELP_LANGUAGES) {
        const rendering = `<div data-help-lang="${lang}" lang="${lang}" data-help-section="${section.id}">\n<h2>${escapeHtml(section.title[lang])}</h2>`;
        assert.equal(count(html, rendering), 1, `${entry.route}#${section.id} in ${lang}`);
      }
    }
    const ids = [...html.matchAll(/\sid="([^"]*)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, `${entry.route}: an id is used twice`);
    for (const id of page.sections.map((section) => section.id)) assert.ok(ids.includes(id));
  }
});

test('every page carries the upstream legal notice in both languages and the upstream attribution', () => {
  const legal = catalog.shell['upstream-legal-notice'];
  for (const route of committedRoutes()) {
    const html = committedPage(route);
    for (const lang of HELP_LANGUAGES) {
      assert.equal(count(html, `<p class="foot-legal" data-help-lang="${lang}" lang="${lang}">${escapeHtml(legal[lang])}</p>`), 1, `${route} ${lang}`);
    }
    assert.match(html, /<b>Open Historia<\/b>/, route);
    assert.ok(html.includes('AGPL-3.0 licensed') && html.includes('Licensierat enligt AGPL-3.0'), route);
  }
});

test('the search index has one Swedish and one English entry per page', () => {
  const index = JSON.parse(fs.readFileSync(path.join(root, 'public', 'wiki', 'search-index.json'), 'utf8'));
  const routes = committedRoutes();
  assert.equal(index.length, routes.length * HELP_LANGUAGES.length);
  for (const route of routes) {
    for (const lang of HELP_LANGUAGES) {
      const entries = index.filter((entry) => entry.url === route && entry.lang === lang);
      assert.equal(entries.length, 1, `${route} ${lang}`);
      const page = catalog.pages.get(route);
      if (!page) continue;
      assert.equal(entries[0].title, page.title[lang]);
      assert.ok(entries[0].haystack.includes(page.sections[0].title[lang].toLowerCase()), `${route} ${lang}: section titles are searchable`);
    }
  }
});

test('the language follows Options, and the page\'s own switch wins', () => {
  assert.equal(decideHelpLanguage(null, 'en'), 'en');
  for (const game of [null, undefined, '', 'sv', 'de', 'EN']) {
    assert.equal(decideHelpLanguage(null, game), 'sv', String(game));
  }
  assert.equal(decideHelpLanguage('sv', 'en'), 'sv');
  assert.equal(decideHelpLanguage('en', 'sv'), 'en');
  assert.equal(decideHelpLanguage('en', null), 'en');
  // A value the switch never writes is no choice, so the game's stands.
  assert.equal(decideHelpLanguage('de', 'en'), 'en');
  assert.equal(decideHelpLanguage(' en ', null), 'en', 'trimmed like the game\'s own reader');
});

// Runs the script of <head> against a stand-in for the page.
const runHeadScript = (localStorage) => {
  const attributes = { 'data-title-sv': 'Svensk titel', 'data-title-en': 'English title' };
  const documentElement = {
    lang: 'sv',
    setAttribute(name, value) { attributes[name] = value; },
    getAttribute(name) { return attributes[name] ?? null; },
  };
  const document = { documentElement, title: 'Svensk titel' };
  const sandbox = { document };
  Object.defineProperty(sandbox, 'localStorage', localStorage);
  vm.runInNewContext(headLanguageScript(), sandbox);
  return { lang: documentElement.lang, shown: attributes['data-help-lang'], title: document.title };
};
const storageWith = (values) => ({ value: { getItem: (key) => values[key] ?? null } });

test('the head script sets the language and the title before the page is drawn', () => {
  assert.deepEqual(runHeadScript(storageWith({ ui_language: 'en' })), { lang: 'en', shown: 'en', title: 'English title' });
  assert.deepEqual(runHeadScript(storageWith({})), { lang: 'sv', shown: 'sv', title: 'Svensk titel' });
  assert.deepEqual(runHeadScript(storageWith({ ui_language: 'en', wiki_language: 'sv' })), { lang: 'sv', shown: 'sv', title: 'Svensk titel' });
  // Blocked storage throws on access; the page then reads Swedish.
  const blocked = { get() { throw new Error('storage is blocked'); } };
  assert.deepEqual(runHeadScript(blocked), { lang: 'sv', shown: 'sv', title: 'Svensk titel' });
  // The committed pages run this exact script.
  assert.ok(committedPage('/wiki/').includes(`<script>\n${headLanguageScript()}\n  </script>`));
});

test('the switch is two buttons named as in the game\'s language list', () => {
  for (const lang of HELP_LANGUAGES) {
    assert.equal(LANGUAGE_NAMES[lang], LANGUAGES.find((entry) => entry.code === lang).native);
  }
  const html = committedPage('/wiki/time/');
  // Written twice, in the header and above the search box; the stylesheet shows one.
  const buttons = '<button type="button" data-help-set="sv" lang="sv" aria-pressed="true">Svenska</button>'
    + '<button type="button" data-help-set="en" lang="en" aria-pressed="false">English</button>';
  for (const place of ['header', 'side']) {
    assert.equal(count(html, `<div class="lang-switch lang-switch-${place}" role="group">${buttons}</div>`), 1, place);
  }
  assert.equal(count(html, '<button'), 4);
  assert.match(html, /^<!doctype html>\n<html lang="sv" data-help-lang="sv"/, 'Swedish without script');
});

// A stand-in for the parts of a page the script at its end touches. It proves the script's
// logic; how the page looks and scrolls is checked in a browser.
const fakePage = (index) => {
  const element = (attributes = {}) => {
    const listeners = {};
    return {
      listeners,
      getAttribute: (name) => attributes[name] ?? null,
      setAttribute(name, value) { attributes[name] = value; },
      addEventListener(type, listener) { listeners[type] = listener; },
      contains: () => false,
    };
  };
  const root = Object.assign(element({ 'data-help-lang': 'sv', 'data-title-sv': 'Svensk titel', 'data-title-en': 'English title' }), { lang: 'sv' });
  const buttons = HELP_LANGUAGES.map((lang) => element({ 'data-help-set': lang, 'aria-pressed': String(lang === 'sv') }));
  const input = Object.assign(element(), { value: '', placeholder: '' });
  const list = Object.assign(element(), { hidden: true, innerHTML: '' });
  const stored = {};
  const document = {
    documentElement: root,
    title: 'Svensk titel',
    addEventListener() {},
    getElementById: (id) => ({ wikiSearch: input, wikiResults: list })[id] ?? null,
    querySelectorAll: (selector) => (selector === '[data-help-set]' ? buttons : []),
  };
  vm.runInNewContext(clientScript(catalog.shell), {
    document,
    window: {},
    localStorage: { setItem(key, value) { stored[key] = value; } },
    fetch: () => Promise.resolve({ json: () => Promise.resolve(index) }),
  });
  const search = async (words) => {
    input.value = words;
    input.listeners.focus();
    await new Promise((resolve) => { setImmediate(resolve); });
    input.listeners.input();
    return list.innerHTML;
  };
  return { root, buttons, input, document, stored, search, press: (button) => button.listeners.click.call(button) };
};

test('the switch changes the language without a reload and the search follows it', async () => {
  const index = JSON.parse(fs.readFileSync(path.join(root, 'public', 'wiki', 'search-index.json'), 'utf8'));
  const page = fakePage(index);
  const espionage = catalog.pages.get('/wiki/espionage/').title;
  assert.equal(page.input.placeholder, catalog.shell['search-placeholder'].sv);
  assert.ok((await page.search('spionage')).includes(espionage.sv));
  assert.ok((await page.search('intercepted')).includes(catalog.shell['no-matches'].sv), 'an English word finds nothing in Swedish');

  page.press(page.buttons[1]);
  assert.equal(page.root.lang, 'en');
  assert.equal(page.root.getAttribute('data-help-lang'), 'en');
  assert.equal(page.document.title, 'English title');
  assert.deepEqual(page.buttons.map((button) => button.getAttribute('aria-pressed')), ['false', 'true']);
  assert.equal(page.input.placeholder, catalog.shell['search-placeholder'].en);
  assert.equal(page.input.getAttribute('aria-label'), catalog.shell['search-label'].en);
  // The page's own key only: the game's choice in Options is not changed from the wiki.
  assert.deepEqual(page.stored, { wiki_language: 'en' });
  assert.ok((await page.search('intercepted')).includes(espionage.en));
  assert.ok((await page.search('avlyssningsrapporter')).includes(catalog.shell['no-matches'].en), 'a Swedish word finds nothing in English');

  page.press(page.buttons[0]);
  assert.equal(page.document.title, 'Svensk titel');
  assert.deepEqual(page.stored, { wiki_language: 'sv' });
});

// The catalog on disk covers every page, so the upstream path is exercised with a copy of
// the catalog that lacks one.
const catalogWithout = (route) => ({ ...catalog, pages: new Map([...catalog.pages].filter(([key]) => key !== route)) });

test('a page the catalog lacks keeps its upstream markdown, marked as English', () => {
  const built = buildWikiFiles({ catalog: catalogWithout('/wiki/cheats/') });
  assert.deepEqual(built.upstreamPages, ['/wiki/cheats/']);
  const html = built.files.get('public/wiki/cheats/index.html');
  assert.ok(html.includes('<main class="wiki-main" lang="en">'));
  assert.ok(html.includes('<h1>Cheats and the Game Master Console</h1>'));
  assert.ok(html.includes('<title>Cheats and the Game Master Console — Open Historia Wiki</title>'));
  assert.ok(!html.includes('data-title-sv'), 'the title of an English page is not switched');
  assert.ok(html.includes('Last checked against the game on <b>'));
  assert.ok(html.includes(escapeHtml(catalog.shell['upstream-legal-notice'].sv)));
  // Its sidebar label is the upstream one on every page; its neighbours keep both languages.
  const other = built.files.get('public/wiki/saves/index.html');
  assert.ok(other.includes('<li><a href="/wiki/cheats/" lang="en">Cheats &amp; GM console</a></li>'));
  assert.ok(other.includes(`<li><a href="/wiki/settings/">${bilingual(catalog.pages.get('/wiki/settings/').nav)}</a></li>`));
  const index = JSON.parse(built.files.get('public/wiki/search-index.json'));
  const entries = index.filter((entry) => entry.url === '/wiki/cheats/');
  assert.deepEqual(entries.map((entry) => entry.lang), HELP_LANGUAGES);
  assert.equal(entries[0].haystack, entries[1].haystack, 'the English text is listed under both languages');
});

test('a catalog link to a page or a section that does not exist fails the build', () => {
  const withBody = (body) => {
    const pages = new Map(catalog.pages);
    const page = structuredClone(pages.get('/wiki/time/'));
    page.sections[0].body.en = body;
    pages.set('/wiki/time/', page);
    return { ...catalog, pages };
  };
  assert.throws(() => buildWikiFiles({ catalog: withBody('See [nothing](/wiki/no-such-page/).') }),
    (error) => error instanceof WikiBuildError && /Broken wiki link .*\/wiki\/no-such-page\//.test(error.message));
  assert.throws(() => buildWikiFiles({ catalog: withBody('See [saves](/wiki/saves/#no-such-section).') }),
    (error) => error instanceof WikiBuildError && /\/wiki\/saves\/#no-such-section/.test(error.message));
  assert.doesNotThrow(() => buildWikiFiles({ catalog: withBody('See [saves](/wiki/saves/#storage-and-undo).') }));
});
