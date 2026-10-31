"""Build an offline reader for research and system design; not game code."""
from pathlib import Path
import html
import re
import json
import argparse
from urllib.parse import unquote

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source-root', type=Path, required=True, help='Repository root containing docs/research and docs/design')
parser.add_argument('--installed-summary', type=Path, required=True, help='Reviewed, portable installed-app narrative Markdown')
parser.add_argument('--skills-summary', type=Path, required=True, help='Reviewed, portable skills narrative Markdown')
parser.add_argument('--output-dir', type=Path, required=True, help='New output directory outside the repository')
args = parser.parse_args()
ROOT = args.source_root.resolve()
OUTPUT = args.output_dir.resolve()
REPOSITORY = Path(__file__).resolve().parents[2]
if OUTPUT.is_relative_to(REPOSITORY) or OUTPUT.is_relative_to(ROOT):
    parser.error('Output must be outside the repository and source root.')
if OUTPUT.exists():
    parser.error('Output directory already exists; choose a new directory.')
for source in (args.installed_summary, args.skills_summary):
    if not source.is_file():
        parser.error(f'Required reviewed summary is missing: {source}')
OUTPUT.mkdir(parents=True)

DOCS = [
    ('overview', 'Överblick och jämförelse', ROOT / 'docs/research/RESEARCH.md'),
    ('ck3', 'Crusader Kings III', ROOT / 'docs/research/ck3-character-research.md'),
    ('oldworld', 'Old World', ROOT / 'docs/research/old-world-character-research.md'),
    ('events', 'Design och händelsemotorer', ROOT / 'docs/research/design-och-handelsemotorer.md'),
    ('foundation', 'Open Historia: källkod', ROOT / 'docs/research/open-historia-architecture.md'),
    ('installed', 'Open Historia: installerad beta', args.installed_summary.resolve()),
    ('skills', 'Skills: granskning och installation', args.skills_summary.resolve()),
    ('systemdesign', 'Systemdesign: hela spelet', ROOT / 'docs/design/SYSTEMDESIGN.md'),
    ('acceptance', 'Acceptans: samtliga krav', ROOT / 'docs/design/ACCEPTANS.md'),
    ('glossary', 'Begrepp och ansvar', ROOT / 'docs/design/GLOSSARY.md'),
    ('rulesreview', 'Spelregler: oberoende granskning', ROOT / 'docs/design/rules-review.md'),
    ('integration', 'Integration med Open Historia', ROOT / 'docs/design/integration-plan.md'),
]
FILE_KEYS = {p.name.casefold(): key for key, _, p in DOCS}
FILE_KEYS.update({'installed-app-status.md': 'installed', 'skill-review-sv.md': 'skills'})
CHAPTER_KEYS = {key for key, _, _ in DOCS}
SECTION_ANCHORS = {}
MARKDOWN_LINK = re.compile(r'\[([^\]]+)\]\((<[^>]+>|[^\s)]+)\)')

def heading_anchors(text, key):
    """Map Markdown heading fragments to the reader's stable chapter-local ids."""
    anchors, occurrences, index, fenced = {}, {}, 0, False
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith('```'):
            fenced = not fenced
            continue
        match = re.match(r'^(#{1,6})\s+(.+)', stripped)
        if fenced or not match:
            continue
        plain = re.sub(r'[*`]', '', match[2]).strip().lower()
        slug = re.sub(r'[^\w\s-]', '', plain, flags=re.UNICODE).replace(' ', '-')
        occurrence = occurrences.get(slug, 0)
        occurrences[slug] = occurrence + 1
        fragment = f'{slug}-{occurrence}' if occurrence else slug
        anchors[fragment] = f'{key}-h{index}'
        index += 1
    return anchors

