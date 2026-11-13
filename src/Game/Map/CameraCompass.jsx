// The compass of a leaning map. In a historical campaign the camera may lean and turn (historicalCartography.js); this
// button stands over the search button while the camera is off its resting view, shows where north is, and brings the
// view back on a press. Spec: docs/superpowers/specs/2026-11-13-living-map-design.md, slice 3.
import React, { useEffect, useState } from "react";
import { useMap } from "react-map-gl/maplibre";
import { SAFE_BOTTOM, SAFE_LEFT, useTouchPrimary } from "../../runtime/mobileUi.js";
import { BESIDE_DOCK_LEFT, DOCK_BUTTON_BOTTOM } from "../GameUI/hudDock.js";
import { cameraOffRest } from "./historicalCartography.js";

// The sizes of the search button it stands over (GameUI/search.jsx).
const COMPACT_SIZE = "2.4rem";
const TOUCH_SIZE = "2.75rem";
const AT_REST = Object.freeze({ off: false, bearing: 0 });

const CameraCompass = ({ rest = 0 }) => {
  const { current: map } = useMap();
  const isTouch = useTouchPrimary();
  const [view, setView] = useState(AT_REST);

  useEffect(() => {
    const instance = map?.getMap ? map.getMap() : map;
    if (!instance?.on) return undefined;
    const read = () => {
      const bearing = Math.round(instance.getBearing());
      const off = cameraOffRest({ bearing: instance.getBearing(), pitch: instance.getPitch() }, rest);
      // A drag fires `move` every frame; the button changes only with a whole degree.
      setView((previous) => (previous.off === off && previous.bearing === bearing ? previous : { off, bearing }));
    };
    // Nothing is read at mount: a campaign's map starts flat and the opening framing leans it a moment later.
    instance.on("move", read);
    return () => instance.off("move", read);
  }, [map, rest]);

  if (!view.off) return null;
  const size = isTouch ? TOUCH_SIZE : COMPACT_SIZE;
  const reset = () => {
    const instance = map?.getMap ? map.getMap() : map;
    instance?.easeTo({ bearing: 0, pitch: rest, duration: 500 });
  };
  return (
    <button
      type="button"
      className="oh-tap"
      aria-label="Reset"
      title="Reset"
      onClick={reset}
      style={{
        position: "fixed",
        bottom: `calc(${DOCK_BUTTON_BOTTOM} + ${size} + 0.5rem + ${SAFE_BOTTOM})`,
        left: `calc(${BESIDE_DOCK_LEFT} + ${SAFE_LEFT})`,
        width: size,
        height: size,
        padding: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // Under the search box's suggestions, which open upward over it.
        zIndex: 9998,
        borderRadius: "10px",
        backgroundColor: "var(--oh-hud-bg)",
        backdropFilter: "var(--oh-hud-blur)",
        border: "1px solid var(--oh-hud-border)",
        boxShadow: "var(--oh-hud-shadow-soft)",
        cursor: "pointer",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ transform: `rotate(${-view.bearing}deg)` }}>
        <path d="M12 2 L16 12 L8 12 Z" fill="#e0624f" />
        <path d="M12 22 L16 12 L8 12 Z" fill="rgba(255,255,255,0.8)" />
      </svg>
    </button>
  );
};

export default CameraCompass;
