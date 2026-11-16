// The court over the map, slice 5: the areas of the left panel and the period accent.
// Spec: docs/superpowers/specs/2026-11-15-court-shell-design.md, "Slice 5: the areas and the period accent".
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { AREAS, chronicleOf, epochOf, housesOf, intrigueOf, peopleOf, seatsOf } from "./courtShell.js";

const read = (name) => fs.readFileSync(new URL(name, import.meta.url), "utf8");
const person = (id, familyId, age, extra = {}) => ({ id, name: id, familyId, age, diedAt: null, ...extra });
const VIEW = {
  identity: { mode: "realm", familyId: "royal" },
  ruler: { id: "karl" },
  representative: { id: "karl" },
  people: [
    person("gisela", "royal", 22), person("karl", "royal", 59), person("karl-yngre", "royal", 30), person("pippin", "royal", 26),
    person("odo", "house-1", 51, { imprisoned: true }), person("ansgar", "house-2", 50), person("gone", "house-3", 70, { diedAt: "0801-01-01" }),
  ],
  succession: { legalHeirId: "karl-yngre", candidates: [{ id: "karl-yngre" }, { id: "gone" }, { id: "pippin" }, { id: "gisela" }, { id: "odo" }, { id: "ansgar" }] },
  offices: [
    { id: "chancellor", kind: "chancellor", name: "Kansler", holderId: "ansgar", holderName: "ansgar" },
    { id: "ruler", kind: "ruler", name: "Kejsare", holderId: "karl", holderName: "karl" },
    { id: "general", kind: "general", name: "Överbefälhavare", holderId: null, holderName: "Vakant" },
  ],
  families: [
    { id: "house-1", name: "Hovhus 1", headId: "odo", headName: "odo", support: 12, treasury: 80, influence: 20 },
    { id: "royal", name: "Karls hus", headId: "karl", headName: "karl", support: 100, treasury: 310.5, influence: 90 },
    { id: "house-3", name: "Hovhus 3", headId: "gone", headName: "gone", treasury: 5, influence: 1, exiled: true },
    { id: "house-2", name: "Hovhus 2", headId: null, support: 47, treasury: 133, influence: 45 },
  ],
  schemes: [{ id: "scheme-1", actionLabel: "Sprid ett rykte", targetNames: ["odo", "ansgar"], dueAt: "0803-06-01", actorName: "karl" }],
  prisoners: [{ id: "prisoner-28", personId: "odo", name: "odo", familyName: "Hovhus 1", since: "0801-12-25", ransom: 40 }],
  ownHooks: [{ id: "hook-20", targetId: "gisela", targetName: "gisela", strength: "weak", strengthLabel: "svagt" }],
  knownSecrets: [{ id: "secret-12", type: "affair", typeLabel: "Otrohet", subjectId: "gisela", subjectName: "gisela", evidenceLabel: "starkt", exposed: false }],
  rumors: [],
  log: [
    { id: "event-1", date: "0800-12-25", type: "foundation", title: "Hovet tar form", description: "Början." },
    { id: "event-3", date: "0802-03-01", type: "gift", title: "En gåva", description: "Till Gisela." },
    { id: "event-2", date: "0801-12-25", type: "rest", title: "Vila", description: "Stress −30." },
    { id: "event-4", date: "0802-12-25", type: "duel", title: "En utmaning" },
  ],
  historicalOrigin: { contentId: "charlemagne-800" },
};

test("the six areas are the panel's, each with the tab it opens", () => {
  assert.deepEqual(AREAS.map((area) => [area.key, area.tab]), [
    ["needs", "decisions"], ["people", "people"], ["houses", "families"], ["seats", "offices"], ["intrigue", "intrigue"], ["chronicle", "chronicle"],
  ]);
});

test("the people are everyone alive at court in the thread's order, the player's representative marked", () => {
  const people = peopleOf(VIEW);
  assert.deepEqual(people.map((row) => row.person.id), ["karl", "karl-yngre", "pippin", "gisela", "odo", "ansgar"]);
  assert.deepEqual(people.filter((row) => row.self).map((row) => row.person.id), ["karl"]);
  assert.deepEqual(people.map((row) => row.role), ["Kejsare", "Arvinge", "", "", "Fånge", "Kansler"]);
  assert.deepEqual(peopleOf(null), []);
});

test("the houses stand by support, the strongest first, with a head only where one is at court", () => {
  const houses = housesOf(VIEW);
  assert.deepEqual(houses.map((house) => house.id), ["royal", "house-2", "house-1", "house-3"], "a house without a number comes last");
  assert.deepEqual(houses[0], { id: "royal", name: "Karls hus", headId: "karl", headName: "karl", support: 100, treasury: 310.5, influence: 90, own: true, exiled: false });
  assert.deepEqual([houses[1].headId, houses[1].headName], [null, ""], "a house without a head");
  assert.deepEqual([houses[3].headId, houses[3].headName, houses[3].support, houses[3].exiled], [null, "gone", null, true], "a dead head is named and cannot be selected");
  assert.deepEqual(housesOf({ families: { a: VIEW.families[0] } }).map((house) => house.id), ["house-1"], "families may be an object");
  assert.deepEqual(housesOf(null), []);
  const unnamed = housesOf({ ...VIEW, families: [{ id: "royal", name: "Karls hus", headId: "karl" }] })[0];
  assert.deepEqual([unnamed.headId, unnamed.headName], ["karl", "karl"], "a head at court is named by the court when the house does not name him");
});

