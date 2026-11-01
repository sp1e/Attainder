import { canExerciseMandate, isAdultCharacter } from './characterCapacity.js';
import { STAFF_ROLES } from './courtStaff.js';
import { isImprisoned } from './prisoners.js';
import { SECRET_LABELS, activeHooks } from './secrets.js';

// The action catalog: the contested actions of Phase 1 as data, and the menu that puts them next to the existing commands. Nothing here draws from a random stream, spends silver or edits the state it reads; later tasks compute odds from these entries, resolve them and let the game master pick from them.
export const ACTION_CATEGORIES = Object.freeze(['intrigue', 'diplomacy', 'family', 'court', 'military', 'religion', 'economy', 'personal']);
export const TIER_IDS = Object.freeze(['clean_success', 'exposed_success', 'quiet_failure', 'exposed_failure', 'backfire']);
export const EFFECT_KINDS = Object.freeze(['opinion', 'influence', 'stress', 'hook', 'secret', 'memory', 'kill', 'crime', 'legitimacy', 'reveal', 'hook_from_secret', 'rumor', 'imprison', 'grievance']);
// What a spread rumor can be about (rumors.js reuses this table). The key is the topic a player sends as means.topic.
export const RUMOR_TOPICS = Object.freeze({ plot: 'Sammansvärjning', murder: 'Mordplaner', affair: 'Otrohet', illegitimate: 'Oäkta börd' });
// The most extra silver and the most agents a player can commit to one contested action. The target form and the odds validation share these.
export const MAX_EXTRA_SILVER = 60;
export const MAX_AGENTS = 2;

// Effect constructors. `from`, `to`, `who`, `family`, `owner`, `over`, `subject` and `holders` name roles ('actor' or 'target'), never people. A ranged effect keeps min <= max.
const opinion = (from, to, min, max) => ({ kind: 'opinion', from, to, min, max });
const influence = (family, min, max) => ({ kind: 'influence', family, min, max });
const stress = (who, min, max) => ({ kind: 'stress', who, min, max });
const hook = (owner, over, strength) => ({ kind: 'hook', owner, over, strength });
const secret = (type, subject, holders) => ({ kind: 'secret', type, subject, holders });
const memory = (visibility, title) => ({ kind: 'memory', visibility, title });
// kill: `who` dies with `reason` as the cause of death. crime: `crimeKind` is 'murder', 'attempted_murder' or 'treason' (a murder of kin is recorded as kinslaying when it resolves); `exposed` makes the crime public at once. legitimacy: ranged, moves the realm's legitimacy only when the actor is the ruler.
export const kill = (who, reason) => ({ kind: 'kill', who, reason });
export const crime = (crimeKind, exposed) => ({ kind: 'crime', crime: crimeKind, exposed });
export const legitimacy = (min, max) => ({ kind: 'legitimacy', min, max });
// reveal: `who` learns the strongest unexposed secret the target holds that `who` lacks. hookFromSecret: the actor gets a hook over the target as strong as the evidence of means.secretId, and `exposed` also makes that secret public. rumor: a rumor about the target on means.topic.
export const reveal = (who) => ({ kind: 'reveal', who });
export const hookFromSecret = (exposed = false) => ({ kind: 'hook_from_secret', exposed });
export const rumor = () => ({ kind: 'rumor' });
// imprison: `who` is taken prisoner by the actor's family (prisoners.js). grievance: the family of `family` gains `amount` grievance, a fixed change inside -40 to 40.
export const imprison = (who) => ({ kind: 'imprison', who });
export const grievance = (family, amount) => ({ kind: 'grievance', family, amount });
const tier = (...effects) => ({ effects });

function deepFreeze(value) {
  if (value && typeof value === 'object') for (const entry of Object.values(value)) deepFreeze(entry);
  return Object.freeze(value);
}

