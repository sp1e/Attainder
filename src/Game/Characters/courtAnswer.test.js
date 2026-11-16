// The court over the map, slice 3: answering a matter and acting from a person's card.
// Spec: docs/superpowers/specs/2026-11-15-court-shell-design.md, "Slice 3: answer and act in place".
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { actionsOf, answerOf, cardOf, commandNotice, decisionNotice } from "./courtShell.js";

const read = (name) => fs.readFileSync(new URL(name, import.meta.url), "utf8");
const person = (id, familyId, age, extra = {}) => ({ id, name: id, familyId, age, diedAt: null, ...extra });
const option = (value, label = value) => ({ value, label });
const RANSOM = {
  id: "story-44", type: "ransom_offer", status: "open", title: "Lösen för Odo", description: "Hovhus 1 erbjuder 40 silver.",
  actorId: "odo", targetId: "karl", dueAt: "0803-12-25", fallbackDescription: "Odo sitter kvar.",
  choices: [
    { id: "accept", label: "Ta emot lösen", description: "Odo friges.", cost: "0 silver", stress: "0", disabledReason: "" },
    { id: "refuse", label: "Avvisa erbjudandet", description: "Odo sitter kvar.", cost: "0 silver", stress: "4", disabledReason: "Statskassan räcker inte.", scope: "realm", actorName: null },
  ],
};
const CHAIN = {
  id: "chain-1", type: "event_chain", status: "pending", title: "Ett bud från gränsen", description: "Budet väntar.", chainTitle: "Gränsfejden", stepNumber: 2,
  triggerDescription: "Gränsen har varit orolig i två år.", deadlineText: "Utan svar räknas budet som avvisat.", fallbackDescription: "Avvisa budet.",
  previousChoices: [{ title: "Första budet", choice: "Vänta" }],
  choices: [
    { id: "ride", label: "Rid ut", description: "Du rider själv.", cost: "1 handling", stress: 6, scope: "realm", actorName: "Karl",
      odds: { chance: 62, modifiers: [{ label: "Befäl", value: 5 }] } },
    { id: "wait", label: "Vänta", description: "Inget händer.", cost: "0 silver", stress: 0, scope: "none", actorName: "Karl" },
  ],
};
const VIEW = {
  revision: 25,
  identity: { mode: "realm", familyId: "royal" },
  ruler: { id: "karl" },
  people: [person("karl", "royal", 59), person("karl-yngre", "royal", 30), person("berta", "royal", 23), person("odo", "house-1", 51, { imprisoned: true })],
  succession: { legalHeirId: "karl-yngre", candidates: [{ id: "karl-yngre" }] },
  offices: [{ id: "ruler", kind: "ruler", name: "Kejsare", holderId: "karl" }],
  stories: [RANSOM, CHAIN, { id: "done", status: "resolved", title: "Avgjort", choices: [] }],
  prisoners: [{ id: "prisoner-28", personId: "odo", name: "Odo" }],
  conversationTargets: [{ id: "karl-yngre" }, { id: "berta" }],
  actions: [
    { type: "rest", label: "Återhämta dig", description: "Vila.", cost: "10 silver", stress: "0", actorName: "Karl", disabledReason: "", fields: [] },
    { type: "gift", label: "Ge en personlig gåva", description: "Förbättra en riktad relation.", cost: "15 silver ur familjekassan · 1 handling", stress: "0", actorName: "Karl", disabledReason: "",
      fields: [{ key: "targetId", label: "Mottagare", options: [option("karl-yngre", "Karl den yngre"), option("odo", "Odo")] }] },
    { type: "appoint", label: "Utse en ämbetsinnehavare", description: "Fyll ett ämbete.", cost: "15 silver ur statskassan · 1 handling", stress: "0", actorName: "Karl", disabledReason: "",
      fields: [{ key: "officeId", label: "Ämbete", options: [option("general", "Överbefälhavare"), option("chancellor", "Kansler")] }, { key: "personId", label: "Kandidat", options: [option("karl"), option("karl-yngre"), option("odo")] }] },
    { type: "marry", label: "Förhandla om äktenskap", description: "Ett gifte.", cost: "20 silver", stress: "0", actorName: "Karl", disabledReason: "",
      fields: [{ key: "personId", label: "Familjemedlem", options: [option("karl"), option("karl-yngre")] }, { key: "partnerId", label: "Föreslagen partner", options: [option("karl"), option("karl-yngre"), option("odo")] }] },
    { type: "foreign_marriage", label: "Gifte med ett grannhus", description: "Ett gifte utomlands.", cost: "30 silver", stress: "0", actorName: "Karl", disabledReason: "Inget grannhus har en ogift person att erbjuda.",
      fields: [{ key: "personId", label: "Person", options: [option("karl-yngre")] }, { key: "partnerKey", label: "Partner", options: [] }] },
    { type: "adopt", label: "Adoptera en arvinge", description: "Ett barn.", cost: "25 silver", stress: "0", actorName: null, disabledReason: "",
      fields: [{ key: "childId", label: "Barn", options: [option("odo")] }, { key: "witnessId", label: "Vittne", options: [option("odo")] }] },
    { type: "release_prisoner", label: "Frige en fånge", description: "Fången släpps.", cost: "0 silver ur statskassan · 1 handling", stress: "0", actorName: "Karl", disabledReason: "",
      fields: [{ key: "prisonerId", label: "Fånge", options: [option("prisoner-28", "Odo · fånge sedan 0801-12-25")] }] },
  ],
};