def resolve_link(target, key):
    target = target.removeprefix('<').removesuffix('>')
    if target.startswith(('https://', 'http://')):
        return target
    decoded = unquote(target).replace('\\', '/')
    local_path, separator, fragment = decoded.partition('#')
    if not local_path:
        if fragment in CHAPTER_KEYS or fragment in SECTION_ANCHORS.get(key, {}).values():
            return '#' + fragment
        return '#' + SECTION_ANCHORS.get(key, {}).get(fragment, fragment)
    filename = re.sub(r':\d+$', '', local_path.rsplit('/', 1)[-1])
    chapter = FILE_KEYS.get(filename.casefold())
    if chapter:
        if separator and fragment:
            anchors = SECTION_ANCHORS.get(chapter, {})
            return '#' + anchors.get(fragment, fragment if fragment in anchors.values() else f'{chapter}-{fragment}')
        return '#' + chapter
    if decoded.startswith(('reports/', 'skill-review/', 'design/')):
        return target
    return None

def inline(value, key=None):
    saved = []
    def hold(markup):
        saved.append(markup)
        return f'\x00{len(saved)-1}\x00'
    value = re.sub(r'`([^`]+)`', lambda m: hold('<code>' + html.escape(m[1]) + '</code>'), value)
    def link(m):
        label, target = m[1], m[2]
        target = resolve_link(target, key)
        if target is None:
            return html.escape(label)
        extra = ' target="_blank" rel="noopener noreferrer"' if target.startswith('http') else ''
        return hold(f'<a href="{html.escape(target, quote=True)}"{extra}>{html.escape(label)}</a>')
    value = MARKDOWN_LINK.sub(link, value)
    value = html.escape(value)
    value = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', value)
    value = re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)', r'<em>\1</em>', value)
    value = re.sub(r'\x00(\d+)\x00', lambda m: saved[int(m[1])], value)
    return value

def render_markdown(text, key):
    lines = text.splitlines()
    out, toc, n = [], [], 0
    while n < len(lines):
        line = lines[n].strip()
        if not line:
            n += 1
            continue
        if line.startswith('```'):
            block=[]
            n+=1
            while n<len(lines) and not lines[n].strip().startswith('```'):
                block.append(lines[n]); n+=1
            out.append('<pre><code>'+html.escape('\n'.join(block))+'</code></pre>');n+=1;continue
        m = re.match(r'^(#{1,6})\s+(.+)', line)
        if m:
            level = min(6, len(m[1])+1)
            anchor = f'{key}-h{len(toc)}'
            toc.append((anchor, re.sub(r'[*`]', '', m[2]),level))
            out.append(f'<h{level} id="{anchor}">{inline(m[2],key)}</h{level}>');n+=1;continue
        if line.startswith('|') and n+1<len(lines) and re.match(r'^\|[\s:|\-]+\|?$',lines[n+1].strip()):
            cells=lambda x: [c.strip() for c in x.strip().strip('|').split('|')]
            out.append('<div class="table-scroll" role="region" tabindex="0" aria-label="Tabell, rulla horisontellt vid behov"><table><thead><tr>')
            out.extend('<th scope="col">'+inline(c,key)+'</th>' for c in cells(line))
            out.append('</tr></thead><tbody>');n+=2
            while n<len(lines) and lines[n].strip().startswith('|'):
                out.append('<tr>'+''.join('<td>'+inline(c,key)+'</td>' for c in cells(lines[n]))+'</tr>');n+=1
            out.append('</tbody></table></div>');continue
        if re.match(r'^([-*]|\d+\.)\s+',line):
            ordered=bool(re.match(r'^\d+\.',line));tag='ol' if ordered else 'ul'
            out.append('<'+tag+'>')
            while n<len(lines) and re.match(r'^\s*([-*]|\d+\.)\s+',lines[n]):
                content=re.sub(r'^\s*([-*]|\d+\.)\s+','',lines[n])
                out.append('<li>'+inline(content,key)+'</li>');n+=1
            out.append('</'+tag+'>');continue
        para=[line];n+=1
        while n<len(lines) and lines[n].strip() and not re.match(r'^(#|\||```|[-*]\s|\d+\.\s)',lines[n].strip()):
            para.append(lines[n].strip());n+=1
        out.append('<p>'+inline(' '.join(para),key)+'</p>')
    return '\n'.join(out),toc

