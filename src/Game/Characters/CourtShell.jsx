// The court over the map: the thread of medallions, the list of what needs the player, and the realm's six figures.
// Everything here is a way into the court panel. What is shown is decided in courtShell.js.
// Spec: docs/superpowers/specs/2026-11-15-court-shell-design.md, slice 1.
import React, { useMemo } from "react";
import "./courtShell.css";
import { characterNumberLocale } from "../../runtime/characterLanguage.js";
import { useLibraryState } from "../../runtime/library.js";
import { useCourtView } from "../../runtime/useCourtView.js";
import { readNative, useTranslatorUpdates } from "../../runtime/useTranslatorUpdates.js";
import { medallionOf } from "../Map/seatRulers.js";
import { dateLabel } from "./ActionBox.jsx";
import MedallionPicture from "./MedallionPicture.jsx";
import { figuresOf, flagsOf, mattersOf, threadOf } from "./courtShell.js";

const MINUS = "−";
// Opens the court panel at a place: a tab, and a person on the people tab.
const open = (detail) => window.dispatchEvent(new CustomEvent("oh:open-characters", { detail }));

// `updates` is the translator's count: the React Compiler keeps a call's result until an argument changes, and the
// number's locale follows the language.
const figureText = (figure, updates) => {
  void updates;
  if (!Number.isFinite(Number(figure.value))) return "—";
  const number = Number(figure.value);
  const text = new Intl.NumberFormat(characterNumberLocale(), { maximumFractionDigits: 1 }).format(Math.abs(number));
  if (number < 0) return `${MINUS}${text}`;
  return figure.signed && number > 0 ? `+${text}` : text;
};

const Medallion = ({ member, count, updates }) => {
  const read = (text) => readNative(text, updates);
  const classes = ["court-person", member.ruler && "court-person--ruler", member.heir && "court-person--heir", member.held && "court-person--held"].filter(Boolean).join(" ");
  return (
    <button type="button" className={classes} title={read(member.person.name)} onClick={() => open({ tab: "people", personId: member.person.id })}>
      <span className="court-person-face"><MedallionPicture medallion={medallionOf(member.person, read)} /></span>
      {count > 0 && <span className="court-person-flag" aria-label={`${count} ${count === 1 ? "ärende" : "ärenden"}`}>{count}</span>}
      <span className="court-person-who">{member.person.name}</span>
      {member.role && <span className="court-person-role">{member.role}</span>}
    </button>
  );
};

const Matter = ({ matter, updates }) => {
  const read = (text) => readNative(text, updates);
  return (
    <li>
      <button type="button" className="court-matter" onClick={() => open({ tab: "decisions" })}>
        <span className="court-matter-faces">
          {matter.people.map((person) => <i key={person.id} className="court-mini"><MedallionPicture medallion={medallionOf(person, read)} /></i>)}
        </span>
        <b>{matter.title}</b>
        {matter.dueAt && <small>{`Senast ${dateLabel(matter.dueAt)}`}</small>}
      </button>
    </li>
  );
};

export default function CourtShell({ topOffset = "0px" }) {
  const { activeGameId } = useLibraryState();
  const { view } = useCourtView(activeGameId);
  const updates = useTranslatorUpdates();
  const shell = useMemo(() => {
    const matters = mattersOf(view);
    return { thread: threadOf(view), matters, flags: flagsOf(matters), figures: figuresOf(view) };
  }, [view]);
  if (!view) return null;
  const { thread, matters, flags, figures } = shell;
  const medallions = (members) => members.map((member) => <Medallion key={member.person.id} member={member} count={flags.get(member.person.id) ?? 0} updates={updates} />);

  return (
    // data-native-text: the shell is written in Swedish, so the page translator applies its whole native book here.
    <div className="court-shell" data-native-text style={{ top: `calc(${topOffset} + 5rem)` }}>
      <div className="court-band">
        <nav className="court-thread" aria-label="Hovet">
          <div className="court-line">{medallions(thread.house)}</div>
          {thread.others.length > 0 && <span className="court-caption">Hovhusen</span>}
          {thread.others.length > 0 && <div className="court-line court-line--others">{medallions(thread.others)}</div>}
        </nav>
        {/* One button: the six figures are one way into the overview, not six. */}
        <button type="button" className="court-figures" onClick={() => open({ tab: "council" })}>
          {figures.map((figure) => (
            <span key={figure.key} className="court-figure">
              <span>{figure.label}</span>
              <b className={figure.negative ? "court-figure--down" : undefined}>{figureText(figure, updates)}{figure.unit && <small> {figure.unit}</small>}</b>
            </span>
          ))}
        </button>
      </div>
      <aside className="court-needs" aria-labelledby="court-needs-title">
        <header>
          <h2 id="court-needs-title">Kräver dig</h2>
          <span className="court-needs-count">{matters.length}</span>
        </header>
        {matters.length > 0
          ? <ul>{matters.map((matter) => <Matter key={matter.id} matter={matter} updates={updates} />)}</ul>
          : <p>Inget kräver dig just nu.</p>}
      </aside>
    </div>
  );
}
