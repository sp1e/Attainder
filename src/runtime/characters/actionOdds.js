import { canExerciseMandate, getCharacterAge } from './characterCapacity.js';
import { ACTION_CATALOG, MAX_AGENTS, MAX_EXTRA_SILVER, RUMOR_TOPICS, requiresOf, usesOf } from './actionCatalog.js';
import { ADULT_AGE, SKILL_LABELS, TRAITS } from './content.js';
import { DIFFICULTIES, normalizeDifficulty } from './extensions.js';
import { STAFF_ROLES } from './courtStaff.js';
import { activeHooks } from './secrets.js';

// Odds for the contested actions. An estimate is a pure function of the state and the engine's context: it draws no randomness, spends nothing, creates no staff and edits nothing. Task 6 rolls against the values computed here.
// Both odds are integers from ODDS_MIN to ODDS_MAX. Every modifier is a row { label, value } with a Swedish label and a non-zero integer value, so the rows of one roll add up to its value. A cut at the bounds is a row of its own; it is shown at exact precision only (see CUT_ROWS).
export const ODDS_MIN = 5;
export const ODDS_MAX = 95;

// The actor's main skill sets how much the player may see: 12 or more shows exact values, 7 to 11 five bands, below 7 three bands.
const EXACT_SKILL = 12;
const FIVE_SKILL = 7;
const band = (max, label) => Object.freeze({ max, label });
// Each band holds every value up to its max and above the previous max, so the bands cover 5 to 95 without a gap and always contain the true value.
export const PRECISION_BANDS = Object.freeze({
  five: Object.freeze([band(20, 'mycket låg'), band(40, 'låg'), band(60, 'jämn'), band(80, 'hög'), band(95, 'mycket hög')]),
  three: Object.freeze([band(35, 'osannolik'), band(65, 'osäker'), band(95, 'trolig')]),
});

const SKILL_STEP = 4, SKILL_CAP = 30;
const SECRECY_STEP = 3, SECRECY_CAP = 24;
const OPINION_DIVISOR = 5, OPINION_CAP = 15;
const OLD_AGE = 65, OLD_AGE_PENALTY = 5;
const STRESS_PER_STEP = 20, STRESS_STEP = 2, STRESS_CAP = 10;
const FRAIL_HEALTH = 50, FRAIL_PENALTY = 5;
// The cap comes from the design formula. With means.silver limited to MAX_EXTRA_SILVER (60) the bonus reaches +12 at most, so the cap never binds today; it keeps the bound if that limit is raised.
const SILVER_PER_POINT = 5, SILVER_CAP = 15;
const AGENT_SUCCESS = 6, AGENT_SECRECY = 8;
const DECEITFUL_SECRECY = 8, HONEST_SECRECY = 5;
// Leverage and target rows (success only). The ids in GUARDED_ACTIONS are the ones a ruler or an office holder is hard to reach with (imprison joins in Task 5); poison alone reads the target's health.
const HOOK_BONUS = 20, EVIDENCE_BONUS = Object.freeze({ strong: 25, weak: 10 });
const RULER_PENALTY = 15, GUARD_PENALTY = 10, FRAIL_TARGET_HEALTH = 40, FRAIL_TARGET_BONUS = 10;
export const GUARDED_ACTIONS = Object.freeze(['poison']);
const FRAIL_TARGET_ACTIONS = Object.freeze(['poison']);
const MEANS_KEYS = Object.freeze(['silver', 'agentRoles', 'occasionId', 'secretId', 'hookId', 'topic']);
const MEANS_TEXT_KEYS = Object.freeze(['occasionId', 'secretId', 'hookId', 'topic']);
// What the campaign difficulty adds to the player's own actions. An NPC acting against the player's representative gets the opposite sign.
const DIFFICULTY_STEP = Object.freeze({ easy: 10, normal: 0, hard: -10 });

