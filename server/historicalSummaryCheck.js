// The start card's summary after the full start validation. historicalStartSummary checks only what
// the card shows; this runs validatePlayableScenario on the same inputs Start uses, so a start that
// would fail there reads as invalid and the card leaves it off. Both library stores call it when they
// build a summary, and a cached summary is not checked again until its stamp changes.
// Spec: docs/superpowers/specs/2026-11-08-start-summary-schema-5-design.md.
import { validatePlayableScenario } from "./historicalPreparation.js";
import { historicalStartSummary } from "./historicalStartSummary.js";

const invalidOf = ({ schema, sourceStamp, date, contentId }) => ({ schema, sourceStamp, invalid: true, date, contentId });

// The check passes no meta: historicalStartFromSummary leaves restore-only copies off by the current
// meta, and a summary cached on the world and game stamp must not record a meta flag.
// loadMap() gives { regions, cities }. It runs only for a start that passed the structural checks,
// so a scenario that is not historical never reads or parses its map here.
export const checkedHistoricalStartSummary = ({ meta, data, sourceStamp = null, loadMap }) => {
  const summary = historicalStartSummary({ meta, data, sourceStamp });
  if (!summary || summary.invalid === true) return summary;
  const { regions = null, cities = null } = loadMap() ?? {};
  return validatePlayableScenario({ data, regions, cities }).ok ? summary : invalidOf(summary);
};
