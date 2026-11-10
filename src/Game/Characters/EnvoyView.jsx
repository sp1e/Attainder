import React, { useEffect, useRef, useState } from "react";
import { ENVOY_REQUESTS } from "../../runtime/characters/envoys.js";
import { estimateEnvoyForView, getEnvoyViewForModel, submitEnvoyRequest } from "../../runtime/characterRuntime.js";
import { extractEnvoyRequest, replyAsRuler } from "./characterModelCalls.js";
import { modifierText, oddsText, playerText } from "./ActionBox.jsx";
import { Transcript } from "./ConversationView.jsx";

// An envoy to a foreign ruler (envoys spec), built like the court conversation. The player writes the message; the model reads
// whether it asks for reconciliation or peace (extractEnvoyRequest). A request opens a confirmation card with the engine's odds
// (only `display`), the player sends it, the engine rolls (submitEnvoyRequest) and the ruler answers (replyAsRuler) about an
// outcome that is already fixed. The exchange lives in this view's state and is never stored. All model text is React text.

const MODEL_VIEW_FAILED = "Kampanjen kunde inte läsas. Försök igen.";
const REQUEST_FAILED = "Sändebudets ärende kunde inte tolkas. Försök formulera dig på nytt.";
const SUBMIT_FAILED = "Sändebudet kunde inte skickas. Försök igen om en stund.";
const SUBMIT_UNKNOWN = "Det gick inte att se om sändebudet kom fram. Läs krönikan innan du skickar ett nytt.";
const TALK_FAILED = "Härskaren kunde inte svara just nu. Försök igen.";
const REPLY_NOTE = "Svaret kunde inte skrivas; utfallet gäller.";
const IDLE = Object.freeze({ kind: "idle" });

// The record the engine just wrote on the realm, once it matches the request and the state's date.
function decidedEnvoy(result, request) {
  const state = result?.state;
  const record = state?.foreignRealms?.find?.((realm) => realm.id === request.realmId)?.lastEnvoy;
  return record && record.date === state.date && record.kind === request.kind && typeof record.accepted === "boolean" ? record : null;
}

// What happened, in the player's words. Built from the engine's record, never from the model.
export function envoyNotes(record, request, rulerName) {
  if (!record.accepted) return [`${rulerName} avvisar sändebudet. Nästa sändebud kan gå om ett år.`];
  const notes = [record.kind === "peace" ? `${rulerName} sluter fred. Kriget och anspråket är över.` : `${rulerName} går med på försoning.`];
  if (request.offerSilver > 0) notes.push(`${request.offerSilver} silver betalades ur statskassan.`);
  return notes;
}

function EnvoyCard({ card, realm, busy, onSend, onCancel, focusRef }) {
  const { request, estimate } = card;
  const display = estimate.display;
  return <section className="char-confirm" aria-label="Bekräfta sändebudet">
    <span className="char-eyebrow">Sändebud till {realm.name}</span>
    <h4 ref={focusRef} tabIndex={-1}>{ENVOY_REQUESTS[request.kind]?.label ?? request.kind}</h4>
    <ul className="char-confirm-facts">
      <li>Till: {realm.rulerName}</li>
      <li>Erbjuden gåva: {request.offerSilver > 0 ? `${request.offerSilver} silver ur statskassan, betalas bara vid ja` : "ingen"}</li>
      <li>Sändebudet kostar en order. Riket tar emot nästa sändebud om ett år.</li>
    </ul>
    <ul className="char-confirm-odds"><li>Chans att få ja: {oddsText(display.chance)}</li></ul>
    {(display.modifiers || []).length > 0 && <details className="char-explanation"><summary>Vad påverkar chansen?</summary>
      <ul>{display.modifiers.map((row, index) => <li key={`${row.label}-${index}`}>{modifierText(row)}</li>)}</ul>
    </details>}
    <div className="char-confirm-buttons">
      <button type="button" className="char-button char-button--primary" disabled={busy} onClick={onSend}>Skicka</button>
      <button type="button" className="char-button" disabled={busy} onClick={onCancel}>Avbryt</button>
    </div>
  </section>;
}

