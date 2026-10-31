> Archived design input, 31 October 2026. See the current character-capacity and event-chains documents for implemented behavior and remaining acceptance work.

# Adult incapacity regency: first playable scope

Proposal for Main, based on Worker1's confirmed findings. This is a game rule,
not a claim about real disease. No implementation or behavioral verification
has been performed for this proposal.

## Rule

An adult family head or ruler needs a regent while a severity-3 `fever`,
`smallpox` or `injury` is `active` or `recovering`. Keep `adult` as an age
check. Add separate incapacity and mandate-exercise checks, used by commands,
annual AI and observer decisions. Preserve separate `family:<id>` and
`office:ruler` records.

Select a living adult without qualifying incapacity through existing eligible
candidate rules and deterministic ordering. Reject self-selection or circular
representation. Replace a dead/incapacitated regent. With no candidate, permit
time advancement but block orders requiring that mandate.

The principal retains the crown and succession position. Property and campaign
identity do not change. A foreign royal regent gains public authority, not access
to the principal's private treasury. Resolve household ownership independently
of the acting regent's family.

## Transitions

Reconcile after every health boundary, including subannual recovery without
death, and before AI or commands act at that date. Overlapping qualifying
conditions share one episode. When all causes cease, restore authority
automatically. Adult incapacity alone cannot trigger contested handover.

Bind grants and `requestAfter` to the mandate episode and serving regent.
Recovery or replacement invalidates them. Later relapse creates a new episode.
Failed orders do not consume consent. Successful authorized orders consume it once.

Keep project owners and calendar dates. Suspend unavailable mandate-dependent
benefits without extending duration or applying principal/regent effects twice.
Recovery restores only unexpired eligible benefits. Public construction and
family estates retain their schedules.

Portraits retain the principal's identity and existing health atlases. Display
the regent separately with the reason and affected mandate. Explain blocked
orders when no representative qualifies and keep time controls usable.

## Save activation and Main's decisions

Introduce a feature version and activation date. Activate old saves at their
saved date, deriving required representation before the next order.
Normalization must be deterministic and idempotent: no RNG draws, time advance,
resource spending or invented historical events. Preserve minority/contested
records and validate new references. Reject unsupported versions.

Main approved the following decisions on 2026-10-31:

- **D1 — Adulthood while severely ill:** retain qualified representation until recovery.
  Preserve the minority record, then apply its ordinary handover/contestation
  rules once upon recovery. Existing contested records survive illness.
  A birthday must not reset the episode, grants or cooldowns for free.
- **D2 — Healthy and eligible:** healthy means no qualifying severe incapacity.
  Lesser illness is allowed. Selection is deterministic and family-first.
  New adult-incapacity royal regents require physical political access: candidates
  from exiled families are ineligible. A member of the family's own exiled
  household remains eligible as its family regent. An outside-family household
  fallback must be a healthy adult from a non-exiled family. Flag any required
  change to existing minority eligibility for Main's assessment. Do not apply a
  broad policy migration to minority mandates without that assessment.
- **D3 — Legacy consent:** preserve valid old grants only for the same unchanged
  minority mandate and serving regent. Never transfer them into an incapacity episode.
  Explain activation through current UI state without inventing a history event.

## Acceptance tests

1. Test every qualifying stage/kind at severity 3. Severity 2, scars, resolved
   conditions and unrelated kinds must not activate this rule.
2. Subannual recovery restores authority immediately. One remaining condition
   retains the episode. Relapse cannot reuse grants or cooldown entries.
3. Compare identical principal/regent pairs in realm and family modes, plus an
   unrelated player family. Check direct orders, annual AI and observer paths.
   No unauthorized appointment or public expense is allowed.
4. Regent death/incapacity chooses an eligible replacement or blocks orders.
   Time remains available. Royal and family mandates remain independent.
5. Consent succeeds once, survives unrelated failed orders and expires normally.
   Replacement/recovery prevents later reuse.
6. Verify crown, property, campaign identity and private balances remain intact.
   Foreign regents gain no private-family spending rights.
7. Expired projects stay expired. Overlapping illnesses neither duplicate effects
   nor extend building schedules.
8. Cover adulthood while ill and pre-existing contested handovers under D1.
   Verify D2's royal/exiled-household/fallback eligibility separately, and flag
   changes to existing minority eligibility. Verify D3 against a changed regent
   and an incapacity episode. Normalize old saves twice without changing RNG/history/balances.
   Round-trip active episodes and reject invalid references/future versions.
9. Isolated browser fixtures show principal/regent separately, clear blocked-order
   reasons and usable time controls in both themes at narrow width.

## Minimum file boundaries

- `health.js`: qualifying-condition query and transition information.
- `governance.js`: mandate episodes, eligibility and handover/consent rules.
- `index.js`: authority resolution and boundary scheduling, save activation,
  project effects and presentation. Reuse the current authority fix.
- `CharactersPanel.jsx`: mandate explanation and separate regent display using
  existing portraits.
- Focused character/governance/health tests and `CONTRACT.md`: migration and
  transition invariants. Browser evidence stays under reports.

Paths refer to the existing character modules. Confirm final file scope against
the frozen authority fix. No new succession system or portrait assets are proposed.
