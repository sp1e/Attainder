import React, { useCallback, useEffect, useRef, useState } from "react";
import { applyQuickAiSetup, getResolvedFallbackList } from "../AI/providerConfig.js";
import "./characters.css";

const PROVIDERS = [{ id: "codex-cli", label: "Codex", letter: "C" }, { id: "claude-cli", label: "Claude", letter: "✳" }];

export default function LocalModelConnect({ onConnected, onAdvanced, compact = false, className = "" }) {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState("");
  const [error, setError] = useState("");
  const [model, setModel] = useState("");
  const [selected, setSelected] = useState(() => getResolvedFallbackList()[0]?.provider || "");
  const [notice, setNotice] = useState("");
  const requestRef = useRef(null);
  const refresh = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true); setError("");
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch("/api/local-models/status", { signal: controller.signal, headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Det gick inte att kontrollera modellanslutningarna. Starta spelet genom den lokala spelstartaren och försök igen.");
      const result = await response.json();
      if (!Array.isArray(result.providers)) throw new Error("Den lokala anslutningen svarade inte som väntat. Försök igen.");
      if (requestRef.current !== controller) return;
      setProviders(result.providers);
    } catch (reason) {
      if (requestRef.current !== controller) return;
      setError(reason.name === "AbortError" ? "Kontrollen tog för lång tid. Försök igen." : reason.message || "Modellanslutningarna kunde inte kontrolleras.");
    } finally {
      clearTimeout(timeout);
      if (requestRef.current === controller) { setLoading(false); requestRef.current = null; }
    }
  }, []);
  useEffect(() => {
    refresh();
    return () => { requestRef.current?.abort(); requestRef.current = null; };
  }, [refresh]);
  useEffect(() => {
    const updateSelected = () => setSelected(getResolvedFallbackList()[0]?.provider || "");
    window.addEventListener("ai:fallback-changed", updateSelected);
    return () => window.removeEventListener("ai:fallback-changed", updateSelected);
  }, []);
  const connect = async (provider) => {
    if (connecting) return;
    setConnecting(provider); setError(""); setNotice("");
    try {
      const connection = applyQuickAiSetup({ provider, endpoint: "/api/local-models", model: model.trim() });
      setSelected(provider);
      setNotice(`${PROVIDERS.find((entry) => entry.id === provider)?.label} är vald. Nästa modellstyrda tur använder din befintliga inloggning.`);
      await onConnected?.({ provider, ...connection });
    } catch (reason) { setError(reason?.message || "Modellen kunde inte väljas."); }
    finally { setConnecting(""); }
  };
  return <section className={`char-local-connect${compact ? " char-local-connect--compact" : ""} ${className}`} aria-label="Anslut Claude eller Codex">
    <div className="char-local-heading"><div><span className="char-eyebrow">Välj vem som berättar världen</span><h3>Anslut Claude eller Codex</h3></div><button type="button" className="char-local-refresh" onClick={refresh} disabled={loading || Boolean(connecting)}>{loading ? "Kontrollerar…" : "Uppdatera status"}</button></div>
    <p>Spelet använder din befintliga inloggning på den här datorn. Modellen formar turens berättelse och förslag; spelreglerna avgör följderna.</p>
    <div className="char-local-providers">{PROVIDERS.map((provider) => {
      const status = providers.find((entry) => entry.provider === provider.id);
      const ready = Boolean(status?.available && status?.authenticated);
      const alreadySelected = selected === provider.id && !model.trim();
      return <div className={`char-local-provider${selected === provider.id ? " is-selected" : ""}`} key={provider.id}><span className="char-local-symbol" aria-hidden="true">{provider.letter}</span><div><strong>{provider.label}</strong><span className={`char-local-status${ready ? " is-ready" : ""}`}>{loading ? "Kontrollerar inloggning" : !status ? "Status saknas" : !status.available ? "Hittades inte på datorn" : !status.authenticated ? "Behöver inloggning" : "Inloggad och tillgänglig"}</span></div><button type="button" onClick={() => connect(provider.id)} disabled={loading || !ready || Boolean(connecting) || alreadySelected}>{connecting === provider.id ? "Väljer…" : alreadySelected ? "Vald" : `Välj ${provider.label}`}</button></div>;
    })}</div>
    {!loading && providers.some((provider) => provider.available && !provider.authenticated) && <p className="char-local-help">Logga in i den aktuella appen på datorn och välj sedan Uppdatera status.</p>}
    <details className="char-local-options"><summary>Välj ett särskilt modellnamn</summary><label>Modellnamn, valfritt<input type="text" value={model} onChange={(event) => setModel(event.target.value)} placeholder="Använd kontots förval" autoComplete="off" /></label><p>Lämna tomt för appens förval. Ett angivet namn måste finnas för ditt konto.</p></details>
    {error && <p className="char-local-error" role="alert">{error}</p>}
    {notice && <p className="char-local-notice" role="status">{notice}</p>}
    {onAdvanced && <button type="button" className="char-local-refresh" onClick={onAdvanced}>Andra modeller och anslutningsinställningar →</button>}
  </section>;
}
