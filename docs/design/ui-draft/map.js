// The draft's map: the game's own engine (MapLibre) and the Charlemagne AD 800 polity surfaces,
// drawn over shaded terrain. Nothing here is the game's code; it shows a look the game could take.
/* global maplibregl */

const ESRI = (service) => `https://server.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/tile/{z}/{y}/{x}`;
const TERRARIUM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const dem = () => ({ type: "raster-dem", tiles: [TERRARIUM], encoding: "terrarium", tileSize: 256, maxzoom: 9 });

// One colour per realm. The player's realm takes the start's accent; the rest stay in the same dyed-cloth family.
export const REALM_COLORS = {
  "carolingian-realm": "#d7a43a",
  "byzantine-empire": "#7d4f9e",
  "abbasid-caliphate": "#2f2a26",
  "emirate-of-cordoba": "#3f8f6b",
  "aghlabid-emirate": "#b9502f",
  "kingdom-of-asturias": "#3d6fb3",
  "duchy-of-benevento": "#a23b4f",
  "papal-states": "#e6dcc0",
  "tang-empire": "#b3372f",
  silla: "#4c8f9c",
};
const realmColor = ["match", ["get", "owner"], ...Object.entries(REALM_COLORS).flat(), "#8a8172"];

// Sea level is the coast: the relief paints everything at or below it, so a realm's tint ends where the land does.
const SEA = ["interpolate", ["linear"], ["elevation"],
  -7000, "#06131f", -3500, "#0a2233", -1500, "#0f3247", -400, "#16485e", -120, "#1f6273", -25, "#34868d", -4, "#6fb0a6",
  0, "#c7dcc4", 1.5, "rgba(199,220,196,0)"];
// 25 December: snow lies on the high ground.
const snow = (line) => ["interpolate", ["linear"], ["elevation"],
  line, "rgba(244,247,250,0)", line + 350, "rgba(244,247,250,0.55)", line + 900, "rgba(248,250,252,0.92)", 4600, "rgba(255,255,255,0.97)"];
const WINTER_LINE = 700, SUMMER_LINE = 3100;
const SNOW = snow(WINTER_LINE);
// Far out the realms read as a political map; close in the land shows through and the border bands carry the colour.
const WASH = ["interpolate", ["linear"], ["zoom"], 3, 0.56, 4.4, 0.34, 6.6, 0.14];

