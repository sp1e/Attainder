// The court over the map. Spec: docs/superpowers/specs/2026-11-15-court-shell-design.md, slice 1.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { figuresOf, flagsOf, mattersOf, threadOf } from "./courtShell.js";

const read = (name) => fs.readFileSync(new URL(name, import.meta.url), "utf8");
const person = (id, familyId, age, extra = {}) => ({ id, name: id, familyId, age, diedAt: null, ...extra });
const VIEW = {
  identity: { mode: "realm", familyId: "royal", realmName: "Karls rike" },
  ruler: { id: "karl" },
  people: [
    person("gisela", "royal", 22),
    person("karl", "royal", 59),
    person("ludvig", "royal", 24),
    person("odo", "house-1", 51, { imprisoned: true }),
    person("pippin", "royal", 26),
    person("karl-yngre", "royal", 30),
    person("ansgar", "house-2", 50),
    person("berta", "royal", 23),
    person("gone", "royal", 70, { diedAt: "0801-01-01" }),
  ],
  succession: { legalHeirId: "karl-yngre", candidates: [{ id: "karl-yngre" }, { id: "pippin" }, { id: "ludvig" }] },
  offices: [
    { id: "ruler", kind: "ruler", name: "Kejsare", holderId: "karl" },
    { id: "chancellor", kind: "chancellor", name: "Kansler", holderId: "ansgar" },
    { id: "general", kind: "general", name: "Överbefälhavare", holderId: null },
  ],
  stories: [
    { id: "s-late", title: "Lösen för Odo", status: "open", dueAt: "0803-12-25", actorId: "odo", targetId: "karl" },
    { id: "s-done", title: "Avgjort", status: "resolved", dueAt: "0803-01-01", actorId: "karl" },
    { id: "s-soon", title: "Duell", status: "open", dueAt: "0803-03-25", actorId: "karl-yngre", targetId: "ansgar" },
    { id: "s-away", title: "Krav", status: "pending", dueAt: "0803-06-01", actorId: "stranger", targetId: "karl" },
  ],
  economy: { treasury: 192.58, annualRevenue: -13.62, actionPoints: 4, legitimacy: 59, militaryReadiness: 36 },
  court: { prestige: 10 },
};
const ids = (members) => members.map((member) => member.person.id);

test("the thread is the ruling house in the order of succession, then the court houses, without the dead", () => {
  const thread = threadOf(VIEW);
  assert.deepEqual(ids(thread.house), ["karl", "karl-yngre", "pippin", "ludvig", "berta", "gisela"], "ruler, the candidates in order, the rest by age");
  assert.deepEqual(ids(thread.others), ["odo", "ansgar"], "the other houses in the court's own order");
  assert.equal([...thread.house, ...thread.others].some((member) => member.person.id === "gone"), false);
});

test("a medallion's role is the ruler's office, the heir, the prisoner, or the office held", () => {
  const thread = threadOf(VIEW);
  const of = (id) => [...thread.house, ...thread.others].find((member) => member.person.id === id);
  assert.deepEqual([of("karl").role, of("karl").ruler, of("karl").heir], ["Kejsare", true, false]);
  assert.deepEqual([of("karl-yngre").role, of("karl-yngre").heir], ["Arvinge", true]);
  assert.deepEqual([of("odo").role, of("odo").held], ["Fånge", true]);
  assert.equal(of("ansgar").role, "Kansler");
  assert.equal(of("pippin").role, "");
});

test("in family mode the thread's house is the family the player follows", () => {
  const view = { ...VIEW, identity: { mode: "family", familyId: "house-2" } };
  const thread = threadOf(view);
  assert.deepEqual(ids(thread.house), ["ansgar"]);
  assert.equal(ids(thread.others).includes("karl"), true, "the ruler is at court, in another house");
  assert.equal(thread.others.find((member) => member.person.id === "karl").ruler, true);
});

test("in realm mode the house is the ruler's, whatever family the campaign began with", () => {
  // The throne has passed to house-2: the campaign's first family is no longer the ruling house.
  const view = { ...VIEW, ruler: { id: "ansgar" }, succession: { legalHeirId: null, candidates: [] } };
  const thread = threadOf(view);
  assert.deepEqual(ids(thread.house), ["ansgar"]);
  assert.equal(thread.house[0].ruler, true);
  assert.equal(ids(thread.others).includes("karl"), true);
});

