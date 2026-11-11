// What a refusal or an error may show the player, by where its text came from. Both functions log what they hold
// back and return the caller's fallback sentence. ActionBox.jsx exports them again for the character views.

// Engine refusals are Swedish sentences ending with a period. A transport or parser error is English and is not
// for the player: it goes to the log and the player reads the fallback sentence. A word counts only between two
// non-letters; `\b` treats å, ä and ö as boundaries and would find "of" in "oförmögen".
const ENGLISH_WORDS = /(?<!\p{L})(the|was|failed|fetch|of|with|error|must|cannot|unexpected|invalid|there|that|object|undefined|null|network|request|response|json|http)(?!\p{L})/iu;
export function playerText(message, fallback) {
  const text = typeof message === "string" ? message.trim() : "";
  if (text && /[.!?]$/.test(text) && !ENGLISH_WORDS.test(text)) return text;
  if (text) console.warn("[character action] an internal error was kept from the player:", text);
  return fallback;
}

const MODEL_TEXT_MAX = 300;
/**
 * A sentence the model wrote in a validated structured field, such as the explanation of an interpreted action. The
 * model writes in the Options language, so English passes here where playerText would stop it. The text must be one
 * line that ends a sentence and fits `maxLength`; anything else is a broken answer and gives the fallback.
 */
export function modelText(message, fallback, maxLength = MODEL_TEXT_MAX) {
  const text = typeof message === "string" ? message.trim() : "";
  if (text && /[.!?]$/.test(text) && !/[\r\n]/.test(text) && text.length <= maxLength) return text;
  if (text) console.warn("[character action] a model text was kept from the player:", text);
  return fallback;
}
