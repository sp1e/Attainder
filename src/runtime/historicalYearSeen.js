/*! Open Historia — which historical years the player has been shown © 2026 Nicholas Krol, AGPL-3.0-or-later (see LICENSE). */
// Run the tests: node --test src/runtime/historicalYearSeen.test.js
//
// A real-history popup is shown once per device. This keeps, for each campaign,
// the date the player has been shown history through (the watermark). It moves
// only forward and moves when a popup is dismissed. A campaign met for the first
// time starts at its startDate when it is still at the start, otherwise at its
// current gameDate, so an old save or cleared storage never floods the player
// with a backlog.
//
// Kept on this device like unseenEvents.js and written nowhere else: nothing
// here touches the game, the world or its events, and nothing draws randomness.
// A storage that refuses writes is survived on a process-local copy.

import { createMemoryStorage } from "./unseenEvents.js";
import { compareGameDates, isGameDate } from "./gameDates.js";

export const HISTORY_SEEN_KEY = "oh_history_seen_through";
// Campaigns remembered at once, most recently touched last.
const GAMES_KEPT = 24;

const asArray = (value) => (Array.isArray(value) ? value : []);
const asText = (value) => String(value ?? "").trim();

// Resolved at every call, like unseenEvents.js.
const fallbackMemory = createMemoryStorage();
const resolveStorage = () => {
  try {
    if (typeof localStorage !== "undefined" && localStorage) return localStorage;
  } catch { /* refused */ }
  return fallbackMemory;
};
const liveStorage = {
  getItem: (key) => resolveStorage().getItem(key),
  setItem: (key, value) => resolveStorage().setItem(key, value),
};

const cleanGames = (raw) => {
  const seen = new Set();
  const games = [];
  for (const entry of asArray(raw?.games)) {
    const id = asText(entry?.id);
    const through = asText(entry?.through);
    if (!id || !isGameDate(through) || seen.has(id)) continue;
    seen.add(id);
    games.push({ id, through });
  }
  return games;
};

const readGames = (storage) => {
  try {
    return cleanGames(JSON.parse(storage.getItem(HISTORY_SEEN_KEY) ?? "null"));
  } catch {
    return [];
  }
};

export const createHistoricalYearSeen = ({ storage = liveStorage } = {}) => {
  // Set once a write was refused: from then on this session trusts its own copy.
  let refused = false;
  let local = [];

  const read = () => (refused ? local : readGames(storage));

  const write = (games) => {
    local = games;
    try {
      storage.setItem(HISTORY_SEEN_KEY, JSON.stringify({ games }));
      refused = false;
    } catch {
      refused = true;
    }
  };

  const put = (games, id, through) => {
    const rest = games.filter((entry) => entry.id !== id);
    write([...rest, { id, through }].slice(-GAMES_KEPT));
  };

  const seenThrough = (gameId, { startDate, gameDate } = {}) => {
    const id = asText(gameId);
    if (!id || !isGameDate(gameDate)) return "";
    const games = read();
    const found = games.find((entry) => entry.id === id);
    if (found) return found.through;
    const first = isGameDate(startDate) && compareGameDates(gameDate, startDate) === 0 ? startDate : gameDate;
    put(games, id, first);
    return first;
  };

  return {
    seenThrough,
    pendingWindow: (gameId, dates = {}) => {
      const through = seenThrough(gameId, dates);
      if (!through) return null;
      return compareGameDates(dates.gameDate, through) > 0 ? { from: through, to: dates.gameDate } : null;
    },
    markSeen: (gameId, date) => {
      const id = asText(gameId);
      if (!id || !isGameDate(date)) return;
      const games = read();
      const found = games.find((entry) => entry.id === id);
      if (found && compareGameDates(date, found.through) <= 0) return;
      put(games, id, date);
    },
  };
};

export const historicalYearSeen = createHistoricalYearSeen();
