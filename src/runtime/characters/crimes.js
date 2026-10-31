import { addGameMonths } from '../gameDates.js';
import { exposeSecret } from './secrets.js';

// Crimes that the action gate records (the `crime` effect) and what an exposed one costs. Nothing here draws from a random stream. `hooks` come from index.js (actionHooks), so this module never reaches into the engine's private helpers.
export const CRIME_LABELS = Object.freeze({ murder: 'Mord', kinslaying: 'Släktmord', attempted_murder: 'Mordförsök', treason: 'Förräderi' });

// Opinion every living adult of the victim's family loses toward the criminal, and the extra loss in the criminal's own family for kinslaying.
const VICTIM_FAMILY_OPINION = -30;
const OWN_FAMILY_OPINION = -15;
// Legitimacy an exposed crime costs a ruler. Treason weighs nothing on the crown that commits it.
const LEGITIMACY_LOSS = Object.freeze({ murder: 8, attempted_murder: 8, kinslaying: 12 });
const CASE_MONTHS = 12;
const FINE_SILVER = 30;
const PARDON_LEGITIMACY = 2;
const PARDON_GOODWILL = 15;
export const PRISON_MISSING = 'Fängelset är inte byggt ännu.';
const NO_MANDATE = 'Kräver härskarmandat.';

const rounded = (value) => Math.round(value * 100) / 100;
const clampLegitimacy = (value) => Math.max(0, Math.min(100, value));
const livingAdults = (state, hooks, familyId) => Object.values(state.people).filter((person) => person.familyId === familyId && !person.diedAt && hooks.adult(person));

/** The crime a secret records, as { crime, victimId }, or null when the secret came from nothing the action log knows as a crime. A crime effect creates its secret with the resolution's anchor memory as cause, so the memory leads back to the log entry; the victim is that entry's first target. */
export function crimeOfSecret(state, secretId) {
  const secret = state.secrets.find((entry) => entry.id === secretId);
  if (!secret || secret.causeId === null) return null;
  const entry = state.actionLog.find((item) => item.memoryId === secret.causeId);
  const record = entry?.effects.find((effect) => effect.kind === 'crime' && effect.secretId === secretId);
  return record ? { crime: record.crime, victimId: entry.targetIds[0] } : null;
}

/**
 * Makes a crime public: the secret is exposed once, the victim's family turns against the criminal, and the crown or the player's court reacts.
 * `crime` is the recorded kind (murder, kinslaying, attempted_murder, treason) and `victimId` the person it was aimed at. Exposing a secret that is already out does nothing, so no consequence is charged twice.
 */
export function exposeCrime(state, { secretId, crime, victimId }, events, hooks) {
  const secret = state.secrets.find((entry) => entry.id === secretId);
  if (!secret) throw new Error('Hemligheten finns inte.');
  if (secret.exposed) return;
  exposeSecret(state, secretId);
  const subject = state.people[secret.subjectId], victim = state.people[victimId], label = CRIME_LABELS[crime];
  const event = hooks.logEvent(events, 'crime_exposed', `${label} avslöjat`, `${subject.name} har avslöjats. Brottet: ${label.toLowerCase()}. Offer eller mål: ${victim.name}.`, [subject.id, victim.id]);
  const note = hooks.memory('crime', event.title, [subject.id, victim.id], { causeId: secret.causeId });
  for (const person of livingAdults(state, hooks, victim.familyId)) hooks.opinionCause(person.id, subject.id, VICTIM_FAMILY_OPINION, label, note.id);
  // Own cause id: when killer and victim share a family the same person gets both losses, and one cause id per pair would drop the second.
  if (crime === 'kinslaying') for (const person of livingAdults(state, hooks, subject.familyId)) hooks.opinionCause(person.id, subject.id, OWN_FAMILY_OPINION, label, `${note.id}:kin`);
  const ruler = hooks.ruler();
  if (ruler?.id === subject.id) state.realm.legitimacy = clampLegitimacy(state.realm.legitimacy - (LEGITIMACY_LOSS[crime] ?? 0));
  else if (ruler && hooks.activeRepresentative()?.id === ruler.id) openPunishCase(state, { secret, crime, subject, victim, ruler, note }, hooks);
}

function openPunishCase(state, { secret, crime, subject, victim, ruler, note }, hooks) {
  const label = CRIME_LABELS[crime];
  hooks.openStory({ type: 'punish_crime', title: `${label}: ${subject.name}`, description: `${subject.name} har avslöjats för ${label.toLowerCase()}. Du avgör hur brottet ska straffas.`,
    actorId: subject.id, targetId: victim.id, familyId: subject.familyId, createdAt: state.date, dueAt: addGameMonths(state.date, CASE_MONTHS),
    knownBy: [ruler.id], crime, secretId: secret.id, causeId: note.id });
}

/** The three ways the ruler can answer an exposed crime. `context.controller` tells whether the player holds the mandate. */
export function punishCrimeChoices(state, story, { controller }) {
  const owed = Math.min(FINE_SILVER, Math.max(0, state.families[story.familyId]?.treasury ?? 0));
  const mandate = controller ? '' : NO_MANDATE;
  return [
    { id: 'imprison', label: 'Fängsla gärningspersonen', description: 'Personen förs i fängelse utan rättegång. Brottet är avslöjat, så ingen legitimitet går förlorad.', cost: '0 silver', stress: '0', disabledReason: mandate || PRISON_MISSING },
    { id: 'fine', label: 'Bötfäll familjen', description: `${rounded(owed)} silver ur familjens kassa går till statskassan.`, cost: '0 silver', stress: '0', disabledReason: mandate },
    { id: 'pardon', label: 'Benåda gärningspersonen', description: `Personen går fri och minns nåden (åsikt om dig +${PARDON_GOODWILL}). Rikets legitimitet sjunker med ${PARDON_LEGITIMACY}.`, cost: '0 silver', stress: '0', disabledReason: mandate },
  ];
}

/** Applies the chosen answer to a punish_crime story. `hooks` is actionHooks(state); `hooks.imprison` is wired when the prison exists. */
export function resolvePunishment(state, story, choiceId, hooks) {
  const family = state.families[story.familyId], ruler = hooks.ruler();
  if (choiceId === 'fine' && family) {
    const amount = Math.min(FINE_SILVER, Math.max(0, family.treasury));
    family.treasury = rounded(family.treasury - amount);
    state.realm.treasury = rounded(state.realm.treasury + amount);
  } else if (choiceId === 'pardon') {
    state.realm.legitimacy = clampLegitimacy(state.realm.legitimacy - PARDON_LEGITIMACY);
    if (ruler) hooks.opinionCause(story.actorId, ruler.id, PARDON_GOODWILL, 'Benådning', hooks.memory('pardon', 'Ett brott benådades', [story.actorId, ruler.id], { causeId: story.causeId }).id);
  } else if (choiceId === 'imprison') {
    if (typeof hooks.imprison !== 'function') throw new Error(PRISON_MISSING);
    hooks.imprison(story.actorId, story);
  }
}
