import React from "react";
import { dateCertaintySv } from "../../runtime/historicalEvents.js";

// A source link renders only for a web address; anything else shows as text.
const isWebUrl = (url) => /^https?:\/\//i.test(String(url ?? ""));

// One sourced real-world event. Reused by the year popup and the chronicle view.
// The date line carries the catalog's own wording and how certain it is, so an
// approximate event never reads as an exact year.
export default function HistoricalEventCard({ event, sources = [] }) {
  const byId = new Map(sources.map((source) => [source.id, source]));
  const cited = (event.sourceIds ?? []).map((id) => byId.get(id)).filter(Boolean);
  return <article className="hist-card">
    <h3>{event.titleSv}</h3>
    <p className="hist-meta"><span>{event.date?.displaySv}</span><span>{dateCertaintySv(event)}</span><span>{event.geographySv}</span></p>
    <p>{event.summarySv}</p>
    {cited.length > 0 && <details className="hist-sources">
      <summary>Källor</summary>
      <ul>{cited.map((source) => <li key={source.id}>
        <span>{source.title}</span>{" "}<span className="hist-source-meta">{source.institution}, {source.locator}</span>{" "}
        {isWebUrl(source.url) && <a href={source.url} target="_blank" rel="noreferrer">{source.url}</a>}
      </li>)}</ul>
    </details>}
  </article>;
}
