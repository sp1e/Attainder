# Character engine contract v1

Pure ESM exports from `index.js`; no I/O, browser globals or external dependencies.

- `createCharacterSystem({ date = '-0300-01-01', polityId = 'hadara', polityName = 'Hadara', mode = 'realm', seed = 104729, familyId = 'family-arel', cities = [] })` returns state. Modes: `realm`, `family`.
- `normalizeCharacterSystem(raw)` returns a detached validated/migrated state, or `null` for absent state. Invalid or future versions throw a descriptive Error. Never advances time or draws randomness.
- `executeCharacterCommand(state, { id, expectedRevision, type, payload = {} })` returns `{ ok, state, events, error }`. Invalid command returns original state and an error string. Repeated accepted IDs return no extra effect. No arbitrary actor control: actor derives from campaign identity.
- `advanceCharacters(state, targetDate, { id } = {})` returns the same result shape. Calendar boundaries, not calls, trigger annual simulation. Same or past date never advances. An ended campaign stays at its actual end date, including when ending during a longer requested hop. Dates are Open Historia game dates, with no year zero.
- `getNextCharacterTransitionDate(state,targetDate)` returns the earliest pending annual, health-phase or household-exposure boundary, capped at the target. It returns `null` for ended campaigns or non-future targets. The adapter uses these boundaries for dated replay checkpoints.
- `getCharacterPresentation(state)` returns `{ date, revision, mode, identity, ruler, representative, families, people, offices, cities, religions, memories, stories, projects, actions, economy, succession, log, status, versions }`. Object collections here are arrays. Text is Swedish. Returns only public or player-known facts.
- `getCharacterWorldEffects(state)` returns `{ realmAlive, polityId, leaderId, leaderName, treasury, annualRevenue, productionMultiplier, militaryReadiness, legitimacy, cityEffects, orders, date, revision }`. Values are absolute projections; adapter must not add projections repeatedly or recreate a polity when `realmAlive` is false. `cityEffects`: `{id,name,regionId,familyId,governorId,productionMultiplier,taxIncome,unrest}`. `orders` is remaining public action capacity.
- `getAvailableCharacterActions(state)` returns the same actions as presentation.
- `getCharacterAge(person, date)`, `getPersonalOpinion(state, fromId, toId)` and `evaluateCharacterDecision(state, personId)` exported for validation/debugging.
- `canCharacterDirectRealm(state)` returns whether the current campaign representative can issue public state orders. Host legacy order paths must use this same query; family membership or an outside guardian alone never grants state command.

Action descriptor: `{ type, label, description, cost, stress, disabledReason, fields: [{ key, label, type: 'select', options: [{value,label}] }] }`. Payload keys are declared in each action's fields. Actions may be rendered generically. Selection-specific checks occur again when submitted. `cost` and `stress` are display strings; `disabledReason` is empty when broadly available. All selectable entities have stable IDs.

Presentation story: `{id,type,title,description,actorId,targetId,createdAt,dueAt,status,choices:[{id,label,description,cost,stress,disabledReason}]}`. Resolve via command type `resolve_story`, payload `{storyId, choiceId}`. Choices should be displayed even if disabled, with reason. Engine always supplies a viable fallback for open stories.

State has `schemaVersion:1`, `rulesVersion`, `contentVersion`, `revision`, `date`, `nextAnnualDate`, `rngState`, `identity:{mode,polityId,familyId}`, `realm`, `people`, `families`, `offices`, `cities`, `religions` (ID-keyed objects), `relations`, `memories`, `stories`, `projects`, `log`, `appliedCommandIds`, `status`. The adapter persists the whole state verbatim and uses the presentation API rather than relying on internal derived fields.

Events returned by mutation: `{id,date,type,title,description,participants,public:true}`. Pure chronological outcomes. The runtime adapter owns their conversion to Open Historia impacts and replay; `events` never mutate the host world themselves.

Progression can be invoked locally without an LLM. Realm/family commands, budgets, stresses, stories and succession share one state. Long hops use stable annual boundaries and saved randomness. State remains serializable to JSON. Original content and balance constants are our own design, not claimed copies of proprietary code.

## Recurring character decisions

