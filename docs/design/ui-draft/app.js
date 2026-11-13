// The draft's interface. Every name, number and choice comes from data/court-802.json, an export of a real
// campaign (Karls rike, 25 December AD 802). Choosing here changes this page only; no rule runs.
import { createMap, flyHome, flyTo, addPlaces, setRealmAccent } from "./map.js";

const $ = (id) => document.getElementById(id);
const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value == null) continue;
    if (key === "text") node.textContent = value; else if (key === "class") node.className = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value); else node.setAttribute(key, value === true ? "" : value);
  }
  for (const child of [].concat(children)) if (child) node.append(child);
  return node;
};
const sv = (value, digits = 1) => new Intl.NumberFormat("sv-SE", { maximumFractionDigits: digits }).format(value).replace("-", "−");
const MONTHS = ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"];
const day = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };

// The game shows stand-in faces today; the draft gives each member of this court one of the 24 it ships.
const FACES = { karl: "person-3-1", "karl-den-yngre": "person-3-3", "pippin-av-italien": "person-1-3", "ludvig-av-akvitanien": "person-0-3", rotrud: "person-3-2", berta: "person-1-2",
  gisela: "person-0-2", teoderada: "person-3-4", hiltrud: "person-1-4", ruodhaid: "person-0-4", "generated-courtier-1": "person-1-1", "generated-courtier-2": "person-0-1", "generated-courtier-3": "person-2-1" };
const RULER_FACES = { "byzantine-empire": "eirene-of-athens", "emirate-of-cordoba": "al-hakam-i", "kingdom-of-asturias": "alfonso-ii-asturias", "duchy-of-benevento": "grimoald-iii-benevento",
  "abbasid-caliphate": "harun-ar-rashid", "aghlabid-emirate": "ibrahim-ibn-al-aghlab" };
const face = (id) => `url(portraits/${FACES[id] || RULER_FACES[id] || "person-0-1"}.jpg)`;
const SKILLS = [["command", "Befäl"], ["stewardship", "Förvaltning"], ["diplomacy", "Diplomati"], ["learning", "Lärdom"], ["intrigue", "Intrig"], ["prowess", "Kamp"]];
const TABS = ["Överblick", "Personer", "Familjer", "Ämbeten & tronföljd", "Beslut", "Intriger", "Krönika"];
// Who a matter is about, for the faces on its card and the marks on the thread.
const ABOUT = { duel_challenge: ["karl-den-yngre", "generated-courtier-2"], family_demand: ["generated-courtier-2"], ransom_offer: ["generated-courtier-1"], character_event: ["teoderada"] };

const court = await (await fetch("data/court-802.json")).json();
const places = await (await fetch("data/places-800.json")).json();
const person = (id) => court.people.find((p) => p.id === id);
const state = { selected: court.heirId, open: null, decided: {}, history: [] };
const pending = () => court.stories.filter((s) => !state.decided[s.id]).sort((a, b) => a.due.localeCompare(b.due));
const soon = (iso) => iso < "0803-06-25";
const roleOf = (p) => p.id === court.rulerId ? p.roles[0] : p.id === court.heirId ? "Arvinge" : p.imprisoned ? "Fånge" : p.roles[0] || "";

function renderBar() {
  const e = court.economy;
  $("realm").textContent = court.realmName.replace(/ \(.+\)$/, "");
  $("when").textContent = `${day(court.date)} e.Kr. · ${court.mode === "family" ? "Följ familjen" : "Följ riket"}`;
  const spent = Object.values(state.decided).filter((c) => /handling/.test(c.cost)).length;
  const left = Math.max(0, e.actionPoints - spent);
  const pips = el("span", { class: "pips" }, Array.from({ length: e.actionPoints }, (_, i) => el("i", { class: i < left ? "" : "spent" })));
  const stat = (label, value, cls) => el("div", { class: "stat" }, [el("span", { text: label }), el("b", { class: cls }, value)]);
  $("stats").replaceChildren(
    stat("Skattkammare", [sv(e.treasury), el("small", { text: " silver" })]),
    stat("Årsintäkt", sv(e.annualRevenue), e.annualRevenue < 0 ? "down" : ""),
    stat("Handlingar i år", [pips, `${left} av ${e.actionPoints}`]),
    stat("Legitimitet", [String(e.legitimacy), el("small", { text: " / 100" })]),
    stat("Prestige", String(court.prestige)),
    stat("Beredskap", `${e.militaryReadiness} %`),
  );
  $("undo").disabled = !state.history.length;
}

