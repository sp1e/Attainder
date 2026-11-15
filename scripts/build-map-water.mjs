// Builds the painted water of a historical campaign's map (docs/superpowers/specs/2026-11-13-living-map-design.md,
// slice 4) from Natural Earth, which is in the public domain:
//
//   public/map/sea.geojson    the sea: everything that is not Natural Earth's 1:50m land. The historical packages
//                             clip their realms to the same land, so a realm and the sea meet without a gap.
//                             A second feature is the coast: the sea's rings without the edge of the world box,
//                             for the lines drawn along the shore.
//   public/map/lakes.geojson  the 1:50m lakes that are not reservoirs or lakes a dam made in modern times.
//   public/map/water.json     what the two were built from, and their hashes.
//
//   node scripts/build-map-water.mjs           writes the three files
//   node scripts/build-map-water.mjs --check   fails when the files on disk are not what the sources give
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import polygonClipping from "polygon-clipping";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = "server/seed/historical/sources";
export const OUTPUT_DIR = "public/map";

// Pinned inputs. The land's record is physical-source.json, the lakes' is lakes-source.json, both beside the files.
export const SOURCES = Object.freeze({
  land: { file: `${SOURCE_DIR}/ne_50m_land.geojson`, sha256: "e874b27a51d146452be360cafb3cc50c86001074a67d534113e6534682f9826b" },
  lakes: { file: `${SOURCE_DIR}/ne_50m_lakes.geojson`, sha256: "d350b75978b26fe839b797c2c529b2fb8f47fb3983c03f4964e36d5df9378a52" },
});

// The Mercator map ends near 85 degrees; the box stops there too.
const WORLD_BOX = [[[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]]];
// Three decimals of a degree are about a hundred metres, finer than the 1:50m source.
const roundDeep = (value) => (typeof value[0] === "number"
  ? [Math.round(value[0] * 1000) / 1000, Math.round(value[1] * 1000) / 1000]
  : value.map(roundDeep));
const polygonsOf = (geometry) => (geometry?.type === "Polygon" ? [geometry.coordinates]
  : geometry?.type === "MultiPolygon" ? geometry.coordinates : []);

const onBoxEdge = ([x, y]) => Math.abs(x) === 180 || Math.abs(y) === 85;

// The sea's rings as lines, in the rings' own direction, without the segments that lie on the edge of the world box:
// a line along the shore must not run down the antimeridian.
const coastLines = (seaPolygons) => {
  const lines = [];
  for (const ring of seaPolygons.flat()) {
    const first = lines.length;
    let line = [];
    for (let index = 1; index < ring.length; index += 1) {
      if (onBoxEdge(ring[index - 1]) && onBoxEdge(ring[index])) {
        if (line.length > 1) lines.push(line);
        line = [];
        continue;
      }
      if (!line.length) line.push(ring[index - 1]);
      line.push(ring[index]);
    }
    if (line.length > 1) lines.push(line);
    // A ring is cut where it leaves the box edge, not at its first vertex: when it neither starts nor ends on the
    // edge, its last run and its first are one line.
    const startsOnEdge = onBoxEdge(ring[0]) && onBoxEdge(ring[1]);
    const endsOnEdge = onBoxEdge(ring.at(-2)) && onBoxEdge(ring.at(-1));
    if (lines.length - first > 1 && !startsOnEdge && !endsOnEdge) {
      const last = lines.pop();
      lines[first] = [...last, ...lines[first].slice(1)];
    }
  }
  return lines;
};

/**
 * The sea, as two features told apart by `kind`: `sea`, one MultiPolygon, the world box with Natural Earth's land
 * taken out; and `coast`, the same rings as lines. A coast line has the water on its left.
 */
export function buildSea(land) {
  const landPolygons = (land?.features ?? []).flatMap((feature) => polygonsOf(feature.geometry));
  const sea = roundDeep(polygonClipping.difference(WORLD_BOX, landPolygons));
  return {
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: { kind: "sea" }, geometry: { type: "MultiPolygon", coordinates: sea } },
      { type: "Feature", properties: { kind: "coast" }, geometry: { type: "MultiLineString", coordinates: coastLines(sea) } },
    ],
  };
}

