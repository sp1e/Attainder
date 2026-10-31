import { addGameMonths, compareGameDates, normalizeGameDate, parseGameDate } from '../gameDates.js';
import { ADULT_AGE } from './content.js';

export const STORY_DIRECTOR_VERSION = 1;
export const CHARACTER_EVENT_TYPES = Object.freeze([
  'household_tension', 'promising_student', 'temple_petition', 'governor_audit',
  'veteran_petition', 'reconciliation', 'exile_help', 'returned_favor',
]);
const active = (person) => Boolean(person && !person.diedAt);
const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, n));
const has = (person, trait) => person.traits.includes(trait);
const publicAffairs = new Set(['governor_audit', 'veteran_petition']);
const ownedAffairs = new Set(['household_tension', 'promising_student', 'exile_help']);
const nextId = (state, prefix) => `${prefix}-${++state.storyDirector.sequence}`;
const isEvent = (story) => story.type === 'character_event';
function seed(value) { let n = 2166136261; for (const char of value) n = Math.imul(n ^ char.charCodeAt(0), 16777619); return n >>> 0 || 1; }
function draw(director) { let n = director.rngState | 0; n ^= n << 13; n ^= n >>> 17; n ^= n << 5; director.rngState = n >>> 0 || 1; return director.rngState / 4294967296; }

// Additive pre-release migration. Reading a save never draws randomness or
// invents historical events. This stream does not consume life/health RNG.
export function ensureStoryDirector(state) {
  if (!Object.hasOwn(state, 'storyDirector')) state.storyDirector = { version: STORY_DIRECTOR_VERSION,
    rngState: seed(`${state.rngState}:${state.identity.polityId}:stories-v1`),
    sequence: 0, cooldowns: {}, lastScheduledAt: null };
}

export function validateStoryDirector(state) {
  const d = state.storyDirector;
  if (!d || d.version !== STORY_DIRECTOR_VERSION || !Number.isInteger(d.rngState) || d.rngState < 1 || d.rngState > 0xffffffff
    || !Number.isSafeInteger(d.sequence) || d.sequence < 0 || !d.cooldowns || typeof d.cooldowns !== 'object' || Array.isArray(d.cooldowns)
    || (d.lastScheduledAt !== null && (!normalizeGameDate(d.lastScheduledAt) || compareGameDates(d.lastScheduledAt, state.date) > 0))) {
    throw new Error('Händelseurvalets sparade tillstånd eller version är ogiltigt.');
  }
  for (const [key, date] of Object.entries(d.cooldowns)) {
    const [kind, ...parts] = key.split(':'); const id = parts.join(':');
    if (!normalizeGameDate(date) || (kind === 'template' ? !CHARACTER_EVENT_TYPES.includes(id) : kind !== 'person' || !state.people[id])
      || compareGameDates(date, addGameMonths(state.date, kind === 'template' ? 36 : 24)) > 0) throw new Error('Händelseurvalets återhämtningstid är ogiltig.');
  }
  const ids = new Set();
  for (const story of state.stories.filter(isEvent)) {
    if (!/^character-story-[1-9]\d*$/.test(story.id) || ids.has(story.id) || Number(story.id.slice(16)) > d.sequence
      || !CHARACTER_EVENT_TYPES.includes(story.eventType) || !state.people[story.actorId] || !state.people[story.targetId]
      || !state.families[story.familyId] || !state.families[story.playerFamilyId]
      || !normalizeGameDate(story.createdAt) || !normalizeGameDate(story.dueAt)
      || compareGameDates(story.createdAt, state.date) > 0 || story.dueAt !== addGameMonths(story.createdAt, 12)
      || !['open', 'resolved', 'closed'].includes(story.status)
      || (story.status === 'open' && compareGameDates(story.dueAt, state.date) <= 0)
      || (story.causeId && !state.memories.some((memory) => memory.id === story.causeId))
      || (['reconciliation', 'returned_favor'].includes(story.eventType) && !story.causeId)
      || (story.eventType === 'temple_petition' && !state.religions[story.religionId])
      || (publicAffairs.has(story.eventType) && !state.offices[story.officeId])
      || (story.eventType === 'governor_audit' && !state.cities[story.cityId])
      || (story.eventType === 'exile_help' && !validCapturedHost(state, story))
      || (story.resolvedAt && (!normalizeGameDate(story.resolvedAt) || compareGameDates(story.resolvedAt, state.date) > 0 || compareGameDates(story.resolvedAt, story.createdAt) < 0))
      || (story.status !== 'open' && !story.resolvedAt)
      || (story.status === 'resolved' && !options(story).some((choice) => choice.id === story.choiceId))) {
      throw new Error('En karaktärshändelse har ogiltiga deltagare eller referenser.');
    }
    ids.add(story.id);
  }
  if (state.stories.filter((story) => isEvent(story) && story.status === 'open').length > 2) throw new Error('För många karaktärshändelser är öppna.');
  for (const memory of state.memories.filter((item) => item.type === 'story_patronage')) {
    const source = state.stories.find((story) => story.id === memory.storyId && isEvent(story));
    const patronageChoice = { household_tension: 'relieve', promising_student: 'teach', temple_petition: 'donate' };
    if (!Array.isArray(memory.participants) || memory.participants.length !== 2
      || memory.participants.some((id) => !state.people[id]) || !state.people[memory.beneficiaryId]
      || !state.families[memory.beneficiaryFamilyId] || !state.families[memory.sponsorFamilyId]
      || !source || source.status !== 'resolved' || source.outcomeMemoryId !== memory.id
      || source.choiceId !== patronageChoice[source.eventType] || !patronageChoice[source.eventType]
      || memory.causeId !== source.id || memory.beneficiaryId !== source.actorId
      || memory.beneficiaryFamilyId !== source.familyId || memory.sponsorFamilyId !== source.playerFamilyId
      || !memory.participants.includes(source.actorId) || !memory.participants.includes(source.targetId)
      || !normalizeGameDate(memory.date) || memory.date !== source.resolvedAt) {
      throw new Error('Ett patronageminne har ogiltigt ursprung eller ogiltiga deltagare.');
    }
  }
}

