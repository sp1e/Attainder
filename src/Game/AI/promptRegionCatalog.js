/*! Open Historia — campaign map catalog selection, AGPL-3.0-or-later (see LICENSE). */
import { loadRegionCatalog, loadScenarioRegionCatalog } from "../../runtime/assets.js";

// Historical scenario geometry is the complete authority, including unknown land.
export const buildPromptRegionCatalog = async (world, { loadScenario = loadScenarioRegionCatalog, loadCombined = loadRegionCatalog } = {}) =>
  world?.historicalScenario?.kind === "historical" ? loadScenario() : loadCombined();