`storyDirector.js` owns the recurring catalogue and selection stream. Its saved `storyDirector` record has its own version, RNG, sequence, cooldown dates and last scheduling boundary. Absent records receive deterministic defaults for older pre-release saves. Normalization draws no randomness and creates no historical stories. Unknown versions or invalid director data are rejected. Only the version is exposed through presentation.

The director selects from real participants and current circumstances. Eight templates cover household tension, a promising student, a temple petition, a governor audit, a veteran petition, reconciliation, exile contacts and a returned favor. Personality changes candidate weights and action stress. A remembered dispute supplies the cause for reconciliation; a support memory can lead to a favor after three years. An actual family head can carry that favor after the original beneficiary dies. Once resolved, a source memory cannot be claimed again.

Selection occurs at annual boundaries, at most once per year, with a 36-month template cooldown, a 24-month participant cooldown and at most two open recurring stories. The independent RNG does not consume the life or health streams. Choices still affect later simulation through their documented changes to people and resources.

These stories use `type: 'character_event'` and an `eventType` from the catalogue. They retain participant IDs, the player representative and family at creation, `triggerDescription`, a twelve-month deadline, and a causal memory ID when applicable. The generic `resolve_story` command validates the current cast, funds and authority before applying a choice. Success adds a linked outcome memory and opinion cause. A payment offered in return for support transfers existing personal wealth to the family treasury.

Expired stories use the displayed free fallback. Death or a relevant change of representative, office or mandate closes a stale story without spending money. State and family campaigns retain separate authority and wallets. An exile offer records its accepted host and closes if that host changes or is lost. It does not grant control over the host.

The host adapter's `pauseForCharacterDecisions` option stops a longer advance at a newly opened recurring story. The playable turn horizon and model forecast enable this option alongside `pauseForHealthDecisions`; health has priority if both appear at the same boundary. Forecast and committed replay use the same dated transitions. Direct engine callers can still simulate longer periods and let unanswered decisions expire.

## Implemented presentation details

People include `age, alive, familyName, archetypeLabel, traitLabels, roleNames, opinion, opinionReasons, relations, stressLevel, goalLabel`. `opinionReasons` are `{label,value,causeId?,expiresAt?}` for opinion toward the current representative. `relations` are `{targetId,targetName,types}`. Other actors' private decision traces are not exposed. Families include `headName, guardianName, support, supportReasons, income, memberIds, officeCount, statusLabel`; support reasons are `{label,value}` and the final sum is clamped to 0–100.

Portraits: `person.portraitState` now supplies the identity-preserving state and age lookup described below. Older `portraitId` and `portraitAgeGroup` fields remain available for legacy assets, including six generic age/sex fallback keys. Consumers of the new atlas must use `portraitState` and their actual asset manifest. Core does not load image files or assume every proposed variant exists.

Family officials can submit `exercise_office` with `{officeId,policy:'service'|'patronage'}`. The active representative must hold the office personally. This consumes the office's own budget and one action, with a yearly cooldown. Service changes actual city infrastructure/unrest, army strength, legitimacy or religious support. Patronage transfers bounded funds and influence to the family with stress and political consequences. Relatives' offices cannot be controlled through this action.

Existing campaign saves without a character system are initialized by the host adapter. This is the first character schema; unknown character schema/rules/content versions are rejected without mutating input, not guessed into a new campaign.

Independent adult relatives may form their own marriages during calendar simulation. Only the active player representative is excluded from autonomous marriage. This follows the same personal autonomy rule as other families and avoids making manual matchmaking mandatory for every descendant.

## Lawful succession and regency

Royal executive authority is independent of campaign mode. A living minor needs a matching active royal regent who is an adult. An unresolved contested handover or missing executive prevents royal decisions. Family mode grants state control only when the family's head holds the crown or regency and its active representative is the royal executive; a separate family guardianship never grants state control.

Royal vetoes also apply when the controlled family's head is the royal regent. Family and royal mandates retain separate action scopes. Annual NPC appointments stop when the player controls the royal executive. Otherwise each appointment uses the executive's opinion, checks the royal veto, and consumes one matching royal consent on success.

NPC office-promise choices (`observe`, `support`, `advocate`) use the adult executive's personality and royal authority. A blocked choice spends nothing. `defer` preserves the story in `waiting` for one year without payment; automatic expiry selects that option when available. A promise itself does not consume appointment consent; its later fulfillment must pass the current checks. See [Regency authority](../../../docs/design/regency-authority.md) for the decision and payment rules.

