// A command from the court over the map: an answer to a matter, or an action from a person's card. It goes in through
// the panel's own entry, with the revision of the view the shell shows, one command at a time.
// Spec: docs/superpowers/specs/2026-11-15-court-shell-design.md, slice 3.
import { useCallback, useRef, useState } from "react";
import { playerText } from "./playerText.js";

// The panel's own sentence for a refusal the player may not read.
const ACTION_FAILED = "Handlingen kunde inte genomföras.";
const QUIET = Object.freeze({ busy: false, at: null, error: "", notice: "" });

/**
 * `{ busy, at, error, notice, run, clear }`. `at` says where the feedback belongs: the list ("matter") or the card
 * ("card"). `run` resolves to the engine's result, or to `undefined` when a command is already being written.
 */
export const useCourtCommand = (revision) => {
  const [state, setState] = useState(QUIET);
  const lock = useRef(false);
  const run = useCallback(async ({ type, payload, at, noticeOf }) => {
    if (lock.current) return undefined;
    lock.current = true;
    setState({ busy: true, at, error: "", notice: "" });
    let result;
    try {
      // The character engine is imported on demand, as the court's reader imports it.
      const { submitCharacterCommand } = await import("../../runtime/characterRuntime.js");
      result = await submitCharacterCommand({ type, payload, expectedRevision: revision, id: `ui-${crypto.randomUUID()}` });
    } catch (reason) {
      result = { ok: false, error: reason?.message };
    } finally {
      lock.current = false;
    }
    setState(result?.ok
      ? { busy: false, at, error: "", notice: noticeOf(result.events || []) }
      : { busy: false, at, error: playerText(result?.error, ACTION_FAILED), notice: "" });
    return result;
  }, [revision]);
  const clear = useCallback(() => setState((current) => (current.busy || (!current.error && !current.notice) ? current : QUIET)), []);
  return { ...state, run, clear };
};