function validCapturedHost(state, story) {
  if (typeof story.hostId !== 'string' || !story.hostId.trim() || story.hostId.length > 160) return false;
  if (story.hostKind === 'family') return Boolean(state.families[story.hostId] && story.hostId !== story.playerFamilyId);
  if (story.hostKind !== 'polity') return false;
  // The foreign candidate list tracks the present world, not historical
  // polities. Closed/resolved offers retain their original host after its loss.
  return story.status !== 'open' || state.externalHosts.some((host) => host.id === story.hostId);
}

function acceptedHost(state, family) {
  if (!family?.exiled) return null;
  if (family.hostPolityId && state.externalHosts?.some((host) => host.id === family.hostPolityId)) {
    return { hostKind: 'polity', hostId: family.hostPolityId };
  }
  const host = state.families[family.hostFamilyId];
  return host && host.id !== family.id && !host.exiled && active(state.people[host.headId])
    ? { hostKind: 'family', hostId: host.id } : null;
}

export function directedStoryInvalidReason(state, story, context) {
  context = context.forEvent?.(story.eventType) || context;
  const person = state.people[story.actorId];
  if (!active(person)) return 'Den berörda personen har avlidit.';
  if (!active(context.actor) || context.age(context.actor) < ADULT_AGE) return 'En myndig företrädare saknas.';
  if (context.actor.id !== story.targetId || context.family?.id !== story.playerFamilyId) return 'Frågan gällde den tidigare företrädaren.';
  if (publicAffairs.has(story.eventType) && !context.canRule) return 'Du saknar nu mandat att avgöra rikets fråga.';
  if (ownedAffairs.has(story.eventType) && person.familyId !== context.family.id) return 'Personen tillhör inte längre ditt hushåll.';
  if (person.familyId !== story.familyId) return 'Personen företräder inte längre samma familj.';
  if (story.eventType === 'promising_student' && context.age(person) >= ADULT_AGE) return 'Eleven har blivit myndig.';
  if (story.eventType === 'temple_petition' && state.religions[story.religionId]?.leaderId !== person.id) return 'Samfundet har bytt företrädare.';
  if (publicAffairs.has(story.eventType) && state.offices[story.officeId]?.holderId !== person.id) return 'Ämbetet har bytt innehavare.';
  if (story.eventType === 'exile_help') {
    const host = acceptedHost(state, context.family);
    if (!host) return 'Familjen saknar nu en giltig beskyddare i exilen.';
    if (host.hostKind !== story.hostKind || host.hostId !== story.hostId) return 'Familjen har bytt beskyddare sedan frågan väcktes.';
  }
  return '';
}

