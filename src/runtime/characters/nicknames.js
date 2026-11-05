import { compareGameDates, normalizeGameDate } from '../gameDates.js';
import { reignMonths } from './reign.js';

// Names a ruler earns. state.nicknames holds { personId, nicknameId, earnedAt }, one per person: a name is earned once, stays through death and a return to the throne, and every label comes from the table below. Nothing here draws randomness.

const INVALID = 'Ett tillnamn i sparfilen är ogiltigt.';
const RECORD_KEYS = Object.freeze(['personId', 'nicknameId', 'earnedAt']);
const MONTHS_BEFORE_A_NAME = 24;

/** In evaluation order: the first row the reign has earned gives the name. */
export const NICKNAMES = Object.freeze([
  { id: 'cruel', male: 'den Grymme', female: 'den Grymma', earned: ({ deeds }) => deeds.executions >= 2 || deeds.cruel >= 4 },
  { id: 'great', male: 'den Store', female: 'den Stora', earned: ({ deeds, prestige }) => deeds.goalsMet >= 2 || prestige >= 40 },
  { id: 'treacherous', male: 'den Lömske', female: 'den Lömska', earned: ({ deeds }) => deeds.betrayal >= 4 },
  { id: 'generous', male: 'den Givmilde', female: 'den Givmilda', earned: ({ deeds }) => deeds.generous >= 3 },
  { id: 'frail', male: 'den Bräcklige', female: 'den Bräckliga', earned: ({ deeds }) => deeds.breakdowns >= 1 },
  { id: 'usurper', male: 'Tronrövaren', female: 'Tronrövaren', earned: ({ lawful }) => lawful === false },
  { id: 'quiet', male: 'den Stillsamme', female: 'den Stillsamma', earned: ({ months }) => months >= 48 },
].map((row) => Object.freeze(row)));

// A strict find, so an id wrapped in a list is no id.
const rowOf = (nicknameId) => NICKNAMES.find((row) => row.id === nicknameId);
const recordOf = (state, personId) => state.nicknames.find((record) => record.personId === personId);
const labelFor = (row, person) => (person.sex === 'female' ? row.female : row.male);

/** The name a person carries, in the form that fits them, or null. */
export function nicknameOf(state, personId) {
  const record = recordOf(state, personId);
  return record ? labelFor(rowOf(record.nicknameId), state.people[personId]) : null;
}

/** Yearly: gives an adult ruler without a name the first one the reign has earned, once it has lasted 24 months. */
export function nicknameStep(state, events, hooks) {
  const ruler = hooks.ruler(), months = reignMonths(state);
  if (!ruler || !hooks.adult(ruler) || recordOf(state, ruler.id) || months < MONTHS_BEFORE_A_NAME) return;
  const reign = { deeds: state.reign.deeds, prestige: state.realm.prestige, lawful: state.reign.lawful, months };
  const row = NICKNAMES.find((candidate) => candidate.earned(reign));
  if (!row) return;
  state.nicknames.push({ personId: ruler.id, nicknameId: row.id, earnedAt: state.date });
  const event = hooks.logEvent(events, 'nickname', `${ruler.name} kallas nu ${labelFor(row, ruler)}`, 'Så talar folket nu om härskaren.', [ruler.id]);
  hooks.memory('nickname', event.title, [ruler.id], { causeId: event.id });
}

function validRecord(state, record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
  if (Object.keys(record).length !== RECORD_KEYS.length || !RECORD_KEYS.every((key) => Object.hasOwn(record, key))) return false;
  if (typeof record.personId !== 'string' || !Object.hasOwn(state.people, record.personId) || !rowOf(record.nicknameId)) return false;
  return typeof record.earnedAt === 'string' && normalizeGameDate(record.earnedAt) === record.earnedAt && compareGameDates(record.earnedAt, state.date) <= 0;
}

/** Refuses a forged nickname record, or a second name for one person. */
export function validateNicknames(state) {
  const people = state.nicknames.map((record) => record?.personId);
  if (!state.nicknames.every((record) => validRecord(state, record)) || new Set(people).size !== people.length) throw new Error(INVALID);
}
