import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignPromptLanguage, characterLanguage, characterLanguageCode, dataLanguageClause, isCharacterCampaign } from './characterLanguage.js';
import { buildCharacterPromptContext } from './characterWorld.js';
import { englishNameData, englishNames, viewNames, withEnglishNames } from './englishNames.js';
import { readFileSync } from 'node:fs';
import { createCharacterSystem, getCharacterPresentation } from './characters/index.js';
import { createHistoricalCharacterSystem } from './characters/scenarioSeed.js';
import { addGameMonths } from './gameDates.js';

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
  assert.deepEqual(englishNameData(['Karl', 'Ludvig'], 'English', reader, { ruler: 'Karl' }), { englishNames: { Karl: 'Charles' } }, 'within keeps the names the data holds');
  assert.deepEqual(englishNameData(['Ludvig'], 'English', reader, 'Karl spoke'), {}, 'a name outside the text stays out');
});

test('a prompt gets the map last, with the names its own data holds, and no map in Swedish', () => {
  const reader = (name) => ({ Karl: 'Charles', Ludvig: 'Louis' })[name] ?? name;
  const data = withEnglishNames({ ruler: 'Karl', heir: 'Odo' }, ['Ludvig', 'Karl', 'Odo'], 'English', reader);
  assert.deepEqual(data, { ruler: 'Karl', heir: 'Odo', englishNames: { Karl: 'Charles' } });
  assert.equal(Object.keys(data).at(-1), 'englishNames');
  assert.deepEqual(withEnglishNames({ ruler: 'Karl' }, ['Karl'], 'Swedish', reader), { ruler: 'Karl' });
});

test('a view gives every name it may show, then the extra names', () => {
  const view = { people: [{ name: 'Karl' }, {}], families: [{ name: 'Karolingerna', hostPolityName: 'Bysans' }], identity: { realmName: 'Karls rike' },
    cities: [{ name: 'Aachen' }], religions: [{ name: 'Kristendom' }], tribes: [{ name: 'Sorber' }],
    foreignRealms: [{ name: 'Córdoba', seatName: 'Córdoba stad', rulerName: 'al-Hakam I', heirName: 'Abd al-Rahman', faithName: 'Islam' }] };
  assert.deepEqual(viewNames(view, ['Ansgar']), ['Karl', undefined, undefined, undefined, 'Karolingerna', 'Bysans', 'Karls rike', 'Aachen', 'Kristendom', 'Sorber',
    'Córdoba', 'Córdoba stad', 'al-Hakam I', 'Abd al-Rahman', 'Islam', 'Ansgar']);
  assert.deepEqual(viewNames(undefined), [undefined]);
});

test('a house that has left the families view keeps its English reading through its dead members', () => {
  const reader = (name) => ({ 'Hovhus 1 (genererat)': 'Court house 1 (generated)' })[name] ?? name;
  const view = { people: [{ name: 'Odo', familyName: 'Hovhus 1 (genererat)' }], families: [], cities: [] };
  assert.deepEqual(englishNameData(viewNames(view), 'English', reader, { people: view.people }),
    { englishNames: { 'Hovhus 1 (genererat)': 'Court house 1 (generated)' } });
});

test('the year prompt ends with the names the player reads in English and has none in Swedish', () => {
  const state = createCharacterSystem({ seed: 321 });
  const readName = (name) => `${name} (en)`;
  const lines = buildCharacterPromptContext(state, { language: 'English', readName }).split('\n');
  const data = JSON.parse(lines.find((line) => line.startsWith('{"date"')));
  const { englishNames: names } = JSON.parse(lines.at(-1));
  assert.equal(names[data.representative.name], `${data.representative.name} (en)`);
  const rest = lines.slice(0, -1).join('\n');
  for (const name of Object.keys(names)) assert.ok(rest.includes(JSON.stringify(name).slice(1, -1)), `${name} is in the prompt`);
  assert.doesNotMatch(buildCharacterPromptContext(state, { language: 'Swedish', readName }), /"englishNames"/);
});

test('the year prompt names a foreign marriage candidate in English, with and without a forecast', () => {
  const data = JSON.parse(readFileSync(new URL('../../server/seed/historical/charlemagne-800/scenario.json', import.meta.url), 'utf8')).data;
  const state = createHistoricalCharacterSystem({ historicalScenario: JSON.parse(JSON.stringify(data.world.historicalScenario)), date: data.game.startDate, polityId: 'carolingian-realm', mode: 'realm', seed: 777 });
  const cordoba = state.foreignRealms.find((realm) => realm.id === 'emirate-of-cordoba');
  cordoba.people['test-bride'] = { id: 'test-bride', name: 'Prova bint al-Hakam', sex: 'female', bornAt: '0782-03-01', diedAt: null, parentIds: ['al-hakam-i'], spouseIds: [], origin: 'documented' };
  const readName = (name) => `${name} (en)`;
  for (const targetDate of [undefined, addGameMonths(state.date, 12)]) {
    const prompt = buildCharacterPromptContext(state, { language: 'English', readName, targetDate });
    assert.match(prompt, /Prova bint al-Hakam, 18 år/, 'the marriage option is in the prompt');
    assert.equal(JSON.parse(prompt.split('\n').at(-1)).englishNames['Prova bint al-Hakam'], 'Prova bint al-Hakam (en)', String(targetDate));
  }
  assert.doesNotMatch(buildCharacterPromptContext(state, { language: 'Swedish', readName }), /"englishNames"/);
});

test('the year prompt names the people of the forecast and a hosting polity in English', () => {
  const state = createCharacterSystem({ seed: 321 });
  state.externalHosts = [{ id: 'Z-host', name: 'Värdriket', opinion: 10, admissionCost: 20, refugeThreshold: 30 }];
  const readName = (name) => `${name} (en)`;
  const now = new Set(viewNames(getCharacterPresentation(state)));
  const lines = buildCharacterPromptContext(state, { language: 'English', readName, targetDate: addGameMonths(state.date, 12) }).split('\n');
  const { englishNames: names } = JSON.parse(lines.at(-1));
  assert.equal(names['Värdriket'], 'Värdriket (en)', 'the host polity');
  const later = Object.keys(names).filter((name) => !now.has(name) && name !== 'Värdriket');
  assert.ok(later.length > 0, 'the forecast names someone the court does not show yet');
  for (const name of later) assert.ok(lines.at(-2).includes(name), `${name} comes from the forecast`);
  const withoutForecast = JSON.parse(buildCharacterPromptContext(state, { language: 'English', readName }).split('\n').at(-1)).englishNames;
  for (const name of later) assert.equal(withoutForecast[name], undefined, `${name} needs the forecast`);
});

test('the character views write numbers with a decimal point in English and a comma in Swedish', async () => {
  const { characterNumberLocale } = await import('./characterLanguage.js');
  assert.equal(characterNumberLocale('en'), 'en-GB');
  assert.equal(characterNumberLocale('sv'), 'sv-SE');
  assert.equal(characterNumberLocale('de'), 'sv-SE', 'another language keeps the Swedish court text and its numbers');
  assert.equal(new Intl.NumberFormat(characterNumberLocale('en'), { maximumFractionDigits: 1 }).format(56.84), '56.8');
});
