import React, { useEffect, useRef, useState } from "react";
import { useRuntimeState } from "../../runtime/useRuntimeState.js";
import { UNSEEN_EVENTS_CHANGED, latestTurnEventIds, unseenEvents } from "../../runtime/unseenEvents.js";
import { historicalYearSeen } from "../../runtime/historicalYearSeen.js";
import { MAX_NOTICE_EVENTS, eventsForYears, noticeEvents, yearsClosedBetween } from "../../runtime/historicalEvents.js";
import { loadHistoricalEventCatalog } from "../../runtime/historicalEventCatalog.js";
import { parseGameDate } from "../../runtime/gameDates.js";
import { useBackToClose } from "../../runtime/backToClose.js";
import { isSimulationBusy, subscribeSimulationIdle } from "../AI/simulationStatus.js";
import HistoricalEventCard from "./HistoricalEventCard.jsx";
import "./characters.css";

// The character panel's own theme key (CharactersPanel.jsx), read once on open.
const THEME_KEY = "oh:characters:theme";
const readTheme = () => {
  let choice = "system";
  try { choice = localStorage.getItem(THEME_KEY) || "system"; } catch { /* system theme */ }
  if (choice === "light" || choice === "dark") return choice;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

// Elements the Tab key can reach inside the dialog.
const FOCUSABLE = "a[href], button:not(:disabled), summary, [tabindex]:not([tabindex=\"-1\"])";

const selectTurnKey = (world) => latestTurnEventIds(world).join("\n");
const selectStart = (game) => game?.startDate ?? "";
const selectNow = (game) => game?.gameDate ?? "";

// After the turn that closes a real calendar year, shows the sourced real-world
// events of that year once per device. Nothing here is saved to the game and no
// model is called; the watermark in historicalYearSeen is the only thing written.
export default function HistoricalYearNotice({ gameId, hidden }) {
  const startDate = useRuntimeState("game", selectStart);
  const gameDate = useRuntimeState("game", selectNow);
  const turnKey = useRuntimeState("world", selectTurnKey);
  const [notice, setNotice] = useState(null);
  const [theme] = useState(readTheme);
  const noticeRef = useRef(null);
  const tokenRef = useRef(0);
  const dialogRef = useRef(null);
  const openerRef = useRef(null);
  const checkRef = useRef(null);
  const mountedRef = useRef(true);
  // Set while the dialog closes: returning focus to the opener fires focusin
  // before the listeners are removed, and that must not pull focus back in.
  const closingRef = useRef(false);

  // Looks again at everything that decides whether a window is due. A newer
  // call, a change of inputs or an unmount makes an older one that is still
  // waiting for the catalog stand down.
  useEffect(() => {
    const ready = () => !hidden && Boolean(gameId) && !noticeRef.current && !isSimulationBusy()
      && unseenEvents.unseenInTurn(String(turnKey || "").split("\n").filter(Boolean)).size === 0;
    const check = async () => {
      if (!ready()) return;
      const start = parseGameDate(startDate);
      const due = historicalYearSeen.pendingWindow(gameId, { startDate, gameDate });
      if (!start || !due) return;
      const token = ++tokenRef.current;
      // Taken before the wait, so closing returns focus to where the player was.
      const opener = typeof document !== "undefined" ? document.activeElement : null;
      let catalog;
      try { catalog = await loadHistoricalEventCatalog(); } catch { return; }
      if (token !== tokenRef.current || !mountedRef.current || !ready()) return;
      const groups = eventsForYears(catalog, yearsClosedBetween(due.from, due.to), start.year);
      // Importance first, then date: a long jump keeps its major events within the cap.
      const events = noticeEvents(groups);
      if (events.length === 0) {
        historicalYearSeen.markSeen(gameId, due.to);
        return;
      }
      noticeRef.current = { to: due.to };
      closingRef.current = false;
      openerRef.current = opener;
      setNotice({
        to: due.to,
        events: events.slice(0, MAX_NOTICE_EVENTS),
        more: Math.max(0, events.length - MAX_NOTICE_EVENTS),
        sources: Array.isArray(catalog?.sources) ? catalog.sources : [],
      });
    };
    checkRef.current = check;
    tokenRef.current += 1;
    check();
    return () => { tokenRef.current += 1; };
  }, [gameId, startDate, gameDate, turnKey, hidden]);

  useEffect(() => {
    mountedRef.current = true;
    const again = () => checkRef.current?.();
    window.addEventListener(UNSEEN_EVENTS_CHANGED, again);
    const unsubscribe = subscribeSimulationIdle(again);
    return () => {
      mountedRef.current = false;
      window.removeEventListener(UNSEEN_EVENTS_CHANGED, again);
      unsubscribe();
    };
  }, []);

  const open = Boolean(notice) && !hidden;
  const close = () => {
    closingRef.current = true;
    historicalYearSeen.markSeen(gameId, notice.to);
    noticeRef.current = null;
    setNotice(null);
    try { openerRef.current?.focus?.(); } catch { /* the opener is gone */ }
  };
  const closeRef = useRef(close);
  useEffect(() => { closeRef.current = close; });
  // On a phone, Back closes the popup the way Escape does.
  useBackToClose(open, close);

  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  // The dialog is modal: Escape and Tab are taken in the capture phase, ahead of
  // the character panel underneath, and focus cannot rest outside it.
  useEffect(() => {
    if (!open) return undefined;
    const reachable = () => [...(dialogRef.current?.querySelectorAll(FOCUSABLE) ?? [])]
      .filter((node) => node.tagName === "SUMMARY" || !node.closest("details:not([open])"));
    const onKeyDown = (event) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      const items = reachable();
      if (items.length === 0) { event.preventDefault(); dialog?.focus(); return; }
      const active = document.activeElement;
      const outside = !dialog?.contains(active);
      const atStart = event.shiftKey && (active === items[0] || active === dialog);
      const atEnd = !event.shiftKey && active === items[items.length - 1];
      if (outside || atStart || atEnd) {
        event.preventDefault();
        items[event.shiftKey ? items.length - 1 : 0].focus();
      }
    };
    const onFocusIn = (event) => {
      if (closingRef.current) return;
      if (dialogRef.current && !dialogRef.current.contains(event.target)) (reachable()[0] ?? dialogRef.current).focus();
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("focusin", onFocusIn, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("focusin", onFocusIn, true);
    };
  }, [open]);

  // Close first: this dialog sits above the chronicle panel it opens.
  const openChronicle = () => {
    close();
    window.dispatchEvent(new CustomEvent("oh:open-history-record"));
  };

  if (!open) return null;

  return <div className="char-backdrop hist-backdrop" data-char-theme={theme}>
    <div ref={dialogRef} className="hist-notice" role="dialog" aria-modal="true" aria-labelledby="hist-notice-title" tabIndex={-1}>
      <header>
        <h2 id="hist-notice-title">I verklighetens historia</h2>
        <p>Det här hände i den verkliga världen. Din kampanj kan ha tagit en annan väg.</p>
      </header>
      <div className="hist-list">
        {notice.events.map((event) => <HistoricalEventCard key={event.id} event={event} sources={notice.sources} />)}
      </div>
      <footer>
        {notice.more > 0 && <button type="button" className="hist-link" onClick={openChronicle}>Visa alla i krönikan</button>}
        <button type="button" className="hist-close" onClick={close}>Stäng</button>
      </footer>
    </div>
  </div>;
}
