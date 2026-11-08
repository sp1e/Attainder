import { compareGameDates, normalizeGameDate } from '../gameDates.js';
import { reignMonths } from './reign.js';

// Names a ruler earns. state.nicknames holds { personId, nicknameId, earnedAt }, one per person: a name is earned once, stays through death and a return to the throne, and every label comes from the table below. Nothing here draws randomness.

const INVALID = 'Ett tillnamn i sparfilen är ogiltigt.';
const RECORD_KEYS = Object.freeze(['personId', 'nicknameId', 'earnedAt']);
const MONTHS_BEFORE_A_NAME = 24;

// One count a row watches: what it reads from the reign and the value that earns the name. A binary count is a yes or no.
const count = (label, read, threshold, binary = false) => Object.freeze({ label, read, threshold, binary });
const deed = (key) => ({ deeds }) => deeds[key];

/** In evaluation order: the first row the reign has earned gives the name. A row is earned when any of its counts reaches its threshold. */
export const NICKNAMES = Object.freeze([
  { id: 'cruel', male: 'den Grymme', female: 'den Grymma', counts: [count('avrättningar', deed('executions'), 2), count('grymma gärningar', deed('cruel'), 4)] },
  { id: 'great', male: 'den Store', female: 'den Stora', counts: [count('uppnådda regeringsmål', deed('goalsMet'), 2), count('ryktbarhet', ({ prestige }) => prestige, 40)] },
  { id: 'treacherous', male: 'den Lömske', female: 'den Lömska', counts: [count('svek', deed('betrayal'), 4)] },
  { id: 'generous', male: 'den Givmilde', female: 'den Givmilda', counts: [count('generösa gärningar', deed('generous'), 3)] },
  { id: 'frail', male: 'den Bräcklige', female: 'den Bräckliga', counts: [count('sammanbrott', deed('breakdowns'), 1)] },
  { id: 'usurper', male: 'Tronrövaren', female: 'Tronrövaren', counts: [count('olaglig tronbestigning', ({ lawful }) => (lawful === false ? 1 : 0), 1, true)] },
  { id: 'quiet', male: 'den Stillsamme', female: 'den Stillsamma', counts: [count('månader på tronen', ({ months }) => months, 48)] },
].map((row) => Object.freeze({ ...row, counts: Object.freeze(row.counts),
  earned: (reign) => row.counts.some((entry) => entry.read(reign) >= entry.threshold) })));

// A strict find, so an id wrapped in a list is no id.
const rowOf = (nicknameId) => NICKNAMES.find((row) => row.id === nicknameId);
const recordOf = (state, personId) => state.nicknames.find((record) => record.personId === personId);
const labelFor = (row, person) => (person.sex === 'female' ? row.female : row.male);

/** The name a person carries, in the form that fits them, or null. */
export function nicknameOf(state, personId) {
  const record = recordOf(state, personId);
  return record ? labelFor(rowOf(record.nicknameId), state.people[personId]) : null;
}

const reignFacts = (state, months) => ({ deeds: state.reign.deeds, prestige: state.realm.prestige, lawful: state.reign.lawful, months });

function rowProgress(row, order, reign, ruler) {
  const counts = row.counts.map((entry) => ({ label: entry.label, value: Math.floor(entry.read(reign)), threshold: entry.threshold, binary: entry.binary }));
  const share = Math.max(...counts.map((entry) => Math.min(1, Math.max(0, entry.value) / entry.threshold)));
  return { id: row.id, label: labelFor(row, ruler), order, counts, share, earned: row.earned(reign) };
}

/** Reads only: how close the ruler without a name is to each row, in table order. null when there is no ruler or the ruler has a name. */
export function nicknameProgress(state, hooks) {
  const ruler = hooks.ruler();
  if (!ruler || recordOf(state, ruler.id)) return null;
  const months = reignMonths(state), reign = reignFacts(state, months);
  const rows = NICKNAMES.map((row, index) => rowProgress(row, index + 1, reign, ruler));
  return { rulerName: ruler.name, adult: hooks.adult(ruler), monthsLeft: Math.max(0, MONTHS_BEFORE_A_NAME - months),
    winnerId: rows.find((row) => row.earned)?.id ?? null, rows };
}

/** Yearly: gives an adult ruler without a name the first one the reign has earned, once it has lasted 24 months. */
export function nicknameStep(state, events, hooks) {
  const ruler = hooks.ruler(), months = reignMonths(state);
  if (!ruler || !hooks.adult(ruler) || recordOf(state, ruler.id) || months < MONTHS_BEFORE_A_NAME) return;
  const row = NICKNAMES.find((candidate) => candidate.earned(reignFacts(state, months)));
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
