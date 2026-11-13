// The draft's interface. Every name, number and choice comes from data/court-802.json, an export of a real
// campaign (Karls rike, 25 December AD 802). Choosing here changes this page only; no rule runs.
import { createMap, flyHome, flyTo, addPlaces, setRealmAccent, setSeason } from "./map.js";

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
const signed = (value) => value > 0 ? `+${sv(value, 0)}` : sv(value, 0);
const MONTHS = ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"];
const day = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
const plain = (text) => String(text).replace(/ \((genererad|genererat)\)/g, "");

// The game shows stand-in faces today; the draft gives each member of this court one of the 24 it ships.
const FACES = { karl: "person-3-1", "karl-den-yngre": "person-3-3", "pippin-av-italien": "person-1-3", "ludvig-av-akvitanien": "person-0-3", rotrud: "person-3-2", berta: "person-1-2",
  gisela: "person-0-2", teoderada: "person-3-4", hiltrud: "person-1-4", ruodhaid: "person-0-4", "generated-courtier-1": "person-1-1", "generated-courtier-2": "person-0-1", "generated-courtier-3": "person-2-1" };
const RULER_FACES = { "byzantine-empire": "eirene-of-athens", "emirate-of-cordoba": "al-hakam-i", "kingdom-of-asturias": "alfonso-ii-asturias", "duchy-of-benevento": "grimoald-iii-benevento",
  "abbasid-caliphate": "harun-ar-rashid", "aghlabid-emirate": "ibrahim-ibn-al-aghlab" };
const face = (id) => `background-image:url(portraits/${FACES[id] || RULER_FACES[id] || "person-0-1"}.jpg)`;
const SKILLS = [["command", "Befäl"], ["stewardship", "Förvaltning"], ["diplomacy", "Diplomati"], ["learning", "Lärdom"], ["intrigue", "Intrig"], ["prowess", "Kamp"]];
// The seven areas of today's panel. Decisions live under the first: what needs the player is the overview.
const AREAS = [["needs", "Kräver dig"], ["people", "Personer"], ["houses", "Familjer"], ["offices", "Ämbeten & tronföljd"], ["intrigue", "Intriger"], ["annals", "Krönika"]];
const ABOUT = { duel_challenge: ["karl-den-yngre", "generated-courtier-2"], family_demand: ["generated-courtier-2"], ransom_offer: ["generated-courtier-1"], character_event: ["teoderada"] };

const court = await (await fetch("data/court-802.json")).json();
const places = await (await fetch("data/places-800.json")).json();
const person = (id) => court.people.find((p) => p.id === id);
const state = { selected: court.heirId, area: "needs", open: null, decided: {}, history: [], date: court.date, turning: false, listOpen: false, confirm: null, why: false };
// A matter whose deadline has passed is closed: in the game its stated fallback applies.
const expired = (story) => story.due <= state.date && state.date !== court.date;
const pending = () => court.stories.filter((s) => !state.decided[s.id] && !expired(s)).sort((a, b) => a.due.localeCompare(b.due));
const soon = (iso) => iso.slice(5) < "06-25" && iso.slice(0, 4) === String(Number(state.date.slice(0, 4)) + 1).padStart(4, "0");
const roleOf = (p) => p.id === court.rulerId ? p.roles[0] : p.id === court.heirId ? "Arvinge" : p.imprisoned ? "Fånge" : p.roles[0] || "";
const ordersLeft = () => Math.max(0, court.economy.actionPoints - Object.values(state.decided).filter((c) => /handling/.test(c.cost)).length);
const mini = (id) => el("i", { class: "mini", style: face(id) });

