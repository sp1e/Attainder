import React, { useEffect, useRef, useState } from "react";
import { historicalRecord } from "../../runtime/historicalEvents.js";
import { formatGameDate, formatGameDateReadable, parseGameDate } from "../../runtime/gameDates.js";
import { loadHistoricalEventCatalog } from "../../runtime/historicalEventCatalog.js";
import HistoricalEventCard from "./HistoricalEventCard.jsx";
import "./characters.css";

// The popup's "Visa alla i krönikan" link dispatches this window event.
export const HISTORY_RECORD_EVENT = "oh:open-history-record";
const RESEARCH_END_YEAR = 1200;

// Lives in the always-mounted game UI, because the character panel is a lazy
// chunk that may not have loaded when the event fires. Each event bumps the
// returned counter and runs `onRequest`; the panel reacts to a changed counter.
export function useHistoryRecordRequest(onRequest) {
  const [count, setCount] = useState(0);
  const onRequestRef = useRef(onRequest);
  onRequestRef.current = onRequest;
  useEffect(() => {
    const listener = () => { setCount((value) => value + 1); onRequestRef.current?.(); };
    window.addEventListener(HISTORY_RECORD_EVENT, listener);
    return () => window.removeEventListener(HISTORY_RECORD_EVENT, listener);
  }, []);
  return count;
}

// Runs `select` when the request counter changes to a value above zero.
export function useChronicleRequest(request, select) {
  const selectRef = useRef(select);
  selectRef.current = select;
  useEffect(() => { if (request > 0) selectRef.current(); }, [request]);
}

// Moves focus into the panel when it is somewhere else, so the keyboard stays
// inside the dialog after the popup that sent the player here has closed.
export function holdFocus(panel, active) {
  if (!panel || panel.contains(active)) return;
  panel.querySelector("button")?.focus();
}

const yearHeading = (year) => formatGameDateReadable(formatGameDate({ year, month: 1, day: 1 }), "YYYY");

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
  const pastResearch = (parseGameDate(gameDate)?.year ?? 0) > RESEARCH_END_YEAR;
  return <div className="hist-record">
    {catalog && groups.length === 0 && <p className="char-caption">Inga godkända händelser ännu för de år kampanjen har passerat.</p>}
    {groups.map((group) => <section key={group.year} className="hist-year">
      <h4>{yearHeading(group.year)}</h4>
      <div className="hist-list">{group.events.map((event) => <HistoricalEventCard key={event.id} event={event} sources={sources} />)}</div>
    </section>)}
    {pastResearch && <p className="char-caption">Forskningen sträcker sig till år 1200.</p>}
  </div>;
}
