// The court over the map: what the shell shows, read out of the court's presentation. The thread of medallions, the
// matters that need the player, and the realm's six figures. Spec: docs/superpowers/specs/2026-11-15-court-shell-design.md.
import { addGameMonths, compareGameDates, diffGameDays, formatGameDate, isGameDate, parseGameDate } from "../../runtime/gameDates.js";

const entries = (value) => (Array.isArray(value) ? value : Object.values(value ?? {}));
const alive = (person) => person && person.alive !== false && !person.diedAt && !person.deathDate;
// A matter waits for the player while it has one of these (the panel's own rule).
const OPEN_STATUSES = new Set(["open", "pending", "active"]);

/**
 * The thread: the house in the order of succession, then the people of the other houses at court. In realm mode the
 * house is the ruler's, whichever family that is now; in family mode it is the family the player follows. Each member
 * carries the role the medallion shows.
 */
export function threadOf(view) {
  const people = entries(view?.people).filter(alive);
  if (!people.length) return { house: [], others: [] };
  const byId = new Map(people.map((person) => [person.id, person]));
  const rulerId = view.ruler?.id ?? null;
  const heirId = view.succession?.legalHeirId ?? null;
  const rulerHouse = byId.get(rulerId)?.familyId ?? null;
  const houseId = (view.identity?.mode === "family" ? view.identity.familyId : rulerHouse) ?? view.identity?.familyId ?? null;
  const offices = entries(view.offices);
  const rulerOffice = offices.find((office) => office.kind === "ruler")?.name ?? "";
  const officeOf = (id) => offices.find((office) => office.kind !== "ruler" && office.holderId === id)?.name ?? "";
  const member = (person) => {
    const ruler = person.id === rulerId, heir = person.id === heirId, held = Boolean(person.imprisoned);
    return { person, ruler, heir, held, role: ruler ? rulerOffice : heir ? "Arvinge" : held ? "Fånge" : officeOf(person.id) };
  };
  // The ruler, then the engine's own candidates in their order, then the rest of the house by age.
  const inLine = [rulerId, ...entries(view.succession?.candidates).map((candidate) => candidate.id)]
    .map((id) => byId.get(id))
    .filter((person) => person && person.familyId === houseId);
  const placed = new Set(inLine.map((person) => person.id));
  const rest = people.filter((person) => person.familyId === houseId && !placed.has(person.id)).sort((left, right) => (right.age ?? 0) - (left.age ?? 0));
  return {
    house: [...inLine, ...rest].map(member),
    others: people.filter((person) => person.familyId !== houseId).map(member),
  };
}

/** The matters that wait for the player, the nearest deadline first, each with the people of it who are at court. */
export function mattersOf(view) {
  const byId = new Map(entries(view?.people).filter(alive).map((person) => [person.id, person]));
  return entries(view?.stories)
    .filter((story) => OPEN_STATUSES.has(story?.status))
    .map((story) => ({
      id: story.id,
      title: String(story.title ?? ""),
      dueAt: story.dueAt ?? "",
      people: [...new Set([story.actorId, story.targetId])].map((id) => byId.get(id)).filter(Boolean),
    }))
    // A matter without a deadline comes after those that have one.
    .sort((left, right) => (left.dueAt ? 0 : 1) - (right.dueAt ? 0 : 1) || String(left.dueAt).localeCompare(String(right.dueAt)));
}

/** How many open matters each person is part of. */
export function flagsOf(matters) {
  const flags = new Map();
  for (const matter of matters ?? []) for (const person of matter.people) flags.set(person.id, (flags.get(person.id) ?? 0) + 1);
  return flags;
}

