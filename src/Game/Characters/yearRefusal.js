// What a refused model year tells the player. The engine's own Swedish sentence passes as it is (playerText.js). A
// failure from the model's side is English and internal: it goes to the log, and the player reads one sentence on
// what kind of failure it was. The year is never half written (gameplay.js: "Modellåret avbröts utan att flytta
// tiden eller ändra karaktärerna"), so each sentence says that nothing changed.
import { playerText } from "./playerText.js";

export const YEAR_FAILED = "Modellen kunde inte skriva året. Försök igen.";

// Read in order; the first that matches names the failure. The model's own refusals come after the transport's: a
// rejected answer whose retry then timed out was lost to the timeout.
const REASONS = [
  [/timed out|stopped answering/i, "Modellen slutade svara innan året var skrivet. Inget har ändrats."],
  [/context window|refused one of/i, "Året ryms inte i den valda modellens minne. Inget har ändrats."],
  [/Fallback list|API key/, "Ingen modell kan svara just nu. Inget har ändrats."],
  [/fetch|network|ECONN|server error|status 5\d\d/i, "Spelet fick ingen kontakt med modellen. Inget har ändrats."],
  [/\.date must|\$\.stopDate/, "Modellen daterade en händelse utanför året. Inget har ändrats."],
  [/meningsfulla modellhändelser/, "Modellen skrev fler händelser än ett år rymmer. Inget har ändrats."],
  [/storyline|\[world consequence\]/i, "Modellen lämnade en berättelsetråd utan följd. Inget har ändrats."],
  [/structured output|JSON|schema/i, "Modellens svar gick inte att läsa. Inget har ändrats."],
];
const RETRY_FAILED = " The retry then failed: ";

const reasonOf = (text) => REASONS.find(([pattern]) => pattern.test(text))?.[1] ?? null;

/** The sentence a refused model year shows; the raw reason is logged by playerText when it is kept back. */
export function yearRefusal(message) {
  const engine = playerText(message, null);
  if (engine) return engine;
  const text = typeof message === "string" ? message : "";
  const retry = text.indexOf(RETRY_FAILED);
  return (retry >= 0 && reasonOf(text.slice(retry + RETRY_FAILED.length))) || reasonOf(text) || YEAR_FAILED;
}
