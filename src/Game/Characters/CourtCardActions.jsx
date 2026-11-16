// What the player can do with the person of the card: the panel's actions that name the person. A row unfolds into the
// action's own form, with the person filled in. What is listed is decided by `actionsOf` (courtShell.js).
// Spec: docs/superpowers/specs/2026-11-15-court-shell-design.md, slice 3.
import React, { useState } from "react";
import { Actor, stressText } from "./CourtMatter.jsx";

// The chosen option of a field, or its first while the player has chosen none or the chosen one has left the list.
const chosen = (field, values) => (field.options.some((option) => String(option.value) === String(values[field.key])) ? values[field.key] : field.options[0].value);

const ActionForm = ({ action, busy, updates, onAct }) => {
  const [values, setValues] = useState({});
  const stress = stressText(action.stress, updates);
  const send = (event) => {
    event.preventDefault();
    onAct(action, Object.fromEntries(action.fields.map((field) => [field.key, chosen(field, values)])));
  };
  return (
    <form className="court-act-form" id={`court-act-${action.type}`} onSubmit={send}>
      {action.description && <p>{action.description}</p>}
      <Actor actorName={action.actorName} />
      {stress && <small>{stress}</small>}
      {action.fields.map((field) => (
        <label key={field.key}>
          <span>{field.label}</span>
          <select value={chosen(field, values)} disabled={busy} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}>
            {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      ))}
      <button type="submit" className="court-act-send" disabled={busy}>{action.label}</button>
    </form>
  );
};

/** `children` is the section's heading: the shell writes it, beside its other Swedish text. */
export default function CourtCardActions({ actions, openType, busy, error, notice, updates, onToggle, onAct, children }) {
  if (!actions.length && !notice && !error) return null;
  return (
    <section className="court-acts" aria-labelledby="court-acts-title">
      <h3 id="court-acts-title">{children}</h3>
      {notice && <p className="court-notice" role="status">{notice}</p>}
      {error && <p className="court-refusal" role="alert">{error}</p>}
      <ul>
        {actions.map((action) => {
          const open = action.type === openType;
          return (
            <li key={action.type} className={open ? "court-act-open" : undefined}>
              <button type="button" className="court-act" aria-expanded={open} aria-controls={open ? `court-act-${action.type}` : undefined} data-court-act={action.type} onClick={() => onToggle(action.type)}>
                <b>{action.label}</b>
                {action.cost && <small>{action.cost}</small>}
              </button>
              {open && <ActionForm action={action} busy={busy} updates={updates} onAct={onAct} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
