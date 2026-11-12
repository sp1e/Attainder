// The start card's picker: one row per playable polity of every start, grouped by world region and
// then by era, and filtered by a search that ignores case, diacritics and stray whitespace.
import { HISTORICAL_ERAS, HISTORICAL_REGIONS, foldSearchText, historicalEraFor, regionForPolity } from '../../server/historicalStartSummary.js';
import { compareGameDates } from '../../server/gameDates.js';
import { POLITY_KIND_LABELS_SV } from './characters/content.js';

const REGION_IDS = new Set(HISTORICAL_REGIONS.map(region => region.id));
const ERA_BY_ID = new Map(HISTORICAL_ERAS.map(era => [era.id, era]));

// The summary's region, or the shared table's when the option predates it; an unknown id is Övriga.
const rowRegion = polity => {
  const regionId = polity.regionId ?? regionForPolity(polity.id);
  return REGION_IDS.has(regionId) ? regionId : 'other';
};

const rowEraId = option => (ERA_BY_ID.has(option.eraId) ? option.eraId : historicalEraFor(option.date)?.id ?? HISTORICAL_ERAS[0].id);

// A state, or a polity from an option without a kind, shows no kind; another kind shows its label.
const kindLabel = kind => (kind !== 'state' && Object.hasOwn(POLITY_KIND_LABELS_SV, kind ?? '') ? POLITY_KIND_LABELS_SV[kind] : '');

// The search reads each field as written and, when `translate` gives another reading, as the page shows
// it. The fields are Swedish and English mode swaps them for English at display time, so without the
// second reading a player who sees "Roman Empire" could not find it by typing "Roman".
const searchTextOf = (fields, translate) => foldSearchText(fields.flatMap(field => {
  const shown = field ? translate(field) : field;
  return typeof shown === 'string' && shown && shown !== field ? [field, shown] : [field];
}).join(' '));

// eraLabelSv is the start's own label ("800 e.Kr."); the search also matches the era group's name.
function startRow(option, polity, translate) {
  const eraId = rowEraId(option);
  const rulerName = polity.ruler?.name ?? '', rulerOrigin = polity.ruler?.originLabelSv ?? '';
  const eraLabelSv = option.label ?? ERA_BY_ID.get(eraId).labelSv;
  const kindLabelSv = kindLabel(polity.kind);
  return {
    key: `${option.scenarioId}/${polity.id}`, scenarioId: option.scenarioId, polityId: polity.id,
    polityName: polity.name, eraLabelSv, eraId, regionId: rowRegion(polity), kindLabelSv, rulerName, rulerOrigin, date: option.date,
    searchText: searchTextOf([polity.name, option.name, eraLabelSv, ERA_BY_ID.get(eraId).labelSv, rulerName, kindLabelSv], translate),
  };
}

const asWritten = text => text;

// `translate` maps a field to what the page shows for it (nativeReading in translator.js). This module
// stays pure, so the picker passes it in; left out, the search reads the source text alone.
export const historicalStartRows = (options, translate = asWritten) =>
  options.flatMap(option => option.polities.map(polity => startRow(option, polity, translate)));

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
