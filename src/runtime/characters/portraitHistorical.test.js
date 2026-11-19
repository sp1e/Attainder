// The portraits of documented rulers are drawn by the game.
// Spec: docs/superpowers/specs/2026-11-19-historical-portraits-design.md (backlog row 29).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { getPortraitAsset } from './portraitAssets.js';
import historical from './portrait-historical.json' with { type: 'json' };
import atlases from './portrait-atlases.json' with { type: 'json' };
import { foreignRulerPerson, medallionOf } from '../../Game/Map/seatRulers.js';
import { PRODUCTION_MANIFEST, historicalPortraits, serialize } from '../../../scripts/build-historical-portraits.mjs';

const root = new URL('../../../', import.meta.url);
const production = JSON.parse(fs.readFileSync(new URL(PRODUCTION_MANIFEST, root), 'utf8'));
const person = (id, { ageGroup = 'adult', visualState = 'healthy', name = 'Eirene av Aten', fallback = 'person-2-4', diedAt } = {}) => ({
  id, name, ...(diedAt ? { diedAt } : {}),
  portraitState: { identityId: id, fallbackIdentityId: fallback, ageGroup, visualState, lifeStatus: diedAt ? 'deceased' : 'alive' },
});

test('the runtime manifest is the production manifest, and the files are the ones it was reviewed against', () => {
  const committed = fs.readFileSync(new URL('./portrait-historical.json', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(committed, serialize(historicalPortraits(production)), 'run node scripts/build-historical-portraits.mjs');
  assert.deepEqual(Object.keys(historical.characters), ['eirene-of-athens', 'harun-ar-rashid', 'dezong', 'aejang', 'al-hakam-i', 'ibrahim-ibn-al-aghlab', 'alfonso-ii-asturias', 'grimoald-iii-benevento']);
  for (const character of production.characters) {
    for (const file of [character.original, character.atlas]) {
      const bytes = fs.readFileSync(new URL(file.path, root));
      assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), file.sha256, file.path);
      // PNG: the picture's width and height stand in its first chunk.
      assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], [file.width, file.height], file.path);
      assert.equal(`/${file.path.replace(/^public\//, '')}`, file.src);
    }
  }
});

test('every age and state of the eight rulers is the frame the production review recorded', () => {
  let frames = 0;
  for (const character of production.characters) {
    for (const frame of character.atlas.frames) {
      const asset = getPortraitAsset(person(character.id, { ageGroup: frame.ageGroup, visualState: frame.state }));
      assert.equal(asset.sourceIdentityId, character.id);
      assert.equal(asset.usesSharedFallback, false);
      if (frame.state === 'healthy' && frame.ageGroup === character.originalAgeGroup) {
        // The original stands for the ruler as painted.
        assert.deepEqual([asset.kind, asset.src, asset.missingVariant], ['image', character.original.src, false], character.id);
      } else {
        assert.deepEqual([asset.kind, asset.src, asset.width, asset.height], ['atlas', character.atlas.src, character.atlas.width, character.atlas.height], `${character.id} ${frame.ageGroup} ${frame.state}`);
        assert.deepEqual(asset.rect, frame.rect, `${character.id} ${frame.ageGroup} ${frame.state}`);
      }
      frames += 1;
    }
  }
  assert.equal(frames, 288);
});

test('a ruler painted as a child grows into his own later pictures', () => {
  const aejang = production.characters.find((character) => character.id === 'aejang');
  assert.equal(aejang.originalAgeGroup, 'child');
  assert.equal(getPortraitAsset(person('aejang', { ageGroup: 'child', name: 'Aejang' })).src, aejang.original.src);
  const adult = getPortraitAsset(person('aejang', { ageGroup: 'adult', name: 'Aejang' }));
  assert.deepEqual([adult.kind, adult.src], ['atlas', aejang.atlas.src]);
});

