"""Bounded checks for the offline research/design reader, using installed Playwright."""
from datetime import datetime, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import unquote, urlsplit, quote
import json
import argparse
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--reader', type=Path, required=True, help='Existing reader HTML to inspect')
parser.add_argument('--qa-dir', type=Path, required=True, help='New private QA directory outside the repository')
args = parser.parse_args()
READER = args.reader.resolve()
ROOT = READER.parent
QA = args.qa_dir.resolve()
REPOSITORY = Path(__file__).resolve().parents[2]
if not READER.is_file():
    parser.error('Reader file does not exist.')
if QA.is_relative_to(REPOSITORY) or QA.exists():
    parser.error('QA directory must be new and outside the repository.')
QA.mkdir(parents=True)
EXPECTED_CHAPTERS = [
    'overview', 'ck3', 'oldworld', 'events', 'foundation', 'installed', 'skills',
    'systemdesign', 'acceptance', 'glossary', 'rulesreview', 'integration',
]
SCOPE = 'Endast den lokala läsaren för research och systemdesign. Ingen spelimplementation eller spelmekanik testades. Inte en fullständig tillgänglighetsgranskning.'


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def set_theme(page, mode):
    if page.locator('html').get_attribute('data-theme') != mode:
        page.locator('#theme').click()
    assert page.locator('html').get_attribute('data-theme') == mode


