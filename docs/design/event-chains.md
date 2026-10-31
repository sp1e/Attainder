# Persistent character event chains

This describes the 31 October 2026 implementation checkpoint. Final integration acceptance is still pending; see `../development/CONTINUE-HERE.md`.

## Content and selection

Eight original Swedish templates cover the sick household, a former regent, a child's mentor, a governor and religious leader, former military service, a rival family's grievance, an accepted exile host and a public memory involving a deceased relative. Each has four stages, two active alternatives and a free close option. Saved flags alter later text; eight alternatives in the latter four templates also require particular earlier choices.

Candidates bind actual people and institutions. The former-service chain requires recorded tenure in the general's office, rather than inventing a battle or unpaid wage claim. The letter uses an existing public patronage memory and does not create an inherited debt. Education applies to a child in the household; it does not establish heir status. Local religious presence currently means the religion of the city's patron family, not a separate population simulation.

The director selects at most one new chain per year and allows at most two active chains. Candidate weights consider relevant traits or conditions. A template waits 60 months before another start, and the same source cannot start a second chain. Active casts do not overlap. Continuations bypass the annual selection and topic cooldown; they open on their saved dates. Sickroom stages use one-month intervals so choices can occur during an actual health episode. Other content uses three- or six-month intervals.

## Choices, authority and consequences

Each active choice rechecks the current capable actor for its scope, current royal authority where required, the appropriate treasury, bound roles and prior flags. State and family funds remain separate. These story decisions cost zero action points; silver and personality-dependent stress remain visible. A free close works without an actor or money and produces no automatic political or economic effect.

Effects are a fixed vocabulary for stress, skills, directed opinion, family influence/support, army strength, city unrest/infrastructure and religious support. They cannot appoint an officeholder, transfer another person's money, invent a claim, cause death or rewrite health. Actual historical roles remain bound across steps. A new authorized decision maker may make a later choice, but does not replace the earlier decision maker in history.

A participant's death, loss of a required office, mentor/host replacement or another invalid binding closes the chain with a reason. The old decisions remain. An unanswered step closes after twelve months with no inferred choice or payment. It does not silently select a branch for the player.

## Saved state and calendar

`eventChains.version:1` adds an activation date, separate saved RNG, sequence, records and cooldowns. Legacy activation creates an empty director without historical events or RNG draws. Each chain retains its source, origin memory, cast, role families, institutional references, flags and ordered step IDs. Each new step is a separate `event_chain` story with a causal link to the preceding outcome memory. The active chain never depends on the rolling recent-memory window.

Waiting continuations and open deadlines join the character calendar's health, majority and annual boundaries. The host includes chain steps in its existing character-decision interruptions before asking the model to narrate beyond the boundary. Existing model operations remain advisory. Core `advanceCharacters` retains full-target deterministic simulation; the interactive host supplies pauses.

Validation checks known templates, versions, dates, historical roles, causal references, flags reconstructed from resolved choices and the declared step order. Commands use the existing copied-state transaction and command IDs. Storage uses the existing journal/snapshot recovery protocol. These invariants still need the final adversarial and interrupted-storage checks listed in the continuation document.