test("an open matter's answer holds what the panel's decision card holds", () => {
  const answer = answerOf(VIEW, "story-44");
  assert.deepEqual({ ...answer, choices: undefined }, {
    id: "story-44", title: "Lösen för Odo", chainTitle: "", stepNumber: null, description: "Hovhus 1 erbjuder 40 silver.",
    triggerDescription: "", deadlineText: "", fallbackDescription: "Odo sitter kvar.", choices: undefined,
  });
  assert.deepEqual(answer.choices, [
    { id: "accept", label: "Ta emot lösen", description: "Odo friges.", actorName: undefined, cost: "0 silver", stress: "0", disabledReason: "", odds: null },
    { id: "refuse", label: "Avvisa erbjudandet", description: "Odo sitter kvar.", actorName: null, cost: "0 silver", stress: "4", disabledReason: "Statskassan räcker inte.", odds: null },
  ]);
});

test("a chain's step carries its chain, its background and the deadline's own sentence", () => {
  const answer = answerOf(VIEW, "chain-1");
  assert.equal(answer.chainTitle, "Gränsfejden");
  assert.equal(answer.stepNumber, 2);
  assert.equal(answer.triggerDescription, "Gränsen har varit orolig i två år.");
  assert.equal(answer.deadlineText, "Utan svar räknas budet som avvisat.");
  assert.equal(answer.fallbackDescription, "", "the deadline's own sentence replaces the fallback, as in the panel");
  const [ride, wait] = answer.choices;
  assert.equal(ride.description, "", "a choice with odds shows them in place of its description");
  assert.deepEqual(ride.odds, { chance: 62, modifiers: [{ label: "Befäl", value: 5 }] });
  assert.equal(ride.actorName, "Karl");
  assert.equal(wait.actorName, undefined, "a choice of no scope names nobody");
  assert.equal(answerOf({ ...VIEW, stories: [{ ...CHAIN, stepNumber: 0, chainTitle: undefined }] }, "chain-1").stepNumber, null);
  assert.equal(answerOf({ ...VIEW, stories: { a: CHAIN } }, "chain-1").id, "chain-1", "stories may be an object");
});

test("there is no answer for a matter that is not open", () => {
  assert.equal(answerOf(VIEW, "done"), null);
  assert.equal(answerOf(VIEW, "unknown"), null);
  assert.equal(answerOf(VIEW, null), null);
  assert.equal(answerOf(null, "story-44"), null);
  assert.deepEqual(answerOf({ stories: [{ id: "bare", status: "open" }] }, "bare").choices, []);
});