def write_report(status, checks, **extra):
    report = {
        'status': status,
        'checkedAt': datetime.now(timezone.utc).isoformat(),
        'chapters': len(EXPECTED_CHAPTERS),
        'checks': checks,
        'scope': SCOPE,
        **extra,
    }
    (QA / 'verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    return report


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{server.server_port}/{quote(READER.name)}'
checks, errors, contrast = [], [], {}
write_report('running', checks)
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={'width': 1440, 'height': 1050}, color_scheme='light', service_workers='block')
        ctx.route('**/*', lambda route: route.continue_() if urlsplit(route.request.url).netloc == urlsplit(url).netloc else route.abort())
        page = ctx.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(url, wait_until='networkidle')
        assert page.locator('html').get_attribute('data-theme') == 'light'
        chapter_ids = page.locator('article.chapter').evaluate_all('(nodes) => nodes.map(n => n.id)')
        assert chapter_ids == EXPECTED_CHAPTERS, chapter_ids
        assert page.locator('nav a').evaluate_all('(nodes) => nodes.map(n => n.hash)') == ['#' + key for key in EXPECTED_CHAPTERS]
        assert page.locator('.design-status[aria-label="Designens status"]').inner_text().startswith('Specificerat, ej implementerat.')
        for chapter in EXPECTED_CHAPTERS:
            assert page.locator(f'#{chapter} h2').count() >= 1, chapter
            assert len(page.locator(f'#{chapter}').inner_text()) > 200, chapter
        checks.append('Alla sju researchkapitel och fem designkapitel finns i rätt ordning; statusen anger specificerat, ej implementerat.')
        page.screenshot(path=str(QA / 'research-light.png'), full_page=False)

        page.locator('#theme').focus()
        page.keyboard.press('Enter')
        assert page.locator('html').get_attribute('data-theme') == 'dark'
        page.reload(wait_until='networkidle')
        assert page.locator('html').get_attribute('data-theme') == 'dark'
        checks.append('Tangentbordsväxling mellan teman fungerar och det uttryckliga valet bevaras efter omladdning.')
        page.screenshot(path=str(QA / 'research-dark.png'), full_page=False)
        page.emulate_media(color_scheme='light')
        assert page.locator('html').get_attribute('data-theme') == 'dark'
        page.locator('#system').click()
        assert page.locator('html').get_attribute('data-theme') == 'light'
        assert page.locator('#system').get_attribute('aria-pressed') == 'true'
        page.emulate_media(color_scheme='dark')
        page.wait_for_function("document.documentElement.dataset.theme === 'dark'")
        fresh = browser.new_context(color_scheme='dark', service_workers='block')
        fresh.route('**/*', lambda route: route.continue_() if urlsplit(route.request.url).netloc == urlsplit(url).netloc else route.abort())
        dark_page = fresh.new_page()
        dark_page.on('pageerror', lambda error: errors.append(str(error)))
        dark_page.goto(url, wait_until='networkidle')
        assert dark_page.locator('html').get_attribute('data-theme') == 'dark'
        fresh.close()
        checks.append('Systemets ljusa/mörka förval fungerar; sparat val har företräde och knappen Följ systemet återställer dynamisk följning.')

        broken = page.evaluate('''() => [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href')).filter(h => !document.getElementById(h.slice(1)))''')
        assert not broken, broken
        ids = page.locator('[id]').evaluate_all('(nodes) => nodes.map(n => n.id)')
        assert len(ids) == len(set(ids)), 'Duplicate HTML ids.'
        leftovers = page.locator('main').inner_text().count('](')
        assert leftovers == 0, f'Unrendered Markdown links: {leftovers}'
        local_links = page.locator('a[href]').evaluate_all('''nodes => nodes.map(n => n.getAttribute('href')).filter(h => !h.startsWith('#') && !/^https?:/.test(h))''')
        for href in local_links:
            target = (ROOT / unquote(urlsplit(href).path)).resolve()
            assert target.is_relative_to(ROOT), f'Local link leaves deliverable root: {href}'
            assert target.exists(), f'Missing local link: {href}'
        checks.append('Samtliga interna kapitel-/rubriklänkar och lokala fillänkar har giltiga mål; inga dubblett-id:n eller råa Markdown-länkar återstår.')

        for mode in ['light', 'dark']:
            set_theme(page, mode)
            metrics = page.evaluate('''() => {
                const s = getComputedStyle(document.documentElement);
                function lum(name) {
                    const v = s.getPropertyValue(name).trim().slice(1);
                    const c = [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
                    return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
                }
                const pairs = [['--ink','--surface'], ['--muted','--surface'], ['--accent','--surface'], ['--ink','--bg'], ['--head','--accent-bg'], ['--ink','--accent-bg'], ['--ink','--code']];
                return pairs.map(([foreground, background]) => {
                    const fg = lum(foreground), bg = lum(background);
                    return {foreground, background, ratio: (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05)};
                });
            }''')
            assert all(metric['ratio'] >= 4.5 for metric in metrics), (mode, metrics)
            contrast[mode] = metrics
            page.locator('#systemdesign').scroll_into_view_if_needed()
            page.screenshot(path=str(QA / f'design-{mode}.png'), full_page=False)
        checks.append('Text, länkar, statusruta, tabellrubriker och kodtext når minst 4,5:1 för de kontrollerade färgparen i båda teman.')

        page.set_viewport_size({'width': 390, 'height': 844})
        page.goto(url, wait_until='networkidle')
        for mode in ['light', 'dark']:
            set_theme(page, mode)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'Mobile document overflows in {mode}.'
            assert page.locator('table').count() == page.locator('.table-scroll > table').count()
            assert page.evaluate("[...document.querySelectorAll('.table-scroll')].every(el => getComputedStyle(el).overflowX === 'auto')")
            page.screenshot(path=str(QA / f'research-mobile-{mode}.png'), full_page=False)
            if mode == 'dark':
                page.screenshot(path=str(QA / 'research-mobile.png'), full_page=False)
            page.locator('#acceptance').scroll_into_view_if_needed()
            page.screenshot(path=str(QA / f'acceptance-mobile-{mode}.png'), full_page=False)
            page.evaluate('scrollTo(0, 0)')
            page.wait_for_function('scrollY === 0')
        checks.append('Mobilvy 390 px fungerar i båda teman utan sidövergripande horisontell rullning; tabeller har egna rullningsytor.')
        assert not errors, errors
        checks.append('Inga JavaScript-fel rapporterades av webbläsaren.')
        browser.close()
    report = write_report('passed', checks, contrast=contrast)
    print(json.dumps(report, ensure_ascii=True))
except Exception as error:
    write_report('failed', checks, error=str(error), browserErrors=errors, contrast=contrast)
    raise
finally:
    server.shutdown()
    server.server_close()
