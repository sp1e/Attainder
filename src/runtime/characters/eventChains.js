import content from './eventChainContent.js';
import { addGameMonths, compareGameDates, normalizeGameDate, parseGameDate } from '../gameDates.js';
import { canExerciseMandate, getCharacterAge } from './characterCapacity.js';

export const EVENT_CHAIN_VERSION = 1;
export const EVENT_CHAIN_TEMPLATES = Object.freeze(Object.fromEntries(content.map((entry) => [entry.id, entry])));
export const EVENT_CHAIN_ROLES = Object.freeze({
  sickroom_seal: ['principal', 'regent', 'steward'], returned_seal: ['principal', 'formerRegent'],
  heir_margin: ['child', 'mentor'], temple_steps: ['governor', 'religiousLeader'],
  veterans_honor: ['veteran', 'commander'], rival_office_grievance: ['petitioner', 'officeHolder'],
  exile_contacts: ['envoy', 'hostHead'], family_letter: ['deceased', 'participant'],
});
const active = (person) => Boolean(person && !person.diedAt);
const clamp = (n, min = 0, max = 100) => Math.min(max, Math.max(min, n));
const canonical = (date) => typeof date === 'string' && Boolean(date) && normalizeGameDate(date) === date;
const isStep = (story) => story.type === 'event_chain';
const stageFor = (record, stageId) => EVENT_CHAIN_TEMPLATES[record.templateId]?.stages.find((stage) => stage.id === stageId);
const lastStep = (state, record) => state.stories.find((story) => story.id === record.stepIds.at(-1));
const sourceUsed = (state, key) => state.eventChains.records.some((record) => record.sourceKey === key);
const peopleIn = (state, familyId) => Object.values(state.people).filter((person) => active(person) && person.familyId === familyId).sort((a, b) => a.id.localeCompare(b.id));
function seeded(value) { let n = 2166136261; for (const c of value) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return n >>> 0 || 1; }
function draw(director) { let n = director.rngState | 0; n ^= n << 13; n ^= n >>> 17; n ^= n << 5; director.rngState = n >>> 0 || 1; return director.rngState / 4294967296; }

/** Neutral migration: no casts, history, branches or random draws on load. */
export function ensureEventChains(state) {
  if (!Object.hasOwn(state, 'eventChains')) state.eventChains = { version: EVENT_CHAIN_VERSION,
    activatedAt: state.date, rngState: seeded(`${state.rngState}:${state.identity.polityId}:chains-v1`),
    sequence: 0, records: [], cooldowns: {}, lastScheduledAt: null };
}

function render(state, record, text) {
  return text.replace(/\{([^}]+)\}/g, (_, role) => {
    const name = state.people[record.roles[role]]?.name || (role === 'family' ? state.families[record.ownerFamilyId]?.name :
      role === 'city' ? state.cities[record.refs.cityId]?.name : role === 'religion' ? state.religions[record.refs.religionId]?.name :
        role === 'office' ? state.offices[record.refs.officeId]?.name : role === 'rivalFamily' ? state.families[record.refs.rivalFamilyId]?.name :
          role === 'hostFamily' ? state.families[record.refs.hostFamilyId]?.name : null);
    if (!name) throw new Error(`Händelsekedjan saknar rollen ${role}.`);
    return name;
  });
}