sections=[]
nav=[]
all_sources=set()
sources={key:path.read_text(encoding='utf-8-sig') for key,_,path in DOCS}
SECTION_ANCHORS.update({key:heading_anchors(sources[key],key) for key,_,_ in DOCS})
for key,label,path in DOCS:
    source=sources[key]
    all_sources.update(m[2].strip('<>') for m in MARKDOWN_LINK.finditer(source) if m[2].strip('<>').startswith(('https://','http://')))
    body,toc=render_markdown(source,key)
    nav.append(f'<a href="#{key}">{html.escape(label)}</a>')
    toc_html=''.join(f'<li><a href="#{a}">{html.escape(t)}</a></li>' for a,t,l in toc if l==3)
    toc_html=f'<details class="chapter-index"><summary>Avsnitt i kapitlet</summary><ul>{toc_html}</ul></details>' if toc_html else ''
    sections.append(f'<article id="{key}" class="chapter" aria-label="{html.escape(label)}"><div class="chapter-label">{html.escape(label)}</div>{toc_html}{body}</article>')

css='''
:root{color-scheme:light;--bg:#eef2f4;--surface:#ffffff;--ink:#172f3d;--muted:#455e6d;--line:#cbd6dd;--accent:#175c78;--accent-bg:#e0eef3;--code:#eaf0f3;--head:#173c4e;--shadow:0 8px 32px #1b34450b}
:root[data-theme="dark"]{color-scheme:dark;--bg:#101b23;--surface:#182831;--ink:#e7eef3;--muted:#b0c4d0;--line:#39515f;--accent:#88cae2;--accent-bg:#244653;--code:#243943;--head:#f0f5f7;--shadow:none}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:90px}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.72 'Segoe UI',Arial,sans-serif}a{color:var(--accent);text-underline-offset:3px}a:hover{text-decoration-thickness:2px}button,input,summary{font:inherit}button,summary{cursor:pointer}button{border:1px solid var(--line);background:var(--surface);color:var(--ink);padding:8px 13px;border-radius:5px}button:hover{background:var(--accent-bg)}:focus-visible{outline:3px solid var(--accent);outline-offset:4px}.skip{position:fixed;top:-80px;left:20px;z-index:5;background:var(--surface);padding:10px}.skip:focus{top:10px}.top{position:sticky;top:0;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:13px 30px;background:var(--surface);border-bottom:1px solid var(--line)}.brand{font-size:13px;letter-spacing:.11em;text-transform:uppercase;font-weight:700}.controls{display:flex;gap:8px;align-items:center}.layout{display:grid;grid-template-columns:250px minmax(0,1030px);gap:32px;max-width:1370px;margin:auto;padding:30px 28px}.sidebar{align-self:start;position:sticky;top:100px}.sidebar p{font-size:13px;color:var(--muted)}nav{display:grid;gap:4px}nav a{display:block;padding:10px 12px;border-left:3px solid transparent;text-decoration:none;font-size:14px}nav a:hover,nav a.active{border-color:var(--accent);background:var(--accent-bg)}.intro{padding:20px 0 30px}.eyebrow{font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}h1{font:normal clamp(36px,4vw,58px)/1.12 Georgia,serif;letter-spacing:-.025em;color:var(--head);max-width:800px;margin:16px 0 20px}.intro p{max-width:770px;font-size:18px}.scope{display:flex;flex-wrap:wrap;gap:8px}.scope span{font-size:12px;letter-spacing:.03em;padding:4px 9px;border:1px solid var(--line);border-radius:4px;color:var(--muted)}.chapter{background:var(--surface);padding:38px 42px;margin-bottom:30px;border:1px solid var(--line);border-radius:8px;box-shadow:var(--shadow);overflow:hidden}.chapter-label{font-size:11px;letter-spacing:.16em;color:var(--accent);font-weight:700;text-transform:uppercase}h2{font:normal 33px/1.22 Georgia,serif;color:var(--head);margin:12px 0 26px}h3{font-size:23px;line-height:1.35;margin:38px 0 14px;color:var(--head)}h4{font-size:19px;line-height:1.4}p{margin:15px 0}li{margin:9px 0}strong{font-weight:650}code{background:var(--code);padding:2px 5px;border-radius:3px;font:13px/1.5 Consolas,monospace;overflow-wrap:anywhere}pre{overflow:auto;background:var(--code);padding:16px}pre code{padding:0}.table-scroll{overflow-x:auto;margin:22px 0;border:1px solid var(--line);border-radius:4px}table{width:100%;border-collapse:collapse;text-align:left;font-size:14px;line-height:1.6;min-width:540px}th{background:var(--accent-bg);color:var(--head);font-weight:650}td,th{padding:12px 14px;border-bottom:1px solid var(--line);vertical-align:top}tbody tr:last-child td{border:0}td:first-child{min-width:140px}td a{overflow-wrap:anywhere}.chapter-index{margin:12px 0 24px;border-bottom:1px solid var(--line);padding-bottom:12px;font-size:14px}.chapter-index summary{color:var(--accent)}.chapter-index ul{columns:2;padding-left:20px}.chapter-index li{break-inside:avoid}.footer{font-size:13px;color:var(--muted);padding:0 0 35px}.print{white-space:nowrap}@media(max-width:950px){.layout{grid-template-columns:1fr;padding:20px 18px}.sidebar{position:static}.sidebar nav{grid-template-columns:repeat(2,minmax(0,1fr))}.sidebar p{display:none}.chapter{padding:26px 24px}.intro{padding-top:0}}@media(max-width:550px){.top{padding:12px 15px;align-items:flex-start}.brand{max-width:110px;font-size:11px}.controls{flex-wrap:wrap;justify-content:flex-end;gap:5px}button{font-size:13px;padding:7px 9px}.layout{padding:16px 12px;gap:18px}.sidebar nav a{font-size:12px;padding:7px 8px}.chapter{padding:24px 17px}h2{font-size:27px}h3{font-size:21px}.intro p{font-size:16px}.chapter-index ul{columns:1}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}@media print{.top,.sidebar,.scope,.chapter-index{display:none}.layout{display:block;padding:0}.chapter{box-shadow:none;border:0;padding:15px 0;border-bottom:1px solid #aaa;break-before:page}body{background:white;color:#111;font-size:11pt}.table-scroll{overflow:visible}table{min-width:0}.intro{padding:0}a{color:#111}h1{font-size:32pt}h2{font-size:24pt}}
'''
css += '\nmain,.sidebar{min-width:0}.chapter{overflow-wrap:anywhere}@media(max-width:950px){.layout{grid-template-columns:minmax(0,1fr)}}'
css += '\n.design-status{max-width:770px;padding:14px 18px;border-left:4px solid var(--accent);background:var(--accent-bg);color:var(--ink);margin:22px 0}.design-status p{font-size:16px;margin:5px 0}.design-status strong{color:var(--head)}'
early_script='''(()=>{let choice=null;try{choice=localStorage.getItem('historia-research-theme')}catch{}document.documentElement.dataset.theme=['light','dark'].includes(choice)?choice:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')})();'''
script='''
const themeButton=document.querySelector('#theme');const systemButton=document.querySelector('#system');const media=matchMedia('(prefers-color-scheme: dark)');let explicit=false;try{explicit=['light','dark'].includes(localStorage.getItem('historia-research-theme'))}catch{}
function sync(){const dark=document.documentElement.dataset.theme==='dark';themeButton.textContent=dark?'Ljust läge':'Mörkt läge';themeButton.setAttribute('aria-label',dark?'Byt till ljust läge':'Byt till mörkt läge');systemButton.setAttribute('aria-pressed',String(!explicit));}
themeButton.addEventListener('click',()=>{explicit=true;document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('historia-research-theme',document.documentElement.dataset.theme)}catch{}sync()});
systemButton.addEventListener('click',()=>{explicit=false;try{localStorage.removeItem('historia-research-theme')}catch{}document.documentElement.dataset.theme=media.matches?'dark':'light';sync()});media.addEventListener('change',()=>{if(!explicit){document.documentElement.dataset.theme=media.matches?'dark':'light';sync()}});sync();document.querySelector('#print').addEventListener('click',()=>window.print());
const links=[...document.querySelectorAll('nav a')];const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){links.forEach(a=>{const yes=a.hash==='#'+entry.target.id;a.classList.toggle('active',yes);if(yes)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')})}}},{rootMargin:'-90px 0px -65% 0px'});document.querySelectorAll('.chapter').forEach(e=>observer.observe(e));
'''
page=f'''<!doctype html>
<html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Karaktärer och riken · Research och systemdesign för Simon</title>
<script>{early_script}</script><style>{css}</style></head><body>
<a class="skip" href="#main">Till underlaget</a>
<header class="top"><div class="brand">Karaktärer &amp; riken</div><div class="controls">
<button id="theme" type="button">Byt färgläge</button><button id="system" type="button" aria-pressed="true">Följ systemet</button><button id="print" class="print" type="button">Skriv ut</button>
</div></header>
<div class="layout"><aside class="sidebar"><div class="eyebrow">Läs underlaget</div>
<nav aria-label="Underlagets kapitel">{''.join(nav)}</nav>
<p>Alla tolv kapitel finns på sidan. Använd webbläsarens sökning för att hitta ett begrepp.</p>
<p><a href="#overview">Redigerbar sammanfattning</a><br><a href="#systemdesign">Redigerbar systemdesign</a><br><a href="https://store.steampowered.com/manual/597180">Old Worlds officiella manual</a><br><span>Skillgranskningens bilagor ingår inte</span></p>
</aside><main id="main"><div class="intro"><div class="eyebrow">Research och systemdesign · 30 oktober 2026</div>
<h1>Människorna<br>bakom riket.</h1>
<p>Hur CK3 och Old World låter personlighet, relationer och generationsskiften förändra ett strategispel. Underlag och systemdesign för ditt antika rikesbyggarspel med Open Historia som bas.</p>
<div class="design-status" role="note" aria-label="Designens status"><strong>Specificerat, ej implementerat.</strong><p>Samtliga sex kravpelare ingår i designen. Vid kampanjstart ska spelaren kunna välja att följa riket eller familjen. Acceptanskraven anger vad implementationen behöver klara.</p></div>
<div class="scope"><span>Sju researchkapitel</span><span>Fem designkapitel</span><span>Versions- och DLC-gränser</span><span>Ingen spelimplementation</span></div>
</div>{''.join(sections)}
<footer class="footer">Lokalt underlag för research och systemdesign. Sidan använder inga externa typsnitt, skript eller analysverktyg. Källänkar öppnas när du väljer dem. {len(all_sources)} unika externa källadresser i underlaget.</footer>
</main></div><script>{script}</script></body></html>'''
(OUTPUT/'research.html').write_text(page,encoding='utf-8')
(OUTPUT/'source-index.json').write_text(json.dumps({'date':'2026-10-30','urls':sorted(all_sources),'documents':[str(p.relative_to(ROOT)).replace('\\','/') if p.is_relative_to(ROOT) else p.name for _,_,p in DOCS]},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'output':str(OUTPUT/'research.html'),'chapters':len(DOCS),'source_urls':len(all_sources),'bytes':len(page.encode())}))