const SWAY = {
  id: 'sway', category: 'diplomacy', mode: 'contested',
  label: 'Påverka',
  description: 'Vinn en annan persons gunst med ord, gåvor och vänlighet. Lyckas du stiger personens åsikt om dig; ett avslöjat försök kostar förtroende.',
  actorScope: 'household', target: 'person',
  skill: 'diplomacy', defenseSkill: 'diplomacy', secrecySkill: 'diplomacy',
  traitModifiers: { actor: { gregarious: 6, honest: 3 }, target: { paranoid: -8, trusting: 8 } },
  cost: { orders: 1, silver: 5, wallet: 'family', stressTag: 'duty' },
  durationMonths: 0, baseSuccess: 50, baseSecrecy: 70,
  tiers: {
    clean_success: tier(opinion('target', 'actor', 10, 25)),
    exposed_success: tier(opinion('target', 'actor', 10, 25)),
    quiet_failure: tier(),
    exposed_failure: tier(opinion('target', 'actor', -15, -5)),
    backfire: tier(opinion('target', 'actor', -30, -15), stress('actor', 5, 10)),
  },
  utility: 'Raise one person\'s opinion of the actor at low cost and low risk; instant.',
};

const UNDERMINE = {
  id: 'undermine', category: 'intrigue', mode: 'contested',
  label: 'Undergräv',
  description: 'Spinn en intrig mot en rival i tre månader för att försvaga personens familj. Avslöjas planen väntar ilska, och slår den tillbaka får motståndaren ett övertag över dig.',
  actorScope: 'household', target: 'person', targetFamily: 'other',
  skill: 'intrigue', defenseSkill: 'intrigue', secrecySkill: 'intrigue',
  traitModifiers: { actor: { deceitful: 8, honest: -8 }, target: { paranoid: -10 } },
  cost: { orders: 1, silver: 15, wallet: 'family', stressTag: 'risky' },
  durationMonths: 3, baseSuccess: 45, baseSecrecy: 60,
  tiers: {
    clean_success: tier(influence('target', -10, -4), memory('private', 'En intrig spinns i det fördolda'), secret('plot', 'actor', ['actor'])),
    exposed_success: tier(influence('target', -10, -4), opinion('target', 'actor', -30, -15), memory('public', 'Intrigen mot en rival blev känd'), secret('plot', 'actor', ['actor', 'target'])),
    quiet_failure: tier(),
    exposed_failure: tier(opinion('target', 'actor', -30, -15), memory('public', 'Ett försök att undergräva en rival avslöjades')),
    backfire: tier(influence('actor', -8, -3), opinion('target', 'actor', -40, -20), stress('actor', 5, 15), hook('target', 'actor', 'weak')),
  },
  utility: 'Cut a rival family\'s influence over three months; exposure costs opinion and a backfire hands the target a hook.',
};

const POISON = {
  id: 'poison', category: 'intrigue', mode: 'contested',
  label: 'Förgifta',
  description: 'Låt gift smyga in i en annan persons mat och dryck under en månad. Lyckas planen dör målet; avslöjas den väntar en mordanklagelse, och går den fel kan offret få ett övertag över dig.',
  actorScope: 'household', target: 'person',
  skill: 'intrigue', defenseSkill: 'intrigue', secrecySkill: 'intrigue',
  traitModifiers: { actor: { deceitful: 6, cruel: 6, compassionate: -10, honest: -6 }, target: { paranoid: -12, trusting: 6 } },
  cost: { orders: 1, silver: 25, wallet: 'family', stressTag: 'cruel' },
  durationMonths: 1, baseSuccess: 30, baseSecrecy: 50,
  uses: ['hook'],
  tiers: {
    clean_success: tier(kill('target', 'Sjukdom'), crime('murder', false), memory('private', 'Giftet verkade')),
    exposed_success: tier(kill('target', 'Förgiftad'), crime('murder', true)),
    quiet_failure: tier(stress('target', 10, 20)),
    exposed_failure: tier(crime('attempted_murder', true), opinion('target', 'actor', -60, -40)),
    backfire: tier(crime('attempted_murder', true), hook('target', 'actor', 'strong'), stress('actor', 10, 20)),
  },
  utility: 'Kill a target over a month at a high price in silver, stress and exposure; a grip over the target, a feast and a frail target raise the odds, a ruler or an office holder lowers them.',
};