function renderBar() {
  const e = court.economy, left = ordersLeft();
  $("realm").textContent = court.realmName.replace(/ \(.+\)$/, "");
  if (!state.turning) $("when").textContent = `${day(state.date)} e.Kr. · ${court.mode === "family" ? "Följ familjen" : "Följ riket"}`;
  const pips = el("span", { class: "pips" }, Array.from({ length: e.actionPoints }, (_, i) => el("i", { class: i < left ? "" : "spent" })));
  const stat = (label, value, cls) => el("div", { class: "stat" }, [el("span", { text: label }), el("b", { class: cls }, value)]);
  const legitimacy = el("button", { class: "stat why", type: "button", "aria-expanded": String(state.why), onclick: () => { state.why = !state.why; renderBar(); } },
    [el("span", { text: "Legitimitet" }), el("b", {}, [String(e.legitimacy), el("small", { text: " / 100" })])]);
  $("stats").replaceChildren(...[
    stat("Skattkammare", [sv(e.treasury), el("small", { text: " silver" })]),
    stat("Årsintäkt", sv(e.annualRevenue), e.annualRevenue < 0 ? "down" : ""),
    stat("Handlingar i år", [pips, `${left} av ${e.actionPoints}`]),
    legitimacy, stat("Prestige", String(court.prestige)), stat("Beredskap", `${e.militaryReadiness} %`),
    state.why && el("div", { class: "pop", role: "dialog", "aria-label": "Vad legitimiteten vilar på" }, [el("h3", { text: "Legitimiteten vilar på" }),
      el("dl", { class: "facts" }, court.legitimacy.sources.flatMap((s) => [el("dt", { text: s.label }), el("dd", { class: s.value < 0 ? "neg" : "", text: signed(s.value) })])),
      el("p", { class: "fine", text: court.dreadLabel })]),
  ].filter(Boolean));
  $("undo").disabled = !state.history.length || state.turning;
  $("next").disabled = state.turning;
}

function renderThread() {
  const flags = {};
  for (const story of pending()) for (const id of ABOUT[story.type] || []) flags[id] = (flags[id] || 0) + 1;
  const medallion = (p) => el("button", { class: `med${p.id === court.rulerId ? " ruler" : ""}${p.id === court.heirId ? " heir" : ""}${p.imprisoned ? " held" : ""}`, type: "button",
    "aria-pressed": String(state.selected === p.id), title: `${p.name}, ${p.age} år`, onclick: () => select(p.id) }, [
    el("span", { class: "face", style: face(p.id) }),
    flags[p.id] && el("span", { class: "flag", text: String(flags[p.id]), "aria-label": `${flags[p.id]} ärenden` }),
    el("span", { class: "who", text: plain(p.name.replace(/ \(Karl den store\)/, "")) }),
    roleOf(p) && el("span", { class: "role", text: roleOf(p) }),
  ]);
  // The engine's own order of succession: the ruler, then each candidate in turn.
  const order = [court.rulerId, ...court.succession.candidates.map((c) => c.id)];
  const ruling = person(court.rulerId).familyId;
  const house = [...order.map(person).filter(Boolean), ...court.people.filter((p) => p.familyId === ruling && !order.includes(p.id))];
  const others = court.people.filter((p) => p.familyId !== ruling);
  $("thread").replaceChildren(
    el("div", { class: "line", role: "group", "aria-label": `Tronföljden enligt ${court.lawLabel}` }, house.map(medallion)),
    el("span", { class: "gap" }), el("span", { class: "caption", text: "Hovhusen" }),
    el("div", { class: "line", role: "group", "aria-label": "Hovhusen" }, others.map(medallion)),
  );
}

