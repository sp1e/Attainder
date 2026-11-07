// Earlier historical releases for upgrade tests. A release is rebuilt from the package shipped today
// and a patch that puts back every subtree the release had different, so the suite holds an old
// release without a second copy of its multi-megabyte bundle. The recorded sha256 proves the rebuild
// byte for byte. scripts/write-release-patch.mjs writes a patch from git history.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const sha = text => createHash('sha256').update(text).digest('hex');
const readText = url => readFileSync(url, 'utf8');

// Each op is [path, value]: the value the release held at that path of the bundle.
export function applyReleasePatch(current, patch) {
  let bundle = JSON.parse(JSON.stringify(current));
  for (const [keys, value] of patch.ops) {
    if (!keys.length) { bundle = value; continue; }
    const parent = keys.slice(0, -1).reduce((node, key) => node[key], bundle);
    parent[keys.at(-1)] = value;
  }
  const text = JSON.stringify(bundle) + '\n';
  if (sha(text) !== patch.sha256) {
    throw new Error(`${patch.contentId} ${patch.contentVersion}: the patch no longer rebuilds the released bytes; run scripts/write-release-patch.mjs again`);
  }
  return bundle;
}

export function releaseFromPatch(patchName) {
  const patch = JSON.parse(readText(new URL(`./${patchName}`, import.meta.url)));
  const current = JSON.parse(readText(new URL(`../seed/historical/${patch.contentId}/${patch.file}`, import.meta.url)));
  return applyReleasePatch(current, patch);
}

// The Charlemagne bundle as release 1.1.0 shipped it (main at 2128ee11).
export const charlemagneRelease110 = () => releaseFromPatch('charlemagne-800-1.1.0.patch.json');

// The John bundle as release 1.0.0 shipped it (main at 2128ee11), which the built-in scenario `default` held at revision 1.
export const johnRelease100 = () => releaseFromPatch('john-1200-1.0.0.patch.json');
