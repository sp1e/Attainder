# Character capacity

Age and the ability to exercise a mandate are separate rules. A severe illness must not turn an adult into a minor or change succession eligibility.

`characterCapacity.js` provides pure queries for age, adulthood, incapacity causes and regent selection. The existing `getCharacterAge` export in `index.js` remains available. It uses the same birthday rule and BCE/CE calendar as before.

Only severity-three smallpox, fever or injury in an active or recovering stage prevents a person from exercising a mandate. The query follows recorded health stages at the requested date. Scars, grief, stress, low general health and lesser illness alone do not meet this rule. Multiple qualifying conditions are returned as sorted condition IDs.

A proposed regent must be a living, capable adult other than the principal. Selection prefers the principal's family, then older candidates, with ID as the final tie-breaker. A new regent for an incapacitated ruler needs political access: an exiled family is excluded. A family in exile can still use a member of its own household, but an exiled outsider is excluded. Existing minority access rules are preserved apart from the capacity check.

These queries do not appoint anyone, transfer property, spend resources, advance time or consume randomness. The campaign now uses them through `mandateEpisodes.js` at health transitions, birthdays, normalization and before commands or annual AI decisions.

## Temporary representation

A severe condition opens an incapacity episode without replacing the nominal ruler, lawful claimant or family head. Royal and household representatives are selected separately. A command uses the actor and treasury authorized for its scope; a royal regent cannot spend another family's money through the royal mandate. If nobody is capable, the mandate remains vacant and time can continue.

Overlapping conditions share one episode. A new condition after recovery opens another. If the serving representative dies or becomes incapacitated, a replacement receives a new term within the episode. Consent is bound to the episode, term and regent; a replacement cannot use the previous person's grants.

A minor who turns eighteen while severely ill keeps the minority episode and any capable serving regent. Ordinary handover is considered once the principal recovers. An already contested handover stays a dispute with its original claimant; illness does not resolve it or give that claimant executive authority. Adult incapacity ends automatically on recovery and does not itself create a succession dispute.

Personal projects keep their owner and end date while their effect pauses without that person's executive mandate. Recovery restores only an unexpired effect. State construction and family estates retain their normal rules. Severe incapacity also suspends the affected NPC's personal political agenda; health progression remains calendar-driven.

## Saved state

The additive `mandateVersion: 1` extension records an activation date, sequence, episode IDs, term IDs, basis and qualifying condition IDs. Legacy saves activate at their saved date without new historical events or random draws. Existing consent survives only a matching minority principal and regent. Unknown versions, malformed dates, foreign condition references and contested records without a named claimant are refused.

Commands and time advances return the original state on failure. Tests compare whole advances with monthly JSON save/resume, exercise independent public and private decision makers, and verify that incapacity changes neither property ownership nor the lawful successor.