/** Cast only observed people, offices and public history. No invented claims. */
export function getEventChainCandidates(state, context) {
  if (state.status.ended) return [];
  const family = context.forScope('family').family;
  if (!family) return [];
  const household = context.forScope('family').actor, royal = context.forScope('public').actor;
  const own = peopleIn(state, family.id), adults = own.filter((p) => canExerciseMandate(p, state.date));
  const result = [];
  const add = (templateId, roles, refs, sourceKey, weight = 1, sourceMemoryId = null) => {
    if (!EVENT_CHAIN_TEMPLATES[templateId] || sourceUsed(state, sourceKey) ||
        (state.eventChains.cooldowns[templateId] && compareGameDates(state.eventChains.cooldowns[templateId], state.date) > 0)) return;
    if (state.eventChains.records.some((record) => ['open', 'waiting'].includes(record.status) &&
      Object.values(record.roles).some((id) => Object.values(roles).includes(id)))) return;
    result.push({ templateId, roles, refs, ownerFamilyId: family.id, sourceKey, sourceMemoryId, weight });
  };
  const mandate = state.regencies['office:ruler'];
  if (household && mandate?.basis === 'incapacity' && mandate.phase === 'incapacity' && active(state.people[mandate.regentId]) && state.people[mandate.principalId]?.familyId === family.id) {
    const steward = adults.find((p) => p.id !== household.id && p.id !== mandate.regentId && p.stress >= 25 && context.related(p.id, mandate.principalId));
    if (steward) add('sickroom_seal', { principal: mandate.principalId, regent: mandate.regentId, steward: steward.id },
      { episodeId: mandate.episodeId }, `sickroom:${mandate.episodeId}`, 4);
  }
  if (mandate?.basis === 'incapacity' && mandate.phase === 'ended' && canExerciseMandate(state.people[mandate.principalId], state.date) && active(state.people[mandate.regentId]) &&
      state.offices.ruler.holderId === mandate.principalId && (household || royal)) {
    add('returned_seal', { principal: mandate.principalId, formerRegent: mandate.regentId }, { episodeId: mandate.episodeId }, `return:${mandate.episodeId}`, state.people[mandate.regentId].traits.includes('ambitious') ? 4 : 2);
  }
  if (household) for (const child of own.filter((p) => getCharacterAge(p, state.date) >= 8 && getCharacterAge(p, state.date) < 18)) {
    if (canExerciseMandate(state.people[child.mentorId], state.date)) add('heir_margin', { child: child.id, mentor: child.mentorId }, {},
      `education:${child.id}:${child.mentorId}`, child.traits.includes('ambitious') ? 3 : 2);
  }
  for (const city of Object.values(state.cities).sort((a, b) => a.id.localeCompare(b.id))) {
    const governor = state.people[state.offices[city.governorOfficeId]?.holderId];
    const religion = state.religions[state.families[city.familyId]?.religionId];
    const priest = state.people[religion?.leaderId];
    if (city.unrest >= 15 && active(governor) && active(priest) && priest.id !== governor.id && (household || royal))
      add('temple_steps', { governor: governor.id, religiousLeader: priest.id }, { cityId: city.id, officeId: city.governorOfficeId, religionId: religion.id },
        `temple:${city.id}:${governor.id}:${priest.id}`, 1 + city.unrest / 50);
  }
  const general = state.people[state.offices.general.holderId];
  if (active(general) && (household || royal)) for (const veteran of adults.filter((p) => p.id !== general.id)) {
    const service = state.offices.general.history.find((item) => item.personId === veteran.id);
    if (service) add('veterans_honor', { veteran: veteran.id, commander: general.id }, { officeId: 'general', serviceDate: service.date },
      `service:${veteran.id}:${service.date}`, veteran.traits.includes('dutiful') ? 3 : 1);
  }
  const actor = household || royal;
  if (actor) for (const other of Object.values(state.families).filter((f) => f.id !== family.id && !f.exiled).sort((a, b) => a.id.localeCompare(b.id))) {
    const petitioner = state.people[other.headId];
    const office = Object.values(state.offices).find((item) => item.kind !== 'ruler' && active(state.people[item.holderId]) && item.holderId !== petitioner?.id);
    if (canExerciseMandate(petitioner, state.date) && office && context.opinion(petitioner.id, actor.id) < -10)
      add('rival_office_grievance', { petitioner: petitioner.id, officeHolder: office.holderId }, { officeId: office.id, rivalFamilyId: other.id },
        `rival:${other.id}:${office.id}:${office.holderId}`, petitioner.traits.includes('ambitious') ? 3 : 1);
  }
  const host = state.families[family.hostFamilyId], hostHead = state.people[host?.headId];
  if (household && family.exiled && host && !host.exiled && active(hostHead)) {
    const envoy = adults.find((p) => p.id !== household.id && context.related(p.id, hostHead.id));
    if (envoy) add('exile_contacts', { envoy: envoy.id, hostHead: hostHead.id }, { hostFamilyId: host.id }, `exile:${family.id}:${host.id}:${envoy.id}`, 3);
  }
  if (household) for (const m of state.memories.filter((item) => item.type === 'story_patronage' && item.knownBy === 'public')) {
    const deceased = m.participants.map((id) => state.people[id]).find((p) => p?.diedAt && p.familyId === family.id);
    const participant = m.participants.map((id) => state.people[id]).find((p) => active(p) && p.id !== household.id);
    if (deceased && participant) add('family_letter', { deceased: deceased.id, participant: participant.id }, {}, `letter:${m.id}`, 2, m.id);
  }
  return result;
}