function renderThread() {
  const flags = {};
  for (const story of pending()) for (const id of ABOUT[story.type] || []) flags[id] = (flags[id] || 0) + 1;
  const medallion = (p) => el("button", { class: `med${p.id === court.rulerId ? " ruler" : ""}${p.id === court.heirId ? " heir" : ""}${p.imprisoned ? " held" : ""}`, type: "button",
    "aria-pressed": String(state.selected === p.id), title: `${p.name}, ${p.age} år`, onclick: () => select(p.id) }, [
    el("span", { class: "face", style: `background-image:${face(p.id)}` }),
    flags[p.id] && el("span", { class: "flag", text: String(flags[p.id]), "aria-label": `${flags[p.id]} ärenden` }),
    el("span", { class: "who", text: p.name.replace(/ \(.+\)$/, "") }),
    roleOf(p) && el("span", { class: "role", text: roleOf(p) }),
  ]);
  const house = court.people.filter((p) => p.familyId === "royal-house");
  const others = court.people.filter((p) => p.familyId !== "royal-house");
  $("thread").replaceChildren(
    el("div", { class: "line", role: "group", "aria-label": `Karls hus, arvinge enligt ${court.lawLabel}: ${person(court.heirId).name}` }, house.map(medallion)),
    el("span", { class: "gap" }), el("span", { class: "caption", text: "Hovhusen" }),
    el("div", { class: "line", role: "group", "aria-label": "Hovhusen" }, others.map(medallion)),
  );
}

function renderMatters() {
  const open = pending();
  $("needs-count").textContent = open.length ? `${open.length} ärenden` : "allt avgjort";
  const active = state.open ?? open[0]?.id;
  const rows = court.stories.slice().sort((a, b) => a.due.localeCompare(b.due)).map((story) => {
    const done = state.decided[story.id];
    const faces = el("span", { class: "faces" }, (ABOUT[story.type] || []).map((id) => el("i", { style: `background-image:${face(id)}` })));
    const head = el("button", { type: "button", "aria-expanded": String(!done && active === story.id), onclick: () => { if (!done) { state.open = story.id; renderMatters(); } } }, [
      faces, el("h3", { text: story.title.replace(/ \(genererad\)| \(genererat\)/g, "") }),
      el("span", { class: `due${!done && soon(story.due) ? " soon" : ""}`, text: done ? `Avgjort: ${done.label}` : `Senast ${day(story.due)}` }),
    ]);
    const body = el("div", { class: "body" }, [
      el("p", { text: story.text }),
      ...story.choices.map((choice) => el("button", { class: "choice", type: "button", disabled: Boolean(choice.disabledReason), onclick: () => decide(story, choice) }, [
        el("b", { text: choice.label }), el("span", { text: choice.description }),
        el("em", { text: choice.disabledReason || [choice.cost !== "0 silver" && choice.cost, choice.stress !== "0" && `stress ${choice.stress}`].filter(Boolean).join(" · ") }),
      ])),
      el("button", { class: "link", type: "button", text: "Visa hovet på kartan", onclick: () => flyTo([6.1053, 50.7708], 5.6) }),
    ]);
    return el("li", { class: `matter${done ? " done" : ""}`, "open-card": !done && active === story.id }, [head, !done && body]);
  });
  $("matters").replaceChildren(...rows, ...(open.length ? [] : [el("li", { class: "clear", text: "Inget kräver dig just nu. Året kan gå vidare." })]));
  $("tabs").replaceChildren(...TABS.map((name, i) => el("button", { type: "button", "aria-current": i === 0 ? "page" : false }, [name, name === "Beslut" && open.length ? el("sup", { text: String(open.length) }) : null])));
  renderRuler();
}

