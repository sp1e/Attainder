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

const countText = (entry) => (entry.binary ? entry.label : `${entry.label} ${number(entry.value)} av ${number(entry.threshold)}`);

function nicknameNote(path) {
  const winner = path.rows.find((row) => row.id === path.winnerId);
  if (!path.adult) return 'Ett barn på tronen får inget tillnamn förrän i vuxen ålder.';
  if (path.monthsLeft > 0) return `Tillnamnet ges vid ett årsskifte efter 24 månader på tronen. ${path.monthsLeft} månader återstår.`;
  return winner ? `Vid nästa årsskifte kallas ${path.rulerName} ${winner.label}.` : 'Tillnamnet ges vid nästa årsskifte där något av villkoren är uppfyllt.';
}

/** The three rows closest to a name, in table order, since the first row that holds wins. */
export function NicknamePath({ path }) {
  if (!path) return null;
  const closest = path.rows.filter((row) => row.share > 0).sort((a, b) => b.share - a.share || a.order - b.order).slice(0, 3)
    .sort((a, b) => a.order - b.order);
  return <div className="char-nickname-path">
    <h4>Vägen till ett tillnamn</h4>
    {closest.length > 0 && <ul>{closest.map((row) => <li key={row.id} className={row.earned ? 'is-earned' : undefined}>
      <strong>{row.label}</strong>
      <span>{row.counts.map(countText).join(' eller ')}</span>
    </li>)}</ul>}
    <p className="char-caption">{nicknameNote(path)} Uppfylls flera vinner det som står först.</p>
  </div>;
}

const names = (list) => list.join(', ');

/** What changed with the new ruler, during the reign's first year. */
export function Handover({ handover }) {
  if (!handover) return null;
  const { archetype, traitsGone, traitsNew, skills } = handover;
  return <div className="char-handover">
    <h4>Ett nytt styre</h4>
    <p>{`${handover.rulerName} efterträder ${handover.predecessorName}.`}</p>
    <ul>
      {archetype && <li>{`Förmågan ${archetype.from.ability} (${archetype.from.name}) ersätts av ${archetype.to.ability} (${archetype.to.name}).`}</li>}
      {traitsGone.length > 0 && <li>{`Drag som försvinner: ${names(traitsGone)}.`}</li>}
      {traitsNew.length > 0 && <li>{`Nya drag: ${names(traitsNew)}.`}</li>}
      {skills.map((row) => <li key={row.label}>{`${row.label}: ${row.from} → ${row.to}`}</li>)}
    </ul>
    <p className="char-caption">{`Den förra regeringens mål gäller inte längre. Rutan visas i ${handover.monthsLeft} ${handover.monthsLeft === 1 ? 'månad' : 'månader'} till.`}</p>
  </div>;
}

/** The reign under the leader. `Meter` is the panel's own, passed in because the panel imports this module. */
export function ReignCard({ court, nicknamePath, handover, Meter }) {
  if (!court) return null;
  const sources = entries(court.legitimacy.sources), goals = entries(court.reign.goals);
  return <div className="char-reign">
    <div className="char-leader-measures">
      <div><Meter label="Fruktan" value={court.dread.value} valueText={court.dread.label} danger /><p className="char-caption">{court.dread.label}</p></div>
      <div className="char-metric"><span>Ryktbarhet</span><strong>{number(court.prestige)}</strong></div>
    </div>
    <Handover handover={handover} />
    {sources.length > 0 && <RowList summary="Vad bär legitimiteten?" rows={sources.map((row) => <li key={row.label}>{modifierText(row)}</li>)} />}
    <h4>Regeringsmål</h4>
    {goals.length ? <ul className="char-reign-goals">{goals.map((goal) => <li key={goal.id}>
      <strong>{goal.label}</strong>
      <span>{goal.description}</span>
      <span className="char-caption">{dateLabel(goal.dueAt)} · {goal.statusLabel}</span>
    </li>)}</ul> : <p className="char-caption">Inga mål är utlysta.</p>}
    <NicknamePath path={nicknamePath} />
  </div>;
}

// A claim being forged, a ready claim, a war with its score and the border lands taken (fabricated-claim spec).
function claimText(realm) {
  const claim = realm.claim === 'forging' ? ' · anspråk smids' : realm.claim === 'ready' ? ' · anspråk klart' : '';
  const war = realm.war ? ` · i krig, ställning ${realm.war.score > 0 ? '+' : ''}${realm.war.score}` : '';
  return `${claim}${war}${realm.lands ? ` · erövrade gränsland: ${realm.lands}` : ''}`;
}

/** The other realms of a historical campaign: ruler, heir, seat, distance and opinion. */
export function ForeignRealms({ realms }) {
  const rows = entries(realms);
  if (!rows.length) return null;
  return <Section title="Grannriken" eyebrow="Utanför riket">
    <ul className="char-reign-goals">{rows.map((realm) => <li key={realm.id}>
      <strong>{realm.name}</strong>
      <span>{`${realm.rulerName}, ${realm.rulerAge} år${realm.heirName ? ` · arvinge: ${realm.heirName}` : ' · ingen känd arvinge'}`}</span>
      <span className="char-caption">{`${realm.seatName ?? 'Okänt säte'} · ${realm.distanceKm == null ? 'okänt avstånd' : `${number(realm.distanceKm)} km`}${realm.neighbor ? ' · granne' : ''}${realm.allied ? ' · allierad' : ''}${claimText(realm)} · hållning ${number(realm.opinion)}`}</span>
    </li>)}</ul>
  </Section>;
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
