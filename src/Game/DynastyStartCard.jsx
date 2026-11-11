import { useEffect, useMemo, useState } from 'react';
import LocalModelConnect from './Characters/LocalModelConnect.jsx';
import { playerText } from './Characters/playerText.js';
import HistoricalStartPicker from './HistoricalStartPicker.jsx';
import { loadHistoricalStartOptions, startDynastyCampaign } from '../runtime/startDynastyCampaign.js';
import { coverageLineSv } from '../runtime/historicalStartOptions.js';
import { isFallbackListConfigured } from './AI/providerConfig.js';
import './dynastyStart.css';

// The character engine's difficulty ids (extensions.js DIFFICULTIES); the game's own difficulty is a separate setting.
// The library bar's scenario picker offers the same three.
export const DYNASTY_DIFFICULTIES = Object.freeze([['easy','Lätt'],['normal','Normal'],['hard','Svår']]);
// A refusal written in Swedish reaches the player; an internal English error is logged and gives one of these.
const OPTIONS_FAILED = 'De historiska starterna kunde inte läsas. Försök igen.';
const START_FAILED = 'Kampanjen kunde inte startas.';

export default function DynastyStartCard({ onStart, errorMessage = '' }) {
  const [error,setError] = useState('');
  const [bookmarks,setBookmarks] = useState([]);
  const [scenarioId,setScenarioId] = useState('');
  const [polityId,setPolityId] = useState('');
  const [familyId,setFamilyId] = useState('');
  const selected = bookmarks.find(b => b.scenarioId === scenarioId);
  const polity = selected?.polities.find(p => p.id === polityId);
  useEffect(() => {
    let alive = true;
    loadHistoricalStartOptions().then(options => {
      if (!alive) return;
      setBookmarks(options);
      const first = options[0];
      if (first) { setScenarioId(first.scenarioId); setPolityId(first.polities[0].id); setFamilyId(first.polities[0].families[0].id); }
    }).catch(failure => { if (alive) setError(playerText(failure?.message, OPTIONS_FAILED)); });
    return () => { alive = false; };
  },[]);
  const chooseStart = choice => {
    const chosen = bookmarks.find(b => b.scenarioId === choice.scenarioId)?.polities.find(p => p.id === choice.polityId);
    if (!chosen) return;
    setScenarioId(choice.scenarioId); setPolityId(chosen.id); setFamilyId(chosen.families[0].id);
  };
  const [mode,setMode] = useState('realm');
  const [seed,setSeed] = useState('');
  const [difficulty,setDifficulty] = useState('normal');
  const [busy,setBusy] = useState(false);
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
    try { const options = {option:selected,mode,seed,difficulty,scenarioId,date:selected?.date,polityId,...(mode === 'family' ? {familyId} : {})}; await (onStart ? onStart(options) : startDynastyCampaign(options)); }
    catch (failure) { setError(playerText(failure?.message, START_FAILED)); setBusy(false); }
  };
  // The library bar hands over the same failure as written; it gets the same check, once per message.
  const outerError = useMemo(() => errorMessage ? playerText(errorMessage, START_FAILED) : '', [errorMessage]);
  // data-native-text: the card is written in Swedish, so the page translator applies its whole native book here.
  return <section className="dynasty-start" data-theme={theme} aria-labelledby="dynasty-start-heading" data-native-text>
    <div className="dynasty-start-heading"><span>HISTORISKA DYNASTIER · 3300 F.KR.–1530 E.KR.</span><button type="button" onClick={toggleTheme} aria-label="Växla mellan ljust och mörkt tema">Ljust / mörkt</button></div>
    <div className="dynasty-start-layout"><div>
      <h1 id="dynasty-start-heading">Vem för du vidare?</h1>
      <p className="dynasty-start-intro">Välj en historisk start och följ människorna som formar din kampanj.</p>
      <HistoricalStartPicker options={bookmarks} value={{scenarioId,polityId}} onChange={chooseStart} disabled={busy} />
      {mode === 'family' && <div className="dynasty-difficulty"><label htmlFor="historical-family">Familj</label><select id="historical-family" value={familyId} onChange={e=>setFamilyId(e.target.value)} disabled={busy}>{polity?.families.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></div>}
      <div className="dynasty-start-modes" role="radiogroup" aria-label="Kampanjens identitet" onKeyDown={event=>{
        if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key==='Home'?'realm':event.key==='End'?'family':mode==='realm'?'family':'realm';
        setMode(next); event.currentTarget.querySelector(`[data-mode="${next}"]`)?.focus();
      }}>
        <button type="button" role="radio" data-mode="realm" tabIndex={mode==='realm'?0:-1} aria-checked={mode==='realm'} className={mode==='realm'?'selected':''} onClick={()=>setMode('realm')}><strong>Följ riket</strong><span>Styr det valda riket genom nya härskare och dynastier. Kampanjen slutar om riket upplöses.</span></button>
        <button type="button" role="radio" data-mode="family" tabIndex={mode==='family'?0:-1} aria-checked={mode==='family'} className={mode==='family'?'selected':''} onClick={()=>setMode('family')}><strong>Följ familjen</strong><span>Följ den valda familjen även efter en förlorad tron. Förvalta egendom och bygg stöd för återkomst. Kampanjen slutar när familjen saknar en giltig fortsättning.</span></button>
      </div>
      <p className="dynasty-start-detail">{polity?.context ?? selected?.context ?? "Inget giltigt historiskt scenario är tillgängligt."}</p>
      {selected && <details><summary>Källor och osäkerhet</summary><p>{selected.coverage}</p><p>{coverageLineSv(selected)}</p>{polity?.mechanicsNote && <p>{polity.mechanicsNote}</p>}<p>{selected.calendarNote}</p><p>Utvecklingen efter starten kan avvika från verklig historia.</p></details>}
      <div className="dynasty-difficulty"><label htmlFor="dynasty-difficulty">Svårighetsgrad</label><select id="dynasty-difficulty" value={difficulty} onChange={event=>setDifficulty(event.target.value)} disabled={busy}>{DYNASTY_DIFFICULTIES.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select><p>Lätt ger dina omstridda handlingar 10 procentenheter högre chans och andras handlingar mot dig 10 lägre. Svår gör tvärtom. Valet sparas i kampanjen.</p></div>
      <details className="dynasty-seed"><summary>Kampanjfrö (valfritt)</summary><label htmlFor="dynasty-seed">Frö för kampanjens start</label><input id="dynasty-seed" type="number" min="1" max="4294967295" step="1" value={seed} onChange={event=>setSeed(event.target.value)} placeholder="104729" disabled={busy} /><p>Återskapa samma start med ett valt frö. Modellens berättelse kan variera.</p></details>
      <button className="dynasty-start-play" type="button" onClick={start} disabled={busy || !connected || !selected}>{busy?'Kampanjen skapas…':mode==='realm'?'Starta som riket':'Starta som familjen'}</button>
      {!connected&&<p className="dynasty-start-detail">Anslut Claude Code eller Codex för att starta.</p>}
      {(error||outerError)&&<p role="alert">{error||outerError}</p>}
    </div><div className="dynasty-start-connection"><LocalModelConnect onConnected={()=>setConnected(true)} /></div></div>
  </section>;
}
