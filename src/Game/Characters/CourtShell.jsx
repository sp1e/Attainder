// The court over the map: the thread of medallions, the list of what needs the player, and the realm's six figures.
// A matter is answered in the list, a person's actions are carried out from the card, and the year turns from the
// line along the bottom; the rest is a way into the court panel. What is shown is decided in courtShell.js.
// Spec: docs/superpowers/specs/2026-11-15-court-shell-design.md, slices 1 to 4.
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./courtShell.css";
import { characterNumberLocale } from "../../runtime/characterLanguage.js";
import { useLibraryState } from "../../runtime/library.js";
import { useCourtView } from "../../runtime/useCourtView.js";
import { readNative, useTranslatorUpdates } from "../../runtime/useTranslatorUpdates.js";
import { medallionOf } from "../Map/seatRulers.js";
import CourtCardActions from "./CourtCardActions.jsx";
import CourtMatter from "./CourtMatter.jsx";
import CourtPersonCard from "./CourtPersonCard.jsx";
import CourtYearLine from "./CourtYearLine.jsx";
import CourtYearReport from "./CourtYearReport.jsx";
import MedallionPicture from "./MedallionPicture.jsx";
import { actionsOf, answerOf, cardOf, commandNotice, decisionNotice, figuresOf, flagsOf, mattersOf, threadOf, yearLineOf } from "./courtShell.js";
import { courtYear, useCourtYear } from "./courtYear.js";
import { useCourtCommand } from "./useCourtCommand.js";

const MINUS = "−";
// Opens the court panel at a place: a tab.
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

// The shell is not drawn while the panel, the menu or a bottom panel is open. The person the player had selected and
// the matter the player had open are kept here, with the campaign they belong to, so they are there again when the
// shell comes back.
let remembered = { campaign: null, id: null, matterId: null };

// A medallion selects its person: the card on the right is the person's. A second press closes it.
const Medallion = ({ member, count, updates, selected, onSelect }) => {
  const read = (text) => readNative(text, updates);
  const classes = ["court-person", member.ruler && "court-person--ruler", member.heir && "court-person--heir", member.held && "court-person--held", selected && "court-person--selected"].filter(Boolean).join(" ");
  return (
    <button type="button" className={classes} title={read(member.person.name)} aria-pressed={selected} data-court-person={member.person.id} onClick={() => onSelect(member.person.id)}>
      <span className="court-person-face"><MedallionPicture medallion={medallionOf(member.person, read)} /></span>
      {count > 0 && <span className="court-person-flag" aria-label={`${count} ${count === 1 ? "ärende" : "ärenden"}`}>{count}</span>}
      <span className="court-person-who">{member.person.name}</span>
      {member.role && <span className="court-person-role">{member.role}</span>}
    </button>
  );
};

