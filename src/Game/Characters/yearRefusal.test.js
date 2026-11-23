// A refused model year tells the player why, in one sentence, and the raw reason goes to the log.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { YEAR_FAILED, yearRefusal } from "./yearRefusal.js";

const read = (name) => fs.readFileSync(new URL(name, import.meta.url), "utf8");
const ABORTED = "Modellåret avbröts utan att flytta tiden eller ändra karaktärerna.";
const task = (reason) => `${ABORTED} AI task "jumpForward" failed: ${reason}`;

function withWarnings(work) {
  const original = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args.join(" "));
  try { return { result: work(), warnings }; } finally { console.warn = original; }
}

test("each kind of failure the year meets gives its own sentence", () => {
  const cases = [
    [task("AI task \"jumpForward\" timed out: the model stopped answering. Turn off \"Limit AI generation\" in Settings to wait as long as the model needs."),
      "Modellen slutade svara innan året var skrivet. Inget har ändrats."],
    [task("Claude cannot fit this request in the model's context window: it answered \"prompt is too long\". A turn needs a model with a large context window (32k tokens or more): pick one in Settings → AI, or a provider that offers one."),
      "Året ryms inte i den valda modellens minne. Inget har ändrats."],
    [task("No model in your Fallback list can answer. Add one in Settings → AI."),
      "Ingen modell kan svara just nu. Inget har ändrats."],
    [task("Go to **settings** and paste your Gemini API key - you can get it at https://aistudio.google.com/app/apikey"),
      "Ingen modell kan svara just nu. Inget har ändrats."],
    [task("TypeError: Failed to fetch"), "Spelet fick ingen kontakt med modellen. Inget har ändrats."],
    [task("$.events[4].date must be on or after 0806-12-25 and no later than 0807-12-25."),
      "Modellen daterade en händelse utanför året. Inget har ändrats."],
    [task("$.stopDate must equal the requested target date 0807-12-25."),
      "Modellen daterade en händelse utanför året. Inget har ändrats."],
    [task("Karaktärskampanjen tillåter högst 12 meningsfulla modellhändelser i detta hopp; svaret innehöll 19."),
      "Modellen skrev fler händelser än ett år rymmer. Inget har ändrats."],
    [task("[world consequence] event 3 names a consequence no ledger carries."),
      "Modellen lämnade en berättelsetråd utan följd. Inget har ändrats."],
    [task("new breadth storyline saxon-revolt must link to a returned event"),
      "Modellen lämnade en berättelsetråd utan följd. Inget har ändrats."],
    [task("The model did not return valid structured output."),
      "Modellens svar gick inte att läsa. Inget har ändrats."],
  ];
  for (const [message, expected] of cases) {
    const { result, warnings } = withWarnings(() => yearRefusal(message));
    assert.equal(result, expected, message.slice(ABORTED.length, ABORTED.length + 90));
    assert.equal(warnings.length, 1, "the raw reason goes to the log");
    assert.ok(warnings[0].includes(message), "the log holds the whole reason");
  }
});

test("a retry that died in transport is told as the transport failure", () => {
  const message = task("$.events[2].date must not precede the previous event date. The retry then failed: AI task \"jumpForward\" timed out: the model stopped answering.");
  const { result } = withWarnings(() => yearRefusal(message));
  assert.equal(result, "Modellen slutade svara innan året var skrivet. Inget har ändrats.");
});

test("only a failure the model year aborted on is named; any other gives the fallback", () => {
  for (const message of [
    "TypeError: Failed to fetch dynamically imported module: http://127.0.0.1:3018/assets/gameplayLazy.js",
    "TypeError: Failed to fetch",
    "AI task \"jumpForward\" timed out: the model stopped answering.",
  ]) {
    const { result } = withWarnings(() => yearRefusal(message));
    assert.equal(result, YEAR_FAILED, message);
  }
});

test("a validation message that quotes a model's name is read as validation, and other storyline errors are not a missing consequence", () => {
  const quoted = task("$.events[3].date must not be later than 0807-12-25. (\"The network of Frankish bishops\")");
  assert.equal(withWarnings(() => yearRefusal(quoted)).result, "Modellen daterade en händelse utanför året. Inget har ändrats.");
  const other = task("$.storylineUpdates[0].polities[1] \"Saxon fetch\" could not resolve to a current or same-transaction canonical polity.");
  assert.equal(withWarnings(() => yearRefusal(other)).result, YEAR_FAILED);
});

test("the engine's own Swedish sentence passes as it is, and an unknown failure gives the fallback", () => {
  const engine = ["Läs färdigt den senaste turens händelser först.", "Kampanjen är avslutad.",
    `${ABORTED} Karaktärsvärlden ändrades medan modellen arbetade. Generera turen igen från det nya läget.`];
  for (const message of engine) {
    const { result, warnings } = withWarnings(() => yearRefusal(message));
    assert.equal(result, message);
    assert.deepEqual(warnings, []);
  }
  for (const message of [task("something nobody planned for"), "", null, undefined]) {
    const { result } = withWarnings(() => yearRefusal(message));
    assert.equal(result, YEAR_FAILED, String(message));
  }
});

test("every sentence the player can read has its English", () => {
  const catalog = JSON.parse(read("../../../public/lang/attainder/en.json"));
  const source = read("./yearRefusal.js");
  const sentences = [...source.matchAll(/"([A-ZÅÄÖ][^"]*\.)"/g)].map((match) => match[1]);
  assert.ok(sentences.length >= 8, "the sentences are found");
  // The abort sentence is the engine's marker, matched in the message and never shown alone.
  for (const sentence of [...sentences.filter((sentence) => sentence !== ABORTED), "Försök igen"]) assert.ok(catalog[sentence], sentence);
});

test("the refusal box offers the year again, beside the year line and in the panel", () => {
  const line = read("./CourtYearLine.jsx"), panel = read("./CharactersPanel.jsx"), store = read("./courtYear.js");
  assert.match(store, /"advanceCharacterYearWithModel", yearRefusal\)/, "the year line's refusal is classified");
  assert.match(line, /<button type="button" disabled=\{locked \|\| ended \|\| held\} onClick=\{onAdvance\}>Försök igen<\/button>/);
  assert.match(panel, /yearRefusal\(/, "the panel's refusal is classified");
  assert.match(panel, />Försök igen<\/button>/);
});
