# Character capacity

Age and the ability to exercise a mandate are separate rules. A severe illness must not turn an adult into a minor or change succession eligibility.

`characterCapacity.js` provides pure queries for age, adulthood, incapacity causes and regent selection. The existing `getCharacterAge` export in `index.js` remains available. It uses the same birthday rule and BCE/CE calendar as before.

Only severity-three smallpox, fever or injury in an active or recovering stage prevents a person from exercising a mandate. The query follows recorded health stages at the requested date. Scars, grief, stress, low general health and lesser illness alone do not meet this rule. Multiple qualifying conditions are returned as sorted condition IDs.

A proposed regent must be a living, capable adult other than the principal. Selection prefers the principal's family, then older candidates, with ID as the final tie-breaker. A new regent for an incapacitated ruler needs political access: an exiled family is excluded. A family in exile can still use a member of its own household, but an exiled outsider is excluded. Existing minority access rules are preserved apart from the capacity check.

These queries do not appoint anyone, transfer property, spend resources, advance time or consume randomness. This foundation does not yet activate illness regencies in the campaign. The following integration step must manage mandate episodes, consent, recovery, ownership and presentation together.
