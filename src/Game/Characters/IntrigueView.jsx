import React, { useEffect, useRef, useState } from "react";
import { SchemeList, dateLabel, playerText } from "./ActionBox.jsx";

// The Intriger tab: the secrets and grips the representative holds, the prisoners of the controlled family, the rumors it has
// heard, and the running schemes. Everything shown comes from the presentation (knownSecrets, ownHooks, prisoners, rumors,
// schemes); the true source of a rumor and who else holds a secret never reach it. All text is rendered as React text.

const PRISONER_FAILED = "Handlingen kunde inte genomföras. Försök igen om en stund.";
const NO_DECISION = "Ingen kan besluta om fångarna just nu.";
const HEADING_ID = "char-intrigue-heading";

const entries = (value) => Array.isArray(value) ? value : Object.values(value || {});
const silver = (value) => Number.isFinite(Number(value)) ? new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 }).format(Number(value)) : "—";

function Section({ label, eyebrow, title, children }) {
  return <section className="char-intrigue-section" aria-label={label}>
    <div className="char-section-heading"><div><span className="char-eyebrow">{eyebrow}</span><h3>{title}</h3></div></div>
    {children}
  </section>;
}

function SecretList({ secrets }) {
  const list = entries(secrets);
  return <Section label="Hemligheter du känner till" eyebrow="Det du vet om andra" title="Hemligheter du känner till">
    {list.length ? <ul className="char-intrigue-list">{list.map((secret) => <li className="char-card char-secret" key={secret.id}>
      <strong>{secret.typeLabel || secret.type}</strong>
      <span>Gäller: {secret.subjectName || "Okänd person"}</span>
      <span>Bevis: {secret.evidenceLabel || "okänt"}</span>
      {secret.exposed && <span className="char-badge char-badge--warning">avslöjad</span>}
    </li>)}</ul> : <p className="char-caption">Du känner inga hemligheter ännu.</p>}
  </Section>;
}

function HookList({ hooks }) {
  const list = entries(hooks);
  return <Section label="Grepp" eyebrow="Det du kan pressa med" title="Grepp">
    {list.length ? <ul className="char-intrigue-list">{list.map((hook) => <li className="char-card char-hook" key={hook.id}>
      <strong>Grepp över {hook.targetName || "en okänd person"}</strong>
      <span>Styrka: {hook.strengthLabel || hook.strength}</span>
      <span className="char-caption">{hook.strength === "weak" ? "Går åt när du använder det." : "Kan användas flera gånger."}</span>
    </li>)}</ul> : <p className="char-caption">Du har inga grepp över någon.</p>}
  </Section>;
}

function RumorList({ rumors }) {
  const list = entries(rumors);
  return <Section label="Rykten" eyebrow="Vad ryktet säger" title="Rykten">
    {list.length ? <ul className="char-intrigue-list">{list.map((rumor) => <li className="char-card char-rumor" key={rumor.id}>
      <strong>{rumor.topicLabel || rumor.topic}: {rumor.subjectName || "okänd"}</strong>
      <span className="char-caption">{dateLabel(rumor.date)}</span>
      <span>Påstådd aktör: {rumor.claimedActorName || "okänd"}</span>
      <span>Tillförlitlighet: {rumor.reliability}</span>
    </li>)}</ul> : <p className="char-caption">Du har inte hört några rykten.</p>}
  </Section>;
}

// The reason the engine gives on its release_prisoner or execute_prisoner entry, or NO_DECISION when it lists no such entry (no one can act).
const blockedBy = (actions, type) => { const entry = entries(actions).find((action) => action.type === type); return entry ? entry.disabledReason || "" : NO_DECISION; };

// The reasons shown before the prisoner list, once when both commands share one, and the id each button points to.
function prisonerBlocks(actions) {
  const release = blockedBy(actions, "release_prisoner"), execute = blockedBy(actions, "execute_prisoner");
  if (release && release === execute) return { lines: [{ id: "char-prisoner-blocked", text: release }], release: "char-prisoner-blocked", execute: "char-prisoner-blocked" };
  const lines = [release && { id: "char-prisoner-blocked-release", text: `Frige: ${release}` }, execute && { id: "char-prisoner-blocked-execute", text: `Avrätta: ${execute}` }].filter(Boolean);
  return { lines, release: release ? "char-prisoner-blocked-release" : "", execute: execute ? "char-prisoner-blocked-execute" : "" };
}
const describedBy = (...ids) => ids.filter(Boolean).join(" ") || undefined;

/**
 * The controlled family's prisoners. "Frige" acts at once; "Avrätta" first asks, inside the prisoner's own card, and only
 * the second button executes. Focus follows the player the way the scheme list does: to the question, back to the kept
 * prisoner, on to the next one, or to `onEmpty` when none is left. `onRelease` and `onExecute` resolve to the engine's
 * result; a refusal stays under the prisoner and keeps focus on the control that was refused. `blocks` (prisonerBlocks) disables a
 * command the engine refuses and shows its reason before the list.
 */
