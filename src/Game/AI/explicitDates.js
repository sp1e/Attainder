/*! Open Historia — explicit dates in an administrator's words, AGPL-3.0-or-later (see LICENSE). */
// Reads the dates an administrator names in free text ("25 December 800",
// "December 25, 2025", "15 March 3000 BC", "0800-12-25") as canonical game
// dates. A year of one to three digits counts only when an era word marks it
// or the phrase ends after it, so "March 3, 200 soldiers" stays undated.
import { formatGameDate, normalizeGameDate, parseGameDate } from "../../runtime/gameDates.js";

const MONTHS = Object.freeze({
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5,
  jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
});
const MONTH = "January|February|March|April|May|June|July|August|September|Sept|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec";
const ERA_AFTER = "(?:\\s*(B\\.?\\s?C\\.?(?:\\s?E\\.?)?|A\\.?\\s?D\\.?|C\\.?\\s?E\\.?)(?![A-Za-z]))?";
const ERA_BEFORE = "(?:(?:A\\.?\\s?D\\.?|C\\.?\\s?E\\.?)\\s+)?";
const ORDINAL = "(?:st|nd|rd|th)?";
const YEAR = `(${ERA_BEFORE})(\\d{1,4})(?!\\d)${ERA_AFTER}`;
const DAY_FIRST = new RegExp(`\\b(\\d{1,2})${ORDINAL}\\s+(${MONTH})\\s*,?\\s+${YEAR}`, "gi");
const MONTH_FIRST = new RegExp(`\\b(${MONTH})\\s+(\\d{1,2})${ORDINAL}\\s*,?\\s+${YEAR}`, "gi");
const ISO = /(?<![\d-])(-?\d{1,6}-\d{2}-\d{2})\b(\s*(?:BCE|BC|CE|AD)\b)?/gi;
// A comma does not end a phrase: "May 5, 20, 30 men" counts heads.
const ENDS_PHRASE = /^\s*(?:$|[.;:!?)])/;
const ERA_WORD = "(?<![A-Za-z])(B\\.?\\s?C\\.?(?:\\s?E\\.?)?|A\\.?\\s?D\\.?|C\\.?\\s?E\\.?)(?![A-Za-z])";
const ERA_YEAR = new RegExp(`(?:(?<![A-Za-z])(?:A\\.?\\s?D\\.?|C\\.?\\s?E\\.?)\\s+(\\d{1,4})(?!\\d))|(?:(?<![\\d.])(\\d{1,4})\\s*${ERA_WORD})`, "i");
const FOUR_DIGIT = new RegExp(`(?:^|\\D)(\\d{4})(?!\\d)(?:\\s*${ERA_WORD})?`, "i");

const isBc = (era) => /^B/i.test(era || "");

/** The signed year of a matched year, or null when a short year has nothing to mark it as a year. */
function yearOf(eraBefore, digits, eraAfter, rest) {
  const marked = Boolean(eraBefore || eraAfter);
  if (digits.length < 4 && !marked && !ENDS_PHRASE.test(rest)) return null;
  const year = Number(digits);
  if (!year) return null;
  return isBc(eraAfter) ? -year : year;
}

function namedMonthDates(text, pattern, dayIndex, monthIndex) {
  const dates = [];
  for (const match of text.matchAll(pattern)) {
    const rest = text.slice(match.index + match[0].length);
    const year = yearOf(match[3], match[4], match[5], rest);
    const month = MONTHS[match[monthIndex].toLowerCase()];
    if (year === null || !month) continue;
    // Formatting then normalizing refuses a day the month does not have.
    const date = normalizeGameDate(formatGameDate({ year, month, day: Number(match[dayIndex]) }));
    if (date) dates.push({ index: match.index, date });
  }
  return dates;
}

function datesWithIndex(text) {
  const iso = [...text.matchAll(ISO)].map((match) => ({ index: match.index, date: normalizeGameDate(`${match[1]}${match[2] || ""}`) }));
  return [...iso, ...namedMonthDates(text, DAY_FIRST, 1, 2), ...namedMonthDates(text, MONTH_FIRST, 2, 1)]
    .filter((entry) => entry.date)
    .sort((a, b) => a.index - b.index);
}

/** Every distinct date the text names, as canonical game dates in sorted order. */
export function explicitRequestDates(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return [];
  return [...new Set(datesWithIndex(text).map((entry) => entry.date))].sort();
}

/** The signed calendar year a short date description names, or null. */
export function explicitYear(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  const whole = parseGameDate(text);
  if (whole) return whole.year;
  // The first four-digit number wins, as before; a BC after it makes it negative.
  const fourDigit = FOUR_DIGIT.exec(text);
  if (fourDigit) return isBc(fourDigit[2]) ? -Number(fourDigit[1]) : Number(fourDigit[1]);
  const era = ERA_YEAR.exec(text);
  if (era) return era[1] ? Number(era[1]) : (isBc(era[3]) ? -Number(era[2]) : Number(era[2]));
  const first = datesWithIndex(text)[0];
  if (first) return parseGameDate(first.date).year;
  const numbers = text.match(/\d+/g) || [];
  return numbers.length === 1 && Number(numbers[0]) > 0 ? Number(numbers[0]) : null;
}
