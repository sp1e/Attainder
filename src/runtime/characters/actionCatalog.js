import { canExerciseMandate, isAdultCharacter } from './characterCapacity.js';
import { STAFF_ROLES } from './courtStaff.js';

// The action catalog: the contested actions of Phase 1 as data, and the menu that puts them next to the existing commands. Nothing here draws from a random stream, spends silver or edits the state it reads; later tasks compute odds from these entries, resolve them and let the game master pick from them.
export const ACTION_CATEGORIES = Object.freeze(['intrigue', 'diplomacy', 'family', 'court', 'military', 'religion', 'economy', 'personal']);
export const TIER_IDS = Object.freeze(['clean_success', 'exposed_success', 'quiet_failure', 'exposed_failure', 'backfire']);
export const EFFECT_KINDS = Object.freeze(['opinion', 'influence', 'stress', 'hook', 'secret', 'memory']);
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

export const ACTION_CATALOG = deepFreeze({ sway: SWAY, undermine: UNDERMINE });

/** The rounded midpoint of a ranged effect (opinion, influence, stress). Effects without a range have no default and give null. */
export function effectDefault(effect) {
  if (!effect || !Number.isFinite(effect.min) || !Number.isFinite(effect.max)) return null;
  return Math.round((effect.min + effect.max) / 2);
}

const copy = (value) => JSON.parse(JSON.stringify(value));
const person = (state, id) => typeof id === 'string' && Object.hasOwn(state.people, id) ? state.people[id] : null;
const family = (state, id) => typeof id === 'string' && Object.hasOwn(state.families, id) ? state.families[id] : null;

// Only the family wallet exists in Phase 1. Any other wallet kind has no known owner here and so disables the entry.
const walletOf = (state, entry, familyId) => entry.cost.wallet === 'family' ? family(state, familyId) : null;

// Targets an entry accepts: living adults other than the actor. An entry flagged targetFamily 'other' also leaves out the actor's own family.
function targetsFor(state, entry, actor) {
  return Object.values(state.people).filter((candidate) => isAdultCharacter(candidate, state.date) && candidate.id !== actor?.id && (entry.targetFamily !== 'other' || !actor || candidate.familyId !== actor.familyId));
}

// The same refusals, in the same order, that charge() in index.js applies to a family-paid action. Targets are people the player could pick.
function disabledReason(state, entry, actor, targets, familyId) {
  if (state.status?.ended) return state.status.reason || 'Kampanjen är avslutad.';
  if (!canExerciseMandate(actor, state.date)) return 'Familjen saknar en handlingsförmögen företrädare.';
  const wallet = walletOf(state, entry, familyId);
  if (!wallet) return 'Ingen behörig resursägare finns.';
  if (state.actionPoints < entry.cost.orders) return 'Årets handlingsutrymme är slut. För tiden framåt.';
  if (wallet.treasury < entry.cost.silver) return `Det behövs ${entry.cost.silver} silver; tillgängligt ${Math.floor(wallet.treasury)}.`;
  if (!targets.length) return 'Ingen behörig deltagare finns.';
  return '';
}

// Select fields use the shape of selectField() in index.js: key, label, options of { value, label }. The number and multiselect types are new; the panel renders them in Task 10.
function contestedFields(targets) {
  return [
    { key: 'targetId', label: 'Mål', type: 'select', options: targets.map((target) => ({ value: target.id, label: target.name })) },
    { key: 'silver', label: 'Extra silver', type: 'number', min: 0, max: MAX_EXTRA_SILVER, step: 1 },
    { key: 'agentRoles', label: 'Agenter', type: 'multiselect', max: MAX_AGENTS, options: Object.entries(STAFF_ROLES).map(([value, label]) => ({ value, label })) },
  ];
}

/**
 * Every command action (catalogId = its type, mode 'command') followed by the contested entries. A contested entry is always listed; disabledReason is '' when the active representative can act and the controlled family can pay, otherwise one Swedish sentence.
 * `context` is { representativeId, familyId }: the active representative, the person the player acts through and who gives the orders, and the family whose silver pays, as index.js resolves them. Without a context there is no representative and every contested entry is disabled.
 */
export function buildCatalogActions(state, commandActions, context = {}) {
  const actor = person(state, context.representativeId);
  const commands = commandActions.map((action) => ({ ...copy(action), catalogId: action.type, mode: 'command' }));
  const contested = Object.values(ACTION_CATALOG).map((entry) => {
    const targets = targetsFor(state, entry, actor);
    return { ...copy(entry), catalogId: entry.id, fields: contestedFields(targets), disabledReason: disabledReason(state, entry, actor, targets, context.familyId) };
  });
  return [...commands, ...contested];
}
