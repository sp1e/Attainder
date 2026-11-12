import { activateGame, createGame, ensureLibraryCatalog } from './library.js';
import { normalizeCampaignSeed } from './campaignSeed.js';
import { characterLanguage } from './characterLanguage.js';
import { historicalCampaignName, historicalStartOptionFromSummary, offersHistoricalStart, orderHistoricalStarts } from './historicalStartOptions.js';

// The card's starts come from the summaries the library catalog carries; no package is loaded.
export async function loadHistoricalStartOptions() {
  const catalog = await ensureLibraryCatalog();
  const options = (catalog?.scenarios ?? []).filter(offersHistoricalStart)
    .map(scenario => historicalStartOptionFromSummary(scenario.id, scenario.historicalSummary));
  return orderHistoricalStarts(options);
}

const findHistoricalStart = async scenarioId => {
  const options = await loadHistoricalStartOptions();
  return scenarioId ? options.find(s => s.scenarioId === scenarioId) : options[0];
};

// option is the start the card shows; without it the catalog is read and scenarioId picks the start.
// language is the language name stamped on the campaign: the Options choice when the campaign is created.
export async function startDynastyCampaign({ option, mode = 'realm', scenarioId, date, polityId, familyId, difficulty = 'normal', characterDifficulty, seed = 104729, language = characterLanguage() } = {}) {
  seed = normalizeCampaignSeed(seed);
  const scenario = option ?? await findHistoricalStart(scenarioId);
  if (!scenario) throw new Error('Det finns inget giltigt historiskt scenario att starta.');
  const selectedPolity = polityId ?? scenario.polities[0]?.id;
  const selectedDate = date ?? scenario.date;
  const engineDifficulty = characterDifficulty ?? (difficulty === 'standard' ? 'normal' : difficulty);
  const created = await createGame({ name: historicalCampaignName(scenario, selectedPolity, mode),
    scenarioId: scenario.scenarioId, setActive: false,
    historicalStart: { date: selectedDate, polityId: selectedPolity, mode, ...(familyId ? {familyId} : {}), seed, difficulty: engineDifficulty },
    gamePatch: { country: selectedPolity, difficulty: engineDifficulty === 'normal' ? 'standard' : engineDifficulty, language } });
  const gameId = created.game.id;
  try { localStorage.setItem('oh-open-characters-on-start','1'); } catch { /* Optional persistence. */ }
  await activateGame(gameId);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('oh:open-characters'));
  return gameId;
}