const INVESTIGATE = {
  id: 'investigate', category: 'intrigue', mode: 'contested',
  label: 'Snoka',
  description: 'Låt någon gräva i en annan persons förflutna i två månader. Lyckas det får du veta målets främsta hemlighet; avslöjas snokandet blir målet fientligt.',
  actorScope: 'household', target: 'person',
  skill: 'intrigue', defenseSkill: 'intrigue', secrecySkill: 'intrigue',
  traitModifiers: { actor: { curious: 5 }, target: { paranoid: -8 } },
  cost: { orders: 1, silver: 10, wallet: 'family', stressTag: 'duty' },
  durationMonths: 2, baseSuccess: 50, baseSecrecy: 65,
  tiers: {
    clean_success: tier(reveal('actor')),
    exposed_success: tier(reveal('actor'), opinion('target', 'actor', -20, -10)),
    quiet_failure: tier(),
    exposed_failure: tier(opinion('target', 'actor', -20, -10), memory('public', 'Snokandet avslöjades')),
    backfire: tier(hook('target', 'actor', 'weak')),
  },
  utility: 'Learn the target\'s strongest hidden secret over two months; the secret feeds blackmail.',
};

const BLACKMAIL = {
  id: 'blackmail', category: 'intrigue', mode: 'contested',
  label: 'Utpressa',
  description: 'Hota med en hemlighet du känner till om målet. Lyckas det får du ett övertag över personen; avslöjas utpressningen kommer hemligheten ut, och slår den tillbaka får målet ett övertag över dig.',
  actorScope: 'household', target: 'person',
  skill: 'intrigue', defenseSkill: 'intrigue', secrecySkill: 'intrigue',
  traitModifiers: { actor: { deceitful: 5, honest: -8 }, target: { craven: 8, brave: -8 } },
  cost: { orders: 1, silver: 0, wallet: 'family', stressTag: 'betrayal' },
  durationMonths: 0, baseSuccess: 35, baseSecrecy: 70,
  uses: ['secret'], requires: ['secret'],
  tiers: {
    clean_success: tier(hookFromSecret(), opinion('target', 'actor', -20, -10)),
    exposed_success: tier(hookFromSecret(true), opinion('target', 'actor', -20, -10)),
    quiet_failure: tier(opinion('target', 'actor', -15, -5)),
    exposed_failure: tier(opinion('target', 'actor', -30, -20), memory('public', 'Utpressningen avslöjades')),
    backfire: tier(hook('target', 'actor', 'weak'), stress('actor', 5, 10)),
  },
  utility: 'Turn a held secret into a hook over its subject, as weak or strong as the evidence; costs no silver but needs a secret.',
};

const SPREAD_RUMOR = {
  id: 'spread_rumor', category: 'intrigue', mode: 'contested',
  label: 'Sprida rykte',
  description: 'Låt ett rykte om ett valt ämne gå från mun till mun om målet. Lyckas det tappar målets familj inflytande; avslöjas källan faller skulden på dig.',
  actorScope: 'household', target: 'person',
  skill: 'intrigue', defenseSkill: 'intrigue', secrecySkill: 'intrigue',
  traitModifiers: { actor: { deceitful: 6, honest: -10 }, target: {} },
  cost: { orders: 1, silver: 10, wallet: 'family', stressTag: 'betrayal' },
  durationMonths: 0, baseSuccess: 50, baseSecrecy: 55,
  uses: ['topic'], requires: ['topic'],
  tiers: {
    clean_success: tier(rumor(), influence('target', -8, -3)),
    exposed_success: tier(rumor(), influence('target', -8, -3), opinion('target', 'actor', -30, -20)),
    quiet_failure: tier(),
    exposed_failure: tier(opinion('target', 'actor', -30, -20), influence('actor', -5, -2)),
    backfire: tier(opinion('target', 'actor', -30, -20), influence('actor', -5, -2), stress('actor', 5, 10)),
  },
  utility: 'Start a rumor about the target on a chosen topic and cut their family\'s influence; a failure exposes the actor.',
};