/** The realm's six figures, with the panel's own labels. `signed` asks for a plus or minus sign. */
export function figuresOf(view) {
  const economy = view?.economy;
  if (!economy) return [];
  return [
    { key: "treasury", label: "Statskassa", value: economy.treasury, unit: "silver" },
    { key: "revenue", label: "Årsintäkt", value: economy.annualRevenue, signed: true, negative: economy.annualRevenue < 0 },
    { key: "orders", label: "Handlingsutrymme", value: economy.actionPoints },
    { key: "legitimacy", label: "Legitimitet", value: economy.legitimacy, unit: "/ 100" },
    { key: "prestige", label: "Prestige", value: view.court?.prestige },
    { key: "readiness", label: "Militär beredskap", value: economy.militaryReadiness, unit: "%" },
  ];
}

// The six skills in the order the card shows them, with the panel's own labels (CharactersPanel.jsx, `humanize`).
const SKILLS = [
  ["command", "Befäl"], ["stewardship", "Förvaltning"], ["diplomacy", "Diplomati"],
  ["learning", "Lärdom"], ["intrigue", "Intrig"], ["prowess", "Kampförmåga"],
];

/**
 * The card of one person at court: who the person is, what the person can do and how the person stands to the player.
 * Nothing here is new knowledge: it is what the panel's people tab shows. `null` for someone who is not at court.
 */
export function cardOf(view, personId) {
  if (!personId) return null;
  const thread = threadOf(view);
  const member = [...thread.house, ...thread.others].find((entry) => entry.person.id === personId);
  if (!member) return null;
  const { person } = member;
  return {
    ...member,
    // A name that says "(genererad)" already tells where the person comes from (the panel's own rule).
    tags: [/genererad/i.test(person.name ?? "") ? null : person.originLabelSv, person.archetypeLabel, ...entries(person.traitLabels)].filter(Boolean),
    skills: SKILLS.filter(([key]) => Number.isFinite(person.skills?.[key])).map(([key, label]) => ({ key, label, value: person.skills[key] })),
    opinion: person.opinion ?? null,
    opinionReasons: entries(person.opinionReasons).filter((reason) => reason?.label).map((reason) => ({ label: reason.label, value: reason.value ?? null })),
    stress: person.stress ?? null,
    goalLabel: String(person.goalLabel ?? ""),
    // A person who was just asked drops out of the targets for a year (the panel's own rule).
    canTalk: entries(view.conversationTargets).some((target) => target?.id === person.id),
  };
}

/**
 * An open matter as the list unfolds it: what the panel's decision card holds, under the story's own names and
 * without a chain's earlier steps.
 * A choice's `actorName` is the name of who carries it out, `null` when nobody may, and `undefined` when the choice names
 * nobody. A choice with odds shows them in place of its description (the panel's own rule). `null` for a matter that
 * is not open.
 */
export function answerOf(view, matterId) {
  if (!matterId) return null;
  const story = entries(view?.stories).find((entry) => entry?.id === matterId && OPEN_STATUSES.has(entry.status));
  if (!story) return null;
  const chain = story.type === "event_chain";
  return {
    id: story.id,
    title: String(story.title ?? ""),
    chainTitle: chain ? String(story.chainTitle ?? "") : "",
    stepNumber: chain && Number.isInteger(story.stepNumber) && story.stepNumber > 0 ? story.stepNumber : null,
    description: String(story.description ?? ""),
    triggerDescription: String(story.triggerDescription ?? ""),
    deadlineText: String(story.deadlineText ?? ""),
    // The deadline's own sentence replaces the fallback.
    fallbackDescription: story.deadlineText ? "" : String(story.fallbackDescription ?? ""),
    choices: entries(story.choices).filter((choice) => choice?.id).map((choice) => ({
      id: choice.id,
      label: String(choice.label ?? ""),
      description: choice.odds ? "" : String(choice.description ?? ""),
      actorName: choice.scope === "none" ? undefined : choice.actorName,
      cost: String(choice.cost ?? ""),
      stress: choice.stress ?? null,
      disabledReason: String(choice.disabledReason ?? ""),
      odds: choice.odds ?? null,
    })),
  };
}

