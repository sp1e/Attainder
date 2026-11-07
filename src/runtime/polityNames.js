/*! Open Historia — country display-name resolver © 2026 Nicholas Krol, AGPL-3.0-or-later (see LICENSE). */
// Codes ("RUS", "KHAL") are load-bearing identifiers everywhere in the data,
// but the PLAYER should only ever see full names. This resolves a code to the
// era polity name (world.polityOverrides) or the base country name, with the
// code itself as a last resort, and caches the lookup for cheap sync access.
import { useEffect, useState } from "react";
import { JSON_URLS, loadCountryNames, readJson } from "./assets.js";
import { shouldRefreshPolityNames } from "./polityNamesRefresh.js";

let nameByCode = new Map();
let refreshedAt = 0;
let inflight = null;

const refresh = async () => {
  const [countries, world] = await Promise.all([
    loadCountryNames().catch(() => []),
    readJson(JSON_URLS.world, { defaultValue: {}, force: true }).catch(() => ({})),
  ]);
  const next = new Map();
  for (const country of countries ?? []) {
    if (country?.code) next.set(String(country.code), country.name || country.code);
  }
  // Era polities win over modern names for the same code — but only when
  // they actually carry a name; a nameless override must not degrade one.
  for (const polity of Object.values(world?.polityOverrides ?? {})) {
    if (polity?.code && polity?.name) next.set(String(polity.code), polity.name);
  }
  nameByCode = next;
  refreshedAt = Date.now();
};

// Codes a reload came back without, mapped to that reload's refreshedAt (polityNamesRefresh.js).
const missedAt = new Map();

const runRefresh = () => {
  inflight = inflight ?? refresh().finally(() => {
    inflight = null;
  });
  return inflight;
};

// A code passed in reloads the cache early when the cache does not know it (polityNamesRefresh.js).
// A reload that was already running may have read the world before a new game became active, so a
// code it does not resolve gets one reload of its own before it counts as missing.
export const ensurePolityNames = async (code) => {
  if (!shouldRefreshPolityNames({ now: Date.now(), refreshedAt, code, known: nameByCode, missedAt })) return;
  const key = String(code ?? "").trim();
  const joined = inflight !== null;
  await runRefresh();
  if (key && joined && !nameByCode.has(key)) await runRefresh();
  if (key && !nameByCode.has(key)) missedAt.set(key, refreshedAt);
};

// Sync lookup — falls back to the code until ensurePolityNames has run.
export const polityDisplayName = (code) => {
  const key = String(code ?? "").trim();
  if (!key) return "";
  return nameByCode.get(key) || key;
};

// Hook variant for single values: renders the code briefly, then the name.
export const useCountryDisplayName = (code) => {
  const [name, setName] = useState(() => polityDisplayName(code));

  useEffect(() => {
    let cancelled = false;
    setName(polityDisplayName(code));
    ensurePolityNames(code).then(() => {
      if (!cancelled) setName(polityDisplayName(code));
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  return name;
};