test("the line of succession is the heir and the living candidates after, five at most, and the offices follow", () => {
  const { line, offices } = seatsOf(VIEW);
  assert.deepEqual(line, [
    { id: "karl-yngre", name: "karl-yngre", heir: true }, { id: "pippin", name: "pippin", heir: false }, { id: "gisela", name: "gisela", heir: false },
    { id: "odo", name: "odo", heir: false }, { id: "ansgar", name: "ansgar", heir: false },
  ], "the dead are not in the line");
  assert.deepEqual(seatsOf({ ...VIEW, succession: { legalHeirId: "karl-yngre", candidates: [{ id: "karl" }, { id: "karl-yngre" }] } }).line.map((entry) => entry.id), ["karl-yngre"], "the ruler is not in the line");
  assert.deepEqual(offices, [
    { id: "ruler", name: "Kejsare", holderId: "karl", holderName: "karl" },
    { id: "chancellor", name: "Kansler", holderId: "ansgar", holderName: "ansgar" },
    { id: "general", name: "Överbefälhavare", holderId: null, holderName: "" },
  ], "the ruler's office first; a vacant office has nobody");
  const away = seatsOf({ ...VIEW, offices: [{ id: "priest", kind: "priest", name: "Präst", holderId: "stranger", holderName: "En främling" }] }).offices[0];
  assert.deepEqual([away.holderId, away.holderName], [null, "En främling"], "a holder who is not at court is named and cannot be selected");
  assert.deepEqual(seatsOf(null), { line: [], offices: [] });
  const unnamed = seatsOf({ ...VIEW, offices: [{ id: "chancellor", kind: "chancellor", name: "Kansler", holderId: "ansgar" }, null] }).offices;
  assert.deepEqual(unnamed, [{ id: "chancellor", name: "Kansler", holderId: "ansgar", holderName: "ansgar" }], "a holder at court is named by the court when the office does not name him");
  assert.deepEqual(seatsOf({ ...VIEW, succession: { legalHeirId: "pippin", candidates: [] } }).line, [{ id: "pippin", name: "pippin", heir: true }], "an heir outside the candidates still leads the line");
});

test("the intrigue is what the player's side knows and holds, and says when it is nothing", () => {
  const intrigue = intrigueOf(VIEW);
  assert.deepEqual(intrigue.schemes, [{ id: "scheme-1", actionLabel: "Sprid ett rykte", targetNames: ["odo", "ansgar"], dueAt: "0803-06-01" }]);
  assert.deepEqual(intrigue.prisoners, [{ id: "prisoner-28", personId: "odo", name: "odo", familyName: "Hovhus 1", since: "0801-12-25", ransom: 40 }]);
  assert.deepEqual(intrigue.hooks, [{ id: "hook-20", targetId: "gisela", targetName: "gisela", strengthLabel: "svagt" }]);
  assert.deepEqual(intrigue.secrets, [{ id: "secret-12", subjectId: "gisela", typeLabel: "Otrohet", subjectName: "gisela", evidenceLabel: "starkt", exposed: false }]);
  assert.deepEqual(intrigue.rumors, []);
  assert.equal(intrigue.empty, false);
  assert.equal(intrigueOf({}).empty, true);
  assert.equal(intrigueOf(null).empty, true);
  const holes = intrigueOf({ schemes: [null, { actionLabel: "Utan id" }], prisoners: [null], ownHooks: [undefined], knownSecrets: [null], rumors: [null] });
  assert.equal(holes.empty, true, "an entry that is nothing, or has no id, is left out");
  const away = intrigueOf({ ...VIEW, people: [], ownHooks: [{ id: "h", targetId: "gisela", targetName: "gisela", strength: "strong" }], prisoners: [{ id: "p", personId: "odo", name: "odo" }] });
  assert.deepEqual([away.hooks[0].targetId, away.hooks[0].strengthLabel, away.prisoners[0].personId], [null, "strong", null], "someone who is not at court cannot be selected");
  const rumor = intrigueOf({ rumors: [{ id: "r1", topicLabel: "Otrohet", subjectName: "Gisela", date: "0802-05-01", claimedActorName: "Odo", reliability: "låg" }] }).rumors[0];
  assert.deepEqual(rumor, { id: "r1", topicLabel: "Otrohet", subjectName: "Gisela", date: "0802-05-01", reliability: "låg" });
});