test('the picture says it is an interpretation, and a shared portrait does not', () => {
  const eirene = getPortraitAsset(person('eirene-of-athens'));
  assert.equal(eirene.interpretation, true);
  assert.equal(eirene.label, 'Eirene av Aten · vuxen · utan tydliga hälsobesvär · konstnärlig tolkning');
  const memorial = getPortraitAsset(person('eirene-of-athens', { diedAt: '0803-08-09' }));
  assert.equal(memorial.label, 'Eirene av Aten · vuxen · utan tydliga hälsobesvär · minnesporträtt · konstnärlig tolkning');
  const shared = getPortraitAsset(person('byzantine-empire-born-1', { name: 'Efterträdare' }));
  assert.equal(shared.interpretation, false);
  assert.equal(shared.label, 'Efterträdare · vuxen · utan tydliga hälsobesvär');
});

test('a successor without a picture of his own shares one as before, and no ruler takes a shared identity', () => {
  const successor = getPortraitAsset(person('abd-al-rahman-ii', { name: 'Abd al-Rahman II', fallback: 'person-1-5' }));
  assert.deepEqual([successor.sourceIdentityId, successor.usesSharedFallback], ['person-1-5', true]);
  // The 24 first portraits are found as before.
  const first = getPortraitAsset({ id: 'person-0-0', name: 'Arel', portraitState: { identityId: 'person-0-0', fallbackIdentityId: 'person-0-0', ageGroup: 'adult', visualState: 'fever' } });
  assert.deepEqual([first.kind, first.src, first.interpretation], ['atlas', atlases.characters['person-0-0'].src, false]);
});

test('an entry that is not a picture of this game is not known', () => {
  const entry = historical.characters['eirene-of-athens'];
  const bad = (change) => ({ ...historical, characters: { 'eirene-of-athens': { ...entry, ...change } } });
  for (const manifest of [bad({ src: 'https://example.com/eirene.png' }), bad({ src: '/dynasties/portraits/../../secret.png' }), bad({ ageGroup: 'ancient' }), { characters: { 'person-0-0': entry } }, { characters: { 'Eirene Of Athens': entry } }, {}, null]) {
    const asset = getPortraitAsset(person('eirene-of-athens'), { historical: manifest });
    assert.equal(asset.sourceIdentityId, 'person-2-4', JSON.stringify(manifest)?.slice(0, 80));
  }
  // A broken atlas leaves the original, and says the variant is missing.
  for (const atlas of [{ ...entry.atlas, src: 'https://example.com/atlas.png' }, { ...entry.atlas, rowBounds: [0, 1] }, { ...entry.atlas, src: '/dynasties/portraits/variants/person-0-0.png' }]) {
    const asset = getPortraitAsset(person('eirene-of-athens', { visualState: 'fever' }), { historical: bad({ atlas }) });
    assert.deepEqual([asset.kind, asset.src, asset.missingVariant], ['image', entry.src, true]);
  }
  // An inset that is not a small whole number is no inset.
  const loose = getPortraitAsset(person('eirene-of-athens', { visualState: 'fever' }), { historical: bad({ atlas: { ...entry.atlas, inset: 400 } }) });
  assert.deepEqual(loose.rect, { x: 723, y: 482, width: 183, height: 242 });
});

test('a neighbouring ruler stands at the seat with the picture of that ruler', () => {
  const eirene = production.characters.find((character) => character.id === 'eirene-of-athens');
  const realm = (changes) => ({ id: 'byzantine-empire', name: 'Bysantinska riket', rulerId: 'eirene-of-athens', rulerSex: 'female', rulerName: 'Eirene av Aten', rulerAge: 48, ...changes });
  assert.deepEqual(medallionOf(foreignRulerPerson(realm()), (text) => text), { kind: 'image', src: eirene.original.src });
  // At sixty she is drawn from her own later picture, not left as initials.
  const elder = eirene.atlas.frames.find((frame) => frame.ageGroup === 'elder' && frame.state === 'healthy');
  assert.deepEqual(medallionOf(foreignRulerPerson(realm({ rulerAge: 61 })), (text) => text), { kind: 'atlas', src: eirene.atlas.src, rect: elder.rect, width: 1086, height: 1448 });
  // Her successor is somebody else.
  const next = medallionOf(foreignRulerPerson(realm({ rulerId: 'byzantine-empire-born-1', rulerSex: 'male', rulerName: 'Nikeforos', rulerAge: 45 })), (text) => text);
  assert.match(next.src, /^\/dynasties\/portraits\/(variants\/)?person-\d-5\.png$/);
});
