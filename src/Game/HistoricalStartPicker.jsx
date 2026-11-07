import { useState } from 'react';
import { groupHistoricalStartRows, historicalStartRows } from '../runtime/historicalStartPicker.js';

// The start card's list of historical starts: a search field over rows grouped by region and era.
// The rows form one radio group with a roving tab stop, as the card's mode buttons do.
const NAV_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
const keyOf = value => (value ? `${value.scenarioId}/${value.polityId}` : '');
const rowSelector = key => `[data-start-key="${key.replace(/["\\]/g, '\\$&')}"]`;

// Arrows step through the shown rows and wrap; Home and End jump to the ends. A chosen start the
// search hides counts as standing before the first row.
const steppedIndex = (count, at, key) => {
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  const back = key === 'ArrowUp' || key === 'ArrowLeft';
  if (at < 0) return back ? count - 1 : 0;
  return (at + (back ? count - 1 : 1)) % count;
};

function StartRow({ row, chosen, tabStop, disabled, onChoose }) {
  const ruler = row.rulerOrigin ? `${row.rulerName} · ${row.rulerOrigin}` : row.rulerName;
  const kind = row.kindLabelSv ? ` · ${row.kindLabelSv}` : '';
  return <button type="button" role="radio" data-start-key={row.key} tabIndex={tabStop ? 0 : -1} aria-checked={chosen}
    className={chosen ? 'selected' : ''} onClick={() => onChoose(row)} disabled={disabled}>
    <strong>{`${row.polityName} · ${row.eraLabelSv}${kind}`}</strong><span>{ruler}</span>
  </button>;
}

export default function HistoricalStartPicker({ options, value, onChange, disabled = false }) {
  const [query, setQuery] = useState('');
  const rows = historicalStartRows(options);
  const groups = groupHistoricalStartRows(rows, query);
  const shown = groups.flatMap(region => region.eras.flatMap(era => era.rows));
  const chosenKey = keyOf(value);
  const chosenShown = shown.some(row => row.key === chosenKey);
  const tabKey = chosenShown ? chosenKey : shown[0]?.key;
  // A choice the search hides still goes to Start, so the card names it under the list.
  const hiddenChoice = chosenShown ? null : rows.find(row => row.key === chosenKey);
  // Choosing the chosen row again is no change; the card would otherwise reset the picked family.
  const choose = row => { if (row.key !== chosenKey) onChange({ scenarioId: row.scenarioId, polityId: row.polityId }); };
  const onKeyDown = event => {
    if (disabled || !NAV_KEYS.includes(event.key) || shown.length === 0) return;
    event.preventDefault();
    const next = shown[steppedIndex(shown.length, shown.findIndex(row => row.key === chosenKey), event.key)];
    choose(next); event.currentTarget.querySelector(rowSelector(next.key))?.focus();
  };
  return <div className="historical-start-picker">
    <label htmlFor="historical-search">Sök rike, härskare eller tid</label>
    <input id="historical-search" type="search" autoComplete="off" value={query} onChange={event => setQuery(event.target.value)} disabled={disabled} />
    {rows.length > 0 && shown.length === 0 && <p className="dynasty-start-detail">Inga starter matchar sökningen.</p>}
    {shown.length > 0 && <div className="historical-start-list" role="radiogroup" aria-label="Historiska starter" onKeyDown={onKeyDown}>
      {groups.map(region => <div key={region.regionId} role="group" aria-labelledby={`historical-region-${region.regionId}`}>
        <h2 id={`historical-region-${region.regionId}`}>{region.labelSv}</h2>
        {region.eras.map(era => <div key={era.eraId} className="historical-start-era">
          <h3>{era.labelSv}</h3>
          {era.rows.map(row => <StartRow key={row.key} row={row} chosen={row.key === chosenKey} tabStop={row.key === tabKey} disabled={disabled} onChoose={choose} />)}
        </div>)}
      </div>)}
    </div>}
    {hiddenChoice && <p className="dynasty-start-detail">{`Vald start: ${hiddenChoice.polityName} · ${hiddenChoice.eraLabelSv}`}</p>}
  </div>;
}
