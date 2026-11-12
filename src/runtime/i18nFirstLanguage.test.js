// Run: node --test src/runtime/i18nFirstLanguage.test.js
//
// The first-language rule (i18n.js): an install that never stored a language
// reads Swedish, English is stored as a choice like any other, and the boot
// reconcile with the server reports a change only when this device's language
// really changed. A reported change reloads the page (translator.js), so a
// server without a language, or storage that cannot be written, must never
// report one: that would reload on every boot.

import test from "node:test";
import assert from "node:assert/strict";

import { createMemoryStorage } from "../Game/AI/requestBudget.js";
import {
  DEFAULT_LANGUAGE,
  INITIAL_LANGUAGE,
  chatLanguageDiffersFromUi,
  getStoredLanguage,
  hasShippedPack,
  isRtlLanguage,
  languageDirective,
  resolveChatLanguage,
  setStoredLanguage,
  syncLanguageFromServer,
} from "./i18n.js";

const KEY = "ui_language";

// A device: its storage, and a server that answers GET /api/ui-settings with
// `settings` and remembers what is PUT.
const device = ({ stored = {}, settings = {}, storage = createMemoryStorage(stored), ok = true } = {}) => {
  const requests = [];
  const server = { settings: { ...settings } };
  globalThis.localStorage = storage;
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? "GET";
    requests.push({ url, method, body: init.body ? JSON.parse(init.body) : undefined });
    if (method === "PUT") {
      // As server.js and web/settingsStore.js do: a string of 16 characters or fewer.
      const language = JSON.parse(init.body).language;
      if (typeof language === "string" && language.trim().length <= 16) server.settings.language = language.trim();
    }
    return { ok, json: async () => ({ ...server.settings }) };
  };
  return { requests, server, storage };
};

const blockedStorage = () => {
  const refuse = () => { throw new Error("storage is blocked"); };
  return { getItem: refuse, setItem: refuse, removeItem: refuse };
};

test("an install that never stored a language reads Swedish", () => {
  device();
  assert.equal(INITIAL_LANGUAGE, "sv");
  assert.equal(getStoredLanguage(), "sv");
  assert.equal(DEFAULT_LANGUAGE, "en", "the upstream source text is still English");
});

test("a stored code is read as stored, trimmed, and an empty one counts as none", () => {
  device({ stored: { [KEY]: " de " } });
  assert.equal(getStoredLanguage(), "de");
  device({ stored: { [KEY]: "   " } });
  assert.equal(getStoredLanguage(), "sv");
});

test("English is stored as en, sent to the server as en, and read back as en", async () => {
  const { requests, server, storage } = device();
  await setStoredLanguage("en");
  assert.equal(storage.getItem(KEY), "en");
  assert.equal(getStoredLanguage(), "en");
  assert.deepEqual(requests, [{ url: "/api/ui-settings", method: "PUT", body: { language: "en" } }]);
  assert.equal(server.settings.language, "en");
  // Picking it again changes nothing, and the next boot finds both in step.
  await setStoredLanguage("en");
  assert.equal(getStoredLanguage(), "en");
  assert.equal(await syncLanguageFromServer(), false);
  assert.equal(getStoredLanguage(), "en");
});

test("every other code is stored and sent as given", async () => {
  const { requests, storage } = device({ stored: { [KEY]: "en" } });
  await setStoredLanguage("sv");
  assert.equal(storage.getItem(KEY), "sv");
  assert.deepEqual(requests.at(-1).body, { language: "sv" });
  await setStoredLanguage("de");
  assert.equal(getStoredLanguage(), "de");
  assert.deepEqual(requests.at(-1).body, { language: "de" });
});