function PrisonerList({ prisoners, onRelease, onExecute, onEmpty, busy = false, blocks = prisonerBlocks([]) }) {
  const list = entries(prisoners);
  const [confirming, setConfirming] = useState(null);
  const [refusals, setRefusals] = useState({});
  const [focusTarget, setFocusTarget] = useState(null);
  const focusArmed = useRef(false);
  const focusRef = useRef(null);
  useEffect(() => {
    if (!focusArmed.current || busy) return;
    focusArmed.current = false;
    if (focusTarget?.empty && !list.length) onEmpty?.();
    else focusRef.current?.focus();
  }, [focusTarget, busy, list.length, onEmpty]);
  const focusNext = (target) => { focusArmed.current = true; setFocusTarget(target); };
  const refuse = (id, message) => setRefusals((current) => ({ ...current, [id]: message }));
  const ask = (id) => { setConfirming(id); refuse(id, ""); focusNext({ id, control: "keep" }); };
  const keep = (id) => { setConfirming(null); focusNext({ id, control: "execute" }); };
  const act = async (index, control, work) => {
    const { id } = list[index];
    const next = list[index + 1] ?? list[index - 1];
    let result;
    try {
      result = await work(id);
    } catch (error) {
      result = { ok: false, error: error?.message };
    }
    // No answer means the panel was locked and ignored the click (a double click); the first click decides.
    if (result === undefined) return;
    setConfirming(null);
    if (result?.ok) {
      focusNext(next ? { id: next.id, control: "release" } : { empty: true });
      return;
    }
    refuse(id, playerText(result?.error, PRISONER_FAILED));
    focusNext({ id, control });
  };
  const refFor = (id, control) => focusTarget?.id === id && focusTarget.control === control ? focusRef : undefined;
  return <Section label="Fångar" eyebrow="Hållna i ert fängelse" title="Fångar">
    {list.length ? <>{blocks.lines.map((line) => <p className="char-reason" id={line.id} key={line.id}>{line.text}</p>)}
    <ul className="char-intrigue-list">{list.map((prisoner, index) => <li className="char-card char-prisoner" key={prisoner.id}>
      <strong>{prisoner.name}</strong>
      {prisoner.familyName && <span className="char-caption">{prisoner.familyName}</span>}
      <span>Fånge sedan {dateLabel(prisoner.since)}</span>
      <span>Lösensumma: {silver(prisoner.ransom)} silver</span>
      {confirming === prisoner.id
        ? <div className="char-scheme-confirm" role="group" aria-label={`Bekräfta att ${prisoner.name} avrättas`}>
          <p>Vill du avrätta {prisoner.name}? Det går inte att ångra.</p>
          <div className="char-confirm-buttons">
            <button type="button" className="char-button char-button--danger" disabled={busy || Boolean(blocks.execute)} onClick={() => act(index, "execute", (prisonerId) => onExecute(prisonerId))}>Ja, avrätta</button>
            <button type="button" className="char-button" ref={refFor(prisoner.id, "keep")} onClick={() => keep(prisoner.id)}>Behåll fången</button>
          </div>
        </div>
        : <>
          {refusals[prisoner.id] && <p className="char-reason" id={`char-prisoner-refusal-${prisoner.id}`}>{refusals[prisoner.id]}</p>}
          <div className="char-confirm-buttons">
            <button type="button" className="char-button" ref={refFor(prisoner.id, "release")} disabled={busy || Boolean(blocks.release)} onClick={() => act(index, "release", (prisonerId) => onRelease(prisonerId))}
              aria-describedby={describedBy(blocks.release, refusals[prisoner.id] && `char-prisoner-refusal-${prisoner.id}`)}>Frige</button>
            <button type="button" className="char-button" ref={refFor(prisoner.id, "execute")} disabled={busy || Boolean(blocks.execute)} onClick={() => ask(prisoner.id)}
              aria-describedby={describedBy(blocks.execute, refusals[prisoner.id] && `char-prisoner-refusal-${prisoner.id}`)}>Avrätta</button>
          </div>
        </>}
    </li>)}</ul></> : <p className="char-caption">Inga fångar hålls just nu.</p>}
  </Section>;
}

// With nothing left to act on, focus goes to the tab heading instead of vanishing with the last card.
const focusHeading = () => globalThis.document?.getElementById(HEADING_ID)?.focus();

export default function IntrigueView({ view, busy = false, onCommand, onEmpty = focusHeading }) {
  return <>
    <div className="char-section-heading"><div><span className="char-eyebrow">Det som sker bakom hovets dörrar</span><h3 id={HEADING_ID} tabIndex={-1}>Intriger och hemligheter</h3></div></div>
    <p className="char-intro">Det du vet, det du kan pressa med och det du har hört. Hemligheter och grepp använder du när du handlar under Överblick.</p>
    <SecretList secrets={view.knownSecrets} />
    <HookList hooks={view.ownHooks} />
    <PrisonerList prisoners={view.prisoners} busy={busy} onEmpty={onEmpty} blocks={prisonerBlocks(view.actions)}
      onRelease={(prisonerId) => onCommand("release_prisoner", { prisonerId })} onExecute={(prisonerId) => onCommand("execute_prisoner", { prisonerId })} />
    <RumorList rumors={view.rumors} />
    <SchemeList schemes={view.schemes} busy={busy} onAbort={(schemeId) => onCommand("abort_scheme", { schemeId })} onEmpty={onEmpty} />
  </>;
}
