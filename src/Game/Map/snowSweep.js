// The seasons sweep across the map when the game's date moves: the plan of one sweep and its frames.
// Spec: docs/superpowers/specs/2026-11-19-season-sweep-design.md (backlog row 28).
//
// The sweep has a snow layer of its own whose season is a paint value (snowLine.js writes its tiles once for the
// whole year; historicalCartography.js builds its ramp). This module says how long a sweep takes, which day it
// shows at a moment, and how the two snow layers cross-fade. Pure: SeasonalSnow.jsx draws what it answers.
import { dayOfYear, winterShare } from "./snowLine.js";

const DAYS_IN_YEAR = 365;
export const SWEEP_MIN_DAYS = 20;
export const SWEEP_MS_PER_YEAR = 4000;
export const SWEEP_MIN_MS = 1200;
export const SWEEP_FADE_MS = 350;

// A count of days that grows by one per day, with every year 365 days long (the snow has no leap day either).
const dayNumber = (text) => {
  const match = /^(-?\d{1,6})-\d{2}-\d{2}/.exec(String(text ?? ""));
  const day = dayOfYear(text);
  return match && day !== null ? Number(match[1]) * DAYS_IN_YEAR + day : null;
};

/** The days from one game date to another, or null when either cannot be read. */
export function daysBetween(fromDate, toDate) {
  const from = dayNumber(fromDate), to = dayNumber(toDate);
  return from === null || to === null ? null : to - from;
}

/**
 * The sweep for a move of the game's date, or null when there is none: a date that cannot be read, a move
 * backwards, or one shorter than twenty days. A move of more than a year shows one year and the remainder.
 */
export function sweepPlan(fromDate, toDate) {
  const days = daysBetween(fromDate, toDate);
  if (days === null || days < SWEEP_MIN_DAYS) return null;
  const shownDays = days > DAYS_IN_YEAR ? DAYS_IN_YEAR + (days % DAYS_IN_YEAR) : days;
  const runMs = Math.max(SWEEP_MIN_MS, Math.round((shownDays / DAYS_IN_YEAR) * SWEEP_MS_PER_YEAR));
  return { fromDay: dayOfYear(fromDate), shownDays, runMs, totalMs: SWEEP_FADE_MS + runMs + SWEEP_FADE_MS };
}

const easeInOut = (share) => (share < 0.5 ? 2 * share * share : 1 - ((-2 * share + 2) ** 2) / 2);
const clamp01 = (value) => Math.max(0, Math.min(1, value));

/**
 * One frame of a sweep, `elapsedMs` after it began: the day shown and the north's share of winter on it, how strongly
 * the sweep's layer and the resting layer are drawn (0 to 1), whether the resting layer is covered and may move to
 * the new date, and whether the sweep is over.
 */
export function sweepFrame(plan, elapsedMs) {
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  const run = clamp01((elapsed - SWEEP_FADE_MS) / plan.runMs);
  const day = plan.fromDay + plan.shownDays * easeInOut(run);
  const fadeIn = clamp01(elapsed / SWEEP_FADE_MS);
  const fadeOut = clamp01((elapsed - SWEEP_FADE_MS - plan.runMs) / SWEEP_FADE_MS);
  const sweepOpacity = fadeIn * (1 - fadeOut);
  return {
    day,
    northWinter: winterShare(day, 1),
    sweepOpacity,
    restOpacity: 1 - sweepOpacity,
    restCovered: fadeIn >= 1,
    done: elapsed >= plan.totalMs,
  };
}

// The real-history notice opens on the same move of the date and lies over the map with a dimmed ground
// (HistoricalYearNotice.jsx). The sweep waits under it and runs when it is closed.
export const MAP_COVER_SELECTOR = ".hist-backdrop";

/** A sweep's clock: the time it has run, moved on by a frame's `deltaMs` unless the map is covered. */
export const sweepClock = (elapsedMs, deltaMs, covered) => (covered ? elapsedMs : elapsedMs + Math.max(0, deltaMs));
