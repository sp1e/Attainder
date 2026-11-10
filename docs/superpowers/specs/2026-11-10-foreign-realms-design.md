# Foreign realms live beside the court

Date: 10 November 2026. Phase 6 foundation of `2026-10-31-ai-game-master-design.md` ("Claude's call: add two or three neighboring realms with ruling families and smaller courts"). Owner mandate: continue without pause and decide by rulings. Moments 7, 24, 26 and 27 build on this.

## Problem

A historical package holds a court seed for every playable polity, but `narrowToChosenCourt` (`server/historicalPreparation.js`) keeps only the chosen one in the save. The character engine knows no ruler outside its own realm. `state.externalHosts` lists exile hosts by name only, and `world.wars` belongs to the world model. Moment 7 needs a neighbor's daughter, moment 26 a neighbor to claim from, and moment 27 a king who remembers. All three need foreign rulers who age, marry, have children and die.

## Rulings

1. **Historical campaigns only.** `state.foreignRealms` exists only when `state.historicalOrigin` is set. Hadara gets no field and plays byte for byte as on `main`. A historical save from before this change normalizes to an empty list, since its package court seeds are gone. Cost if wrong: older historical campaigns have no neighbors.
2. **Seeded at creation.** `createHistoricalCharacterSystem` runs before the package is narrowed, so it reads every other court seed. Each foreign realm keeps its polity id and name, succession law, seat name and the distance in kilometres between the two seats (great circle from settlement coordinates). The list holds the eight nearest, sorted by distance. A realm within 2,500 km counts as a neighbor.
3. **Ruling family only.** A foreign realm stores its ruler, generated or not, and the documented members of the ruler's family from the seed: id, name, sex, birth date, parents and spouses. Generated courtiers stay out. Foreign people never enter `state.people`, so marriages, plots and court stories inside the realm cannot pick them.
4. **A yearly life.** In the yearly court step, each living foreign person dies with a chance by age: 1 % under 16, 1.5 % to 39, 3 % to 59, 7 % to 69, 14 % to 79 and 30 % from 80. A married woman aged 16 to 44 with a living husband has a child with a chance of 20 %. An unmarried ruler aged 16 to 50 marries with a chance of 20 %, except under an elective law (the papacy and similar). Every roll is `hashRoll` of the plot stream state, the date, the realm and the person. Nothing draws from a stream.
5. **Generated names.** A generated person is named by relation to a documented person: "Dotter till Harun ar-Rashid", "Gemål till Alfonso II den kyske", "Efterträdare till Leo III". When that person is generated too, the name gives the realm and birth year instead, "Son (Kyrkostaten, född 842)", so names never nest. The record marks them `generated`.
6. **Succession.** When a foreign ruler dies, primogeniture passes the crown to the eldest living son and then the eldest living daughter. After that, and under every other law, the crown goes to the eldest living adult man in the record. When no one qualifies, a generated successor aged 35 takes the throne. The court log records the death and the accession as public events.
7. **Bounded size.** A realm of 16 people has no more children, and after each year the oldest dead who are neither the ruler nor a parent of a living person leave the record until it holds 16 again. A save holds at most 64 people per realm. The foreign years go on after the player's realm falls.
8. **Opinion and memory.** Each realm holds `memories`: dated entries with a label, an amount and an end date. `foreignOpinion(state, realmId)` sums the live entries, held to −100…100. This change adds no source of memories; moments 7, 26 and 27 add them.
9. **Shown to the player.** The court tab lists the neighbors: realm, ruler and age, heir, distance and opinion.
10. **Not in scope.** No link to `world.wars` or `world.polityOverrides`: a realm the world model dissolves stays in the list until a later moment reconciles them. Cost if wrong: the panel can show a fallen realm.
11. **No version change.** `rulesVersion` and `contentVersion` stay `hadara-1.0.0`.
