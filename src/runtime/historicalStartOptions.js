import { validatePlayableScenario, requirePrepared } from '../../server/historicalPreparation.js';
import { HISTORICAL_START_ORDER } from '../../server/historicalStarts.js';
import { HISTORICAL_SUMMARY_SCHEMA, historicalStartFromSummary } from '../../server/historicalStartSummary.js';

// The same content used for creation supplies every visible choice. The start card reads
// historicalStartOptionFromSummary instead; this one validates the whole package first.
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

// A catalog scenario the start card offers: a valid summary of the current schema with at least one
// polity, on a scenario that is not a restore-only copy. Both library stores attach the summary.
export const offersHistoricalStart = scenario => {
  const summary = scenario?.historicalSummary;
  return summary?.schema === HISTORICAL_SUMMARY_SCHEMA && Array.isArray(summary.polities) && summary.polities.length > 0
    && historicalStartFromSummary(summary, scenario) !== null;
};

// The card's option from the library catalog's summary, without loading the package. Creation
// still validates the whole package, so a start the summary shows can fail there, not here.
export function historicalStartOptionFromSummary(scenarioId, summary) {
  return {
    scenarioId, name: summary.name ?? scenarioId, date: summary.date, label: summary.eraLabelSv, eraId: summary.eraId,
    context: summary.contextSv, coverage: summary.coverageNoteSv, calendarNote: summary.calendarNoteSv,
    polities: summary.polities.map(p => ({ id: p.id, name: p.nameSv, regionId: p.regionId, ruler: { ...p.ruler },
      families: p.families.map(f => ({ id: f.id, name: f.name })) })),
  };
}

// A start names its primary polity; a campaign of another listed polity carries that polity's name instead.
const campaignBaseName = (name, polities, polityId) => {
  const [primary] = polities, chosen = polities.find(p => p.id === polityId) ?? primary;
  if (!chosen || chosen.id === primary.id) return name;
  return name.startsWith(primary.name) ? chosen.name + name.slice(primary.name.length) : `${chosen.name} · ${name}`;
};

export function historicalCampaignName(option, polityId, mode) {
  return `${campaignBaseName(option.name, option.polities, polityId)} · ${mode === 'family' ? 'Familjen' : 'Riket'}`;
}

// The library bar's picker lists a historical start's playable polities as { code, name }, primary
// first. Its campaigns follow the same rule and keep the bar's " Session" suffix. Without
// polities, as for a scenario that is not historical, the name is the scenario's.
export function pickerCampaignName(scenarioName, polityOptions, polityId) {
  const polities = polityOptions.map(option => ({ id: option.code, name: option.name }));
  return `${campaignBaseName(scenarioName, polities, polityId)} Session`;
}

// Starts outside the catalog order, such as imported ones, keep their order after it.
export function orderHistoricalStarts(options) {
  const rank = option => { const at = HISTORICAL_START_ORDER.indexOf(option.scenarioId); return at < 0 ? HISTORICAL_START_ORDER.length : at; };
  return [...options].sort((a, b) => rank(a) - rank(b));
}