export function eventChainInvalidReason(state, record, context) {
  if (context.forScope('family').family?.id !== record.ownerFamilyId) return 'Kedjan tillhör en tidigare spelarfamilj.';
  for (const [role, id] of Object.entries(record.roles)) {
    const person = state.people[id];
    if (!person || (role !== 'deceased' && !active(person))) return 'En av kedjans deltagare har avlidit.';
    if (person.familyId !== record.roleFamilies[role]) return 'En bunden deltagare har lämnat sin familj.';
  }
  const r = record.refs, p = record.roles;
  if (r.officeId && (!state.realm.alive || state.offices[r.officeId]?.holderId !== (p.governor || p.commander || p.officeHolder))) return 'Det berörda ämbetet har bytt innehavare.';
  if (r.religionId && state.religions[r.religionId]?.leaderId !== p.religiousLeader) return 'Samfundet har bytt företrädare.';
  if (record.templateId === 'sickroom_seal') {
    const mandate = state.regencies['office:ruler'];
    if (mandate?.episodeId !== r.episodeId || mandate.phase !== 'incapacity' || mandate.regentId !== p.regent) return 'Sjukdomens regentperiod har förändrats eller avslutats.';
  }
  if (record.templateId === 'returned_seal' && (state.offices.ruler.holderId !== p.principal || !canExerciseMandate(state.people[p.principal], state.date))) return 'Den återvändande härskaren utövar inte längre sitt mandat.';
  if (record.templateId === 'heir_margin' && (getCharacterAge(state.people[p.child], state.date) >= 18 || state.people[p.child].mentorId !== p.mentor)) return 'Utbildningsförhållandet har förändrats.';
  if (r.rivalFamilyId && state.families[r.rivalFamilyId]?.exiled) return 'Den berörda familjen har gått i exil.';
  if (r.hostFamilyId) {
    const family = state.families[record.ownerFamilyId], host = state.families[r.hostFamilyId];
    if (!family.exiled || family.hostFamilyId !== host?.id || host.exiled || host.headId !== p.hostHead) return 'Familjens accepterade beskyddare har förändrats.';
  }
  return '';
}

function openStep(state, record, stageId, events, hooks) {
  const stage = stageFor(record, stageId);
  const variant = stage.variants.find((item) => record.flags[item.when.flag] === item.when.equals);
  const previous = lastStep(state, record);
  const story = { id: `${record.id}-step-${record.stepIds.length + 1}`, type: 'event_chain', chainId: record.id, stageId,
    actorId: Object.values(record.roles).find((id) => active(state.people[id])), familyId: record.ownerFamilyId,
    title: render(state, record, stage.title), description: render(state, record, variant?.prompt || stage.prompt),
    causeId: previous?.outcomeMemoryId || record.originMemoryId, createdAt: state.date, dueAt: addGameMonths(state.date, 12), status: 'open', knownBy: 'public' };
  state.stories.push(story); record.stepIds.push(story.id); record.status = 'open'; record.nextAt = null; record.nextStageId = null;
  hooks.emit(state, events, 'story', story.title, story.description, Object.values(record.roles));
  return story;
}

export function scheduleEventChain(state, events, context, hooks) {
  ensureEventChains(state);
  const director = state.eventChains;
  if (director.lastScheduledAt && parseGameDate(director.lastScheduledAt).year === parseGameDate(state.date).year) return null;
  if (director.records.filter((record) => ['open', 'waiting'].includes(record.status)).length >= 2) return null;
  const candidates = getEventChainCandidates(state, context);
  if (!candidates.length) return null;
  let ticket = draw(director) * candidates.reduce((n, candidate) => n + candidate.weight, 0);
  const selected = candidates.find((candidate) => (ticket -= candidate.weight) < 0) || candidates.at(-1);
  const { weight: _weight, ...binding } = selected;
  const record = { ...binding, id: `chain-${++director.sequence}`, createdAt: state.date, status: 'open',
    roleFamilies: Object.fromEntries(Object.entries(binding.roles).map(([role, id]) => [role, state.people[id].familyId])),
    stepIds: [], flags: {}, nextAt: null, nextStageId: null, closedAt: null, reason: null };
  const origin = hooks.memory('chain_origin', EVENT_CHAIN_TEMPLATES[record.templateId].title, Object.values(record.roles), {
    chainId: record.id, causeId: record.sourceMemoryId || null, sourceKey: record.sourceKey, knownBy: 'public' });
  record.originMemoryId = origin.id;
  director.records.push(record); director.lastScheduledAt = state.date; director.cooldowns[record.templateId] = addGameMonths(state.date, 60);
  return openStep(state, record, EVENT_CHAIN_TEMPLATES[record.templateId].stages[0].id, events, hooks);
}

