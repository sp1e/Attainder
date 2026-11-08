// The desktop library keeps a historical start summary in each scenario meta, stamped with the
// size and modification time of the scenario's world.json and game.json, so a catalog read
// rebuilds a summary only when those files changed.
//
// Each step runs in its own child process because OH_DATA_DIR is read once, at import time, and
// because a fresh process has no catalog in memory: what it reads comes from the files on disk.
// The child counts how often it reads each scenario's world.json by wrapping fs.readFileSync,
// which is what the store's readJsonFile calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const STORE_URL = new URL('./libraryStore.js', import.meta.url).href;

const runStore = (root, body) => execFileSync(process.execPath, ['--input-type=module', '-e', `
  import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path';
  const scenariosDir = path.join(process.env.OH_DATA_DIR, 'scenarios');
  const worldReads = new Map(), metaReads = new Map(), readFileSync = fs.readFileSync;
  fs.readFileSync = (file, ...rest) => {
    const name = String(file), counts = { 'world.json': worldReads, 'scenario.json': metaReads }[path.basename(name)];
    if (name.startsWith(scenariosDir) && counts) {
      const id = path.basename(path.dirname(name));
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return readFileSync(file, ...rest);
  };
  const reads = id => worldReads.get(id) ?? 0;
  const metaReadsOf = id => metaReads.get(id) ?? 0;
  const store = await import(${JSON.stringify(STORE_URL)});
  const entry = id => store.getScenarioCatalog().scenarios.find(s => s.id === id);
  ${body}
`], { env: { ...process.env, OH_DATA_DIR: root }, stdio: 'pipe', encoding: 'utf8' });

const withLibrary = (run) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'attainder-summary-'));
  try {
    runStore(root, 'store.ensureScenarioStore();');
    return run(root);
  } finally { rmSync(root, { recursive: true, force: true }); }
};

const scenarioFile = (root, id, name) => path.join(root, 'scenarios', id, name);
const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
const editJson = (file, change) => { const value = readJson(file); change(value); writeFileSync(file, JSON.stringify(value, null, 2)); };

const AD800_POLITIES = ['carolingian-realm', 'papal-states', 'tang-empire', 'abbasid-caliphate', 'byzantine-empire', 'silla',
  'emirate-of-cordoba', 'aghlabid-emirate', 'kingdom-of-asturias', 'duchy-of-benevento'];

test('the catalog carries a summary for each start and a later read builds none again', () => withLibrary(root => {
  runStore(root, `
    store.ensureScenarioStore(); worldReads.clear();
    const karl = entry('charlemagne-800'), john = entry('default'), egypt = entry('egypt-3000bc');
    assert.deepEqual(karl.historicalSummary.polities.map(p => p.id), ${JSON.stringify(AD800_POLITIES)});
    assert.deepEqual(karl.historicalStart, { date: '0800-12-25', contentId: 'charlemagne-800' });
    assert.equal(john.historicalSummary.eraId, 'high-middle-ages');
    assert.deepEqual(john.historicalStart, { date: '1200-12-31', contentId: 'john-1200' });
    assert.equal(egypt.historicalSummary.eraId, 'bronze-age');
    assert.deepEqual(entry('world-1500').historicalSummary.polities.map(p => [p.id, p.regionId]), [['aztec-empire', 'americas'], ['inca-empire', 'americas']]);
    assert.deepEqual(entry('world-1500').historicalStart, { date: '1500-12-31', contentId: 'world-1500' });
    assert.equal(reads('charlemagne-800'), 1, 'the first read builds the summary from world.json');
    const library = store.getLibraryCatalog().scenarios.find(s => s.id === 'charlemagne-800');
    assert.deepEqual(library.historicalSummary, karl.historicalSummary);
  `);
  const stored = readJson(scenarioFile(root, 'charlemagne-800', 'scenario.json')).historicalSummary;
  assert.equal(stored.schema, 4);
  assert.match(stored.sourceStamp, /^\d+:[\d.]+:\d+:[\d.]+$/);
  // The default world.json is parsed once per version on disk (syncBuiltInScenarioSeedDate), and
  // a rebuild writes the meta, so the check covers both.
  const ids = ['default', 'egypt-3000bc', 'charlemagne-800', 'world-1500'];
  const metaTimes = () => ids.map(id => statSync(scenarioFile(root, id, 'scenario.json')).mtimeMs);
  const before = metaTimes();
  runStore(root, `
    store.ensureScenarioStore(); worldReads.clear();
    const karl = entry('charlemagne-800');
    assert.deepEqual(karl.historicalSummary.polities.map(p => p.id), ${JSON.stringify(AD800_POLITIES)});
    assert.equal(entry('default').historicalSummary.eraId, 'high-middle-ages');
    assert.equal(reads('charlemagne-800'), 0);
    assert.equal(reads('egypt-3000bc'), 0);
    assert.equal(reads('world-1500'), 0);
    assert.equal(reads('default'), 0, 'the default world is not parsed again while it is unchanged');
  `);
  assert.deepEqual(metaTimes(), before, 'no summary is built or written again');
}));

