// Plays the character engine and reports every player-facing string that English mode
// would leave Swedish or half Swedish. A browser run finds such a gap only in the text
// that happened to be on screen; this sweep plays every shipped start and reads all the
// text the engine writes on the way.
//
//   node scripts/i18n/sweep-engine-text.mjs                 play, print the counts, write the report
//   node scripts/i18n/sweep-engine-text.mjs --check         also fail on a gap outside the allow-list
//   node scripts/i18n/sweep-engine-text.mjs --years 10 --seeds 1 --only hadara --out report.json
//
// What it plays: every playable polity of the four shipped packages as the realm and as
// a family, and the Hadara court, each for --years years (30) under --seeds seeds (2).
// Every year it reads the presentation, answers the open stories, runs the actions it
// has tried least, holds a conversation, sends an envoy, lets an NPC act, and now and
// then asks for what must be refused (no silver, no orders left, a target that does not
// exist). Every choice comes from the seed and a counter, so two runs give one report.
//
// What it judges: each collected string is read by the native book as the translator
// makes it (createPhraseBook(bookOptions("en")) over the merged native pack), full tier.
//   translated    the reading differs from the Swedish and holds no Swedish;
//   name          the book maps the text to itself, or has nothing for a text that is
//                 exactly a name in the state (a person, family, faith, city, realm,
//                 tribe or nickname) and holds no Swedish: a house the engine names
//                 ("Barn person-5:s gren av Karls hus") is text;
//   fixture       text the sweep itself supplied where a model or the host would write;
//   partial       the reading still holds Swedish: a gap;
//   untranslated  the book has nothing for it: a gap.
// A gap named in scripts/i18n/engine-sweep-allow.json is deliberate and passes --check.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ADULT_AGE } from "../../server/characters/content.js";
import {
  advanceCharacters, applyRealmDissolution, createCharacterSystem, estimateCharacterAction, estimateConversation,
  estimateEnvoyRequest, executeCharacterCommand, getCharacterPresentation, reconcileExternalHosts,
} from "../../server/characters/index.js";
import { createHistoricalCharacterSystem } from "../../server/characters/scenarioSeed.js";
import { addGameMonths, gameDateYear } from "../../server/gameDates.js";
import { mergeNativePack } from "../../src/runtime/nativePack.js";
import { createPhraseBook, isPatternKey } from "../../src/runtime/phraseBook.js";
import { looksSwedish } from "../../src/runtime/swedishText.js";
import { bookOptions } from "../../src/runtime/translatorMode.js";
import { readJson, serializeJson } from "./jsonOutput.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const LANG = path.join(ROOT, "public/lang/attainder");
const ENGINE_DIR = path.join(ROOT, "server/characters");
const ALLOW_FILE = path.join(ROOT, "scripts/i18n/engine-sweep-allow.json");
export const PACKAGES = Object.freeze(["egypt-3000bc", "charlemagne-800", "john-1200", "world-1500"]);
export const DEFAULTS = Object.freeze({ years: 30, seeds: 2 });
const SEEDS = Object.freeze([104729, 20261112, 777, 9001, 271828, 314159]);
const MODES = Object.freeze(["realm", "family"]);

// ---- choices: every one comes from the seed and a counter ----

// A 32-bit mix of two integers (the finalizer of MurmurHash3), so neighbouring counters
// give unrelated picks.
const mix = (a, b) => {
  let x = (Math.imul(a ^ 0x9e3779b1, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35)) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
  return x >>> 0;
};
const choose = (turn, list) => list[mix(turn.seed, ++turn.draws) % list.length];
const copy = (value) => JSON.parse(JSON.stringify(value));

// ---- what counts as text ----