// Left panel: one area at a time, so the map is always in view.
function areaNeeds() {
  const open = pending(), active = state.open ?? open[0]?.id;
  const rows = court.stories.slice().sort((a, b) => a.due.localeCompare(b.due)).map((story) => {
    const lapsed = !state.decided[story.id] && expired(story), done = state.decided[story.id] || (lapsed ? { label: "" } : null);
    const head = el("button", { type: "button", "aria-expanded": String(!done && active === story.id), onclick: () => { if (!done) { state.open = story.id; renderPanel(); } } }, [
      el("span", { class: "faces" }, (ABOUT[story.type] || []).map(mini)), el("h3", { text: plain(story.title) }),
      el("span", { class: `due${!done && soon(story.due) ? " soon" : ""}`, text: lapsed ? `Fristen gick ut ${day(story.due)}; utan val gäller spelets fria alternativ` : done ? `Avgjort: ${done.label}` : `Senast ${day(story.due)}` }),
    ]);
    const body = el("div", { class: "body" }, [
      el("p", { text: story.text }),
      ...story.choices.map((choice) => el("button", { class: "choice", type: "button", disabled: Boolean(choice.disabledReason), onclick: () => decide(story, choice) }, [
        el("b", { text: choice.label }), el("span", { text: choice.description }),
        el("em", { text: choice.disabledReason || [choice.cost !== "0 silver" && choice.cost, choice.stress !== "0" && `stress ${choice.stress}`].filter(Boolean).join(" · ") }),
      ])),
      story.deadlineText && el("p", { class: "fine", text: story.deadlineText }),
    ]);
    return el("li", { class: `matter${done ? " done" : ""}`, "open-card": !done && active === story.id }, [head, !done && body]);
  });
  const actions = state.listOpen ? el("ul", { class: "actions" }, court.actions.map((a) => el("li", {}, el("button", { class: "choice", type: "button", disabled: Boolean(a.disabledReason) || !ordersLeft() },
    [el("b", { text: a.label }), el("span", { text: a.description }), el("em", { text: a.disabledReason || a.cost })])))) : null;
  return [
    el("ul", { class: "matters" }, [...rows, ...(open.length ? [] : [el("li", { class: "clear", text: "Inget kräver dig just nu. Året kan gå vidare." })])]),
    el("section", { class: "act" }, [
      el("h3", { text: `Handla själv · ${ordersLeft()} av ${court.economy.actionPoints} handlingar kvar` }),
      el("form", { class: "say", onsubmit: (event) => { event.preventDefault(); $("say-note").hidden = false; } }, [
        el("label", { class: "sr", for: "say", text: "Vad vill du göra?" }),
        el("input", { id: "say", type: "text", placeholder: "Jag försöker vinna Ansgars stöd med gåvor och smicker", autocomplete: "off" }),
        el("button", { class: "btn", type: "submit", text: "Väg oddsen" }),
      ]),
      el("p", { class: "fine", id: "say-note", hidden: true, text: "I spelet tolkar modellen meningen till en handling, och du ser oddsen innan något dras. Utkastet tolkar inget." }),
      el("button", { class: "link", type: "button", "aria-expanded": String(state.listOpen), text: state.listOpen ? "Dölj listan" : `Välj bland ${court.actions.length} handlingar`, onclick: () => { state.listOpen = !state.listOpen; renderPanel(); } }),
      actions,
    ]),
  ];
}

function areaPeople() {
  return [el("ul", { class: "rows" }, court.people.map((p) => el("li", {}, el("button", { type: "button", "aria-pressed": String(state.selected === p.id), onclick: () => select(p.id) }, [
    mini(p.id), el("span", {}, [el("b", { text: plain(p.name) }), el("small", { text: [`${p.age} år`, plain(p.family), roleOf(p)].filter(Boolean).join(" · ") })]),
    el("span", { class: p.opinion < 0 ? "neg" : p.id === court.rulerId ? "" : "pos", text: p.id === court.rulerId ? "du" : signed(p.opinion) }),
  ]))))];
}

function areaHouses() {
  return [el("ul", { class: "houses" }, court.families.slice().sort((a, b) => b.support - a.support).map((f) => el("li", {}, [
    el("div", { class: "top" }, [mini(f.headId), el("span", {}, [el("b", { text: plain(f.name) }), el("small", { text: `${plain(f.headName)} leder · ${f.members} ${f.members === 1 ? "person" : "personer"} · ${f.treasury} silver` })]),
      el("b", { class: f.support < 35 ? "neg big" : "big", text: String(f.support) })]),
    el("div", { class: "meter wide", title: "Politiskt stöd av 100" }, el("i", { style: `width:${f.support}%;background:${f.support < 35 ? "var(--minium)" : "var(--verdigris)"}` })),
    el("dl", { class: "facts small" }, f.supportReasons.filter((r) => r.value).flatMap((r) => [el("dt", { text: r.label }), el("dd", { class: r.value < 0 ? "neg" : "", text: signed(r.value) })])),
  ])))];
}