export default function EnvoyView({ realm, busy = false, runAction, onClose, onHold }) {
  const [turns, setTurns] = useState([]);
  const [text, setText] = useState("");
  const [stage, setStage] = useState(IDLE);
  const [problem, setProblem] = useState("");
  const focusArmed = useRef(false);
  const textRef = useRef(null), cardRef = useRef(null);
  useEffect(() => { textRef.current?.focus(); }, []);
  // An open card holds the panel's clock, as in the court conversation: its odds belong to one revision.
  const holding = stage.kind === "confirm";
  useEffect(() => { onHold?.(holding); }, [holding, onHold]);
  useEffect(() => () => onHold?.(false), [onHold]);
  useEffect(() => {
    if (!focusArmed.current || busy) return;
    const target = stage.kind === "confirm" ? cardRef : stage.kind === "idle" ? textRef : null;
    if (!target?.current) return;
    focusArmed.current = false;
    target.current.focus();
  }, [stage, busy]);
  const go = (next) => { focusArmed.current = true; setStage(next); };
  const append = (...items) => setTurns((current) => [...current, ...items]);
  const stop = (message, detail) => {
    if (detail) console.warn("[envoy] the model call failed:", detail);
    setProblem(message);
    go(IDLE);
  };
  const run = (work) => {
    const guarded = async () => {
      try {
        await work();
      } catch (error) {
        console.warn("[envoy] the envoy failed:", error);
        stop(TALK_FAILED);
      }
    };
    return runAction ? runAction(guarded) : guarded();
  };
  const reply = async (said, outcome, history) => {
    try {
      const view = await getEnvoyViewForModel(realm.id);
      if (!view) return { ok: false, reason: MODEL_VIEW_FAILED };
      return await replyAsRuler({ realmId: realm.id, text: said, history, view, outcome });
    } catch (error) {
      console.warn("[envoy] the reply failed:", error);
      return { ok: false, reason: TALK_FAILED };
    }
  };
  const say = (event) => {
    event.preventDefault();
    const said = text.trim();
    if (!said || busy || stage.kind !== "idle") return undefined;
    const history = turns.filter((turn) => turn.from !== "note").map((turn) => ({ role: turn.from, text: turn.text }));
    return run(async () => {
      setProblem("");
      setStage({ kind: "working", label: "Modellen läser budskapet…" });
      const view = await getEnvoyViewForModel(realm.id);
      if (!view) return stop(MODEL_VIEW_FAILED);
      const read = await extractEnvoyRequest({ realmId: realm.id, text: said, history, view });
      if (!read?.ok) return stop(playerText(read?.reason, REQUEST_FAILED), read?.detail);
      if (!read.request) {
        // A message that asks for nothing: no order, no roll, the ruler simply answers.
        setStage({ kind: "working", label: `${realm.rulerName} svarar…` });
        const answer = await reply(said, null, history);
        if (!answer?.ok) return stop(playerText(answer?.reason, TALK_FAILED), answer?.detail);
        append({ from: "player", text: said }, { from: "speaker", text: answer.reply });
        setText("");
        return go(IDLE);
      }
      const estimate = await estimateEnvoyForView(read.request);
      if (!estimate?.ok) return stop(playerText(estimate?.reason, REQUEST_FAILED));
      return go({ kind: "confirm", said, history, request: read.request, estimate });
    });
  };
  // An engine refusal (a stale revision, an empty treasury) is shown alone: the ruler has decided nothing.
  const send = (card) => run(async () => {
    setStage({ kind: "working", label: "Sändebudet rider…" });
    let result;
    try {
      result = await submitEnvoyRequest(card.request, { expectedRevision: card.estimate.revision });
    } catch (error) {
      // The write may have landed: the player is sent to the chronicle, not told that the ruler failed to answer.
      console.warn("[envoy] the submit failed:", error);
      return stop(SUBMIT_UNKNOWN);
    }
    if (!result?.ok) return stop(playerText(result?.error, SUBMIT_FAILED));
    const record = decidedEnvoy(result, card.request);
    const notes = record ? envoyNotes(record, card.request, realm.rulerName) : ["Sändebudet är avgjort. Läs utfallet i krönikan."];
    append({ from: "player", text: card.said }, ...notes.map((note) => ({ from: "note", text: note })));
    setText("");
    if (!record) return go(IDLE);
    setStage({ kind: "working", label: `${realm.rulerName} svarar…` });
    const answer = await reply(card.said, { kind: record.kind, accepted: record.accepted }, card.history);
    if (!answer?.ok && answer?.detail) console.warn("[envoy] the reply failed:", answer.detail);
    append(answer?.ok ? { from: "speaker", text: answer.reply } : { from: "note", text: REPLY_NOTE });
    return go(IDLE);
  });
  const ruler = { name: realm.rulerName };
  return <section className="char-card char-talk" aria-label={`Sändebud till ${realm.name}`}>
    <div className="char-section-heading"><div><span className="char-eyebrow">Sändebud</span><h4>Budskap till {realm.rulerName}</h4></div>
      {onClose && <button type="button" className="char-text-button" disabled={busy || stage.kind === "working"} onClick={onClose}>Stäng</button>}</div>
    <Transcript turns={turns} person={ruler} empty={`Skriv budskapet som sändebudet ska bära till ${realm.rulerName}.`} />
    {problem && <p className="char-reason" role="alert">{problem}</p>}
    {stage.kind === "working" && <p className="char-caption" role="status">{stage.label}</p>}
    {stage.kind === "confirm" && <EnvoyCard card={stage} realm={realm} busy={busy} focusRef={cardRef} onSend={() => send(stage)} onCancel={() => go(IDLE)} />}
    <form className="char-talk-form" onSubmit={say}>
      <label htmlFor={`char-envoy-text-${realm.id}`}>Vad ska sändebudet säga?</label>
      <textarea id={`char-envoy-text-${realm.id}`} ref={textRef} rows={3} maxLength={500} value={text} disabled={busy || stage.kind !== "idle"}
        placeholder="Till exempel: Låt oss lägga det gamla bakom oss. Jag sänder 20 silver som gåva."
        onChange={(event) => setText(event.target.value)} />
      <button type="submit" className="char-button char-button--primary" disabled={busy || stage.kind !== "idle" || !text.trim()}>Skicka budskapet</button>
    </form>
  </section>;
}
