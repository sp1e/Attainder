import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
import argparse
import os
from urllib.parse import quote

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--repo', type=Path, default=ROOT)
parser.add_argument('--output', type=Path, required=True, help='Explicit destination HTML file')
args = parser.parse_args()
ROOT = args.repo.resolve()
target = args.output.resolve()
target.parent.mkdir(parents=True, exist_ok=True)
public_base = quote(Path(os.path.relpath(ROOT / 'public', target.parent)).as_posix(), safe='/.:')
guide = quote(Path(os.path.relpath(ROOT / 'README.md', target.parent)).as_posix(), safe='/.:')

people = json.loads((ROOT / 'src/runtime/characters/portrait-manifest.json').read_text(encoding='utf-8'))['people']
cards = []
for person in people:
    name, family, archetype = [html.escape(person[key]) for key in ('name', 'family', 'archetype')]
    src = f"__PUBLIC_BASE__/dynasties/portraits/{person['portraitId']}.png"
    cards.append(f'<button class="portrait" data-family="{family}" data-name="{name}" aria-label="Öppna porträtt av {name}"><img src="{src}" alt="Målat porträtt av {name}" width="1008" height="1344"><span class="caption"><small>{family} · {person["age"]} år</small><strong>{name}</strong><span>{archetype}</span></span></button>')

page = '''<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Hadara · karaktärsgalleri</title>
<script>try{document.documentElement.dataset.theme=localStorage.getItem('hadara-gallery-theme')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light')}catch{document.documentElement.dataset.theme='light'}</script>
<style>
:root{color-scheme:light;--bg:#f1ece1;--card:#fffaf0;--text:#29251e;--muted:#675d4d;--line:#c6b998;--accent:#77501e;--button:#e7decb}
:root[data-theme=dark]{color-scheme:dark;--bg:#161a18;--card:#202722;--text:#f3e9d4;--muted:#c4bba9;--line:#59614f;--accent:#dfb875;--button:#303a31}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.5 system-ui,sans-serif}main{max-width:1440px;margin:auto;padding:40px}header{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;border-bottom:1px solid var(--line);padding-bottom:24px}.eyebrow{font-size:12px;letter-spacing:.15em;color:var(--accent);text-transform:uppercase}h1{font:clamp(34px,4vw,56px)/1.05 Georgia,serif;margin:12px 0 16px}p{color:var(--muted);max-width:66ch;margin:0}button{font:inherit;cursor:pointer}button:focus-visible{outline:3px solid var(--accent);outline-offset:4px}.theme,nav button,.close{background:var(--button);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:10px 16px}.theme{white-space:nowrap}nav{display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:24px 0}nav button[aria-pressed=true]{background:var(--accent);color:var(--bg)}#count{color:var(--muted);margin-left:auto;font-size:14px}.grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:20px}.portrait{text-align:left;padding:0;background:var(--card);color:var(--text);border:1px solid var(--line);border-radius:8px;overflow:hidden;transition:transform .15s}.portrait:hover{transform:translateY(-3px)}.portrait img{display:block;width:100%;height:auto;aspect-ratio:3/4;object-fit:cover}.caption{display:grid;gap:3px;padding:14px}.caption small{color:var(--accent);font-size:11px;letter-spacing:.06em}.caption strong{font:19px Georgia,serif}.caption>span{font-size:12px;color:var(--muted)}[hidden]{display:none!important}footer{margin-top:30px;padding-top:20px;border-top:1px solid var(--line);font-size:13px;color:var(--muted)}footer a{color:var(--accent)}dialog{background:var(--card);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:16px;max-width:95vw;max-height:95vh}dialog::backdrop{background:#000b}dialog img{display:block;max-height:75vh;max-width:80vw;height:auto;width:auto;margin:0 auto 12px}dialog .meta{display:flex;gap:20px;align-items:center;justify-content:space-between}dialog h2{font:24px Georgia,serif;margin:0}@media(max-width:1100px){.grid{grid-template-columns:repeat(4,minmax(0,1fr))}}@media(max-width:720px){main{padding:22px 16px}.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}header{display:block}.theme{margin-top:20px}.caption{padding:10px}.caption strong{font-size:17px}#count{width:100%;margin-left:0}dialog .meta{flex-wrap:wrap}}@media(prefers-reduced-motion:reduce){.portrait{transition:none}}
</style></head><body><main><header><div><div class="eyebrow">Hadara · Antika dynastier · 300 f.Kr.</div><h1>Människorna bakom riket</h1><p>Fyra familjer, 24 personer. Porträtt skapade i OpenArt för den första kampanjen i Open Historia: Dynastier.</p></div><button class="theme" id="theme" type="button">Ljust / mörkt</button></header><nav aria-label="Filtrera familj"><button aria-pressed="true" data-filter="Alla">Alla</button><button aria-pressed="false" data-filter="Arel">Arel</button><button aria-pressed="false" data-filter="Namar">Namar</button><button aria-pressed="false" data-filter="Eshmun">Eshmun</button><button aria-pressed="false" data-filter="Safra">Safra</button><span id="count" aria-live="polite">24 porträtt</span></nav><section class="grid" aria-label="Karaktärsporträtt">CARDS</section><footer>Originalpersoner i ett fiktivt antikt rike. Modell: GPT Image 2.5 Sunburst via OpenArt, 30 oktober 2026. <a href="__PUBLIC_BASE__/dynasties/ARTWORK.md">Bilddokumentation</a> · <a href="__GUIDE__">Spelguide</a></footer></main><dialog id="detail"><img id="large" alt=""><div class="meta"><h2 id="person-name"></h2><button class="close" type="button">Stäng porträtt</button></div></dialog><script>
const theme=document.querySelector('#theme');theme.addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;try{localStorage.setItem('hadara-gallery-theme',next)}catch{}});
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-filter]').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));let count=0;document.querySelectorAll('.portrait').forEach(card=>{card.hidden=button.dataset.filter!=='Alla'&&card.dataset.family!==button.dataset.filter;if(!card.hidden)count++});document.querySelector('#count').textContent=count+' porträtt'}));
const detail=document.querySelector('#detail');document.querySelectorAll('.portrait').forEach(card=>card.addEventListener('click',()=>{const img=card.querySelector('img');document.querySelector('#large').src=img.src;document.querySelector('#large').alt=img.alt;document.querySelector('#person-name').textContent=card.dataset.name;detail.showModal()}));document.querySelector('.close').addEventListener('click',()=>detail.close());detail.addEventListener('click',event=>{if(event.target===detail){const rect=detail.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)detail.close()}});
</script></body></html>'''.replace('CARDS', ''.join(cards))
target.write_text(page.replace('__PUBLIC_BASE__', public_base).replace('__GUIDE__', guide), encoding='utf-8')
print('Gallery built: 24 original OpenArt portraits.')