Waiting `office_promise`, `promise_due` and `legacy_claim` stories enter the transition calendar at `dueAt`. The common story refresh reopens them on that date and records `reopenedAt`. Automatic expiry uses that timestamp, falling back to `createdAt` for older stories, so reopening never causes same-update expiry. Reads and duplicate advances do not reopen or log the story twice.

When present, `reopenedAt` must be a canonical date string between `createdAt` and the saved date. Its related creation and due dates must also be canonical. An open or resolved story cannot reopen before its deadline. A waiting story with a previous reopening must have a later deadline for its next review. A closed story may have been withdrawn before that next deadline. New follow-up promises omit the parent's reopening timestamp. Older stories without this field remain compatible.

The first, unreleased schema gains deterministic additive defaults for `regencies`, `externalHosts`, `realm.lawfulRulerId`, `realm.legalHeirId`, `realm.claimHistory` and `family.claims`. Version numbers remain unchanged. Normalization supplies absent defaults without drawing RNG or advancing time, then validates references. Older pre-release states without a legal history establish their current ruler as the initial lawful ruler; missing historical claims are not invented.

Actual control remains `offices.ruler.holderId`. A seizure preserves the lawful ruler. That person's death transmits the lawful claim under the succession rule independently of actual office control. Claim records preserve their origin, date and active/superseded/deceased/transferred/suspended status. The overlooked claimant's family receives a visible −12 support cause. `press_claim` restores its actual lawful claimant, even when the family's representative is someone else: it requires 45 influence and receives +20 power support; an ordinary political challenge requires 60. A current ruler may use `recognize_claim` to restore the lawful claimant, paying an action and surrender stress. Neither action recreates a dissolved realm.

Presentation `governance` and the additive fields in `succession` contain `actualRulerId/Name`, `lawfulRulerId/Name`, `legalHeirId/Name`, `contestedCrown`, `claimHistory`, enriched `claims`, relevant `regencies`, `realmAlive` and `externalHosts`. Regent records include `id`, `principalId/Name`, `regentId/Name`, `phase`, `grants`, `requestAfter` and `vetoedActions`.

Regency phases are `minority`, `contested`, `ended`, `closed`. Office and family mandates remain separate. Family guardians reserve estate investment and adoption; royal regents reserve appointments, dismissals, banishment, taxation and archetype actions. Personality determines the veto. Ordinary private livelihood and support-building remain available. Story appointments obey the same veto as direct appointments. Majority normally ends the mandate; an ambitious regent with loyalty below 70 and family influence at least 40 can contest it. During a disputed royal handover, `canCharacterDirectRealm` is false. The prototype does not yet model a separate adult-incapacity state.

- `request_regent_consent {regencyId,actionType,approach}`: `negotiate` costs 10 family silver, `compensate` costs 30 and transfers it to the regent, `appeal` costs 15 influence. Cooperation is regent loyalty + opinion toward the principal /2 −15 for ambition; negotiation needs 60, compensation adds 35. A council appeal needs family influence + principal diplomacy ×3 at least 65. Refusal still consumes the stated cost and improves the regent's opinion; the same decision can be raised again after a year. Successful consent lasts one year and permits exactly one successful matching command.
- `resolve_regency {regencyId,approach}`: only a contested adult handover. `pension` costs 40 family silver and guarantees a negotiated transfer; `council` costs 20 influence; `confront` costs 25 silver and risky stress. Council/confrontation compare family influence + principal diplomacy ×3 (plus command ×3 for confrontation) against regent-family influence ×0.6 + disloyalty ×0.5 +15 for ambition; confrontation needs 8 more support. Failure costs resources, influence and stress. Success closes that specific mandate and its personal effects.

## Actual realm dissolution and external refuge

These are host-only transitions, using the same `{ok,state,events,error}` result, idempotent IDs and atomic failure behavior as commands. `id` must match `[a-zA-Z0-9_:.-]{1,160}`. The supplied `date` must equal the already advanced state date.

