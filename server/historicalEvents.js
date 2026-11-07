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

const byImportanceThenId = (a, b) => (b.importance - a.importance) || String(a.id).localeCompare(String(b.id));

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

// Events for every year the game has closed since the campaign start, newest first.
export const historicalRecord = (catalog, startDate, gameDate) => {
  const start = parseGameDate(startDate);
  if (!start) return [];
  return eventsForYears(catalog, yearsClosedBetween(startDate, gameDate), start.year).reverse();
};

export const dateCertaintySv = (event) => CERTAINTY_SV[event?.date?.kind] ?? CERTAINTY_SV.disputed;

export { validateEventCatalog, validateCoverage, renderCoverageReport } from "./historicalEventValidation.js";
