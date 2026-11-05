/*! Open Historia — the licence scenarios are shared under © 2026 Nicholas Krol, AGPL-3.0-or-later (see LICENSE). */
// The owner's rule: every scenario made in Open Historia and then posted or
// distributed in any way is released under CC BY 4.0. (For a day, 13 to 14
// October 2026, the rule was public domain, written as CC0 1.0; he changed
// it: "change it so scenarios arent public domain, they are fully open but
// credit must be given", and then "dont say anywhere that credit must be
// given, just say they are under that liscense". So the game names the
// licence and links to it, and leaves what the licence asks to the licence.)
//
// The rule is said in three places, so nobody shares a scenario without having
// been told and nobody receives one without being able to find out:
//   - on the screens a scenario leaves the game from (Community → Publish to
//     Hub, a scenario's Bundles tab, Suggest changes);
//   - in the file itself: the bundle's `license` record and, in a .zip,
//     LICENSE.txt;
//   - on the hub's post form, its README and the website, which are not in
//     this repository.
//
// It covers the scenario and what its author made for it. It cannot cover what
// was never theirs to license (a picture found elsewhere), and it does not
// reach a detailed map or a music track a scenario only names: each of those
// is a separate download with its own licence on its own post.

export const SCENARIO_LICENSE_ID = "CC-BY-4.0";
export const SCENARIO_LICENSE_NAME = "Creative Commons Attribution 4.0 International";
export const SCENARIO_LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";
// The entry a zipped scenario or suggestion carries. Plain text, which the hub
// keeps (it rebuilds every zip from checked entries) and every import ignores.
export const SCENARIO_LICENSE_FILE = "LICENSE.txt";

export const SCENARIO_LICENSE_NOTICE = "Scenarios made in Open Historia that are posted or shared in any way are released under the Creative Commons Attribution 4.0 International licence (CC BY 4.0).";

export const SCENARIO_LICENSE_TEXT = [
  "LICENCE",
  "",
  "This scenario was made with Open Historia (https://openhistoria.com).",
  "",
  "Every scenario made in Open Historia that is posted or shared in any way is",
  "released under the Creative Commons Attribution 4.0 International licence",
  "(CC BY 4.0):",
  "",
  `    ${SCENARIO_LICENSE_URL}`,
  "",
  "This covers the scenario and everything its author made for it. Anything in",
  "this file that was not its author's to license stays under its own terms.",
  "Embedded third-party components retain the terms in componentLicenses and",
  "the accompanying licenses/ entries. The CC BY record covers authored content.",
  "A detailed map or a music track the scenario only names is not part of this",
  "file and keeps the licence on its own post.",
  "",
].join("\n");

// The record an exported scenario carries beside its schema and version. An
// import reads the parts it knows by name, so a build from before this simply
// does not see it.
export const scenarioLicense = () => ({
  id: SCENARIO_LICENSE_ID,
  name: SCENARIO_LICENSE_NAME,
  url: SCENARIO_LICENSE_URL,
  notice: SCENARIO_LICENSE_NOTICE,
});

const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);

// Keep component terms in world state, which both stores persist, as well as at
// the bundle boundary. Descriptor-only metadata used to disappear on import.
export const preserveComponentProvenance = bundle => {
  if (!isRecord(bundle)) return bundle;
  const world = bundle.data?.world ?? {};
  const components = [...(Array.isArray(world.componentLicenses) ? world.componentLicenses : []),
    ...(Array.isArray(bundle.componentLicenses) ? bundle.componentLicenses : [])];
  const byId = new Map(components.filter(c => isRecord(c) && typeof c.id === 'string').map(c => [c.id,c]));
  const assetProvenance = { ...(world.assetProvenance ?? {}) };
  for (const [key, asset] of Object.entries(bundle.assets ?? {})) {
    if (isRecord(asset?.provenance)) assetProvenance[key] = asset.provenance;
  }
  if (!byId.size && !Object.keys(assetProvenance).length) return bundle;
  return { ...bundle, data: { ...bundle.data, world: { ...world,
    componentLicenses: [...byId.values()], assetProvenance } } };
};

export const withScenarioLicense = bundle => {
  if (!isRecord(bundle)) return bundle;
  const next = preserveComponentProvenance(bundle);
  const components = next.data?.world?.componentLicenses ?? [];
  if (!components.length) return { ...next, license: scenarioLicense() };
  const assets = Object.fromEntries(Object.entries(next.assets ?? {}).map(([key,value]) => [key,
    next.data.world.assetProvenance?.[key] ? { ...value, provenance: next.data.world.assetProvenance[key] } : value]));
  return { ...next, assets, componentLicenses: components,
    license: { ...scenarioLicense(), scope: 'authored-content', componentTerms: 'componentLicenses' } };
};

export const componentLicenseFiles = bundle => {
  const components = bundle?.componentLicenses ?? bundle?.data?.world?.componentLicenses ?? [];
  const files = Object.fromEntries(components.map((c,index) => [
    `licenses/${String(c.id ?? index).replace(/[^a-zA-Z0-9_-]/g,'-')}.txt`,
    [c.attribution, `Component: ${c.id}`, `Scope: ${(c.scope ?? []).join(', ')}`,
      `License: ${c.license}`, `Source: ${c.sourceUrl}`, `Revision: ${c.revision}`,
      `SHA-256: ${c.sha256}`, 'Modifications:', ...(c.modifications ?? []), '', c.licenseText ?? ''].join('\n'),
  ]));
  for (const [index,c] of components.entries()) for (const source of c.sourceFiles ?? []) {
    const id = String(c.id ?? index).replace(/[^a-zA-Z0-9_-]/g,'-');
    const name = String(source.fileName ?? 'source.txt').replace(/[^a-zA-Z0-9_.-]/g,'-');
    files[`sources/${id}/${name}`] = String(source.text ?? '');
  }
  return files;
};
