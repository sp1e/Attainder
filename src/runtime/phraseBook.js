/*! Open Historia — the phrase book: translations looked up exactly or by pattern © 2026 Nicholas Krol, AGPL-3.0-or-later (see LICENSE). */
// Translations are keyed by the English as the game renders it. The shipped
// packs (public/lang/<code>.json, built by scripts/i18n/) hold every fixed
// string of the interface, and most are exact: "Save game". A string the game
// builds around a value is a PATTERN, the value written as a double-brace slot:
// "Found {{count}} regions", "{{name}} declared war on {{target}}". Its
// translation may put the slots wherever its grammar needs them ("{{count}}
// Regionen gefunden"). A slot's value is itself looked up, so "Edit {{label}}"
// over "Edit Borders" reads "Grenzen bearbeiten" once "Borders" is known.
//
// Pure (no DOM, no storage): the translator (translator.js) asks it about text
// nodes and attributes, and the tests ask it directly.
//
// The character system is written in Swedish, so in English mode the translator
// holds a second book keyed by the Swedish (nativePack.js). That book is made
// with `native: true`, which adds three lookups Swedish text needs and the
// English-keyed books must not get; createPhraseBook describes them.

const SLOT = /\{\{\s*([A-Za-z_$][\w$]*)\s*\}\}/g;

// A pattern with less literal text than this is WEAK: "by {{author}}",
// "Our {{label}}". Anchored at both ends it can still match prose that happens
// to start with its words (a model's reply in another chat language: "Our
// forces are ready…"), so a weak pattern only takes a few words of value.
export const STRONG_LETTERS = 8;
const WEAK_MAX_VALUE_WORDS = 4;
// A value never spans sentences unless the pattern around it is substantial:
// a template does not wrap a paragraph in a few words.
const SENTENCE_LETTERS = 16;
const MEMO_LIMIT = 5000;
const LIST_SEPARATOR = / [/·•|] /;
const LIST_SPLIT = /( [/·•|] )/;
// A native book looks for a pattern inside a pattern's value this many levels
// down: "Spelbara riken: {{list}}" over a value that is itself a built sentence.
const NATIVE_VALUE_DEPTH = 2;
const LABEL_SEPARATOR = ": ";
const LABEL_VALUE_MAX = 200;
// The words the Swedish views join conditions with, and their English.
const NATIVE_JOINERS = [[" eller ", " or "], [" och ", " and "]];
// A count against its threshold as the Swedish views write it, and its English.
const NATIVE_TALLY = /^(.*\S) (\d+(?:[.,]\d+)?) av (\d+(?:[.,]\d+)?)$/u;
const NATIVE_TALLY_WORD = " of ";
// A label and a signed number, as the engine writes a change: "statskassan −10".
const NATIVE_CHANGE = /^(.*\S) ([+−-]\d+(?:[.,]\d+)?)$/u;
// A name of one to five words that starts with a capital, or with a short prefix
// hyphened to one, and holds no punctuation: "Gisela", "Leo III", "al-Hakam I",
// "Ziyadat Allah ibn Ibrahim".
const SHORT_NAME = /^(?:\p{Ll}{1,3}-)?\p{Lu}[\p{L}\p{M}’'-]*(?: [\p{L}\p{M}\d’'-]+){0,4}$/u;
// A record id the engine writes into a generated name: "person-56".
const RECORD_ID = /^[a-z]+-\d+$/;
// A text that ends in a parenthesis, which may hold one more: "Ciran (Kock)",
// "Barn person-5 (Hovhus 4 (genererat))".
const TRAILING_PARENTHESIS = /^(.*\S) \(((?:[^()]|\([^()]*\))+)\)$/u;
// Where one sentence ends and the next begins.
const SENTENCE_BREAK = /[.!?]\s+(?=\S)/gu;
const SENTENCES_MAX = 600;
const SENTENCE_BREAKS_MAX = 8;
// A name of two words or more. Each word starts with a capital, or is a particle that
// names carry in lower case ("ibn", "av", "de"), or a prefix hyphened to a capital
// ("al-Amin", "al-Hakam I").
const NAME_PARTICLE = "ibn|bin|bint|abu|av|af|de|du|la|le|von|van|den|der|el|of";
const NAME_WORD = "(?:\\p{Ll}{1,3}-)?\\p{Lu}[\\p{L}\\p{M}’'-]*";
const FULL_NAME = new RegExp(`^${NAME_WORD}(?: (?:${NAME_WORD}|(?:${NAME_PARTICLE})))+$`, "u");
// A name of one word: "Gisela", "Huáscar".
const SWEDISH_LETTER = /[åäöÅÄÖ]/u;
// A value cut inside a parenthesis ("Dotter (Bysantinska riket" before ", född
// 808), 16 år") is no value: the pattern split the text at a comma within the
// parenthesis. A native book matches such a text again with those commas masked.
const PAREN_COMMA = "\u0001\u0002";
const PAREN_GROUP = /\([^()]*\)/gu;
const countOf = (text, mark) => text.split(mark).length - 1;
const unbalanced = (value) => countOf(value, "(") !== countOf(value, ")");
const maskParenthesisCommas = (text) => text.replace(PAREN_GROUP, (group) => group.replaceAll(", ", PAREN_COMMA));
const ONE_NAME = new RegExp(`^${NAME_WORD}$`, "u");
// The marks the engine puts after a generated name, and their English.
const GENERATED_MARKS = [[" (genererad)", " (generated)"], [" (genererat)", " (generated)"]];
const COMMA_SPLIT = /(, )/;
const COMMA_LIST_MAX_ITEMS = 15;
const STARTS_LOWER = /^\p{Ll}/u;
const TWO_CAPITALS = /^\p{Lu}\p{Lu}/u;
const firstWord = (text) => text.match(/^[\p{L}\p{M}]+/u)?.[0] ?? "";

