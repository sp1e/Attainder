import React, { useState } from "react";
import { parseGameDate } from "../../runtime/gameDates.js";
import { getCharacterPresentation } from "../../runtime/characters/index.js";
import { estimateCharacterActionForView, recordCharacterNarrative, submitCharacterCommand } from "../../runtime/characterRuntime.js";
import { interpretCharacterAction, narrateCharacterResolution } from "./characterModelCalls.js";

// The character panel's own action: free text interpreted by the model, a confirmation card with the engine's odds,
// the full catalog as a menu fallback, and the list of the family's running schemes. The model never sets odds;
// odds come from the engine, and only an estimate's `display` reaches the markup. Model-written text is rendered
// as plain React text.

export const TIER_HEADINGS = Object.freeze({
  clean_success: "Lyckat i det tysta",
  exposed_success: "Lyckat men avslöjat",
  quiet_failure: "Misslyckat i det tysta",
  exposed_failure: "Misslyckat och avslöjat",
  backfire: "Det slog tillbaka",
});
const NARRATE_FAILED = "Berättelsen kunde inte skrivas; utfallet gäller.";
const INTERPRET_FAILED = "Texten kunde inte tolkas. Välj en handling i listan.";
const ACTION_FAILED = "Handlingen kunde inte genomföras.";
const COMMAND_GROUP = ["command", "Förvaltning och hushåll"];
const CATEGORY_LABELS = [["intrigue", "Intrig"], ["diplomacy", "Diplomati"], ["family", "Familj"], ["court", "Hovet"],
  ["military", "Krigföring"], ["religion", "Tro"], ["economy", "Ekonomi"], ["personal", "Personligt"]];
const MINUS = "−";

const entries = (value) => Array.isArray(value) ? value : Object.values(value || {});
const dateLabel = (value) => {
  const date = parseGameDate(value);
  return date ? `${date.day}/${date.month} ${Math.abs(date.year)}${date.year < 0 ? " f.Kr." : " e.Kr."}` : String(value ?? "—");
};
const signedValue = (value) => value > 0 ? `+${value}` : value < 0 ? `${MINUS}${Math.abs(value)}` : "0";
const nameOf = (view, id) => entries(view?.people).find((person) => person.id === id)?.name || "Okänd person";

/** A contested entry's cost is an object; a command entry's cost is already a display string. */
export function formatCost(cost) {
  if (typeof cost === "string") return cost;
  if (!cost || typeof cost !== "object") return "Ingen myntkostnad";
  const purse = cost.wallet === "realm" ? "statskassan" : "familjekassan";
  const orders = Number(cost.orders) || 0;
  return `${Number(cost.silver) || 0} silver ur ${purse} · ${orders} ${orders === 1 ? "handling" : "handlingar"}`;
}

// Exact precision gives numbers; five and three give band labels. Neither is rebuilt here: `display` is final.
const oddsText = (value) => typeof value === "number" ? `${value} %` : String(value ?? "—");
const modifierText = (row) => `${row.label}: ${Object.hasOwn(row, "value") ? signedValue(row.value) : row.sign}`;

/** Turns a catalog entry and its payload into a confirmation step. A contested entry needs the engine's odds first. */
export async function proposalFor({ entry, payload, estimate, explanation = "" }) {
  if (entry.mode !== "contested") return { kind: "confirm", proposal: { mode: "command", catalogId: entry.catalogId, entry, payload: payload || {}, explanation } };
  const odds = await estimate(payload);
  if (!odds?.ok) return { kind: "menu", reason: odds?.reason || "Chansen kunde inte beräknas." };
  return { kind: "confirm", proposal: { mode: "contested", catalogId: entry.catalogId, entry, payload, estimate: odds, explanation } };
}

/** Interprets the player's text. Resolves to { kind: 'confirm', proposal } or { kind: 'menu', reason } when the menu should take over. */
export async function prepareInterpretedAction({ text, view, interpret, estimate }) {
  let answer;
  try {
    answer = await interpret({ text, view });
  } catch (error) {
    console.warn("[character action] interpret threw for the player's text:", error);
    return { kind: "menu", reason: INTERPRET_FAILED };
  }
  if (!answer?.ok) return { kind: "menu", reason: answer?.reason || INTERPRET_FAILED };
  const entry = entries(view?.catalog).find((item) => item.catalogId === answer.catalogId);
  if (!entry) return { kind: "menu", reason: INTERPRET_FAILED };
  return proposalFor({ entry, payload: answer.payload, estimate, explanation: answer.explanation || "" });
}

