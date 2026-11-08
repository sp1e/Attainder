// The player's watches, per campaign, in this browser only. The engine never stores them.
// Spec: docs/superpowers/specs/2026-11-08-watches-design.md.
import { getLibraryState } from "./library.js";
import { normalizeWatchIds } from "./characterWatches.js";

const KEY = "attainder-character-watches:";

export const activeWatchCampaignId = () => String(getLibraryState()?.activeGameId ?? "").trim();

/** The watches turned on for a campaign; none when storage is missing or unreadable. */
export const readCharacterWatches = (campaignId = activeWatchCampaignId()) => {
  if (!campaignId) return [];
  try {
    return normalizeWatchIds(JSON.parse(globalThis.localStorage?.getItem(KEY + campaignId) ?? "[]"));
  } catch (error) {
    console.warn(`Bevakningarna för kampanj ${campaignId} kunde inte läsas.`, error);
    return [];
  }
};

/** Stores the known ids and returns them. The choice still holds for this render when storage fails. */
export const writeCharacterWatches = (campaignId, watches) => {
  const ids = normalizeWatchIds(watches);
  if (!campaignId) return ids;
  try {
    globalThis.localStorage?.setItem(KEY + campaignId, JSON.stringify(ids));
  } catch (error) {
    console.warn(`Bevakningarna för kampanj ${campaignId} kunde inte sparas.`, error);
  }
  return ids;
};
