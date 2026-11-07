import { activateGame, createGame, ensureLibraryCatalog, loadScenarioDetails, downloadScenarioJsonAsset } from './library.js';
import { normalizeCampaignSeed } from './campaignSeed.js';
import { historicalCampaignName, historicalStartOption, orderHistoricalStarts } from './historicalStartOptions.js';

export async function loadHistoricalStartOptions() {
  const catalog = await ensureLibraryCatalog();
  const scenarios = (catalog?.scenarios ?? []).filter(s => s.historicalStart && !s.restoreOnly);
  const options = [];
  for (const scenario of scenarios) {
    try {
      const [details,regions,cities] = await Promise.all([loadScenarioDetails(scenario.id),downloadScenarioJsonAsset(scenario.id,'regionsGeojson'),downloadScenarioJsonAsset(scenario.id,'citiesGeojson')]);
      options.push(historicalStartOption(details,regions,cities));
    } catch { /* Invalid templates cannot offer a start. */ }
  }
  return orderHistoricalStarts(options);
}

export async function startDynastyCampaign({ mode = 'realm', scenarioId, date, polityId, familyId, difficulty = 'normal', characterDifficulty, seed = 104729 } = {}) {
  seed = normalizeCampaignSeed(seed);
  const options = await loadHistoricalStartOptions();
  const scenario = scenarioId ? options.find(s => s.scenarioId === scenarioId) : options[0];
  if (!scenario) throw new Error('Det finns inget giltigt historiskt scenario att starta.');
  const selectedPolity = polityId ?? scenario.polities[0]?.id;
  const selectedDate = date ?? scenario.date;
  const engineDifficulty = characterDifficulty ?? (difficulty === 'standard' ? 'normal' : difficulty);
  const created = await createGame({ name: historicalCampaignName(scenario, selectedPolity, mode),
    scenarioId: scenario.scenarioId, setActive: false,
    historicalStart: { date: selectedDate, polityId: selectedPolity, mode, ...(familyId ? {familyId} : {}), seed, difficulty: engineDifficulty },
    gamePatch: { country: selectedPolity, difficulty: engineDifficulty === 'normal' ? 'standard' : engineDifficulty, language: 'Swedish' } });
  const gameId = created.game.id;
  try { localStorage.setItem('oh-open-characters-on-start','1'); } catch { /* Optional persistence. */ }
  await activateGame(gameId);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('oh:open-characters'));
  return gameId;
}
