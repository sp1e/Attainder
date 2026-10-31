# Succession forecast

The Offices & inheritance view compares the current exercised ruler or regent
ability with the expected next actual ruler's archetype and ability. It lists
the actual ruler, lawful claimant and legal heir separately. A contested crown
does not turn the lawful heir into the predicted actual successor.

The forecast asks what the existing succession rules would select if only the
current ruler died at the current date. It uses the same candidate ranking and
actual-versus-lawful branch as the death transition. Merit ranking excludes the
departing person's secondary-office seats, personal sanctuary support and legal
claim penalty, as the death pipeline does before selecting a successor.

The view does not advance the calendar, simulate a death, draw random numbers,
inspect stored illness outcomes or save a second succession state. A future
death, adoption, law change or coup can change the result. Simultaneous deaths
can invalidate the single-death premise. The actual transition excludes all
people who died at that boundary.

An underage successor needs a regent. The view identifies the child's archetype
without promising immediate use of that ability or naming a future regent.
Existing regency consent and contested handover rules still apply. Current
exercised ability uses the ruler office's regent, even when a family-mode player
controls a different household.
If no adult representative survives, the child retains the title but the
forecast shows no currently exercised ability.

Project continuity follows ownership:

- Personal effects owned by the departing ruler end.
- Another person's effects do not end merely because the ruler dies. A regent's
  effect can end when that mandate ends. Its benefit still requires the
  appropriate exercising holder.
- Active public academy and aqueduct construction continues through a personal
  succession. Dissolution ends public mandates under the existing rules.
- Estate projects retain their family owner and construction schedule.

State mode follows the new actual ruler. Family mode retains the chosen family
when it loses the throne. Continuation still requires a living family member.
Vacant offices, dissolved states and an exhausted candidate population produce
no expected ruler. The shared successor selector now rejects a deceased legal
fallback, allowing the existing interregnum path to end a state with no living
successor.

## Verification

Behavioral tests cover lawful and disputed succession, both merit branches,
minority, regent authority, project donors and owners, identity, extinction,
simultaneous deaths and immutable serializable presentation. Test fixtures use
the normal dated death transition to compare actual outcomes with the forecast.
Browser checks use isolated fixture storage and intercept all API calls. They
cover both themes, narrow layouts and read-only viewing. They do not establish
long-term balance or future political outcomes.
