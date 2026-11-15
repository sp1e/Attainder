// Rulers at their seats on a historical campaign's map: a medallion per realm, with the portrait the court shows, that
// opens the court on a press. The list is built in seatRulers.js.
// Spec: docs/superpowers/specs/2026-11-13-living-map-design.md, slice 6.
import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Marker } from "react-map-gl/maplibre";
import { JSON_URLS, readJson } from "../../runtime/assets.js";
import { useLibraryState } from "../../runtime/library.js";
import { useCourtView } from "../../runtime/useCourtView.js";
import { readNative, useTranslatorUpdates } from "../../runtime/useTranslatorUpdates.js";
import MedallionPicture from "../Characters/MedallionPicture.jsx";
import { medallionOf, seatRulers } from "./seatRulers.js";
import { getPlayerCode, subscribeUnits } from "./unitsController.js";

const SIZE = 40;
const OWN_RIM = "#d4ac3a";
const OTHER_RIM = "rgba(239, 230, 210, 0.92)";
const MEDALLION_STYLE = {
  width: SIZE,
  height: SIZE,
  padding: 0,
  borderRadius: "50%",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#14100c",
  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.55)",
  cursor: "pointer",
  color: "#efe6d2",
  font: "600 15px Georgia, serif",
};

// A failed read leaves the map as it was: the medallions are an extra, and the court panel reports its own failures.
const warn = (what, error) => console.warn(`[map] the rulers at their seats: ${what} could not be read:`, error);

/** The package's cities, read once per campaign and again when the city editor announces a change. */
const useSeatCities = (activeGameId, hasCourt) => {
  const [loaded, setLoaded] = useState({ campaign: null, cities: null });
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    const again = () => setEpoch((count) => count + 1);
    window.addEventListener("oh:cities-updated", again);
    return () => window.removeEventListener("oh:cities-updated", again);
  }, []);
  useEffect(() => {
    if (!hasCourt) return undefined;
    let current = true;
    readJson(JSON_URLS.citiesGeojson, { defaultValue: null })
      .then((cities) => { if (current) setLoaded({ campaign: activeGameId, cities }); })
      .catch((error) => { if (current) warn("the cities", error); });
    return () => { current = false; };
  }, [activeGameId, hasCourt, epoch]);
  // Another campaign's cities are never shown while this one's are on their way.
  return loaded.campaign === activeGameId ? loaded.cities : null;
};

const openCourt = (event) => {
  // The press is the medallion's: the province under it does not open.
  event?.originalEvent?.stopPropagation();
  window.dispatchEvent(new CustomEvent("oh:open-characters"));
};

/** One ruler at one seat. */
const Medallion = ({ ruler, label, medallion }) => {
  const marker = useRef(null);
  useEffect(() => {
    const element = marker.current?.getElement?.();
    if (!element) return undefined;
    // MapLibre makes the marker's wrapper a button named "Map marker". The button is the one inside it.
    element.setAttribute("role", "presentation");
    element.removeAttribute("aria-label");
    // A double press is two presses on the medallion, not a zoom of the map.
    const stop = (event) => event.stopPropagation();
    element.addEventListener("dblclick", stop);
    return () => element.removeEventListener("dblclick", stop);
  }, []);
  return (
    <Marker ref={marker} longitude={ruler.longitude} latitude={ruler.latitude} anchor="bottom" offset={[0, -10]} onClick={openCourt}>
      <button type="button" className="oh-tap" aria-label={label} title={label} style={{ ...MEDALLION_STYLE, border: `2px solid ${ruler.own ? OWN_RIM : OTHER_RIM}` }}>
        <MedallionPicture medallion={medallion} />
      </button>
    </Marker>
  );
};

const SeatRulers = () => {
  const { activeGameId } = useLibraryState();
  // The court is read once per revision and shared with the shell over the map (useCourtView.js).
  const { hasCourt, view } = useCourtView(activeGameId);
  const cities = useSeatCities(activeGameId, hasCourt);
  const playerPolity = useSyncExternalStore(subscribeUnits, getPlayerCode);
  const updates = useTranslatorUpdates();
  const rulers = useMemo(() => seatRulers({ cities, view, playerPolity }), [cities, view, playerPolity]);

  return rulers.map((ruler) => {
    const label = [ruler.rulerName, ruler.realmName].filter(Boolean).map((text) => readNative(text, updates)).join(", ");
    const medallion = medallionOf(ruler.person, (text) => readNative(text, updates));
    return <Medallion key={ruler.polityId} ruler={ruler} label={label} medallion={medallion} />;
  });
};

export default SeatRulers;
