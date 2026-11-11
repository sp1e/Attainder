import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPromptContext, buildWorldSummary } from './promptContext.js';
import { isCharacterCampaign } from '../../runtime/characterLanguage.js';
import { createDynastyWorld } from '../../runtime/dynastyScenario.js';
import { languageDirective } from '../../runtime/i18n.js';

// The language a simulation prompt names and the directive callAI appends. Every test names the language or the
// stored code itself, so none reads the Options choice from localStorage.

// A character campaign stamped the way the shipped packages are: world and game both say Svenska.
const dynasty = () => ({ world: createDynastyWorld({ language: 'Svenska' }), game: { country: 'Hadara', language: 'Svenska' }, actions: [], events: [], chats: [] });
const plain = (world, game) => ({ world, game: { country: 'France', ...game }, actions: [], events: [], chats: [] });

test('a dynasty campaign names the Options language in its prompts, over a stamp that says Svenska', async () => {
  for (const campaignLanguage of ['English', 'Swedish']) {
    const context = await buildPromptContext(dynasty(), { requiredKeys: ['language'], campaignLanguage });
    assert.equal(context.language, campaignLanguage);
    const summary = await buildWorldSummary(dynasty(), [], { campaignLanguage });
    assert.match(summary, new RegExp(`^Language: ${campaignLanguage}$`, 'm'));
    assert.doesNotMatch(summary, /Svenska/);
  }
});

// The world summary reads the normalized world, whose language is English when the save states none, so the game's
// language shows only in the `language` variable. Both are as they were before the Options rule.
test('a campaign without the character system keeps the language of its world, then of its game', async () => {
  for (const [bundle, variable, summaryLine] of [[plain({ language: 'French' }, { language: 'German' }), 'French', 'French'],
    [plain({}, { language: 'German' }), 'German', 'English'], [plain({}, {}), 'English', 'English']]) {
    for (const campaignLanguage of ['English', 'Swedish']) {
      const context = await buildPromptContext(bundle, { requiredKeys: ['language'], campaignLanguage });
      assert.equal(context.language, variable);
      assert.match(await buildWorldSummary(bundle, [], { campaignLanguage }), new RegExp(`^Language: ${summaryLine}$`, 'm'));
    }
  }
});

// callAI's own directive function, run with its I/O replaced: the stored language code, the world read and the debug log.
const mainSource = readFileSync(new URL('./main.jsx', import.meta.url), 'utf8');
const directiveAt = mainSource.indexOf('const campaignLanguageDirective = async () => {');
const directiveEnd = mainSource.indexOf('export async function callAI', directiveAt);
assert.ok(directiveAt >= 0 && directiveEnd > directiveAt);
function directiveFor(storedCode, readWorld) {
  const reads = [], logged = [];
  const readJson = async (url, options) => { reads.push({ url, options }); return readWorld(); };
  const run = new Function('languageDirective', 'readJson', 'JSON_URLS', 'logDebugEvent', 'isCharacterCampaign',
    `${mainSource.slice(directiveAt, directiveEnd)}\nreturn campaignLanguageDirective;`)(
    (code = storedCode, options) => languageDirective(code, options), readJson, { world: 'world.json' }, (kind, line) => logged.push(line), isCharacterCampaign);
  return run().then((directive) => ({ directive, reads, logged }));
}

test('an English player of a character campaign gets the language directive; any other English campaign gets none', async () => {
  const court = await directiveFor('en', () => ({ characterSystem: { revision: 3 }, language: 'Svenska' }));
  assert.match(court.directive, /^LANGUAGE: The player reads English \(en\)\. Write ALL natural-language text in English/);
  assert.deepEqual(court.reads, [{ url: 'world.json', options: { defaultValue: {}, clone: false } }]);
  assert.equal((await directiveFor('en', () => ({ language: 'Svenska' }))).directive, '');
  assert.equal((await directiveFor('en', () => null)).directive, '');
});

test('a Swedish player keeps the directive as it was, without a read of the world', async () => {
  const swedish = await directiveFor('sv', () => assert.fail('the world is not read'));
  assert.equal(swedish.directive, languageDirective('sv'));
  assert.match(swedish.directive, /The player reads Swedish \(sv\)/);
  assert.deepEqual(swedish.reads, []);
});

test('a world that cannot be read leaves the directive out and says so in the debug log', async () => {
  const failed = await directiveFor('en', () => { throw new Error('offline'); });
  assert.equal(failed.directive, '');
  assert.equal(failed.logged.length, 1);
  assert.match(failed.logged[0], /offline/);
});

test('callAI uses the campaign directive for the interface mode and leaves the other modes as they were', () => {
  assert.match(mainSource, /const directive = languageMode === "none" \? ""\s*: languageMode === "chat" \? chatLanguageDirective\(\)\s*: await campaignLanguageDirective\(\);/);
});