test('a catalog entry reads its scenario meta once, also when it rebuilds the summary', () => withLibrary(root => {
  editJson(scenarioFile(root, 'charlemagne-800', 'game.json'), game => { game.gameDate = '0801-01-01'; });
  runStore(root, `
    store.ensureScenarioStore(); metaReads.clear();
    assert.equal(entry('charlemagne-800').historicalSummary.date, '0801-01-01');
    assert.equal(metaReadsOf('charlemagne-800'), 1, 'the rebuilt summary is stored from the meta already read');
    assert.equal(metaReadsOf('egypt-3000bc'), 1, 'a cached summary comes from the meta already read');
  `);
  assert.equal(readJson(scenarioFile(root, 'charlemagne-800', 'scenario.json')).historicalSummary.date, '0801-01-01');
}));

test('a game date edited on disk without a meta write shows on the next catalog read', () => withLibrary(root => {
  runStore(root, 'assert.equal(entry("charlemagne-800").historicalStart.date, "0800-12-25");');
  const metaPath = scenarioFile(root, 'charlemagne-800', 'scenario.json');
  const updatedAt = readJson(metaPath).updatedAt;
  editJson(scenarioFile(root, 'charlemagne-800', 'game.json'), game => { game.gameDate = '0801-01-01'; });
  runStore(root, `
    const karl = entry('charlemagne-800');
    assert.equal(karl.historicalStart.date, '0801-01-01');
    assert.equal(karl.historicalSummary.date, '0801-01-01');
  `);
  assert.equal(readJson(metaPath).historicalSummary.date, '0801-01-01');
  assert.equal(readJson(metaPath).updatedAt, updatedAt);
  // A rename changes only the meta, so the stamp alone would keep the old name in the summary.
  editJson(metaPath, meta => { meta.name = 'Karl den store'; });
  runStore(root, 'assert.equal(entry("charlemagne-800").historicalSummary.name, "Karl den store");');
}));

test('a meta from before summaries gains one on the first catalog read and keeps every other field', () => withLibrary(root => {
  // Installing writes the metas as the code before summaries did; no catalog has been read yet.
  const metaPath = scenarioFile(root, 'charlemagne-800', 'scenario.json');
  const before = readJson(metaPath);
  assert.equal(Object.hasOwn(before, 'historicalSummary'), false);
  // The shipped default meta has no createdAt or updatedAt; the store reads a pair it mints as
  // "never edited", so the cache write must not store any.
  const defaultPath = scenarioFile(root, 'default', 'scenario.json');
  const defaultMeta = readJson(defaultPath);
  editJson(scenarioFile(root, 'egypt-3000bc', 'scenario.json'), meta => { meta.restoreOnly = true; });
  runStore(root, `
    assert.equal(entry('charlemagne-800').historicalSummary.contentId, 'charlemagne-800');
    const egypt = entry('egypt-3000bc');
    assert.equal(egypt.historicalSummary.contentId, 'egypt-3000bc');
    assert.equal(egypt.historicalStart, null, 'the copy a restored campaign uses is not offered');
  `);
  const { historicalSummary, ...after } = readJson(metaPath);
  assert.equal(historicalSummary.schema, 4);
  assert.deepEqual(after, before, 'updatedAt and the other fields are as they were');
  const { historicalSummary: johnSummary, ...defaultAfter } = readJson(defaultPath);
  assert.equal(johnSummary.contentId, 'john-1200');
  assert.deepEqual(defaultAfter, defaultMeta, 'a meta without timestamps gains none');
}));

test('a summary stored under schema 1 is built again from world.json on the next catalog read', () => withLibrary(root => {
  runStore(root, 'entry("charlemagne-800");');
  const metaPath = scenarioFile(root, 'charlemagne-800', 'scenario.json');
  // The summary schema 1 wrote: the same stamp, polities without a start text of their own.
  editJson(metaPath, meta => {
    meta.historicalSummary.schema = 1;
    for (const polity of meta.historicalSummary.polities) delete polity.contextSv;
  });
  // Every AD 800 court ships its own start text, so the rebuilt summary carries each one from world.json.
  const { courtSeeds } = readJson(scenarioFile(root, 'charlemagne-800', 'world.json')).historicalScenario;
  const courtTexts = AD800_POLITIES.map(id => courtSeeds[id].contextSv);
  assert.ok(courtTexts.every(text => typeof text === 'string' && text.length > 50));
  runStore(root, `
    store.ensureScenarioStore(); worldReads.clear();
    const karl = entry('charlemagne-800');
    assert.equal(karl.historicalSummary.schema, 4);
    assert.deepEqual(karl.historicalSummary.polities.map(p => p.contextSv), ${JSON.stringify(courtTexts)});
    assert.equal(reads('charlemagne-800'), 1, 'the old summary is rebuilt from world.json');
  `);
  const stored = readJson(metaPath).historicalSummary;
  assert.equal(stored.schema, 4);
  assert.ok(stored.polities.every(p => Object.hasOwn(p, 'contextSv')), 'the rebuilt summary is cached');
}));