function available(state, key) {
  const until = state.storyDirector.cooldowns[key];
  return !until || compareGameDates(until, state.date) <= 0;
}

// Each candidate names a real participant, a current trigger and, when
// applicable, the memory that caused it. Never fabricate a cast for a template.
export function getDirectedStoryCandidates(state, context) {
  if (context.forEvent) {
    const household = context.forEvent('household_tension'), royal = context.forEvent('governor_audit');
    if (household.actor?.id === royal.actor?.id) return getDirectedStoryCandidates(state, household);
    return [...getDirectedStoryCandidates(state, { ...household, canRule: false }),
      ...getDirectedStoryCandidates(state, royal).filter((candidate) => publicAffairs.has(candidate.eventType))];
  }
  if (state.status.ended || !active(context.actor) || !context.family || context.age(context.actor) < ADULT_AGE) return [];
  const candidates = [];
  const host = acceptedHost(state, context.family);
  const usedCauses = new Set(state.stories.filter((s) => isEvent(s) && s.status !== 'closed').map((s) => s.causeId).filter(Boolean));
  const add = (eventType, person, weight, title, description, why, extra = {}) => {
    if (!available(state, `template:${eventType}`) || !available(state, `person:${person.id}`)) return;
    candidates.push({ eventType, actorId: person.id, targetId: context.actor.id, playerFamilyId: context.family.id,
      familyId: person.familyId, weight, title, description, triggerDescription: why, ...extra });
  };
  for (const person of Object.values(state.people).filter(active).sort((a, b) => a.id.localeCompare(b.id))) {
    if (person.id === context.actor.id) continue;
    const age = context.age(person); const own = person.familyId === context.family.id;
    if (own && age >= ADULT_AGE && person.stress >= 25) add('household_tension', person, 2 + person.stress / 20 + (has(person, 'ambitious') ? 2 : 0),
      'Hushållets plikter väger tungt', `${person.name} ber om avlastning. Familjen behöver tjänsterna, men pressen skadar er relation.`,
      `${person.name} har ${Math.round(person.stress)} stress${has(person, 'ambitious') ? ' och egna ambitioner' : ''}.`);
    if (own && age >= 8 && age < ADULT_AGE) add('promising_student', person, 2 + (has(context.actor, 'curious') ? 3 : 0) + (context.actor.archetype === 'scholar' ? 3 : 0),
      'En ung begåvning söker stöd', `${person.name} vill ägna mer tid åt studier. Extra undervisning kostar familjen silver och kan få betydelse efter myndighetsdagen.`,
      `${person.name} är ${age} år och befinner sig i sin utbildning.`);
    if (age < ADULT_AGE) continue;
    const religion = state.religions[person.religionId];
    if (religion?.leaderId === person.id && (religion.support <= 60 || has(context.actor, 'zealous'))) add('temple_petition', person,
      2 + (has(context.actor, 'zealous') ? 4 : 0), 'En begäran från templet',
      `${person.name} söker familjens bidrag till ${religion.name}. En gåva stärker både samfundets ställning och er personliga förbindelse.`,
      `${religion.name} har ${Math.round(religion.support)} grundstöd.`, { religionId: religion.id });
    if (context.canRule) {
      for (const office of Object.values(state.offices).filter((o) => o.holderId === person.id).sort((a, b) => a.id.localeCompare(b.id))) {
        const city = state.cities[office.cityId];
        if (office.kind === 'governor' && city?.unrest >= 15) add('governor_audit', person, 2 + city.unrest / 15 + (has(person, 'greedy') ? 3 : 0),
          'Missnöje under guvernörens styre', `Invånare i ${city.name} kräver åtgärder. ${person.name} begär pengar till förbättringar och motsätter sig en offentlig tillrättavisning.`,
          `${city.name} har ${Math.round(city.unrest)} oro.`, { officeId: office.id, cityId: city.id });
        if (office.kind === 'general' && state.realm.armyStrength < 80) add('veteran_petition', person,
          2 + (context.actor.archetype === 'commander' ? 4 : 0), 'Veteranerna kräver erkännande',
          `${person.name} framför soldaternas krav på ersättning. Du kan betala ur statskassan eller kräva mer tjänst.`,
          `Arméns grundstyrka är ${Math.round(state.realm.armyStrength)}.`, { officeId: office.id });
      }
    }
    if (own && host) add('exile_help', person,
      3 + (has(person, 'gregarious') ? 3 : 0), 'Bygg en ställning i exilen',
      `${person.name} vill söka upp beskyddarens kontakter. Familjens kassa kan bekosta besöken och stärka ert inflytande.`,
      'Familjen lever i exil under en accepterad beskyddare.', host);
    for (const m of state.memories.slice(-1000)) {
      if (usedCauses.has(m.id) || (m.knownBy !== 'public' && !m.knownBy?.includes(context.actor.id))) continue;
      if (['betrayal', 'insult', 'story_fracture'].includes(m.type) && m.participants.includes(person.id) && m.participants.includes(context.actor.id)) {
        add('reconciliation', person, 3 + (has(context.actor, 'compassionate') ? 3 : 0), 'Ett gammalt sår kan läka',
          `${person.name} återkommer till ”${m.title}”. Ni kan söka försoning eller låta motsättningarna bestå.`,
          `Ett minne från ${m.date} påverkar relationen.`, { causeId: m.id });
      }
      if (m.type === 'story_patronage' && m.beneficiaryFamilyId === person.familyId && m.sponsorFamilyId === context.family.id
        && state.people[m.beneficiaryId]
        && compareGameDates(addGameMonths(m.date, 36), state.date) <= 0
        && (active(state.people[m.beneficiaryId]) ? m.beneficiaryId === person.id : state.families[person.familyId].headId === person.id)) {
        add('returned_favor', person, 5, 'En tidigare tjänst blir ihågkommen',
          `${person.name} vill återgälda ”${m.title}”. Förbindelsen består även om den ursprungliga givaren eller mottagaren har avlidit.`,
          `Familjens stöd från ${m.date} ligger till grund för erbjudandet.`, { causeId: m.id });
      }
    }
  }
  return candidates;
}