// A label's translation as a sentence carries it when the Swedish was written
// in lower case: with its first letter lowered. Two kinds of translation keep
// their capital: an acronym ("HIV": its second letter is a capital too), and
// one that opens with the word the Swedish label opens with, which is a name
// both languages write alike ("Silla", "Tang"). A name the languages write
// differently cannot be told from a common word here; an entry for the
// lowercase text settles such a case, since entries are looked up first.
const lowerFirst = (translated, label) => {
  if (TWO_CAPITALS.test(translated)) return translated;
  const word = firstWord(translated);
  if (word && word === firstWord(label)) return translated;
  return translated[0].toLowerCase() + translated.slice(1);
};

const collapse = (text) => text.replace(/\s+/g, " ").trim();
const letterCount = (text) => (text.match(/\p{L}/gu) ?? []).length;
const wordCount = (text) => (text.match(/[\p{L}\p{N}]+/gu) ?? []).length;
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Literal text between slots: any run of whitespace matches any other, so a
// line break or a double space in the rendered text is no miss.
const literalSource = (text) => text.split(/\s+/).map(escapeRegex).join("\\s+");

export const isPatternKey = (text) => typeof text === "string" && text.includes("{{") && new RegExp(SLOT.source).test(text);

// The names of a text's slots, in order, each as often as it is written. The
// pack check (scripts/i18n/check-native-pack.mjs) compares a pattern's slots
// with its translation's, and has to read them the way the book does.
export const slotNames = (text) => (typeof text === "string" ? Array.from(text.matchAll(SLOT), (match) => match[1]) : []);

// One pattern, compiled; null for a key without a slot or without any words
// outside its slots (it would match anything).
export const compilePattern = (english, translated) => {
  if (typeof english !== "string" || typeof translated !== "string") return null;
  const key = english.trim();
  const slots = [];
  const literals = [];
  let source = "^";
  let last = 0;
  for (const match of key.matchAll(SLOT)) {
    const literal = key.slice(last, match.index);
    literals.push(literal);
    source += `${literalSource(literal)}([\\s\\S]*?)`;
    slots.push(match[1]);
    last = match.index + match[0].length;
  }
  if (!slots.length) return null;
  // Two slots with nothing between them cannot be told apart: the pattern
  // "{{charAt}}{{slice}} of {{overlord}}" would split any "Kingdom of Spain".
  if (literals.slice(1).some((literal) => !literal)) return null;
  const tail = key.slice(last);
  literals.push(tail);
  source += `${literalSource(tail)}$`;
  const literalText = literals.join(" ");
  const strength = letterCount(literalText);
  if (!strength) return null;
  // The longest literal word: a cheap test before the regex runs.
  const anchor = (literalText.match(/\p{L}+/gu) ?? []).reduce((best, word) => (word.length > best.length ? word : best), "");
  return {
    anchor,
    english: key,
    literalLength: collapse(literalText).length,
    regex: new RegExp(source, "u"),
    slots,
    strength,
    translated,
  };
};

