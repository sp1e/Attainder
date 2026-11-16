// The year line along the bottom of the map: the twelve months ahead with the open matters' deadlines, and the year
// turn. What the line holds is decided by `yearLineOf` (courtShell.js); the turn's state is courtYear.js's.
// Spec: docs/superpowers/specs/2026-11-15-court-shell-design.md, slice 4.
import React from "react";
import { characterNumberLocale } from "../../runtime/characterLanguage.js";
import { dateLabel } from "./ActionBox.jsx";

/**
 * A month's short name in the player's language; January carries its year, with the era before it began. `updates`
 * is the translator's count: the React Compiler keeps a call's result until an argument changes, and the name
 * follows the language.
 */
const monthText = (mark, updates) => {
  void updates;
  const date = new Date(Date.UTC(2001, mark.month - 1, 1));
  if (mark.month !== 1) return new Intl.DateTimeFormat(characterNumberLocale(), { month: "short", timeZone: "UTC" }).format(date);
  // The calendar has no year 0: 1 BC is the astronomical year 0.
  date.setUTCFullYear(mark.year < 0 ? mark.year + 1 : mark.year);
  return new Intl.DateTimeFormat(characterNumberLocale(), { month: "short", year: "numeric", era: mark.year < 0 ? "short" : undefined, timeZone: "UTC" }).format(date);
};

const Tick = ({ tick, onOpenMatter }) => {
  const count = tick.matters.length;
  const classes = ["court-tick", tick.soon && "court-tick--soon", tick.end && "court-tick--end"].filter(Boolean).join(" ");
  const label = count === 1 ? tick.matters[0].title : `${count} ärenden`;
  return (
    // The label has the room the line gives it; the whole of it is the button's title.
    <button type="button" className={classes} title={label} style={{ left: `${(tick.at * 100).toFixed(2)}%`, maxWidth: `${(tick.room * 100).toFixed(2)}%` }} onClick={() => onOpenMatter(tick.matters[0].id)}>
      <b>{label}</b>
      <small>{dateLabel(tick.dueAt)}</small>
    </button>
  );
};

export default function CourtYearLine({ line, year, locked, ended, updates, onOpenMatter, onAdvance, onReveal, onDismiss }) {
  const { busy, kind, error } = year;
  return (
    <footer className="court-year" aria-label="Året som kommer">
      {error && (
        <div className="court-year-refusal" role="alert">
          <span>{error}</span>
          {error.includes("Läs färdigt") && <button type="button" disabled={locked} onClick={onReveal}>Visa senaste turens händelser</button>}
          <button type="button" onClick={onDismiss}>Stäng meddelandet</button>
        </div>
      )}
      <button type="button" className="court-year-last" disabled={locked} onClick={onReveal}>Visa senaste turens händelser →</button>
      <div className={busy ? "court-year-line court-year-line--working" : "court-year-line"}>
        {/* The notice's place is always there, so that its text is announced when it comes. */}
        <p className="court-year-working" role="status">{busy && kind === "year" ? "Modellen arbetar med årets händelser" : ""}</p>
        {line.ticks.map((tick) => <Tick key={tick.dueAt} tick={tick} onOpenMatter={onOpenMatter} />)}
        <div className="court-year-months" aria-hidden="true">
          {line.months.map((mark) => <span key={`${mark.year}-${mark.month}`} style={{ left: `${(mark.at * 100).toFixed(2)}%` }}>{monthText(mark, updates)}</span>)}
        </div>
      </div>
      <button type="button" className="court-year-next" disabled={locked || ended} onClick={onAdvance}>
        {busy ? "Bearbetar…" : "Nästa år med modellen"}<span aria-hidden="true"> →</span>
      </button>
    </footer>
  );
}
