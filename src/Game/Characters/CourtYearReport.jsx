// The record of a turn, over the map: what the year wrote, or the last saved turn. The heading and the reasons time
// stopped are the panel's own. An event shows its date and title; its text unfolds on a press.
// Spec: docs/superpowers/specs/2026-11-15-court-shell-design.md, slice 4.
import React from "react";
import { dateLabel } from "./ActionBox.jsx";

// A narrative the model wrote for the player's own action is left as written (the panel's own rule).
const asWritten = (event) => (event.type === "action_narrative" ? "" : undefined);

/** One event of a record or of the chronicle: its date and its title; its text unfolds on a press. */
export const CourtEvent = ({ event }) => (
  <li>
    <span className="court-report-date">{dateLabel(event.date || event.createdAt)}</span>
    {event.description || event.text
      ? (
        <details>
          <summary data-no-translate={asWritten(event)}>{event.title}</summary>
          <p data-no-translate={asWritten(event)}>{event.description || event.text}</p>
        </details>
      )
      : <b data-no-translate={asWritten(event)}>{event.title}</b>}
  </li>
);

const Stopped = ({ interruption }) => (
  <p className="court-notice" role="status">
    <strong>
      {interruption.type === "health-care" ? "Tiden stannade vid ett vårdärende" : interruption.type === "watch" ? "Tiden stannade vid en bevakning" : "Tiden stannade vid en karaktärshändelse"}
    </strong>
    {interruption.message && <span>{interruption.message}</span>}
  </p>
);

export default function CourtYearReport({ report, onClose }) {
  const { events, interruption } = report;
  const reportLabel = interruption ? "Händelser fram till beslutet" : report.kind === "year" ? "Årets händelser" : "Senaste turens händelser";
  return (
    <section className="court-report" aria-labelledby="court-report-title">
      <header>
        <h2 id="court-report-title" tabIndex={-1}>{reportLabel}</h2>
        <span className="court-needs-count">{events.length}</span>
      </header>
      {interruption && <Stopped interruption={interruption} />}
      {events.length > 0
        ? (
          <ol>
            {events.map((event, index) => <CourtEvent key={event.id || index} event={event} />)}
          </ol>
        )
        : <p className="court-report-empty">Inga händelser att visa.</p>}
      <button type="button" className="court-report-close" onClick={onClose}>Stäng</button>
    </section>
  );
}
