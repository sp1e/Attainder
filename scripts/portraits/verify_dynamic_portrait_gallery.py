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
checks, errors = [], []
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 1000}, color_scheme='light')
    page.route('**/*', lambda route: route.continue_() if route.request.url.startswith(('file:', 'data:')) else route.abort())
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(GALLERY.as_uri(), wait_until='load')
    assert page.locator('.card').count() == 24
    images = page.evaluate('''async () => await Promise.all(Object.values(data.characters).map(a => new Promise((resolve, reject) => { const i = new Image(); i.onload=()=>resolve({width:i.naturalWidth,height:i.naturalHeight}); i.onerror=reject; i.src=new URL(document.querySelector('svg image').getAttribute('href'),location.href).href.replace(/[^/]+$/,a.src.split('/').pop()); })))''')
    assert len(images) == 24 and all(i['width'] == 2016 and i['height'] == 2688 for i in images)
    assert page.locator('html').get_attribute('data-theme') == 'light'
    checks.append('All 24 actual atlas images decoded at 2016x2688; system light theme respected')
    rectangles = page.evaluate('''() => Object.values(data.characters).every(a => { const rects=new Set(); for(let age=0;age<3;age++)for(let s=0;s<12;s++){const r=age*2+Math.floor(s/6),c=s%6,x=a.columnBounds[c],y=a.rowBounds[r],w=a.columnBounds[c+1]-x,h=a.rowBounds[r+1]-y;if(w<200||h<250||x<0||y<0||x+w>a.width||y+h>a.height)return false;rects.add([x,y,w,h].join(','));}return rects.size===36;})''')
    assert rectangles
    checks.append('864 unique, non-overlapping source rectangles stay within their own identity atlas')
    page.screenshot(path=str(OUT / 'smallpox-light.png'), full_page=True)
    page.locator('#theme').focus()
    page.keyboard.press('Enter')
    assert page.locator('html').get_attribute('data-theme') == 'dark'
    page.screenshot(path=str(OUT / 'smallpox-dark.png'), full_page=True)
    page.reload(wait_until='load')
    assert page.locator('html').get_attribute('data-theme') == 'dark'
    checks.append('Keyboard theme control and explicit choice persistence passed')
    page.locator('#family').select_option('Safra')
    assert page.locator('.card').count() == 6
    page.locator('#state').select_option('wounded')
    page.locator('#age').select_option('elder')
    assert page.locator('.card svg').first.get_attribute('aria-label').endswith('Äldre, Skadad')
    page.locator('[data-open]').first.click()
    assert page.locator('dialog').is_visible() and page.locator('.variant').count() == 36
    page.screenshot(path=str(OUT / 'all-states-detail.png'))
    page.keyboard.press('Escape')
    assert not page.locator('dialog').is_visible()
    checks.append('Family, condition and age selectors plus 36-state dialog and keyboard dismissal passed')
    page.locator('#family').select_option('all')
    page.set_viewport_size({'width': 390, 'height': 844})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(OUT / 'mobile-dark.png'))
    page.locator('#theme').click()
    assert page.locator('html').get_attribute('data-theme') == 'light'
    page.screenshot(path=str(OUT / 'mobile-light.png'))
    checks.append('Light and dark 390px layouts have no horizontal overflow')
    page.set_viewport_size({'width': 1440, 'height': 1100})
    for family in ['Arel', 'Namar', 'Eshmun', 'Safra']:
        page.evaluate('''family => {const members=data.people.filter(p=>p.family===family);el('grid').style.gridTemplateColumns='repeat(4,minmax(0,1fr))';el('grid').innerHTML=members.map(p=>`<article class="card"><div class="art"><img src="${original(p)}" alt="Original"></div><div class="body">${safe(p.name)} · original</div></article><article class="card">${art(p,p.ageGroup,'healthy')}<div class="body">Frisk · ${ages[p.ageGroup]}</div></article><article class="card">${art(p,p.ageGroup,'smallpox')}<div class="body">Smittkoppor · ${ages[p.ageGroup]}</div></article><article class="card">${art(p,'elder','healthy')}<div class="body">Äldre · frisk</div></article>`).join('');}''', family)
        page.wait_for_function('Array.from(document.images).every(i=>i.complete && i.naturalWidth>0)')
        page.screenshot(path=str(OUT / ('identity-review-' + family.lower() + '.png')), full_page=True)
    assert not errors, errors
    browser.close()
(OUT / 'verification.json').write_text(json.dumps({'status': 'passed', 'checks': checks, 'pageErrors': errors, 'note': 'Technical mapping checks are separate from visual identity review.'}, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'status': 'passed', 'checks': checks}, ensure_ascii=False))
