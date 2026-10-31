import json
from pathlib import Path
from playwright.sync_api import sync_playwright

import argparse

parser = argparse.ArgumentParser(description='Verify a previously built local portrait gallery.')
parser.add_argument('--gallery', type=Path, required=True)
parser.add_argument('--output-dir', type=Path, required=True, help='Private QA artifacts directory')
args = parser.parse_args()
GALLERY = args.gallery.resolve(strict=True)
OUT = args.output_dir.resolve()
OUT.mkdir(parents=True, exist_ok=True)
checks = []
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 1000}, color_scheme='light')
    page.route('**/*', lambda route: route.continue_() if route.request.url.startswith(('file:', 'data:')) else route.abort())
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(GALLERY.as_uri(), wait_until='load')
    assert page.locator('.portrait').count() == 24
    assert page.locator('.portrait img').evaluate_all('(images) => images.every(image => image.complete && image.naturalWidth === 1008)')
    assert page.locator('html').get_attribute('data-theme') == 'light'
    checks.append('24 PNG originals loaded; system light theme respected')
    page.screenshot(path=str(OUT / 'gallery-light.png'), full_page=True)
    page.get_by_role('button', name='Ljust / mörkt').focus()
    page.keyboard.press('Enter')
    assert page.locator('html').get_attribute('data-theme') == 'dark'
    page.screenshot(path=str(OUT / 'gallery-dark.png'), full_page=True)
    page.reload(wait_until='load')
    assert page.locator('html').get_attribute('data-theme') == 'dark'
    checks.append('Keyboard theme toggle and explicit theme persistence pass')
    page.get_by_role('button', name='Namar', exact=True).click()
    assert page.locator('.portrait:visible').count() == 6
    page.locator('.portrait:visible').first.click()
    assert page.get_by_role('dialog').is_visible()
    page.keyboard.press('Escape')
    assert not page.get_by_role('dialog').is_visible()
    checks.append('Family filter and keyboard-dismissable full portrait pass')
    page.get_by_role('button', name='Alla', exact=True).click()
    page.set_viewport_size({'width': 390, 'height': 844})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(OUT / 'gallery-mobile.png'))
    checks.append('390px mobile layout has no horizontal overflow')
    assert not errors, errors
    browser.close()
(OUT / 'verification.json').write_text(json.dumps({'status': 'passed', 'checks': checks, 'pageErrors': errors}, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'status': 'passed', 'checks': checks}, ensure_ascii=False))