const IMPRISON = {
  id: 'imprison', category: 'court', mode: 'contested',
  label: 'Fängsla',
  description: 'Sätt en annan person i fängelse. Lyckas det förlorar personen sina ämbeten och sitter fängslad tills du friger, löser ut eller avrättar personen; misslyckas det väcker det ilska, och slår det tillbaka tar personens släkt illa vid sig.',
  actorScope: 'household', target: 'person',
  actorOffice: { id: 'ruler', reason: 'Bara härskaren kan fängsla.' },
  skill: 'prowess', defenseSkill: 'prowess', secrecySkill: 'intrigue',
  traitModifiers: { actor: {}, target: {} },
  cost: { orders: 1, silver: 10, wallet: 'realm', stressTag: 'risky' },
  durationMonths: 0, baseSuccess: 60, baseSecrecy: 5,
  uses: [],
  tiers: {
    clean_success: tier(imprison('target'), opinion('target', 'actor', -30, -15)),
    exposed_success: tier(imprison('target'), opinion('target', 'actor', -30, -15)),
    quiet_failure: tier(),
    exposed_failure: tier(opinion('target', 'actor', -40, -20)),
    backfire: tier(opinion('target', 'actor', -50, -30), grievance('target', -10), stress('actor', 5, 15)),
  },
  utility: 'The ruler jails a person for 10 realm silver: the person loses every office and cannot act until released, ransomed or executed; an unlawful arrest costs legitimacy, and a failure angers the family of the person.',
};

export const ACTION_CATALOG = deepFreeze({ sway: SWAY, undermine: UNDERMINE, poison: POISON, investigate: INVESTIGATE, blackmail: BLACKMAIL, spread_rumor: SPREAD_RUMOR, imprison: IMPRISON });

/** What an entry's means may carry beyond silver and agents: 'secret', 'hook' and 'topic'. Entries without `uses` take none. */
export const usesOf = (entry) => (Array.isArray(entry?.uses) ? entry.uses : []);
/** What an entry's means must carry. */
export const requiresOf = (entry) => (Array.isArray(entry?.requires) ? entry.requires : []);

/** The rounded midpoint of a ranged effect (opinion, influence, stress, legitimacy). Effects without a range have no default and give null. */
export function effectDefault(effect) {
  if (!effect || !Number.isFinite(effect.min) || !Number.isFinite(effect.max)) return null;
  return Math.round((effect.min + effect.max) / 2);
}

/** The refusal of an entry that only the holder of an office may use (actorOffice), or '' when the actor holds it or the entry has no such rule. The catalog menu and the odds share it. */
export function actorOfficeRefusal(state, entry, actorId) {
  return entry.actorOffice && state.offices?.[entry.actorOffice.id]?.holderId !== actorId ? entry.actorOffice.reason : '';
}

const copy = (value) => JSON.parse(JSON.stringify(value));
const person = (state, id) => typeof id === 'string' && Object.hasOwn(state.people, id) ? state.people[id] : null;
const family = (state, id) => typeof id === 'string' && Object.hasOwn(state.families, id) ? state.families[id] : null;

// The family wallet is the controlled family's treasury; the realm wallet is the realm's, open only to a player who rules (context.realmAccess, the same right charge() asks for with public funds). Any other wallet kind has no known owner here and so disables the entry.
const walletOf = (state, entry, context) => entry.cost.wallet === 'family' ? family(state, context.familyId) : entry.cost.wallet === 'realm' && context.realmAccess === true ? state.realm : null;

// Targets an entry accepts: living adults other than the actor. An entry flagged targetFamily 'other' also leaves out the actor's own family. Imprison also leaves out prisoners and the shielded people (context.shieldedIds: the ruler and both representatives, whom the engine never imprisons).
function targetsFor(state, entry, actor, shieldedIds = []) {
  return Object.values(state.people).filter((candidate) => isAdultCharacter(candidate, state.date) && candidate.id !== actor?.id && (entry.targetFamily !== 'other' || !actor || candidate.familyId !== actor.familyId) && (entry.id !== 'imprison' || (!isImprisoned(state, candidate.id) && !shieldedIds.includes(candidate.id))));
}

// The same refusals, in the same order, that charge() in index.js applies to a family-paid action. Targets are people the player could pick.
function disabledReason(state, entry, actor, targets, context) {
  if (state.status?.ended) return state.status.reason || 'Kampanjen är avslutad.';
  if (!canExerciseMandate(actor, state.date)) return 'Familjen saknar en handlingsförmögen företrädare.';
  const office = actorOfficeRefusal(state, entry, actor.id);
  if (office) return office;
  const wallet = walletOf(state, entry, context);
  if (!wallet) return entry.cost.wallet === 'realm' && context.realmAccess !== true ? 'Familjen saknar rätt att använda statskassan.' : 'Ingen behörig resursägare finns.';
  if (state.actionPoints < entry.cost.orders) return 'Årets handlingsutrymme är slut. För tiden framåt.';
  if (wallet.treasury < entry.cost.silver) return `Det behövs ${entry.cost.silver} silver; tillgängligt ${Math.floor(wallet.treasury)}.`;
  if (!targets.length) return 'Ingen behörig deltagare finns.';
  return '';
}

