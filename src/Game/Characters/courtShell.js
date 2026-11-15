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
  };
}