test("the notice after an answer is the panel's: the choice, and what came of it", () => {
  const events = [{ title: "Odo friges", importance: "major" }, { title: "Hovet viskar" }, { title: "Lösen för Odo" }];
  assert.equal(decisionNotice(RANSOM, "accept", events), "Ta emot lösen · Odo friges");
  assert.equal(decisionNotice(RANSOM, "accept", [{ title: "Lösen för Odo" }]), "Ta emot lösen");
  assert.equal(decisionNotice(RANSOM, "accept", [{ title: "Hovet viskar" }, { title: "Lösen för Odo" }, { title: "Senare" }]), "Ta emot lösen · Hovet viskar", "what follows the decision is not its outcome");
  assert.equal(decisionNotice(RANSOM, "gone", events), "");
  assert.equal(commandNotice([{ title: "A" }, { title: "B" }, { title: "C" }]), "B · C");
  assert.equal(commandNotice([]), "Beslutet har sparats i kampanjen.");
  assert.equal(commandNotice(undefined), "Beslutet har sparats i kampanjen.");
});

test("a card's actions are the panel's that name the person, with the person filled in", () => {
  const actions = actionsOf(VIEW, "karl-yngre");
  assert.deepEqual(actions.map((action) => action.type), ["gift", "appoint", "marry"]);
  const [gift, appoint, marry] = actions;
  assert.deepEqual(gift, {
    type: "gift", label: "Ge en personlig gåva", description: "Förbättra en riktad relation.", cost: "15 silver ur familjekassan · 1 handling",
    stress: "0", actorName: "Karl", field: "targetId", value: "karl-yngre", fields: [],
  });
  assert.equal(appoint.field, "personId");
  assert.deepEqual(appoint.fields, [{ key: "officeId", label: "Ämbete", options: [option("general", "Överbefälhavare"), option("chancellor", "Kansler")] }]);
  assert.equal(marry.field, "personId", "the first field that lists the person is the person's");
  assert.deepEqual(marry.fields[0].options.map((entry) => entry.value), ["karl", "odo"], "the person is not among the partners");
});

test("a card leaves out what cannot be done now, what names nobody and what lacks a choice", () => {
  const types = (id) => actionsOf(VIEW, id).map((action) => action.type);
  assert.ok(!types("karl-yngre").includes("foreign_marriage"), "an action with a reason against it stays in the panel");
  assert.ok(!types("karl").includes("rest"), "an action without a person is not a card's");
  assert.deepEqual(types("odo"), ["gift", "appoint", "marry", "release_prisoner"], "a prisoner is named through the prisoner's entry");
  assert.ok(!types("odo").includes("adopt"), "the other field has nobody left when the person is taken out");
  const release = actionsOf(VIEW, "odo").at(-1);
  assert.deepEqual([release.field, release.value], ["prisonerId", "prisoner-28"]);
  assert.deepEqual(types("stranger"), []);
  assert.deepEqual(actionsOf(VIEW, null), []);
  assert.deepEqual(actionsOf(null, "karl"), []);
  assert.equal(actionsOf({ ...VIEW, actions: { a: VIEW.actions[1] } }, "odo")[0].type, "gift", "actions may be an object");
});

test("a card knows whether its person can be talked to", () => {
  assert.equal(cardOf(VIEW, "karl-yngre").canTalk, true);
  assert.equal(cardOf(VIEW, "odo").canTalk, false);
  assert.equal(cardOf({ ...VIEW, conversationTargets: undefined }, "berta").canTalk, false);
});