/** What a decision's notice says: the choice, and the event that came of it. The events after the decision's own are not its outcome. */
export function decisionNotice(story, choiceId, events) {
  const label = story?.choices?.find((choice) => choice.id === choiceId)?.label;
  if (!label) return "";
  const decided = events.map((event) => event.title).lastIndexOf(story.title);
  const outcomes = (decided < 0 ? events : events.slice(0, decided)).filter((event) => event.title !== story.title);
  const lead = outcomes.find((event) => event.importance === "major") ?? outcomes[0];
  return lead ? `${label} · ${lead.title}` : label;
}

/** What an action's notice says: the last two events it wrote (the panel's own rule). */
export function commandNotice(events) {
  const titles = entries(events).map((event) => event?.title).filter(Boolean);
  return titles.length ? titles.slice(-2).join(" · ") : "Beslutet har sparats i kampanjen.";
}

/**
 * The panel's actions that name this person and can be done now. `field` and `value` are the person's place in the
 * command; `fields` are what is left to choose, without the person. A prisoner is named through the prisoner's entry.
 * An action that names nobody, or whose other field has nobody left, is not a card's.
 */
export function actionsOf(view, personId) {
  if (!personId) return [];
  const prisonerId = entries(view?.prisoners).find((prisoner) => prisoner?.personId === personId)?.id ?? null;
  const isPerson = (option) => option?.value === personId || (prisonerId !== null && option?.value === prisonerId);
  return entries(view?.actions).flatMap((action) => {
    if (!action?.type || action.disabledReason) return [];
    const fields = entries(action.fields);
    const own = fields.find((field) => entries(field?.options).some(isPerson));
    if (!own) return [];
    const others = fields.filter((field) => field !== own).map((field) => ({
      key: field.key,
      label: String(field.label ?? ""),
      options: entries(field.options).filter((option) => !isPerson(option)).map((option) => ({ value: option.value, label: String(option.label ?? option.value) })),
    }));
    if (others.some((field) => !field.options.length)) return [];
    return [{
      type: action.type,
      label: String(action.label ?? ""),
      description: String(action.description ?? ""),
      cost: String(action.cost ?? ""),
      stress: action.stress ?? null,
      actorName: action.actorName,
      field: own.key,
      value: entries(own.options).find(isPerson).value,
      fields: others,
    }];
  });
}

// A deadline this near is marked on the year line: three months.
const SOON_DAYS = 92;
// A tick past this share of the line writes its label to the left of its mark, so it stays on the line.
const END_SHARE = 0.75;
// Deadlines nearer each other than this share of the line (eleven days) would be written over each other: they
// share one tick.
const TICK_GAP = 0.03;

/**
 * The year line: the twelve months ahead of the game's date. `months` are the first day of each month on the way,
 * `ticks` the open matters' deadlines, each at its share of the line (0 to 1). A deadline already passed stands at
 * the start. Deadlines of one day, and those too near each other to be read apart, share a tick, which carries the
 * nearest of them. A tick's `end` says its label stands to the left of its mark, and `room` is the share
 * of the line the label may take before it meets the next tick's. `beyond` counts the open matters that are not on
 * the line: due later, or never.
 * `null` when the view has no game date.
 */
