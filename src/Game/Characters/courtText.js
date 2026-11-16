// Numbers and years as the court over the map writes them, in the player's language. `updates` is the translator's
// count: the React Compiler keeps a call's result until an argument changes, and the locale follows the language.
import { characterNumberLocale } from "../../runtime/characterLanguage.js";

const MINUS = "−";

/** A number with at most one decimal and a real minus sign; `signed` asks for a plus sign too. A dash for no number. */
export const numberText = (value, updates, { signed = false } = {}) => {
  void updates;
  const number = Number(value);
  if (value === null || value === undefined || !Number.isFinite(number)) return "—";
  const text = new Intl.NumberFormat(characterNumberLocale(), { maximumFractionDigits: 1 }).format(Math.abs(number));
  if (number < 0) return `${MINUS}${text}`;
  return signed && number > 0 ? `+${text}` : text;
};

/** The class of a figure that leans for or against the player. */
export const lean = (value) => (Number(value) > 0 ? "court-card-up" : Number(value) < 0 ? "court-card-down" : undefined);

/** A calendar year, with its era before the era began. The calendar has no year 0: 1 BC is the astronomical year 0. */
export const yearText = (year, updates) => {
  void updates;
  if (!Number.isInteger(year)) return "";
  const date = new Date(Date.UTC(2001, 0, 1));
  date.setUTCFullYear(year < 0 ? year + 1 : year);
  return new Intl.DateTimeFormat(characterNumberLocale(), { year: "numeric", era: year < 0 ? "short" : undefined, timeZone: "UTC" }).format(date);
};
