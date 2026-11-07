import { astronomicalYear } from "./gameDates.js";
import { HISTORICAL_START_RANGE } from "./historicalStarts.js";

export const EVENT_CATEGORIES = Object.freeze(["politics", "war", "migration", "religion", "culture", "discovery", "technology", "nature"]);
export const DATE_KINDS = Object.freeze(["exact", "approximate", "range", "disputed"]);
export const COVERAGE_STATUSES = Object.freeze(["unresearched", "no-secure-event", "partial", "reviewed"]);
export const SOURCE_FIELDS = Object.freeze(["id", "title", "institution", "url", "locator", "retrievedOn", "originalChronology", "reuseTerms"]);

const { minYear, maxYear } = HISTORICAL_START_RANGE;
const filled = (value) => typeof value === "string" && value.trim() !== "";
const validYear = (year) => Number.isInteger(year) && year !== 0 && year >= minYear && year <= maxYear;
// A calendar day written YYYY-MM-DD that exists (2026-02-30 does not).
const validDay = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const urlError = (value) => {
  try {
    return new URL(value).hostname === "" ? "has no host" : null;
  } catch {
    return "is not a valid URL";
  }
};
const done = (errors, extra = {}) => (errors.length ? { ok: false, errors } : { ok: true, ...extra });

export const validateSource = (source, label) => {
  if (source === null || typeof source !== "object") return [`${label}: not an object`];
  const errors = SOURCE_FIELDS.filter((field) => !filled(source[field])).map((field) => `${label}: missing ${field}`);
  if (filled(source.url)) {
    if (!/^https?:\/\//.test(source.url)) errors.push(`${label}: url must start with https:// or http://`);
    else {
      const problem = urlError(source.url);
      if (problem) errors.push(`${label}: url ${problem}`);
    }
  }
  if (filled(source.retrievedOn) && !validDay(source.retrievedOn)) errors.push(`${label}: retrievedOn is not a valid date`);
  return errors;
};

const dateErrors = (date, label) => {
  if (date === null || typeof date !== "object") return [`${label}: missing date`];
  const errors = [];
  if (!DATE_KINDS.includes(date.kind)) errors.push(`${label}: unknown date kind ${date.kind}`);
  if (!validYear(date.startYear)) errors.push(`${label}: startYear ${date.startYear} is not a year in ${minYear}..${maxYear} (no year zero)`);
  if (!validYear(date.endYear)) errors.push(`${label}: endYear ${date.endYear} is not a year in ${minYear}..${maxYear} (no year zero)`);
  if (errors.length) return errors;
  if (astronomicalYear(date.startYear) > astronomicalYear(date.endYear)) errors.push(`${label}: startYear is after endYear`);
  if (date.kind === "range" && date.startYear === date.endYear) errors.push(`${label}: range date must span more than one year`);
  if (date.kind === "exact" && date.startYear !== date.endYear) errors.push(`${label}: exact date must have startYear equal to endYear`);
  if (!filled(date.displaySv)) errors.push(`${label}: missing date.displaySv`);
  return errors;
};

const eventErrors = (event, label, sourceIds) => {
  if (event === null || typeof event !== "object") return [`${label}: not an object`];
  const errors = dateErrors(event.date, label);
  if (!filled(event.id)) errors.push(`${label}: missing id`);
  for (const field of ["titleSv", "summarySv", "geographySv", "selectionNote"]) {
    if (!filled(event[field])) errors.push(`${label}: missing ${field}`);
  }
  if (!EVENT_CATEGORIES.includes(event.category)) errors.push(`${label}: unknown category ${event.category}`);
  if (![1, 2, 3].includes(event.importance)) errors.push(`${label}: importance must be 1, 2 or 3`);
  const ids = Array.isArray(event.sourceIds) ? event.sourceIds : [];
  if (ids.length === 0) errors.push(`${label}: needs at least one source id`);
  for (const id of ids) if (!sourceIds.has(id)) errors.push(`${label}: unknown source id ${id}`);
  const review = event.review;
  if (review?.status !== "approved") errors.push(`${label}: review status must be approved`);
  else if (!filled(review.reviewedBy) || !filled(review.reviewedOn)) errors.push(`${label}: review needs reviewedBy and reviewedOn`);
  else if (!validDay(review.reviewedOn)) errors.push(`${label}: reviewedOn is not a valid date`);
  return errors;
};

export const validateEventCatalog = (catalog) => {
  if (catalog === null || typeof catalog !== "object") return { ok: false, errors: ["catalog: not an object"] };
  const errors = [];
  if (catalog.schemaVersion !== 1) errors.push("catalog: schemaVersion must be 1");
  if (!Array.isArray(catalog.sources) || !Array.isArray(catalog.events)) {
    return { ok: false, errors: [...errors, "catalog: sources and events must be arrays"] };
  }
  const sourceIds = new Set();
  catalog.sources.forEach((source, i) => {
    errors.push(...validateSource(source, `source[${i}]`));
    if (sourceIds.has(source?.id)) errors.push(`source[${i}]: duplicate id ${source.id}`);
    sourceIds.add(source?.id);
  });
  const eventIds = new Set();
  catalog.events.forEach((event, i) => {
    errors.push(...eventErrors(event, `event[${i}] ${event?.id ?? ""}`.trim(), sourceIds));
    if (eventIds.has(event?.id)) errors.push(`event[${i}]: duplicate id ${event.id}`);
    eventIds.add(event?.id);
  });
  const cited = new Set(catalog.events.flatMap((event) => (Array.isArray(event?.sourceIds) ? event.sourceIds : [])));
  catalog.sources.forEach((source, i) => {
    if (filled(source?.id) && !cited.has(source.id)) errors.push(`source[${i}]: ${source.id} is cited by no event`);
  });
  return done(errors);
};

const rangeLabel = (range, i) => `range[${i}] ${range?.startYear}..${range?.endYear}`;

const rangeErrors = (range, i) => {
  const label = rangeLabel(range, i);
  if (range === null || typeof range !== "object") return [`${label}: not an object`];
  const errors = [];
  if (!validYear(range.startYear) || !validYear(range.endYear)) errors.push(`${label}: years must be nonzero integers in ${minYear}..${maxYear}`);
  else if (astronomicalYear(range.startYear) > astronomicalYear(range.endYear)) errors.push(`${label}: startYear is after endYear`);
  if (!COVERAGE_STATUSES.includes(range.status)) errors.push(`${label}: unknown status ${range.status}`);
  if (!filled(range.note)) errors.push(`${label}: missing note`);
  return errors;
};

const partitionErrors = (ranges) => {
  const errors = [];
  const sorted = [...ranges].sort((a, b) => astronomicalYear(a.startYear) - astronomicalYear(b.startYear));
  let expected = astronomicalYear(minYear);
  for (const range of sorted) {
    const start = astronomicalYear(range.startYear);
    if (start > expected) errors.push(`gap: no range covers astronomical years ${expected}..${start - 1}`);
    if (start < expected) errors.push(`overlap: range starting ${range.startYear} begins before ${expected}`);
    expected = Math.max(expected, astronomicalYear(range.endYear) + 1);
  }
  if (expected <= astronomicalYear(maxYear)) errors.push(`gap: ranges stop before ${maxYear}`);
  return errors;
};

export const rangeYearCount = (range) => astronomicalYear(range.endYear) - astronomicalYear(range.startYear) + 1;

export const validateCoverage = (coverage, catalog) => {
  if (coverage === null || typeof coverage !== "object" || !Array.isArray(coverage.ranges)) {
    return { ok: false, errors: ["coverage: ranges must be an array"] };
  }
  const errors = [];
  if (coverage.schemaVersion !== 1) errors.push("coverage: schemaVersion must be 1");
  coverage.ranges.forEach((range, i) => errors.push(...rangeErrors(range, i)));
  if (errors.length) return { ok: false, errors };
  errors.push(...partitionErrors(coverage.ranges));
  const events = Array.isArray(catalog?.events) ? catalog.events : [];
  for (const event of events) {
    const startYear = event?.date?.startYear;
    if (!Number.isInteger(startYear)) continue;
    const endYear = Number.isInteger(event.date.endYear) ? event.date.endYear : startYear;
    for (const range of coverage.ranges) {
      if (range.status === "no-secure-event" && startYear <= range.endYear && endYear >= range.startYear) {
        errors.push(`event ${event.id} (${startYear}..${endYear}) overlaps range ${range.startYear}..${range.endYear} marked no-secure-event`);
      }
      // An unresearched range holds no reviewed events; the event's own first year decides.
      if (range.status === "unresearched" && startYear >= range.startYear && startYear <= range.endYear) {
        errors.push(`event ${event.id} (${startYear}) lies in range ${range.startYear}..${range.endYear} marked unresearched`);
      }
    }
  }
  if (errors.length) return { ok: false, errors };
  const totals = Object.fromEntries(COVERAGE_STATUSES.map((status) => [status, 0]));
  for (const range of coverage.ranges) totals[range.status] += rangeYearCount(range);
  return { ok: true, totals };
};

const yearLabel = (year) => (year < 0 ? `${-year} BC` : `AD ${year}`);

// Deterministic Markdown: no clock, input order preserved.
export const renderCoverageReport = (coverage, catalog) => {
  const result = validateCoverage(coverage, catalog);
  if (!result.ok) throw new Error(`Coverage is invalid:\n${result.errors.join("\n")}`);
  const total = Object.values(result.totals).reduce((a, b) => a + b, 0);
  const events = Array.isArray(catalog?.events) ? catalog.events.length : 0;
  const sources = Array.isArray(catalog?.sources) ? catalog.sources.length : 0;
  const lines = [
    "# Historical events coverage",
    "",
    "<!-- Generated by scripts/check-historical-events.mjs. Do not edit by hand. -->",
    "",
    `Research range: ${yearLabel(minYear)} to ${yearLabel(maxYear)}, ${total} calendar years (no year zero).`,
    `Catalog: ${events} approved events, ${sources} sources.`,
    "",
    "| Status | Years |",
    "| --- | ---: |",
    ...COVERAGE_STATUSES.map((status) => `| ${status} | ${result.totals[status]} |`),
    `| Total | ${total} |`,
    "",
    "## Ranges",
    "",
    "| From | To | Years | Status | Note |",
    "| --- | --- | ---: | --- | --- |",
    ...coverage.ranges.map((r) => `| ${yearLabel(r.startYear)} | ${yearLabel(r.endYear)} | ${rangeYearCount(r)} | ${r.status} | ${r.note.replace(/\|/g, "\\|")} |`),
    "",
  ];
  return lines.join("\n");
};