const COUNT_WORDS = Object.freeze(['inga', 'en', 'två', 'tre', 'fyra', 'fem']);
export const REASONS = Object.freeze({
  intent: 'Avsikten är ofullständig.',
  action: 'Handlingen är okänd eller saknar odds.',
  actorMissing: 'Aktören finns inte.',
  actorDead: 'Aktören är död.',
  actorChild: 'Aktören är för ung för att agera.',
  actorIncapacitated: 'Aktören är oförmögen att utöva ett mandat just nu.',
  order: 'Aktören står inte under din order.',
  targetCount: 'Välj exakt ett mål.',
  targetMissing: 'Målet finns inte.',
  targetSelf: 'Aktören kan inte vara sitt eget mål.',
  targetDead: 'Målpersonen är död.',
  targetChild: 'Målpersonen är för ung för att vara mål.',
  targetFamily: 'Målpersonen tillhör samma familj som aktören.',
  means: 'Medlen är ogiltiga.',
  secret: 'Hemligheten kan inte användas mot den här personen.',
  secretNeeded: 'Utpressning kräver en hemlighet om målet.',
  hook: 'Greppet går inte att använda.',
  topic: 'Ett rykte kräver ett giltigt ämne.',
  silver: `Extra silver måste vara ett heltal från 0 till ${MAX_EXTRA_SILVER}.`,
  agentList: 'Agenterna måste anges som en lista.',
  agentUnknown: 'Okänd agentroll.',
  agentRepeat: 'Samma agentroll kan inte anlitas två gånger.',
  agentCount: `Högst ${COUNT_WORDS[MAX_AGENTS] ?? MAX_AGENTS} agenter kan anlitas.`,
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const plainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const lower = (text) => text.toLowerCase();
const finite = (value, fallback = 0) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const personOf = (state, id) => (typeof id === 'string' && plainObject(state.people) && Object.hasOwn(state.people, id) ? state.people[id] : null);
const skillOf = (person, skill) => finite(person.skills?.[skill]);
const hasTrait = (person, trait) => Array.isArray(person.traits) && person.traits.includes(trait);
const skillName = (skill) => lower(SKILL_LABELS[skill] ?? skill);
const traitName = (trait) => lower(TRAITS[trait]?.name ?? trait);

/** The precision an actor's value in the action's main skill gives: 'exact', 'five' or 'three'. */
export function precisionFor(skill) {
  const value = finite(skill);
  return value >= EXACT_SKILL ? 'exact' : value >= FIVE_SKILL ? 'five' : 'three';
}

/** The label the player sees for an odds value: a band for 'five' and 'three', the percentage for 'exact'. Values outside 5 to 95 land in the outer bands. Anything that is not a number, or an unknown precision, throws. */
export function bandFor(value, precision) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new RangeError('bandFor needs a finite number.');
  const odds = clamp(Math.round(value), ODDS_MIN, ODDS_MAX);
  if (precision === 'exact') return `${odds} %`;
  if (precision !== 'five' && precision !== 'three') throw new RangeError('bandFor needs a precision of exact, five or three.');
  return PRECISION_BANDS[precision].find((entry) => odds <= entry.max).label;
}

function requireContext(ctx) {
  if (!plainObject(ctx)) throw new TypeError('estimateAction needs the context that the engine builds.');
  for (const name of ['canOrder', 'wallet', 'opinion']) if (typeof ctx[name] !== 'function') throw new TypeError(`estimateAction: ctx.${name} must be a function.`);
}

function actorRefusal(state, actor) {
  if (!actor) return REASONS.actorMissing;
  if (actor.diedAt) return REASONS.actorDead;
  if (getCharacterAge(actor, state.date) < ADULT_AGE) return REASONS.actorChild;
  return canExerciseMandate(actor, state.date) ? '' : REASONS.actorIncapacitated;
}

function targetRefusal(state, entry, actor, target) {
  if (!target) return REASONS.targetMissing;
  if (target.id === actor.id) return REASONS.targetSelf;
  if (target.diedAt) return REASONS.targetDead;
  if (getCharacterAge(target, state.date) < ADULT_AGE) return REASONS.targetChild;
  return entry.targetFamily === 'other' && target.familyId === actor.familyId ? REASONS.targetFamily : '';
}

// The means the player commits: extra silver, the roles of the agents and, for the actions that use them, a secret, a hook or a rumor topic (checked against the target in leverageOf). Roles are only counted here; the staff are created or found when the action runs. An occasionId is the feast a scheme was started at (schemes.js stores it); it is only read back, never trusted from the player (see estimateAction). Any other key is refused.
function readMeans(means) {
  const given = means === undefined || means === null ? {} : means;
  if (!plainObject(given) || Object.keys(given).some((key) => !MEANS_KEYS.includes(key))) return { reason: REASONS.means };
  const silver = given.silver === undefined ? 0 : given.silver;
  if (!Number.isInteger(silver) || silver < 0 || silver > MAX_EXTRA_SILVER) return { reason: REASONS.silver };
  const roles = given.agentRoles === undefined ? [] : given.agentRoles;
  if (!Array.isArray(roles)) return { reason: REASONS.agentList };
  if (roles.some((role) => typeof role !== 'string' || !Object.hasOwn(STAFF_ROLES, role))) return { reason: REASONS.agentUnknown };
  if (new Set(roles).size !== roles.length) return { reason: REASONS.agentRepeat };
  if (roles.length > MAX_AGENTS) return { reason: REASONS.agentCount };
  if (MEANS_TEXT_KEYS.some((key) => given[key] !== undefined && typeof given[key] !== 'string')) return { reason: REASONS.means };
  return { silver, agents: roles.length, occasionId: given.occasionId, secretId: given.secretId, hookId: given.hookId, topic: given.topic };
}

// The secret the actor may use against the target: unexposed, about the target and held by the actor.
const usableSecret = (state, actor, target, id) => state.secrets.find((secret) => secret.id === id && !secret.exposed && secret.subjectId === target.id && secret.holderIds.includes(actor.id)) ?? null;

// The secret, hook and topic in the means. An entry takes only what its `uses` names (anything else is invalid means), and refuses when a required one is missing or does not fit the actor and target. Returns the success rows they give or a refusal.
function leverageOf(state, entry, actor, target, means) {
  const uses = usesOf(entry);
  const given = { secret: means.secretId, hook: means.hookId, topic: means.topic };
  if (Object.entries(given).some(([use, value]) => value !== undefined && !uses.includes(use))) return { reason: REASONS.means };
  const missing = requiresOf(entry).find((use) => given[use] === undefined);
  if (missing) return { reason: missing === 'secret' ? REASONS.secretNeeded : REASONS.topic };
  const rows = [];
  if (given.secret !== undefined) {
    const secret = usableSecret(state, actor, target, given.secret);
    if (!secret) return { reason: REASONS.secret };
    rows.push({ label: `Bevis: ${secret.evidence === 'strong' ? 'starkt' : 'svagt'}`, value: EVIDENCE_BONUS[secret.evidence] ?? 0 });
  }
  if (given.hook !== undefined) {
    if (!activeHooks(state, actor.id, target.id).some((hook) => hook.id === given.hook)) return { reason: REASONS.hook };
    rows.push({ label: 'Påtryckning genom ett grepp', value: HOOK_BONUS });
  }
  if (uses.includes('topic') && !Object.hasOwn(RUMOR_TOPICS, given.topic)) return { reason: REASONS.topic };
  return { rows };
}

// What makes the target hard or easy to reach, whatever the player commits: a ruler has bodyguards and holds the crown, an office holder has bodyguards, a frail target falls ill more easily.
function targetRows(state, entry, target) {
  const rows = [];
  const holdsOffice = Object.values(state.offices ?? {}).some((office) => office.holderId === target.id);
  if (GUARDED_ACTIONS.includes(entry.id) && state.offices?.ruler?.holderId === target.id) rows.push({ label: 'Målet är härskare', value: -RULER_PENALTY });
  if (GUARDED_ACTIONS.includes(entry.id) && holdsOffice) rows.push({ label: 'Målets livvakter', value: -GUARD_PENALTY });
  if (FRAIL_TARGET_ACTIONS.includes(entry.id) && finite(target.health, 100) < FRAIL_TARGET_HEALTH) rows.push({ label: 'Målets svaga hälsa', value: FRAIL_TARGET_BONUS });
  return rows;
}

// The cut rows that `bound` creates. A cut row says the roll sits exactly at 5 or 95 and its sign reads as a cause, so the band precisions leave it out of what the player sees (presentOdds). A WeakSet keeps the rows plain { label, value } data.
const CUT_ROWS = new WeakSet();

// Collects rows and skips zero values. `bound` adds the cut row so the rows always add up to the value inside 5 to 95.
function rowBuilder(baseLabel, baseValue) {
  const rows = [{ label: baseLabel, value: baseValue }];
  return {
    add(label, value) { if (value !== 0) rows.push({ label, value }); },
    bound(highLabel, lowLabel) {
      const raw = rows.reduce((total, row) => total + row.value, 0);
      const value = clamp(raw, ODDS_MIN, ODDS_MAX);
      if (value !== raw) {
        const cut = { label: value < raw ? highLabel : lowLabel, value: value - raw };
        CUT_ROWS.add(cut);
        rows.push(cut);
      }
      return { value, modifiers: rows };
    },
  };
}

function difficultyRow(state, ctx, target) {
  const id = normalizeDifficulty(state.difficulty);
  const label = DIFFICULTIES[id];
  if (ctx.playerControlled) return { label: `Svårighetsgrad: ${label}`, value: DIFFICULTY_STEP[id] };
  if (target.id === ctx.representativeId) return { label: `Svårighetsgrad: ${label} (mot dig)`, value: -DIFFICULTY_STEP[id] };
  return null;
}

function successOdds(state, entry, actor, target, means, ctx, situational) {
  const rows = rowBuilder('Grundchans', entry.baseSuccess);
  const gap = skillOf(actor, entry.skill) - skillOf(target, entry.defenseSkill);
  rows.add(`Aktörens ${skillName(entry.skill)} mot målets ${skillName(entry.defenseSkill)}`, Math.round(clamp(gap * SKILL_STEP, -SKILL_CAP, SKILL_CAP)));
  for (const [trait, value] of Object.entries(entry.traitModifiers.actor)) if (hasTrait(actor, trait)) rows.add(`Aktören är ${traitName(trait)}`, value);
  for (const [trait, value] of Object.entries(entry.traitModifiers.target)) if (hasTrait(target, trait)) rows.add(`Målpersonen är ${traitName(trait)}`, value);
  if (entry.category === 'diplomacy') rows.add('Målpersonens åsikt om aktören', clamp(Math.round(finite(ctx.opinion(target.id, actor.id)) / OPINION_DIVISOR), -OPINION_CAP, OPINION_CAP));
  if (getCharacterAge(actor, state.date) >= OLD_AGE) rows.add('Aktörens höga ålder', -OLD_AGE_PENALTY);
  rows.add('Aktörens stress', -Math.min(STRESS_CAP, Math.floor(finite(actor.stress) / STRESS_PER_STEP) * STRESS_STEP));
  if (finite(actor.health, 100) < FRAIL_HEALTH) rows.add('Aktörens svaga hälsa', -FRAIL_PENALTY);
  rows.add('Extra silver', Math.min(SILVER_CAP, Math.floor(means.silver / SILVER_PER_POINT)));
  rows.add('Anlitade agenter', AGENT_SUCCESS * means.agents);
  const difficulty = difficultyRow(state, ctx, target);
  if (difficulty) rows.add(difficulty.label, difficulty.value);
  for (const item of situational) rows.add(item.label, item.value);
  return rows.bound('Högsta möjliga chans', 'Lägsta möjliga chans');
}

function secrecyOdds(entry, actor, target, means, situational) {
  const rows = rowBuilder('Hemlighållning: grundnivå', entry.baseSecrecy);
  const gap = skillOf(actor, entry.secrecySkill) - skillOf(target, 'intrigue');
  rows.add(`Hemlighållning: aktörens ${skillName(entry.secrecySkill)} mot målets intrig`, Math.round(clamp(gap * SECRECY_STEP, -SECRECY_CAP, SECRECY_CAP)));
  rows.add('Hemlighållning: anlitade agenter lämnar spår', -AGENT_SECRECY * means.agents);
  if (hasTrait(actor, 'deceitful')) rows.add(`Hemlighållning: aktören är ${traitName('deceitful')}`, DECEITFUL_SECRECY);
  if (hasTrait(actor, 'honest')) rows.add(`Hemlighållning: aktören är ${traitName('honest')}`, -HONEST_SECRECY);
  for (const item of situational) rows.add(item.label, item.value);
  return rows.bound('Hemlighållning: högsta möjliga nivå', 'Hemlighållning: lägsta möjliga nivå');
}

// What the player may read. Exact shows numbers and every row, cut rows included. Five and three show band labels and only the label and sign (+ or the real minus U+2212) of each formula row; the cut rows stay out because they would reveal that a roll sits exactly at 5 or 95.
function presentOdds(precision, success, secrecy) {
  const rows = [...success.modifiers, ...secrecy.modifiers];
  if (precision === 'exact') return { success: success.value, secrecy: secrecy.value, modifiers: rows.map(({ label, value }) => ({ label, value })) };
  const causes = rows.filter((row) => !CUT_ROWS.has(row));
  return { success: bandFor(success.value, precision), secrecy: bandFor(secrecy.value, precision), modifiers: causes.map(({ label, value }) => ({ label, sign: value > 0 ? '+' : '−' })) };
}

const refuse = (reason) => ({ ok: false, reason });

const NO_SITUATION = Object.freeze({ success: Object.freeze([]), secrecy: Object.freeze([]), occasionId: null });
// The rows the engine's occasions add (ctx.situation, optional). The player's own means.occasionId is dropped: only a scheme that carries its start (ctx.scheduled, set by schemes.js on the due date) may name an occasion. On that path `scheduled` tells situation to use the stored id only and never the feast that happens to run on the due date.
function situationOf(entry, actor, target, means, ctx) {
  if (typeof ctx.situation !== 'function') return NO_SITUATION;
  const carried = ctx.scheduled === true ? means.occasionId : undefined;
  const scheduled = ctx.scheduled === true;
  return ctx.situation(entry, actor, target, { ...means, occasionId: carried, scheduled }) ?? NO_SITUATION;
}

/**
 * Odds for one contested action, or a Swedish refusal.
 * `intent` is { actionId, actorId, targetIds, means: { silver, agentRoles } } and `ctx` is { representativeId, playerControlled, canOrder(personId), wallet(walletKind), opinion(fromId, toId), situation?(entry, actor, target, means) }, which index.js builds so this module never reaches into private helpers.
 * `ctx.situation` returns { success: row[], secrecy: row[], occasionId } with the rows an occasion adds (a feast gives intrigue actions access); the rows join the others before the bounds. When the occasion's rows counted the result carries its `occasionId`, which schemes store so the due-date estimate counts the same occasion.
 * Only contested catalog entries are accepted; a command id or an unknown id is refused. A ctx without its functions throws, because that is a bug in the caller and not a refusal.
 * The result carries the true values and rows (success, secrecy) for rolling, and `display` for the player: it follows `precision` and never carries a number at 'five' or 'three'.
 */
export function estimateAction(state, intent, ctx) {
  requireContext(ctx);
  if (!plainObject(intent)) return refuse(REASONS.intent);
  const entry = typeof intent.actionId === 'string' && Object.hasOwn(ACTION_CATALOG, intent.actionId) ? ACTION_CATALOG[intent.actionId] : null;
  if (!entry) return refuse(REASONS.action);
  const actor = personOf(state, intent.actorId);
  const actorReason = actorRefusal(state, actor);
  if (actorReason) return refuse(actorReason);
  if (!ctx.canOrder(actor.id)) return refuse(REASONS.order);
  if (!Array.isArray(intent.targetIds) || intent.targetIds.length !== 1) return refuse(REASONS.targetCount);
  const target = personOf(state, intent.targetIds[0]);
  const targetReason = targetRefusal(state, entry, actor, target);
  if (targetReason) return refuse(targetReason);
  const means = readMeans(intent.means);
  if (means.reason) return refuse(means.reason);
  const price = entry.cost.silver + means.silver;
  const available = finite(ctx.wallet(entry.cost.wallet));
  if (price > available) return refuse(`Det behövs ${price} silver; tillgängligt ${Math.floor(available)}.`);
  const leverage = leverageOf(state, entry, actor, target, means);
  if (leverage.reason) return refuse(leverage.reason);
  const situation = situationOf(entry, actor, target, means, ctx);
  const success = successOdds(state, entry, actor, target, means, ctx, [...leverage.rows, ...targetRows(state, entry, target), ...situation.success]);
  const secrecy = secrecyOdds(entry, actor, target, means, situation.secrecy);
  const precision = precisionFor(skillOf(actor, entry.skill));
  return {
    ok: true, actionId: entry.id, actorId: actor.id, targetIds: [target.id],
    cost: { orders: entry.cost.orders, silver: price, wallet: entry.cost.wallet, stressTag: entry.cost.stressTag },
    success, secrecy, precision, display: presentOdds(precision, success, secrecy),
    ...(situation.occasionId ? { occasionId: situation.occasionId } : {}),
  };
}