// Keys whose values are codes the views map to a label and never show: ids, enum values,
// rule names. Decided by name, since a code such as "realm" or "weak" has the shape of a
// lowercase word. A key ending in Id or Ids is a reference and is skipped as well.
const CODE_KEYS = new Set([
  "id", "type", "kind", "mode", "status", "phase", "key", "value", "catalogId", "category", "skill", "defenseSkill",
  "secrecySkill", "actorScope", "target", "targetFamily", "wallet", "stressTag", "precision", "sex", "archetype",
  "traits", "education", "taxPolicy", "successionLaw", "law", "strength", "evidence", "tier", "role", "origin",
  "identityOrigin", "tradition", "state", "choice", "approach", "policy", "care", "uses", "requires", "utility",
  "portraitState", "portraitAgeGroup", "sign", "types", "bonds", "source", "topic", "stage", "outcome", "result",
  "nature", "cause", "crime", "visibility", "who", "from", "to", "family", "owner", "over", "subject", "holders",
  "knownBy", "rules", "content", "vetoedActions", "actionType", "resolution", "goalType", "claim", "war", "side",
  "wonderKind", "scope", "tag", "chainId", "nodeId", "step", "severity", "course", "trigger", "reasonCode",
  "portraitSourceAgeGroup", "sourceKind", "action", "plotAction", "participants", "basis", "tone", "eventType", "hostKind", "sourceKey",
]);
// A key that is text in most places and a code in one: the reason a mandate is held
// by someone else ("minority") against the reason a command is refused.
const CODE_PATHS = Object.freeze([/\.authority\.(?:royal|household)\.reason$/]);
// Parts of the presentation that hold no text for the player: rule versions and the
// portrait renderer's keys.
const SKIPPED_SUBTREES = new Set(["versions", "portraitState", "deathAppearance"]);
// The research record of a package. Its Swedish display text sits under keys ending
// in Sv (noteSv, originLabelSv); the rest is the research's own English and its
// bibliography (titles, locators, licences), which no language translates.
const RESEARCH_SUBTREE = "historicalOrigin";
const SWEDISH_KEY = /Sv$/;
const TWO_LETTERS = /\p{L}{2}/u;
const ISO_DATE = /^-?\d{4,6}-\d{2}-\d{2}$/;
const COLOUR = /^#[0-9a-f]{3,8}$/i;
const URL_TEXT = /^https?:\/\//;
// person-12, family-arel, office:ruler, clean_success: lowercase ASCII joined by a mark.
const IDENTIFIER = /^[a-z][a-z0-9]*(?:[-_:.|][a-z0-9]+)+$/;

// Is this value text a player reads? Shape first (no word, a date, a colour, a link, an
// identifier), then the key it sits under.
export const isDisplayText = (key, value, keyPath = "") => {
  const text = value.trim();
  if (!TWO_LETTERS.test(text) || ISO_DATE.test(text) || COLOUR.test(text) || URL_TEXT.test(text)) return false;
  if (CODE_KEYS.has(key) || /Ids?$/.test(key) || CODE_PATHS.some((pattern) => pattern.test(keyPath))) return false;
  return !IDENTIFIER.test(text);
};

// The strings of a campaign with where each was first seen, the names its states hold
// and the text the sweep supplied itself.
export function createCollector() {
  const strings = new Map();
  const names = new Set();
  const fixtures = new Set();
  const add = (value, where, keyPath) => {
    const text = value.trim();
    const seen = strings.get(text);
    if (seen) seen.count += 1;
    else strings.set(text, { count: 1, campaign: where.campaign, year: where.year, path: keyPath });
  };
  // `trail` is the keys down to the value; it becomes a path only for a string, since
  // most of a presentation is numbers and ids.
  const visit = (value, where, trail, key, research) => {
    if (typeof value === "string") {
      if (research && !SWEDISH_KEY.test(key)) return;
      const keyPath = trail.join("");
      if (isDisplayText(key, value, keyPath)) add(value, where, keyPath);
    } else if (Array.isArray(value)) {
      trail.push("[]");
      for (const item of value) visit(item, where, trail, key, research);
      trail.pop();
    } else if (value && typeof value === "object") {
      for (const name of Object.keys(value)) {
        if (SKIPPED_SUBTREES.has(name)) continue;
        trail.push(".", name);
        visit(value[name], where, trail, name, research || name === RESEARCH_SUBTREE);
        trail.length -= 2;
      }
    }
  };
  const walk = (value, where, root) => visit(value, where, [root], "", false);
  const name = (value) => { if (typeof value === "string" && value.trim()) names.add(value.trim()); };
  const fixture = (value) => { fixtures.add(value.trim()); return value; };
  return { strings, names, fixtures, add, walk, name, fixture };
}

// Every proper name a state holds. An untranslated string that is exactly one of these
// is a name the two languages share, not a gap. An office counts: the engine's own
// office names are catalog entries, so one the book lacks is a title a package attests
// ("Emir", "Huey tlatoani").
function noteNames(collector, state, view) {
  const all = (map) => Object.values(map ?? {});
  for (const group of [state.people, state.families, state.religions, state.cities, state.offices]) for (const item of all(group)) collector.name(item.name);
  collector.name(state.realm.name);
  for (const realm of state.foreignRealms ?? []) {
    for (const value of [realm.name, realm.seatName, realm.faith?.name]) collector.name(value);
    for (const person of all(realm.people)) collector.name(person.name);
  }
  for (const tribe of state.tribes ?? []) collector.name(tribe.name);
  for (const host of state.externalHosts ?? []) collector.name(host.name);
  for (const member of view?.staff ?? []) collector.name(member.name);
  for (const person of view?.people ?? []) collector.name(person.nickname);
}

// ---- the native book and the judgement ----