export function yearLineOf(view) {
  const from = view?.date;
  const start = parseGameDate(from);
  if (!start) return null;
  const to = addGameMonths(from, 12);
  const span = diffGameDays(from, to);
  const share = (date) => Math.min(1, Math.max(0, diffGameDays(from, date) / span));
  const firstOfMonth = formatGameDate({ year: start.year, month: start.month, day: 1 });
  const months = Array.from({ length: 12 }, (unused, index) => addGameMonths(firstOfMonth, index + 1))
    .filter((date) => compareGameDates(date, to) <= 0)
    .map((date) => ({ at: share(date), month: parseGameDate(date).month, year: parseGameDate(date).year }));
  const matters = mattersOf(view);
  const onLine = matters.filter((matter) => isGameDate(matter.dueAt) && compareGameDates(matter.dueAt, to) <= 0);
  // `mattersOf` gives the nearest deadline first, so a tick's first matter is its nearest.
  const marks = [];
  for (const matter of onLine) {
    const at = share(matter.dueAt), last = marks.at(-1);
    if (last && at - last.at < TICK_GAP) last.matters.push({ id: matter.id, title: matter.title });
    else marks.push({ dueAt: matter.dueAt, at, soon: diffGameDays(from, matter.dueAt) <= SOON_DAYS, end: at > END_SHARE, matters: [{ id: matter.id, title: matter.title }] });
  }
  // A label has the gap to the tick it grows toward, or half of it when that tick's label grows toward it too.
  const ticks = marks.map((tick, index) => {
    const neighbour = marks[index + (tick.end ? -1 : 1)];
    if (!neighbour) return { ...tick, room: tick.end ? tick.at : 1 - tick.at };
    const gap = Math.abs(neighbour.at - tick.at);
    return { ...tick, room: neighbour.end === tick.end ? gap : gap / 2 };
  });
  return { from, to, months, ticks, beyond: matters.length - onLine.length };
}

/** The areas of the left panel, each with the panel's tab it opens for what the list leaves out. */
export const AREAS = Object.freeze([
  { key: "needs", tab: "decisions" }, { key: "people", tab: "people" }, { key: "houses", tab: "families" },
  { key: "seats", tab: "offices" }, { key: "intrigue", tab: "intrigue" }, { key: "chronicle", tab: "chronicle" },
]);

/** Everyone alive at court, in the thread's order. `self` marks the player's representative, who has no opinion of himself. */
export function peopleOf(view) {
  const thread = threadOf(view);
  const selfId = view?.representative?.id ?? view?.ruler?.id ?? null;
  return [...thread.house, ...thread.others].map((member) => ({ person: member.person, role: member.role, self: member.person.id === selfId }));
}

/**
 * The houses by support, the strongest first; a house without a number comes last. `headId` is given only for a head
 * who is alive at court, so only such a head can be selected. `own` marks the player's house.
 */
export function housesOf(view) {
  const atCourt = new Map(entries(view?.people).filter(alive).map((person) => [person.id, person]));
  const number = (value) => (Number.isFinite(value) ? value : null);
  return entries(view?.families).filter((family) => family?.id).map((family) => ({
    id: family.id,
    name: String(family.name ?? ""),
    headId: atCourt.has(family.headId) ? family.headId : null,
    // The house names its head; a head at court whom it does not name is named by the court.
    headName: String(family.headName || atCourt.get(family.headId)?.name || ""),
    support: number(family.support),
    treasury: number(family.treasury),
    influence: number(family.influence),
    own: family.id === view.identity?.familyId,
    exiled: Boolean(family.exiled),
  })).sort((left, right) => (right.support ?? -Infinity) - (left.support ?? -Infinity));
}

// The line of succession shows this many: the heir and the four after.
const LINE_LENGTH = 5;

/**
 * The line of succession and the offices. The line is the lawful heir and the engine's candidates after, alive and
 * without the ruler. An office's `holderId` is given only for a holder at court; a vacant office has no name.
 */
export function seatsOf(view) {
  const byId = new Map(entries(view?.people).filter(alive).map((person) => [person.id, person]));
  const rulerId = view?.ruler?.id ?? null;
  const heirId = view?.succession?.legalHeirId ?? null;
  const line = [...new Set([heirId, ...entries(view?.succession?.candidates).map((candidate) => candidate?.id)])]
    .filter((id) => id !== rulerId && byId.has(id))
    .slice(0, LINE_LENGTH)
    .map((id) => ({ id, name: String(byId.get(id).name ?? ""), heir: id === heirId }));
  const offices = entries(view?.offices).filter((office) => office?.id)
    .map((office) => ({ ruler: office.kind === "ruler", seat: {
      id: office.id,
      name: String(office.name ?? ""),
      holderId: byId.has(office.holderId) ? office.holderId : null,
      holderName: office.holderId ? String(office.holderName || byId.get(office.holderId)?.name || "") : "",
    } }))
    .sort((left, right) => Number(right.ruler) - Number(left.ruler))
    .map((entry) => entry.seat);
  return { line, offices };
}

