import React from "react";
import { dateLabel, modifierText, oddsText } from "./ActionBox.jsx";

// The court in the character panel: the reign, the council seats, the families' demands, the factions the player knows of and
// the odds of a story choice. Every fact comes from `view.court` or the choice; nothing here computes one. All text is rendered
// as React text.

const entries = (value) => Array.isArray(value) ? value : Object.values(value || {});
const number = (value) => new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 }).format(Number(value));

/** A headed block of cards. `label` names it for assistive technology and defaults to the title. */
export function Section({ title, label = title, eyebrow, children }) {
  return <section className="char-intrigue-section" aria-label={label}>
    <div className="char-section-heading"><div>{eyebrow && <span className="char-eyebrow">{eyebrow}</span>}<h3>{title}</h3></div></div>
    {children}
  </section>;
}

function RowList({ summary, rows }) {
  return <details className="char-explanation"><summary>{summary}</summary><ul>{rows}</ul></details>;
}

/** The reign under the leader. `Meter` is the panel's own, passed in because the panel imports this module. */
export function ReignCard({ court, Meter }) {
  if (!court) return null;
  const sources = entries(court.legitimacy.sources), goals = entries(court.reign.goals);
  return <div className="char-reign">
    <div className="char-leader-measures">
      <div><Meter label="Fruktan" value={court.dread.value} danger /><p className="char-caption">{court.dread.label}</p></div>
      <div className="char-metric"><span>Ryktbarhet</span><strong>{number(court.prestige)}</strong></div>
    </div>
    {sources.length > 0 && <RowList summary="Vad bär legitimiteten?" rows={sources.map((row) => <li key={row.label}>{modifierText(row)}</li>)} />}
    <h4>Regeringsmål</h4>
    {goals.length ? <ul className="char-reign-goals">{goals.map((goal) => <li key={goal.id}>
      <strong>{goal.label}</strong>
      <span>{goal.description}</span>
      <span className="char-caption">{dateLabel(goal.dueAt)} · {goal.statusLabel}</span>
    </li>)}</ul> : <p className="char-caption">Inga mål är utlysta.</p>}
  </div>;
}

export function CouncilSeats({ council }) {
  if (!council) return null;
  const ambitions = entries(council.ambitions);
  return <Section title="Rådet">
    <ul className="char-intrigue-list">{entries(council.seats).map((seat) => <li className="char-card char-seat" key={seat.officeId}>
      <strong>{seat.name}</strong>
      {seat.holderId ? <><span>{seat.holderName}</span><span>Tjänst: {seat.serviceLabel}</span></> : <span className="char-badge char-badge--warning">{seat.holderName}</span>}
    </li>)}</ul>
    {ambitions.length > 0 && <RowList summary="Vad spionmästaren tror att de vill" rows={ambitions.map((row) => <li key={row.personId}>{row.name}: {row.ambitionLabel}</li>)} />}
  </Section>;
}

export function DemandList({ demands }) {
  const list = entries(demands);
  return <Section title="Krav från familjerna">
    {list.length ? <ul className="char-intrigue-list">{list.map((demand) => <li className="char-card char-demand" key={demand.id}>
      <strong>{demand.familyName}</strong>
      <span>{demand.kindLabel}: {demand.targetName}</span>
      <span>{demand.statusLabel}</span>
      <span className="char-caption">{dateLabel(demand.dueAt)}</span>
    </li>)}</ul> : <p className="char-caption">Inga krav ligger på bordet.</p>}
  </Section>;
}

// The empty text is the same whether a faction exists or not: presentFactions lists only what the player has found.
export function FactionList({ factions }) {
  const list = entries(factions);
  return <Section title="Faktioner">
    {list.length ? <ul className="char-intrigue-list">{list.map((faction) => <li className="char-card char-faction" key={faction.id}>
      <strong>{faction.stageLabel}</strong>
      {faction.knownMembers.length > 0 && <span>Känd krets: {faction.knownMembers.map((member) => member.name).join(", ")}</span>}
      <span>Pretendent: {faction.claimantName || "okänd"}</span>
      <span>Styrka: {faction.strengthLabel}</span>
      {typeof faction.memberCount === "number" && <span>Medlemmar: {faction.memberCount}</span>}
    </li>)}</ul> : <p className="char-caption">Du känner inte till någon faktion.</p>}
  </Section>;
}

/** A story choice's odds, as `chanceFromRows` shows them: a number at exact, a band with signs otherwise. It sits beside the choice's button, because a details inside a button cannot be opened without clicking the choice. */
export function ChoiceOdds({ odds }) {
  if (!odds) return null;
  const rows = entries(odds.modifiers);
  return <div className="char-choice-odds">
    <strong>Chans att lyckas: {oddsText(odds.chance)}</strong>
    {rows.length > 0 && <RowList summary="Vad påverkar chansen?" rows={rows.map((row, index) => <li key={`${row.label}-${index}`}>{modifierText(row)}</li>)} />}
  </div>;
}