test("the chronicle is the year record, the latest first, under its years", () => {
  const years = chronicleOf(VIEW);
  assert.deepEqual(years.map((group) => [group.year, group.entries.map((entry) => entry.id)]), [[802, ["event-4", "event-3"]], [801, ["event-2"]], [800, ["event-1"]]]);
  assert.deepEqual(years[0].entries[0], { id: "event-4", date: "0802-12-25", title: "En utmaning", description: "", type: "duel" });
  const long = Array.from({ length: 70 }, (unused, index) => ({ id: `e${index}`, date: `08${String(10 + index).padStart(2, "0")}-01-01`, title: `År ${index}` }));
  const capped = chronicleOf({ log: long });
  assert.equal(capped.reduce((sum, group) => sum + group.entries.length, 0), 60, "the latest sixty");
  assert.equal(capped[0].entries[0].id, "e69");
  assert.deepEqual(chronicleOf({ log: { a: VIEW.log[0] } })[0].year, 800, "the log may be an object");
  assert.deepEqual(chronicleOf(null), []);
  const undated = chronicleOf({ log: [{ id: "odd", date: "", title: "Utan datum" }, { id: "late", date: "", createdAt: "0803-01-01", title: "Senare" }, ...VIEW.log, null] });
  assert.deepEqual(undated.map((group) => group.year), [803, 802, 801, 800, null], "an entry without a date comes last, and an empty date falls back to the day it was written");
  const crowded = chronicleOf({ log: [...Array.from({ length: 5 }, (unused, index) => ({ id: `odd${index}`, title: "Utan datum" })), ...long] });
  assert.equal(crowded.at(-1).year !== null && crowded[0].entries[0].id, "e69", "undated entries do not take the dated entries' places");
  assert.equal(chronicleOf({ log: [{ id: "bc", date: "-0044-03-15", title: "Idus" }] })[0].year, -44);
});

test("the accent follows the start", () => {
  assert.equal(epochOf(VIEW), "carolingian");
  assert.equal(epochOf({ historicalOrigin: { contentId: "egypt-3000bc" } }), "egypt");
  assert.equal(epochOf({ historicalOrigin: { contentId: "john-1200" } }), "angevin");
  assert.equal(epochOf({ historicalOrigin: { contentId: "world-1500" } }), "aztec");
  assert.equal(epochOf({}), "carolingian", "a start without its own accent takes the first");
  assert.equal(epochOf(null), "carolingian");
});

test("the left panel shows one area at a time and keeps it with its campaign", () => {
  const shell = read("./CourtShell.jsx"), areas = read("./CourtAreas.jsx");
  assert.match(shell, /remembered = \{ campaign: activeGameId, id: selectedId, matterId: openMatterId, area \}/);
  assert.match(shell, /data-court-epoch=\{epochOf\(view\)\}/);
  assert.match(shell, /open\(\{ tab: AREAS\.find\(\(entry\) => entry\.key === area\)\.tab \}\)/, "each area opens the panel at its own tab");
  assert.match(shell, /setArea\("needs"\)/, "a tick leads back to the matters");
  assert.match(areas, /aria-pressed=\{area === entry\.key\}/);
  for (const text of ["Kräver dig", "Personer", "Familjer", "Ämbeten & arv", "Intriger", "Krönikan"]) assert.ok(areas.includes(text), text);
  for (const text of ["Pågående intriger", "Fångar", "Grepp", "Hemligheter du känner till", "Rykten", "Vakant"]) assert.ok(areas.includes(text), text);
  assert.match(areas, /onSelect\(/, "a person's row selects, as a medallion does");
  assert.doesNotMatch(areas, /submitCharacterCommand|useCourtCommand/, "an area does not act in this slice");
  assert.match(shell, /const answerOpen = Boolean\(answer\) && area === "needs";/, "a matter that is not shown is not what Escape closes");
  assert.match(shell, /const openPerson = \(id\) => \{\s+if \(command\.busy \|\| id === selectedId\) return;/, "a name opens its person's card and never closes it");
  assert.match(shell, /<HousesArea houses=\{list\} updates=\{updates\} onSelect=\{openPerson\} \/>/);
  assert.match(shell, /matterToFocus\.current = id;/, "a tick's matter takes focus once its row is drawn");
  assert.match(shell, /needs && onMatter && command\.notice/, "an answer's notice stands over the matters, not over another area");
  assert.match(shell, /AREAS\.some\(\(entry\) => entry\.key === remembered\.area\)/, "an area the shell does not know is not kept");
});

test("the period accent reaches the panels' heads and the selection ring, and nothing else", () => {
  const css = read("./courtShell.css");
  for (const [epoch, accent, second] of [["egypt", "#0f5a63", "#1b7f86"], ["angevin", "#7a1e25", "#a2303a"], ["aztec", "#0d6b62", "#159182"]]) {
    assert.match(css, new RegExp(`\\[data-court-epoch="${epoch}"\\] \\{ --court-accent: ${accent}; --court-accent-2: ${second}; \\}`), epoch);
  }
  assert.match(css, /--court-accent: #5a2449;\s+--court-accent-2: #7c3765;/);
  assert.equal(css.match(/#5a2449/g).length, 1, "the purple is named once: every head reads the accent");
  assert.match(css, /\.court-person--selected \.court-person-face \{[^}]*var\(--court-accent-2\)/);
});