const failedOutcome = (result) => ({ ok: false, heading: "Handlingen kunde inte genomföras", text: result?.error || ACTION_FAILED });

/**
 * Carries out a confirmed proposal. A command entry submits its own command. A contested entry submits attempt_action,
 * then asks the model for the story and saves it through recordNarrative (origin 'narrate'). A failed story leaves the
 * engine's default text and a note; the outcome stands either way.
 */
export async function executeProposal({ proposal, view, submit, narrate, recordNarrative, present, onProgress = () => {} }) {
  if (proposal.mode !== "contested") {
    const result = await submit(proposal.catalogId, proposal.payload);
    if (!result?.ok) return failedOutcome(result);
    const last = entries(result.events).at(-1);
    return { ok: true, heading: proposal.entry?.label || "Beslutet är fattat", title: last?.title || "", text: last?.description || "Beslutet har sparats i kampanjen." };
  }
  const seenResolutions = new Set(entries(view?.recentResolutions).map((item) => item.id));
  const seenSchemes = new Set(entries(view?.schemes).map((item) => item.id));
  const result = await submit("attempt_action", proposal.payload);
  if (!result?.ok) return failedOutcome(result);
  const after = result.state ? present(result.state) : null;
  // The outcome event is titled "<label>: <tier>"; a refresh after the command may add later events.
  const told = entries(result.events);
  const last = told.find((event) => String(event?.title || "").startsWith(`${proposal.entry?.label}:`)) || told.at(-1);
  const standard = { title: last?.title || "", text: last?.description || "" };
  const resolution = entries(after?.recentResolutions).find((item) => !seenResolutions.has(item.id));
  if (!resolution) {
    const scheme = entries(after?.schemes).find((item) => !seenSchemes.has(item.id));
    if (!scheme) return { ok: true, heading: proposal.entry?.label || "Handlingen är genomförd", ...standard };
    return { ok: true, heading: "Intrigen har inletts", title: `${scheme.actionLabel}: ${entries(scheme.targetNames).join(", ")}`,
      text: `Planen avgörs ${dateLabel(scheme.dueAt)}. Du kan avbryta den under Pågående intriger.` };
  }
  if (resolution.refused) return { ok: true, heading: resolution.tierLabel || "Ordern vägrades", ...standard };
  const heading = TIER_HEADINGS[resolution.tier] || resolution.tierLabel || "Utfall";
  // The tier is settled; show it while the model writes the story.
  onProgress({ ok: true, heading, ...standard, pending: "Modellen skriver berättelsen…" });
  let story = null;
  try {
    story = await narrate({ resolution, view: after });
  } catch (error) {
    console.warn(`[character action] narrate threw for ${resolution.id}:`, error);
  }
  if (story?.ok) {
    const saved = await recordNarrative({ resolutionId: resolution.id, title: story.title, narrative: story.narrative, adjustments: story.adjustments });
    if (saved?.ok) return { ok: true, heading, title: story.title, text: story.narrative };
    console.warn(`[character action] the narrative for ${resolution.id} was refused:`, saved?.error);
  }
  return { ok: true, heading, ...standard, note: NARRATE_FAILED };
}

