import { useEffect, useRef, useState } from "react";

// The popup's "Visa alla i krönikan" link dispatches this window event.
export const HISTORY_RECORD_EVENT = "oh:open-history-record";

// Lives in the always-mounted game UI, because the character panel is a lazy
// chunk that may not have loaded when the event fires. Each event bumps the
// returned counter and runs `onRequest`; the panel reacts to a changed counter.
// The count belongs to one game: a request made in one campaign reads as 0 in
// the next. This file imports neither the view nor the card, so they stay out
// of the main chunk.
export function useHistoryRecordRequest(gameId, onRequest) {
  const [request, setRequest] = useState({ gameId: null, count: 0 });
  const onRequestRef = useRef(onRequest);
  useEffect(() => { onRequestRef.current = onRequest; });
  useEffect(() => {
    const listener = () => {
      setRequest((previous) => ({ gameId, count: (previous.gameId === gameId ? previous.count : 0) + 1 }));
      onRequestRef.current?.();
    };
    window.addEventListener(HISTORY_RECORD_EVENT, listener);
    return () => window.removeEventListener(HISTORY_RECORD_EVENT, listener);
  }, [gameId]);
  return request.gameId === gameId ? request.count : 0;
}
