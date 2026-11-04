import test from "node:test";
import assert from "node:assert/strict";
import { CONTROL_CHANGE_LANGUAGE, LEGAL_TRANSFER_LANGUAGE } from "./territoryLanguage.js";

test("Swedish soldiers' pay is no sale of territory", () => {
  assert.equal(LEGAL_TRANSFER_LANGUAGE.test("Soldaterna vid Narim kräver sin sold innan mönstringen."), false);
  assert.equal(LEGAL_TRANSFER_LANGUAGE.test("Kelan Namar lovar veteranerna full sold."), false);
});

test("English settlement language still counts as a legal transfer", () => {
  for (const text of ["Rome sold to Carthage the whole coast", "The duke ceded Narim", "Hadara annexed the valley", "a formal transfer of the march"]) {
    assert.equal(LEGAL_TRANSFER_LANGUAGE.test(text), true, text);
  }
});

test("capture language keeps its word boundaries", () => {
  assert.equal(CONTROL_CHANGE_LANGUAGE.test("The garrison captured Narim"), true);
  assert.equal(CONTROL_CHANGE_LANGUAGE.test("The envoy was preoccupied"), false);
});