test("a matter is answered in the list with the panel's own command", () => {
  const shell = read("./CourtShell.jsx"), matter = read("./CourtMatter.jsx"), hook = read("./useCourtCommand.js"), panel = read("./CharactersPanel.jsx");
  assert.match(hook, /await import\("\.\.\/\.\.\/runtime\/characterRuntime\.js"\)/, "the engine is loaded on demand, as the reader loads it");
  assert.match(hook, /submitCharacterCommand\(\{ type, payload, expectedRevision: revision, id: `ui-\$\{crypto\.randomUUID\(\)\}` \}\)/);
  assert.match(hook, /if \(lock\.current\) return undefined;/, "one command at a time");
  assert.match(hook, /playerText\(/, "an internal error is kept from the player");
  assert.match(shell, /useCourtCommand\(view\?\.revision\)/);
  assert.match(shell, /type: "resolve_story", payload: \{ storyId: [a-zA-Z.]+, choiceId \}/);
  assert.match(shell, /decisionNotice\(/);
  assert.match(shell, /role="status"/, "the notice is announced");
  assert.match(shell, /open\(\{ tab: AREAS\.find\(/, "the actions that name nobody are one press away");
  assert.match(matter, /aria-expanded=\{open\}/);
  assert.match(matter, /role="alert"/, "a refusal is announced");
  assert.match(matter, /disabled=\{busy \|\| Boolean\(choice\.disabledReason\)\}/);
  for (const text of ["Bakgrund: ", "Om du avstår till tidsgränsen: ", "Utförs av: ", "Ingen behörig aktör", "Chans att lyckas: ", "Vad påverkar chansen?"]) assert.ok(matter.includes(text), text);
  assert.match(panel, /import \{[^}]*\bdecisionNotice\b[^}]*\} from "\.\/courtShell\.js";/, "the panel and the shell share the notice");
  assert.doesNotMatch(panel, /const decisionNotice = /);
});

test("a card acts with the panel's actions, and a conversation opens in the panel", () => {
  const shell = read("./CourtShell.jsx"), card = read("./CourtPersonCard.jsx"), acts = read("./CourtCardActions.jsx"), main = read("../GameUI/main.jsx"), panel = read("./CharactersPanel.jsx");
  assert.match(shell, /actionsOf\(view, /);
  assert.match(shell, /payload: \{ \.\.\.values, \[action\.field\]: action\.value \}/, "the person's field is the card's, whatever the form holds");
  assert.match(acts, /aria-expanded=\{open\}/);
  assert.match(card, /id="court-card-name" tabIndex=\{-1\}/, "focus has a place that stays after an action");
  assert.match(acts, /<select /);
  assert.match(acts, /role="alert"/);
  assert.match(acts, /role="status"/);
  assert.match(card, /card\.canTalk &&/);
  assert.match(card, /detail: \{ tab: "people", personId: card\.person\.id, talk: true \}/);
  assert.match(main, /talk: Boolean\(place\.talk\)/);
  assert.match(panel, /request\.talk/);
  assert.ok(card.includes("Samtala"));
  assert.match(shell, />Handlingar<\/CourtCardActions>/, "the heading is written where the catalog's builder reads Swedish");
});

test("Escape closes what focus is in, and the open matter is kept with its campaign", () => {
  const shell = read("./CourtShell.jsx");
  assert.match(shell, /closest\?\.\("\.court-needs"\)/);
  assert.match(shell, /data-court-matter=|matterId/);
  assert.match(shell, /remembered = \{ campaign: activeGameId, id: selectedId, matterId: openMatterId, area \}/);
});

test("while a command is written the shell keeps its selection, and what has left the court leaves no state behind", () => {
  const shell = read("./CourtShell.jsx"), matter = read("./CourtMatter.jsx"), panel = read("./CharactersPanel.jsx");
  // The feedback of a command belongs to the person or the matter it was sent for: neither may change under it.
  for (const name of ["select", "toggleMatter", "toggleAct", "closeCard"]) {
    assert.match(shell, new RegExp(`const ${name} = \\([a-z]*\\) => \\{\\s+if \\(command\\.busy\\) return;`), name);
  }
  assert.match(shell, /if \(\(!cardOpen && !answerOpen && !reportOpen\) \|\| busy\) return undefined;/, "Escape closes nothing while a command is written");
  assert.match(shell, /aria-busy=\{command\.busy\}/);
  assert.match(shell, /if \(openAct && !acts\.some\(\(action\) => action\.type === openAct\)\) setOpenAct\(null\);/, "an action that left the card is not open when it comes back");
  assert.match(shell, /if \(view && openMatterId && !answer\) setOpenMatterId\(null\);/);
  assert.match(matter, /replace\(\/\[\^\\w-\]\/g, "_"\)/, "an id is one token, whatever the story's id holds");
  assert.match(panel, /if \(talkAsk && tab !== "people"\) setTalkAsk\(null\);/, "an ask that was never shown is forgotten with its tab");
});
