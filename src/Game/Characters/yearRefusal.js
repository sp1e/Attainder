// What a refused model year tells the player. The engine's own Swedish sentence passes as it is (playerText.js). A
// failure from the model's side is English and internal: it goes to the log, and the player reads one sentence on
// what kind of failure it was. Only a failure that carries the model year's own abort sentence (gameplay.js,
// ABORTED below) is named: that catch is the one place that knows the year was not written, so each sentence says
// that nothing changed. Any other English failure (a chunk that would not load, a read after the year was saved)
// gives the fallback, which claims nothing about the campaign.
import { playerText } from "./playerText.js";

export const YEAR_FAILED = "Modellen kunde inte skriva året. Försök igen.";
const ABORTED = "Modellåret avbröts utan att flytta tiden eller ändra karaktärerna.";

// Read in order; the first that matches names the failure. The validator's own phrasings come first, so a name the
// model wrote and a validation message quotes cannot pass for a transport failure. A rejected answer whose retry
// then failed in transport is read from the retry's part first (yearRefusal).
const REASONS = [
  [/\.date must|\$\.stopDate must/, "Modellen daterade en händelse utanför året. Inget har ändrats."],
  [/meningsfulla modellhändelser/, "Modellen skrev fler händelser än ett år rymmer. Inget har ändrats."],
  [/must link to a returned event|\[world consequence\]/, "Modellen lämnade en berättelsetråd utan följd. Inget har ändrats."],
  [/timed out: the model stopped answering/, "Modellen slutade svara innan året var skrivet. Inget har ändrats."],
  [/context window|the model refused one of/, "Året ryms inte i den valda modellens minne. Inget har ändrats."],
  [/Fallback list|API key/, "Ingen modell kan svara just nu. Inget har ändrats."],
  [/failed to fetch|fetch failed|load failed|networkerror|network request failed|ECONN|internal server error|status 5\d\d/i, "Spelet fick ingen kontakt med modellen. Inget har ändrats."],
  [/valid structured output/, "Modellens svar gick inte att läsa. Inget har ändrats."],
];
const RETRY_FAILED = " The retry then failed: ";

const reasonOf = (text) => REASONS.find(([pattern]) => pattern.test(text))?.[1] ?? null;

/** The sentence a refused model year shows; the raw reason is logged by playerText when it is kept back. */
export function yearRefusal(message) {
  const engine = playerText(message, null);
  if (engine) return engine;
  const text = typeof message === "string" ? message.trim() : "";
  if (!text.startsWith(ABORTED)) return YEAR_FAILED;
  const retry = text.indexOf(RETRY_FAILED);
  return (retry >= 0 && reasonOf(text.slice(retry + RETRY_FAILED.length))) || reasonOf(text) || YEAR_FAILED;
}