- `applyRealmDissolution(state,{id,date,reason,hostCandidates,hostPolityId?,hostAccepted?})`: call only after the world host has actually accepted the polity's dissolution. It sets `realm.alive=false`, closes public offices/budgets/projects and public claim stories, suspends claims, preserves private assets, and retains the original `identity.polityId` as the campaign anchor. Realm mode ends. A surviving family continues exiled and initially unhoused. An initially accepted host requires `hostAccepted:true` and an actual matching candidate; no recipient or new state is invented.
- `reconcileExternalHosts(state,{id,date,hostCandidates,hostAliases?})`: call after actual host-world actor changes. Unchanged context returns the original state without revision/event changes. A missing accepted recipient removes protection and records its loss. Validated aliases `{oldId:newId}` preserve accepted protection only when the alias target exists in the supplied candidate list. Aliases must come from a validated world rename, never a guessed successor state.

Host candidates are actual existing external polities supplied by the runtime: `{id,name,opinion:0,refugeThreshold:55,admissionCost:20}`. Core stores at most 24, giving already accepted hosts priority before truncation. Send the complete candidate list, or preserve these hosts before any adapter-side truncation. The runtime revalidates the chosen recipient against the current world at command time.

`seek_refuge {polityId}` is available to an exiled family after realm dissolution. It costs the candidate's admission price and one action. Acceptance requires family influence + actor diplomacy ×3 + recipient opinion /2 to meet `refugeThreshold`. Acceptance records `family.hostPolityId`, `hostPolityName`, `refugeAcceptedAt`; refusal records the event, retains the unhoused situation, and permits another attempt after one year. Accepted protection enables private estate investment and limited estate access; it grants no public command. Loss of the recipient removes those rights. Private livelihood, family relations and education remain available without state funds. Local `seek_patron`, return to the extinct realm, former public offices and restoration by a bare `press_claim` are refused. The prototype represents political residence, not a geographic travel route or ownership of foreign offices.

Validation: `node --test src/runtime/characters/characters.test.js src/runtime/characters/governance.test.js src/runtime/characters/health.test.js`. The governance file covers separate lawful/actual succession, three distinct political/private recipients, consent/veto, contested adulthood, dissolution, external acceptance/refusal, alias preservation, lost protection, bounded host lists and malformed saved references.

## Read-only succession forecast

`getSuccessionForecast(state)` returns the same serializable value exposed as
`presentation.succession.forecast`. It contains actual and lawful identities,
the expected actual successor, current exercised and incoming abilities,
authority limits, campaign identity implications and project continuity by
owner. No forecast fields are persisted.

The forecast is conditional on only the current ruler dying at today's date.
It shares the death-successor branch and candidate ranking with the runtime.
Optional candidate exclusions remove the departing person's office seats,
personal sanctuary support and claim penalty from merit scores. Viewing does
not simulate a transition, change state or consume RNG. Minor successors
require regency; their own ability is not immediately exercisable. A deceased
legal fallback is rejected by the shared selector so an exhausted population
reaches the existing interregnum path.

A minor without a living adult representative retains the nominal ruler
identity but has no current exercised ability in the forecast.

See `docs/design/succession-forecast.md` and
`src/runtime/characters/successionForecast.test.js` for scope and checks.

## Health, care and dated portraits

The additive health module has `healthVersion:1`, `healthActivatedAt`, `healthRngState` and `healthSequence`. Its random stream and identifiers are separate from the existing annual stream. Normalization of older pre-release saves adds a neutral empty health history and stable portrait identities at the saved date. It does not invent historical illnesses, age people or draw random numbers. Unknown health versions and malformed condition references are refused. Existing schema/rules/content version numbers remain unchanged for this unreleased additive extension.

Each person has `healthConditions:[]`, `portraitIdentityId` and a locked `portraitFallbackIdentityId`. A saved condition contains `id,kind,stage,severity,startedAt,nextTransitionAt,nextExposureAt,stageHistory,treatment,causeId,sourceKind,relatedPersonId,scarRoll,outcomeRoll,endedAt` and, after a fatal outcome, `fatalAt`. Kinds are `smallpox`, `fever`, `injury`, `bereavement`; stages are `active`, `recovering`, `scarred`, `resolved`. Histories and causal memories persist after recovery. Public presentation omits the saved random outcomes and future phase/exposure deadlines, and adds `label,stageLabel,active`. Deceased people's remaining active phases are described as having been in progress at death.