export function scheduleDirectedStory(state, events, context, emit) {
  ensureStoryDirector(state);
  const d = state.storyDirector;
  if (d.lastScheduledAt && parseGameDate(d.lastScheduledAt).year === parseGameDate(state.date).year) return null;
  if (state.stories.filter((s) => isEvent(s) && s.status === 'open').length >= 2) return null;
  const candidates = getDirectedStoryCandidates(state, context);
  if (!candidates.length) return null;
  let ticket = draw(d) * candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  const selected = candidates.find((candidate) => (ticket -= candidate.weight) < 0) || candidates.at(-1);
  const { weight: _weight, ...details } = selected;
  const story = { ...details, id: nextId(state, 'character-story'), type: 'character_event', status: 'open',
    createdAt: state.date, dueAt: addGameMonths(state.date, 12), knownBy: 'public' };
  state.stories.push(story);
  d.lastScheduledAt = state.date;
  d.cooldowns[`template:${story.eventType}`] = addGameMonths(state.date, 36);
  d.cooldowns[`person:${story.actorId}`] = addGameMonths(state.date, 24);
  emit(state, events, 'story', story.title, `${story.description} ${story.triggerDescription}`, [story.actorId, story.targetId]);
  return story;
}

const option = (id, label, description, amount = 0, tag = 'neutral', publicFunds = false) => ({ id, label, description, amount, tag, publicFunds });
function options(story) {
  switch (story.eventType) {
    case 'household_tension': return [option('relieve', 'Bekosta avlastning', 'Personens stress −20; personlig åsikt +10. Stödet kan återgäldas senare.', 12, 'generous'), option('demand', 'Kräv fortsatt tjänst', 'Personens stress +10; personlig åsikt −10; familjens inflytande +3.', 0, 'cruel'), option('ignore', 'Låt frågan vila', 'Personens stress +5; personlig åsikt −3.')];
    case 'promising_student': return [option('teach', 'Betala för extra undervisning', 'Lärdom +1; personlig åsikt +10. Stödet kan återgäldas i vuxen ålder.', 18, 'generous'), option('ignore', 'Behåll nuvarande utbildning', 'Personlig åsikt −3. Den ordinarie utbildningen fortsätter.')];
    case 'temple_petition': return [option('donate', 'Ge en familjegåva', 'Samfundets grundstöd +5; personlig åsikt +12. Gåvan kan återgäldas senare.', 20, 'generous'), option('ignore', 'Avböj bidraget', 'Personlig åsikt −8.')];
    case 'governor_audit': return [option('repair', 'Finansiera förbättringar', 'Stadens oro −12; infrastruktur +1; guvernörens åsikt +8.', 25, 'duty', true), option('censure', 'Tillrättavisa guvernören', 'Stadens oro −4; guvernörens åsikt −15; familjens stödorsak −4.', 0, 'cruel', true), option('ignore', 'Lämna förvaltningen orörd', 'Stadens oro +4.', 0, 'neutral', true)];
    case 'veteran_petition': return [option('pay', 'Betala veteranerna', 'Arméns grundstyrka +5; befälhavarens åsikt +10.', 22, 'generous', true), option('drill', 'Kräv ytterligare tjänst', 'Arméns grundstyrka +2; befälhavarens stress +8 och åsikt −8.', 0, 'risky', true), option('ignore', 'Avvisa kravet', 'Arméns grundstyrka −2; befälhavarens åsikt −5.', 0, 'neutral', true)];
    case 'reconciliation': return [option('reconcile', 'Sök försoning med en gåva', 'Personlig åsikt +18; den berörda familjens stödorsak +4. Det gamla minnet finns kvar.', 15, 'generous'), option('ignore', 'Avböj försoningen', 'Personlig åsikt −5.')];
    case 'exile_help': return [option('network', 'Bekosta besöken', 'Familjens inflytande +5; personlig åsikt +8. Beskyddaren och tronen förändras inte.', 10, 'duty'), option('ignore', 'Spara familjens resurser', 'Familjens inflytande −2.')];
    case 'returned_favor': return [option('silver', 'Ta emot tolv silver', '12 silver flyttas från givarens personliga förmögenhet till familjekassan.'), option('endorse', 'Be om ett offentligt stöd', 'Familjens inflytande +6; personlig åsikt +5.'), option('ignore', 'Lös personen från förpliktelsen', 'Personlig åsikt +4. Tjänsten räknas som återgäldad.')];
    default: return [];
  }
}