test("the matters are the open ones, the nearest deadline first, with the faces the court has", () => {
  const matters = mattersOf(VIEW);
  assert.deepEqual(matters.map((matter) => matter.id), ["s-soon", "s-away", "s-late"]);
  assert.deepEqual(matters[0].people.map((entry) => entry.id), ["karl-yngre", "ansgar"]);
  assert.deepEqual(matters[1].people.map((entry) => entry.id), ["karl"], "a stranger has no face at court");
  assert.deepEqual([matters[0].title, matters[0].dueAt], ["Duell", "0803-03-25"]);
  assert.deepEqual(mattersOf({ ...VIEW, stories: { a: VIEW.stories[0] } }).map((matter) => matter.id), ["s-late"], "stories may be an object");
  const undated = { id: "s-open", title: "Utan frist", status: "open", actorId: "karl" };
  assert.deepEqual(mattersOf({ ...VIEW, stories: [undated, ...VIEW.stories] }).map((matter) => matter.id), ["s-soon", "s-away", "s-late", "s-open"], "a matter without a deadline comes last");
});

test("a person's count is the open matters the person is part of", () => {
  const flags = flagsOf(mattersOf(VIEW));
  assert.deepEqual([flags.get("karl"), flags.get("karl-yngre"), flags.get("ansgar"), flags.get("odo"), flags.get("pippin")], [2, 1, 1, 1, undefined]);
});

test("the six figures are the panel's, with its labels", () => {
  const figures = figuresOf(VIEW);
  assert.deepEqual(figures.map((figure) => [figure.key, figure.label]), [
    ["treasury", "Statskassa"], ["revenue", "Årsintäkt"], ["orders", "Handlingsutrymme"],
    ["legitimacy", "Legitimitet"], ["prestige", "Prestige"], ["readiness", "Militär beredskap"],
  ]);
  const by = Object.fromEntries(figures.map((figure) => [figure.key, figure]));
  assert.deepEqual([by.treasury.value, by.treasury.unit], [192.58, "silver"]);
  assert.deepEqual([by.revenue.value, by.revenue.negative, by.revenue.signed], [-13.62, true, true]);
  assert.deepEqual([by.orders.value, by.legitimacy.value, by.legitimacy.unit, by.prestige.value], [4, 59, "/ 100", 10]);
  assert.deepEqual([by.readiness.value, by.readiness.unit], [36, "%"]);
  assert.equal(figuresOf({ ...VIEW, economy: { ...VIEW.economy, annualRevenue: 7 } }).find((figure) => figure.key === "revenue").negative, false);
});

test("a view without its parts gives an empty shell, and no error", () => {
  assert.deepEqual(threadOf(null), { house: [], others: [] });
  assert.deepEqual(threadOf({}), { house: [], others: [] });
  assert.deepEqual(mattersOf(null), []);
  assert.deepEqual(figuresOf(null), []);
  assert.deepEqual([...flagsOf([])], []);
});

test("the shell is drawn over the map and everything in it opens the panel at a place", () => {
  const main = read("../GameUI/main.jsx"), shell = read("./CourtShell.jsx"), panel = read("./CharactersPanel.jsx"), reader = read("../../runtime/useCourtView.js");
  assert.match(main, /const LazyCourtShell = lazy\(\(\) => import\("\.\.\/Characters\/CourtShell\.jsx"\)\);/);
  assert.match(main, /request=\{charactersRequest\.gameId === activeGame\?\.id \? charactersRequest : null\}/, "a place asked for in one campaign is not opened in another");
  assert.match(main, /!isCharactersOpen && !activeBottomPanel && !isMobile && <Suspense fallback=\{null\}><LazyCourtShell/);
  assert.match(reader, /UNSEEN_EVENTS_CHANGED/, "the court is read again when the player has read a turn's events");
  assert.match(panel, /previousFocus\?\.isConnected/, "focus has somewhere to return to when the shell's button is gone");
  assert.match(main, /event\?\.detail/);
  assert.match(panel, /request\.seq === handledRequest\.current\) return;/);
  assert.match(panel, /if \(REQUEST_TABS\.has\(request\.tab\)\) setTab\(request\.tab\);/);
  assert.match(shell, /new CustomEvent\("oh:open-characters", \{ detail \}\)/);
  for (const place of ['tab: "people", personId', 'tab: "decisions"', 'tab: "council"']) assert.ok(shell.includes(place), place);
  assert.match(shell, /useCourtView\(activeGameId\)/);
  assert.match(read("../Map/SeatRulers.jsx"), /useCourtView\(activeGameId\)/, "the seat medallions share the read");
  assert.match(reader, /await import\("\.\/characterRuntime\.js"\)/);
  assert.match(reader, /if \(!hasCourt \|\| transactionPending\) return undefined;/, "the reader never starts a recovery");
  for (const text of ["Kräver dig", "Hovhusen", "Inget kräver dig just nu."]) assert.ok(shell.includes(text), text);
  assert.match(shell, /className="court-shell" data-native-text/, "the whole native book applies in the shell");
});
