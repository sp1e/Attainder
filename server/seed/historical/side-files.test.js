// The builder reads the research side files of brief section 13: faith traditions and border tribes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyFaithTraditions, borderTribes } from './authored-scenarios.mjs';

const TRADITIONS = JSON.parse(readFileSync(new URL('./courts/faith-traditions.json',import.meta.url),'utf8'));
const builtScenario = id => JSON.parse(readFileSync(new URL(`./${id}/scenario.json`,import.meta.url),'utf8')).data.world.historicalScenario;
const START_OF = { 'egypt-3000bc': 'bc3000','charlemagne-800': 'ad800','john-1200': 'ad1200','world-1500': 'ad1500' };
const courts = () => ({ asturias: { religions: [{ id: 'asturian-church' }] } });
const tribeFile = (tribes,sources = {}) => ({ schema: 'attainder-border-tribes-v1',starts: { ad800: { sources,tribes } } });
const SOURCE = { title: 'T',institution: 'I',url: 'https://example.org/t',locator: 'p. 1',scopedClaim: 'C',chronology: 'Year 798.',uncertainty: 'U',license: 'Reference only',retrievedOn: '2026-11-11' };

test('every playable court the traditions file names carries its tradition in the built package', () => {
  for (const [contentId,start] of Object.entries(START_OF)) {
    const seeds = builtScenario(contentId).courtSeeds;
    for (const entry of TRADITIONS.courts.filter(e => e.start === start && Object.hasOwn(seeds,e.polityId))) {
      assert.equal(seeds[entry.polityId].religions.find(r => r.id === entry.religionId)?.tradition,entry.tradition,`${contentId} ${entry.polityId}`);
    }
  }
});

test('traditions skip courts the package does not play and refuse a religion the court lacks', () => {
  const seeds = courts();
  applyFaithTraditions('charlemagne-800',seeds,{ schema: 'attainder-faith-traditions-v1',courts: [
    { start: 'ad800',polityId: 'asturias',religionId: 'asturian-church',tradition: 'christian' },
    { start: 'ad800',polityId: 'not-played',religionId: 'x',tradition: 'other' },
    { start: 'ad1200',polityId: 'asturias',religionId: 'asturian-church',tradition: 'islamic' }] });
  assert.equal(seeds.asturias.religions[0].tradition,'christian');
  assert.throws(() => applyFaithTraditions('charlemagne-800',courts(),{ schema: 'attainder-faith-traditions-v1',courts: [{ start: 'ad800',polityId: 'asturias',religionId: 'latin-church',tradition: 'christian' }] }),/lacks/);
  assert.throws(() => applyFaithTraditions('charlemagne-800',courts(),{ schema: 'v0',courts: [] }),/unknown schema/);
  assert.doesNotThrow(() => applyFaithTraditions('charlemagne-800',courts(),null));
});

test('border tribes get their Swedish names and bring their sources in the package shape', () => {
  const sources = {};
  const tribes = borderTribes('charlemagne-800',tribeFile([{ id: 'ad800-tribe-obodrites',nameEn: 'Obodrites',coordinates: [11.4,53.9],sourceIds: ['s1'] }],{ s1: SOURCE }),sources);
  assert.deepEqual(tribes,[{ id: 'ad800-tribe-obodrites',nameSv: 'Obodriterna',coordinates: [11.4,53.9],sourceIds: ['s1'] }]);
  assert.deepEqual(sources.s1,{ title: 'T',institution: 'I',url: 'https://example.org/t',locator: 'p. 1',chronology: 'Year 798.',uncertainty: 'U',license: 'Reference only',
    retrievedAt: '2026-11-11',review: 'Research session source review for border tribes: C' });
});

test('a package without a tribe start gets none, and an unnamed tribe or a clashing source stops the build', () => {
  assert.equal(borderTribes('john-1200',tribeFile([]),{}),undefined);
  assert.equal(borderTribes('charlemagne-800',null,{}),undefined);
  assert.throws(() => borderTribes('charlemagne-800',tribeFile([{ id: 'ad800-tribe-unknown',nameEn: 'X',coordinates: [0,0],sourceIds: [] }]),{}),/no Swedish name/);
  assert.throws(() => borderTribes('charlemagne-800',tribeFile([],{ s1: SOURCE }),{ s1: { title: 'other' } }),/differs/);
  assert.throws(() => borderTribes('charlemagne-800',{ schema: 'v0',starts: { ad800: { sources: {},tribes: [] } } },{}),/unknown schema/);
});
