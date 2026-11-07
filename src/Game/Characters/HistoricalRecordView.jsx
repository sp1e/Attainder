import React, { useEffect, useRef, useState } from "react";
import { historicalRecord } from "../../runtime/historicalEvents.js";
import { parseGameDate } from "../../runtime/gameDates.js";
import { loadHistoricalEventCatalog } from "../../runtime/historicalEventCatalog.js";
import { researchEndYear } from "../../runtime/historicalResearchRange.js";
import coverage from "../../../server/seed/historical/events/coverage.json" with { type: "json" };
import HistoricalEventCard from "./HistoricalEventCard.jsx";
import "./characters.css";

const RESEARCH_END_YEAR = researchEndYear(coverage);

// Runs `select` once each time the request counter changes to a value above zero.
export function useChronicleRequest(request, select) {
  const handled = useRef(0);
  useEffect(() => {
    if (request > 0 && request !== handled.current) select();
    handled.current = request;
  });
}

// Moves focus into the panel when it is somewhere else, so the keyboard stays
// inside the dialog after the popup that sent the player here has closed.
export function holdFocus(panel, active) {
  if (!panel || panel.contains(active)) return;
  panel.querySelector("button")?.focus();
}

// The character panel's own era form (CharactersPanel.jsx): 218 f.Kr., 802 e.Kr.
const yearHeading = (year) => `${Math.abs(year)} ${year < 0 ? "f.Kr." : "e.Kr."}`;

// The sourced real-world events of every year the campaign has closed, newest
// year first. Read-only: the catalog loads when this view is first shown, and
// nothing is saved or sent to a model.
export default function HistoricalRecordView({ startDate, gameDate }) {
  const [catalog, setCatalog] = useState(null);
  useEffect(() => {
    let live = true;
    loadHistoricalEventCatalog().then((loaded) => { if (live) setCatalog(loaded); }).catch(() => { if (live) setCatalog({}); });
    return () => { live = false; };
  }, []);
  const groups = catalog ? historicalRecord(catalog, startDate, gameDate) : [];
  const sources = Array.isArray(catalog?.sources) ? catalog.sources : [];
  const pastResearch = RESEARCH_END_YEAR !== null && (parseGameDate(gameDate)?.year ?? 0) > RESEARCH_END_YEAR;
  return <div className="hist-record">
    {catalog && groups.length === 0 && <p className="char-caption">Inga godkända händelser ännu för de år kampanjen har passerat.</p>}
    {groups.map((group) => <section key={group.year} className="hist-year">
      <h4>{yearHeading(group.year)}</h4>
      <div className="hist-list">{group.events.map((event) => <HistoricalEventCard key={event.id} event={event} sources={sources} />)}</div>
    </section>)}
    {pastResearch && <p className="char-caption">Forskningen sträcker sig till år {RESEARCH_END_YEAR}.</p>}
  </div>;
}
