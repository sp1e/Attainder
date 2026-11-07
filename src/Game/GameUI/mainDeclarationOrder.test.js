/*! Open Historia - GameUI main.jsx declaration order, AGPL-3.0-or-later (see LICENSE). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// A full render of Main needs the map, the library and the runtime stores, so
// this reads the source instead: a const read in the component body before its
// declaration throws a ReferenceError on every render, in every mode.
const source = readFileSync(new URL('./main.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const code = source.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('activeGame is declared before the first line that reads it', () => {
  const declaration = code.indexOf('const { activeGame');
  const firstUse = code.search(/\bactiveGame\b/);
  assert.ok(declaration > 0, 'declaration found');
  // The first mention in the file is the declaration itself.
  assert.equal(firstUse, code.indexOf('activeGame', declaration), 'activeGame is read before the useLibraryState destructuring');
});

test('the chronicle request hook runs after activeGame exists', () => {
  const declaration = code.indexOf('const { activeGame');
  const hook = code.indexOf('useHistoryRecordRequest(activeGame');
  assert.ok(hook > declaration, 'useHistoryRecordRequest reads activeGame below its declaration');
});