function areaOffices() {
  const f = court.succession.forecast;
  return [
    el("section", {}, [el("h3", { text: `Om ${f.actualRuler.name.replace(/ \(.+\)$/, "")} dör i dag` }),
      el("p", { class: "lead", text: `${f.expectedRuler.name} tar tronen enligt ${court.lawLabel}.` }),
      el("ol", { class: "order" }, court.succession.candidates.map((c) => el("li", {}, el("button", { type: "button", onclick: () => select(c.id) }, [mini(c.id), el("span", { text: `${c.name}, ${c.age} år` })])))),
    ]),
    el("section", {}, [el("h3", { text: "Rådet och ämbeten" }), seats()]),
    el("section", {}, [el("h3", { text: "Städer" }), el("dl", { class: "facts" }, court.cities.flatMap((c) => [el("dt", { text: `${c.name} · ${plain(c.family)}` }), el("dd", { text: `${sv(c.taxIncome)} silver om året · oro ${c.unrest}` })]))]),
  ];
}

function areaIntrigue() {
  const held = court.prisoners.map((p) => el("li", { class: "matter", "open-card": true }, [
    el("button", { type: "button", onclick: () => select(p.personId) }, [el("span", { class: "faces" }, mini(p.personId)), el("h3", { text: plain(p.name) }), el("span", { class: "due", text: `Fånge sedan ${day(p.since)} · ${plain(p.family)} bjuder ${p.ransom} silver` })]),
    el("div", { class: "body" }, state.confirm === p.personId
      ? [el("p", { text: `Avrätta ${plain(p.name)}? ${plain(p.family)} mister sin enda medlem.` }), el("div", { class: "acts" }, [el("button", { class: "btn danger", type: "button", text: "Ja, avrätta" }), el("button", { class: "btn", type: "button", text: "Behåll fången", onclick: () => { state.confirm = null; renderPanel(); } })])]
      : [el("div", { class: "acts" }, [el("button", { class: "btn", type: "button", text: "Frige" }), el("button", { class: "btn", type: "button", text: "Avrätta", onclick: () => { state.confirm = p.personId; renderPanel(); } })])]),
  ]));
  return [
    el("section", {}, [el("h3", { text: "Fångar" }), el("ul", { class: "matters flat" }, held)]),
    el("section", {}, [el("h3", { text: "Intriger och rykten" }), el("p", { class: "fine", text: "Ingen intrig pågår, och hovet bär inga rykten till dig. Ämbetet som spionmästare står tomt." })]),
    el("section", {}, [el("h3", { text: "Gränsfolk" }), el("ul", { class: "rows" }, court.tribes.map((t) => { const at = places.tribes.find((x) => x.id === t.id)?.at;
      return el("li", {}, el("button", { type: "button", onclick: () => flyTo(at, 6) }, [el("i", { class: "sign" }), el("span", {}, [el("b", { text: t.name }), el("small", { text: `${t.stateLabel} · ${t.distanceKm} km från Aachen` })]),
        el("span", { class: t.lastRaidYear ? "neg" : "", text: t.lastRaidYear ? `räd ${t.lastRaidYear}` : "" })])); }))]),
  ];
}

function areaAnnals() {
  const years = {};
  for (const entry of court.log) (years[entry.date.slice(0, 4)] ||= []).push(entry);
  return Object.keys(years).sort().reverse().map((year) => el("section", {}, [el("h3", { text: `År ${Number(year)}` }),
    el("ul", { class: "annals" }, years[year].map((entry) => el("li", {}, [el("b", { text: plain(entry.title) }), el("p", { text: entry.description }),
      entry.participants?.length ? el("span", { class: "faces" }, [...new Set(entry.participants)].filter(person).map((id) => el("button", { class: "mini", type: "button", style: face(id), title: person(id).name, onclick: () => select(id) }))) : null])))]));
}

