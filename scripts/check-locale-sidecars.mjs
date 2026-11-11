// Reads both translation sidecars (server/seed/historical/locales/en.json and sv.json) and
// checks every entry against the field it translates: the source file at `source.path`, then
// `eventId` + `fieldPath` inside the event catalog's events, `sourceId` + `fieldPath` inside
// its sources, or a document-wide `jsonPointer`. The SHA-256 of the exact UTF-8 source string
// must equal `textSha256`, and the source text the entry stores (`sv` in en.json, `en` in
// sv.json) must be that string. A mismatch means the source changed after it was translated.
//
//   node scripts/check-locale-sidecars.mjs [--check]
//
// The script only reads, so --check changes nothing; it is accepted so every data check
// takes the same flag.
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson } from "./i18n/jsonOutput.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SIDECARS = ["server/seed/historical/locales/en.json", "server/seed/historical/locales/sv.json"];

const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");

// RFC 6901: "/a/0/b", with ~1 for a slash and ~0 for a tilde inside a name.
const atPointer = (value, pointer) => {
  if (pointer === "") return value;
  if (typeof pointer !== "string" || !pointer.startsWith("/")) return undefined;
  let current = value;
  for (const raw of pointer.slice(1).split("/")) {
    const name = raw.replace(/~1/g, "/").replace(/~0/g, "~");
    if (current === null || typeof current !== "object" || !Object.hasOwn(current, name)) return undefined;
    current = current[name];
  }
  return current;
};

const byId = (list) => new Map((Array.isArray(list) ? list : []).map((record) => [record?.id, record]));

// Each source file is parsed once; null for a path that leaves the repository or has no file.
const createSourceReader = (root) => {
  const documents = new Map();
  return (relative) => {
    if (!documents.has(relative)) {
      const file = path.resolve(root, String(relative));
      const inside = file.startsWith(path.resolve(root) + path.sep);
      const json = inside ? readJson(file, null) : null;
      documents.set(relative, json === null ? null : { json, events: byId(json.events), sources: byId(json.sources) });
    }
    return documents.get(relative);
  };
};

// The string an entry translates, or the reason it cannot be read.
const sourceText = (document, source) => {
  let value;
  if (typeof source.eventId === "string") value = atPointer(document.events.get(source.eventId), source.fieldPath);
  else if (typeof source.sourceId === "string") value = atPointer(document.sources.get(source.sourceId), source.fieldPath);
  else if (typeof source.jsonPointer === "string") value = atPointer(document.json, source.jsonPointer);
  else return { reason: "the entry names no eventId, sourceId or jsonPointer" };
  if (value === undefined) return { reason: "the source field does not exist" };
  if (typeof value !== "string") return { reason: "the source field is not text" };
  return { text: value };
};

const entryProblem = (entry, sourceLocale, readSource) => {
  const source = entry?.source;
  if (!source || typeof source.path !== "string") return "the entry has no source path";
  const document = readSource(source.path);
  if (!document) return `the source file ${source.path} is missing`;
  const { text, reason } = sourceText(document, source);
  if (reason) return reason;
  const hashDiffers = sha256(text) !== source.textSha256;
  const storedDiffers = entry[sourceLocale] !== text;
  if (hashDiffers && storedDiffers) return `the source text changed: textSha256 and the stored ${sourceLocale} text both differ from it`;
  if (hashDiffers) return "textSha256 is not the hash of the source text";
  if (storedDiffers) return `the stored ${sourceLocale} text differs from the source text`;
  return null;
};

// Every entry of both sidecars against its source. `mismatches` is empty when all agree.
export function checkLocaleSidecars({ root = ROOT, sidecars = SIDECARS } = {}) {
  const readSource = createSourceReader(root);
  const mismatches = [];
  let checked = 0;
  for (const relative of sidecars) {
    const sidecar = readJson(path.join(root, relative));
    for (const entry of sidecar.entries ?? []) {
      checked += 1;
      const reason = entryProblem(entry, sidecar.sourceLocale, readSource);
      if (reason) mismatches.push({ sidecar: relative, id: entry?.id ?? "(no id)", reason });
    }
  }
  return { checked, mismatches };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { checked, mismatches } = checkLocaleSidecars();
    for (const { sidecar, id, reason } of mismatches) console.error(`${path.basename(sidecar)}: ${id}: ${reason}`);
    console.log(JSON.stringify({ checked, mismatches: mismatches.length }));
    if (mismatches.length) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