export function directedStoryChoices(state, story, context) {
  context = context.forEvent?.(story.eventType) || context;
  const invalid = directedStoryInvalidReason(state, story, context);
  return options(story).map((choice) => ({ id: choice.id, label: choice.label, description: choice.description,
    cost: choice.amount ? `${choice.amount} ${choice.publicFunds ? 'silver ur statskassan' : 'familjesilver'}` : '0 silver',
    stress: String(context.stress(choice.tag)),
    disabledReason: invalid || (choice.publicFunds && !context.canRule ? 'Kräver härskarmandat.' : '')
      || ((choice.publicFunds ? state.realm.treasury : context.family?.treasury || 0) < choice.amount ? 'Otillräckliga medel.' : '')
      || (choice.id === 'silver' && state.people[story.actorId].wealth < 12 ? 'Givaren saknar tolv egna silver.' : '') }));
}

export function resolveDirectedStory(state, story, choiceId, context, hooks) {
  context = context.forEvent?.(story.eventType) || context;
  const choice = options(story).find((item) => item.id === choiceId);
  const descriptor = directedStoryChoices(state, story, context).find((item) => item.id === choiceId);
  if (!choice || !descriptor || descriptor.disabledReason) throw new Error(descriptor?.disabledReason || 'Valet är ogiltigt.');
  hooks.spend(choice.amount, choice.publicFunds, choice.tag);
  const person = state.people[story.actorId]; const family = state.families[person.familyId];
  let opinion = 0; let kind = 'story_choice';
  switch (`${story.eventType}:${choiceId}`) {
    case 'household_tension:relieve': person.stress = clamp(person.stress - 20, 0, 200); opinion = 10; kind = 'story_patronage'; break;
    case 'household_tension:demand': person.stress = clamp(person.stress + 10, 0, 200); context.family.influence = clamp(context.family.influence + 3); opinion = -10; kind = 'story_fracture'; break;
    case 'household_tension:ignore': person.stress = clamp(person.stress + 5, 0, 200); opinion = -3; break;
    case 'promising_student:teach': person.skills.learning = Math.min(20, person.skills.learning + 1); opinion = 10; kind = 'story_patronage'; break;
    case 'promising_student:ignore': opinion = -3; break;
    case 'temple_petition:donate': state.religions[story.religionId].support = clamp(state.religions[story.religionId].support + 5); opinion = 12; kind = 'story_patronage'; break;
    case 'temple_petition:ignore': opinion = -8; break;
    case 'governor_audit:repair': state.cities[story.cityId].unrest = clamp(state.cities[story.cityId].unrest - 12); state.cities[story.cityId].infrastructure++; opinion = 8; break;
    case 'governor_audit:censure': state.cities[story.cityId].unrest = clamp(state.cities[story.cityId].unrest - 4); family.grievance = clamp(family.grievance - 4, -40, 40); opinion = -15; kind = 'story_fracture'; break;
    case 'governor_audit:ignore': state.cities[story.cityId].unrest = clamp(state.cities[story.cityId].unrest + 4); break;
    case 'veteran_petition:pay': state.realm.armyStrength = clamp(state.realm.armyStrength + 5); opinion = 10; break;
    case 'veteran_petition:drill': state.realm.armyStrength = clamp(state.realm.armyStrength + 2); person.stress = clamp(person.stress + 8, 0, 200); opinion = -8; kind = 'story_fracture'; break;
    case 'veteran_petition:ignore': state.realm.armyStrength = clamp(state.realm.armyStrength - 2); opinion = -5; break;
    case 'reconciliation:reconcile': opinion = 18; family.grievance = clamp(family.grievance + 4, -40, 40); break;
    case 'reconciliation:ignore': opinion = -5; break;
    case 'exile_help:network': context.family.influence = clamp(context.family.influence + 5); opinion = 8; break;
    case 'exile_help:ignore': context.family.influence = clamp(context.family.influence - 2); break;
    case 'returned_favor:silver': person.wealth -= 12; context.family.treasury += 12; break;
    case 'returned_favor:endorse': context.family.influence = clamp(context.family.influence + 6); opinion = 5; break;
    case 'returned_favor:ignore': opinion = 4; break;
  }
  const m = hooks.memory(kind, `${story.title}: ${choice.label}`, [person.id, context.actor.id], {
    causeId: story.causeId || story.id, storyId: story.id, beneficiaryId: person.id,
    beneficiaryFamilyId: person.familyId, sponsorFamilyId: context.family.id,
  });
  if (opinion) hooks.opinion(person.id, context.actor.id, opinion, choice.label, m.id);
  story.outcomeMemoryId = m.id;
}

export function refreshDirectedStories(state, events, context, hooks) {
  for (const story of state.stories.filter((s) => isEvent(s) && s.status === 'open')) {
    const reason = directedStoryInvalidReason(state, story, context);
    if (reason) {
      story.status = 'closed'; story.resolvedAt = state.date; story.resolution = reason;
      hooks.emit(state, events, 'story_closed', story.title, reason, [story.actorId, story.targetId]);
    } else if (compareGameDates(state.date, story.dueAt) >= 0) {
      hooks.resolve(story, 'ignore');
      story.automatic = true;
    }
  }
}
