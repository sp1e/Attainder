/*! Open Historia — scenario file decoding, AGPL-3.0-or-later (see LICENSE). */
import { embedScenarioBundleImage, embedScenarioBundleVector } from './communityBasemaps.js';
import { looksLikeZip, unzipBundle } from './bundleZip.js';
import { restoreBundleFiles } from './bundleFiles.js';

export async function readScenarioFile(file) {
  const buffer=await file.arrayBuffer();
  let bundle;
  if (looksLikeZip(new Uint8Array(buffer))) {
    const zip=await unzipBundle(buffer);
    const text=await zip.text('scenario.json');
    if (!text) throw new Error('Zipfilen saknar scenario.json.');
    bundle=await restoreBundleFiles(JSON.parse(text),zip);
    const image=zip.names().find(n=>/(^|\/)basemap\.(png|jpe?g|webp|gif|svg)$/i.test(n));
    if (image) embedScenarioBundleImage(bundle,await zip.bytes(image),image);
    else {
      const vector=zip.names().find(n=>/(^|\/)basemap\.geojson$/i.test(n));
      if (vector) embedScenarioBundleVector(bundle,await zip.bytes(vector));
    }
  } else bundle=JSON.parse(new TextDecoder().decode(buffer));
  if (bundle && typeof bundle === 'object') delete bundle.hubOrigin;
  return bundle;
}

export async function restoreScenarioFileForGame({file,gameId,restore}) {
  return restore(gameId,await readScenarioFile(file));
}
