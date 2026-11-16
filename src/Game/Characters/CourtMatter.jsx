// One matter of "Kräver dig": the row, and under it, while the matter is open, what it is about and its choices.
// A press on a choice answers. What an answer holds is decided by `answerOf` (courtShell.js).
// Spec: docs/superpowers/specs/2026-11-15-court-shell-design.md, slice 3.
import React from "react";
import { characterNumberLocale } from "../../runtime/characterLanguage.js";
import { readNative } from "../../runtime/useTranslatorUpdates.js";
import { medallionOf } from "../Map/seatRulers.js";
import { dateLabel, modifierText, oddsText } from "./ActionBox.jsx";
import MedallionPicture from "./MedallionPicture.jsx";

/**
 * The stress a choice or an action costs, as the panel writes it; nothing for a stress of nothing. `updates` is the
 * translator's count: the React Compiler keeps a call's result until an argument changes, and the number's locale
 * follows the language.
 */
export const stressText = (value, updates) => {
  void updates;
  if (value === null || value === undefined || value === "") return "";
  if (!/^-?\d+(\.\d+)?$/.test(String(value))) return String(value);
  const number = Number(value);
  if (number === 0) return "";
  const signed = (amount) => `${amount > 0 ? "+" : ""}${new Intl.NumberFormat(characterNumberLocale(), { maximumFractionDigits: 1 }).format(amount)}`;
  return `Stress ${signed(number)}`;
};

/** Who carries a choice or an action out: a name, nobody (`null`), or no line at all. */
export const Actor = ({ actorName }) => {
  if (actorName) return <small>Utförs av: {actorName}</small>;
  return actorName === null ? <small>Ingen behörig aktör</small> : null;
};

const Choice = ({ choice, busy, updates, onAnswer }) => {
  const price = [choice.cost, stressText(choice.stress, updates)].filter(Boolean).join(" · ");
  const modifiers = Array.isArray(choice.odds?.modifiers) ? choice.odds.modifiers : [];
  return (
    <li>
      <button type="button" className="court-choice" disabled={busy || Boolean(choice.disabledReason)} onClick={() => onAnswer(choice.id)}>
        <strong>{choice.label}</strong>
        {choice.description && <span>{choice.description}</span>}
        <Actor actorName={choice.actorName} />
        {price && <small>{price}</small>}
        {choice.disabledReason && <em>{choice.disabledReason}</em>}
      </button>
      {choice.odds && (
        <div className="court-choice-odds">
          <strong>Chans att lyckas: {oddsText(choice.odds.chance)}</strong>
          {modifiers.length > 0 && (
            <details>
              <summary>Vad påverkar chansen?</summary>
              <ul>{modifiers.map((row, index) => <li key={`${index}-${row.label}`}>{modifierText(row)}</li>)}</ul>
            </details>
          )}
        </div>
      )}
    </li>
  );
};

export default function CourtMatter({ matter, answer, busy, error, updates, onToggle, onAnswer }) {
  const read = (text) => readNative(text, updates);
  const open = Boolean(answer);
  // The story's own names: the sentences below are then the panel's, word for word, in every language.
  const { chainTitle, stepNumber = null, triggerDescription, deadlineText, fallbackDescription } = answer ?? {};
  // An id is one token: a story's id is the engine's and may hold anything.
  const panelId = `court-answer-${String(matter.id).replace(/[^\w-]/g, "_")}`;
  return (
    <li className={open ? "court-matter-open" : undefined}>
      <button type="button" className="court-matter" aria-expanded={open} aria-controls={open ? panelId : undefined} data-court-matter={matter.id} onClick={() => onToggle(matter.id)}>
        <span className="court-matter-faces">
          {matter.people.map((person) => <i key={person.id} className="court-mini"><MedallionPicture medallion={medallionOf(person, read)} /></i>)}
        </span>
        <b>{matter.title}</b>
        {matter.dueAt && <small>{`Senast ${dateLabel(matter.dueAt)}`}</small>}
      </button>
      {open && (
        <div className="court-answer" id={panelId}>
          {(chainTitle || stepNumber !== null) && (
            <span className="court-answer-chain">{chainTitle || "Händelsekedja"}{stepNumber !== null ? ` · Steg ${stepNumber}` : ""}</span>
          )}
          {answer.description && <p>{answer.description}</p>}
          {triggerDescription && <p className="court-answer-note">Bakgrund: {triggerDescription}</p>}
          {deadlineText && <p className="court-answer-note">{deadlineText}</p>}
          {fallbackDescription && <p className="court-answer-note">Om du avstår till tidsgränsen: {fallbackDescription}</p>}
          <ul className="court-choices">
            {answer.choices.map((choice) => <Choice key={choice.id} choice={choice} busy={busy} updates={updates} onAnswer={onAnswer} />)}
          </ul>
          {error && <p className="court-refusal" role="alert">{error}</p>}
        </div>
      )}
    </li>
  );
}
