// The court over the map: what the shell shows, read out of the court's presentation. The thread of medallions, the
// matters that need the player, and the realm's six figures. Spec: docs/superpowers/specs/2026-11-15-court-shell-design.md.

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