test("a server without a stored language has no opinion: nothing changes, no change is reported", async () => {
  const fresh = device({ settings: {} });
  assert.equal(await syncLanguageFromServer(), false);
  assert.equal(fresh.storage.getItem(KEY), null);
  assert.equal(getStoredLanguage(), "sv");

  const german = device({ stored: { [KEY]: "de" }, settings: {} });
  assert.equal(await syncLanguageFromServer(), false);
  assert.equal(german.storage.getItem(KEY), "de", "the device keeps its own choice");

  const english = device({ stored: { [KEY]: "en" }, settings: { language: "  " } });
  assert.equal(await syncLanguageFromServer(), false);
  assert.equal(english.storage.getItem(KEY), "en");
});

test("a server that stored en moves a device with nothing stored to English once, and then reports nothing", async () => {
  const { storage } = device({ settings: { language: "en" } });
  assert.equal(getStoredLanguage(), "sv");
  assert.equal(await syncLanguageFromServer(), true);
  assert.equal(storage.getItem(KEY), "en");
  assert.equal(getStoredLanguage(), "en");
  assert.equal(await syncLanguageFromServer(), false);
  assert.equal(await syncLanguageFromServer(), false);
});

test("the server's choice wins over a different stored one, once", async () => {
  const { storage } = device({ stored: { [KEY]: "en" }, settings: { language: "de" } });
  assert.equal(await syncLanguageFromServer(), true);
  assert.equal(storage.getItem(KEY), "de");
  assert.equal(await syncLanguageFromServer(), false);
});

test("a server that says what the device already reads reports no change and writes nothing", async () => {
  const { storage } = device({ settings: { language: "sv" } });
  assert.equal(await syncLanguageFromServer(), false);
  assert.equal(storage.getItem(KEY), null);
});

test("storage that throws reads Swedish and never reports a change", async () => {
  const { server } = device({ storage: blockedStorage(), settings: { language: "en" } });
  assert.equal(getStoredLanguage(), "sv");
  assert.equal(await syncLanguageFromServer(), false);
  assert.equal(await syncLanguageFromServer(), false, "nor on the next boot");
  // The picker still tells the server, and still nothing here claims a change.
  await setStoredLanguage("de");
  assert.equal(server.settings.language, "de");
  assert.equal(getStoredLanguage(), "sv");
  assert.equal(await syncLanguageFromServer(), false);
});

test("storage that takes a write and does not give it back reports no change", async () => {
  const forgetful = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  device({ storage: forgetful, settings: { language: "en" } });
  assert.equal(await syncLanguageFromServer(), false);
});

test("a code the game does not know, or a value that is not text, is no opinion", async () => {
  for (const language of ["xx", "english", 7, null, ["en"], "en-GB-oxendict-long"]) {
    const { storage } = device({ settings: { language } });
    assert.equal(await syncLanguageFromServer(), false, JSON.stringify(language));
    assert.equal(storage.getItem(KEY), null);
  }
});

test("a server that fails or cannot be reached changes nothing", async () => {
  const failing = device({ settings: { language: "en" }, ok: false });
  assert.equal(await syncLanguageFromServer(), false);
  assert.equal(failing.storage.getItem(KEY), null);

  const offline = device();
  globalThis.fetch = async () => { throw new Error("offline"); };
  assert.equal(await syncLanguageFromServer(), false);
  await setStoredLanguage("en");
  assert.equal(offline.storage.getItem(KEY), "en", "the local copy still applies");
});

test("the readers of the stored language follow it, unset and with an explicit en", () => {
  device();
  assert.match(languageDirective(), /The player reads Swedish \(sv\)/);
  assert.equal(resolveChatLanguage(), "sv", "the chats follow the interface");
  assert.equal(chatLanguageDiffersFromUi(), false);
  assert.equal(hasShippedPack(getStoredLanguage()), true);
  assert.equal(isRtlLanguage(getStoredLanguage()), false);

  device({ stored: { [KEY]: "en" } });
  assert.equal(languageDirective(), "", "English is the language the prompts are written in");
  assert.match(languageDirective(undefined, { force: true }), /The player reads English \(en\)/);
  assert.equal(resolveChatLanguage(), "en");
  assert.equal(chatLanguageDiffersFromUi(), false);
  assert.equal(hasShippedPack(getStoredLanguage()), false);
});
