// The card of the person selected on the court's thread: who the person is, what the person can do and how the person
// stands to the player. It shows what the panel's people tab shows and has one way into the panel. What it holds is
// decided by `cardOf` (courtShell.js). Spec: docs/superpowers/specs/2026-11-15-court-shell-design.md, slice 2.
import React from "react";
import { characterNumberLocale } from "../../runtime/characterLanguage.js";
import { readNative } from "../../runtime/useTranslatorUpdates.js";
import { medallionOf } from "../Map/seatRulers.js";
import MedallionPicture from "./MedallionPicture.jsx";

const MINUS = "−";
// `updates` is the translator's count: the React Compiler keeps a call's result until an argument changes, and the
// number's locale follows the language.
const numberText = (value, updates, { signed = false } = {}) => {
  void updates;
  const number = Number(value);
  if (value === null || value === undefined || !Number.isFinite(number)) return "—";
  const text = new Intl.NumberFormat(characterNumberLocale(), { maximumFractionDigits: 1 }).format(Math.abs(number));
  if (number < 0) return `${MINUS}${text}`;
  return signed && number > 0 ? `+${text}` : text;
};
const lean = (value) => (Number(value) > 0 ? "court-card-up" : Number(value) < 0 ? "court-card-down" : undefined);

export default function CourtPersonCard({ card, updates, onClose }) {
  const { person } = card;
  const read = (text) => readNative(text, updates);
  const openInPanel = () => window.dispatchEvent(new CustomEvent("oh:open-characters", { detail: { tab: "people", personId: card.person.id } }));
  return (
    <aside className="court-card" aria-labelledby="court-card-name">
      <header className="court-card-head">
        <span className="court-card-face"><MedallionPicture medallion={medallionOf(person, read)} /></span>
        <div>
          <h2 id="court-card-name">{person.name}</h2>
          {/* House and age are one piece of text, as in the panel: the phrase book reads them together and gives the
              house its English name. */}
          <p>
            <span>{[person.familyName, Number.isFinite(person.age) && `${person.age} år`].filter(Boolean).join(" · ")}</span>
            {card.role && <span>{" · "}{card.role}</span>}
          </p>
        </div>
      </header>
      <div className="court-card-body">
        {card.tags.length > 0 && <ul className="court-card-tags">{card.tags.map((tag, index) => <li key={`${index}-${tag}`}>{tag}</li>)}</ul>}
        {card.skills.length > 0 && (
          <dl className="court-card-skills">
            {card.skills.map((skill) => <div key={skill.key}><dt>{skill.label}</dt><dd>{numberText(skill.value, updates)}</dd></div>)}
          </dl>
        )}
        <dl className="court-card-facts">
          {card.opinion !== null && <dt>Åsikt om din företrädare</dt>}
          {card.opinion !== null && <dd className={lean(card.opinion)}>{numberText(card.opinion, updates, { signed: true })}</dd>}
          {card.opinionReasons.length > 0 && (
            <dd className="court-card-wide">
              <ul className="court-card-reasons">
                {card.opinionReasons.map((reason, index) => (
                  <li key={`${index}-${reason.label}`}><span>{reason.label}</span>{reason.value !== null && <span>{numberText(reason.value, updates, { signed: true })}</span>}</li>
                ))}
              </ul>
            </dd>
          )}
          {card.stress !== null && <dt>Stress</dt>}
          {card.stress !== null && <dd>{numberText(card.stress, updates)} / 100</dd>}
          {card.goalLabel && <dt className="court-card-wide">Mål och drivkrafter</dt>}
          {card.goalLabel && <dd className="court-card-wide">{card.goalLabel}</dd>}
        </dl>
        <div className="court-card-actions">
          <button type="button" className="court-card-primary" onClick={openInPanel}>Lär känna</button>
          <button type="button" onClick={onClose}>Stäng</button>
        </div>
      </div>
    </aside>
  );
}
