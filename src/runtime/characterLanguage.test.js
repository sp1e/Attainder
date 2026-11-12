import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignPromptLanguage, characterLanguage, characterLanguageCode, dataLanguageClause, isCharacterCampaign } from './characterLanguage.js';
import { buildCharacterPromptContext } from './characterWorld.js';
import { englishNameData, englishNames, viewNames } from './englishNames.js';
import { createCharacterSystem } from './characters/index.js';

// Every call names its language or its code, so no test reads the stored Options choice.

test('English in Options gives English; Swedish and every other choice give Swedish', () => {
  assert.equal(characterLanguage('en'), 'English');
  assert.equal(characterLanguageCode('en'), 'en');
  for (const code of ['sv', 'de', 'fr', 'zh', '']) {
    assert.equal(characterLanguage(code), 'Swedish', code);
    assert.equal(characterLanguageCode(code), 'sv', code);
  }
});

test('the data clause says the data is Swedish and holds every sentence to the named language', () => {
  const clause = dataLanguageClause('English');
  assert.match(clause, /^The campaign data is written in Swedish\./);
  assert.match(clause, /Write every sentence of your answer in English, whatever language the data or the player's text is in\./);
  assert.match(clause, /ids, keys and option values exactly as given/);
  assert.equal(clause.match(/Swedish/g).length, 1, 'Swedish is named once, as the language of the data');
  assert.doesNotMatch(clause, /[\r\n]/);
});

test('Swedish needs no data clause: data and answer share one language', () => {
  assert.equal(dataLanguageClause('Swedish'), '');
});

test('a character campaign is a world with a character system', () => {
  assert.equal(isCharacterCampaign({ characterSystem: { revision: 0 } }), true);
  for (const world of [{}, { historicalScenario: { kind: 'historical' } }, { characterSystem: null }, null, undefined]) assert.equal(isCharacterCampaign(world), false);
});

test('a character campaign follows the Options language over its stamp; any other campaign keeps its own', () => {
  const dynasty = { characterSystem: { revision: 0 }, language: 'Svenska' };
  assert.equal(campaignPromptLanguage(dynasty, { language: 'Svenska' }, 'English'), 'English');
  assert.equal(campaignPromptLanguage(dynasty, { language: 'Svenska' }, 'Swedish'), 'Swedish');
  assert.equal(campaignPromptLanguage({ language: 'French' }, { language: 'German' }, 'English'), 'French');
  assert.equal(campaignPromptLanguage({}, { language: 'German' }, 'English'), 'German');
  assert.equal(campaignPromptLanguage({}, {}, 'Swedish'), 'English');
  assert.equal(campaignPromptLanguage(undefined, undefined, 'Swedish'), 'English');
});

test('the simulation rules ask for the proposal reason in the named language', () => {
  const state = createCharacterSystem({ seed: 321 });
  const english = buildCharacterPromptContext(state, { language: 'English' });
  assert.match(english, /reason is a English sentence of at most 200 characters\./);
  assert.ok(english.includes(dataLanguageClause('English')), 'the data clause is in the block');
  assert.doesNotMatch(english.replace(dataLanguageClause('English'), ''), /Swedish/, 'English mode asks for no Swedish');
  const swedish = buildCharacterPromptContext(state, { language: 'Swedish' });
  assert.match(swedish, /reason is a Swedish sentence of at most 200 characters\./);
  assert.doesNotMatch(swedish, /The campaign data is written in Swedish/);
  assert.equal(swedish.replace('reason is a Swedish sentence', 'reason is a English sentence'), english.replace(`${dataLanguageClause('English')}\n`, ''),
    'the language name and the clause are the only differences');
});

test('the English name map lists each name the reader changes, once, and nothing in Swedish', () => {
  const reader = (name) => ({ Karl: 'Charles', Ludvig: 'Louis' })[name] ?? name;
  assert.deepEqual(englishNames(['Karl', 'Ludvig', 'Karl', 'Odo', '', '  ', null, 7], 'English', reader), { Karl: 'Charles', Ludvig: 'Louis' });
  assert.deepEqual(englishNames(['Karl', 'Ludvig'], 'Swedish', reader), {});
  assert.deepEqual(englishNames(['Karl'], 'English', () => '  '), {}, 'an empty reading is no reading');
  assert.deepEqual(englishNameData(['Odo'], 'English', reader), {}, 'no entry gives no key');
  assert.deepEqual(englishNameData(['Karl'], 'English', reader), { englishNames: { Karl: 'Charles' } });
});

test('a view gives its people, families and realm, then the extra names', () => {
  const view = { people: [{ name: 'Karl' }, {}], families: [{ name: 'Karolingerna' }], identity: { realmName: 'Karls rike' } };
  assert.deepEqual(viewNames(view, ['Ansgar']), ['Karl', undefined, 'Karolingerna', 'Karls rike', 'Ansgar']);
  assert.deepEqual(viewNames(undefined), [undefined]);
});

test('the year prompt gives the names the player reads in English and none in Swedish', () => {
  const state = createCharacterSystem({ seed: 321 });
  const readName = (name) => `${name} (en)`;
  const dataOf = (block) => JSON.parse(block.split('\n').find((line) => line.startsWith('{"date"')));
  const english = dataOf(buildCharacterPromptContext(state, { language: 'English', readName }));
  assert.equal(english.englishNames[english.representative.name], `${english.representative.name} (en)`);
  assert.equal(dataOf(buildCharacterPromptContext(state, { language: 'Swedish', readName })).englishNames, undefined);
});

test('the character views write numbers with a decimal point in English and a comma in Swedish', async () => {
  const { characterNumberLocale } = await import('./characterLanguage.js');
  assert.equal(characterNumberLocale('en'), 'en-GB');
  assert.equal(characterNumberLocale('sv'), 'sv-SE');
  assert.equal(characterNumberLocale('de'), 'sv-SE', 'another language keeps the Swedish court text and its numbers');
  assert.equal(new Intl.NumberFormat(characterNumberLocale('en'), { maximumFractionDigits: 1 }).format(56.84), '56.8');
});
