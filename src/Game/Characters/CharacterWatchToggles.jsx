import React, { useState } from "react";
import { WATCH_IDS, WATCH_LABELS } from "../../runtime/characterWatches.js";
import { activeWatchCampaignId, readCharacterWatches, writeCharacterWatches } from "../../runtime/characterWatchSettings.js";

// The player's watches for the active campaign. A turn reads them once when it starts.
export default function CharacterWatchToggles({ disabled = false }) {
  const campaignId = activeWatchCampaignId();
  const [stored, setStored] = useState(() => ({ campaignId, watches: readCharacterWatches(campaignId) }));
  const watches = stored.campaignId === campaignId ? stored.watches : readCharacterWatches(campaignId);
  const toggle = (id) => setStored({ campaignId, watches: writeCharacterWatches(campaignId,
    watches.includes(id) ? watches.filter((entry) => entry !== id) : [...watches, id]) });
  const closeOnEscape = (event) => { if (event.key === "Escape" && event.currentTarget.open) { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } };
  return <details className="char-watches" onKeyDown={closeOnEscape}>
    <summary aria-label={watches.length > 0 ? `Bevakningar, ${watches.length} påslagna` : undefined}>Bevakningar{watches.length > 0 && <span className="char-tab-count" aria-hidden="true">{watches.length}</span>}</summary>
    <div className="char-watches-menu">
      <p>Turen stannar när något av detta händer.</p>
      {WATCH_IDS.map((id) => <label key={id}><input type="checkbox" checked={watches.includes(id)} disabled={disabled}
        onChange={() => toggle(id)} />{WATCH_LABELS[id]}</label>)}
    </div>
  </details>;
}
