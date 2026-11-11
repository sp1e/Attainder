// Reads the Swedish text of the character and dynasty system out of the source.
//
// The upstream interface is English and its catalog is read by extractStrings.mjs. The
// character system on top of it is written in Swedish: the engine under server/characters/
// builds log titles, story text, refusals and labels, and the components under
// src/Game/Characters/ hold Swedish JSX. An English mode translates that text at display
// time with the same phrase book (src/runtime/phraseBook.js), keyed by the SWEDISH source
// string, so every Swedish string the player can read has to be in a catalog.
//
// What is read. Every non-test .js, .jsx and .mjs file under server/ and src/ is parsed
// with Babel and cut into UNITS, each a piece of text that reaches the screen whole:
//
//   - a string literal;
//   - a template literal, as a pattern with {{slots}}; an interpolation that is a choice
//     of strings is expanded into each variant (shapeOf in extractStrings.mjs), and the
//     strings of that choice belong to the template's unit instead of standing alone;
//   - a chain of + around strings, the same way;
//   - a JSX text node, and a run of JSX text around expressions as one pattern.
//
// Which units are Swedish. Three rules, each deterministic:
//
//   1. DETECTED: the unit's own words (slots removed) hold å, ä or ö, or a common Swedish
//      function word as a whole word and no English one (looksSwedish). When one variant
//      of a template is detected, every variant is taken: they are one sentence. A unit
//      whose only marker is a word English shares ('under', 'en') must also read like
//      prose, or sit in a Swedish file (rule 3): the locale 'en' is not Swedish text.
//   2. SIBLING: a unit without those markers ('Krig', 'Mat', 'Stark') is taken when it
//      sits beside clearly Swedish text in the same structure: another element of a list
//      of strings, another value of a map of strings, or the same field of another row
//      of a table ({ a: { name }, b: { name } }, rows of [id, label]); see siblingEvidence.
//      So is the value of a key or constant the code names as Swedish (nameSv, *_SV).
//   3. SWEDISH FILE: in a file where clearly Swedish units are at least half as many as
//      the other text-like units (swedishFile), JSX text and text attributes are taken
//      ('Skicka', 'Avbryt'), a string that reads like prose is taken ('Ogiltigt val.'),
//      and so is the other branch of a ternary with a Swedish branch ('ja', 'nej').
//
// A unit in a technical position (a comparison, a key, a string operation, a class name,
// a console call) is never an entry, and neither is a unit that holds a literal named in
// native-catalog-exclusions.json (English that a Swedish function word also spells:
// 'Under construction'). Every Swedish-looking literal that ends up outside the catalog
// is returned as `skipped`, and build-native-catalog.mjs fails unless the exclusions
// name it, so new Swedish text cannot miss the catalog.

import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";
import {
  NON_TEXT_PROPS, UI_ATTRS_DOM, calleeName, choiceShape, cleanJsxText, cleanSlot, cross, jsxName, render, shapeOf, slotName,
  withVariantLimit,
} from "./extractStrings.mjs";

const traverse = traverseModule.default ?? traverseModule;

// ---------------------------------------------------------------------------
// What counts as Swedish.

