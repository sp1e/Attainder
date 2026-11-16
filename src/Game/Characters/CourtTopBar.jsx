// The court bar: in a campaign with a court it stands where the session pill and "Exit Game" stood. It names the realm
// (the family in family mode), the date and the mode, and holds the two ways out of the map: the court panel and the
// main menu. LibraryTopBar draws it through its `inGameBar` prop, on a desktop.
// Spec: docs/superpowers/specs/2026-11-15-court-shell-design.md, slice 4.
import React from "react";
import "./courtShell.css";
import { useLibraryState } from "../../runtime/library.js";
import { useCourtView } from "../../runtime/useCourtView.js";
import { dateLabel } from "./ActionBox.jsx";

const entries = (value) => (Array.isArray(value) ? value : Object.values(value ?? {}));

export default function CourtTopBar({ top, left, courtOpen, onOpenCourt, onExit }) {
  const { activeGameId } = useLibraryState();
  const { view } = useCourtView(activeGameId);
  const family = view?.mode === "family";
  // The panel's own choice of name: the family the player follows, or the realm.
  const name = !view ? "" : family
    ? entries(view.families).find((entry) => entry.id === view.identity?.familyId)?.name ?? ""
    : view.identity?.realmName || view.economy?.polityName || "Riket";
  return (
    // data-native-text: the bar is written in Swedish, so the page translator applies its whole native book here.
    // The buttons are there before the court is read: they are the ways out of the map.
    <header className="court-top" data-native-text style={{ top, left }}>
      {view && (
        <div className="court-top-title">
          <h1>{name}</h1>
          <span className="court-top-when">{dateLabel(view.date)}</span>
          <span className="court-top-mode">{family ? "FÖLJ FAMILJEN" : "FÖLJ RIKET"}</span>
        </div>
      )}
      <button type="button" className="court-top-court" aria-expanded={courtOpen} data-court-button onClick={onOpenCourt}>
        <span aria-hidden="true">◇ </span>Rike & familjer
      </button>
      <button type="button" title="Lämna spelet och gå till huvudmenyn" onClick={onExit}>Huvudmeny</button>
    </header>
  );
}
