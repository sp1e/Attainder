// Does a string read as Swedish? The translator (translator.js) asks about a
// string its book has nothing for, for two reasons:
//
//   - in English mode a Swedish string the native book lacks is a gap in the
//     pack, and is listed in window.__ohI18n.missing;
//   - in every other language a Swedish string is the game's own court text,
//     not English content, so it is never sent to the player's AI model to be
//     "translated from English".
//
// A wrong yes costs more than a wrong no: it keeps an English string from the
// model in a language without a pack. So the rule is two cheap signals that
// English interface text does not give, and swedishText.test.js runs it over
// every entry of public/lang/catalog-en.json.
//
// Pure: no DOM, no storage.

// Words that count on their own. Function words first, then the court nouns
// the character system writes most, with their definite forms.
//
// The catalog extractor (scripts/i18n/extractNativeStrings.mjs) reads Swedish
// by this same list and by hasSwedishLetter, so the two detectors cannot know
// different words. Its own list had "inga", "hos", "igen" and "kunde", which
// are here now.
export const SWEDISH_WORDS = Object.freeze([
  "och", "att", "för", "med", "inte", "som", "det", "har", "kan", "ska", "eller",
  "från", "år", "är", "ett", "på", "av", "om", "vid", "blir", "får", "sitt", "sina",
  "mot", "utan", "efter", "ingen", "inget", "inga", "enligt", "redan", "detta", "denna",
  "dessa", "deras", "saknar", "saknas", "hos", "igen", "kunde",
  "hov", "hovet", "rike", "riket", "kung", "kungen", "drottning", "drottningen",
]);

// Swedish function words that are English words too, or sit inside names an
// English string carries ("Aix-en-Provence", "van den Berg"). They are common
// in Swedish, and still left out: "under" alone matched 25 entries of the
// English catalog, and "finns" is how English writes the Finnish people, as
// the first word of a research pair. A Swedish sentence built on one of them
// is caught by its other words or by its letters, or it is missed.
export const SHARED_WITH_ENGLISH = Object.freeze(["en", "den", "sin", "till", "under", "i", "de", "man", "men", "finns"]);

const SWEDISH_LETTER = /[åäöÅÄÖ]/;

// The letter test alone, for the extractor.
export const hasSwedishLetter = (text) => typeof text === "string" && SWEDISH_LETTER.test(text);

// A whole word: no letter of any script on either side. \b will not do, since
// it reads å, ä and ö as non-letters: it finds "det" inside "ödet" and never
// finds "på" before a space.
const wholeWord = (alternatives) => `(?<!\\p{L})(?:${alternatives.join("|")})(?!\\p{L})`;
const capitalized = (word) => word[0].toUpperCase() + word.slice(1);

// Lower case anywhere in the text.
const WORD_ANYWHERE = new RegExp(wholeWord(SWEDISH_WORDS), "u");
// With a capital, only as the text's first word: there it opens a sentence
// ("Det slog tillbaka", "Hovet saknar silver."). Further in, a capital is a
// name far more often ("Ibn Sina", "Prince Kung", "move to the Med").
const WORD_FIRST = new RegExp(`^${wholeWord(SWEDISH_WORDS.map(capitalized))}`, "u");

export const looksSwedish = (text) => {
  if (typeof text !== "string") return false;
  // å written as a + combining ring is the same letter.
  const value = text.normalize("NFC").trim();
  if (!value) return false;
  return SWEDISH_LETTER.test(value) || WORD_ANYWHERE.test(value) || WORD_FIRST.test(value);
};
