import React, { useEffect, useRef, useState } from "react";
import { CONVERSATION_REQUESTS } from "../../runtime/characters/conversation.js";
import { estimateConversationForView, getConversationViewForModel, submitConversationRequest } from "../../runtime/characterRuntime.js";
import { extractConversationRequest, replyAsCharacter } from "./characterModelCalls.js";
import { modifierText, oddsText, playerText } from "./ActionBox.jsx";

// A court conversation with one person. The player writes a line; the model reads whether it asks for support, a secret or
// a pledge (extractConversationRequest). A request opens a confirmation card with the engine's odds (only `display`, never
// the true value), the player confirms, the engine rolls (submitConversationRequest) and the person answers in character
// (replyAsCharacter) about an outcome that is already fixed. The transcript is session memory: it lives in the panel's state
// and is never written to storage. All model text is rendered as React text.

const MODEL_VIEW_FAILED = "Kampanjen kunde inte läsas. Försök igen.";
const REQUEST_FAILED = "Samtalet kunde inte tolkas. Försök formulera dig på nytt.";
const SUBMIT_FAILED = "Förfrågan kunde inte sparas. Försök igen om en stund.";
const TALK_FAILED = "Personen kunde inte svara just nu. Försök igen.";
const REPLY_NOTE = "Svaret kunde inte skrivas; utfallet gäller.";
const IDLE = Object.freeze({ kind: "idle" });

// The conversation entry the engine just wrote: the command pushes exactly one, so the newest is the one, once it matches the request.
function decidedEntry(result, request) {
  const entry = result?.state?.conversations?.at?.(-1);
  return entry && entry.personId === request.personId && entry.kind === request.kind && typeof entry.accepted === "boolean" ? entry : null;
}

// The ledger's mark of a speaker who agreed to reveal and had nothing to tell: its secret effect names no secret.
const nothingToTell = (entry) => Array.isArray(entry.effects) && entry.effects.some((effect) => effect.kind === "secret" && effect.secretId === null);

// What the reply hears of the decision, from the engine's entry, so the speaker cannot promise a secret that does not exist.
const replyOutcome = (entry) => ({ kind: entry.kind, accepted: entry.accepted, ...(entry.accepted && nothingToTell(entry) ? { nothingToTell: true } : {}) });

// What happened, in the player's words. Built from the engine's entry, never from the model.
function outcomeNotes(entry, name) {
  const effects = Array.isArray(entry.effects) ? entry.effects : [];
  const paid = effects.find((effect) => effect.kind === "silver");
  const notes = [];
  if (!entry.accepted) notes.push(`${name} avvisar förfrågan.`);
  else if (entry.kind === "support") notes.push(`${name} ger sitt stöd.`);
  else if (entry.kind === "pledge") notes.push(`${name} ger ett löfte. Du har nu ett grepp över ${name}.`);
  else if (nothingToTell(entry)) notes.push(`${name} hade inget att berätta.`);
  else notes.push(`${name} anförtror dig en hemlighet. Du hittar den under Intriger.`);
  if (paid) notes.push(`${paid.amount} silver betalades ur familjekassan.`);
  return notes;
}

function RequestCard({ card, person, busy, onAsk, onCancel, focusRef }) {
  const { request, estimate } = card;
  const display = estimate.display;
  return <section className="char-confirm" aria-label="Bekräfta förfrågan">
    <span className="char-eyebrow">Förfrågan till {person.name}</span>
    <h4 ref={focusRef} tabIndex={-1}>{CONVERSATION_REQUESTS[request.kind]?.label ?? request.kind}</h4>
    <ul className="char-confirm-facts">
      <li>Till: {person.name}</li>
      <li>Erbjuden gåva: {request.offerSilver > 0 ? `${request.offerSilver} silver ur familjekassan` : "ingen"}</li>
      {request.hookId && <li>Du pressar med ett grepp över {person.name}.</li>}
    </ul>
    <ul className="char-confirm-odds"><li>Chans att få ja: {oddsText(display.chance)}</li></ul>
    {(display.modifiers || []).length > 0 && <details className="char-explanation"><summary>Vad påverkar chansen?</summary>
      <ul>{display.modifiers.map((row, index) => <li key={`${row.label}-${index}`}>{modifierText(row)}</li>)}</ul>
    </details>}
    <div className="char-confirm-buttons">
      <button type="button" className="char-button char-button--primary" disabled={busy} onClick={onAsk}>Fråga</button>
      <button type="button" className="char-button" disabled={busy} onClick={onCancel}>Avbryt</button>
    </div>
  </section>;
}

/**
 * The exchange so far; the envoy view (EnvoyView.jsx) uses it with its own `empty` text. What the player typed and what
 * the model answered are marked data-no-translate and stay as written; a note is the game's own text and is not marked.
 */
export function Transcript({ turns, person, empty = `Ni har inte talats vid ännu. Skriv vad du vill säga till ${person.name}.` }) {
  if (!turns.length) return <p className="char-caption">{empty}</p>;
  return <ol className="char-talk-log" aria-label="Samtalet" role="log">{turns.map((turn, index) => turn.from === "note"
    ? <li className="char-talk-note" key={index}>{turn.text}</li>
    : <li className={`char-talk-turn char-talk-turn--${turn.from}`} key={index}><strong>{turn.from === "player" ? "Du" : person.name}</strong><p data-no-translate>{turn.text}</p></li>)}</ol>;
}

