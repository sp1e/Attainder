import { addGameMonths, compareGameDates } from '../gameDates.js';
import { hashRoll } from './duels.js';

// Plague reaches the capital (spec docs/superpowers/specs/2026-11-10-plague-design.md). Historical campaigns only.
// Nothing here moves a random stream: the onset hashes the plot stream's state with the date, and every infection and death hashes the story id with that state, kept as `seed`.
export const PLAGUE_CHANCE = 0.04, PLAGUE_QUIET_MONTHS = 180, PLAGUE_DEATH = 0.4;
export const PLAGUE_TOLL = Object.freeze({ health: 25, stress: 15 });
export const PLAGUE_CHOICES = Object.freeze({
  quarantine: Object.freeze({ silver: 20, chance: 0.1, cause: Object.freeze({ value: -5, years: 5, label: 'Stängda portar' }) }),
  prayer: Object.freeze({ silver: 5, chance: 0.25, legitimacy: 3, stress: 10 }),
  flight: Object.freeze({ silver: 0, chance: 0.3, legitimacy: -5, cause: Object.freeze({ value: -10, years: 10, label: 'Övergav staden' }) }),
  none: Object.freeze({ silver: 0, chance: 0.3 }),
});
const DUE_MONTHS = 3;
const CLOSED = Object.freeze({ replaced: 'Den som skulle svara företräder inte längre familjen eller riket.', family: 'Familjen styrs inte längre av spelaren.' });

/** Nobody answering: the plague runs its course with no measures. */
export const PLAGUE_EXPIRY = Object.freeze({ choiceId: 'none', text: 'Ingen gav order, och pesten fick gå fram fritt.' });

const clamp = (n) => Math.min(100, Math.max(0, n));
const byId = (a, b) => a.id.localeCompare(b.id);
const living = (state) => Object.values(state.people).filter((person) => !person.diedAt).sort(byId);

/** The onset roll for this year, in [0, 1). Reads the plot stream's state, never advances it. */
export const plagueRoll = (state) => hashRoll(`${state.plotRngState}|${state.date}|plague`);

/** In courtAnnualStep: on a historical campaign the plague may reach the capital, at most once in PLAGUE_QUIET_MONTHS. */
export function plagueStep(state, events, hooks) {
  if (!state.historicalOrigin) return;
  const actor = hooks.activeRepresentative(), family = hooks.controlledFamily();
  const recent = (story) => story.type === 'plague_outbreak' && (story.status === 'open' || compareGameDates(addGameMonths(story.createdAt, PLAGUE_QUIET_MONTHS), state.date) > 0);
  if (!actor || !family || state.stories.some(recent) || plagueRoll(state) >= PLAGUE_CHANCE) return;
  const event = hooks.logEvent(events, 'plague_outbreak', 'Pesten når huvudstaden', 'Sjukdomen sprider sig längs vägarna och över marknaden. Hovet måste bestämma hur staden ska möta den.', [actor.id]);
  const note = hooks.memory('plague_outbreak', 'Pesten når huvudstaden', [actor.id], { causeId: event.id });
  state.stories.push({ id: `plague-${state.date}`, type: 'plague_outbreak', status: 'open', title: 'Pesten når huvudstaden', description: 'Människor insjuknar i staden. Du kan stänga portarna, samla folket till bön eller lämna staden med familjen.', causeId: note.id, seed: state.plotRngState, familyId: family.id, actorId: actor.id, createdAt: state.date, dueAt: addGameMonths(state.date, DUE_MONTHS), knownBy: 'public' });
}

const option = (id, label, description, silver, purse) => ({ id, label, description, cost: `${silver} silver`, stress: '0', disabledReason: purse < silver ? `Det behövs ${silver} silver ur familjens kassa.` : '' });

