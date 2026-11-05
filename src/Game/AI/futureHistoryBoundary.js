/*! Open Historia — real history as the default for a time skip
 *
 * The jump templates say it in general (defaultPrompts.json, [Real History Is
 * the Default]): a game set in our history follows real history wherever the
 * game has not changed things. This block adds what only the save knows — when
 * this game began and where this jump starts.
 *
 * Historical character campaigns use their reviewed starting setting and
 * engine-owned outcomes. Other campaigns retain the inherited history rule.
 */
import { normalizeGameDate } from '../../runtime/gameDates.js';
import { HISTORICAL_CHARACTER_GUIDANCE } from '../../runtime/characterWorld.js';

const historical = context => context && ['contentId', 'contentVersion', 'eraLabelSv'].every(key => typeof context[key] === 'string' && context[key].trim())
  && ['bookmarkDate', 'currentDate'].every(key => typeof context[key] === 'string' && context[key] && normalizeGameDate(context[key]) === context[key]);

// Known shipped wording outside the history section, also present in frozen
// catalogs. Exact replacements preserve the surrounding authority and pacing
// rules; arbitrary author prose is outside this compatibility boundary.
const HISTORICAL_SENTENCES = [
  ['Real history and the world before round 1: the default for everything this game has not changed.',
    'The sourced setting before round 1 supplies starting context. Later outcomes follow the engine and current campaign records.'],
  ["Real historical events that nobody in this game has prevented still happen; when one of them calls for the player's reaction, make it the final event.",
    "When a campaign event calls for the player's reaction, make it the final event."],
  ['A real historical event keeps its real details.', 'Preserve the details of events already established in campaign records.'],
];

// This named section is engine-owned in historical character campaigns, even
// in frozen/custom catalogs. Keep adjacent author sections and legacy bytes.
export const historicalJumpTemplate = (template, context) => {
  if (!historical(context)) return template;
  let result = String(template ?? '').replace(/^\[Real History Is the Default\][ \t]*\r?\n[\s\S]*?(?=^\[[^\]\r\n]+\][ \t]*(?:\r?\n|$)|(?![\s\S]))/gm,
    `[Historical starting setting and alternate outcomes]\n${HISTORICAL_CHARACTER_GUIDANCE}\n\n`);
  for (const [shipped, replacement] of HISTORICAL_SENTENCES) result = result.replaceAll(shipped, replacement);
  return result;
};

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const resolveStartDate = (game = {}, fallbackDate = "") => clean(
  game?.startDate || game?.startingDate || game?.startingRoundDate || fallbackDate,
);

export const buildRealHistoryDirective = ({ historicalContext, game = {}, originDate = "", fallbackDate = "" } = {}) => {
  if (historical(historicalContext)) return `[Historical starting setting and alternate outcomes]\n${HISTORICAL_CHARACTER_GUIDANCE}`;
  const start = resolveStartDate(game, fallbackDate);
  const origin = clean(originDate || game?.gameDate || start);
  const began = start
    ? `This game began on ${start}${origin && origin !== start ? `, and this jump starts on ${origin}` : ""}.`
    : "";
  return [
    "[This Game and Real History]",
    `${began} Real history up to that date is this world's past, and from then on it stays the default for everything the game has not changed: the real events of this period happen, with their real people, places, dates and numbers, unless something in this game has changed their causes. What the game has changed so far is in the event history, the records and the map. A scenario whose briefing sets it in another history or a world of its own follows that instead.`.trim(),
  ].join("\n");
};