export function eventChainChoices(state, story, context) {
  const record = state.eventChains.records.find((entry) => entry.id === story.chainId);
  if (!record) return [];
  const invalid = eventChainInvalidReason(state, record, context);
  return stageFor(record, story.stageId).choices.map((choice) => {
    const scoped = context.forScope(choice.scope);
    const wallet = choice.scope === 'public' ? state.realm : scoped.family;
    const flagReason = (choice.requires || []).some((rule) => record.flags[rule.flag] !== rule.equals) ? choice.availabilityReason : '';
    const selfOpinion = choice.effects.some((effect) => effect.kind === 'opinion' && record.roles[effect.target] === scoped.actor?.id);
    const disabledReason = choice.id === 'close' ? '' : invalid || flagReason ||
      (!canExerciseMandate(scoped.actor, state.date) ? 'En handlingsförmögen företrädare saknas.' : '') ||
      (choice.scope === 'public' && !scoped.canRule ? 'Kräver härskarmandat.' : '') ||
      (selfOpinion ? 'Detta val kräver en annan person som mottagare.' : '') ||
      (!wallet || wallet.treasury < choice.amount ? 'Otillräckliga medel i rätt kassa.' : '');
    return { id: choice.id, label: render(state, record, choice.label), description: render(state, record, choice.description),
      cost: choice.amount ? `${choice.amount} ${choice.scope === 'public' ? 'silver ur statskassan' : 'familjesilver'} · 0 handlingar` : '0 silver · 0 handlingar',
      stress: String(choice.id === 'close' ? 0 : scoped.stress(choice.tag) + choice.effects.filter((e) => e.kind === 'stress' && e.target === 'decisionActor').reduce((n, e) => n + e.delta, 0)),
      actorId: choice.id === 'close' ? null : scoped.actor?.id || null, actorName: choice.id === 'close' ? null : scoped.actor?.name || null,
      scope: choice.scope, disabledReason };
  });
}

function applyEffect(state, record, effect, actor, memory, hooks) {
  const person = effect.target === 'decisionActor' ? actor : state.people[record.roles[effect.target]];
  switch (effect.kind) {
    case 'stress': person.stress = clamp(person.stress + effect.delta, 0, 200); break;
    case 'skill': person.skills[effect.skill] = clamp(person.skills[effect.skill] + effect.delta, 0, 20); break;
    case 'opinion': hooks.opinion(person.id, actor.id, effect.delta, memory.title, memory.id); break;
    case 'familyInfluence': state.families[record.ownerFamilyId].influence = clamp(state.families[record.ownerFamilyId].influence + effect.delta); break;
    case 'familyGrievance': state.families[record.ownerFamilyId].grievance = clamp(state.families[record.ownerFamilyId].grievance + effect.delta, -40, 40); break;
    case 'armyStrength': state.realm.armyStrength = clamp(state.realm.armyStrength + effect.delta); break;
    case 'unrest': state.cities[record.refs.cityId].unrest = clamp(state.cities[record.refs.cityId].unrest + effect.delta); break;
    case 'infrastructure': state.cities[record.refs.cityId].infrastructure += effect.delta; break;
    case 'religionSupport': state.religions[record.refs.religionId].support = clamp(state.religions[record.refs.religionId].support + effect.delta); break;
    default: throw new Error('Okänd kedjeeffekt.');
  }
}

