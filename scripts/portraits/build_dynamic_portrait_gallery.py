"""Build an offline gallery from original, unmodified OpenArt atlas assets."""
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

CORE = ROOT / 'src/runtime/characters'
data = json.loads((CORE / 'portrait-atlases.json').read_text(encoding='utf-8'))
data['people'] = json.loads((CORE / 'portrait-manifest.json').read_text(encoding='utf-8'))['people']
template = r'''<!doctype html>
<html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dynastier · levande porträtt</title>
<style>
:root{color-scheme:light;--bg:#f4efe4;--surface:#fffbf2;--ink:#28251f;--muted:#635c4e;--line:#c9bda7;--accent:#78552b;--shadow:#51412522}
:root[data-theme=dark]{color-scheme:dark;--bg:#171b1b;--surface:#222827;--ink:#eee6d6;--muted:#c1b8a5;--line:#52594e;--accent:#dbb77a;--shadow:#0007}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,sans-serif;line-height:1.55}
header,main,footer{max-width:1480px;margin:auto;padding:24px}header{padding-top:36px}h1,h2,h3{font-family:Georgia,serif;font-weight:500;line-height:1.12}h1{font-size:clamp(36px,5vw,64px);margin:8px 0 14px}h2{font-size:29px}h3{font-size:22px;margin:12px 0 4px}
.eyebrow{color:var(--accent);font-size:12px;letter-spacing:.2em;text-transform:uppercase}.intro{max-width:880px;color:var(--muted);margin:0}.topline{display:flex;justify-content:space-between;align-items:center;gap:20px}.controls{display:flex;flex-wrap:wrap;gap:18px;margin:26px 0 8px;padding:20px;background:var(--surface);border:1px solid var(--line);border-radius:12px}
label{display:grid;gap:6px;font-size:13px;color:var(--muted)}select,button{font:inherit;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:7px;padding:10px 14px}button,select{cursor:pointer}button:hover{border-color:var(--accent)}:focus-visible{outline:3px solid var(--accent);outline-offset:3px}a{color:var(--accent)}
.count{color:var(--muted);font-size:13px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:24px}.card{background:var(--surface);border:1px solid var(--line);border-radius:12px;overflow:hidden;box-shadow:0 8px 25px var(--shadow)}.art{display:block;width:100%;aspect-ratio:3/4;overflow:hidden;background:#30291f}.art svg,.art img{display:block;width:100%;height:100%;object-fit:cover}.body{padding:18px}.body p{margin:0 0 14px;color:var(--muted);font-size:13px}.body button{width:100%}.badge{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--accent)}
dialog{width:min(1320px,95vw);max-height:94vh;border:1px solid var(--line);border-radius:14px;background:var(--bg);color:var(--ink);padding:24px}dialog::backdrop{background:#050907bd}.dialog-top{display:flex;align-items:start;justify-content:space-between;gap:16px;position:sticky;top:-24px;padding:18px 0;background:var(--bg);z-index:2}.dialog-top h2{margin:0}.reference{display:flex;gap:24px;align-items:center;margin-bottom:24px}.reference img{width:130px;aspect-ratio:3/4;object-fit:cover;border-radius:7px}.reference p{max-width:720px;color:var(--muted)}.age-headings,.variants{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.age-headings{text-align:center;color:var(--accent);font-size:13px;margin-bottom:14px}.variant{margin:0;background:var(--surface);border:1px solid var(--line);border-radius:8px;overflow:hidden}.variant figcaption{padding:10px 12px;font-size:13px}.variant .art{aspect-ratio:3/4}.note{font-size:12px;color:var(--muted)}.empty{text-align:center;padding:60px}
@media(max-width:1050px){.grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:730px){.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}header,main,footer{padding:18px}.controls{gap:12px;padding:14px}.controls label{width:calc(50% - 6px)}select{max-width:100%;padding:9px}.body{padding:12px}.body h3{font-size:19px}.body button{font-size:12px;padding:9px}.reference{align-items:start;gap:14px}.reference img{width:85px}.variants,.age-headings{gap:5px}.variant figcaption{font-size:10px;padding:7px}.dialog-top h2{font-size:25px}dialog{padding:14px}.topline{align-items:start}}
</style></head><body>
<header><div class="topline"><span class="eyebrow">Open Historia · Dynastier · OpenArt</span><button id="theme" type="button">Mörkt tema</button></div>
<h1>Ett ansikte. Ett föränderligt liv.</h1><p class="intro">24 personer, tolv tillstånd och tre åldersstadier. Samma ansikte följer karaktären genom sjukdom, återhämtning, ärr, sorg och åldrande. Här förhandsvisar du bilderna; i spelet väljer karaktärens sparade tillstånd porträtt.</p>
<div class="controls"><label>Tillstånd<select id="state"></select></label><label>Åldersstadium<select id="age"><option value="current">Vid kampanjstart</option value="child">Barn</option><option value="adult">Vuxen</option><option value="elder">Äldre</option></select></label><label>Familj<select id="family"><option value="all">Alla familjer</option><option>Arel</option><option>Namar</option><option>Eshmun</option><option>Safra</option></select></label><label>Jämförelse<select id="comparison"><option value="variant">Vald variant</option><option value="original">Ursprungsporträtt</option></select></label></div>
<p class="count" id="count" aria-live="polite"></p></header><main><div class="grid" id="grid"></div></main>
<footer><p class="note">Bildserier: OpenArt / GPT Image 2.5 Sunburst. 24 originalbildkartor, 2016 × 2688 pixlar. Åldrandet sker i tre bildstadier. Flera samtidiga tillstånd visas genom det mest framträdande tillståndet; separata kombinationsbilder för varje möjlig kombination ingår inte.</p><a href="karaktarsgalleri.html">Öppna det ursprungliga galleriet</a> · <a href="__GUIDE__">Spelguide</a></footer>
<dialog id="detail" aria-labelledby="detail-title"><div class="dialog-top"><h2 id="detail-title"></h2><button id="close" type="button">Stäng</button></div><div id="detail-content"></div></dialog>
<script>
const data=__DATA__;
const labels={healthy:'Frisk',smallpox:'Smittkoppor','smallpox-recovering':'Återhämtning efter smittkoppor','smallpox-scars':'Ärr efter smittkoppor',fever:'Feber',wounded:'Skadad','injury-recovering':'Återhämtning efter skada','injury-scars':'Läkt skada med ärr',frail:'Skröplig',stressed:'Stressad',grieving:'Sörjande',exiled:'I exil'};
const ages={child:'Barn',adult:'Vuxen',elder:'Äldre'};
const el=id=>document.getElementById(id), safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const themeKey='dynasties-dynamic-gallery-theme';
function applyTheme(theme){document.documentElement.dataset.theme=theme;el('theme').textContent=theme==='dark'?'Ljust tema':'Mörkt tema';el('theme').setAttribute('aria-label','Byt till '+(theme==='dark'?'ljust':'mörkt')+' tema');}
let saved;try{saved=localStorage.getItem(themeKey)}catch{}const preference=matchMedia('(prefers-color-scheme: dark)');applyTheme(saved|| (preference.matches?'dark':'light'));
preference.addEventListener('change',event=>{if(!saved)applyTheme(event.matches?'dark':'light')});
el('theme').addEventListener('click',()=>{saved=document.documentElement.dataset.theme==='dark'?'light':'dark';applyTheme(saved);try{localStorage.setItem(themeKey,saved)}catch{}});
for(const key of data.layout.states){const option=document.createElement('option');option.value=key;option.textContent=labels[key];el('state').append(option)}el('state').value='smallpox';
function original(person){return '__PUBLIC_BASE__/dynasties/portraits/'+person.id+'.png'}
function art(person,age,state){const atlas=data.characters[person.id],index=data.layout.states.indexOf(state),row=data.layout.ageGroups.indexOf(age)*2+Math.floor(index/6),col=index%6;const x=atlas.columnBounds[col],y=atlas.rowBounds[row],w=atlas.columnBounds[col+1]-x,h=atlas.rowBounds[row+1]-y;return `<div class="art"><svg viewBox="${x} ${y} ${w} ${h}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${safe(person.name+', '+ages[age]+', '+labels[state])}"><image href="__PUBLIC_BASE__${atlas.src}" width="${atlas.width}" height="${atlas.height}"/></svg></div>`;}
function render(){const people=data.people.filter(p=>el('family').value==='all'||p.family===el('family').value);const state=el('state').value;el('grid').innerHTML=people.map(p=>{const age=el('age').value==='current'?p.ageGroup:el('age').value;return `<article class="card" data-person="${p.id}">${el('comparison').value==='original'?`<div class="art"><img src="${original(p)}" alt="${safe(p.name)}, ursprungsporträtt" loading="lazy"></div>`:art(p,age,state)}<div class="body"><span class="badge">Familjen ${safe(p.family)}</span><h3>${safe(p.name)}</h3><p>${el('comparison').value==='original'?'Ursprungsporträtt':safe(labels[state]+' · '+ages[age])}</p><button data-open="${p.id}">Se alla 36 varianter</button></div></article>`}).join('');el('count').textContent=`${people.length} personer · ${people.length*36} tillgängliga varianter`;
for(const button of document.querySelectorAll('[data-open]'))button.addEventListener('click',()=>openPerson(button.dataset.open));}
function openPerson(id){const p=data.people.find(p=>p.id===id);el('detail-title').textContent=p.name;el('detail-content').innerHTML=`<div class="reference"><img src="${original(p)}" alt="${safe(p.name)}, ursprungsporträtt"><div><p>Alla varianter bygger på samma ursprungsporträtt. Vuxenstadiet bevarar startpersonens vuxna ålder; barnens vuxenbilder visar dem omkring 26 år. Äldrestadiet visar personen omkring 75 år.</p>${data.characters[id].childMedicalDetail==='expression-only'?'<p class="note">I den här personens barnbilder visas sjukdom med mimik och ansiktsfärg. Vuxenbilderna har även synliga sjukdomsmärken och ärr.</p>':''}</div></div><div class="age-headings"><span>Barn</span><span>Vuxen</span><span>Äldre</span></div><div class="variants">${data.layout.states.flatMap(state=>data.layout.ageGroups.map(age=>`<figure class="variant" data-state="${state}" data-age="${age}">${art(p,age,state)}<figcaption>${safe(labels[state])}</figcaption></figure>`)).join('')}</div>`;el('detail').showModal();el('detail').scrollTop=0;el('close').focus();}
for(const id of ['state','age','family','comparison'])el(id).addEventListener('change',render);el('close').addEventListener('click',()=>el('detail').close());el('detail').addEventListener('click',event=>{if(event.target===el('detail')){const box=el('detail').getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)el('detail').close()}});render();
</script></body></html>'''
target.write_text(template.replace('__PUBLIC_BASE__', public_base).replace('__GUIDE__', guide).replace('__DATA__', json.dumps(data, ensure_ascii=False).replace('</', '<\\/')), encoding='utf-8')
print(json.dumps({'file': str(target), 'characters': len(data['people']), 'variants': len(data['characters']) * 36}, ensure_ascii=False))