// The translation with each slot filled. A slot named twice takes its values in
// order; a slot the translation names but the English lacks is dropped rather
// than shown in braces.
const fill = (template, slots, values) => {
  const queues = new Map();
  slots.forEach((name, index) => {
    if (!queues.has(name)) queues.set(name, []);
    queues.get(name).push(values[index]);
  });
  const used = new Map();
  return template.replace(SLOT, (_whole, name) => {
    const queue = queues.get(name);
    if (!queue) return "";
    const index = used.get(name) ?? 0;
    used.set(name, index + 1);
    return queue[Math.min(index, queue.length - 1)];
  });
};

const spansSentences = (value) => /[.!?。！？]\s+\S/u.test(value);

const acceptsValues = (pattern, values) => {
  if (pattern.strength < STRONG_LETTERS) {
    const words = values.reduce((total, value) => total + wordCount(value), 0);
    if (words > WEAK_MAX_VALUE_WORDS) return false;
  }
  if (pattern.strength < SENTENCE_LETTERS && values.some(spansSentences)) return false;
  return true;
};

// `localizeValue` (optional): a rule for text no entry has but that can still be
// put into the player's language, a date for one (localDates.js). It is asked
// about a whole string the book does not know, and about each value in a
// pattern ("Round {{round}} · {{date}}").
//
// `native` (optional): the book is keyed by the game's own Swedish. That text is
// sentences the engine builds from other sentences and from data, so four more
// lookups apply, and only in such a book:
//  - a slot's value is looked up with everything the book has, patterns
//    included, NATIVE_VALUE_DEPTH levels down;
//  - a value or a whole string that is a comma list of entries ("Rom, Aten")
//    is translated item by item;
//  - a string that ends in one period and is otherwise unknown is looked up
//    without it, and the period is put back: the package builders close a
//    dossier's sentence with a period, and "{{x}}." cannot be a pattern;
//  - a value or a whole string that starts in lower case and is otherwise
//    unknown is looked up with a capital, and the answer gets its lower case
//    back (byLoweredLabel).
export const createPhraseBook = ({ localizeValue = null, native = false } = {}) => {
  // English (as extracted, and whitespace-collapsed) → translation.
  const exact = new Map();
  // Pattern keys → translation; compiled lazily, most specific first.
  const patternEntries = new Map();
  let patterns = null;
  // Answers already worked out, kept apart for the two tiers of translate().
  const memo = new Map();
  const strongMemo = new Map();
  // A native book's answers for the pieces of the string being read (pieceOf).
  const pieces = new Map();

  const compiled = () => {
    if (!patterns) {
      patterns = [];
      for (const [english, translated] of patternEntries) {
        const pattern = compilePattern(english, translated);
        if (pattern) patterns.push(pattern);
      }
      patterns.sort((a, b) => b.strength - a.strength || b.literalLength - a.literalLength);
    }
    return patterns;
  };

  const changed = () => {
    memo.clear();
    strongMemo.clear();
  };

  const set = (english, translated) => {
    if (typeof english !== "string" || typeof translated !== "string") return;
    const key = english.trim();
    const value = translated.trim();
    if (!key || !value) return;
    if (isPatternKey(key)) {
      patternEntries.set(key, value);
      patterns = null;
    } else {
      exact.set(key, value);
      const collapsed = collapse(key);
      if (collapsed !== key) exact.set(collapsed, value);
    }
    changed();
  };

  const setAll = (entries) => {
    const list = entries instanceof Map ? entries.entries() : Object.entries(entries ?? {});
    for (const [english, translated] of list) set(english, translated);
  };

  const get = (text) => {
    if (typeof text !== "string") return undefined;
    const key = text.trim();
    return exact.get(key) ?? exact.get(collapse(key));
  };

  const byRule = (text) => {
    if (!localizeValue) return null;
    try {
      return localizeValue(text) ?? null;
    } catch {
      return null;
    }
  };

  // A value the book knows is translated too ("Edit Borders"), and a date,
  // and a list: a last slot runs to the end, so "Playing as {{country}}"
  // over "Playing as France · Jan 1, 2016" holds the whole "France · …".
  // A native book's value can be a built sentence, so it gets the whole book.
  // `whole` (native, full tier): only a reading in which the book read every
  // part answers; see derive.
  const valueOf = (inner, strong, depth, whole = false) => {
    const known = get(inner) ?? byRule(inner);
    if (known != null) return known;
    if (!native) return byParts(inner, strong, depth);
    return whole ? deriveOnce(inner, strong, depth, true) : derive(inner, strong, depth);
  };

  // An entry of the book, or a lowercased one ("skada" for "Skada").
  const isEntry = (text) => get(text) !== undefined
    || (STARTS_LOWER.test(text) && get(text[0].toUpperCase() + text.slice(1)) !== undefined);
  // A text with the shape of a name: capitalised words, or one capitalised
  // word without å, ä or ö ("Därför" is as likely Swedish the book lacks).
  const isNameShaped = (text) => {
    const inner = text.trim();
    return (ONE_NAME.test(inner) && !SWEDISH_LETTER.test(inner)) || FULL_NAME.test(inner);
  };
  // A part that needs no reading: no words, a record id or a short name.
  const needsNoReading = (inner) => !/\p{L}/u.test(inner) || RECORD_ID.test(inner) || SHORT_NAME.test(inner);
  // `read` is what the book made of the part.
  const isRead = (inner, read) => read != null || needsNoReading(inner);

  // Can a native book read every value of a match, each as a whole? Two kinds
  // of value are not one value, unless the pattern writes the mark itself. A
  // value that holds a list separator is a row of parts ("Kansler · Gemål 1"
  // before " (genererad)"). A first value that holds a label's colon is a
  // label with its value ("Komplott: Gemål 1" before " (genererad)"), and
  // the label is read first.
  const readsEveryValue = (pattern, values, depth) => {
    const ownsSeparator = LIST_SEPARATOR.test(pattern.english);
    const opensWithSlot = pattern.english.startsWith("{{") && !pattern.english.includes(LABEL_SEPARATOR);
    return values.every((value, index) => {
      const inner = value.trim();
      if (!inner) return true;
      if (!ownsSeparator && LIST_SEPARATOR.test(inner)) return false;
      if (index === 0 && opensWithSlot && inner.includes(LABEL_SEPARATOR)) return false;
      return needsNoReading(inner) || valueOf(inner, false, depth + 1, true) != null;
    });
  };

  // The values of a native match, matched again with the commas inside
  // parentheses masked when a value was cut inside one. Null when no
  // match keeps every parenthesis whole. A text whose own parentheses do
  // not pair ("Pesten tar 1) Rom") keeps its values.
  const balancedValues = (pattern, text, match) => {
    const values = match.slice(1);
    if (!values.some(unbalanced)) return values;
    const masked = maskParenthesisCommas(text);
    if (masked === text && unbalanced(text)) return values;
    const again = masked === text ? null : pattern.regex.exec(masked);
    if (!again) return null;
    const unmasked = again.slice(1).map((value) => value.replaceAll(PAREN_COMMA, ", "));
    return unmasked.some(unbalanced) ? null : unmasked;
  };

  // `strong`: only patterns with STRONG_LETTERS of their own are tried (see
  // translate). `depth`: how many patterns already surround this text.
  // `whole`: a pattern answers only when the book reads each of its values.
  // `opensWithWords`: only a pattern that starts with words of its own is
  // tried (byLoweredLabel).
  const matchPattern = (text, strong = false, depth = 0, whole = false, opensWithWords = false) => {
    if (!patternEntries.size || (native && depth > NATIVE_VALUE_DEPTH)) return null;
    for (const pattern of compiled()) {
      // Sorted by strength: after the first weak pattern, all are weak.
      if (strong && pattern.strength < STRONG_LETTERS) break;
      if (opensWithWords && pattern.english.startsWith("{{")) continue;
      if (pattern.anchor && !text.includes(pattern.anchor)) continue;
      if (text.length > pattern.english.length + 300) continue;
      const match = pattern.regex.exec(text);
      if (!match) continue;
      const values = native ? balancedValues(pattern, text, match) : match.slice(1);
      if (!values) continue;
      if (whole && !readsEveryValue(pattern, values, depth)) continue;
      // A native book counts a value its rule reads (a date label, five
      // "words" of digits and letters) as the one word it is.
      const counted = native ? values.map((value) => (byRule(value.trim()) == null ? value : "x")) : values;
      // In the full tier a native book also takes a weak pattern around any
      // number of words when every value is known, a number or a short name
      // the two languages share ("Gisela, 20 år (Karls rike)"): such text is
      // the book's own.
      const allKnown = whole || (native && !strong && values.every((value) => {
        const inner = value.trim();
        return !inner || !/\p{L}/u.test(inner) || SHORT_NAME.test(inner) || valueOf(inner, false, depth + 1) != null;
      }));
      if (!allKnown && !acceptsValues(pattern, counted)) continue;
      // A whole reading keeps one limit: a value that spans sentences needs a
      // substantial pattern around it. A short one ("{{name}} har {{n}}
      // grundstöd.") is the last of several sentences, each read by itself.
      if (whole && pattern.strength < SENTENCE_LETTERS && values.some(spansSentences)) continue;
      // A weak pattern's value is a number or a name; words and numbers
      // together ("Found 12" before "{{value}} regions") are the start of some
      // other sentence, unless the book knows them (a date).
      if (pattern.strength < STRONG_LETTERS && values.some((value) => {
        const inner = value.trim();
        if (!/\p{L}/u.test(inner) || !/\d/.test(inner) || get(inner) !== undefined || byRule(inner) != null) return false;
        // A native book reads a record id ("person-56" after "Barn") as the
        // number it is.
        if (native && RECORD_ID.test(inner)) return false;
        // In a whole reading the book must have read the value itself.
        if (whole) return valueOf(inner, false, depth + 1, true) == null;
        // A native book also knows a value it can read by a pattern of its
        // own ("Hovhus 1 (genererat)"). A list does not count: "Bysantinska
        // riket · 800" before "{{year}} e.Kr." is a row to read part by part.
        return !(native && matchPattern(inner, strong, depth + 1) != null);
      })) continue;
      // A whole reading takes each value's own best reading: its whole one
      // when it has one, and for a short name whatever the book makes of it.
      const translatedValues = values.map((value) => {
        const inner = value.trim();
        if (!inner) return value;
        const known = valueOf(inner, strong, depth + 1);
        return known == null ? value : value.replace(inner, () => known);
      });
      return fill(pattern.translated, pattern.slots, translatedValues).trim();
    }
    return null;
  };

  // A list the game joins with " / " or " · " ("Modern Day Session / Japan /
  // 2016-01-01"): no pattern holds it, having no words of its own, so each
  // part is looked up by itself. Only when some part is known; dashes are not
  // separators, since prose uses them. In the strong tier a part must be an
  // entry.
  // A part of a list the book has no entry for. A native book reads it with
  // everything it has in the full tier, and as a comma list of entries ("Karls
  // rike, 800 e.Kr.") in the strong one.
  const partOf = (inner, strong, depth, whole) => {
    if (native && !strong) return byRule(inner) ?? (whole ? deriveOnce(inner, false, depth + 1, true) : derive(inner, false, depth + 1));
    if (native) return byCommaList(inner);
    return strong ? null : byRule(inner) ?? matchPattern(inner, false, depth);
  };

  // `whole`: every part must be read, where a part without words and a short
  // name need no reading.
  const byParts = (text, strong = false, depth = 0, whole = false) => {
    if (text.length > 240 || !LIST_SEPARATOR.test(text) || depth > NATIVE_VALUE_DEPTH) return null;
    const parts = text.split(LIST_SPLIT);
    if (parts.length > 15) return null;
    let changed = false;
    let unread = false;
    const out = parts.map((part, index) => {
      const inner = part.trim();
      if (index % 2 === 1 || !inner) return part;
      const known = get(inner) ?? partOf(inner, strong, depth, whole) ?? (whole && needsNoReading(inner) ? partOf(inner, strong, depth, false) : null);
      if (known == null) {
        if (whole && !needsNoReading(inner)) unread = true;
        return part;
      }
      changed = true;
      return part.replace(inner, () => known);
    });
    return changed && !unread ? out.join("") : null;
  };

  // Native only. "Rom, Aten, Paris": a comma list whose every item is an
  // entry. One unknown item and the string is prose with commas, which stays.
  // In the full tier an item may also be one the book reads whole
  // ("Gerosmus (Kock), Winegardis (Vaktchef)", "statskassan −10,
  // legitimiteten +2"), or a name, as long as the book reads at least one
  // item ("Araua Ocllo, Kuntur Rimaq (genererad)"). A name here has the
  // shape of one: capitals on every word but a particle, so "Kungen kom"
  // stays unread.
  const byCommaList = (text, strong = true, depth = 0) => {
    const parts = text.split(COMMA_SPLIT);
    const items = (parts.length + 1) / 2;
    if (items < 2 || items > COMMA_LIST_MAX_ITEMS) return null;
    const out = [];
    let read = 0;
    for (let index = 0; index < parts.length; index += 1) {
      const known = index % 2 === 1 ? parts[index] : get(parts[index]) ?? (strong ? null : pieceOf(parts[index], depth, true));
      if (known == null && (strong || !isNameShaped(parts[index]))) return null;
      if (known != null && index % 2 === 0) read += 1;
      out.push(known ?? parts[index]);
    }
    return read ? out.join("") : null;
  };

  // Native only. "Hovet flyttar till Aachen." when the book has the sentence
  // without its period. Two periods end an ellipsis, not a sentence. In the
  // strong tier the sentence must be an entry.
  const withoutPeriod = (text, strong, depth, whole) => {
    if (!text.endsWith(".") || text.endsWith("..")) return null;
    const bare = text.slice(0, -1).trimEnd();
    if (!bare) return null;
    const known = get(bare) ?? (strong ? null : matchPattern(bare, false, depth, whole));
    if (known == null) return null;
    return known.endsWith(".") ? known : `${known}.`;
  };

  // Native only. A text the book has as an entry without its period. It is
  // tried before the patterns: "{{title}} av {{seat}}" would otherwise let
  // "Patriark" through as a name in "Patriark av Konstantinopel.".
  const entryWithoutPeriod = (text) => {
    if (!text.endsWith(".") || text.endsWith("..")) return null;
    const known = get(text.slice(0, -1).trimEnd());
    if (known == null) return null;
    return known.endsWith(".") ? known : `${known}.`;
  };

  // Native only. The engine writes a label into a sentence in lower case
  // ("avslöjats för mord", from the label "Mord"), and the book has the label
  // as the source declares it, with its capital. So a text that starts in
  // lower case is looked up with a capital among the entries. In the full
  // tier a pattern answers too when it has STRONG_LETTERS of its own and
  // opens with its own words: the engine lowers a label built around a value
  // the same way ("guvernör: narim", from "Guvernör: {{city}}"). A pattern
  // that opens with a slot would take the lower case for its value's.
  const byLoweredLabel = (text, strong, depth, whole) => {
    if (!STARTS_LOWER.test(text)) return null;
    const label = text[0].toUpperCase() + text.slice(1);
    const known = get(label) ?? (strong ? null : matchPattern(label, true, depth, whole, true));
    return known == null ? null : lowerFirst(known, label);
  };

  // One piece of a longer text (a sentence, a label, an item of a list), read
  // with everything the book has. Null when the book has nothing for it. A
  // piece is shorter than its text, so the readings by pieces end by
  // themselves, and `depth` counts only the patterns around a text: a name in
  // a list in a sentence is still read. The same piece is asked for from
  // several readings of one string, so its answer is kept while that string
  // is read.
  const pieceOf = (text, depth, whole) => {
    const inner = text.trim();
    if (!inner) return null;
    const key = `${whole ? "w" : "a"}${depth}\u0000${inner}`;
    if (!pieces.has(key)) {
      pieces.set(key, get(inner) ?? byRule(inner) ?? (whole ? deriveOnce(inner, false, depth, true) : derive(inner, false, depth)));
    }
    const known = pieces.get(key);
    return known == null ? null : text.replace(inner, () => known);
  };

  // A piece's whole reading or, for a piece that needs none, whatever the
  // book makes of it.
  const pieceOrName = (text, depth, whole) =>
    pieceOf(text, depth, whole) ?? (whole && needsNoReading(text.trim()) ? pieceOf(text, depth, false) : null);

  // Native only, full tier. The views write a label and its value as one run
  // with nothing but a colon between them ("Tronföljd: +65", "Kelan Namar:
  // sorg"), which no pattern can hold: a pattern needs words of its own. The
  // label must be known; the value is translated when the book has it.
  const byLabelValue = (text, depth, whole) => {
    const at = text.indexOf(LABEL_SEPARATOR);
    if (at < 1 || text.length > LABEL_VALUE_MAX) return null;
    const label = pieceOf(text.slice(0, at), depth, whole);
    const rest = text.slice(at + LABEL_SEPARATOR.length);
    const value = pieceOrName(rest, depth, whole);
    if (value == null && label == null) return null;
    // A value the book lacks passes when it has no words ("+65") or is a
    // short name after a known label ("Mord: Neri Arel"): a translated label
    // before any other Swedish words would hide the gap.
    if (value == null && /\p{L}/u.test(rest) && !(label != null && SHORT_NAME.test(rest.trim()))) return null;
    // An unknown label passes as a name of two words or more ("Kelan Namar:
    // sorg"), or as a name of one word before a value that is an entry of
    // the book ("Gisela: smittkoppor"), unless it holds å, ä or ö. A single
    // unknown word before anything else, or with a Swedish letter
    // ("Arvsrätt"), is as likely a label the book lacks, and half a
    // translation would hide the gap.
    const head = text.slice(0, at).trim();
    const oneName = ONE_NAME.test(head) && !SWEDISH_LETTER.test(head) && isEntry(rest.trim());
    if (label == null && !FULL_NAME.test(head) && !oneName) return null;
    return `${label ?? text.slice(0, at)}${LABEL_SEPARATOR}${value ?? rest}`;
  };

  // Native only, full tier. A count against its threshold ("uppnådda
  // regeringsmål 0 av 2"): the pattern for it has two letters of its own, so
  // it cannot take a label of several words. The label must be known.
  const byTally = (text, depth, whole) => {
    const match = NATIVE_TALLY.exec(text);
    if (!match) return null;
    const label = pieceOf(match[1], depth, whole);
    return label == null ? null : `${label} ${match[2]}${NATIVE_TALLY_WORD}${match[3]}`;
  };

  // Native only, full tier. A label with the change to its value after it
  // ("statskassan −10", "arméns styrka +3"), which has no words of its own
  // for a pattern. The label must be known; the number is read by the rule.
  const byChange = (text, depth, whole) => {
    const match = NATIVE_CHANGE.exec(text);
    if (!match) return null;
    const label = pieceOf(match[1], depth, whole);
    return label == null ? null : `${label} ${byRule(match[2]) ?? match[2]}`;
  };

  // Native only, full tier. Conditions the views join with a word ("mål 0 av
  // 2 eller ryktbarhet 10 av 40"): every part must be known, and the joining
  // word is put into the book's language.
  const byJoiner = (text, depth, whole) => {
    for (const [joiner, translated] of NATIVE_JOINERS) {
      if (!text.includes(joiner)) continue;
      const parts = text.split(joiner);
      if (parts.length > COMMA_LIST_MAX_ITEMS) continue;
      const read = parts.map((part) => pieceOf(part, depth, whole));
      if (read.every((part) => part != null)) return read.join(translated);
    }
    return null;
  };

  // Native only, full tier. Sentences the engine sets one after another ("Avböj
  // bidraget. Personlig åsikt −8. Kostnad: 0 silver."): the longest beginning
  // the book knows, then the rest read the same way. Every sentence must be
  // known.
  const bySentences = (text, depth, whole) => {
    if (depth > NATIVE_VALUE_DEPTH) return null;
    const breaks = Array.from(text.matchAll(SENTENCE_BREAK), (match) => match.index + match[0].length);
    if (!breaks.length) return null;
    // A name or a title set before a note the book has whole ("Kungariket
    // Asturien. Resurser, succession …"), however long the note: one
    // lookup per sentence break.
    for (const at of breaks) {
      const note = text.slice(at);
      const known = get(note);
      if (known === undefined) continue;
      const head = pieceOf(text.slice(0, at), depth, whole);
      if (head != null) return head + known;
    }
    if (text.length > SENTENCES_MAX || breaks.length > SENTENCE_BREAKS_MAX) return null;
    for (const at of breaks.reverse()) {
      const head = pieceOf(text.slice(0, at), depth, whole);
      if (head == null) continue;
      const tail = pieceOf(text.slice(at), depth, whole);
      if (tail != null) return head + tail;
    }
    return null;
  };

  // Native only, full tier. A name or a label with a note in parentheses and
  // no words between them ("Ciran (Kock)", "Barn person-5 (Hovhus 4
  // (genererat))", "Försoning (1516)"). Each side must be read, where a side
  // without words and a short name need no reading, and the book must know
  // one of them: two unknown sides are not the book's text.
  const byParenthesis = (text, depth, whole) => {
    if (text.length > LABEL_VALUE_MAX) return null;
    const match = TRAILING_PARENTHESIS.exec(text);
    if (!match) return null;
    const head = pieceOrName(match[1], depth, whole);
    const note = pieceOrName(match[2], depth, whole);
    if (head == null && note == null) return null;
    if (!isRead(match[1].trim(), head) || !isRead(match[2].trim(), note)) return null;
    return `${head ?? match[1]} (${note ?? match[2]})`;
  };

  // Native only, full tier. A generated name without the mark the engine
  // strips where it builds the name into other words ("Kung Meris lära"
  // from "Kung Meri (genererad)", "Starkt grepp över Gemål 1"). The book
  // must know the name with its mark, as an entry or by a pattern that opens
  // with words of its own: "{{name}} (genererad)" holds any text.
  const byGeneratedName = (text, depth, whole) => {
    if (!SHORT_NAME.test(text)) return null;
    for (const [mark, translated] of GENERATED_MARKS) {
      const known = get(text + mark) ?? matchPattern(text + mark, true, depth, whole, true);
      if (known != null && known.endsWith(translated)) return known.slice(0, -translated.length);
    }
    return null;
  };

  // Native only, full tier. The genitive the engine writes after a name that
  // ends in a digit ("Barn person-123:s" before " gren av …"). Unlike the
  // plain s, it cannot belong to the name, so the name is read and given the
  // English genitive. The book must read the name: "Gemål 1" or "Barn
  // person-123", which it knows by a pattern.
  const byColonGenitive = (text, depth, whole) => {
    if (!text.endsWith(":s") || !/\d:s$/u.test(text)) return null;
    const base = text.slice(0, -2);
    const read = pieceOf(base, depth, whole);
    return read == null ? null : `${read}’s`;
  };

  // What the book makes of a string it has no entry for: a pattern, then a
  // list; a native book then tries its comma list, the missing period and the
  // label behind a lowercased text. That last one answers for a value inside
  // a pattern in both tiers, and for a whole string only in the full tier:
  // outside the Swedish views a whole lowercase string is the English
  // interface's, and must not be capitalised into a Swedish entry. The label
  // with its value, the joined conditions, the stacked sentences and the note
  // in parentheses are read in the full tier only.
  const deriveOnce = (key, strong, depth, whole) => {
    const found = (native ? entryWithoutPeriod(key) : null) ?? matchPattern(key, strong, depth, whole) ?? byParts(key, strong, depth, whole);
    if (found != null || !native) return found;
    const simple = byCommaList(key, strong, depth) ?? withoutPeriod(key, strong, depth, whole) ?? (strong && depth === 0 ? null : byLoweredLabel(key, strong, depth, whole));
    if (simple != null || strong) return simple;
    return byTally(key, depth, whole) ?? byChange(key, depth, whole) ?? byLabelValue(key, depth, whole) ?? byJoiner(key, depth, whole)
      ?? bySentences(key, depth, whole) ?? byParenthesis(key, depth, whole) ?? byGeneratedName(key, depth, whole)
      ?? byColonGenitive(key, depth, whole);
  };

  // In the full tier a native book reads a string twice. First it looks for a
  // WHOLE reading: one in which it has read every value of a pattern, every
  // part of a list and every sentence, a short name and a number aside. Only
  // when there is none does the first reading of any kind answer, as in every
  // other book. A pattern whose slot swallowed its neighbours ("{{label}}
  // avslöjat" over "Förgifta: misslyckat och avslöjat", or a sentence's
  // pattern over the sentences set before it) leaves half the text Swedish,
  // and the whole reading of the same string by its parts is the right one.
  const derive = (key, strong, depth) => {
    if (!native || strong) return deriveOnce(key, strong, depth, false);
    return deriveOnce(key, false, depth, true) ?? deriveOnce(key, false, depth, false);
  };

  // The translation of a whole string (already trimmed by the caller or not),
  // or null when the book has nothing for it.
  //
  // `strongOnly` is for text outside the views written in the book's language,
  // where a short pattern would rewrite text that is not its own ("Hot dog
  // stand" under "{{name}} dog {{date}}"). Only entries and patterns with
  // STRONG_LETTERS of their own answer. A list or a missing period is resolved
  // through entries alone, and the rule is asked only about a value inside
  // such a pattern. Each tier remembers its own answers.
  const translate = (text, options) => {
    if (typeof text !== "string") return null;
    const key = text.trim();
    if (!key) return null;
    const known = get(key);
    if (known !== undefined) return known;
    const strong = options?.strongOnly === true;
    const remembered = strong ? strongMemo : memo;
    if (remembered.has(key)) return remembered.get(key);
    pieces.clear();
    const result = (strong ? null : byRule(key)) ?? derive(key, strong, 0);
    if (remembered.size >= MEMO_LIMIT) remembered.clear();
    remembered.set(key, result);
    return result;
  };

  return {
    get,
    has: (text) => get(text) !== undefined,
    patternCount: () => patternEntries.size,
    set,
    setAll,
    size: () => exact.size + patternEntries.size,
    translate,
  };
};