// Select fields use the shape of selectField() in index.js: key, label, options of { value, label }. The number and multiselect types are new; the panel renders them in Task 10.
const NONE_OPTION = Object.freeze({ value: '', label: 'Ingen' });
const strengthLabel = (strength) => (strength === 'strong' ? 'Starkt' : 'Svagt');

// The secrets the representative holds about a living adult that are still hidden: the ones estimateAction accepts as leverage. The target must be the subject, so the person in the label is the one to pick as the target.
function secretOptions(state, representativeId) {
  return (Array.isArray(state.secrets) ? state.secrets : [])
    .filter((secret) => !secret.exposed && secret.holderIds.includes(representativeId) && secret.subjectId !== representativeId && isAdultCharacter(person(state, secret.subjectId), state.date))
    .map((secret) => ({ value: secret.id, label: `${SECRET_LABELS[secret.type] ?? secret.type}: ${person(state, secret.subjectId).name}` }));
}

function hookOptions(state, representativeId) {
  return activeHooks(state, representativeId).map((hook) => ({ value: hook.id, label: `${strengthLabel(hook.strength)} grepp över ${person(state, hook.targetId)?.name ?? hook.targetId}` }));
}

// The extra selects an entry's `uses` asks for. An optional select starts with the empty option; a required one (entry.requires) does not.
function leverageFields(state, entry, representativeId) {
  const uses = usesOf(entry), required = requiresOf(entry);
  const select = (use, key, label, options) => ({ key, label, type: 'select', ...(required.includes(use) ? { required: true, options } : { options: [NONE_OPTION, ...options] }) });
  return [
    ...(uses.includes('secret') ? [select('secret', 'secretId', 'Hemlighet', secretOptions(state, representativeId))] : []),
    ...(uses.includes('hook') ? [select('hook', 'hookId', 'Grepp', hookOptions(state, representativeId))] : []),
    ...(uses.includes('topic') ? [select('topic', 'topic', 'Ämne', Object.entries(RUMOR_TOPICS).map(([value, label]) => ({ value, label })))] : []),
  ];
}

function contestedFields(state, entry, targets, representativeId) {
  return [
    { key: 'targetId', label: 'Mål', type: 'select', options: targets.map((target) => ({ value: target.id, label: target.name })) },
    { key: 'silver', label: 'Extra silver', type: 'number', min: 0, max: MAX_EXTRA_SILVER, step: 1 },
    { key: 'agentRoles', label: 'Agenter', type: 'multiselect', max: MAX_AGENTS, options: Object.entries(STAFF_ROLES).map(([value, label]) => ({ value, label })) },
    ...leverageFields(state, entry, representativeId),
  ];
}

/**
 * Every command action (catalogId = its type, mode 'command') followed by the contested entries. A contested entry is always listed; disabledReason is '' when the active representative can act and the controlled family can pay, otherwise one Swedish sentence.
 * `context` is { representativeId, familyId, realmAccess, shieldedIds }: the active representative, the person the player acts through and who gives the orders, the family whose silver pays whether the player may spend the realm's silver and the people imprison may not target, as index.js resolves them. Without a context there is no representative and every contested entry is disabled.
 */
export function buildCatalogActions(state, commandActions, context = {}) {
  const actor = person(state, context.representativeId);
  const commands = commandActions.map((action) => ({ ...copy(action), catalogId: action.type, mode: 'command' }));
  const contested = Object.values(ACTION_CATALOG).map((entry) => {
    const targets = targetsFor(state, entry, actor, Array.isArray(context.shieldedIds) ? context.shieldedIds : []);
    return { ...copy(entry), catalogId: entry.id, fields: contestedFields(state, entry, targets, actor?.id ?? null), disabledReason: disabledReason(state, entry, actor, targets, context) };
  });
  return [...commands, ...contested];
}