function seats() {
  return el("ul", { class: "seats" }, court.offices.filter((o) => o.kind !== "ruler").map((o) => {
    const service = court.council.find((s) => s.officeId === o.id)?.serviceLabel;
    return el("li", {}, [el("span", { text: o.name.replace("Guvernör: ", "Guvernör i ") }),
      o.holderId ? el("button", { class: "name", type: "button", onclick: () => select(o.holderId) }, [plain(o.holderName), service && el("small", { text: ` · tjänsten är ${service}` })])
        : el("span", {}, [el("span", { class: "vacant", text: "vakant" }), el("button", { class: "btn", type: "button", text: "Utnämn" })])]);
  }));
}

const AREA_VIEWS = { needs: areaNeeds, people: areaPeople, houses: areaHouses, offices: areaOffices, intrigue: areaIntrigue, annals: areaAnnals };
function renderPanel() {
  const open = pending().length, [, title] = AREAS.find(([id]) => id === state.area);
  $("panel-title").textContent = title;
  $("panel-count").textContent = state.area === "needs" ? (open ? `${open} ärenden` : "allt avgjort") : state.area === "people" ? `${court.people.length} levande` : "";
  $("panel-body").replaceChildren(...AREA_VIEWS[state.area]());
  $("tabs").replaceChildren(...AREAS.map(([id, name]) => el("button", { type: "button", "aria-current": id === state.area ? "page" : false, onclick: () => { state.area = id; renderPanel(); } },
    [name, id === "needs" && open ? el("sup", { text: String(open) }) : null])));
  renderRuler();
}

function renderRuler() {
  const frac = (iso) => { const [, m, d] = iso.split("-").map(Number); return (m - 1 + (d - 1) / 30.5) / 12; };
  const next = String(Number(state.date.slice(0, 4)) + 1).padStart(4, "0"), groups = {};
  for (const story of pending()) if (story.due.slice(0, 4) === next) (groups[story.due] ||= []).push(plain(story.title));
  const ticks = Object.entries(groups).map(([due, titles]) => el("span", { class: `tick${soon(due) ? " soon" : ""}${frac(due) > 0.8 ? " end" : ""}`, style: `left:${(frac(due) * 100).toFixed(1)}%` },
    [el("b", { text: day(due).replace(/ \d+$/, "") }), el("br"), titles.length > 1 ? `${titles.length} ärenden går ut` : titles[0]]));
  $("ruler").replaceChildren(...ticks, el("i", { class: "now", id: "now" }), el("div", { class: "months" }, [`jan ${Number(next)}`, "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"].map((m) => el("span", { text: m }))));
}

function renderCard() {
  const p = person(state.selected), realm = court.foreign.find((r) => r.id === state.selected);
  if (realm) {
    $("card").replaceChildren(
      el("div", { class: "head" }, [el("span", { class: "face", style: face(realm.id) }), el("h2", { text: realm.name }), el("p", { text: `Säte: ${realm.seat}` })]),
      el("div", { class: "inner scroll" }, [
        el("dl", { class: "facts" }, [["Härskare", `${realm.ruler}, ${realm.rulerAge} år`], ["Arvinge", realm.heir || "ingen känd"], ["Tro", realm.faith], ["Inställning till dig", signed(realm.opinion)], ["Avstånd från Aachen", `${sv(realm.distanceKm, 0)} km`]]
          .flatMap(([k, v]) => [el("dt", { text: k }), el("dd", { text: v })])),
        el("div", { class: "acts" }, [el("button", { class: "btn", type: "button", text: "Sänd sändebud" }), el("button", { class: "btn", type: "button", text: "Visa på kartan", onclick: () => flyTo(places.cities.find((c) => c.polity === realm.id)?.at, 5.4) })]),
      ]));
    return;
  }
  const vacant = court.offices.filter((o) => !o.holderId).length;
  $("card").replaceChildren(
    el("div", { class: "head" }, [el("span", { class: "face", style: face(p.id) }), el("h2", { text: plain(p.name) }), el("p", { text: [`${p.age} år`, plain(p.family), roleOf(p)].filter(Boolean).join(" · ") })]),
    el("div", { class: "inner scroll" }, [
      el("div", { class: "tags" }, [...new Set([p.origin, p.bornUncertain && "Födelsedatum osäkert", /genererad/.test(p.name) && "Genererad person", ...p.traits, p.archetype].filter(Boolean))].map((t) => el("span", { text: t }))),
      el("div", { class: "skills" }, SKILLS.map(([key, label]) => el("div", {}, [el("b", { text: sv(p.skills[key]) }), el("span", { text: label })]))),
      el("dl", { class: "facts" }, [
        el("dt", { text: "Åsikt om dig" }), el("dd", { class: p.opinion < 0 ? "neg" : p.opinion > 0 && p.id !== court.rulerId ? "pos" : "", text: p.id === court.rulerId ? "det är du" : signed(p.opinion) }),
        el("dt", { text: "Stress" }), el("dd", {}, [`${p.stress} / 100`, el("div", { class: "meter" }, el("i", { style: `width:${p.stress}%` }))]),
        el("dt", { text: "Mål" }), el("dd", { text: p.goal || "inget uttalat" }),
        el("dt", { text: "Egen förmögenhet" }), el("dd", { text: `${p.wealth} silver` }),
      ]),
      el("div", { class: "acts" }, p.id === court.rulerId ? [el("button", { class: "btn", type: "button", text: "Sätt mål för regeringen" })]
        : [el("button", { class: "btn", type: "button", text: "Samtala" }), el("button", { class: "btn", type: "button", text: "Ge gåva" }), el("button", { class: "btn", type: "button", text: "Utnämn", disabled: p.imprisoned })]),
      el("section", {}, [el("h3", { text: `Rådet och ämbeten · ${vacant} vakanta` }), seats()]),
    ]));
}

