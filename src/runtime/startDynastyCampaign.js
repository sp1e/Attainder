import { activateGame, createGame, ensureLibraryCatalog, importScenarioBundle, saveGame } from './library.js';
import { createCharacterSystem } from './characters/index.js';
import { DYNASTY_CITIES, DYNASTY_DATE, DYNASTY_SCENARIO_ID, createDynastyScenarioBundle } from './dynastyScenario.js';

export async function startDynastyCampaign({ mode = 'realm', scenarioId, difficulty = 'standard', seed = 104729 } = {}) {
  if (!['realm','family'].includes(mode)) throw new Error('Välj riket eller familjen.');
  let id = scenarioId;
  if (!id) {
    const catalog = await ensureLibraryCatalog();
    id = catalog?.scenarios?.find(s => s.id === DYNASTY_SCENARIO_ID)?.id;
    if (!id) id = (await importScenarioBundle(createDynastyScenarioBundle())).scenario.id;
  }
  // Finish the new campaign before activation, so no incomplete world is shown
  // and no existing campaign or authored scenario is modified.
  const created = await createGame({ name:`Hadara · ${mode === 'family' ? 'Familjen Arel' : 'Riket'}`,scenarioId:id,setActive:false,gamePatch:{country:'Hadara',difficulty,language:'Swedish'} });
  const gameId = created.game.id;
  const date = created.data.game.gameDate || DYNASTY_DATE;
  const world = { ...created.data.world, initialCameraBounds:created.data.world.initialCameraBounds || [[26.7,32.0],[33.4,37.5]], characterSystem:createCharacterSystem({date,polityId:'Hadara',polityName:'Hadara',mode,seed,cities:DYNASTY_CITIES}) };
  await saveGame(gameId,{world,gamePatch:{characterMode:mode}});
  try { localStorage.setItem('oh-open-characters-on-start','1'); } catch { /* storage may be unavailable */ }
  await activateGame(gameId);
  window.dispatchEvent(new CustomEvent('oh:open-characters'));
  return gameId;
}