function ProposalFacts({ proposal, view }) {
  const { entry, payload } = proposal;
  if (proposal.mode !== "contested") {
    return <ul className="char-confirm-facts">
      {entry.actorName && <li>Utförs av: {entry.actorName}</li>}
      {entries(entry.fields).map((field) => <li key={field.key}>{field.label}: {field.options?.find((option) => option.value === payload[field.key])?.label ?? String(payload[field.key] ?? "—")}</li>)}
      <li>Kostnad: {formatCost(entry.cost)}</li>
      {entry.stress && entry.stress !== "0" && <li>Stress: {entry.stress}</li>}
    </ul>;
  }
  const agentField = entries(entry.fields).find((field) => field.key === "agentRoles");
  const roles = entries(payload.means?.agentRoles).map((role) => agentField?.options?.find((option) => option.value === role)?.label || role);
  const display = proposal.estimate.display;
  return <>
    <ul className="char-confirm-facts">
      <li>Utförs av: {nameOf(view, payload.actorId)}</li>
      <li>Mål: {entries(payload.targetIds).map((id) => nameOf(view, id)).join(", ")}</li>
      <li>Extra silver: {Number(payload.means?.silver) || 0}</li>
      <li>Agenter: {roles.length ? roles.join(", ") : "inga"}</li>
      <li>Kostnad: {formatCost(proposal.estimate.cost ?? entry.cost)}</li>
    </ul>
    <ul className="char-confirm-odds">
      <li>Chans att lyckas: {oddsText(display.success)}</li>
      <li>Chans att hållas hemlig: {oddsText(display.secrecy)}</li>
    </ul>
    {entries(display.modifiers).length > 0 && <details className="char-explanation"><summary>Vad påverkar chansen?</summary>
      <ul>{entries(display.modifiers).map((row, index) => <li key={`${row.label}-${index}`}>{modifierText(row)}</li>)}</ul>
    </details>}
  </>;
}

export function ConfirmationCard({ proposal, view, onConfirm, onCancel, busy = false }) {
  return <section className="char-confirm" aria-label="Bekräfta handlingen">
    <span className="char-eyebrow">{proposal.mode === "contested" ? "Omstridd handling" : "Beslut"}</span>
    <h4>{proposal.entry.label}</h4>
    {proposal.explanation && <p className="char-caption">{proposal.explanation}</p>}
    <ProposalFacts proposal={proposal} view={view} />
    <div className="char-confirm-buttons">
      <button type="button" className="char-button char-button--primary" disabled={busy} onClick={onConfirm}>Genomför</button>
      <button type="button" className="char-button" disabled={busy} onClick={onCancel}>Avbryt</button>
    </div>
  </section>;
}