// Lakes a dam or a canal made in modern times that Natural Earth does not class as reservoirs.
export const MODERN_LAKES = Object.freeze([
  "Lake Nasser", "Lake Tharthar", "Razzaza Lake", "Lake Habbaniyah", "Sarygamysh Köli", "Lago Gatun", "Lake Havasu", "Salton Sea",
]);
const isModern = (properties) => properties?.featurecla === "Reservoir"
  || /\bRes(ervoir|\.)|Réservoir|Represa/i.test(properties?.name ?? "")
  || MODERN_LAKES.includes(properties?.name);

/** The lakes that stood in the game's periods, each with its name and nothing else. */
export function buildLakes(lakes) {
  const kept = (lakes?.features ?? []).filter((feature) => polygonsOf(feature.geometry).length && !isModern(feature.properties));
  return {
    type: "FeatureCollection",
    features: kept.map((feature) => ({
      type: "Feature",
      properties: { name: feature.properties?.name ?? "" },
      geometry: { type: feature.geometry.type, coordinates: roundDeep(feature.geometry.coordinates) },
    })),
  };
}

export const sha256 = (data) => createHash("sha256").update(data).digest("hex");

const readSource = ({ file, sha256: expected }) => {
  const bytes = readFileSync(path.join(ROOT, file));
  const actual = sha256(bytes);
  if (actual !== expected) throw new Error(`${file}: sha256 ${actual}, expected ${expected}`);
  return JSON.parse(bytes.toString("utf8"));
};

/** The three output files as text, from the pinned sources. */
export function buildWaterFiles() {
  const sea = JSON.stringify(buildSea(readSource(SOURCES.land)));
  const lakeCollection = buildLakes(readSource(SOURCES.lakes));
  const lakes = JSON.stringify(lakeCollection);
  const manifest = {
    generator: "scripts/build-map-water.mjs",
    licence: "Natural Earth, public domain",
    sources: SOURCES,
    files: {
      "sea.geojson": { sha256: sha256(sea), bytes: Buffer.byteLength(sea) },
      "lakes.geojson": { sha256: sha256(lakes), bytes: Buffer.byteLength(lakes), lakes: lakeCollection.features.length },
    },
  };
  return { "sea.geojson": sea, "lakes.geojson": lakes, "water.json": `${JSON.stringify(manifest, null, 2)}\n` };
}

const main = () => {
  const check = process.argv.includes("--check");
  const files = buildWaterFiles();
  const directory = path.join(ROOT, OUTPUT_DIR);
  if (!check) mkdirSync(directory, { recursive: true });
  let stale = 0;
  for (const [name, text] of Object.entries(files)) {
    const target = path.join(directory, name);
    if (check) {
      let onDisk = null;
      try {
        onDisk = readFileSync(target, "utf8");
      } catch (error) {
        console.error(`${OUTPUT_DIR}/${name}: cannot be read (${error.code ?? error.message})`);
      }
      if (onDisk !== text) {
        stale += 1;
        console.error(`${OUTPUT_DIR}/${name}: not what the sources give; run node scripts/build-map-water.mjs`);
      }
    } else {
      writeFileSync(target, text);
      console.log(`${OUTPUT_DIR}/${name}: ${Buffer.byteLength(text)} bytes`);
    }
  }
  if (stale) process.exit(1);
  if (check) console.log("map water: up to date");
};

// Node resolves the main module through its real path; the argument may name it through a link or another case.
const invokedDirectly = () => {
  try {
    return Boolean(process.argv[1]) && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url;
  } catch (error) {
    console.error(`build-map-water: cannot resolve ${process.argv[1]} (${error.code ?? error.message})`);
    return false;
  }
};
if (invokedDirectly()) main();
