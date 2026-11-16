// The areas of the left panel: who is at court, how the houses stand, who holds what, what the player's side knows
// and what has happened. Each is a list of what the panel's tab shows; a press selects a person or unfolds a text.
// What a list holds is decided in courtShell.js. Spec: docs/superpowers/specs/2026-11-15-court-shell-design.md, slice 5.
import React from "react";
import { readNative } from "../../runtime/useTranslatorUpdates.js";
import { medallionOf } from "../Map/seatRulers.js";
import { dateLabel } from "./ActionBox.jsx";
import { CourtEvent } from "./CourtYearReport.jsx";
import MedallionPicture from "./MedallionPicture.jsx";
import { AREAS } from "./courtShell.js";
import { lean, numberText, yearText } from "./courtText.js";

// The panel's own names for its tabs.
const NAMES = { needs: "Kräver dig", people: "Personer", houses: "Familjer", seats: "Ämbeten & arv", intrigue: "Intriger", chronicle: "Krönikan" };
export const areaName = (key) => NAMES[key] ?? NAMES.needs;

export function CourtAreaTabs({ area, count, onArea }) {
  return (
    <nav className="court-areas" aria-label="Hovets områden">
      {AREAS.map((entry) => (
        <button key={entry.key} type="button" aria-pressed={area === entry.key} onClick={() => onArea(entry.key)}>
          {/* The space keeps the count a word of its own in the button's name. */}
          {NAMES[entry.key]}{entry.key === "needs" && count > 0 && <>{" "}<span className="court-area-count">{count}</span></>}
        </button>
      ))}
    </nav>
  );
}

// A person's name as a way to the person's card, or as plain text for someone who is not at court.
const Name = ({ id, name, onSelect }) => (id
  ? <button type="button" className="court-link" onClick={() => onSelect(id)}>{name}</button>
  : <span>{name}</span>);

export function PeopleArea({ people, selectedId, updates, onSelect }) {
  const read = (text) => readNative(text, updates);
  return (
    <ul className="court-rows">
      {people.map(({ person, role, self }) => (
        <li key={person.id}>
          <button type="button" className="court-row-person" aria-pressed={selectedId === person.id} onClick={() => onSelect(person.id)}>
            <i className="court-mini"><MedallionPicture medallion={medallionOf(person, read)} /></i>
            <span>
              <b>{person.name}</b>
              {/* House and age are one piece of text, as on the card: the phrase book reads them together. */}
              <small>{[person.familyName, Number.isFinite(person.age) && `${person.age} år`].filter(Boolean).join(" · ")}{role && <>{" · "}{role}</>}</small>
            </span>
            {!self && person.opinion !== null && person.opinion !== undefined && <em className={lean(person.opinion)}>{numberText(person.opinion, updates, { signed: true })}</em>}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function HousesArea({ houses, updates, onSelect }) {
  return (
    <ul className="court-rows">
      {houses.map((house) => (
        <li key={house.id} className={house.own ? "court-house court-house--own" : "court-house"}>
          <div className="court-house-head">
            <b>{house.name}</b>
            {house.own && <small>Din familj</small>}
            {house.exiled && <small>I exil</small>}
          </div>
          <p>Företrädare: {house.headName ? <Name id={house.headId} name={house.headName} onSelect={onSelect} /> : <i>Vakant</i>}</p>
          <dl>
            <div><dt>Stöd</dt><dd>{numberText(house.support, updates)}</dd></div>
            <div><dt>Gemensam kassa</dt><dd>{numberText(house.treasury, updates)}</dd></div>
            <div><dt>Inflytande</dt><dd>{numberText(house.influence, updates)}</dd></div>
          </dl>
        </li>
      ))}
    </ul>
  );
}

export function SeatsArea({ seats, onSelect }) {
  return (
    <>
      <section>
        <h3>Tronföljd</h3>
        {seats.line.length > 0
          ? (
            <ol className="court-line-list">
              {seats.line.map((entry) => (
                <li key={entry.id}><Name id={entry.id} name={entry.name} onSelect={onSelect} />{entry.heir && <small>Arvinge</small>}</li>
              ))}
            </ol>
          )
          : <p className="court-area-empty">Ingen känd arvinge.</p>}
      </section>
      <section>
        <h3>Ämbeten</h3>
        <ul className="court-seats">
          {seats.offices.map((office) => (
            <li key={office.id}>
              <span>{office.name}</span>
              {office.holderName ? <Name id={office.holderId} name={office.holderName} onSelect={onSelect} /> : <i>Vakant</i>}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export function IntrigueArea({ intrigue, updates, onSelect }) {
  if (intrigue.empty) return <p className="court-area-empty">Inget pågår i det fördolda.</p>;
  const silver = (value) => numberText(value, updates);
  return (
    <>
      {intrigue.schemes.length > 0 && (
        <section>
          <h3>Pågående intriger</h3>
          <ul className="court-facts">
            {intrigue.schemes.map((scheme) => {
              const value = scheme.targetNames.join(", ") || "—";
              return <li key={scheme.id}><b>{scheme.actionLabel}</b><small>Mål: {value}</small><small>Avgörs: {dateLabel(scheme.dueAt)}</small></li>;
            })}
          </ul>
        </section>
      )}
      {intrigue.prisoners.length > 0 && (
        <section>
          <h3>Fångar</h3>
          <ul className="court-facts">
            {intrigue.prisoners.map((prisoner) => (
              <li key={prisoner.id}>
                <b><Name id={prisoner.personId} name={prisoner.name} onSelect={onSelect} /></b>
                <small>Fånge sedan {dateLabel(prisoner.since)}</small>
                {prisoner.ransom !== null && <small>Lösensumma: {silver(prisoner.ransom)} silver</small>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {intrigue.hooks.length > 0 && (
        <section>
          <h3>Grepp</h3>
          <ul className="court-facts">
            {intrigue.hooks.map((hook) => (
              <li key={hook.id}><b><Name id={hook.targetId} name={hook.targetName} onSelect={onSelect} /></b><small>Styrka: {hook.strengthLabel}</small></li>
            ))}
          </ul>
        </section>
      )}
      {intrigue.secrets.length > 0 && (
        <section>
          <h3>Hemligheter du känner till</h3>
          <ul className="court-facts">
            {intrigue.secrets.map((secret) => (
              <li key={secret.id}>
                <b>{secret.typeLabel}{secret.exposed && <small className="court-fact-mark">avslöjad</small>}</b>
                <small>Gäller: <Name id={secret.subjectId} name={secret.subjectName} onSelect={onSelect} /></small>
                {secret.evidenceLabel && <small>Bevis: {secret.evidenceLabel}</small>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {intrigue.rumors.length > 0 && (
        <section>
          <h3>Rykten</h3>
          <ul className="court-facts">
            {intrigue.rumors.map((rumor) => (
              <li key={rumor.id}>
                <b>{rumor.topicLabel}: {rumor.subjectName}</b>
                <small>{dateLabel(rumor.date)}</small>
                {rumor.reliability && <small>Tillförlitlighet: {rumor.reliability}</small>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export function ChronicleArea({ years, updates }) {
  if (!years.length) return <p className="court-area-empty">Inga händelser att visa.</p>;
  return years.map((group) => (
    <section key={group.year ?? "undated"}>
      {group.year !== null && <h3>{yearText(group.year, updates)}</h3>}
      <ol className="court-events">
        {group.entries.map((entry) => <CourtEvent key={entry.id} event={entry} />)}
      </ol>
    </section>
  ));
}
