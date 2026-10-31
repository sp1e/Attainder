import { useState } from 'react';
import LocalModelConnect from './Characters/LocalModelConnect.jsx';
import { startDynastyCampaign } from '../runtime/startDynastyCampaign.js';
import { isFallbackListConfigured } from './AI/providerConfig.js';
import './dynastyStart.css';

// The character engine's difficulty ids (extensions.js DIFFICULTIES); the game's own difficulty is a separate setting.
const DIFFICULTY_OPTIONS = [['easy','Lätt'],['normal','Normal'],['hard','Svår']];

export default function DynastyStartCard({ onStart, errorMessage = '' }) {
  const [mode,setMode] = useState('realm');
  const [seed,setSeed] = useState('');
  const [difficulty,setDifficulty] = useState('normal');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [connected,setConnected] = useState(isFallbackListConfigured);
  const [theme,setTheme] = useState(() => {
    try { return localStorage.getItem('oh-dynasty-start-theme') || 'system'; } catch { return 'system'; }
  });
  const toggleTheme = () => {
    const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const next = dark ? 'light' : 'dark'; setTheme(next);
    try { localStorage.setItem('oh-dynasty-start-theme',next); } catch { /* optional persistence */ }
  };
  const start = async () => {
    setBusy(true); setError('');
    try { await (onStart ? onStart({mode,seed,difficulty}) : startDynastyCampaign({mode,seed,characterDifficulty:difficulty})); }
    catch (failure) { setError(failure.message); setBusy(false); }
  };
  return <section className="dynasty-start" data-theme={theme} aria-labelledby="dynasty-start-heading" data-no-translate>
    <div className="dynasty-start-heading"><span>ANTIKA DYNASTIER · 300 F.KR.</span><button type="button" onClick={toggleTheme} aria-label="Växla mellan ljust och mörkt tema">Ljust / mörkt</button></div>
    <div className="dynasty-start-layout"><div>
      <h1 id="dynasty-start-heading">Vem för du vidare?</h1>
      <p className="dynasty-start-intro">Ett rike. Fyra familjer. Människor vars löften, ambitioner och arv förändrar historien.</p>
      <div className="dynasty-start-modes" role="radiogroup" aria-label="Kampanjens identitet" onKeyDown={event=>{
        if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key==='Home'?'realm':event.key==='End'?'family':mode==='realm'?'family':'realm';
        setMode(next); event.currentTarget.querySelector(`[data-mode="${next}"]`)?.focus();
      }}>
        <button type="button" role="radio" data-mode="realm" tabIndex={mode==='realm'?0:-1} aria-checked={mode==='realm'} className={mode==='realm'?'selected':''} onClick={()=>setMode('realm')}><strong>Följ riket</strong><span>Styr Hadara genom nya härskare och dynastier. Kampanjen slutar om riket upplöses.</span></button>
        <button type="button" role="radio" data-mode="family" tabIndex={mode==='family'?0:-1} aria-checked={mode==='family'} className={mode==='family'?'selected':''} onClick={()=>setMode('family')}><strong>Följ familjen</strong><span>Följ Arel även efter en förlorad tron. Förvalta egendom och bygg stöd för återkomst. Kampanjen slutar när familjen saknar en giltig fortsättning.</span></button>
      </div>
      <p className="dynasty-start-detail">Starta med 24 personer och fyra städer i det fiktiva riket Hadara. Personlighet, familjepolitik, minnen och succession ingår i samma kampanj.</p>
      <div className="dynasty-difficulty"><label htmlFor="dynasty-difficulty">Svårighetsgrad</label><select id="dynasty-difficulty" value={difficulty} onChange={event=>setDifficulty(event.target.value)} disabled={busy}>{DIFFICULTY_OPTIONS.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select><p>Lätt ger dina omstridda handlingar 10 procentenheter högre chans och andras handlingar mot dig 10 lägre. Svår gör tvärtom. Valet sparas i kampanjen.</p></div>
      <details className="dynasty-seed"><summary>Kampanjfrö (valfritt)</summary><label htmlFor="dynasty-seed">Frö för kampanjens start</label><input id="dynasty-seed" type="number" min="1" max="4294967295" step="1" value={seed} onChange={event=>setSeed(event.target.value)} placeholder="104729" disabled={busy} /><p>Återskapa samma start med ett valt frö. Modellens berättelse kan variera.</p></details>
      <button className="dynasty-start-play" type="button" onClick={start} disabled={busy || !connected}>{busy?'Kampanjen skapas…':mode==='realm'?'Starta som riket Hadara':'Starta som familjen Arel'}</button>
      {!connected&&<p className="dynasty-start-detail">Anslut Claude Code eller Codex för att starta.</p>}
      {(error||errorMessage)&&<p role="alert">{error||errorMessage}</p>}
    </div><div className="dynasty-start-connection"><LocalModelConnect onConnected={()=>setConnected(true)} /></div></div>
  </section>;
}
