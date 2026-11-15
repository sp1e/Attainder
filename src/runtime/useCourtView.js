// The court as the player sees it, for what stands outside the court panel: the shell over the map and the rulers at
// their seats. One read per campaign and revision, shared between the callers.
import { useEffect, useState, useSyncExternalStore } from "react";
import { UNSEEN_EVENTS_CHANGED } from "./unseenEvents.js";
import { useRuntimeState } from "./useRuntimeState.js";

// The court a player sees leaves out the effects of a turn's events he has not read yet. Reading them changes what
// he sees without moving the court's revision, so the count of such changes is part of what a read is for.
let seenEpoch = 0;
const subscribeSeen = (notify) => {
  const bump = () => { seenEpoch += 1; notify(); };
  window.addEventListener(UNSEEN_EVENTS_CHANGED, bump);
  return () => window.removeEventListener(UNSEEN_EVENTS_CHANGED, bump);
};
const readSeenEpoch = () => seenEpoch;

// The read of one campaign at one revision. Two callers at the same revision get the same promise.
let shared = { key: "", promise: null };
const readCourt = (key) => {
  if (shared.key === key && shared.promise) return shared.promise;
  const promise = (async () => {
    // The character engine is imported on demand, as the court panel is.
    const { readVisibleCharacterState } = await import("./characterRuntime.js");
    const { getCharacterPresentation } = await import("./characters/index.js");
    const state = await readVisibleCharacterState();
    return state ? getCharacterPresentation(state) : null;
  })();
  shared = { key, promise };
  // A failed read is not kept: the next caller reads again.
  promise.catch(() => { if (shared.promise === promise) shared = { key: "", promise: null }; });
  return promise;
};

/**
 * `{ hasCourt, view }` for the active campaign. The view is read again when the court's revision moves and when the
 * player has read a turn's events. While the
 * engine has a transaction to recover the hook waits: reading then would start the recovery, which is the court
 * panel's to do. A view belongs to the campaign it was read for and is never shown for another.
 */
export const useCourtView = (activeGameId) => {
  const revision = useRuntimeState("world", (world) => world?.characterSystem?.revision ?? null);
  const transactionPending = useRuntimeState("world", (world) => Boolean(world?.characterTransaction));
  const seen = useSyncExternalStore(subscribeSeen, readSeenEpoch);
  const hasCourt = revision !== null;
  const [loaded, setLoaded] = useState({ campaign: null, view: null });
  useEffect(() => {
    if (!hasCourt || transactionPending) return undefined;
    let current = true;
    readCourt(`${activeGameId}:${revision}:${seen}`)
      .then((view) => { if (current) setLoaded({ campaign: activeGameId, view }); })
      .catch((error) => { if (current) console.warn("[court] the court could not be read:", error); });
    return () => { current = false; };
  }, [activeGameId, hasCourt, revision, seen, transactionPending]);
  return { hasCourt, view: hasCourt && loaded.campaign === activeGameId ? loaded.view : null };
};