test('a summary stored under schema 2 is built again with each polity kind', () => withLibrary(root => {
  runStore(root, 'entry("charlemagne-800");');
  const metaPath = scenarioFile(root, 'charlemagne-800', 'scenario.json');
  // The summary schema 2 wrote: the same stamp, polities without a kind.
  editJson(metaPath, meta => {
    meta.historicalSummary.schema = 2;
    for (const polity of meta.historicalSummary.polities) delete polity.kind;
  });
  runStore(root, `
    store.ensureScenarioStore(); worldReads.clear();
    const karl = entry('charlemagne-800');
    assert.equal(karl.historicalSummary.schema, 4);
    assert.deepEqual(karl.historicalSummary.polities.map(p => p.kind), ${JSON.stringify(AD800_POLITIES.map(() => 'state'))});
    assert.equal(reads('charlemagne-800'), 1, 'the old summary is rebuilt from world.json');
  `);
  const stored = readJson(metaPath).historicalSummary;
  assert.equal(stored.schema, 4);
  assert.ok(stored.polities.every(p => p.kind === 'state'), 'the rebuilt summary is cached');
}));

test('a summary stored under schema 3 is built again with map coverage', () => withLibrary(root => {
  runStore(root, 'entry("charlemagne-800");');
  const metaPath = scenarioFile(root, 'charlemagne-800', 'scenario.json');
  // The summary schema 3 wrote: the same stamp, no map coverage.
  editJson(metaPath, meta => {
    meta.historicalSummary.schema = 3;
    delete meta.historicalSummary.mapCoverage;
  });
  runStore(root, `
    store.ensureScenarioStore(); worldReads.clear();
    const karl = entry('charlemagne-800');
    assert.equal(karl.historicalSummary.schema, 4);
    assert.equal(karl.historicalSummary.mapCoverage.unownedFeatureCount, 214);
    assert.equal(reads('charlemagne-800'), 1, 'the old summary is rebuilt from world.json');
  `);
  const stored = readJson(metaPath).historicalSummary;
  assert.equal(stored.schema, 4);
  assert.ok(Object.hasOwn(stored, 'mapCoverage'), 'the rebuilt summary is cached');
}));

test('a stored start whose papal ruler is gone from the court is left off and the others stay', () => withLibrary(root => {
  editJson(scenarioFile(root, 'charlemagne-800', 'world.json'), world => {
    const court = world.historicalScenario.courtSeeds['papal-states'];
    court.people = court.people.filter(person => person.id !== court.rulerId);
  });
  runStore(root, `
    const karl = entry('charlemagne-800');
    assert.equal(karl.historicalSummary.invalid, true);
    assert.deepEqual(karl.historicalStart, { date: '0800-12-25', contentId: 'charlemagne-800' }, 'the library bar keeps the broken start');
    for (const [id, contentId] of [['default', 'john-1200'], ['egypt-3000bc', 'egypt-3000bc'], ['world-1500', 'world-1500']]) {
      assert.equal(entry(id).historicalSummary.contentId, contentId);
      assert.equal(entry(id).historicalStart.contentId, contentId);
    }
    assert.equal(store.getLibraryCatalog().scenarios.find(s => s.id === 'charlemagne-800').historicalSummary.invalid, true);
  `);
}));

test('a stat error on one scenario leaves the catalog loading and caches nothing for that scenario', () => withLibrary(root => {
  runStore(root, `
    const statSync = fs.statSync;
    fs.statSync = (file, ...rest) => {
      if (String(file).includes(path.join('scenarios', 'egypt-3000bc'))) throw Object.assign(new Error('EPERM: busy'), { code: 'EPERM' });
      return statSync(file, ...rest);
    };
    const egypt = entry('egypt-3000bc');
    assert.equal(egypt.historicalSummary.eraId, 'bronze-age', 'the summary is built from the files');
    assert.equal(egypt.historicalSummary.sourceStamp, null);
    assert.equal(entry('charlemagne-800').historicalSummary.polities.length, 10, 'the other starts still load');
    const meta = JSON.parse(fs.readFileSync(path.join(scenariosDir, 'egypt-3000bc', 'scenario.json'), 'utf8'));
    assert.notEqual(meta.historicalSummary?.sourceStamp, null, 'no summary with an unknown stamp is cached');
  `);
}));