function renderRuler() {
  const frac = (iso) => { const [, m, d] = iso.split("-").map(Number); return (m - 1 + (d - 1) / 30.5) / 12; };
  const groups = {};
  for (const story of pending()) (groups[story.due] ||= []).push(story.title.replace(/ \(genererad\)| \(genererat\)/g, ""));
  const ticks = Object.entries(groups).map(([due, titles]) => el("span", { class: `tick${soon(due) ? " soon" : ""}${frac(due) > 0.8 ? " end" : ""}`, style: `left:${(frac(due) * 100).toFixed(1)}%` },
    [el("b", { text: day(due).replace(/ \d+$/, "") }), el("br"), titles.length > 1 ? `${titles.length} ärenden går ut` : titles[0]]));
  $("ruler").replaceChildren(...ticks, el("div", { class: "months" }, ["jan 803", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"].map((m) => el("span", { text: m }))));
}

function renderCard() {
  const p = person(state.selected), realm = court.foreign.find((r) => r.id === state.selected);
  if (realm) {
    $("card").replaceChildren(
      el("div", { class: "head" }, [el("span", { class: "face", style: `background-image:${face(realm.id)}` }), el("h2", { text: realm.name }), el("p", { text: `Säte: ${realm.seat}` })]),
      el("div", { class: "inner scroll" }, [
        el("dl", { class: "facts" }, [["Härskare", `${realm.ruler}, ${realm.rulerAge} år`], ["Arvinge", realm.heir || "ingen känd"], ["Tro", realm.faith], ["Inställning till dig", sv(realm.opinion, 0)], ["Avstånd från Aachen", `${sv(realm.distanceKm, 0)} km`]]
          .flatMap(([k, v]) => [el("dt", { text: k }), el("dd", { text: v })])),
        el("div", { class: "acts" }, [el("button", { class: "btn", type: "button", text: "Sänd sändebud" }), el("button", { class: "btn", type: "button", text: "Visa på kartan", onclick: () => flyTo(places.cities.find((c) => c.polity === realm.id)?.at, 5.4) })]),
      ]));
    return;
  }
  const vacant = court.offices.filter((o) => !o.holderId);
  $("card").replaceChildren(
    el("div", { class: "head" }, [el("span", { class: "face", style: `background-image:${face(p.id)}` }), el("h2", { text: p.name.replace(/ \(genererad\)$/, "") }),
      el("p", { text: [`${p.age} år`, p.family.replace(/ \(genererat\)$/, ""), roleOf(p)].filter(Boolean).join(" · ") })]),
    el("div", { class: "inner scroll" }, [
      el("div", { class: "tags" }, [...new Set([p.origin, p.bornUncertain && "Födelsedatum osäkert", /genererad/.test(p.name) && "Genererad person", ...p.traits, p.archetype].filter(Boolean))].map((t) => el("span", { text: t }))),
      el("div", { class: "skills" }, SKILLS.map(([key, label]) => el("div", {}, [el("b", { text: String(p.skills[key]) }), el("span", { text: label })]))),
      el("dl", { class: "facts" }, [
        el("dt", { text: "Åsikt om dig" }), el("dd", { class: p.opinion < 0 ? "neg" : p.opinion > 0 ? "pos" : "", text: p.id === court.rulerId ? "det är du" : p.opinion > 0 ? `+${sv(p.opinion, 0)}` : sv(p.opinion, 0) }),
        el("dt", { text: "Stress" }), el("dd", {}, [`${p.stress} / 100`, el("div", { class: "meter" }, el("i", { style: `width:${p.stress}%` }))]),
        el("dt", { text: "Mål" }), el("dd", { text: p.goal || "inget uttalat" }),
        el("dt", { text: "Egen förmögenhet" }), el("dd", { text: `${p.wealth} silver` }),
      ]),
      el("div", { class: "acts" }, p.id === court.rulerId ? [el("button", { class: "btn", type: "button", text: "Sätt mål för regeringen" })]
        : [el("button", { class: "btn", type: "button", text: "Samtala" }), el("button", { class: "btn", type: "button", text: "Ge gåva" }), el("button", { class: "btn", type: "button", text: "Utnämn", disabled: p.imprisoned })]),
      el("section", {}, [el("h3", { text: `Rådet och ämbeten · ${vacant.length} vakanta` }),
        el("ul", { class: "seats" }, court.offices.filter((o) => o.kind !== "ruler").map((o) => el("li", {}, [el("span", { text: o.name.replace("Guvernör: ", "Guvernör i ") }),
          o.holderId ? el("span", { text: o.holderName.replace(/ \(genererad\)$/, "") }) : el("span", {}, [el("span", { class: "vacant", text: "vakant" }), el("button", { class: "btn", type: "button", text: "Utnämn" })])])))]),
    ]));
}

function decide(story, choice) {
  state.history.push(story.id);
  state.decided[story.id] = choice;
  state.open = null;
  renderAll();
}
function select(id) { state.selected = id; renderThread(); renderCard(); }
function renderAll() { renderBar(); renderThread(); renderMatters(); renderCard(); }

$("undo").addEventListener("click", () => { const id = state.history.pop(); if (id) delete state.decided[id]; renderAll(); });
$("next").addEventListener("click", () => { const n = pending().length; $("next").textContent = n ? `${n} ärenden väntar` : "Året vänder…"; setTimeout(() => { $("next").textContent = "Nästa år"; }, 1800); });
$("news").textContent = court.log[0].title;
$("news").addEventListener("click", () => flyTo(places.tribes.find((t) => t.id === "ad800-tribe-sorbs").at, 6));
$("realm").addEventListener("click", flyHome);
for (const button of document.querySelectorAll(".epoch button")) button.addEventListener("click", () => {
  document.documentElement.dataset.epoch = button.dataset.epoch;
  for (const other of document.querySelectorAll(".epoch button")) other.setAttribute("aria-pressed", String(other === button));
  setRealmAccent(getComputedStyle(document.documentElement).getPropertyValue("--realm").trim());
});

const map = createMap("map");
addPlaces(map, places, { court, pending: () => pending().length, onRealm: (id) => select(id), onCourt: () => { state.open = pending()[0]?.id ?? null; renderMatters(); } });
renderAll();
window.draft = { map, state };