export default function ConversationView({ person, turns = [], setTurns, busy = false, runAction, onClose, onHold }) {
  const [text, setText] = useState("");
  const [stage, setStage] = useState(IDLE);
  const [problem, setProblem] = useState("");
  // Focus follows the player's own steps: a handler arms it, and it lands once the panel is no longer busy.
  const focusArmed = useRef(false);
  const textRef = useRef(null), cardRef = useRef(null);
  useEffect(() => { textRef.current?.focus(); }, []);
  // An open confirmation card holds the panel's clock: its odds belong to one revision, and the panel passes the hold on.
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
    if (detail) console.warn("[court conversation] the model call failed:", detail);
    setProblem(message);
    go(IDLE);
  };
  const run = (work) => {
    const guarded = async () => {
      try {
        await work();
      } catch (error) {
        console.warn("[court conversation] the conversation failed:", error);
        stop(TALK_FAILED);
      }
    };
    return runAction ? runAction(guarded) : guarded();
  };
  // The view the model reads is rebuilt before each call, so the brief matches the state the engine will use.
  const reply = async (said, outcome, history) => {
    try {
      const view = await getConversationViewForModel(person.id);
      if (!view) return { ok: false, reason: MODEL_VIEW_FAILED };
      return await replyAsCharacter({ personId: person.id, text: said, history, view, outcome });
    } catch (error) {
      console.warn("[court conversation] the reply failed:", error);
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
      setStage({ kind: "working", label: "Modellen läser vad du säger…" });
      const view = await getConversationViewForModel(person.id);
      if (!view) return stop(MODEL_VIEW_FAILED);
      const read = await extractConversationRequest({ personId: person.id, text: said, history, view });
      if (!read?.ok) return stop(playerText(read?.reason, REQUEST_FAILED), read?.detail);
      if (!read.request) {
        // Small talk: no odds and no roll, the person simply answers.
        setStage({ kind: "working", label: `${person.name} svarar…` });
        const answer = await reply(said, null, history);
        if (!answer?.ok) return stop(playerText(answer?.reason, TALK_FAILED), answer?.detail);
        append({ from: "player", text: said }, { from: "speaker", text: answer.reply });
        setText("");
        return go(IDLE);
      }
      const estimate = await estimateConversationForView(read.request);
      if (!estimate?.ok) return stop(playerText(estimate?.reason, REQUEST_FAILED));
      return go({ kind: "confirm", said, history, request: read.request, estimate });
    });
  };
  // An engine refusal (a stale revision, no silver) is shown alone: the person has decided nothing, so nobody answers as if they had.
  const ask = (card) => run(async () => {
    setStage({ kind: "working", label: "Du ställer din fråga…" });
    const result = await submitConversationRequest(card.request, { expectedRevision: card.estimate.revision });
    if (!result?.ok) return stop(playerText(result?.error, SUBMIT_FAILED));
    const entry = decidedEntry(result, card.request);
    append({ from: "player", text: card.said }, ...(entry ? outcomeNotes(entry, person.name) : ["Förfrågan är avgjord. Läs utfallet i krönikan."]).map((note) => ({ from: "note", text: note })));
    setText("");
    if (!entry) return go(IDLE);
    setStage({ kind: "working", label: `${person.name} svarar…` });
    const answer = await reply(card.said, replyOutcome(entry), card.history);
    if (!answer?.ok && answer?.detail) console.warn("[court conversation] the reply failed:", answer.detail);
    append(answer?.ok ? { from: "speaker", text: answer.reply } : { from: "note", text: REPLY_NOTE });
    return go(IDLE);
  });
  return <section className="char-card char-talk" aria-label={`Samtal med ${person.name}`}>
    <div className="char-section-heading"><div><span className="char-eyebrow">Hovets samtal</span><h4>Samtal med {person.name}</h4></div>
      {onClose && <button type="button" className="char-text-button" onClick={onClose}>Avsluta samtalet</button>}</div>
    <Transcript turns={turns} person={person} />
    {problem && <p className="char-reason" role="alert">{problem}</p>}
    {stage.kind === "working" && <p className="char-caption" role="status">{stage.label}</p>}
    {stage.kind === "confirm" && <RequestCard card={stage} person={person} busy={busy} focusRef={cardRef} onAsk={() => ask(stage)} onCancel={() => go(IDLE)} />}
    <form className="char-talk-form" onSubmit={say}>
      <label htmlFor="char-talk-text">Vad säger du?</label>
      <textarea id="char-talk-text" ref={textRef} rows={3} maxLength={500} value={text} disabled={busy || stage.kind !== "idle"}
        placeholder="Till exempel: Jag behöver ditt stöd, och jag lovar dig 20 silver."
        onChange={(event) => setText(event.target.value)} />
      <button type="submit" className="char-button char-button--primary" disabled={busy || stage.kind !== "idle" || !text.trim()}>Säg det</button>
    </form>
  </section>;
}