/** The three answers, with a Swedish reason where the family cannot pay. Reads only. */
export function plagueChoices(state, story) {
  const purse = state.families[story.familyId]?.treasury ?? 0, { quarantine, prayer, flight } = PLAGUE_CHOICES;
  return [
    option('quarantine', 'Stäng stadens portar', 'Färre insjuknar, men handeln står still och de andra familjerna klagar.', quarantine.silver, purse),
    option('prayer', 'Bön och processioner', 'Kronan leder bönerna. Det stärker legitimiteten, men smittan går fram.', prayer.silver, purse),
    option('flight', 'Fly till landsbygden', 'Din familj undkommer smittan. Staden minns att ni lämnade den.', flight.silver, purse),
  ];
}

/** Who falls ill and who dies, as { sick, dead }, both in id order. The controlled family is spared when it fled. Reads only. */
export function plagueToll(state, story, choiceId) {
  const { chance } = PLAGUE_CHOICES[choiceId];
  const exposed = living(state).filter((person) => !(choiceId === 'flight' && person.familyId === story.familyId));
  const sick = exposed.filter((person) => hashRoll(`${story.id}|${story.seed}|sick|${person.id}`) < chance);
  return { sick, dead: sick.filter((person) => hashRoll(`${story.id}|${story.seed}|dies|${person.id}`) < PLAGUE_DEATH) };
}

// The grudge the other families hold after a quarantine (their heads) or a flight (every adult).
function grudges(state, story, choiceId, hooks) {
  const cause = PLAGUE_CHOICES[choiceId].cause;
  if (!cause) return;
  const others = Object.values(state.families).filter((family) => family.id !== story.familyId).sort(byId);
  const people = choiceId === 'quarantine' ? others.map((family) => state.people[family.headId])
    : living(state).filter((person) => person.familyId !== story.familyId && hooks.adult(person));
  for (const person of people) if (person && !person.diedAt && person.id !== story.actorId) hooks.opinionCause(person.id, story.actorId, cause.value, cause.label, `plague:${story.id}`, cause.years);
}

/** Applies a choice resolveStory has already checked, or the expiry. */
export function resolvePlague(state, story, choiceId, events, hooks) {
  Object.assign(story, { status: 'resolved', choiceId, resolvedAt: state.date });
  const rule = PLAGUE_CHOICES[choiceId], actor = state.people[story.actorId];
  state.families[story.familyId].treasury -= rule.silver;
  const { sick, dead } = plagueToll(state, story, choiceId), deadIds = new Set(dead.map((person) => person.id));
  for (const person of sick.filter((item) => !deadIds.has(item.id))) Object.assign(person, { health: Math.max(1, person.health - PLAGUE_TOLL.health), stress: Math.min(200, person.stress + PLAGUE_TOLL.stress) });
  const names = dead.map((person) => person.name).join(', ');
  hooks.logEvent(events, 'plague_toll', dead.length ? `Pesten skördar ${dead.length} liv` : 'Pesten drar förbi', `${sick.length} insjuknar i huvudstaden.${dead.length ? ` Döda: ${names}.` : ' Ingen dör.'}`, dead.map((person) => person.id));
  hooks.memory('plague_toll', dead.length ? `Pesten tar ${names}` : 'Pesten drar förbi utan döda', dead.map((person) => person.id), { causeId: story.causeId });
  if (dead.length) hooks.kill([...deadIds], events, 'Pesten');
  // After the deaths: a new reign sets legitimacy afresh, and the dead hold no grudge for their heirs to inherit.
  if (rule.legitimacy) state.realm.legitimacy = clamp(state.realm.legitimacy + rule.legitimacy);
  if (rule.stress && !actor.diedAt) actor.stress = Math.max(0, actor.stress - rule.stress);
  grudges(state, story, choiceId, hooks);
}

/** Why an open outbreak no longer stands, or '' while it does. Such a story closes with no effect. */
export function plagueClosedReason(state, story, hooks) {
  if (hooks.controlledFamily()?.id !== story.familyId) return CLOSED.family;
  return hooks.activeRepresentative()?.id === story.actorId ? '' : CLOSED.replaced;
}
