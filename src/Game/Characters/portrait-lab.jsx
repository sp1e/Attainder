import React, { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Portrait from './Portrait.jsx';
import { getPortraitAsset } from '../../runtime/characters/portraitAssets.js';
import { PORTRAIT_STATES, PORTRAIT_AGE_GROUPS } from '../../runtime/characters/portraitState.js';
import originals from '../../runtime/characters/portrait-manifest.json' with { type: 'json' };
import './characters.css';
import './portrait-lab.css';

const CampaignPanel = lazy(() => import('./CharactersPanel.jsx'));
const states = { healthy: 'Frisk', smallpox: 'Smittkoppor', 'smallpox-recovering': 'Återhämtning efter smittkoppor', 'smallpox-scars': 'Smittkoppsärr', fever: 'Feber', wounded: 'Skadad', 'injury-recovering': 'Återhämtning efter skada', 'injury-scars': 'Skadeärr', frail: 'Svag hälsa', stressed: 'Hög stress', grieving: 'Sorg', exiled: 'Exil' };
const ages = { child: 'Barn', adult: 'Vuxen', elder: 'Äldre' };
function presentation(original, ageGroup, visualState, deceased = false) {
  return { ...original, age: { child: 12, adult: 35, elder: 72 }[ageGroup], alive: !deceased, diedAt: deceased ? '-0299-01-01' : null,
    portraitState: { identityId: original.id, fallbackIdentityId: original.id, ageGroup, visualState, stateKeys: [visualState],
      reasons: [{ key: visualState, label: states[visualState] }], lifeStatus: deceased ? 'deceased' : 'alive' } };
}
function Lab() {
  const [identity, setIdentity] = useState('person-0-0');
  const [ageGroup, setAge] = useState('adult');
  const [visualState, setVisualState] = useState('healthy');
  const [deceased, setDeceased] = useState(false);
  const [matrix, setMatrix] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [campaignLoaded, setCampaignLoaded] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('oh:portrait-lab-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const changed = () => { if (!localStorage.getItem('oh:portrait-lab-theme')) setTheme(media.matches ? 'dark' : 'light'); };
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  const original = originals.people.find((candidate) => candidate.id === identity);
  const person = presentation(original, ageGroup, visualState, deceased);
  const asset = getPortraitAsset(person);
  return <main className="char-backdrop portrait-lab" data-char-theme={theme}>
    <header className="portrait-lab-heading"><div><span className="char-eyebrow">Isolerat visningsprov · ändrar ingen kampanj</span><h1>Ansikten genom ett liv</h1><p>Växla mellan ålder, hälsa och livssituation. Personen behåller sin identitet.</p></div><button className="char-button" onClick={() => { const next = theme === 'dark' ? 'light' : 'dark'; setTheme(next); localStorage.setItem('oh:portrait-lab-theme', next); }}>{theme === 'dark' ? 'Byt till ljust läge' : 'Byt till mörkt läge'}</button></header>
    <section className="char-card portrait-lab-controls"><label>Person<select value={identity} onChange={(event) => setIdentity(event.target.value)}>{originals.people.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></label><label>Ålder<select value={ageGroup} onChange={(event) => setAge(event.target.value)}>{PORTRAIT_AGE_GROUPS.map((age) => <option key={age} value={age}>{ages[age]}</option>)}</select></label><label>Tillstånd<select value={visualState} onChange={(event) => setVisualState(event.target.value)}>{PORTRAIT_STATES.map((state) => <option key={state} value={state}>{states[state]}</option>)}</select></label><label className="char-checkbox"><input type="checkbox" checked={deceased} onChange={(event) => setDeceased(event.target.checked)} />Minnesporträtt av avliden</label></section>
    <section className="char-card portrait-lab-preview"><div data-testid="live-portrait"><Portrait person={person} size="large" eager /></div><div><h2>{person.name}</h2><p>{ages[ageGroup]} · {states[visualState]}{deceased ? ' · Avliden' : ''}</p><dl><dt>Identitet</dt><dd>{asset?.identityId}</dd><dt>Bildkälla</dt><dd>{asset?.kind === 'atlas' ? 'Tillståndsvariant' : 'Originalporträtt'}</dd><dt>Utsnitt i originalbilden</dt><dd>{asset?.rect ? `${asset.rect.x}, ${asset.rect.y} · ${asset.rect.width} × ${asset.rect.height}` : 'Hela porträttet'}</dd></dl>{asset?.missingVariant && <p className="char-health-summary">Varianten saknas ännu. Originalporträttet används för samma person.</p>}</div></section>
    <div className="portrait-lab-tools"><label className="char-checkbox"><input type="checkbox" checked={matrix} onChange={(event) => setMatrix(event.target.checked)} />Visa alla 36 kombinationer för personen</label><button className="char-button" onClick={() => { setCampaignLoaded(true); setCampaignOpen(true); }}>Öppna sparad rapport för tangentbordsprov</button></div>
    {matrix && <section className="portrait-lab-matrix" aria-label="Alla åldrar och tillstånd">{PORTRAIT_AGE_GROUPS.flatMap((age) => PORTRAIT_STATES.map((state) => <article className="char-card" key={`${identity}-${age}-${state}`} data-matrix-state={`${age}:${state}`}><Portrait person={presentation(original, age, state)} size="large" eager /><strong>{ages[age]}</strong><span>{states[state]}</span></article>))}</section>}
    {campaignLoaded && <Suspense fallback={<p>Läser den sparade kampanjen…</p>}><CampaignPanel open={campaignOpen} onClose={() => setCampaignOpen(false)} /></Suspense>}
  </main>;
}
createRoot(document.getElementById('root')).render(<Lab />);