function decide(story, choice) { state.history.push(story.id); state.decided[story.id] = choice; state.open = null; renderAll(); }
function select(id) { state.selected = id; renderThread(); renderCard(); if (state.area === "people") renderPanel(); }
function renderAll() { renderBar(); renderThread(); renderPanel(); renderCard(); }

// The year turn is one moment: the months pass on the ruler, the snow leaves the high ground and comes back.
function turnYear() {
  if (state.turning) return;
  state.turning = true; state.why = false; renderBar();
  document.body.classList.add("turning");
  const year = Number(state.date.slice(0, 4)) + 1, started = performance.now(), length = matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 9000;
  const step = (now) => {
    const t = Math.min(1, (now - started) / length), month = Math.min(11, Math.floor(t * 12));
    $("now").style.left = `${(t * 100).toFixed(2)}%`;
    $("when").textContent = `${MONTHS[month]} ${year} e.Kr.`;
    setSeason(t);
    if (t < 1) { requestAnimationFrame(step); return; }
    state.date = `${String(year).padStart(4, "0")}-12-25`;
    state.turning = false; document.body.classList.remove("turning");
    $("notice").hidden = false;
    renderAll();
  };
  requestAnimationFrame(step);
}

$("undo").addEventListener("click", () => { const id = state.history.pop(); if (id) delete state.decided[id]; renderAll(); });
$("next").addEventListener("click", turnYear);
$("notice-close").addEventListener("click", () => { $("notice").hidden = true; });
$("news").textContent = court.log[0].title;
$("news").addEventListener("click", () => { state.area = "annals"; renderPanel(); flyTo(places.tribes.find((t) => t.id === "ad800-tribe-sorbs").at, 6); });
$("realm").addEventListener("click", flyHome);
document.addEventListener("keydown", (event) => { if (event.key === "Escape") { state.why = false; state.confirm = null; $("notice").hidden = true; renderBar(); renderPanel(); } });
for (const button of document.querySelectorAll(".epoch button")) button.addEventListener("click", () => {
  document.documentElement.dataset.epoch = button.dataset.epoch;
  for (const other of document.querySelectorAll(".epoch button")) other.setAttribute("aria-pressed", String(other === button));
  setRealmAccent(getComputedStyle(document.documentElement).getPropertyValue("--realm").trim());
});

const map = createMap("map");
addPlaces(map, places, { court, pending: () => pending().length, onRealm: (id) => select(id), onCourt: () => { state.area = "needs"; state.open = pending()[0]?.id ?? null; renderPanel(); } });
renderAll();
window.draft = { map, state };