/**
 * What the player's side knows and holds, under the presentation's own names. A person's id is given only for
 * someone at court. An entry without an id is left out. `empty` when there is nothing of any kind.
 */
export function intrigueOf(view) {
  const atCourt = new Set(entries(view?.people).filter(alive).map((person) => person.id));
  const here = (id) => (atCourt.has(id) ? id : null);
  const known = (value) => entries(value).filter((entry) => entry?.id);
  const schemes = known(view?.schemes).map((scheme) => ({ id: scheme.id, actionLabel: String(scheme.actionLabel ?? ""), targetNames: entries(scheme.targetNames), dueAt: scheme.dueAt ?? "" }));
  const prisoners = known(view?.prisoners).map((prisoner) => ({ id: prisoner.id, personId: here(prisoner.personId), name: String(prisoner.name ?? ""), familyName: String(prisoner.familyName ?? ""), since: prisoner.since ?? "", ransom: prisoner.ransom ?? null }));
  const hooks = known(view?.ownHooks).map((hook) => ({ id: hook.id, targetId: here(hook.targetId), targetName: String(hook.targetName ?? ""), strengthLabel: String(hook.strengthLabel ?? hook.strength ?? "") }));
  const secrets = known(view?.knownSecrets).map((secret) => ({ id: secret.id, subjectId: here(secret.subjectId), typeLabel: String(secret.typeLabel ?? secret.type ?? ""), subjectName: String(secret.subjectName ?? ""), evidenceLabel: String(secret.evidenceLabel ?? ""), exposed: Boolean(secret.exposed) }));
  const rumors = known(view?.rumors).map((rumor) => ({ id: rumor.id, topicLabel: String(rumor.topicLabel ?? rumor.topic ?? ""), subjectName: String(rumor.subjectName ?? ""), date: rumor.date ?? "", reliability: rumor.reliability ?? "" }));
  return { schemes, prisoners, hooks, secrets, rumors, empty: ![schemes, prisoners, hooks, secrets, rumors].some((list) => list.length) };
}

// The chronicle shows this many entries: the panel's record goes further back.
const CHRONICLE_LENGTH = 60;

/** The year record, the latest first, under its years. An entry without a date comes last, under no year. */
export function chronicleOf(view) {
  const dateOf = (entry) => entry.date || entry.createdAt || "";
  const latest = entries(view?.log).filter((entry) => entry?.id)
    .sort((left, right) => Number(isGameDate(dateOf(right))) - Number(isGameDate(dateOf(left))) || compareGameDates(dateOf(right), dateOf(left)))
    .slice(0, CHRONICLE_LENGTH);
  const years = [];
  for (const entry of latest) {
    const date = dateOf(entry);
    const year = parseGameDate(date)?.year ?? null;
    if (years.at(-1)?.year !== year) years.push({ year, entries: [] });
    years.at(-1).entries.push({ id: entry.id, date, title: String(entry.title ?? ""), description: String(entry.description ?? ""), type: entry.type ?? "" });
  }
  return years;
}

// The start's package gives the period its accent (DESIGN.md, "The Period Accent Rule").
const EPOCHS = Object.freeze({ "egypt-3000bc": "egypt", "john-1200": "angevin", "world-1500": "aztec" });

/** The period accent of the campaign's start: `carolingian` for the year 800 and for any start without its own. */
export function epochOf(view) {
  return EPOCHS[view?.historicalOrigin?.contentId] ?? "carolingian";
}
