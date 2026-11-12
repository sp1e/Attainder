import test from 'node:test';
import assert from 'node:assert/strict';
import { nameInitials } from './nameInitials.js';

const same = (name) => name;

test('initials come from the first two words of the name', () => {
  assert.equal(nameInitials('Karl den yngre', same), 'Kd');
  assert.equal(nameInitials('Theodrada', same), 'T');
});

test('a parenthesised epithet or label gives no initial', () => {
  assert.equal(nameInitials('Odo (genererad)', same), 'O');
  assert.equal(nameInitials('Karl (Karl den store)', same), 'K');
  assert.equal(nameInitials('(okänd)', same), '?');
});

test('the initials follow the name the player reads', () => {
  const reader = (name) => ({ 'Karl (Karl den store)': 'Charles (Charlemagne)', Karolingerna: 'Carolingians' })[name] ?? name;
  assert.equal(nameInitials('Karl (Karl den store)', reader), 'C');
  assert.equal(nameInitials('Karolingerna', reader), 'C');
  assert.equal(nameInitials('Odo (genererad)', reader), 'O');
});

test('a leading English article gives no initial and a number takes the second place', () => {
  assert.equal(nameInitials('Court house 2 (generated)', same), 'C2');
  assert.equal(nameInitials('The royal house', same), 'Rh');
  assert.equal(nameInitials('Hovhus 1 (genererat)', same), 'H1');
  assert.equal(nameInitials('The', same), 'T', 'an article alone is the name');
});

test('a cadet branch keeps initials of its own, apart from its numbered parent house', () => {
  assert.equal(nameInitials('Child person-193’s branch of Court house 5', same), 'Cp');
  assert.equal(nameInitials('Court house 5 (generated)', same), 'C5');
  assert.equal(nameInitials('Barn person-193:s gren av Hovhus 5', same), 'Bp');
  assert.equal(nameInitials('Hovhus 5 (genererat)', same), 'H5');
});

test('the first initial is a capital letter', () => {
  assert.equal(nameInitials('al-Hakam I', same), 'AI');
  assert.equal(nameInitials('karl den yngre', same), 'Kd');
});

test('a missing name or reading gives a question mark or falls back to the name', () => {
  assert.equal(nameInitials('', same), '?');
  assert.equal(nameInitials(null, same), '?');
  assert.equal(nameInitials('Pippin', () => undefined), 'P');
});