export function resolveEventChain(state, story, choiceId, events, context, hooks) {
  const record = state.eventChains.records.find((entry) => entry.id === story.chainId);
  if (!record || record.status !== 'open' || story.status !== 'open' || record.stepIds.at(-1) !== story.id) throw new Error('Kedjesteget är redan avgjort.');
  const stage = stageFor(record, story.stageId), choice = stage.choices.find((item) => item.id === choiceId);
  const display = eventChainChoices(state, story, context).find((item) => item.id === choiceId);
  if (!choice || !display || display.disabledReason) throw new Error(display?.disabledReason || 'Ogiltigt kedjeval.');
  const actor = choiceId === 'close' ? null : hooks.spend(choice.amount, choice.scope === 'public', choice.tag);
  const m = hooks.memory('chain_choice', `${story.title}: ${display.label}`, [...new Set([...Object.values(record.roles), actor?.id].filter(Boolean))],
    { chainId: record.id, storyId: story.id, causeId: story.causeId, decisionActorId: actor?.id || null, choiceId, knownBy: 'public' });
  for (const effect of choice.effects) applyEffect(state, record, effect, actor, m, hooks);
  Object.assign(record.flags, choice.flags);
  Object.assign(story, { status: 'resolved', choiceId, resolvedAt: state.date, outcomeMemoryId: m.id, decisionActorId: actor?.id || null, resolution: display.label });
  if (choice.next) { record.status = 'waiting'; record.nextStageId = choice.next; record.nextAt = addGameMonths(state.date, stage.delayMonths); }
  else { record.status = choiceId === 'close' ? 'closed' : 'resolved'; record.closedAt = state.date; record.reason = choiceId === 'close' ? 'Spelaren avslutade kedjan.' : 'Kedjan är avslutad.'; }
  hooks.emit(state, events, 'story_choice', story.title, display.description, [...Object.values(record.roles), actor?.id].filter(Boolean));
}

export function refreshEventChains(state, events, context, hooks) {
  ensureEventChains(state);
  for (const record of state.eventChains.records.filter((entry) => ['open', 'waiting'].includes(entry.status))) {
    const story = lastStep(state, record);
    const reason = eventChainInvalidReason(state, record, context) || (story.status === 'open' && compareGameDates(state.date, story.dueAt) >= 0 ? 'Svarstiden löpte ut. Inget val eller någon betalning gjordes.' : '');
    if (reason) {
      record.status = 'closed'; record.closedAt = state.date; record.reason = reason; record.nextAt = null; record.nextStageId = null;
      if (story.status === 'open') Object.assign(story, { status: 'closed', resolvedAt: state.date, resolution: reason });
      hooks.emit(state, events, 'story_closed', story.title, reason, Object.values(record.roles));
    } else if (record.status === 'waiting' && compareGameDates(record.nextAt, state.date) <= 0) openStep(state, record, record.nextStageId, events, hooks);
  }
}

export function getEventChainDates(state) {
  return [...(state.eventChains?.records || []).filter((record) => record.status === 'waiting').map((record) => record.nextAt),
    ...state.stories.filter((story) => isStep(story) && story.status === 'open').map((story) => story.dueAt)];
}

export function presentEventChain(state, story) {
  const record = state.eventChains.records.find((entry) => entry.id === story.chainId);
  return { chainTitle: EVENT_CHAIN_TEMPLATES[record.templateId].title, chainId: record.id, stepNumber: record.stepIds.indexOf(story.id) + 1,
    deadlineText: 'Utan svar avslutas kedjan vid tidsgränsen. Ingen betalning eller något automatiskt val görs.',
    nextAt: record.nextAt, previousChoices: record.stepIds.map((id) => state.stories.find((item) => item.id === id)).filter((item) => item.status === 'resolved')
      .map((item) => ({ title: item.title, choice: item.resolution, date: item.resolvedAt, actorName: state.people[item.decisionActorId]?.name || null })),
    causeTitle: state.memories.find((m) => m.id === record.sourceMemoryId)?.title || null };
}

export function presentEventChainHistory(state, familyId) {
  const labels = { open: 'Beslut väntar', waiting: 'Inväntar nästa steg', resolved: 'Avslutad', closed: 'Avskriven' };
  return (state.eventChains?.records || []).filter((record) => record.ownerFamilyId === familyId).map((record) => ({
    id: record.id, title: EVENT_CHAIN_TEMPLATES[record.templateId].title, status: record.status, statusLabel: labels[record.status],
    nextAt: record.nextAt, reason: record.reason, steps: record.stepIds.map((id) => state.stories.find((story) => story.id === id))
      .filter((story) => story.status !== 'open').map((story) => ({ title: story.title, choice: story.resolution, date: story.resolvedAt, actorName: state.people[story.decisionActorId]?.name || null })),
  }));
}