export const SWEDISH_WORDS = [
  "och", "att", "för", "med", "inte", "som", "den", "det", "har", "kan", "ska", "eller", "till", "från", "år", "hov",
  "rike", "kung", "drottning", "är", "en", "ett", "på", "av", "om", "vid", "blir", "får", "sin", "sitt", "sina", "mot",
  "utan", "efter", "under", "inget", "ingen", "inga", "hos", "igen", "kunde", "finns", "saknas", "saknar", "redan",
];
// Swedish function words that English text and codes hold too ("under way", "en-US",
// "OM"): enough to make a literal Swedish-looking, too weak to speak for its neighbours.
const AMBIGUOUS_WORDS = new Set(["under", "en", "den", "till", "sin", "om", "mot", "av", "med"]);
// Words English prose is full of and Swedish never uses: text with one of these and no
// å, ä or ö is English, whatever else it holds.
const ENGLISH_WORDS = [
  "the", "and", "of", "to", "you", "your", "this", "that", "with", "are", "was", "were", "will", "have", "its", "it",
  "on", "or", "not", "any", "each", "when", "which", "their", "they", "what", "who", "how", "more", "than",
  "then", "also", "only", "one", "into", "about", "there", "these", "those", "if", "but", "can", "should",
  "a", "has", "no", "needs", "lacks", "unknown",
];
// \b treats å, ä and ö as word boundaries, so the boundary is a lookaround on letters.
const wholeWord = (words) => new RegExp(`(?<![\\p{L}\\p{N}_])(?:${words.join("|")})(?![\\p{L}\\p{N}_])`, "iu");
const SWEDISH_WORD = wholeWord(SWEDISH_WORDS);
const CLEAR_WORD = wholeWord(SWEDISH_WORDS.filter((word) => !AMBIGUOUS_WORDS.has(word)));
const ENGLISH_WORD = wholeWord(ENGLISH_WORDS);
const DIACRITIC = /[åäöÅÄÖ]/;
// The English possessive, also after a slot that has been blanked: "{{to}}'s control".
const POSSESSIVE = /(?:^|[\p{L}\s])['’]s(?!\p{L})/u;

const looksEnglish = (text) => !DIACRITIC.test(text) && (ENGLISH_WORD.test(text) || POSSESSIVE.test(text));
export const looksSwedish = (text) => DIACRITIC.test(text) || (SWEDISH_WORD.test(text) && !looksEnglish(text));
// Swedish beyond doubt: evidence for the text beside it (rule 2) and for its file (rule 3).
const clearlySwedish = (text) => DIACRITIC.test(text) || (CLEAR_WORD.test(text) && !looksEnglish(text));

const SLOT = /\{\{[^{}]+\}\}/g;
const withoutSlots = (text) => text.replace(SLOT, " ");
const collapse = (text) => String(text ?? "").replace(/\s+/g, " ").trim();
const hasLetter = (text) => /\p{L}/u.test(text);

// An id, a key, a locale, a path, a constant or a [bracketed tag]: never a label,
// whatever sits beside it.
const idLike = (text) => /^[a-z0-9]+(?:[_.:|/-][a-z0-9]+)+$/.test(text) || /^[a-z]{2}-[A-Z]{2}$/.test(text)
  || /^[a-z]+[A-Z][A-Za-z0-9]*$/.test(text) || /^[A-Z][a-z]+(?:[A-Z][a-z0-9]+)+$/.test(text) || /^[A-Z0-9_]{2,}$/.test(text)
  || /^[#./\\]/.test(text) || /^\[[^\]]*\]$/.test(text) || !hasLetter(text);
// A word as prose writes it: letters, at most one hyphen or apostrophe inside, brackets
// and punctuation around ("hovet,", "(genererad)"), or an abbreviation ("f.Kr.").
const PROSE_WORD = /^[("'“”«]*(?:\p{L}+(?:[-'’]\p{L}+)?|(?:\p{L}{1,3}\.){2,})[)"'“”».,:;!?…]*$/u;
// A value: a slot with at most a short ending ("{{name}}s", "{{n}}:e"), a number or a
// code ("CK3"), with punctuation around it.
const PROSE_VALUE = /^[("'“”«]*(?:\{\{[^{}]+\}\}(?::?\p{Ll}{1,2})?|[+−-]?\d+(?:[.,]\d+)?|\p{Lu}{1,4}\d+)%?[)"'“”».,:;!?…]*$/u;
// Reads like a sentence or a label, slots and all. Tokens are split on spaces: words,
// values, and the rest, which is what ids and keys are made of ("person-{{id}}",
// "{{id}}|wound", "family:{{id}}", "charset=utf-8"). Prose is two words or more that
// outnumber the rest, or a single word that is capitalised ("Avliden") or stands with
// a value ("{{name}} friges", "0 silver"). A lone lowercase word is an id.
const proseLike = (text) => {
  if (idLike(collapse(withoutSlots(text)))) return false;
  const tokens = text.split(" ").filter((token) => /[\p{L}\p{N}]/u.test(token));
  const words = tokens.filter((token) => PROSE_WORD.test(token));
  const values = tokens.filter((token) => PROSE_VALUE.test(token));
  const rest = tokens.length - words.length - values.length;
  if (words.length > 1) return words.length > rest;
  return words.length === 1 && rest === 0 && (values.length > 0 || /^[("'“”«]*\p{Lu}\p{Ll}/u.test(words[0]));
};

// ---------------------------------------------------------------------------
// Parts → the catalog key.

// Authored text names its roles in single braces ("{steward} frågar hur …") and the
// engine fills them in when it renders the text (render in eventChains.js), so what the
// player reads holds a name there: a slot like any other.
const withPlaceholders = (part) => {
  if (!part.text) return [part];
  return part.text.split(/\{([A-Za-z_]\w*)\}/).map((piece, index) => (index % 2 ? { slot: piece } : { text: piece }));
};

// Two slots with nothing between them cannot be told apart by a pattern (compilePattern
// refuses them), so they become one slot that takes both values: `${a}${b} går` gives
// "{{a_b}} går", which matches what the game renders. Null when no words are left
// outside the slots, or when the alternative renders an element.
const renderAlt = (parts) => {
  const merged = [];
  for (const part of parts.flatMap(withPlaceholders)) {
    if (part.element) return null;
    const last = merged[merged.length - 1];
    if (part.slot && last?.slot) merged[merged.length - 1] = { slot: `${last.slot}_${part.slot}` };
    else if (part.slot || part.text) merged.push(part);
  }
  const text = collapse(render(merged)?.text);
  return text && hasLetter(withoutSlots(text)) ? text : null;
};

const renderShape = (shape) => [...new Set((shape ?? []).map(renderAlt).filter(Boolean))];

// The literal as the exclusions file names it: a string's value, a template with its
// expressions as written, JSX text as rendered. Whitespace is collapsed.
const literalText = (node, code) => {
  if (node.type !== "TemplateLiteral") return collapse(node.value);
  return collapse(node.quasis.reduce((text, quasi, index) => {
    const expression = node.expressions[index];
    return text + quasi.value.raw + (expression ? `\${${code.slice(expression.start, expression.end)}}` : "");
  }, ""));
};
// The words of a literal alone, for the Swedish test.
const literalWords = (node) => (node.type === "TemplateLiteral" ? node.quasis.map((quasi) => quasi.value.cooked ?? quasi.value.raw).join(" ") : node.value);

// ---------------------------------------------------------------------------
// Which literals a unit holds.

// The literals that shapeOf folds into `node`'s shape, so that they are part of this
// unit's text and not units of their own. Mirrors shapeOf: an interpolation is folded
// in only when it is a choice of strings (choiceShape), otherwise it is a slot.
const foldedLiterals = (node, code, out = []) => {
  if (!node) return out;
  if (node.type === "StringLiteral") out.push(node);
  else if (node.type === "TemplateLiteral") {
    out.push(node);
    for (const expression of node.expressions) if (choiceShape(expression, code)) foldedLiterals(expression, code, out);
  } else if (node.type === "ConditionalExpression") {
    for (const branch of [node.consequent, node.alternate]) if (choiceShape(node, code) || shapeOf(branch, code)) foldedLiterals(branch, code, out);
  } else if (node.type === "LogicalExpression") {
    if (shapeOf(node.right, code)) foldedLiterals(node.right, code, out);
  } else if (node.type === "BinaryExpression" && node.operator === "+") {
    out.push(node);
    for (const side of [node.left, node.right]) if (shapeOf(side, code)) foldedLiterals(side, code, out);
  } else if (node.type === "ParenthesizedExpression" || node.type === "TSAsExpression") foldedLiterals(node.expression, code, out);
  return out;
};

// ---------------------------------------------------------------------------
// Where a unit sits.

const TECHNICAL_ATTRS = new Set(["className", "id", "htmlFor", "key", "type", "name", "href", "src", "role", "value", "rel", "target", "lang", "style"]);
// Calls whose string arguments are keys, needles or selectors. A number is the only
// argument position that is technical (the replacement of replace() is text).
const TECHNICAL_CALLS = new Map(Object.entries({
  localeCompare: null, includes: null, startsWith: null, endsWith: null, indexOf: null, lastIndexOf: null, split: null,
  match: null, matchAll: null, test: null, RegExp: null, has: null, get: null, delete: null, getItem: null, setItem: null,
  removeItem: null, addEventListener: null, removeEventListener: null, querySelector: null, querySelectorAll: null,
  getElementById: null, closest: null, matches: null, getAttribute: null, setAttribute: null, createElement: null,
  matchMedia: null, setHeader: null, require: null, fetch: null, replace: 0, replaceAll: 0, set: 0,
}));
const COMPARISONS = new Set(["===", "!==", "==", "!=", "in", "instanceof", "<", ">", "<=", ">="]);
const TECHNICAL_KEYS = new Set([
  "id", "key", "type", "kind", "action", "code", "tag", "icon", "status", "value", "role", "sex", "slot", "state", "mode", "variant",
  "tone", "className", "src", "href", "url", "path", "file", "color", "category", "language", "locale", "lang",
]);
// A field that holds an id or an enum value, by its name: choiceId, storyKey, eventType.
const technicalKey = (name) => TECHNICAL_KEYS.has(name) || /(?:Ids?|Key|Type|Kind)$/.test(name ?? "");
// A constant that holds keys or ids, by its name: NAV_KEYS, COMMAND_IDS.
const TECHNICAL_CONSTANT = /(?:^|_)(?:KEYS?|IDS?)$/;

// The expression whose position decides: a branch of a ternary or of &&, || and ?? sits
// where the whole choice sits, and so does the expression of a JSX attribute.
const positionPath = (p) => {
  let at = p;
  while (at.parentPath && ((at.parentPath.isConditionalExpression() && at.parent.test !== at.node) || at.parentPath.isLogicalExpression()
    || (at.parentPath.isJSXExpressionContainer() && at.parentPath.parentPath?.isJSXAttribute()))) at = at.parentPath;
  return at;
};

// A list that is only searched: ['a', 'b'].includes(x), new Set(['a', 'b']).
const lookupList = (array) => {
  const holder = array.parent;
  if (holder.type === "NewExpression") return calleeName(holder.callee) === "Set";
  return holder.type === "MemberExpression" && holder.object === array.node && ["includes", "indexOf"].includes(holder.property?.name);
};

const keyName = (node) => node?.key?.name ?? node?.key?.value;
const isKey = (parent, node) => ["ObjectProperty", "ObjectMethod", "ClassProperty", "ClassMethod"].includes(parent.type) && parent.key === node;

// Why the literal at `p` is never text on the screen, or null when it may be.
const technicalReason = (p) => {
  if (p.findParent((q) => q.isCallExpression() && calleeName(q.node.callee) === "console")) return "developer-only";
  const at = positionPath(p);
  const parent = at.parent;
  if (!parent) return "technical";
  if (isKey(parent, at.node) || (parent.type === "MemberExpression" && parent.property === at.node)) return "technical";
  if (parent.type === "BinaryExpression" && COMPARISONS.has(parent.operator)) return "technical";
  if (parent.type === "SwitchCase" || parent.type === "TaggedTemplateExpression") return "technical";
  if (parent.type === "ArrayExpression" && lookupList(at.parentPath)) return "technical";
  if (parent.type === "JSXAttribute") {
    const attr = jsxName(parent.name);
    return TECHNICAL_ATTRS.has(attr) || attr.startsWith("data-") ? "technical" : null;
  }
  if (["CallExpression", "OptionalCallExpression", "NewExpression"].includes(parent.type) && parent.callee !== at.node) {
    const name = calleeName(parent.callee);
    if (!TECHNICAL_CALLS.has(name)) return null;
    const only = TECHNICAL_CALLS.get(name);
    return only === null || parent.arguments[only] === at.node ? "technical" : null;
  }
  return null;
};

// The constant a literal is part of, through lists, maps and Object.freeze: its name.
const holderName = (p) => {
  let at = p.parentPath;
  while (at && (at.isArrayExpression() || at.isObjectExpression() || at.isObjectProperty() || (at.isCallExpression() && calleeName(at.node.callee) === "freeze"))) at = at.parentPath;
  return at?.isVariableDeclarator() && at.node.id?.type === "Identifier" ? at.node.id.name : null;
};

// Does this unit sit where text is shown? For a unit that has no Swedish marker of its
// own (rule 3): JSX text; an attribute the component renders (upstream's rule: title,
// placeholder, aria-label and alt on an element, any text prop on a component); or a
// string that reads like prose and is not the value of a technical key.
const readsAsText = (unit) => {
  const words = unit.texts.map((text) => collapse(withoutSlots(text)));
  if (unit.jsx) return words.some((text) => !idLike(text));
  const at = positionPath(unit.path);
  if (at.parent?.type === "JSXAttribute") {
    const attr = jsxName(at.parent.name);
    const element = jsxName(at.parentPath.parent?.name);
    const component = /^[A-Z]/.test(element) || element.includes(".");
    const shown = component ? !NON_TEXT_PROPS.has(attr) && !attr.startsWith("data-") && !/^on[A-Z]/.test(attr) : UI_ATTRS_DOM.has(attr);
    return shown && words.some((text) => !idLike(text));
  }
  if (at.parent?.type === "ObjectProperty" && technicalKey(keyName(at.parent))) return false;
  return unit.texts.some(proseLike) && !TECHNICAL_CONSTANT.test(holderName(at) ?? "");
};

const FUNCTIONS = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression", "ObjectMethod", "ClassMethod"]);
const functionName = (q) => q.node.id?.name ?? (q.node.type.endsWith("Method") ? keyName(q.node) : null)
  ?? (q.parent.type === "VariableDeclarator" ? q.parent.id?.name : null) ?? (q.parent.type === "ObjectProperty" ? keyName(q.parent) : null);

const REFUSAL_NAME = /refus|reason|invalid|error|closed|problem|fail|denied|deny|blocked/i;
const LOG_NAME = /log|memor|remember|stor(?:y|ies)|chronicle|rumou?r|echo|nickname|event|outcome|chain/i;
// opinionReasons and familySupportReasons are rows of labels, not refusals.
const signalRole = (name) => {
  if (typeof name !== "string") return null;
  if (/[a-z]Reasons$/.test(name)) return "label";
  return REFUSAL_NAME.test(name) ? "refusal" : LOG_NAME.test(name) ? "log" : null;
};

// The nearest named function (or, at module level, the constant) a unit sits in, and
// the best guess at how its text reaches the player. The names on the way up decide:
// the nearest call, key, constant or function that reads like a refusal or like the
// log wins; text under JSX or anywhere in a component file is `ui`.
const contextOf = (p, file) => {
  let enclosingFunction = null, constant = null, role = null, contained = false;
  const note = (name) => { role ??= signalRole(name); };
  for (let q = p.parentPath, child = p; q; child = q, q = q.parentPath) {
    const node = q.node;
    if (node.type === "ThrowStatement" || (node.type === "NewExpression" && /Error$/.test(calleeName(node.callee)))) role ??= "refusal";
    else if (node.type.startsWith("JSX")) role ??= "ui";
    else if (node.type === "CallExpression" || node.type === "OptionalCallExpression") { if (node.callee !== child.node) note(calleeName(node.callee)); }
    else if (node.type === "ObjectProperty") { if (node.value === child.node) note(keyName(node)); }
    else if (node.type === "ObjectExpression" || node.type === "ArrayExpression") contained = true;
    else if (node.type === "VariableDeclarator" && node.id?.type === "Identifier") { constant ??= node.id.name; note(node.id.name); }
    if (FUNCTIONS.has(node.type) && !enclosingFunction) {
      enclosingFunction = functionName(q);
      note(enclosingFunction);
    }
  }
  if (file.startsWith("server/seed/")) role = "seed";
  else if (!role) role = file.endsWith(".jsx") ? "ui" : contained ? "label" : "other";
  return { enclosingFunction: enclosingFunction ?? constant ?? null, role };
};

// ---------------------------------------------------------------------------
// Units.

const PARSE_PLUGINS = ["jsx", "classProperties", "optionalChaining", "nullishCoalescingOperator", "topLevelAwait", "importMeta", "dynamicImport", "objectRestSpread", "importAttributes"];
const isElement = (node) => node && (node.type === "JSXElement" || node.type === "JSXFragment");
const isImport = (parent) => ["ImportDeclaration", "ExportNamedDeclaration", "ExportAllDeclaration", "ImportExpression", "ImportAttribute"].includes(parent.type);
const COMMENT_KEYS = new Set(["loc", "leadingComments", "trailingComments", "innerComments"]);

// A quick walk without paths: does any literal of the file look Swedish? Most upstream
// files hold none, and no rule takes anything from such a file.
const mayHoldSwedish = (node) => {
  if (!node || typeof node !== "object") return false;
  if (Array.isArray(node)) return node.some(mayHoldSwedish);
  if (node.type === "StringLiteral" || node.type === "JSXText") return looksSwedish(node.value);
  if (node.type === "TemplateElement") return looksSwedish(node.value.cooked ?? node.value.raw);
  if (typeof node.type !== "string") return false;
  return Object.keys(node).some((key) => !COMMENT_KEYS.has(key) && mayHoldSwedish(node[key]));
};

// Can this expression render an element? `count > 0 && <span>{count}</span>` does, and
// an element ends a run of text as surely as one written between the text.
const rendersElement = (node) => {
  if (!node) return false;
  if (isElement(node)) return true;
  if (node.type === "ConditionalExpression") return rendersElement(node.consequent) || rendersElement(node.alternate);
  if (node.type === "LogicalExpression") return rendersElement(node.left) || rendersElement(node.right);
  if (node.type === "ParenthesizedExpression") return rendersElement(node.expression);
  return node.type === "CallExpression" && /map$/.test(calleeName(node.callee));
};

// JSX children as React renders them: each text child and each expression child is its
// own text node, and an element between them ends the run (collectChildren upstream,
// which does not look for the element inside a choice).
const jsxRuns = (element, code) => {
  const runs = [];
  let current = [];
  const flush = () => {
    if (current.length) runs.push(current);
    current = [];
  };
  for (const child of element.children) {
    if (child.type === "JSXText") {
      const cleaned = cleanJsxText(child.value);
      if (cleaned) current.push({ node: child, alts: [[{ text: cleaned }]] });
    } else if (child.type === "JSXExpressionContainer") {
      const expression = child.expression;
      if (expression.type === "JSXEmptyExpression") continue;
      if (rendersElement(expression)) flush();
      else current.push({ node: expression, alts: shapeOf(expression, code) ?? [[{ slot: cleanSlot(slotName(expression, code)) }]] });
    } else flush();
  }
  flush();
  return runs;
};

// The upstream extractor keeps 8 variants of a template and drops the rest. Here a
// dropped variant is a sentence the English mode cannot find (a neighbour's caption in
// CourtSections.jsx has 24), so the cap is raised, and a taken unit that reaches it
// stops the build instead of losing text.
const VARIANT_LIMIT = 64;

// Every unit of one file, in source order. A unit: { path, node, texts (the catalog
// keys it would give), literals (the literal nodes it holds), jsx, detected, clear, full }.
const collectUnits = (ast, code) => {
  const units = [];
  const folded = new Set();
  const add = (p, node, shape, literals, jsx = false) => {
    const texts = renderShape(shape);
    const words = texts.map(withoutSlots);
    units.push({ path: p, node, texts, literals, jsx, detected: words.some(looksSwedish), clear: words.some(clearlySwedish), full: shape.length >= VARIANT_LIMIT });
  };
  const expression = (p) => {
    if (folded.has(p.node)) return;
    const shape = shapeOf(p.node, code);
    if (!shape) return;
    const literals = foldedLiterals(p.node, code);
    literals.forEach((node) => folded.add(node));
    add(p, p.node, shape, literals.filter((node) => node.type !== "BinaryExpression"));
  };
  const children = (p) => {
    for (const run of jsxRuns(p.node, code)) {
      for (const item of run) if (item.node.type === "JSXText") add(p, item.node, item.alts, [item.node], true);
      const texts = run.filter((item) => item.node.type === "JSXText").map((item) => item.node);
      if (run.length > 1) add(p, run[0].node, run.reduce((alts, item) => cross(alts, item.alts), [[]]), texts, true);
    }
  };
  traverse(ast, {
    noScope: true,
    StringLiteral(p) { if (!isImport(p.parent)) expression(p); },
    TemplateLiteral: expression,
    BinaryExpression(p) { if (p.node.operator === "+") expression(p); },
    JSXElement: children,
    JSXFragment: children,
  });
  return units;
};

// ---------------------------------------------------------------------------
// Rule 2: text beside Swedish text.

const unwrap = (node) => (node?.type === "CallExpression" && calleeName(node.callee) === "freeze" ? node.arguments[0] : node);
const isText = (node) => node?.type === "StringLiteral" || node?.type === "TemplateLiteral";
const members = (container) => (container.type === "ArrayExpression" ? container.elements : container.properties.map((property) => property.value)).map(unwrap);
const memberAt = (container, step) => {
  if (!container) return null;
  if (container.type === "ArrayExpression") return typeof step === "number" ? unwrap(container.elements[step]) : null;
  if (container.type !== "ObjectExpression") return null;
  return unwrap(container.properties.find((property) => property.type === "ObjectProperty" && keyName(property) === step)?.value);
};

// The containers above a literal, nearest first, each with the step (key or index) that
// leads down from it: for 'x' in { a: { name: 'x' } }, [{ name-object, "name" }, { map, "a" }].
const containerChain = (p, limit = 4) => {
  const chain = [];
  for (let child = p, q = p.parentPath; q && chain.length < limit; child = q, q = q.parentPath) {
    if (q.isCallExpression() && calleeName(q.node.callee) === "freeze") continue;
    if (q.isObjectProperty() && q.node.value === child.node) {
      chain.push({ container: q.parent, step: keyName(q.node) });
      child = q;
      q = q.parentPath;
    } else if (q.isArrayExpression()) chain.push({ container: q.node, step: q.node.elements.indexOf(child.node) });
    else break;
  }
  return chain;
};

const cellWords = (node) => (isText(node) ? literalWords(node) : "");
const startsLower = (node) => /^\p{Ll}/u.test(cellWords(node).trim());

// Is there clearly Swedish text beside this unit? From level 2 up the neighbours are
// the other rows of a table, and the evidence is Swedish text in the SAME field of
// another row: { a: { name: 'Krig' }, b: { name: 'Fältherren' } }, [[id, 'Mat'], [id, 'Föda']].
// Level 1 is the unit's own list or map. It counts only when no neighbouring row has
// the field, every member is a string (a list of words, a map of labels), and a Swedish
// member is written like the unit: in ['command', 'Förvaltning och hushåll'] the
// lowercase word is a key. English in the same field or list means the table is mixed
// (an upstream table with Swedish rows added), and nothing is taken from it.
const siblingEvidence = (unit, swedishNodes) => {
  const chain = containerChain(unit.path);
  let rowsHaveField = false;
  for (let level = 1; level < chain.length; level += 1) {
    const steps = chain.slice(0, level).map((entry) => entry.step).reverse();
    const cells = members(chain[level].container).map((row) => steps.reduce((node, step) => memberAt(node, step), row)).filter((cell) => cell && cell !== unit.node);
    if (cells.some((cell) => looksEnglish(cellWords(cell)))) return false;
    if (cells.some((cell) => swedishNodes.has(cell))) return true;
    rowsHaveField ||= cells.length > 0;
  }
  if (!chain.length || rowsHaveField || technicalKey(chain[0].step)) return false;
  const own = members(chain[0].container);
  if (!own.every(isText) || own.some((node) => looksEnglish(cellWords(node)))) return false;
  return own.some((node) => node !== unit.node && swedishNodes.has(node) && startsLower(node) === startsLower(unit.node));
};

// Named as Swedish by the code itself: a value under a key or a constant whose name
// ends in Sv (nameSv, noteSv, TRIBE_NAMES_SV), directly or through lists and maps.
const declaredSwedish = (p) => {
  for (let q = positionPath(p).parentPath; q; q = q.parentPath) {
    if (q.isObjectProperty() && /Sv$/.test(String(keyName(q.node)))) return true;
    if (q.isVariableDeclarator()) return /(?:Sv|_SV)$/.test(q.node.id?.name ?? "");
    if (!(q.isArrayExpression() || q.isObjectExpression() || q.isObjectProperty() || (q.isCallExpression() && calleeName(q.node.callee) === "freeze"))) return false;
  }
  return false;
};

// The literal branches of a ternary chain: a ? 'x' : b ? 'y' : 'z'.
const ternaryBranches = (node, out = []) => {
  for (const branch of [node.consequent, node.alternate]) {
    if (branch.type === "ConditionalExpression") ternaryBranches(branch, out);
    else if (isText(branch)) out.push(branch);
  }
  return out;
};
const ternaryEvidence = (unit, swedishNodes) => {
  let top = unit.path;
  while (top.parentPath?.isConditionalExpression() && top.parent.test !== top.node) top = top.parentPath;
  return top !== unit.path && ternaryBranches(top.node).some((node) => node !== unit.node && swedishNodes.has(node));
};

// ---------------------------------------------------------------------------
// Rule 3: a file written in Swedish.

// A file is Swedish when its clearly Swedish units are at least half as many as its
// other text-like units. The character system's files pass easily (their unmarked text
// is short labels); an upstream file that carries a line or two of Swedish
// (libraryBar.jsx) does not, so its English is not swept into this catalog.
const swedishFile = (units) => {
  const clear = units.filter((unit) => unit.clear).length;
  let other = 0;
  for (const unit of units) {
    if (other > clear * 2) break;
    if (!unit.detected && unit.texts.length && readsAsText(unit) && !technicalReason(unit.path)) other += 1;
  }
  return clear > 0 && clear * 2 >= other;
};

// Which rule takes a unit (1, 2 or 3), or 0.
const ruleOf = (unit, swedishNodes, swedish) => {
  const words = unit.texts.map((text) => collapse(withoutSlots(text)));
  if (unit.clear || (unit.detected && !words.every(idLike) && (swedish || unit.texts.some(proseLike)))) return 1;
  if (!unit.texts.length || unit.texts.some((text) => looksEnglish(withoutSlots(text)))) return 0;
  if (!unit.jsx && !words.some(idLike) && (declaredSwedish(unit.path) || siblingEvidence(unit, swedishNodes))) return 2;
  return swedish && (readsAsText(unit) || (!unit.jsx && ternaryEvidence(unit, swedishNodes))) ? 3 : 0;
};

// ---------------------------------------------------------------------------
// One file.

const refOf = (unit, file) => {
  const { enclosingFunction, role } = contextOf(unit.path, file);
  return { file, line: unit.node.loc?.start?.line ?? 0, enclosingFunction, role: unit.jsx && role !== "seed" ? "ui" : role };
};
const kindOf = (text, unit) => (text.includes("{{") ? "pattern" : unit.jsx ? "jsx" : "string");

// The Swedish-looking literals of the units that gave no entry, each once, unless a
// unit that did give one holds the literal too (JSX text is in its run as well).
const skippedLiterals = (dropped, held, code, file) => {
  const seen = new Set(held);
  const out = [];
  for (const { unit, why } of dropped) {
    for (const node of unit.literals) {
      if (seen.has(node) || !looksSwedish(literalWords(node))) continue;
      seen.add(node);
      out.push({ file, line: node.loc?.start?.line ?? 0, text: literalText(node, code), why });
    }
  }
  return out;
};

// `code` is one file's source, `file` its path from the repo root with forward
// slashes, `excluded` the literals of this file that the exclusions name (as
// literalText writes them). Returns the units taken as { text, kind, rule, ref }, and
// `skipped`: every Swedish-looking literal that gave no entry, as { file, line, text, why }.
export const extractNativeFromSource = (code, file, excluded = new Set()) => {
  const ast = parse(code, { sourceType: "module", errorRecovery: true, plugins: PARSE_PLUGINS });
  if (ast.errors?.length) throw new Error(`${file}: ${ast.errors[0].message}`);
  if (!mayHoldSwedish(ast.program)) return { taken: [], skipped: [], swedish: false };
  const units = withVariantLimit(VARIANT_LIMIT, () => collectUnits(ast, code));
  const swedishNodes = new Set(units.filter((unit) => unit.clear && !unit.jsx).map((unit) => unit.node));
  const swedish = swedishFile(units);
  const taken = [];
  const dropped = [];
  const held = new Set();
  for (const unit of units) {
    const rule = ruleOf(unit, swedishNodes, swedish);
    const named = rule && excluded.size && unit.literals.some((node) => excluded.has(literalText(node, code)));
    const why = !rule ? "not-swedish" : named ? "excluded" : unit.jsx ? null : technicalReason(unit.path);
    if (why) {
      dropped.push({ unit, why });
      continue;
    }
    const ref = refOf(unit, file);
    if (unit.full) throw new Error(`${file}:${ref.line}: a template has ${VARIANT_LIMIT} variants or more. Write it as fewer sentences.`);
    unit.literals.forEach((node) => held.add(node));
    // A variant that is English from end to end is the upstream half of a mixed choice.
    for (const text of unit.texts) if (!looksEnglish(withoutSlots(text))) taken.push({ text, kind: kindOf(text, unit), rule, ref });
  }
  return { taken, skipped: skippedLiterals(dropped, held, code, file), swedish };
};

// ---------------------------------------------------------------------------
// The tree.

const SOURCE_DIRS = ["server", "src"];
const SKIPPED_DIRS = new Set(["node_modules", "generated"]);

// Every non-test source file under server/ and src/, sorted, as repo-relative paths.
export const nativeSourceFiles = (root) => {
  const out = [];
  const walk = (relative) => {
    for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.has(entry.name) && !entry.name.startsWith(".") && next !== "server/fixtures") walk(next);
      } else if (/\.(?:js|jsx|mjs)$/.test(entry.name) && !/\.test\.(?:js|jsx|mjs)$/.test(entry.name)) out.push(next);
    }
  };
  SOURCE_DIRS.filter((dir) => fs.existsSync(path.join(root, dir))).forEach(walk);
  return out.sort();
};

const sameRef = (a, b) => a.file === b.file && a.line === b.line && a.enclosingFunction === b.enclosingFunction && a.role === b.role;

// The whole catalog: `entries` maps each Swedish source string to { kind, refs }, and
// `skipped` lists the Swedish-looking literals outside it. `exclusions` is the content
// of native-catalog-exclusions.json: [{ file, text, reason }].
export const extractNativeCatalog = (root, exclusions = []) => {
  const entries = new Map();
  const skipped = [];
  const excluded = new Map();
  for (const { file, text } of exclusions) excluded.set(file, (excluded.get(file) ?? new Set()).add(text));
  for (const file of nativeSourceFiles(root)) {
    const result = extractNativeFromSource(fs.readFileSync(path.join(root, file), "utf8"), file, excluded.get(file));
    skipped.push(...result.skipped);
    for (const { text, kind, ref } of result.taken) {
      const entry = entries.get(text) ?? { kind, refs: [] };
      if (kind === "pattern" || (kind === "string" && entry.kind === "jsx")) entry.kind = kind;
      if (!entry.refs.some((known) => sameRef(known, ref))) entry.refs.push(ref);
      entries.set(text, entry);
    }
  }
  return { entries, skipped };
};