export function loadNativeBook({ langDir = LANG } = {}) {
  const pack = mergeNativePack({
    code: readJson(path.join(langDir, "en.json")),
    packages: readJson(path.join(langDir, "packages-en.json")),
    historical: readJson(path.join(langDir, "historical-en.json")),
  });
  const book = createPhraseBook(bookOptions("en"));
  book.setAll(pack);
  return { book, pack };
}

const WORD = /[\p{L}\p{M}]+/gu;
// The Swedish sides the book puts into other words, and every word its English uses.
export function vocabularyOf(pack) {
  const swedish = new Set();
  const english = new Set();
  for (const [source, translated] of Object.entries(pack)) {
    if (!isPatternKey(source) && source !== translated) swedish.add(source);
    for (const word of translated.match(WORD) ?? []) english.add(word.toLowerCase());
  }
  return { swedish, english };
}

const RUN_EDGE = /^[^\p{L}\p{N}]+|(?:[’']s)?[^\p{L}\p{N}]*$/gu;
const RUN_WORDS = 5;
const capital = (text) => text[0].toUpperCase() + text.slice(1);

// A run of whole words of `text` that is itself a Swedish side of the book, or null. A
// reading that still holds one was put together around a value the pattern left alone
// ("Charles asked Karl den yngre for support"). A single word that English also uses
// ("gift", "son") is no evidence.
export function swedishRun(text, { swedish, english }) {
  const tokens = text.split(/\s+/).filter(Boolean);
  for (let size = Math.min(RUN_WORDS, tokens.length); size >= 1; size -= 1) {
    for (let at = 0; at + size <= tokens.length; at += 1) {
      const run = tokens.slice(at, at + size).join(" ").replace(RUN_EDGE, "");
      if (!run || (size === 1 && english.has(run.toLowerCase()))) continue;
      if (swedish.has(run) || swedish.has(capital(run))) return run;
    }
  }
  return null;
}

// The class of one string and, for a reading, the reading itself.
export function judge(text, { book, vocabulary, names, fixtures }) {
  const reading = book.translate(text);
  if (reading == null) {
    if (names.has(text) && !looksSwedish(text) && !swedishRun(text, vocabulary)) return { class: "name" };
    return { class: fixtures.has(text) ? "fixture" : "untranslated" };
  }
  if (reading === text) return { class: "name" };
  const left = looksSwedish(reading) ? "(reads as Swedish)" : swedishRun(reading, vocabulary);
  return left ? { class: "partial", reading, left } : { class: "translated" };
}

// ---- the campaigns ----

const scenarioOf = (name) => readJson(path.join(ROOT, "server/seed/historical", name, "scenario.json")).data;

// Every start the game ships: each court of each package in both modes, then Hadara.
export function listCampaigns() {
  const campaigns = [];
  for (const name of PACKAGES) {
    const data = scenarioOf(name);
    for (const polityId of Object.keys(data.world.historicalScenario.courtSeeds)) {
      for (const mode of MODES) campaigns.push({ id: `${name}/${polityId}/${mode}`, package: name, polityId, mode });
    }
  }
  for (const mode of MODES) campaigns.push({ id: `hadara/${mode}`, package: null, polityId: "hadara", mode });
  return campaigns;
}

function startCampaign(campaign, seed) {
  if (!campaign.package) return createCharacterSystem({ mode: campaign.mode, seed });
  const data = scenarioOf(campaign.package);
  return createHistoricalCharacterSystem({ historicalScenario: data.world.historicalScenario, date: data.game.startDate, polityId: campaign.polityId, mode: campaign.mode, seed });
}

// ---- one command, with everything it writes collected ----

function order(turn, type, payload, origin, state = turn.state) {
  const command = { id: `sweep:${turn.year}:${++turn.commands}`, expectedRevision: state.revision, type, payload, ...(origin ? { origin } : {}) };
  const result = executeCharacterCommand(state, command);
  if (result.error) turn.collector.add(result.error, turn.where, `refusal.${type}`);
  turn.collector.walk(result.events, turn.where, `events.${type}`);
  if (result.ok && state === turn.state) turn.state = result.state;
  return result.ok;
}

function observe(turn) {
  const view = getCharacterPresentation(turn.state);
  noteNames(turn.collector, turn.state, view);
  turn.collector.walk(view, turn.where, "presentation");
  for (const part of ["log", "stories", "memories"]) turn.collector.walk(turn.state[part], turn.where, `state.${part}`);
  return view;
}

// ---- the year ----

// Every fourth story is left to lapse; the others are answered, the first choice first
// under an even seed and the last first under an odd one, then on through the choices.
function answerStories(turn, view) {
  for (const story of view.stories) {
    if (story.status !== "open" || !story.choices?.length) continue;
    const closed = story.choices.find((choice) => choice.disabledReason);
    if (closed) order(turn, "resolve_story", { storyId: story.id, choiceId: closed.id });
    const open = story.choices.filter((choice) => !choice.disabledReason);
    const step = turn.answered++;
    if (!open.length || step % 4 === 3) continue;
    const index = turn.variant % 2 === 0 ? step % open.length : open.length - 1 - (step % open.length);
    order(turn, "resolve_story", { storyId: story.id, choiceId: open[index].id });
  }
}

const optionsOf = (field) => (field?.options ?? []).filter((option) => option.value !== "");

function commandPayload(turn, entry) {
  const payload = {};
  for (const field of entry.fields ?? []) {
    const options = optionsOf(field);
    if (field.type === "select" && options.length) payload[field.key] = choose(turn, options).value;
  }
  return payload;
}

const SILVER_STEPS = Object.freeze([0, 0, 10, 25]);

// A contested action with its means. A secret or a grip only works against the person it
// is about, so the target follows the leverage when one is chosen.
function contestedIntent(turn, entry, actorId) {
  const field = (key) => entry.fields.find((item) => item.key === key);
  const targets = optionsOf(field("targetId"));
  if (!targets.length || !actorId) return null;
  const roles = optionsOf(field("agentRoles")).map((option) => option.value);
  const means = { silver: choose(turn, SILVER_STEPS), agentRoles: roles.slice(0, mix(turn.seed, ++turn.draws) % 3) };
  let targetId = choose(turn, targets).value;
  for (const key of ["secretId", "hookId", "topic"]) {
    const options = optionsOf(field(key));
    if (!options.length) continue;
    means[key] = choose(turn, options).value;
    if (key === "secretId") targetId = turn.state.secrets.find((secret) => secret.id === means[key])?.subjectId ?? targetId;
    if (key === "hookId") targetId = turn.state.hooks.find((hook) => hook.id === means[key])?.targetId ?? targetId;
  }
  return { actionId: entry.catalogId, actorId, targetIds: [targetId], means };
}

function runEntry(turn, entry, view) {
  if (entry.mode !== "contested") return order(turn, entry.catalogId, commandPayload(turn, entry));
  const intent = contestedIntent(turn, entry, view.representative?.id);
  if (!intent) return false;
  turn.collector.walk(estimateCharacterAction(turn.state, intent), turn.where, `estimate.${entry.catalogId}`);
  return order(turn, "attempt_action", intent);
}

// Actions that end or hand over what the campaign follows wait for the last third.
const LATE_ACTIONS = new Set(["abdicate", "recognize_claim", "banish", "sell_estate"]);
const ATTEMPTS_PER_YEAR = 10;

// The open actions tried least come first, so each type is run at least once when the
// campaign is long enough.
function actYear(turn, view) {
  const rank = (entry) => (turn.done.get(entry.catalogId) ?? 0) * 1000 + (turn.tried.get(entry.catalogId) ?? 0);
  const late = turn.year >= Math.floor(turn.years * 2 / 3);
  const queue = view.catalog.filter((entry) => !entry.disabledReason && (late || !LATE_ACTIONS.has(entry.catalogId))).sort((a, b) => rank(a) - rank(b));
  for (const entry of queue.slice(0, ATTEMPTS_PER_YEAR)) {
    if (turn.state.actionPoints < 1 || turn.state.status.ended) break;
    const bump = (map) => map.set(entry.catalogId, (map.get(entry.catalogId) ?? 0) + 1);
    bump(turn.tried);
    if (runEntry(turn, entry, view)) bump(turn.done);
  }
}

const REQUEST_KINDS = Object.freeze(["support", "reveal_secret", "pledge"]);
const OFFERS = Object.freeze([0, 20, 40]);

function converseYear(turn, view) {
  if (!view.conversationTargets.length) return;
  const person = choose(turn, view.conversationTargets);
  const hook = view.ownHooks.find((item) => item.targetId === person.id);
  const memory = view.memories.find((item) => item.participants?.includes(person.id));
  const request = { personId: person.id, kind: REQUEST_KINDS[(turn.year + turn.variant) % REQUEST_KINDS.length], offerSilver: choose(turn, OFFERS),
    hookId: hook?.id ?? null, arguments: [{ kind: "offer" }, ...(memory ? [{ kind: "shared_memory", refId: memory.id }] : [])], argumentScore: 10 };
  turn.collector.walk(estimateConversation(turn.state, request), turn.where, "estimate.conversation");
  order(turn, "converse_request", request, "converse");
}

// An envoy asks for peace where there is a war and for reconciliation elsewhere; every
// third year it asks the wrong realm for peace, which the engine refuses.
function envoyYear(turn, view) {
  const realms = view.foreignRealms ?? [];
  if (!realms.length) return;
  const realm = realms.find((item) => item.war) ?? choose(turn, realms);
  const kind = realm.war || turn.year % 3 === 2 ? "peace" : "reconcile";
  const request = { realmId: realm.id, kind, offerSilver: choose(turn, OFFERS), arguments: [{ kind: "offer" }], argumentScore: 10 };
  turn.collector.walk(estimateEnvoyRequest(turn.state, request), turn.where, "estimate.envoy");
  order(turn, "envoy_request", request, "converse");
}

const NPC_ACTIONS = Object.freeze(["sway", "undermine", "poison", "investigate", "spread_rumor"]);
// What a model would write: English, as an English session gets it.
const MODEL_TEXT = Object.freeze({ reason: "The harvest failed along the river.", title: "A quiet word", narrative: "The gifts were taken with a smile." });

// What only the engine's own steps may send: an NPC's action, a change the model
// proposes for the realm and the narrative of a resolved action.
function gateYear(turn, view) {
  const ownFamily = view.representative?.familyId;
  const others = view.people.filter((person) => person.alive && person.age >= ADULT_AGE && person.familyId !== ownFamily && !person.imprisoned);
  const own = view.people.filter((person) => person.alive && person.age >= ADULT_AGE && person.familyId === ownFamily);
  if (others.length && own.length) {
    order(turn, "npc_intent", { actorId: choose(turn, others).id, actionId: NPC_ACTIONS[turn.year % NPC_ACTIONS.length], targetIds: [choose(turn, own).id] }, "gate");
  }
  if (turn.year % 6 === 1) order(turn, "realm_effect", { treasury: -10, legitimacy: turn.year % 4 === 1 ? 2 : -2, armyStrength: 3, reason: turn.collector.fixture(MODEL_TEXT.reason) }, "gate");
  const told = view.recentResolutions.find((item) => !item.refused && !item.narrative);
  if (told && turn.year % 2 === 0) {
    order(turn, "record_action_narrative", { resolutionId: told.id, title: turn.collector.fixture(MODEL_TEXT.title), narrative: turn.collector.fixture(MODEL_TEXT.narrative), adjustments: [] }, "narrate");
  }
}

// ---- refusals asked for on purpose ----

const MISSING = "sweep-missing";

// Every action against a copy of the state that cannot pay, and one with no orders left:
// the menu gives its reasons and the commands their refusals. The campaign is untouched.
function refusalsOnCopies(turn) {
  const broke = copy(turn.state);
  broke.realm.treasury = 0;
  for (const family of Object.values(broke.families)) family.treasury = 0;
  const spent = copy(turn.state);
  spent.actionPoints = 0;
  for (const [label, state] of [["broke", broke], ["spent", spent]]) {
    const view = getCharacterPresentation(state);
    turn.collector.walk(view.catalog, turn.where, `presentation.${label}.catalog`);
    for (const entry of view.catalog) {
      if (entry.mode !== "contested") { order(turn, entry.catalogId, commandPayload(turn, entry), undefined, state); continue; }
      const intent = contestedIntent(turn, entry, view.representative?.id);
      if (!intent) continue;
      turn.collector.walk(estimateCharacterAction(state, intent), turn.where, `estimate.${label}`);
      order(turn, "attempt_action", intent, undefined, state);
    }
  }
}

// Commands the engine must turn away whatever the state: a target that does not exist,
// an unknown type, a step the player may not take, an old revision.
function refusalsOnPurpose(turn, view) {
  for (const entry of view.catalog) {
    if (entry.mode === "contested") continue;
    const payload = Object.fromEntries((entry.fields ?? []).map((field) => [field.key, MISSING]));
    if (Object.keys(payload).length) order(turn, entry.catalogId, payload);
  }
  order(turn, "sweep_unknown", {});
  order(turn, "resolve_story", { storyId: MISSING, choiceId: MISSING });
  for (const type of ["realm_effect", "npc_intent", "record_action_narrative", "converse_request", "envoy_request"]) order(turn, type, {});
  order(turn, "realm_effect", { treasury: 500, reason: MODEL_TEXT.reason }, "gate");
  order(turn, "realm_effect", { treasury: 0, reason: MODEL_TEXT.reason }, "gate");
  order(turn, "realm_effect", { treasury: 5 }, "gate");
  order(turn, "record_action_narrative", { resolutionId: MISSING }, "narrate");
  const stale = executeCharacterCommand(turn.state, { id: `sweep:stale:${turn.year}`, expectedRevision: -1, type: "rest", payload: {} });
  turn.collector.add(stale.error, turn.where, "refusal.stale");
  turn.collector.add(executeCharacterCommand(turn.state, { id: "not a safe id", type: "rest" }).error, turn.where, "refusal.id");
  turn.collector.add(advanceCharacters(turn.state, "not-a-date").error, turn.where, "refusal.advance");
}

// Estimates the odds, the conversation and the envoy rules refuse. Pure calls.
function refusedEstimates(turn, view) {
  const actorId = view.representative?.id;
  const other = view.people.find((person) => person.alive && person.age >= ADULT_AGE && person.id !== actorId);
  const child = view.people.find((person) => person.alive && person.age < ADULT_AGE);
  if (!actorId || !other) return;
  const base = { actionId: "sway", actorId, targetIds: [other.id], means: {} };
  const intents = [null, { ...base, actionId: MISSING }, { ...base, actorId: MISSING }, { ...base, actorId: other.id }, { ...base, targetIds: [] },
    { ...base, targetIds: [MISSING] }, { ...base, targetIds: [actorId] }, { ...base, targetIds: [child?.id ?? MISSING] }, { ...base, actorId: child?.id ?? MISSING },
    { ...base, means: { silver: 61 } }, { ...base, means: { agentRoles: "spy" } }, { ...base, means: { agentRoles: [MISSING] } }, { ...base, means: { bribe: 1 } },
    { ...base, means: { agentRoles: ["spy", "spy"] } }, { ...base, means: { agentRoles: ["spy", "poisoner", "guard"] } }, { ...base, means: { topic: "plot" } },
    { ...base, actionId: "blackmail" }, { ...base, actionId: "blackmail", means: { secretId: MISSING } }, { ...base, actionId: "poison", means: { hookId: MISSING } },
    { ...base, actionId: "spread_rumor" }, { ...base, actionId: "spread_rumor", means: { topic: MISSING } }, { ...base, actionId: "imprison", targetIds: [actorId] },
    { ...base, actionId: "undermine", targetIds: [view.people.find((person) => person.alive && person.age >= ADULT_AGE && person.id !== actorId && person.familyId === view.representative.familyId)?.id ?? MISSING] }];
  for (const intent of intents) turn.collector.walk(estimateCharacterAction(turn.state, intent), turn.where, "estimate.refused");
  const talk = { personId: view.conversationTargets[0]?.id ?? other.id, kind: "support" };
  const talks = [null, { ...talk, kind: MISSING }, { ...talk, personId: 5 }, { ...talk, personId: MISSING }, { ...talk, personId: actorId }, { ...talk, offerSilver: -1 },
    { ...talk, offerSilver: 100000 }, { ...talk, argumentScore: 1.5 }, { ...talk, arguments: "x" }, { ...talk, hookId: MISSING }, { ...talk, hookId: 5 }];
  for (const request of talks) turn.collector.walk(estimateConversation(turn.state, request), turn.where, "estimate.refused");
  const envoy = { realmId: view.foreignRealms?.[0]?.id ?? MISSING, kind: "reconcile" };
  const envoys = [null, { ...envoy, kind: MISSING }, { ...envoy, realmId: MISSING }, { ...envoy, kind: "peace" }, { ...envoy, offerSilver: -1 }, { ...envoy, offerSilver: 61 },
    { ...envoy, offerSilver: 60 }, { ...envoy, argumentScore: -1 }, { ...envoy, arguments: [{ kind: MISSING }] }];
  for (const request of envoys) turn.collector.walk(estimateEnvoyRequest(turn.state, request), turn.where, "estimate.refused");
}

// ---- the host's part: a realm that ends ----

// The realms a household may flee to, as the host world would name them.
const hostCandidates = (turn) => {
  const realms = (turn.state.foreignRealms ?? []).slice(0, 3).map((realm) => ({ id: realm.id, name: realm.name, opinion: 20, refugeThreshold: 40, admissionCost: 20 }));
  if (realms.length) return realms;
  return [{ id: "sweep-host-a", name: turn.collector.fixture("Selun"), opinion: 30, refugeThreshold: 40, admissionCost: 20 },
    { id: "sweep-host-b", name: turn.collector.fixture("Marova"), opinion: -10, refugeThreshold: 70, admissionCost: 35 }];
};

// One campaign in four loses its realm five years before the end and its refuge three
// years later, so the exile's actions and the host transitions are read too.
function hostYear(turn) {
  if (turn.index % 4 !== 3 || !turn.state.realm.alive) {
    if (turn.index % 4 === 3 && turn.year === turn.years - 2) {
      const lost = reconcileExternalHosts(turn.state, { id: `sweep:hosts:${turn.year}`, date: turn.state.date, hostCandidates: hostCandidates(turn).slice(1) });
      turn.collector.walk(lost.events, turn.where, "events.hosts");
      if (lost.ok) turn.state = lost.state;
    }
    return;
  }
  if (turn.year !== turn.years - 5) return;
  const hosts = hostCandidates(turn);
  const accepted = turn.variant % 2 === 0;
  const ended = applyRealmDissolution(turn.state, { id: `sweep:dissolve:${turn.year}`, date: turn.state.date, hostCandidates: hosts, hostAccepted: accepted, hostPolityId: hosts[0].id,
    ...(accepted ? {} : { reason: turn.collector.fixture("The realm was divided among its neighbours.") }) });
  if (ended.error) turn.collector.add(ended.error, turn.where, "refusal.dissolution");
  turn.collector.walk(ended.events, turn.where, "events.dissolution");
  if (ended.ok) turn.state = ended.state;
}

// ---- a campaign and the whole sweep ----

// The refusals are asked for once in a campaign, since every command copies the whole
// state: in the first year under an even seed and halfway under an odd one.
const refusalYear = (turn) => (turn.variant % 2 === 0 ? 0 : Math.floor(turn.years / 2));

function playYear(turn) {
  turn.where = { campaign: turn.label, year: gameDateYear(turn.state.date) };
  const view = observe(turn);
  if (turn.year === refusalYear(turn)) { refusalsOnCopies(turn); refusalsOnPurpose(turn, view); refusedEstimates(turn, view); }
  answerStories(turn, view);
  actYear(turn, view);
  // One reading after the year's actions serves the three steps that follow: each is
  // refused, and collected, when an earlier one made its choice stale.
  const after = getCharacterPresentation(turn.state);
  converseYear(turn, after);
  envoyYear(turn, after);
  gateYear(turn, after);
  hostYear(turn);
  const next = advanceCharacters(turn.state, addGameMonths(turn.state.date, 12));
  if (next.error) turn.collector.add(next.error, turn.where, "refusal.advance");
  turn.collector.walk(next.events, turn.where, "events.advance");
  if (next.ok) turn.state = next.state;
}

export function playCampaign(campaign, { index, seed, variant, years }, collector) {
  const turn = { collector, label: `${campaign.id}#${seed}`, index, seed, variant, years, year: 0, state: startCampaign(campaign, seed),
    draws: 0, commands: 0, answered: 0, tried: new Map(), done: new Map(), where: null };
  for (; turn.year < years && !turn.state.status.ended; turn.year += 1) playYear(turn);
  turn.where = { campaign: turn.label, year: gameDateYear(turn.state.date) };
  observe(turn);
  return turn;
}

// ---- where a gap comes from ----

const SOURCE_WORD = /[\p{L}\p{M}]{4,}/gu;
const wordsOf = (text) => new Set((text.match(SOURCE_WORD) ?? []).map((word) => word.toLowerCase()));

// The lines of the engine and the entries of the catalog by the words they hold.
export function buildSourceIndex({ engineDir = ENGINE_DIR, langDir = LANG } = {}) {
  const lines = [];
  for (const file of fs.readdirSync(engineDir).filter((name) => name.endsWith(".js") && !name.endsWith(".test.js")).sort()) {
    const text = fs.readFileSync(path.join(engineDir, file), "utf8");
    text.split("\n").forEach((line, at) => lines.push({ where: `server/characters/${file}:${at + 1}`, words: wordsOf(line) }));
  }
  const entries = readJson(path.join(langDir, "catalog-sv.json")).entries.map((entry) => ({ where: entry, words: wordsOf(entry.replace(/\{\{[^}]*\}\}/g, " ")) }));
  const byWord = (items) => {
    const index = new Map();
    items.forEach((item, at) => { for (const word of item.words) { if (!index.has(word)) index.set(word, []); index.get(word).push(at); } });
    return index;
  };
  return { lines, entries, lineWords: byWord(lines), entryWords: byWord(entries) };
}

// The item that shares most words with the text; the rarest shared word narrows the search.
function nearest(text, items, index) {
  const words = [...wordsOf(text)].filter((word) => index.has(word)).sort((a, b) => index.get(a).length - index.get(b).length);
  let best = null;
  for (const word of words.slice(0, 3)) {
    for (const at of index.get(word)) {
      const shared = words.filter((other) => items[at].words.has(other)).length;
      const score = shared * 1000 - items[at].words.size;
      if (!best || score > best.score) best = { score, where: items[at].where, shared };
    }
  }
  return best;
}

export function guessSource(text, index) {
  const line = nearest(text, index.lines, index.lineWords);
  const entry = nearest(text, index.entries, index.entryWords);
  return { code: line?.where ?? null, catalogEntry: entry && entry.shared > 1 ? entry.where : null };
}

// ---- the report ----

export const readAllowList = (file = ALLOW_FILE) => readJson(file, []);

const CLASSES = Object.freeze(["translated", "name", "fixture", "partial", "untranslated"]);

// Judges every collected string and lists the gaps, most frequent first.
export function buildReport(collector, { book, pack }, { allow = [], sourceIndex = null, config = {} } = {}) {
  const context = { book, vocabulary: vocabularyOf(pack), names: collector.names, fixtures: collector.fixtures };
  const counts = Object.fromEntries(CLASSES.map((name) => [name, { strings: 0, occurrences: 0 }]));
  const allowed = new Map(allow.map((entry) => [entry.text, entry.reason]));
  const gaps = [];
  for (const [text, seen] of collector.strings) {
    const verdict = judge(text, context);
    counts[verdict.class].strings += 1;
    counts[verdict.class].occurrences += seen.count;
    if (verdict.class !== "partial" && verdict.class !== "untranslated") continue;
    gaps.push({ text, class: verdict.class, ...(verdict.reading ? { reading: verdict.reading, left: verdict.left } : {}), count: seen.count,
      example: { campaign: seen.campaign, year: seen.year, path: seen.path }, ...(allowed.has(text) ? { allowed: allowed.get(text) } : {}) });
  }
  gaps.sort((a, b) => b.count - a.count || (a.text < b.text ? -1 : 1));
  if (sourceIndex) for (const gap of gaps) gap.source = guessSource(gap.text, sourceIndex);
  const open = gaps.filter((gap) => !gap.allowed);
  const unused = allow.filter((entry) => !gaps.some((gap) => gap.text === entry.text)).map((entry) => entry.text);
  return { config, collected: { strings: collector.strings.size, occurrences: [...collector.strings.values()].reduce((sum, seen) => sum + seen.count, 0) },
    counts, gapsOutsideAllowList: open.length, allowListed: gaps.length - open.length, unusedAllowEntries: unused, gaps };
}

// Plays the campaigns and returns the collector. `campaigns` narrows the list (the test
// plays three); `seeds` is how many seeds each campaign is played under.
export function runSweep({ years = DEFAULTS.years, seeds = DEFAULTS.seeds, campaigns = listCampaigns() } = {}) {
  const collector = createCollector();
  campaigns.forEach((campaign, index) => {
    for (let variant = 0; variant < seeds; variant += 1) {
      playCampaign(campaign, { index, seed: SEEDS[variant] ?? 7919 * (variant + 1), variant, years }, collector);
    }
  });
  return collector;
}

const pad = (value, width) => String(value).padStart(width);

export function summaryLines(report, shown = 25) {
  const lines = [`Engine text sweep: ${report.config.campaigns} campaigns, ${report.config.years} years, ${report.config.seeds} seeds`,
    `${"class".padEnd(14)}${pad("strings", 9)}${pad("occurrences", 13)}`,
    ...CLASSES.map((name) => `${name.padEnd(14)}${pad(report.counts[name].strings, 9)}${pad(report.counts[name].occurrences, 13)}`),
    `${"collected".padEnd(14)}${pad(report.collected.strings, 9)}${pad(report.collected.occurrences, 13)}`,
    `gaps outside the allow-list: ${report.gapsOutsideAllowList} (allow-listed: ${report.allowListed})`];
  for (const gap of report.gaps.filter((item) => !item.allowed).slice(0, shown)) {
    lines.push(`  ${pad(gap.count, 6)}  ${gap.class.padEnd(12)} ${JSON.stringify(gap.text.slice(0, 140))}${gap.reading ? ` -> ${JSON.stringify(gap.reading.slice(0, 140))}` : ""}  [${gap.source?.code ?? gap.example.path}]`);
  }
  for (const text of report.unusedAllowEntries) lines.push(`  allow-list entry that names no gap: ${JSON.stringify(text)}`);
  return lines;
}

const flagValue = (args, name, fallback) => {
  const at = args.indexOf(name);
  return at >= 0 && args[at + 1] !== undefined ? args[at + 1] : fallback;
};

function main(args) {
  const years = Number(flagValue(args, "--years", DEFAULTS.years));
  const seeds = Number(flagValue(args, "--seeds", DEFAULTS.seeds));
  const only = flagValue(args, "--only", "");
  if (!Number.isInteger(years) || years < 1 || !Number.isInteger(seeds) || seeds < 1) throw new Error("--years and --seeds take a whole number of 1 or more.");
  const out = path.resolve(flagValue(args, "--out", path.join(os.tmpdir(), "attainder-engine-text-sweep.json")));
  if (!path.relative(ROOT, out).startsWith("..") && !path.isAbsolute(path.relative(ROOT, out))) throw new Error("--out must be a path outside the repository.");
  const campaigns = listCampaigns().filter((campaign) => campaign.id.includes(only));
  const started = process.hrtime.bigint();
  const collector = runSweep({ years, seeds, campaigns });
  const report = buildReport(collector, loadNativeBook(), { allow: readAllowList(), sourceIndex: buildSourceIndex(), config: { campaigns: campaigns.length, years, seeds } });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, serializeJson(report), "utf8");
  console.log(summaryLines(report).join("\n"));
  console.log(`report: ${out}`);
  // The run time goes to stderr: stdout is the same for two runs of one configuration.
  console.error(`run time: ${(Number(process.hrtime.bigint() - started) / 1e9).toFixed(1)} s`);
  if (args.includes("--check") && (report.gapsOutsideAllowList || report.unusedAllowEntries.length)) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