export default function CourtShell({ topOffset = "0px", rightBusy = false }) {
  const { activeGameId } = useLibraryState();
  const { view } = useCourtView(activeGameId);
  const updates = useTranslatorUpdates();
  const root = useRef(null);
  const [selectedId, setSelectedId] = useState(() => (remembered.campaign === activeGameId ? remembered.id : null));
  const [openMatterId, setOpenMatterId] = useState(() => (remembered.campaign === activeGameId ? remembered.matterId : null));
  const [openAct, setOpenAct] = useState(null);
  useEffect(() => { remembered = { campaign: activeGameId, id: selectedId, matterId: openMatterId }; }, [activeGameId, selectedId, openMatterId]);
  // One command at a time for the whole shell: an answer to a matter, or an action from the card.
  const command = useCourtCommand(view?.revision);
  // The year turn is kept beside the shell (courtYear.js). Nothing is answered while the year is written; the
  // selection stays free, so the player can read cards meanwhile.
  const year = useCourtYear(activeGameId);
  const locked = command.busy || year.busy;
  // While a command is written the selection stays: its feedback belongs to the person or the matter it was sent for.
  const select = (id) => {
    if (command.busy) return;
    command.clear(); setOpenAct(null); setSelectedId((current) => (current === id ? null : id));
  };
  // A person who is no longer at court has no card: `cardOf` gives none, so the card closes with the view. The same
  // holds for a matter that is no longer open and its answer.
  const card = useMemo(() => cardOf(view, selectedId), [view, selectedId]);
  const acts = useMemo(() => actionsOf(view, card?.person.id), [view, card]);
  const answer = useMemo(() => answerOf(view, openMatterId), [view, openMatterId]);
  const cardOpen = Boolean(card);
  const answerOpen = Boolean(answer);
  // What has left the court leaves no state behind: an action that comes back later is not found open.
  if (openAct && !acts.some((action) => action.type === openAct)) setOpenAct(null);
  if (view && openMatterId && !answer) setOpenMatterId(null);
  // Closing the card removes the button that had focus, so focus goes back to the person's medallion.
  const shutCard = (id) => {
    setSelectedId(null);
    setOpenAct(null);
    if (id) root.current?.querySelector(`[data-court-person="${CSS.escape(id)}"]`)?.focus();
  };
  const closeCard = (id) => {
    if (command.busy) return;
    shutCard(id);
  };
  const toggleMatter = (id) => {
    if (command.busy) return;
    command.clear(); setOpenMatterId((current) => (current === id ? null : id));
  };
  // Closing a matter removes its choices, so focus goes back to the matter's row.
  const shutMatter = (id) => {
    setOpenMatterId(null);
    if (id) root.current?.querySelector(`[data-court-matter="${CSS.escape(id)}"]`)?.focus();
  };
  // Closing the record removes the button that had focus, so focus goes to the year's own button.
  const closeReport = () => {
    courtYear.close();
    root.current?.querySelector(".court-year-last")?.focus();
  };
  const reportOpen = Boolean(year.report);
  // A record that arrives takes focus from the button that asked for it, or from nowhere; it leaves a player who is
  // reading something else alone.
  useEffect(() => {
    if (!reportOpen) return;
    const active = document.activeElement;
    if (!active || active === document.body || active.closest?.(".court-year")) root.current?.querySelector("#court-report-title")?.focus();
  }, [reportOpen]);
  // The record is kept while the shell is not drawn. When the shell comes back and the court has moved on since the
  // turn was written (the player went on in the panel), the record is no longer the latest: it is dropped.
  const reportChecked = useRef(false);
  useEffect(() => {
    if (reportChecked.current || !view) return;
    reportChecked.current = true;
    if (year.report && Number(view.revision) > Number(year.report.revision)) courtYear.close();
  }, [view, year.report]);
  const { busy } = command;
  useEffect(() => {
    // Nothing closes while a command is written.
    if ((!cardOpen && !answerOpen && !reportOpen) || busy) return undefined;
    const closeOnEscape = (event) => {
      // Escape in a text field is the field's (the search box closes itself with it).
      if (event.key !== "Escape" || event.defaultPrevented || event.target?.closest?.("input, textarea, select, [contenteditable]")) return;
      // Escape closes what focus is in; with focus in none of them, the card first, then the matter, then the record.
      if (reportOpen && (event.target?.closest?.(".court-report") || (!cardOpen && !answerOpen))) closeReport();
      else if (answerOpen && (!cardOpen || event.target?.closest?.(".court-needs"))) shutMatter(openMatterId);
      else shutCard(selectedId);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [cardOpen, answerOpen, reportOpen, selectedId, openMatterId, busy]);
  // The panel's own command for a decision, with the story the player saw when choosing.
  const answerMatter = async (choiceId) => {
    if (!answer) return;
    const story = Object.values(view.stories ?? {}).find((entry) => entry?.id === answer.id);
    const result = await command.run({ type: "resolve_story", payload: { storyId: answer.id, choiceId }, at: "matter",
      noticeOf: (events) => decisionNotice(story, choiceId, events) || commandNotice(events) });
    if (!result?.ok) return;
    // The matter leaves the list with the next read; focus goes to the list's heading, where the notice stands.
    setOpenMatterId(null);
    root.current?.querySelector("#court-needs-title")?.focus();
  };
  // A tick of the year line opens its matter in the list.
  const openMatter = (id) => {
    if (command.busy) return;
    command.clear(); setOpenMatterId(id);
    root.current?.querySelector(`[data-court-matter="${CSS.escape(id)}"]`)?.focus();
  };
  const toggleAct = (type) => {
    if (command.busy) return;
    command.clear(); setOpenAct((current) => (current === type ? null : type));
  };
  const act = async (action, values) => {
    const result = await command.run({ type: action.type, payload: { ...values, [action.field]: action.value }, at: "card", noticeOf: commandNotice });
    if (!result?.ok) return;
    // The form is gone, and the action's row may leave the list with the next read (a released prisoner has no
    // release left), so focus goes to the card's name, which stays.
    setOpenAct(null);
    root.current?.querySelector("#court-card-name")?.focus();
  };
  const shell = useMemo(() => {
    const matters = mattersOf(view);
    return { thread: threadOf(view), matters, flags: flagsOf(matters), figures: figuresOf(view), line: yearLineOf(view) };
  }, [view]);
  if (!view) return null;
  const { thread, matters, flags, figures, line } = shell;
  const onMatter = command.at === "matter", onCard = command.at === "card";
  const medallions = (members) => members.map((member) => (
    <Medallion key={member.person.id} member={member} count={flags.get(member.person.id) ?? 0} updates={updates} selected={card?.person.id === member.person.id} onSelect={select} />
  ));

  return (
    // data-native-text: the shell is written in Swedish, so the page translator applies its whole native book here.
    <div className="court-shell" data-native-text ref={root} aria-busy={command.busy} style={{ top: `calc(${topOffset} + 5rem)` }}>
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
      <div className="court-row">
      <aside className={answer ? "court-needs court-needs--open" : "court-needs"} aria-labelledby="court-needs-title">
        <header>
          <h2 id="court-needs-title" tabIndex={-1}>Kräver dig</h2>
          <span className="court-needs-count">{matters.length}</span>
        </header>
        {onMatter && command.notice && <p className="court-notice" role="status">{command.notice}</p>}
        {matters.length > 0
          ? (
            <ul className="court-matters">
              {matters.map((matter) => (
                <CourtMatter key={matter.id} matter={matter} answer={answer?.id === matter.id ? answer : null} busy={locked}
                  error={onMatter && answer?.id === matter.id ? command.error : ""} updates={updates} onToggle={toggleMatter} onAnswer={answerMatter} />
              ))}
            </ul>
          )
          : <p>Inget kräver dig just nu.</p>}
        {/* The actions that name nobody (a feast, a wonder, the taxes) are in the panel, with every decision. */}
        <button type="button" className="court-needs-more" onClick={() => open({ tab: "decisions" })}>Ärenden och handlingar</button>
      </aside>
      {year.report && <CourtYearReport report={year.report} onClose={closeReport} />}
      {/* The advisor's drawer opens over the right edge: the card steps aside for it. */}
      {card && !rightBusy && (
        <CourtPersonCard card={card} updates={updates} onClose={() => closeCard(selectedId)}>
          <CourtCardActions actions={acts} openType={openAct} busy={locked} error={onCard ? command.error : ""} notice={onCard ? command.notice : ""}
            updates={updates} onToggle={toggleAct} onAct={act}>Handlingar</CourtCardActions>
        </CourtPersonCard>
      )}
      </div>
      {line && (
        <CourtYearLine line={line} year={year} locked={locked} ended={Boolean(view.status?.ended) || view.status === "ended"} updates={updates}
          onOpenMatter={openMatter} onAdvance={() => courtYear.advance(activeGameId)} onReveal={() => courtYear.reveal(activeGameId)} onDismiss={courtYear.close} />
      )}
    </div>
  );
}
