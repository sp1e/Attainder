// The start card's picker: one row per playable polity of every start, grouped by world region and
// then by era, and filtered by a search that ignores case, diacritics and stray whitespace.
import { HISTORICAL_ERAS, HISTORICAL_REGIONS, foldSearchText, historicalEraFor, regionForPolity } from '../../server/historicalStartSummary.js';
import { compareGameDates } from '../../server/gameDates.js';

const REGION_IDS = new Set(HISTORICAL_REGIONS.map(region => region.id));
const ERA_BY_ID = new Map(HISTORICAL_ERAS.map(era => [era.id, era]));

// The summary's region, or the shared table's when the option predates it; an unknown id is Övriga.
const rowRegion = polity => {
  const regionId = polity.regionId ?? regionForPolity(polity.id);
  return REGION_IDS.has(regionId) ? regionId : 'other';
};

const rowEraId = option => (ERA_BY_ID.has(option.eraId) ? option.eraId : historicalEraFor(option.date)?.id ?? HISTORICAL_ERAS[0].id);

// eraLabelSv is the start's own label ("800 e.Kr."); the search also matches the era group's name.
function startRow(option, polity) {
  const eraId = rowEraId(option);
  const rulerName = polity.ruler?.name ?? '', rulerOrigin = polity.ruler?.originLabelSv ?? '';
  const eraLabelSv = option.label ?? ERA_BY_ID.get(eraId).labelSv;
  return {
    key: `${option.scenarioId}/${polity.id}`, scenarioId: option.scenarioId, polityId: polity.id,
    polityName: polity.name, eraLabelSv, eraId, regionId: rowRegion(polity), rulerName, rulerOrigin, date: option.date,
    searchText: foldSearchText([polity.name, option.name, eraLabelSv, ERA_BY_ID.get(eraId).labelSv, rulerName].join(' ')),
  };
}

export const historicalStartRows = options => options.flatMap(option => option.polities.map(polity => startRow(option, polity)));

const byDateThenName = (a, b) => compareGameDates(a.date, b.date) || a.polityName.localeCompare(b.polityName, 'sv');

// Regions in HISTORICAL_REGIONS order, eras in HISTORICAL_ERAS order, empty groups dropped.
export function groupHistoricalStartRows(rows, query) {
  const needle = foldSearchText(query);
  const shown = needle ? rows.filter(row => row.searchText.includes(needle)) : rows;
  return HISTORICAL_REGIONS.map(region => ({
    regionId: region.id, labelSv: region.labelSv,
    eras: HISTORICAL_ERAS.map(era => ({
      eraId: era.id, labelSv: era.labelSv,
      rows: shown.filter(row => row.regionId === region.id && row.eraId === era.id).sort(byDateThenName),
    })).filter(era => era.rows.length > 0),
  })).filter(region => region.eras.length > 0);
}