export function validateEventChains(state) {
  const d = state.eventChains;
  if (!d || d.version !== EVENT_CHAIN_VERSION || !canonical(d.activatedAt) || compareGameDates(d.activatedAt, state.date) > 0 ||
      !Number.isInteger(d.rngState) || d.rngState < 1 || d.rngState > 0xffffffff || !Number.isSafeInteger(d.sequence) || d.sequence < 0 ||
      !Array.isArray(d.records) || !d.cooldowns || typeof d.cooldowns !== 'object' || Array.isArray(d.cooldowns) ||
      (d.lastScheduledAt !== null && (!canonical(d.lastScheduledAt) || compareGameDates(d.lastScheduledAt, state.date) > 0))) throw new Error('Kedjedirektorns version eller sparade tillstånd är ogiltigt.');
  for (const [template, date] of Object.entries(d.cooldowns)) if (!EVENT_CHAIN_TEMPLATES[template] || !canonical(date) || compareGameDates(date, addGameMonths(state.date, 60)) > 0) throw new Error('En kedjas återhämtningstid är ogiltig.');
  const recordIds = new Set(), stepIds = new Set(), sources = new Set();
  for (const record of d.records) {
    const template = EVENT_CHAIN_TEMPLATES[record.templateId];
    if (!template || !/^chain-[1-9]\d*$/.test(record.id) || Number(record.id.slice(6)) > d.sequence || recordIds.has(record.id) ||
        !state.families[record.ownerFamilyId] || !canonical(record.createdAt) || compareGameDates(record.createdAt, state.date) > 0 ||
        !['open', 'waiting', 'resolved', 'closed'].includes(record.status) || !record.roles || !Object.keys(record.roles).length ||
        !record.roleFamilies || !record.refs || !record.flags || !Array.isArray(record.stepIds) || !record.stepIds.length || record.stepIds.length > template.stages.length ||
        typeof record.sourceKey !== 'string' || !record.sourceKey || record.sourceKey.length > 500 || sources.has(record.sourceKey)) throw new Error('En händelsekedja har ogiltig identitet eller historik.');
    recordIds.add(record.id); sources.add(record.sourceKey);
    if (JSON.stringify(Object.keys(record.roles).sort()) !== JSON.stringify([...EVENT_CHAIN_ROLES[record.templateId]].sort()) ||
        new Set(Object.values(record.roles)).size !== Object.values(record.roles).length) throw new Error('Kedjans rollbesättning är ogiltig.');
    for (const [role, personId] of Object.entries(record.roles)) if (!state.people[personId] || !state.families[record.roleFamilies[role]]) throw new Error('En kedjeroll saknar sin historiska person.');
    for (const [key, collection] of [['cityId', 'cities'], ['officeId', 'offices'], ['religionId', 'religions'], ['hostFamilyId', 'families'], ['rivalFamilyId', 'families']])
      if (record.refs[key] != null && !state[collection][record.refs[key]]) throw new Error('Kedjan hänvisar till en saknad institution.');
    const requiredRefs = { sickroom_seal: ['episodeId'], returned_seal: ['episodeId'], temple_steps: ['cityId', 'officeId', 'religionId'],
      veterans_honor: ['officeId', 'serviceDate'], rival_office_grievance: ['officeId', 'rivalFamilyId'], exile_contacts: ['hostFamilyId'] };
    if ((requiredRefs[record.templateId] || []).some((key) => typeof record.refs[key] !== 'string' || !record.refs[key])) throw new Error('Kedjans institutionella ursprung saknas.');
    const source = record.sourceMemoryId && state.memories.find((m) => m.id === record.sourceMemoryId);
    if ((record.templateId === 'family_letter' && !source) || (record.sourceMemoryId && (!source || source.knownBy !== 'public' || source.type !== 'story_patronage' || !source.participants.includes(record.roles.deceased) || !source.participants.includes(record.roles.participant)))) throw new Error('Kedjans orsaksminne är ogiltigt.');
    const origin = state.memories.find((m) => m.id === record.originMemoryId);
    if (!origin || origin.type !== 'chain_origin' || origin.chainId !== record.id || origin.sourceKey !== record.sourceKey || origin.date !== record.createdAt || origin.knownBy !== 'public' ||
        JSON.stringify([...origin.participants].sort()) !== JSON.stringify(Object.values(record.roles).sort())) throw new Error('Kedjans ursprung saknas.');
    const flags = {}; let previous = null;
    for (const [i, id] of record.stepIds.entries()) {
      const story = state.stories.find((item) => item.id === id), stage = stageFor(record, story?.stageId);
      const previousChoice = previous && stageFor(record, previous.stageId).choices.find((choice) => choice.id === previous.choiceId);
      if (!story || !stage || !isStep(story) || story.chainId !== record.id || id !== `${record.id}-step-${i + 1}` || stepIds.has(id) ||
          !canonical(story.createdAt) || compareGameDates(story.createdAt, state.date) > 0 || story.dueAt !== addGameMonths(story.createdAt, 12) || story.knownBy !== 'public' ||
          story.causeId !== (previous?.outcomeMemoryId || record.originMemoryId) ||
          (!previous ? stage.id !== template.stages[0].id || story.createdAt !== record.createdAt : previous.status !== 'resolved' || previousChoice?.next !== stage.id || story.createdAt !== addGameMonths(previous.resolvedAt, stageFor(record, previous.stageId).delayMonths)) ||
          !['open', 'resolved', 'closed'].includes(story.status) || (story.status === 'open' && compareGameDates(story.dueAt, state.date) <= 0)) throw new Error('Kedjans stegordning eller tidpunkt är ogiltig.');
      stepIds.add(id);
      if (story.status !== 'open' && (!canonical(story.resolvedAt) || compareGameDates(story.resolvedAt, story.createdAt) < 0 || compareGameDates(story.resolvedAt, state.date) > 0)) throw new Error('Kedjestegets avslutningsdatum är ogiltigt.');
      if (story.status === 'resolved') {
        const choice = stage.choices.find((item) => item.id === story.choiceId);
        const m = state.memories.find((item) => item.id === story.outcomeMemoryId);
        if (!choice || (choice.requires || []).some((rule) => flags[rule.flag] !== rule.equals) || !m || m.type !== 'chain_choice' || m.storyId !== story.id || m.chainId !== record.id || m.causeId !== story.causeId ||
            m.date !== story.resolvedAt || m.choiceId !== story.choiceId || m.decisionActorId !== story.decisionActorId || (choice.id !== 'close' && !state.people[story.decisionActorId])) throw new Error('Kedjevalets orsak eller beslutande person är ogiltig.');
        Object.assign(flags, choice.flags);
      }
      previous = story;
    }
    if (JSON.stringify(Object.entries(flags).sort()) !== JSON.stringify(Object.entries(record.flags).sort())) throw new Error('Kedjans grenval stämmer inte med historiken.');
    if (record.status === 'open' && previous.status !== 'open') throw new Error('Kedjan saknar sitt öppna beslut.');
    const choice = stageFor(record, previous.stageId).choices.find((item) => item.id === previous.choiceId);
    if (record.status === 'waiting' && (previous.status !== 'resolved' || !choice?.next || record.nextStageId !== choice.next || record.nextAt !== addGameMonths(previous.resolvedAt, stageFor(record, previous.stageId).delayMonths) || compareGameDates(record.nextAt, state.date) <= 0)) throw new Error('Kedjans väntande fortsättning är ogiltig.');
    if (record.status !== 'waiting' && (record.nextAt !== null || record.nextStageId !== null)) throw new Error('En inaktiv fortsättning har ett schemalagt datum.');
    if (['resolved', 'closed'].includes(record.status) && (!canonical(record.closedAt) || compareGameDates(record.closedAt, record.createdAt) < 0 || compareGameDates(record.closedAt, state.date) > 0 || previous.status === 'open')) throw new Error('Kedjans avslut är ogiltigt.');
    if (record.status === 'resolved' && (previous.status !== 'resolved' || choice?.next || choice?.id === 'close')) throw new Error('Kedjan saknar ett giltigt slutval.');
  }
  if (state.stories.filter(isStep).some((story) => !stepIds.has(story.id)) || d.records.filter((record) => ['open', 'waiting'].includes(record.status)).length > 2) throw new Error('Ett kedjesteg saknar kedja eller för många kedjor är aktiva.');
}