export function ContestedForm({ entry, view, onPropose, busy = false }) {
  const field = (key) => entries(entry.fields).find((item) => item.key === key);
  const targetField = field("targetId"), silverField = field("silver"), agentField = field("agentRoles");
  const [targetId, setTargetId] = useState(() => targetField?.options?.[0]?.value ?? "");
  const [silver, setSilver] = useState("0");
  const [roles, setRoles] = useState([]);
  const maxAgents = agentField?.max ?? 2;
  const disabled = busy || Boolean(entry.disabledReason);
  const staffName = (role) => entries(view?.staff).find((member) => member.role === role)?.name;
  const toggle = (role) => setRoles((current) => current.includes(role) ? current.filter((item) => item !== role) : [...current, role]);
  const submit = (event) => {
    event.preventDefault();
    onPropose(entry, { actionId: entry.catalogId, actorId: view?.representative?.id ?? null, targetIds: [targetId], means: { silver: Number(silver) || 0, agentRoles: roles } });
  };
  return <form className="char-contested-form" onSubmit={submit}>
    <label>{targetField?.label || "Mål"}<select value={targetId} onChange={(event) => setTargetId(event.target.value)} disabled={disabled} required>
      {!targetField?.options?.length && <option value="">Ingen giltig kandidat</option>}
      {entries(targetField?.options).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select></label>
    <label>{silverField?.label || "Extra silver"}<input type="number" min={silverField?.min ?? 0} max={silverField?.max ?? 60} step={silverField?.step ?? 1} value={silver} onChange={(event) => setSilver(event.target.value)} disabled={disabled} /></label>
    <fieldset className="char-agents" disabled={disabled}>
      <legend>{agentField?.label || "Agenter"} <small>Högst {maxAgents} agenter</small></legend>
      {entries(agentField?.options).map((option) => {
        const checked = roles.includes(option.value);
        const name = staffName(option.value);
        return <label className="char-checkbox" key={option.value}><input type="checkbox" checked={checked} disabled={!checked && roles.length >= maxAgents} onChange={() => toggle(option.value)} />{name ? `${option.label} · ${name}` : option.label}</label>;
      })}
    </fieldset>
    {entry.disabledReason && <p className="char-reason">{entry.disabledReason}</p>}
    <button type="submit" className="char-button char-button--primary" disabled={disabled || !targetId}>Visa chansen</button>
  </form>;
}

function ContestedCard({ entry, view, onPropose, busy }) {
  return <details className={`char-action${entry.disabledReason ? " char-action--unavailable" : ""}`}>
    <summary><span><strong>{entry.label}</strong><small>{formatCost(entry.cost)}{entry.durationMonths > 0 ? ` · pågår ${entry.durationMonths} månader` : ""}</small></span><span aria-hidden="true">＋</span></summary>
    <div className="char-action-body"><p>{entry.description}</p><ContestedForm entry={entry} view={view} onPropose={onPropose} busy={busy} /></div>
  </details>;
}

/** Every catalog entry, grouped by category. A disabled entry stays listed with its reason. */
export function ActionMenu({ view, reason = "", CommandCard, onPropose, onClose, busy = false }) {
  const catalog = entries(view?.catalog);
  const groups = [COMMAND_GROUP, ...CATEGORY_LABELS].map(([key, label]) => [key, label,
    catalog.filter((entry) => key === "command" ? entry.mode !== "contested" : entry.mode === "contested" && entry.category === key)]);
  const known = new Set(CATEGORY_LABELS.map(([key]) => key));
  const other = catalog.filter((entry) => entry.mode === "contested" && !known.has(entry.category));
  if (other.length) groups.push(["other", "Övrigt", other]);
  return <section className="char-action-menu" aria-label="Alla handlingar">
    {reason && <p className="char-reason" role="status">{reason}</p>}
    <div className="char-section-heading"><p className="char-caption">Välj en handling. Omstridda handlingar visar chansen innan du bestämmer dig.</p>{onClose && <button type="button" className="char-text-button" onClick={onClose}>Stäng listan</button>}</div>
    {groups.filter(([, , items]) => items.length).map(([key, label, items]) => <div className="char-action-group" key={key}>
      <h4>{label}</h4>
      <ul className="char-actions-grid">{items.map((entry) => <li key={`${entry.catalogId}-${view?.revision ?? 0}`} data-catalog-id={entry.catalogId}>
        {entry.mode === "contested"
          ? <ContestedCard entry={entry} view={view} onPropose={onPropose} busy={busy} />
          : CommandCard && <CommandCard action={entry} busy={busy} onCommand={(type, values) => onPropose(entry, values)} />}
      </li>)}</ul>
    </div>)}
  </section>;
}

export function OutcomeCard({ outcome, onDone }) {
  const paragraphs = String(outcome.text || "").split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  return <section className={`char-outcome${outcome.ok ? "" : " char-outcome--error"}`} role="status" aria-label="Utfall">
    <span className="char-eyebrow">Utfall</span>
    <h4>{outcome.heading}</h4>
    {outcome.title && <strong className="char-outcome-title">{outcome.title}</strong>}
    {paragraphs.map((part, index) => <p key={index}>{part}</p>)}
    {outcome.note && <p className="char-caption">{outcome.note}</p>}
    {outcome.pending && <p className="char-caption">{outcome.pending}</p>}
    {onDone && !outcome.pending && <button type="button" className="char-button" onClick={onDone}>Ny handling</button>}
  </section>;
}

/** The controlled family's active schemes, each with an abort button. Renders nothing without schemes. */
export function SchemeList({ schemes, onAbort, busy = false }) {
  const list = entries(schemes);
  if (!list.length) return null;
  return <section className="char-schemes" aria-label="Pågående intriger">
    <div className="char-section-heading"><div><span className="char-eyebrow">Planer i det fördolda</span><h3>Pågående intriger</h3></div></div>
    <ul className="char-scheme-list">{list.map((scheme) => <li className="char-card char-scheme" key={scheme.id}>
      <strong>{scheme.actionLabel}</strong>
      <span>Mål: {entries(scheme.targetNames).join(", ") || "—"}</span>
      {scheme.actorName && <span>Utförs av: {scheme.actorName}</span>}
      <span>Avgörs: {dateLabel(scheme.dueAt)}</span>
      <button type="button" className="char-button" disabled={busy} onClick={() => onAbort(scheme.id)}>Avbryt intrigen</button>
    </li>)}</ul>
    <p className="char-caption">En avbruten intrig ger inte tillbaka silver eller handling.</p>
  </section>;
}

const IDLE = Object.freeze({ kind: "idle" });

export default function ActionBox({ view, busy = false, runAction, CommandCard }) {
  const [text, setText] = useState("");
  const [stage, setStage] = useState(IDLE);
  const run = (work) => {
    const guarded = async () => {
      try {
        await work();
      } catch (error) {
        console.warn("[character action] the action flow failed:", error);
        setStage({ kind: "outcome", outcome: { ok: false, heading: "Handlingen kunde inte genomföras", text: "Något gick fel. Försök igen eller välj en handling i listan." } });
      }
    };
    return runAction ? runAction(guarded) : guarded();
  };
  const show = (step) => setStage(step.kind === "confirm" ? { kind: "confirm", proposal: step.proposal } : { kind: "menu", reason: step.reason });
  const interpret = (event) => {
    event.preventDefault();
    if (!text.trim()) return;
    run(async () => {
      setStage({ kind: "working", label: "Modellen tolkar din text…" });
      show(await prepareInterpretedAction({ text: text.trim(), view, interpret: interpretCharacterAction, estimate: estimateCharacterActionForView }));
    });
  };
  const propose = (entry, payload) => {
    if (entry.mode !== "contested") { setStage({ kind: "confirm", proposal: { mode: "command", catalogId: entry.catalogId, entry, payload, explanation: "" } }); return; }
    run(async () => {
      setStage({ kind: "working", label: "Chansen beräknas…" });
      show(await proposalFor({ entry, payload, estimate: estimateCharacterActionForView }));
    });
  };
  const confirm = (proposal) => run(async () => {
    setStage({ kind: "working", label: "Handlingen genomförs…" });
    const submit = (type, payload) => submitCharacterCommand({ type, payload, expectedRevision: view?.revision, id: `ui-${crypto.randomUUID()}` });
    const outcome = await executeProposal({ proposal, view, submit, narrate: narrateCharacterResolution, recordNarrative: recordCharacterNarrative,
      present: getCharacterPresentation, onProgress: (interim) => setStage({ kind: "outcome", outcome: interim }) });
    setStage({ kind: "outcome", outcome });
    if (outcome.ok) setText("");
  });
  return <section className="char-card char-action-box" aria-label="Egen handling">
    <div className="char-section-heading"><div><span className="char-eyebrow">Din företrädares nästa drag</span><h3>Handla själv</h3></div></div>
    <form className="char-action-text" onSubmit={interpret}>
      <label htmlFor="char-action-text">Vad vill du göra?</label>
      <textarea id="char-action-text" rows={3} maxLength={500} value={text} disabled={busy} placeholder="Till exempel: Jag vill vinna min kusins gunst med vänliga ord."
        onChange={(event) => setText(event.target.value)} />
      <div className="char-action-text-controls">
        <button type="submit" className="char-button char-button--primary" disabled={busy || !text.trim()}>Tolka</button>
        <button type="button" className="char-text-button" disabled={busy} onClick={() => setStage({ kind: "menu", reason: "" })}>Välj från listan</button>
      </div>
    </form>
    {stage.kind === "working" && <p className="char-caption" role="status">{stage.label}</p>}
    {stage.kind === "confirm" && <ConfirmationCard proposal={stage.proposal} view={view} busy={busy} onConfirm={() => confirm(stage.proposal)} onCancel={() => setStage(IDLE)} />}
    {stage.kind === "menu" && <ActionMenu view={view} reason={stage.reason} CommandCard={CommandCard} busy={busy} onPropose={propose} onClose={() => setStage(IDLE)} />}
    {stage.kind === "outcome" && <OutcomeCard outcome={stage.outcome} onDone={() => setStage(IDLE)} />}
  </section>;
}
