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

const acceptsValues = (pattern, values) => {
  if (pattern.strength < STRONG_LETTERS) {
    const words = values.reduce((total, value) => total + wordCount(value), 0);
    if (words > WEAK_MAX_VALUE_WORDS) return false;
  }
  if (pattern.strength < SENTENCE_LETTERS && values.some((value) => /[.!?。！？]\s+\S/u.test(value))) return false;
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
export const createPhraseBook =({ localizeValue = null, native = false } = {}) => {
  // English (as extracted, and whitespace-collapsed) → translation.
  const exact = new Map();
  // Pattern keys → translation; compiled lazily, most specific first.
  const patternEntries = new Map();
  let patterns = null;
  // Answers already worked out, kept apart for the two tiers of translate().
  const memo = new Map();
  const strongMemo = new Map();

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
  const valueOf = (inner, strong, depth) => {
    const known = get(inner) ?? byRule(inner);
    if (known != null) return known;
    return native ? derive(inner, strong, depth) : byParts(inner, strong, depth);
  };

  // `strong`: only patterns with STRONG_LETTERS of their own are tried (see
  // translate). `depth`: how many patterns already surround this text.
  const matchPattern = (text, strong = false, depth = 0) => {
    if (!patternEntries.size || (native && depth > NATIVE_VALUE_DEPTH)) return null;
    for (const pattern of compiled()) {
      // Sorted by strength: after the first weak pattern, all are weak.
      if (strong && pattern.strength < STRONG_LETTERS) break;
      if (pattern.anchor && !text.includes(pattern.anchor)) continue;
      if (text.length > pattern.english.length + 300) continue;
      const match = pattern.regex.exec(text);
      if (!match) continue;
      const values = match.slice(1);
      if (!acceptsValues(pattern, values)) continue;
      // A weak pattern's value is a number or a name; words and numbers
      // together ("Found 12" before "{{value}} regions") are the start of some
      // other sentence, unless the book knows them (a date).
      if (pattern.strength < STRONG_LETTERS && values.some((value) => {
        const inner = value.trim();
        return /\p{L}/u.test(inner) && /\d/.test(inner) && get(inner) === undefined && byRule(inner) == null;
      })) continue;
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
  const byParts = (text, strong = false, depth = 0) => {
    if (text.length > 240 || !LIST_SEPARATOR.test(text)) return null;
    const parts = text.split(LIST_SPLIT);
    if (parts.length > 15) return null;
    let changed = false;
    const out = parts.map((part, index) => {
      const inner = part.trim();
      if (index % 2 === 1 || !inner) return part;
      const known = get(inner) ?? (strong ? null : byRule(inner) ?? matchPattern(inner, false, depth));
      if (known == null) return part;
      changed = true;
      return part.replace(inner, () => known);
    });
    return changed ? out.join("") : null;
  };

  // Native only. "Rom, Aten, Paris": a comma list whose every item is an
  // entry. One unknown item and the string is prose with commas, which stays.
  const byCommaList = (text) => {
    const parts = text.split(COMMA_SPLIT);
    const items = (parts.length + 1) / 2;
    if (items < 2 || items > COMMA_LIST_MAX_ITEMS) return null;
    const out = [];
    for (let index = 0; index < parts.length; index += 1) {
      const known = index % 2 === 1 ? parts[index] : get(parts[index]);
      if (known === undefined) return null;
      out.push(known);
    }
    return out.join("");
  };

  // Native only. "Hovet flyttar till Aachen." when the book has the sentence
  // without its period. Two periods end an ellipsis, not a sentence. In the
  // strong tier the sentence must be an entry.
  const withoutPeriod = (text, strong, depth) => {
    if (!text.endsWith(".") || text.endsWith("..")) return null;
    const bare = text.slice(0, -1).trimEnd();
    if (!bare) return null;
    const known = get(bare) ?? (strong ? null : matchPattern(bare, false, depth));
    if (known == null) return null;
    return known.endsWith(".") ? known : `${known}.`;
  };

  // Native only. The engine writes a label into a sentence in lower case
  // ("avslöjats för mord", from the label "Mord"), and the book has the label
  // as the source declares it, with its capital. So a text that starts in
  // lower case is looked up with a capital, among the entries alone.
  const byLoweredLabel = (text) => {
    if (!STARTS_LOWER.test(text)) return null;
    const label = text[0].toUpperCase() + text.slice(1);
    const known = get(label);
    return known === undefined ? null : lowerFirst(known, label);
  };

  // What the book makes of a string it has no entry for: a pattern, then a
  // list; a native book then tries its comma list, the missing period and the
  // label behind a lowercased text. That last one answers for a value inside
  // a pattern in both tiers, and for a whole string only in the full tier:
  // outside the Swedish views a whole lowercase string is the English
  // interface's, and must not be capitalised into a Swedish entry.
  const derive = (key, strong, depth) => {
    const found = matchPattern(key, strong, depth) ?? byParts(key, strong, depth);
    if (found != null || !native) return found;
    return byCommaList(key) ?? withoutPeriod(key, strong, depth) ?? (strong && depth === 0 ? null : byLoweredLabel(key));
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
