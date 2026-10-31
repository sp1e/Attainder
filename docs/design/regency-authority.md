# Regency authority

A child may hold the crown while an adult regent exercises its powers. Annual NPC appointments and office-promise decisions use that adult's mandate. The child's personality does not decide an appointment on the regent's behalf.

## Executive and player control

`realmExecutive` resolves the living adult who may exercise royal power. A minor requires a living adult regent whose active record matches the ruler's office. An unresolved contested handover or an absent executive prevents royal decisions. This lookup does not depend on campaign mode.

`canRule` adds the player's control boundary. In family mode, the family's head must hold the crown or its regency, and the active family representative must be the royal executive. A separate family guardianship grants no royal rights. A family guardian and royal regent may therefore differ without transferring either mandate.

The annual AI leaves vacant public offices to a player who controls royal power, including a player acting through a regent. For an NPC government, it ranks eligible adults using the executive's opinion and the relevant office skill. It checks the royal appointment veto before each appointment. If no authority or consent is available, the office remains vacant.

## Vetoes and consent

Royal vetoes follow `office:ruler` in both campaign modes, including when the player's family head is the regent rather than the child. Family vetoes follow the controlled family's own guardianship. Estate investment and adoption use the family mandate. Public appointments use the royal mandate.

A successful appointment consumes one unexpired, unused royal consent. NPC annual appointments and observed promise decisions use the same royal record, even when the player follows an unrelated family. Another vacancy requires another consent if the veto still applies. Failed commands preserve the original state, including wallets and grants. Consent expires at its recorded expiry date.

## Office promises

In `office_promise`, an NPC executive with a dutiful or compassionate personality can promise an office. An appointment veto blocks that commitment until consent is available. Making the promise does not consume appointment consent: the later appointment must pass the checks again and may happen after the consent expires.

In `promise_due` and `legacy_claim`, a dutiful NPC executive seeks to honor the promise when the state has enough silver. A compassionate executive can settle for compensation. Otherwise the executive breaks the promise. Before honoring, the code checks royal authority and veto. The appointment also requires a valid administrative office and an eligible member of the claimant family. It refuses a new appointment when the candidate already holds that office.

`observe` and `advocate` cannot bypass these checks. The observer pays nothing. Successful advocacy costs the player's family ten silver. An appointment costs the state ten silver. Validation runs before either payment. Existing settlement and broken-promise consequences remain in effect.

When the mandate is contested or vacant, or the proposed appointment is blocked, the player can defer the matter for one year without payment. The story remains pending. Automatic expiry selects this available deferral instead of attempting a disabled choice and closing the story. A veto does not silently turn a dutiful executive's intended appointment into a broken promise.

Waiting office promises reopen on their exact `dueAt` date, including between annual turns. The common transition update records `reopenedAt` and exposes choices again. Automatic expiry measures the response window from that reopening, so it cannot immediately resolve or defer an old story during the same update. The original creation date remains intact.

## Persistence and verification

This correction adds the optional story timestamp `reopenedAt`, with the original creation date as the fallback for older stories. It adds no regency phases and changes no ownership or succession rules. Normalization preserves the input. The correction changes future decisions in an existing campaign without rewriting prior appointments or memories.

`src/runtime/characters/regencyAuthority.test.js` checks royal control in both campaign modes, including external regents and split guardians. It exercises observer and advocate decisions under contested or missing mandates. Consent and rollback tests check who pays and which grant is consumed. Calendar replay tests compare uninterrupted progress with JSON save and resume. Existing character-system tests cover the surrounding rules. Synthetic tests do not establish visual acceptance or behavior in a real campaign save.
