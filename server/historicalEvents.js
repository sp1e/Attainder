import { compareGameDates, formatGameDate, parseGameDate, shiftGameYear } from "./gameDates.js";

export const MAX_NOTICE_EVENTS = 12;

const CERTAINTY_SV = Object.freeze({
  exact: "Säkert år",
  approximate: "Ungefärligt datum",
  range: "Tidsspann",
  disputed: "Omtvistat datum",
});

// Calendar years whose last day falls after `from` (inclusive) and before `to`
// (exclusive), ascending. Each year is reported by exactly one turn, so
// adjoining turns never repeat or skip a year.
export const yearsClosedBetween = (from, to) => {
  const start = parseGameDate(from);
  if (!start || !parseGameDate(to) || compareGameDates(from, to) >= 0) return [];
  const years = [];
  for (let year = start.year; ; year = shiftGameYear(year, 1)) {
    const lastDay = formatGameDate({ year, month: 12, day: 31 });
    if (compareGameDates(lastDay, to) >= 0) break;
    if (compareGameDates(from, lastDay) <= 0) years.push(year);
  }
  return years;
};

// The one year in which an event is reported, or null when the event ended
// before the campaign began. A range that spans the campaign start anchors at
// the start year; a later range anchors at its own first year. Signed years
// with no year zero order correctly as plain numbers.
export const eventAnchorYear = (event, campaignStartYear) => {
  const startYear = event?.date?.startYear;
  if (!Number.isInteger(startYear) || !Number.isInteger(campaignStartYear)) return null;
  const endYear = Number.isInteger(event.date.endYear) ? event.date.endYear : startYear;
  if (endYear < campaignStartYear) return null;
  return startYear < campaignStartYear ? campaignStartYear : startYear;
};

// Code-point order, so the same ids sort the same way on every device and locale.
const byCodePoint = (a, b) => {
  const left = String(a);
  const right = String(b);
  if (left === right) return 0;
  return left < right ? -1 : 1;
};
const byImportanceThenId = (a, b) => (b.importance - a.importance) || byCodePoint(a.id, b.id);

export const eventsForYears = (catalog, years, campaignStartYear) => {
  const events = Array.isArray(catalog?.events) ? catalog.events : [];
  const wanted = new Set(years);
  const byYear = new Map();
  for (const event of events) {
    const year = eventAnchorYear(event, campaignStartYear);
    if (year === null || !wanted.has(year)) continue;
    byYear.set(year, [...(byYear.get(year) ?? []), event]);
  }
  return years
    .filter((year) => byYear.has(year))
    .map((year) => ({ year, events: byYear.get(year).sort(byImportanceThenId) }));
};

// Flattens the per-year groups of eventsForYears into the order a capped list
// shows: importance first, then the year the event is reported in, then id. A
// long jump keeps its important events instead of its earliest ones.
export const noticeEvents = (groups) => (Array.isArray(groups) ? groups : [])
  .flatMap((group) => group.events.map((event) => ({ event, year: group.year })))
  .sort((a, b) => (b.event.importance - a.event.importance)
    || (a.year - b.year)
    || byCodePoint(a.event.id, b.event.id))
  .map((entry) => entry.event);

// Events for every year the game has closed since the campaign start, newest first.
export const historicalRecord = (catalog, startDate, gameDate) => {
  const start = parseGameDate(startDate);
  if (!start) return [];
  return eventsForYears(catalog, yearsClosedBetween(startDate, gameDate), start.year).reverse();
};

export const dateCertaintySv = (event) => CERTAINTY_SV[event?.date?.kind] ?? CERTAINTY_SV.disputed;

export { validateEventCatalog, validateCoverage, renderCoverageReport } from "./historicalEventValidation.js";
