// The year turn of the court over the map. It runs through the panel's own entries and is kept here, beside the
// shell: the model takes minutes to write a year, the shell is not drawn while the panel or a menu is open, and the
// year's record must be there when the shell comes back.
// Spec: docs/superpowers/specs/2026-11-15-court-shell-design.md, slice 4.
import { useMemo, useSyncExternalStore } from "react";
import { playerText } from "./playerText.js";
import { yearRefusal } from "./yearRefusal.js";

// The panel's own sentence for a refusal the player may not read. A model year says what kind of failure it met.
const ACTION_FAILED = "Handlingen kunde inte genomföras.";
const actionRefusal = (message) => playerText(message, ACTION_FAILED);
const QUIET = Object.freeze({ campaign: null, busy: false, kind: null, error: "", report: null });

/**
 * A year turn's state and its two moves. `load` resolves to the runtime's entries. `advance` lets a year pass with
 * the model; `reveal` reads the last saved turn without letting time pass. `kind` is "year" or "last"; a written
 * turn leaves `report = { kind, revision, events, interruption }`, `revision` being the court's when the turn was
 * written. One move at a time, whatever the campaign: `of` gives a campaign its own turn, or only the word that
 * another campaign's turn is being written.
 */
export function createCourtYear(load) {
  let state = QUIET;
  const listeners = new Set();
  const set = (next) => { state = next; for (const listener of listeners) listener(); };
  const run = async (campaign, kind, entry, refusal) => {
    if (state.busy) return;
    set({ campaign, busy: true, kind, error: "", report: null });
    let result;
    try {
      result = await (await load())[entry]();
    } catch (reason) {
      result = { ok: false, error: reason?.message };
    }
    set(result?.ok
      ? { campaign, busy: false, kind, error: "", report: { kind, revision: result.state?.revision ?? null, events: result.events || [], interruption: result.interruption ?? null } }
      : { campaign, busy: false, kind, error: refusal(result?.error), report: null });
  };
  return {
    read: () => state,
    of: (campaign) => (state.campaign === campaign ? state : { ...QUIET, busy: state.busy }),
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    advance: (campaign) => run(campaign, "year", "advanceCharacterYearWithModel", yearRefusal),
    reveal: (campaign) => run(campaign, "last", "revealLatestCharacterTurn", actionRefusal),
    /** Drops the record and the refusal. Nothing closes while a turn is written. */
    close: () => { if (!state.busy && (state.error || state.report)) set({ ...state, error: "", report: null }); },
  };
}

// The character engine is imported on demand, as the court's reader imports it.
export const courtYear = createCourtYear(() => import("../../runtime/characterRuntime.js"));

/** The year turn of this campaign: a turn belongs to its campaign and is never shown for another. */
export const useCourtYear = (campaign) => {
  const state = useSyncExternalStore(courtYear.subscribe, courtYear.read, courtYear.read);
  return useMemo(() => (state.campaign === campaign ? state : { ...QUIET, busy: state.busy }), [state, campaign]);
};
