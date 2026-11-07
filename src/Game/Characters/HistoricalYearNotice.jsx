import React, { useEffect, useRef, useState } from "react";
import { useRuntimeState } from "../../runtime/useRuntimeState.js";
import { UNSEEN_EVENTS_CHANGED, latestTurnEventIds, unseenEvents } from "../../runtime/unseenEvents.js";
import { historicalYearSeen } from "../../runtime/historicalYearSeen.js";
import { MAX_NOTICE_EVENTS, eventsForYears, yearsClosedBetween } from "../../runtime/historicalEvents.js";
import { loadHistoricalEventCatalog } from "../../runtime/historicalEventCatalog.js";
import { parseGameDate } from "../../runtime/gameDates.js";
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

  // Looks again at everything that decides whether a window is due. A newer call
  // makes an older one still waiting for the catalog stand down.
  useEffect(() => {
    const check = async () => {
      if (hidden || !gameId || noticeRef.current) return;
      if (isSimulationBusy()) return;
      if (unseenEvents.unseenInTurn(String(turnKey || "").split("\n").filter(Boolean)).length > 0) return;
      const start = parseGameDate(startDate);
      const due = historicalYearSeen.pendingWindow(gameId, { startDate, gameDate });
      if (!start || !due) return;
      const token = ++tokenRef.current;
      let catalog;
      try { catalog = await loadHistoricalEventCatalog(); } catch { return; }
      if (token !== tokenRef.current || noticeRef.current || isSimulationBusy()) return;
      const groups = eventsForYears(catalog, yearsClosedBetween(due.from, due.to), start.year);
      const events = groups.flatMap((group) => group.events);
      if (events.length === 0) {
        historicalYearSeen.markSeen(gameId, due.to);
        return;
      }
      noticeRef.current = { to: due.to };
      openerRef.current = typeof document !== "undefined" ? document.activeElement : null;
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
  }, [gameId, startDate, gameDate, turnKey, hidden]);

  useEffect(() => {
    const again = () => checkRef.current?.();
    window.addEventListener(UNSEEN_EVENTS_CHANGED, again);
    const unsubscribe = subscribeSimulationIdle(again);
    return () => {
      window.removeEventListener(UNSEEN_EVENTS_CHANGED, again);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (notice && !hidden) dialogRef.current?.focus();
  }, [notice, hidden]);

  if (!notice || hidden) return null;

  const close = () => {
    historicalYearSeen.markSeen(gameId, notice.to);
    noticeRef.current = null;
    setNotice(null);
    try { openerRef.current?.focus?.(); } catch { /* the opener is gone */ }
  };
  const onKeyDown = (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    close();
  };

  return <div className="char-backdrop hist-backdrop" data-char-theme={theme}>
    <div ref={dialogRef} className="hist-notice" role="dialog" aria-modal="true" aria-labelledby="hist-notice-title" tabIndex={-1} onKeyDown={onKeyDown}>
      <header>
        <h2 id="hist-notice-title">I verklighetens historia</h2>
        <p>Det här hände i den verkliga världen. Din kampanj kan ha tagit en annan väg.</p>
      </header>
      <div className="hist-list">
        {notice.events.map((event) => <HistoricalEventCard key={event.id} event={event} sources={notice.sources} />)}
      </div>
      <footer>
        {notice.more > 0 && <button type="button" className="hist-link" onClick={() => window.dispatchEvent(new CustomEvent("oh:open-history-record"))}>Visa alla i krönikan</button>}
        <button type="button" className="hist-close" onClick={close}>Stäng</button>
      </footer>
    </div>
  </div>;
}
