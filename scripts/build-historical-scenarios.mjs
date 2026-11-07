#!/usr/bin/env node
// Offline deterministic conversion of pinned, reviewed inputs. No runtime activation.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import polygonClipping from 'polygon-clipping';
import { authoredScenario, SOURCE_REVISION, EGYPT_CORE_NOTE_SV, EGYPT_CORE_SOURCE_IDS, EGYPT_CORE_TRANSFORM } from '../server/seed/historical/authored-scenarios.mjs';
import { historicalGeometryCenter, validateHistoricalScenario } from '../src/runtime/historicalScenarios.js';
import { withScenarioLicense } from '../src/runtime/scenarioLicense.js';

const ROOT = fileURLToPath(new URL('../server/seed/historical/',import.meta.url));
const sha = x => createHash('sha256').update(x).digest('hex');
const json = x => JSON.stringify(x) + '\n';
const read = name => fs.readFile(path.join(ROOT,name),'utf8');
const readJson = async name => JSON.parse(await read(name));
const geometryCoordinates = g => g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
const bounds = g => { const pairs = geometryCoordinates(g).flat(2); return [Math.min(...pairs.map(p => p[0])),Math.min(...pairs.map(p => p[1])),Math.max(...pairs.map(p => p[0])),Math.max(...pairs.map(p => p[1]))]; };
const intersects = (a,b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
const feature = (id,geometry,owner,sourceIds,noteSv,status = 'owned') => ({ type: 'Feature',id,
  properties: { id,name: owner || 'Okänd historisk kontroll',owner,authored: true,geometrySource: 'authored',
    historical: { status,boundary: 'approximate',sourceIds,noteSv },center: historicalGeometryCenter(geometry) },geometry });

// ---- Shared steps. Nothing below the package records names a specific package. ----
const regionalSourceBase = { license: 'Reference only; source prose and images not redistributed',retrievedAt: '2026-11-05' };
// Regional sources keyed by named feature of the review file.
function sourcesFromNamedFeatures(h,review) {
  for (const row of review.namedFeatures) row.references.forEach((s,i) => {
    h.sources[`regional-${row.sourceFeatureIndex}-${i}`] = { title: s.title,institution: new URL(s.url).hostname,url: s.url,
      locator: 'Chronological or regional claim specified in the authored review record',chronology: row.evidence,
      uncertainty: row.decision,license: regionalSourceBase.license,retrievedAt: regionalSourceBase.retrievedAt,review: row.status };
  });
}
// Regional sources keyed by the evidence entries of the review file.
function sourcesFromEvidence(h,review) {
  for (const [id,s] of Object.entries(review.sources)) h.sources[`regional-${id}`] = {
    title: s.scopedClaim,institution: new URL(s.url).hostname,url: s.url,locator: s.locator,
    chronology: s.sourceDateWording,uncertainty: `${s.calendarHandling}; no surveyed frontier follows from the historical period.`,
    license: regionalSourceBase.license,retrievedAt: regionalSourceBase.retrievedAt,review: 'Regional source review; scope limited to named claim.',
  };
}
const ANTARCTICA_COVERAGE = { area: 'Antarctica',status: 'unresolved',sourceIds: ['naturalEarth'],noteSv: 'Fysisk geografi visas. Inget historiskt ägande eller någon befolkning tillskrivs området.' };

const releasedProvenance = JSON.parse(await read('released-provenance.json'));

// ---- Package records: everything that differs between packages. ----
// Pinned inputs; each package names its own source file.
const SOURCE_HASHES = {
  'hbm-world_1200.geojson': '2d6913ecedb38e269e41d249c87874d81e3e8d7351754821f57e627442d91525',
  'hbm-world_bc3000.geojson': '2cf107e2f0d4f9b5427b293f19b11fffe7c1134f52320df4f94b4889b978f033',
  'hbm-LICENSE': '8ceb4b9ee5adedde47b31e975c1d90c73ad27b6b165a1dcd80c7c545eb65b903',
  'hbm-README.md': '4a6d137790d3aea8c2a53c26d6a3fe4a43485f90d48b7751c5e53b65b2a8d6fe',
  'hbm-CONTRIBUTING.md': 'e039e33384bfc0cb7eae4ef2508002ac1d7369a0199823dc8a78db6ab38354d4',
  'ne_50m_land.geojson': 'e874b27a51d146452be360cafb3cc50c86001074a67d534113e6534682f9826b',
};
// A package with a releasedProvenance entry keeps the build record of the release that published it.
// Fields: idPrefix (region id prefix), coverage (area rows), addRegionalSources, mapMappings (extra polities from the review file),
// coreIndex and coreSourceIds (the playable polity feature), selectiveCore (clip transform, or null) with selectiveCoreNoteSv,
// compositeNote (appended to the playable polity note, or null), quarantine (source index to geometry status),
// selectionTransformation and quarantineTransformation (manifest lines), seatId, and three review readers.
const PACKAGE_RECORDS = [
  { contentId: 'egypt-3000bc',idPrefix: 'hbm-bc3000',sourceFile: 'hbm-world_bc3000.geojson',reviewFile: 'bc3000-review.json',
    authored: () => authoredScenario('egypt-3000bc'),addRegionalSources: sourcesFromNamedFeatures,
    coverage: [
      { area: 'Africa',status: 'partial',sourceIds: ['egypt'],noteSv: 'Egypten har en ungefärlig politisk rekonstruktion. Övriga områdens kontroll är okänd; Bantuutbredningen och ett Kermarike år 3000 används inte.' },
      { area: 'Asia',status: 'unresolved',sourceIds: ['regional-17-0','regional-20-0'],noteSv: 'Protoelamitisk och tidigharappansk kultur är belagd, men inga gemensamma härskare eller gränser tilldelas. Urpolygonen kan inte belägga kontroll över Uruk.' },
      { area: 'Europe',status: 'unresolved',sourceIds: ['regional-32-0','regional-37-0'],noteSv: 'Kulturområden ger inga gemensamma kungar. Den lokala politiska kontrollen är okänd.' },
      { area: 'Americas',status: 'unresolved',sourceIds: ['regional-14-0','regional-22-0'],noteSv: 'Caral-Supe och Valdivia ger regionalt samhällsunderlag, ingen gemensam suverän för kartans kulturpolygoner. Kontrollen förblir okänd.' },
      { area: 'Oceania',status: 'unresolved',sourceIds: ['regional-4-0','regional-111-0'],noteSv: 'Australiens och Tasmaniens äldre samhällen får ingen gemensam härskare. Fysiskt land visas också där politiska data saknas; senare polynesisk utbredning flyttas inte bakåt.' },
      ANTARCTICA_COVERAGE,
    ],
    coreIndex: 19,coreSourceIds: EGYPT_CORE_SOURCE_IDS,mapMappings: () => [],
    selectiveCore: EGYPT_CORE_TRANSFORM,selectiveCoreNoteSv: EGYPT_CORE_NOTE_SV,compositeNote: null,quarantine: {},
    selectionTransformation: `Intersect Egypt feature19 with developer mask bbox ${JSON.stringify(EGYPT_CORE_TRANSFORM.maskBbox)}; selective partial core, not an attested boundary; retain original source/hash.`,
    quarantineTransformation: 'Quarantine AD1200 source features214 and240; no unsupported repair or owner assignment.',
    seatId: 'memphis',
    reviewFeature: (review,index) => review.namedFeatures.find(r => r.sourceFeatureIndex === index),
    unmappedSourceIds: (r,index) => (r?.references ?? []).map((_,i) => `regional-${index}-${i}`),
    mappedBoundaryDecision: 'developer-authored-selective-core' },
  { contentId: 'john-1200',idPrefix: 'hbm-ad1200',sourceFile: 'hbm-world_1200.geojson',reviewFile: 'ad1200-review.json',
    authored: () => authoredScenario('john-1200'),addRegionalSources: sourcesFromEvidence,
    coverage: [
      { area: 'Africa',status: 'partial',sourceIds: ['regional-almohad'],noteSv: 'Almohadernas täckning är partiell. Fatimidernas gamla område byter inte automatiskt ägare; ayyubidiska och andra lokala gränser återstår.' },
      { area: 'Asia',status: 'partial',sourceIds: ['regional-china','regional-khmer'],noteSv: 'Västra Xia och Khmerriket visas ungefärligt. Song, Liao, Chola, Pyu, Delhi, Buyid och mongoliska kartanspråk innehåller olösta eller felaktiga delar. Goryeos trasiga polygon används inte.' },
      { area: 'Europe',status: 'partial',sourceIds: ['angevin','angevinJurisdiction','regional-france'],noteSv: 'Johns riken och Frankrike visas som ungefärliga feodala sammanhang. Kartan skiljer inte varje vasalls direkta makt. Övrig lokal kontroll är okänd.' },
      { area: 'Americas',status: 'partial',sourceIds: ['regional-chimu','regional-wari','regional-toltec'],noteSv: 'Chimús kärnområde visas ungefärligt. Wari-, Tiwanaku- och Toltekriken återupplivas inte år 1200. Övriga samhällens lokala kontroll är okänd.' },
      { area: 'Oceania',status: 'unresolved',sourceIds: ['regional-tonga'],noteSv: 'Tonga har källbelagt hövdingainflytande under en bred period, men det innebär inte ägande av varje ö. Lokal kontroll förblir okänd.' },
      ANTARCTICA_COVERAGE,
    ],
    coreIndex: 275,coreSourceIds: ['john','angevin','angevinJurisdiction','brittany','hbm'],
    mapMappings: review => review.mapMappings.map(m => ({ ...m,sourceIds: ['hbm',...m.sourceIds.map(id => `regional-${id}`)] })),
    selectiveCore: null,selectiveCoreNoteSv: null,
    compositeNote: ' Bretagne omfattar Arthurs vasallförhållande till Johan; direkt enhetlig förvaltning påstås inte. Irland saknas i denna rekonstruktion.',
    quarantine: { 214: 'quarantined-self-intersection',240: 'quarantined-degenerate' },
    selectionTransformation: 'Preserve accepted source coordinates and component structure; assign stable historical IDs.',
    quarantineTransformation: 'Quarantine AD1200 source features214 and240; no unsupported repair or owner assignment.',
    seatId: 'windsor',
    reviewFeature: (review,index) => review.allFeatures[index],
    unmappedSourceIds: (r) => (r?.sourceEvidenceIds ?? []).map(id => `regional-${id}`),
    mappedBoundaryDecision: 'accepted-world-scale-approximation' },
];
export const SCENARIO_PACKAGES = PACKAGE_RECORDS.map(pkg => ({ ...pkg,releasedProvenance: releasedProvenance[pkg.contentId] ?? null }));

// ---- Per-package build steps ----
const MAP_POLICY = { geometryAuthority: 'scenario-at-all-zooms',modernPolityFallback: false,modernCityFallback: false,modernFlagFallback: false,unknownControlLabelSv: 'Okänd historisk kontroll',physicalCoastline: 'generalized-present-day' };

async function loadInputs() {
  const inputs = {};
  for (const [name,expected] of Object.entries(SOURCE_HASHES)) {
    const bytes = await fs.readFile(path.join(ROOT,'sources',name));
    if (sha(bytes) !== expected) throw new Error(`Pinned source checksum mismatch: ${name}`);
    inputs[name] = bytes.toString('utf8');
  }
  return inputs;
}

// The polity features of one package: the playable polity first, then the review file's mapped polities.
function polityMappings(pkg,h,review) {
  const mappings = [{ index: pkg.coreIndex,polityId: h.playablePolityIds[0],nameSv: h.polities[0].nameSv,sourceIds: pkg.coreSourceIds,noteSv: h.polities[0].noteSv },...pkg.mapMappings(review)];
  for (const m of mappings.slice(1)) h.polities.push({ id: m.polityId,nameSv: m.nameSv,sourceIds: m.sourceIds,boundary: 'approximate',noteSv: m.noteSv });
  return mappings;
}

function ownedFeatures(pkg,h,source,mappings) {
  const owned = mappings.map(m => feature(`${pkg.idPrefix}-${m.index}`,source.features[m.index].geometry,m.polityId,m.sourceIds,m.noteSv));
  if (pkg.selectiveCore) {
    const [west,south,east,north] = pkg.selectiveCore.maskBbox;
    const mask = [[[west,south],[east,south],[east,north],[west,north],[west,south]]];
    owned[0].geometry = { type: 'MultiPolygon',coordinates: polygonClipping.intersection(geometryCoordinates(owned[0].geometry),mask) };
    owned[0].properties.center = historicalGeometryCenter(owned[0].geometry);
    Object.assign(owned[0].properties.historical,{ coverage: 'selective-core',geometryTransform: pkg.selectiveCore });
    h.coverage[0].noteSv = `${pkg.selectiveCoreNoteSv} ${h.coverage[0].noteSv}`;
  }
  if (pkg.compositeNote) {
    owned[0].properties.historical.controlBasis = 'composite-simulation';
    owned[0].properties.historical.noteSv += pkg.compositeNote;
  }
  return owned;
}

// Subtract only accepted historical reconstructions from physical land. The
// remaining pieces are computational geometry, without administrative borders.
function backgroundFeatures(land,owned) {
  const ownedBounds = owned.map(f => bounds(f.geometry));
  const background = [];
  land.features.forEach((f,index) => {
    const candidates = owned.filter((_,i) => intersects(bounds(f.geometry),ownedBounds[i]));
    const coordinates = candidates.length ? polygonClipping.difference(geometryCoordinates(f.geometry),...candidates.map(c => geometryCoordinates(c.geometry))) : geometryCoordinates(f.geometry);
    if (coordinates.length) background.push(feature(`physical-${index}`,{ type: 'MultiPolygon',coordinates },'',['naturalEarth','hbm'],'Okänd historisk kontroll; kartdelen är en beräknad landyta, inte ett historiskt landskap.','unresolved'));
  });
  return background;
}

function citiesFor(h) {
  return { type: 'FeatureCollection',features: h.settlements.map(s => ({ type: 'Feature',id: s.id,properties: { id: s.id,name: s.nameSv,city: s.nameSv,owner: s.polityId,tier: 3,seat: true,placementNoteSv: s.noteSv,sourceIds: s.sourceIds },geometry: { type: 'Point',coordinates: s.coordinates } })) };
}

function regionReviewFor(pkg,source,review,mappings) {
  return source.features.map((f,index) => {
    const r = pkg.reviewFeature(review,index);
    const m = mappings.find(m => m.index === index);
    return { sourceIndex: index,sourceName: f.properties.NAME ?? null,sourceProperties: f.properties,geometrySha256: sha(JSON.stringify(f.geometry)),
      classification: r?.status ?? 'unresolved',ownerPolityId: m?.polityId ?? null,
      sourceIds: m?.sourceIds ?? pkg.unmappedSourceIds(r,index),
      boundaryDecision: m ? pkg.mappedBoundaryDecision : 'withheld-control',
      ...(pkg.selectiveCore && m ? { geometryTransform: pkg.selectiveCore } : {}),
      note: r?.decision ?? r?.notes?.join(' ') ?? 'No supported ownership assignment.',
      ...(pkg.quarantine[index] ? { geometryStatus: pkg.quarantine[index] } : {}),
    };
  });
}

// Manifest lines in their fixed order. The Natural Earth line is returned separately for its component license.
function transformationsFor(pkg) {
  const naturalEarth = 'Natural Earth physical land minus accepted political polygons forms unknown-control computational pieces; hide their internal borders.';
  const list = [pkg.selectionTransformation,
    'Withhold unreviewed and rejected political ownership; retain original labels and hashes in regionReview.',
    ...(pkg.quarantineTransformation ? [pkg.quarantineTransformation] : []),
    naturalEarth,
    'Use Getty modern place coordinates as approximate seat markers; no physical royal-presence claim.'];
  return { list,naturalEarth };
}

async function liveAuthoredInputs(pkg) {
  return Promise.all(['authored-scenarios.mjs',pkg.reviewFile].map(async fileName => ({ fileName,sha256: sha(await read(fileName)) })));
}

async function manifestFor(pkg,h,physical,regions,cities,transformations) {
  const released = pkg.releasedProvenance;
  return { schemaVersion: 1,contentId: h.contentId,contentVersion: h.contentVersion,
    generator: released?.generator ?? { file: 'scripts/build-historical-scenarios.mjs',sha256: sha(await fs.readFile(fileURLToPath(import.meta.url))),polygonClipping: '0.15.7' },
    sourceFiles: released?.sourceFiles ?? Object.entries(SOURCE_HASHES).map(([fileName,sha256]) => ({ fileName,sha256 })),
    assets: [{ id: 'regionsGeojson',sourceIds: ['hbm','naturalEarth'],crs: 'OGC:CRS84',revision: `${SOURCE_REVISION}+${physical.revision}`,sha256: sha(json(regions)),license: 'GPL-3.0-only AND public-domain',transformations },
      { id: 'citiesGeojson',sourceIds: [pkg.seatId],crs: 'OGC:CRS84',revision: 'Getty records retrieved2026-11-05',sha256: sha(json(cities)),license: 'ODC-By-1.0',transformations: ['Copy the decimal modern-place reference; describe its historical placement limit.'] }],
    authoredInputs: released?.authoredInputs ?? await liveAuthoredInputs(pkg),
  };
}

function componentLicensesFor(pkg,h,inputs,physical,transformations,naturalEarthLine) {
  const { sourceFile } = pkg;
  return [{ id: 'historical-basemaps',license: 'GPL-3.0-only',scope: ['regionsGeojson','world.historicalScenario.regionReview'],
    attribution: 'Historical boundaries: André Ourednik and contributors, historical-basemaps. Original collection credits accompany the source.',
    sourceUrl: `https://raw.githubusercontent.com/aourednik/historical-basemaps/${SOURCE_REVISION}/geojson/${sourceFile.slice(4)}`,
    revision: SOURCE_REVISION,sha256: SOURCE_HASHES[sourceFile],licenseText: inputs['hbm-LICENSE'],modifications: transformations,
    sourceFiles: [{ fileName: sourceFile.slice(4),text: inputs[sourceFile] },{ fileName: 'README.md',text: inputs['hbm-README.md'] },{ fileName: 'CONTRIBUTING.md',text: inputs['hbm-CONTRIBUTING.md'] }] },
    { id: 'natural-earth',license: 'public-domain',scope: ['regionsGeojson'],attribution: 'Made with Natural Earth. Physical land 1:50m.',sourceUrl: physical.url,revision: physical.revision,sha256: physical.sha256,licenseText: 'Natural Earth states that its map data is in the public domain. https://www.naturalearthdata.com/about/terms-of-use/',modifications: [naturalEarthLine] },
    { id: 'getty-tgn',license: 'ODC-By-1.0',scope: ['citiesGeojson','world.historicalScenario.settlements'],attribution: 'Getty Thesaurus of Geographic Names, Getty Research Institute. https://www.getty.edu/research-conservation/tools-databases/vocabularies/data-services/',sourceUrl: h.sources[pkg.seatId].url,revision: 'retrieved2026-11-05',sha256: sha(json(h.settlements)),licenseText: 'Open Data Commons Attribution License1.0: https://opendatacommons.org/licenses/by/1-0/',modifications: ['Modern place coordinate retained; historical marker explicitly approximate.'] }];
}

function worldFor(h,regions,assetManifest,componentLicenses) {
  return {
    startingTimelineText: [h.contextSv, h.calendarNoteSv, h.coverageNoteSv].join('\n'),
    simulationRules: 'Utgå från den källbelagda startsituationen och kampanjens aktuella datum. Spelet kan ta en annan väg efter starten; framtida verkliga händelser är inga förutbestämda utfall. Personernas ursprungsetiketter skiljer dokumenterade identiteter från genererade personer. Spelmotorn styr datum, härskare, gränser och sparade utfall. Okänd kontroll betyder att underlag saknas.',
    customRegions: true,customGeometry: true,customCities: true,historicalScenario: h,componentLicenses,
    assetProvenance: Object.fromEntries(assetManifest.assets.map(a => [a.id,{ ...a,hashScope: 'authored-release',componentIds: a.id === 'regionsGeojson' ? ['historical-basemaps','natural-earth'] : ['getty-tgn'] }])),
    polityOverrides: Object.fromEntries(h.polities.map((p,i) => [p.id,{ name: p.nameSv,code: p.id,color: ['#c49b53','#ad6c5c','#678b72','#8f759e','#66869d','#a78c5a'][i % 6],note: p.noteSv,status: 'active',aliases: [],mapRefs: { gadm0: [] } }])),
    regionOwnershipOverrides: Object.fromEntries(regions.features.map(f => [f.properties.id,f.properties.owner])),notes: h.coverageNoteSv,mapCredit: componentLicenses.map(c => c.attribution).join('\n') };
}

function bundleFor(h,world,game,regions,cities) {
  return withScenarioLicense({ schema: 'open-historia-scenario-bundle/2',version: 2,mode: 'full',
    scenario: { id: h.contentId,name: `${h.polities[0].nameSv}, ${h.eraLabelSv}`,description: h.contextSv },
    data: { game,world,prompts: {},actions: [],advisor: [],chat: [],events: [] },
    assets: { regionsGeojson: { mode: 'embedded',fileName: 'regions.geojson',data: regions },citiesGeojson: { mode: 'embedded',fileName: 'cities.geojson',data: cities },flags: { mode: 'embedded',fileName: 'flags.json',data: {} },colors: { mode: 'embedded',fileName: 'colors.json',data: {} } } });
}

async function buildPackage(pkg,{ inputs,physical,land }) {
  const h = pkg.authored();
  const source = JSON.parse(inputs[pkg.sourceFile]);
  const review = await readJson(pkg.reviewFile);
  pkg.addRegionalSources(h,review);
  h.coverage = structuredClone(pkg.coverage);
  h.mapPolicy = { ...MAP_POLICY };
  const mappings = polityMappings(pkg,h,review);
  const owned = ownedFeatures(pkg,h,source,mappings);
  const regions = { type: 'FeatureCollection',features: [...backgroundFeatures(land,owned),...owned] };
  const cities = citiesFor(h);
  h.regionReview = regionReviewFor(pkg,source,review,mappings);
  const { list: transformations,naturalEarth } = transformationsFor(pkg);
  const assetManifest = await manifestFor(pkg,h,physical,regions,cities,transformations);
  h.assetManifest = assetManifest;
  const componentLicenses = componentLicensesFor(pkg,h,inputs,physical,transformations,naturalEarth);
  const world = worldFor(h,regions,assetManifest,componentLicenses);
  const game = { country: h.playablePolityIds[0],startDate: h.bookmarkDate,gameDate: h.bookmarkDate,difficulty: 'standard',language: 'Svenska' };
  const valid = validateHistoricalScenario({ game,world,regions,assetManifest },{ date: h.bookmarkDate,polityId: h.playablePolityIds[0] });
  if (!valid.ok) throw new Error(`${h.contentId}: ${valid.code}`);
  const bundle = bundleFor(h,world,game,regions,cities);
  return { contentId: h.contentId,outputs: { 'regions.geojson': json(regions),'cities.geojson': json(cities),'scenario.json': json(bundle),'manifest.json': json(assetManifest) },
    summary: { contentId: h.contentId,regions: regions.features.length,reviewedCandidates: h.regionReview.length,polities: h.polities.length } };
}

async function writeOrCheck(contentId,name,bytes,check) {
  const destination = path.join(ROOT,contentId,name);
  if (check) { if (await fs.readFile(destination,'utf8') !== bytes) throw new Error(`Historical output differs: ${contentId}/${name}`); }
  else { await fs.mkdir(path.dirname(destination),{ recursive: true }); await fs.writeFile(destination,bytes,'utf8'); }
}

export async function buildHistoricalScenarios({ check = false } = {}) {
  const inputs = await loadInputs();
  const physical = await readJson('sources/physical-source.json');
  const land = JSON.parse(inputs['ne_50m_land.geojson']);
  const result = [];
  const inventory = [];
  for (const pkg of SCENARIO_PACKAGES) {
    const built = await buildPackage(pkg,{ inputs,physical,land });
    for (const [name,bytes] of Object.entries(built.outputs)) {
      inventory.push({ file: `${built.contentId}/${name}`,bytes: Buffer.byteLength(bytes),sha256: sha(bytes) });
      await writeOrCheck(built.contentId,name,bytes,check);
    }
    result.push(built.summary);
  }
  const releaseIndex = json({ schemaVersion: 1,sourcePins: { historicalBasemaps: SOURCE_REVISION,naturalEarth: physical.revision },
    sources: Object.entries(SOURCE_HASHES).map(([file,sha256]) => ({ file: `sources/${file}`,bytes: Buffer.byteLength(inputs[file]),sha256 })),outputs: inventory });
  if (check) { if (await read('releases.json') !== releaseIndex) throw new Error('Historical release inventory differs'); }
  else await fs.writeFile(path.join(ROOT,'releases.json'),releaseIndex,'utf8');
  return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await buildHistoricalScenarios({ check: process.argv.includes('--check') }),null,2));
}
