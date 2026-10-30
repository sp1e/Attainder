import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { addGameMonths } from '../gameDates.js';
import { createCharacterSystem, advanceCharacters, executeCharacterCommand, getCharacterPresentation, normalizeCharacterSystem } from './index.js';

const rows = [];
for (const mode of ['realm', 'family']) for (const engaged of [false, true]) for (const seed of [1, 71, 321, 9876]) {
  let state = createCharacterSystem({ mode, seed });
  let marriages = 0;
  let endedAt = null;
  const start = performance.now();
  for (let year = 1; year <= 100; year++) {
    state = advanceCharacters(state, addGameMonths(state.date, 12)).state;
    if (state.status.ended) { endedAt = year; break; }
    if (engaged) {
      const view = getCharacterPresentation(state);
      const action = view.actions.find((item) => item.type === 'marry');
      if (action && !action.disabledReason) {
        const own = action.fields[0].options.map((item) => view.people.find((person) => person.id === item.value)).filter((person) => person.age >= 18 && person.age <= 35).sort((a, b) => a.age - b.age);
        const partners = action.fields[1].options.map((item) => view.people.find((person) => person.id === item.value)).filter((person) => person.age >= 18 && person.age <= 40).sort((a, b) => a.age - b.age);
        let paired = false;
        for (const person of own) { for (const partner of partners) {
          if (person.sex === partner.sex) continue;
          const result = executeCharacterCommand(state, { id: `audit-marriage-${year}-${person.id}-${partner.id}`, expectedRevision: state.revision, type: 'marry', payload: { personId: person.id, partnerId: partner.id } });
          if (result.ok) { state = result.state; marriages++; paired = true; break; }
        } if (paired) break; }
      }
    }
  }
  normalizeCharacterSystem(state);
  const view = getCharacterPresentation(state);
  rows.push({ mode, engaged, seed, elapsedYears: endedAt || 100, ended: state.status.ended, reason: state.status.reason, playerArrangedMarriages: marriages, livingPeople: view.people.filter((person) => person.alive).length, livingControlledFamily: view.families.find((family) => family.id === (mode === 'family' ? state.identity.familyId : view.ruler?.familyId))?.memberIds.length || 0, viableFamilies: view.families.filter((family) => family.memberIds.length).length, births: state.log.filter((event) => event.type === 'birth').length, successions: state.log.filter((event) => event.type === 'succession').length, actions: view.actions.length, openStories: view.stories.filter((story) => story.status === 'open').length, durationMs: Math.round(performance.now() - start), saveBytes: Buffer.byteLength(JSON.stringify(state)) });
}
writeFileSync(new URL('../../../../reports/character-longevity-audit.json', import.meta.url), JSON.stringify({ scope: 'Local pure character engine; 100 years, four seeds, two modes, with and without lawful player-arranged marriages. Not a browser or game-balance acceptance test.', rows }, null, 2));
console.log(JSON.stringify({ runs: rows.length, reached100: rows.filter((row) => row.elapsedYears === 100).length, ended: rows.filter((row) => row.ended), passiveFamily: rows.filter((row) => row.mode === 'family' && !row.engaged).map(({ seed, livingPeople, livingControlledFamily, actions }) => ({ seed, livingPeople, livingControlledFamily, actions })), saveBytes: [Math.min(...rows.map((row) => row.saveBytes)), Math.max(...rows.map((row) => row.saveBytes))], durationMs: [Math.min(...rows.map((row) => row.durationMs)), Math.max(...rows.map((row) => row.durationMs))] }, null, 2));
