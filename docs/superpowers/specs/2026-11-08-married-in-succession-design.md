# Married-in persons and grandchildren in succession

Date: 8 November 2026. Owner mandate: continue development without pause, decide by rulings.

## Problem

`rulerCandidates` in `server/characters/index.js` ranks the old ruler's legal children first and then every living member of the ruler's family by age. Everyone with the house's `familyId` counts as kin, including persons who married into the house: generated spouses take the family of the person they marry (`server/characters/renewal.js`), and the demo court seeds spouses in the house's family.

In the demo court (Arel, his wife Iset, their daughter Sera, her husband Tarek and their children Mira and Neri, all `family-arel`), Sera's death before Arel's makes the heir:

| Law | Heir today | Expected |
| --- | --- | --- |
| primogeniture | Iset, Arel's widow | Mira, Sera's eldest child |
| elective | Tarek, Sera's widower | Mira's line before married-in adults |

Two causes: married-in persons count as blood kin, and grandchildren stand in the kin group by age instead of in their parent's place.

## Rulings

1. **Married-in.** A living person X of the old ruler's house F is married-in when X has no legal parent in F and X's partner belongs to F's blood line. X's partners are X's spouse (`spouseId` in either direction) and every other legal parent of X's legal children. A partner belongs to the blood line when the partner is the old ruler or has a legal parent in F. Cost if wrong: a generated spouse of a parentless court newcomer still ranks as house kin, as today. A legal parent in F roots a person even when that parent married in, so a child of a married-in widow by an earlier marriage counts as blood line.
2. **Primogeniture line.** The old ruler's descendants through legal-parent links, at any depth, come first in depth-first birth order: the eldest child, then that child's line, then the next child and that line. Dead descendants hold their place for their own descendants and are not candidates. The law stays sex-neutral, as today. Cost if wrong: a grandchild now precedes the old ruler's younger sibling, which matches primogeniture.
3. **Primogeniture order after the line.** Other living members of F who are not married-in, by age; then married-in persons and outsiders, adults only, by age.
4. **Elective.** The house is the old ruler's descendants at any depth plus F's living members who are not married-in under ruling 1 or under the existing `marriedIn` set. Adults of the house by merit, then its minors eldest first, then every other adult by merit. A child the old ruler adopted still adds nobody to the married-in set.
5. **Merit** ranks every adult and is unchanged.
6. No new `random(state)` calls, no new state fields, no package bytes change. `rulesVersion` and `contentVersion` stay `hadara-1.0.0`.

## Tests

- Demo court with Sera dead: primogeniture names Mira; elective names Mira's line before Tarek and Iset, so with Mira a minor and no other house adult, Mira.
- Demo court alive: Sera under all three laws, as today.
- A grandchild through a dead eldest son precedes a living younger son's child, and the younger son precedes his own child.
- A married-in spouse ranks after outsiders of equal standing only by age, never inside the house group.
- Existing succession, forecast, election and court balance suites stay green.
