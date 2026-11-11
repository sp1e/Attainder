// Reading and writing the JSON the bilingual data scripts keep in the repository
// (build-historical-pairs.mjs, build-package-catalog.mjs, check-locale-sidecars.mjs).
import fs from "node:fs";
import path from "node:path";

// A missing file is `fallback`; a file that is there but is not JSON is an error.
export const readJson = (file, fallback) => {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (error) {
    if (error.code === "ENOENT" && fallback !== undefined) return fallback;
    throw error;
  }
  return JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
};

// UTF-8 without a BOM, two spaces, a final newline. A flat object comes out one
// entry per line, which keeps the diffs of the pair files readable.
export const serializeJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

// A checkout with core.autocrlf has CRLF in the working copy and LF in the
// commit. JSON never holds a raw line break inside a string, so comparing with
// the line endings folded loses nothing.
const foldLineEndings = (text) => text.replace(/\r\n/g, "\n");

// Writes `text` to `file`, or with `check` compares it with the file on disk.
// Returns true when the file is (now) what a fresh build gives.
export const writeOrCheck = ({ file, text, check }) => {
  if (!check) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text, "utf8");
    return true;
  }
  if (!fs.existsSync(file)) return false;
  return foldLineEndings(fs.readFileSync(file, "utf8")) === foldLineEndings(text);
};
