import { validatePlayableScenario, requirePrepared } from '../../server/historicalPreparation.js';

// The same content used for creation supplies every visible choice.
export function historicalStartOption(details, regions, cities) {
  const data = details?.data, meta = details?.scenario;
  requirePrepared(validatePlayableScenario({ data, meta, regions, cities }));
  const h = data.world.historicalScenario;
  return {
    scenarioId: meta.id, name: meta.name, date: data.game.gameDate, label: h.eraLabelSv,
    context: h.contextSv, coverage: h.coverageNoteSv, calendarNote: h.calendarNoteSv,
    polities: h.playablePolityIds.map(id => ({ id, name: h.polities.find(p => p.id === id).nameSv,
      ruler: h.courtSeeds[id].people.find(p => p.id === h.courtSeeds[id].rulerId),
      families: h.courtSeeds[id].families.map(f => ({ id: f.id, name: f.name ?? f.id })) })),
  };
}