Ordinary illness and injury arise during annual simulation, based on saved randomness, health/stress, previous disease and actual military office. Smallpox can expose actual members of the same household one month after onset, at most twice per source. Previous smallpox grants immunity in this game model. The exact active/recovery boundaries are processed even inside a longer hop: untreated smallpox uses three plus six months, injury four plus three, fever one plus two. Real death of a spouse, legal parent or child causes a two-year grief phase with a retained causal memory. These are gameplay times and probabilities, not clinical advice or a reconstruction of historical incidence.

Physical conditions reduce health, increase stress and lower the affected governor's production or general's military readiness. Their burden decreases during recovery and ends when healed, including when scars remain. A fatal course enters the normal death, property, family and lawful succession transition. All illness deaths at the same boundary are marked before any successor is selected. Existing annual mortality also continues to apply.

- `provide_care {personId,conditionId,care:'rest'|'physician'}` requires a living, untreated patient in the controlled household, a valid adult representative and sufficient family resources. Rest costs 5 family silver, a physician 20; the direct command also uses one action. Treatment is recorded once, changes risk and may shorten a phase, but never rerolls the saved outcome or cures instantly.
- Open `health_care` stories expose `physician`, `rest`, `watch` through the standard `resolve_story` command. Story choices use the same family costs and no action point; watch is a valid free choice. Closing or resolving a story does not invent a cure. Independent adult NPCs can use their own personal purse; they cannot spend player-family money or a minor's inherited assets autonomously.
- There is no player command, model operation or free-text override for inducing a condition or assigning a health value. Model suggestions remain advisory. The annual engine and existing actual death transitions are the sources of these conditions.

`advanceCharacters` remains a deterministic full-target simulation. The adapter should stop an interactive hop when a newly opened actionable `health_care` story appears before the user's outer target, present that actual date and retain the unexpired illness. Its inner boundary calls alone cannot detect that a larger user hop needs to stop. A first one-year annual outbreak ends at the onset date, with an acute portrait and a valid choice; no artificial multi-year illness is needed to provide a decision window. Silent exposure checks still advance saved health RNG but should be merged into the next public checkpoint rather than producing filler cards.

`resolvePortraitState(person,date,{family}={})` is pure and also exported through `index.js`. It returns `{identityId,fallbackIdentityId,usesSharedFallback,ageGroup,visualState,stateKeys,expression,context,lifeStatus,variantKey,variantCandidates,reasons}`. Reasons are `{key,label,conditionId?,since?}`. `variantKey` is `${identityId}__${ageGroup}__${visualState}`. All candidates keep the same age group, trying the person's identity and then its locked shared identity. Asset existence is the consumer's responsibility; missing assets must not create broken requests or a different person's identity.

The atlas contract has exactly 12 states in this order: `healthy,smallpox,smallpox-recovering,smallpox-scars,fever,wounded,injury-recovering,injury-scars,frail,stressed,grieving,exiled`. Three age groups are `child` below 18, `adult` 18–59 and `elder` 60+. A six-column atlas uses rows 0–1, 2–3 and 4–5 respectively. Priority for the primary image is acute smallpox, wound, fever, smallpox recovery, injury recovery, smallpox scars, injury scars, frailty, stress, grief, exile, healthy. Every concurrent cause remains in `stateKeys` and `reasons`, with independent expression/context metadata; this is not a promise of images for every Cartesian combination.

All 24 initial identities retain their own atlas as they age. A newly born person's own stable ID remains its logical identity; its shared illustration is locked at birth to the same family's same-sex child seed (`person-f-4` female or `person-f-5` male). An unrecognized family may inherit an appropriate same-sex parent's younger seed illustration, otherwise it receives a deterministic matching child-seed fallback. Adoption or crossing an age boundary does not switch that identity. `usesSharedFallback:true` must be represented honestly: these are shared family illustrations, not newly generated unique faces. The three image ages are coarse stages, not exact-year portraits.

`deathAppearance` freezes the last actual age, primary state and concurrent reasons before a person is marked deceased. Later time, stress or family exile cannot change that memorial portrait. Imprisonment has no independent domain model in this first version, so it is not inferred from fear or exile and no prison portrait is invented.
