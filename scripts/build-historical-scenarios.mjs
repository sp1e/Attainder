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
const SOURCE_HASHES = {
  'hbm-world_1200.geojson': '2d6913ecedb38e269e41d249c87874d81e3e8d7351754821f57e627442d91525',
  'hbm-world_bc3000.geojson': '2cf107e2f0d4f9b5427b293f19b11fffe7c1134f52320df4f94b4889b978f033',
  'hbm-LICENSE': '8ceb4b9ee5adedde47b31e975c1d90c73ad27b6b165a1dcd80c7c545eb65b903',
  'hbm-README.md': '4a6d137790d3aea8c2a53c26d6a3fe4a43485f90d48b7751c5e53b65b2a8d6fe',
  'hbm-CONTRIBUTING.md': 'e039e33384bfc0cb7eae4ef2508002ac1d7369a0199823dc8a78db6ab38354d4',
  'ne_50m_land.geojson': 'e874b27a51d146452be360cafb3cc50c86001074a67d534113e6534682f9826b',
};
const geometryCoordinates = g => g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
const bounds = g => { const pairs = geometryCoordinates(g).flat(2); return [Math.min(...pairs.map(p => p[0])),Math.min(...pairs.map(p => p[1])),Math.max(...pairs.map(p => p[0])),Math.max(...pairs.map(p => p[1]))]; };
const intersects = (a,b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
const feature = (id,geometry,owner,sourceIds,noteSv,status = 'owned') => ({ type: 'Feature',id,
  properties: { id,name: owner || 'Okänd historisk kontroll',owner,authored: true,geometrySource: 'authored',
    historical: { status,boundary: 'approximate',sourceIds,noteSv },center: historicalGeometryCenter(geometry) },geometry });

function addRegionalSources(h,review,ancient) {
  if (!ancient) for (const [id,s] of Object.entries(review.sources)) h.sources[`regional-${id}`] = {
    title: s.scopedClaim,institution: new URL(s.url).hostname,url: s.url,locator: s.locator,
    chronology: s.sourceDateWording,uncertainty: `${s.calendarHandling}; no surveyed frontier follows from the historical period.`,
    license: 'Reference only; source prose and images not redistributed',retrievedAt: '2026-11-05',review: 'Regional source review; scope limited to named claim.',
  };
  else for (const row of review.namedFeatures) row.references.forEach((s,i) => {
    h.sources[`regional-${row.sourceFeatureIndex}-${i}`] = { title: s.title,institution: new URL(s.url).hostname,url: s.url,
      locator: 'Chronological or regional claim specified in the authored review record',chronology: row.evidence,
      uncertainty: row.decision,license: 'Reference only; source prose and images not redistributed',retrievedAt: '2026-11-05',review: row.status };
  });
}

function coverage(h,ancient) {
  const ref = ancient ? 'egypt' : 'regional-almohad';
  return [
    { area: 'Africa',status: 'partial',sourceIds: [ref],noteSv: ancient ? 'Egypten har en ungefärlig politisk rekonstruktion. Övriga områdens kontroll är okänd; Bantuutbredningen och ett Kermarike år 3000 används inte.' : 'Almohadernas täckning är partiell. Fatimidernas gamla område byter inte automatiskt ägare; ayyubidiska och andra lokala gränser återstår.' },
    { area: 'Asia',status: ancient ? 'unresolved' : 'partial',sourceIds: ancient ? ['regional-17-0','regional-20-0'] : ['regional-china','regional-khmer'],noteSv: ancient ? 'Protoelamitisk och tidigharappansk kultur är belagd, men inga gemensamma härskare eller gränser tilldelas. Urpolygonen kan inte belägga kontroll över Uruk.' : 'Västra Xia och Khmerriket visas ungefärligt. Song, Liao, Chola, Pyu, Delhi, Buyid och mongoliska kartanspråk innehåller olösta eller felaktiga delar. Goryeos trasiga polygon används inte.' },
    { area: 'Europe',status: ancient ? 'unresolved' : 'partial',sourceIds: ancient ? ['regional-32-0','regional-37-0'] : ['angevin','angevinJurisdiction','regional-france'],noteSv: ancient ? 'Kulturområden ger inga gemensamma kungar. Den lokala politiska kontrollen är okänd.' : 'Johns riken och Frankrike visas som ungefärliga feodala sammanhang. Kartan skiljer inte varje vasalls direkta makt. Övrig lokal kontroll är okänd.' },
    { area: 'Americas',status: ancient ? 'unresolved' : 'partial',sourceIds: ancient ? ['regional-14-0','regional-22-0'] : ['regional-chimu','regional-wari','regional-toltec'],noteSv: ancient ? 'Caral-Supe och Valdivia ger regionalt samhällsunderlag, ingen gemensam suverän för kartans kulturpolygoner. Kontrollen förblir okänd.' : 'Chimús kärnområde visas ungefärligt. Wari-, Tiwanaku- och Toltekriken återupplivas inte år 1200. Övriga samhällens lokala kontroll är okänd.' },
    { area: 'Oceania',status: 'unresolved',sourceIds: ancient ? ['regional-4-0','regional-111-0'] : ['regional-tonga'],noteSv: ancient ? 'Australiens och Tasmaniens äldre samhällen får ingen gemensam härskare. Fysiskt land visas också där politiska data saknas; senare polynesisk utbredning flyttas inte bakåt.' : 'Tonga har källbelagt hövdingainflytande under en bred period, men det innebär inte ägande av varje ö. Lokal kontroll förblir okänd.' },
    { area: 'Antarctica',status: 'unresolved',sourceIds: ['naturalEarth'],noteSv: 'Fysisk geografi visas. Inget historiskt ägande eller någon befolkning tillskrivs området.' },
  ];
}

export async function buildHistoricalScenarios({ check = false } = {}) {
  const inputs = {};
  for (const [name,expected] of Object.entries(SOURCE_HASHES)) {
    const bytes = await fs.readFile(path.join(ROOT,'sources',name));
    if (sha(bytes) !== expected) throw new Error(`Pinned source checksum mismatch: ${name}`);
    inputs[name] = bytes.toString('utf8');
  }
  const physical = await readJson('sources/physical-source.json');
  const land = JSON.parse(inputs['ne_50m_land.geojson']);
  const result = [];
  const inventory = [];
  for (const ancient of [true,false]) {
    const h = authoredScenario(ancient), key = ancient ? 'bc3000' : 'ad1200';
    const sourceFile = ancient ? 'hbm-world_bc3000.geojson' : 'hbm-world_1200.geojson';
    const source = JSON.parse(inputs[sourceFile]);
    const review = await readJson(ancient ? 'bc3000-review.json' : 'ad1200-review.json');
    addRegionalSources(h,review,ancient);
    h.coverage = coverage(h,ancient);
    h.mapPolicy = { geometryAuthority: 'scenario-at-all-zooms',modernPolityFallback: false,modernCityFallback: false,modernFlagFallback: false,unknownControlLabelSv: 'Okänd historisk kontroll',physicalCoastline: 'generalized-present-day' };
    const mappings = [{ index: ancient ? 19 : 275,polityId: h.playablePolityIds[0],nameSv: h.polities[0].nameSv,sourceIds: ancient ? EGYPT_CORE_SOURCE_IDS : ['john','angevin','angevinJurisdiction','brittany','hbm'],noteSv: h.polities[0].noteSv },...(!ancient ? review.mapMappings.map(m => ({ ...m,sourceIds: ['hbm',...m.sourceIds.map(id => `regional-${id}`)] })) : [])];
    for (const m of mappings.slice(1)) h.polities.push({ id: m.polityId,nameSv: m.nameSv,sourceIds: m.sourceIds,boundary: 'approximate',noteSv: m.noteSv });
    const owned = mappings.map(m => feature(`hbm-${key}-${m.index}`,source.features[m.index].geometry,m.polityId,m.sourceIds,m.noteSv));
    if (ancient) {
      const [west,south,east,north] = EGYPT_CORE_TRANSFORM.maskBbox;
      const mask = [[[west,south],[east,south],[east,north],[west,north],[west,south]]];
      owned[0].geometry = { type: 'MultiPolygon',coordinates: polygonClipping.intersection(geometryCoordinates(owned[0].geometry),mask) };
      owned[0].properties.center = historicalGeometryCenter(owned[0].geometry);
      Object.assign(owned[0].properties.historical,{ coverage: 'selective-core',geometryTransform: EGYPT_CORE_TRANSFORM });
      h.coverage[0].noteSv = `${EGYPT_CORE_NOTE_SV} ${h.coverage[0].noteSv}`;
    }
    if (!ancient) {
      owned[0].properties.historical.controlBasis = 'composite-simulation';
      owned[0].properties.historical.noteSv += ' Bretagne omfattar Arthurs vasallförhållande till Johan; direkt enhetlig förvaltning påstås inte. Irland saknas i denna rekonstruktion.';
    }
    const ownedBounds = owned.map(f => bounds(f.geometry));
    const background = [];
    // Subtract only accepted historical reconstructions from physical land. The
    // remaining pieces are computational geometry, without administrative borders.
    land.features.forEach((f,index) => {
      const candidates = owned.filter((_,i) => intersects(bounds(f.geometry),ownedBounds[i]));
      const coordinates = candidates.length ? polygonClipping.difference(geometryCoordinates(f.geometry),...candidates.map(c => geometryCoordinates(c.geometry))) : geometryCoordinates(f.geometry);
      if (coordinates.length) background.push(feature(`physical-${index}`,{ type: 'MultiPolygon',coordinates },'',['naturalEarth','hbm'],'Okänd historisk kontroll; kartdelen är en beräknad landyta, inte ett historiskt landskap.','unresolved'));
    });
    const regions = { type: 'FeatureCollection',features: [...background,...owned] };
    const cities = { type: 'FeatureCollection',features: h.settlements.map(s => ({ type: 'Feature',id: s.id,properties: { id: s.id,name: s.nameSv,city: s.nameSv,owner: s.polityId,tier: 3,seat: true,placementNoteSv: s.noteSv,sourceIds: s.sourceIds },geometry: { type: 'Point',coordinates: s.coordinates } })) };
    h.regionReview = source.features.map((f,index) => {
      const r = ancient ? review.namedFeatures.find(r => r.sourceFeatureIndex === index) : review.allFeatures[index];
      const m = mappings.find(m => m.index === index);
      return { sourceIndex: index,sourceName: f.properties.NAME ?? null,sourceProperties: f.properties,geometrySha256: sha(JSON.stringify(f.geometry)),
        classification: r?.status ?? 'unresolved',ownerPolityId: m?.polityId ?? null,
        sourceIds: m?.sourceIds ?? (ancient ? (r?.references ?? []).map((_,i) => `regional-${index}-${i}`) : (r?.sourceEvidenceIds ?? []).map(id => `regional-${id}`)),
        boundaryDecision: m ? (ancient ? 'developer-authored-selective-core' : 'accepted-world-scale-approximation') : 'withheld-control',
        ...(ancient && m ? { geometryTransform: EGYPT_CORE_TRANSFORM } : {}),
        note: r?.decision ?? r?.notes?.join(' ') ?? 'No supported ownership assignment.',
        ...(index === 214 && !ancient ? { geometryStatus: 'quarantined-self-intersection' } : index === 240 && !ancient ? { geometryStatus: 'quarantined-degenerate' } : {}),
      };
    });
    const transformations = [ancient ? `Intersect Egypt feature19 with developer mask bbox ${JSON.stringify(EGYPT_CORE_TRANSFORM.maskBbox)}; selective partial core, not an attested boundary; retain original source/hash.` : 'Preserve accepted source coordinates and component structure; assign stable historical IDs.',
      'Withhold unreviewed and rejected political ownership; retain original labels and hashes in regionReview.',
      'Quarantine AD1200 source features214 and240; no unsupported repair or owner assignment.',
      'Natural Earth physical land minus accepted political polygons forms unknown-control computational pieces; hide their internal borders.',
      'Use Getty modern place coordinates as approximate seat markers; no physical royal-presence claim.'];
    const assetManifest = { schemaVersion: 1,contentId: h.contentId,contentVersion: h.contentVersion,
      generator: { file: 'scripts/build-historical-scenarios.mjs',sha256: sha(await fs.readFile(fileURLToPath(import.meta.url))),polygonClipping: '0.15.7' },
      sourceFiles: Object.entries(SOURCE_HASHES).map(([fileName,sha256]) => ({ fileName,sha256 })),
      assets: [{ id: 'regionsGeojson',sourceIds: ['hbm','naturalEarth'],crs: 'OGC:CRS84',revision: `${SOURCE_REVISION}+${physical.revision}`,sha256: sha(json(regions)),license: 'GPL-3.0-only AND public-domain',transformations },
        { id: 'citiesGeojson',sourceIds: [ancient ? 'memphis' : 'windsor'],crs: 'OGC:CRS84',revision: 'Getty records retrieved2026-11-05',sha256: sha(json(cities)),license: 'ODC-By-1.0',transformations: ['Copy the decimal modern-place reference; describe its historical placement limit.'] }],
      authoredInputs: await Promise.all(['authored-scenarios.mjs','ad1200-review.json','bc3000-review.json'].map(async fileName => ({ fileName,sha256: sha(await read(fileName)) }))),
    };
    h.assetManifest = assetManifest;
    const componentLicenses = [{ id: 'historical-basemaps',license: 'GPL-3.0-only',scope: ['regionsGeojson','world.historicalScenario.regionReview'],
      attribution: 'Historical boundaries: André Ourednik and contributors, historical-basemaps. Original collection credits accompany the source.',
      sourceUrl: `https://raw.githubusercontent.com/aourednik/historical-basemaps/${SOURCE_REVISION}/geojson/${sourceFile.slice(4)}`,
      revision: SOURCE_REVISION,sha256: SOURCE_HASHES[sourceFile],licenseText: inputs['hbm-LICENSE'],modifications: transformations,
      sourceFiles: [{ fileName: sourceFile.slice(4),text: inputs[sourceFile] },{ fileName: 'README.md',text: inputs['hbm-README.md'] },{ fileName: 'CONTRIBUTING.md',text: inputs['hbm-CONTRIBUTING.md'] }] },
      { id: 'natural-earth',license: 'public-domain',scope: ['regionsGeojson'],attribution: 'Made with Natural Earth. Physical land 1:50m.',sourceUrl: physical.url,revision: physical.revision,sha256: physical.sha256,licenseText: 'Natural Earth states that its map data is in the public domain. https://www.naturalearthdata.com/about/terms-of-use/',modifications: transformations.slice(3,4) },
      { id: 'getty-tgn',license: 'ODC-By-1.0',scope: ['citiesGeojson','world.historicalScenario.settlements'],attribution: 'Getty Thesaurus of Geographic Names, Getty Research Institute. https://www.getty.edu/research-conservation/tools-databases/vocabularies/data-services/',sourceUrl: h.sources[ancient ? 'memphis' : 'windsor'].url,revision: 'retrieved2026-11-05',sha256: sha(json(h.settlements)),licenseText: 'Open Data Commons Attribution License1.0: https://opendatacommons.org/licenses/by/1-0/',modifications: ['Modern place coordinate retained; historical marker explicitly approximate.'] }];
    const world = {
      startingTimelineText: [h.contextSv, h.calendarNoteSv, h.coverageNoteSv].join('\n'),
      simulationRules: 'Utgå från den källbelagda startsituationen och kampanjens aktuella datum. Spelet kan ta en annan väg efter starten; framtida verkliga händelser är inga förutbestämda utfall. Personernas ursprungsetiketter skiljer dokumenterade identiteter från genererade personer. Spelmotorn styr datum, härskare, gränser och sparade utfall. Okänd kontroll betyder att underlag saknas.',
      customRegions: true,customGeometry: true,customCities: true,historicalScenario: h,componentLicenses,
      assetProvenance: Object.fromEntries(assetManifest.assets.map(a => [a.id,{ ...a,hashScope: 'authored-release',componentIds: a.id === 'regionsGeojson' ? ['historical-basemaps','natural-earth'] : ['getty-tgn'] }])),
      polityOverrides: Object.fromEntries(h.polities.map((p,i) => [p.id,{ name: p.nameSv,code: p.id,color: ['#c49b53','#ad6c5c','#678b72','#8f759e','#66869d','#a78c5a'][i % 6],note: p.noteSv,status: 'active',aliases: [],mapRefs: { gadm0: [] } }])),
      regionOwnershipOverrides: Object.fromEntries(regions.features.map(f => [f.properties.id,f.properties.owner])),notes: h.coverageNoteSv,mapCredit: componentLicenses.map(c => c.attribution).join('\n') };
    const game = { country: h.playablePolityIds[0],startDate: h.bookmarkDate,gameDate: h.bookmarkDate,difficulty: 'standard',language: 'Svenska' };
    const valid = validateHistoricalScenario({ game,world,regions,assetManifest },{ date: h.bookmarkDate,polityId: h.playablePolityIds[0] });
    if (!valid.ok) throw new Error(`${h.contentId}: ${valid.code}`);
    const bundle = withScenarioLicense({ schema: 'open-historia-scenario-bundle/2',version: 2,mode: 'full',
      scenario: { id: h.contentId,name: `${h.polities[0].nameSv}, ${h.eraLabelSv}`,description: h.contextSv },
      data: { game,world,prompts: {},actions: [],advisor: [],chat: [],events: [] },
      assets: { regionsGeojson: { mode: 'embedded',fileName: 'regions.geojson',data: regions },citiesGeojson: { mode: 'embedded',fileName: 'cities.geojson',data: cities },flags: { mode: 'embedded',fileName: 'flags.json',data: {} },colors: { mode: 'embedded',fileName: 'colors.json',data: {} } } });
    const outputs = { 'regions.geojson': json(regions),'cities.geojson': json(cities),'scenario.json': json(bundle),'manifest.json': json(assetManifest) };
    for (const [name,bytes] of Object.entries(outputs)) {
      inventory.push({ file: `${h.contentId}/${name}`,bytes: Buffer.byteLength(bytes),sha256: sha(bytes) });
      const destination = path.join(ROOT,h.contentId,name);
      if (check) { if (await fs.readFile(destination,'utf8') !== bytes) throw new Error(`Historical output differs: ${h.contentId}/${name}`); }
      else { await fs.mkdir(path.dirname(destination),{ recursive: true }); await fs.writeFile(destination,bytes,'utf8'); }
    }
    result.push({ contentId: h.contentId,regions: regions.features.length,reviewedCandidates: h.regionReview.length,polities: h.polities.length });
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
