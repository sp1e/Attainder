import { validatePlayableScenario, requirePrepared } from '../../server/historicalPreparation.js';
import { HISTORICAL_START_ORDER } from '../../server/historicalStarts.js';

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

// A start names its primary polity; a campaign of another listed polity carries that polity's name instead.
export function historicalCampaignName(option, polityId, mode) {
  const [primary] = option.polities, chosen = option.polities.find(p => p.id === polityId) ?? primary;
  const suffix = mode === 'family' ? 'Familjen' : 'Riket';
  if (!chosen || chosen.id === primary.id) return `${option.name} · ${suffix}`;
  const base = option.name.startsWith(primary.name) ? chosen.name + option.name.slice(primary.name.length) : `${chosen.name} · ${option.name}`;
  return `${base} · ${suffix}`;
}

// Starts outside the catalog order, such as imported ones, keep their order after it.
export function orderHistoricalStarts(options) {
  const rank = option => { const at = HISTORICAL_START_ORDER.indexOf(option.scenarioId); return at < 0 ? HISTORICAL_START_ORDER.length : at; };
  return [...options].sort((a, b) => rank(a) - rank(b));
}
