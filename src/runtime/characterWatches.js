// Watches the player turns on stop a longer advance at the first calendar boundary where one holds.
// Each rule reads only what the player can see and compares against the state when the advance began.
// Spec: docs/superpowers/specs/2026-11-08-watches-design.md.
import { CRISIS_STRESS } from "./characters/breakdowns.js";
import { isAdultCharacter } from "./characters/characterCapacity.js";

export const WATCH_IDS = Object.freeze(["family_stress", "child_adult", "ransom_offer", "faction_known"]);

export const WATCH_LABELS = Object.freeze({
  family_stress: "Någon i familjen når stress 80",
  child_adult: "Ett barn i familjen blir myndigt",
  ransom_offer: "Ett lösenanbud kommer",
  faction_known: "En ny faktionsmedlem blir känd",
});

/** Known ids in WATCH_IDS order, each once. Anything else is dropped. */
export const normalizeWatchIds = (value) => (Array.isArray(value) ? WATCH_IDS.filter((id) => value.includes(id)) : []);

const playerFamilyId = (state) => state.identity?.mode === "family"
  ? state.identity.familyId : state.people[state.offices?.ruler?.holderId]?.familyId ?? null;

const living = (state) => Object.values(state.people).filter((person) => !person.diedAt);

const familyMembers = (state) => {
  const familyId = playerFamilyId(state);
  return familyId ? living(state).filter((person) => person.familyId === familyId) : [];
};

const knownFactionMembers = (state) => (state.factions ?? []).filter((faction) => faction.status !== "closed")
  .flatMap((faction) => faction.knownMemberIds.map((personId) => `${faction.id}:${personId}`));

const openRansomIds = (state) => state.stories.filter((story) => story.type === "ransom_offer" && story.status === "open").map((story) => story.id);

/** What each watch already counts when an advance begins. People outside the family count too, since a succession can make their family the player's. */
export const watchBaseline = (state) => ({
  stressed: new Set(living(state).filter((person) => person.stress >= CRISIS_STRESS).map((person) => person.id)),
  children: new Set(living(state).filter((person) => !isAdultCharacter(person, state.date)).map((person) => person.id)),
  ransoms: new Set(openRansomIds(state)),
  known: new Set(knownFactionMembers(state)),
});

const RULES = Object.freeze({
  family_stress: (state, base, family) => {
    const person = family().find((entry) => entry.stress >= CRISIS_STRESS && !base.stressed.has(entry.id));
    return person && { personId: person.id, message: `Turen stannade när ${person.name} nådde stress ${CRISIS_STRESS}. Du bevakar stress i familjen.` };
  },
  child_adult: (state, base, family) => {
    const person = family().find((entry) => base.children.has(entry.id) && isAdultCharacter(entry, state.date));
    return person && { personId: person.id, message: `Turen stannade när ${person.name} blev myndig. Du bevakar barnen i familjen.` };
  },
  ransom_offer: (state, base) => {
    const storyIds = openRansomIds(state).filter((id) => !base.ransoms.has(id));
    return storyIds.length > 0 && { storyIds, message: "Turen stannade vid ett nytt lösenanbud. Svara under Beslut i Rike & familjer." };
  },
  faction_known: (state, base) => knownFactionMembers(state).some((key) => !base.known.has(key))
    && { message: "Turen stannade när du fick veta om ännu en person i en faktion mot härskaren. Se Intriger i Rike & familjer." },
});

/** The first watch in WATCH_IDS order that holds, as { watch, personId?, storyIds, message }, or null. */
export const firedWatch = (state, baseline, watches) => {
  let members = null;
  const family = () => (members ??= familyMembers(state));
  for (const watch of normalizeWatchIds(watches)) {
    const hit = RULES[watch](state, baseline, family);
    if (hit) return { watch, storyIds: [], ...hit };
  }
  return null;
};