const style = {
  version: 8,
  sources: {
    imagery: { type: "raster", tiles: [ESRI("World_Imagery")], tileSize: 256, maxzoom: 11,
      attribution: "Imagery: Esri, Maxar, Earthstar Geographics. Elevation: Mapzen terrain tiles on AWS." },
    terrain: dem(), shade: dem(), relief: dem(),
    polities: { type: "geojson", data: "data/polities-800.geojson" },
  },
  layers: [
    { id: "ground", type: "background", paint: { "background-color": "#0a2233" } },
    { id: "imagery", type: "raster", source: "imagery",
      paint: { "raster-saturation": -0.28, "raster-contrast": 0.12, "raster-brightness-min": 0.06, "raster-brightness-max": 0.9, "raster-fade-duration": 200 } },
    { id: "snow", type: "color-relief", source: "relief", paint: { "color-relief-color": SNOW, "color-relief-opacity": 0.9 } },
    { id: "realm-wash", type: "fill", source: "polities", paint: { "fill-color": realmColor, "fill-opacity": WASH, "fill-antialias": false } },
    { id: "realm-hover", type: "fill", source: "polities", filter: ["==", ["get", "owner"], ""], paint: { "fill-color": "#fff3cf", "fill-opacity": 0.14, "fill-antialias": false } },
    { id: "realm-band", type: "line", source: "polities",
      paint: { "line-color": realmColor, "line-width": ["interpolate", ["exponential", 1.6], ["zoom"], 3, 10, 6, 26, 9, 60],
        "line-blur": ["interpolate", ["linear"], ["zoom"], 3, 8, 6, 18, 9, 36], "line-opacity": 0.75,
        "line-offset": ["interpolate", ["exponential", 1.6], ["zoom"], 3, 4, 6, 11, 9, 26] } },
    { id: "hills", type: "hillshade", source: "shade",
      paint: { "hillshade-exaggeration": 0.62, "hillshade-shadow-color": "#1a1410", "hillshade-highlight-color": "#fff4d6", "hillshade-accent-color": "#3b2a1c", "hillshade-illumination-direction": 315 } },
    { id: "realm-edge", type: "line", source: "polities",
      paint: { "line-color": "#1b130c", "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1.1, 6, 2, 9, 3], "line-opacity": 0.85 } },
    { id: "realm-edge-light", type: "line", source: "polities",
      paint: { "line-color": realmColor, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.5, 6, 0.9, 9, 1.4], "line-opacity": 0.95,
        "line-offset": ["interpolate", ["linear"], ["zoom"], 3, 1.2, 6, 2, 9, 3] } },
    { id: "sea", type: "color-relief", source: "relief", paint: { "color-relief-color": SEA, "color-relief-opacity": 1 } },
  ],
  sky: { "sky-color": "#0e1a26", "horizon-color": "#d9c49a", "fog-color": "#cbb891", "fog-ground-blend": 0.55, "horizon-fog-blend": 0.75, "sky-horizon-blend": 0.85, "atmosphere-blend": 0.75 },
};

export const HOME = { center: [9.2, 44.6], zoom: 4.35, pitch: 47, bearing: -7 };

export function createMap(container) {
  const map = new maplibregl.Map({ container, style, ...HOME, minZoom: 2.6, maxZoom: 8.5, maxPitch: 66, attributionControl: { compact: true }, dragRotate: true });
  map.on("load", () => map.setTerrain({ source: "terrain", exaggeration: 7 }));
  return map;
}

const colorExpr = () => ["match", ["get", "owner"], ...Object.entries(REALM_COLORS).flat(), "#8a8172"];
let theMap = null;

/** The start's accent recolours the player's realm on the map. */
export function setRealmAccent(color) {
  if (!theMap || !color) return;
  REALM_COLORS["carolingian-realm"] = color;
  theMap.setPaintProperty("realm-wash", "fill-color", colorExpr());
  for (const id of ["realm-band", "realm-edge-light"]) theMap.setPaintProperty(id, "line-color", colorExpr());
}
export const flyTo = (center, zoom = 5.4) => center && theMap?.flyTo({ center, zoom, pitch: 52, bearing: -4, duration: 2200, essential: false });
export const flyHome = () => theMap?.flyTo({ ...HOME, duration: 2000 });

// Realm names lie on the land, along each realm's long axis.
const NAMES = {
  "carolingian-realm": { at: [3.4, 47.3], turn: -17, size: 1.55, text: "Karls rike", own: true },
  "byzantine-empire": { at: [31.2, 39.2], turn: 5, size: 1.15, text: "Bysantinska riket" },
  "abbasid-caliphate": { at: [41.5, 33.8], turn: 0, size: 1.3, text: "Abbasidiska kalifatet" },
  "emirate-of-cordoba": { at: [-3.4, 39.4], turn: -12, size: 0.8, text: "Córdoba" },
  "aghlabid-emirate": { at: [8.2, 33.3], turn: 7, size: 0.85, text: "Aghlabidiska emiratet" },
  "kingdom-of-asturias": { at: [-5.6, 43.05], turn: 0, size: 0.5, text: "Asturien" },
  "duchy-of-benevento": { at: [15.5, 40.75], turn: -30, size: 0.46, text: "Benevento" },
};
const node = (tag, className, html) => { const el = document.createElement(tag); el.className = className; if (html) el.innerHTML = html; return el; };
// One stroke weight for every map sign. The court is the palace chapel's octagon; a seat is a gate between two towers.
const SEAT = '<svg viewBox="0 0 24 24" fill="#14100c" stroke="#efe6d2" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M3 21V9l2-1.5L7 9v3h10V9l2-1.5L21 9v12z"/><path d="M10 21v-4a2 2 0 0 1 4 0v4" fill="none"/></svg>';
const COURT = '<svg viewBox="0 0 24 24" fill="#14100c" stroke="#d4ac3a" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M5 21v-8l3-3h8l3 3v8z"/><path d="M8 10c0-3 2-5 4-5s4 2 4 5"/><path d="M12 5V1.5M10.4 3h3.2M10.5 21v-3.5a1.5 1.5 0 0 1 3 0V21" fill="none"/></svg>';

export function addPlaces(map, places, { court, pending, onRealm, onCourt }) {
  theMap = map;
  // The panels cover the edges, so the camera centres on the land between them.
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  map.setPadding({ left: 22 * rem, right: 19 * rem, top: 9 * rem, bottom: 3 * rem });
  const names = Object.entries(NAMES).map(([id, name]) => {
    const el = node("div", `realm-name${name.own ? " own" : ""}`, name.text);
    new maplibregl.Marker({ element: el, rotation: name.turn, rotationAlignment: "map", pitchAlignment: "map" }).setLngLat(name.at).addTo(map);
    return [el, name.size];
  });
  // Names grow with the land up to a point, then fade as the player comes close to the ground.
  const scale = () => {
    const zoom = map.getZoom(), k = Math.pow(1.75, Math.min(zoom, 5.4) - HOME.zoom), fade = Math.max(0, Math.min(1, (6.3 - zoom) / 0.8));
    for (const [el, size] of names) { el.style.fontSize = `${(size * k).toFixed(3)}rem`; el.style.opacity = fade.toFixed(2); }
  };
  const far = () => map.getContainer().classList.toggle("far", map.getZoom() < 5.3);
  map.on("zoom", () => { scale(); far(); }); scale(); far();

  for (const city of places.cities.filter((c) => c.at[0] > -15 && c.at[0] < 60)) {
    const isCourt = city.id === "aachen";
    const el = node("button", `place${isCourt ? " court" : ""}`, `${isCourt ? COURT : SEAT}<span>${city.name}</span>${isCourt ? `<span class="n">${pending()}</span>` : ""}`);
    el.type = "button"; el.title = isCourt ? "Hovet i Aachen" : `${city.name}, säte`;
    el.addEventListener("click", () => { if (isCourt) onCourt(); else onRealm(city.polity); flyTo(city.at, isCourt ? 5.8 : 5.4); });
    new maplibregl.Marker({ element: el, anchor: "bottom", offset: [0, 14] }).setLngLat(city.at).addTo(map);
  }
  for (const tribe of places.tribes.filter((t) => t.at[0] > -15 && t.at[0] < 60)) {
    const raid = tribe.id === "ad800-tribe-sorbs";
    const el = node("button", `tribe${raid ? " raid" : ""}`, raid ? `${tribe.name} · räd 802` : tribe.name);
    el.type = "button"; el.title = raid ? "Sorberna härjade gränsen i år" : `${tribe.name}, gränsfolk`;
    el.addEventListener("click", () => flyTo(tribe.at, 6));
    new maplibregl.Marker({ element: el, anchor: "top" }).setLngLat(tribe.at).addTo(map);
  }
  // A neighbour's land opens that realm's card.
  map.on("click", "realm-wash", (event) => { const owner = event.features?.[0]?.properties.owner; if (owner && owner !== "carolingian-realm" && court.foreign.some((r) => r.id === owner)) onRealm(owner); });
  map.on("mousemove", "realm-wash", (event) => {
    const owner = event.features?.[0]?.properties.owner;
    map.getCanvas().style.cursor = owner && owner !== "carolingian-realm" ? "pointer" : "";
    map.setFilter("realm-hover", ["==", ["get", "owner"], owner && owner !== "carolingian-realm" ? owner : ""]);
  });
  map.on("mouseleave", "realm-wash", () => { map.getCanvas().style.cursor = ""; map.setFilter("realm-hover", ["==", ["get", "owner"], ""]); });
}

/** The year on the land: t runs from one 25 December (0) to the next (1). The snow line climbs to summer and comes back. */
let lastSeason = 0;
export function setSeason(t) {
  if (!theMap) return;
  const now = performance.now();
  if (t < 1 && now - lastSeason < 70) return;
  lastSeason = now;
  const warmth = Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
  theMap.setPaintProperty("snow", "color-relief-color", snow(Math.round(WINTER_LINE + (SUMMER_LINE - WINTER_LINE) * warmth)));
  theMap.setPaintProperty("imagery", "raster-saturation", -0.28 + 0.3 * warmth);
  theMap.setPaintProperty("imagery", "raster-brightness-max", 0.9 + 0.08 * warmth);
}
