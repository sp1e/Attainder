// Run: node --test src/runtime/i18nFirstLanguage.test.js
//
// The first-language rule (i18n.js): a device that never stored a language
// reads English, Swedish is a choice like any other, where there is no storage
// at all the Swedish source is read, and the boot
// reconcile with the server reports a change only when this device's language
// really changed. A reported change reloads the page (translator.js), so a
// server without a language, or storage that cannot be written, must never
// report one: that would reload on every boot.

import test from "node:test";
import assert from "node:assert/strict";

import { createMemoryStorage } from "../Game/AI/requestBudget.js";
import { createVolatileStorage } from "./storageFallback.js";
import {
  DEFAULT_LANGUAGE,
  INITIAL_LANGUAGE,
  SOURCE_LANGUAGE,
  chatLanguageDiffersFromUi,
  enterLanguage,
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
  // A device starts without an address; address() gives it one.
  delete globalThis.location;
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

test("without any storage the Swedish source is read: nothing was chosen and nothing can be translated", () => {
  // First, before any test installs a device: bare node has no localStorage.
  assert.equal(typeof globalThis.localStorage, "undefined");
  assert.equal(SOURCE_LANGUAGE, "sv");
  assert.equal(getStoredLanguage(), "sv");
});

test("a device that never stored a language reads English", () => {
  device();
  assert.equal(INITIAL_LANGUAGE, "en");
  assert.equal(getStoredLanguage(), "en");
  assert.equal(DEFAULT_LANGUAGE, "en", "the upstream source text is English too");
});

test("a stored code is read as stored, trimmed, and an empty one counts as none", () => {
  device({ stored: { [KEY]: " de " } });
  assert.equal(getStoredLanguage(), "de");
  device({ stored: { [KEY]: "   " } });
  assert.equal(getStoredLanguage(), "en");
});

test("Swedish is a choice: stored as sv, sent to the server as sv, and read back as sv", async () => {
  const { requests, server, storage } = device();
  await setStoredLanguage("sv");
  assert.equal(storage.getItem(KEY), "sv");
  assert.equal(getStoredLanguage(), "sv");
  assert.deepEqual(requests, [{ url: "/api/ui-settings", method: "PUT", body: { language: "sv" } }]);
  assert.equal(server.settings.language, "sv");
  // Picking it again changes nothing, and the next boot finds both in step.
  await setStoredLanguage("sv");
  assert.equal(getStoredLanguage(), "sv");
  assert.equal(await syncLanguageFromServer(), false);
  assert.equal(getStoredLanguage(), "sv");
});

test("English is stored as en when it is picked, like any other code", async () => {
  const { requests, storage } = device({ stored: { [KEY]: "sv" } });
  await setStoredLanguage("en");
  assert.equal(storage.getItem(KEY), "en");
  assert.equal(getStoredLanguage(), "en");
  assert.deepEqual(requests.at(-1).body, { language: "en" });
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
  assert.equal(getStoredLanguage(), "en");

  const german = device({ stored: { [KEY]: "de" }, settings: {} });
  assert.equal(await syncLanguageFromServer(), false);
  assert.equal(german.storage.getItem(KEY), "de", "the device keeps its own choice");

  const english = device({ stored: { [KEY]: "en" }, settings: { language: "  " } });
  assert.equal(await syncLanguageFromServer(), false);
  assert.equal(english.storage.getItem(KEY), "en");
});

test("a server that stored sv moves a device with nothing stored to Swedish once, and then reports nothing", async () => {
  // The player chose Swedish on another device of this server: the choice is kept.
  const { storage } = device({ settings: { language: "sv" } });
  assert.equal(getStoredLanguage(), "en");
  assert.equal(await syncLanguageFromServer(), true);
  assert.equal(storage.getItem(KEY), "sv");
  assert.equal(getStoredLanguage(), "sv");
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
  const { storage } = device({ settings: { language: "en" } });
  assert.equal(await syncLanguageFromServer(), false);
  assert.equal(storage.getItem(KEY), null);
});

test("storage that throws reads English and never reports a change", async () => {
  const { server } = device({ storage: blockedStorage(), settings: { language: "sv" } });
  assert.equal(getStoredLanguage(), "en");
  assert.equal(await syncLanguageFromServer(), false);
  assert.equal(await syncLanguageFromServer(), false, "nor on the next boot");
  // The picker still tells the server, and still nothing here claims a change.
  await setStoredLanguage("de");
  assert.equal(server.settings.language, "de");
  assert.equal(getStoredLanguage(), "en");
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

test("the readers of the stored language follow it: Swedish chosen, unset, and an explicit en", () => {
  device({ stored: { [KEY]: "sv" } });
  assert.match(languageDirective(), /The player reads Swedish \(sv\)/);
  assert.equal(resolveChatLanguage(), "sv", "the chats follow the interface");
  assert.equal(chatLanguageDiffersFromUi(), false);
  assert.equal(hasShippedPack(getStoredLanguage()), true);
  assert.equal(isRtlLanguage(getStoredLanguage()), false);

  device();
  assert.equal(languageDirective(), "", "a device with nothing stored reads English, the language the prompts are written in");
  assert.equal(resolveChatLanguage(), "en");
  assert.equal(hasShippedPack(getStoredLanguage()), false);

  device({ stored: { [KEY]: "en" } });
  assert.equal(languageDirective(), "", "English is the language the prompts are written in");
  assert.match(languageDirective(undefined, { force: true }), /The player reads English \(en\)/);
  assert.equal(resolveChatLanguage(), "en");
  assert.equal(chatLanguageDiffersFromUi(), false);
  assert.equal(hasShippedPack(getStoredLanguage()), false);
});

// Backlog row 31: a device whose storage cannot hold the choice carries it in the address (`?lang=sv`).
const address = (href) => {
  const visited = [];
  globalThis.location = {
    href,
    get search() { return new URL(this.href).search; },
    replace(next) { visited.push(next); this.href = next; },
    reload() { visited.push("reload"); },
  };
  return visited;
};

test("the address names the language when this device has nothing readable stored", () => {
  device({ storage: blockedStorage() });
  address("http://127.0.0.1:4167/?lang=sv");
  assert.equal(getStoredLanguage(), "sv");
  address("http://127.0.0.1:4167/?seed=7&lang=%20sv%20#start");
  assert.equal(getStoredLanguage(), "sv", "trimmed, among other parameters");
  for (const href of ["http://127.0.0.1:4167/", "http://127.0.0.1:4167/?lang=", "http://127.0.0.1:4167/?lang=xx", "http://127.0.0.1:4167/?language=sv"]) {
    address(href);
    assert.equal(getStoredLanguage(), "en", href);
  }
  // A stored choice wins over the address.
  device({ stored: { [KEY]: "en" } });
  address("http://127.0.0.1:4167/?lang=sv");
  assert.equal(getStoredLanguage(), "en");
  // A fresh device with working storage follows a link for that visit, and stores nothing.
  const fresh = device();
  address("http://127.0.0.1:4167/?lang=sv");
  assert.equal(getStoredLanguage(), "sv");
  assert.equal(fresh.storage.getItem(KEY), null);
});

test("setStoredLanguage says whether this device holds the choice", async () => {
  device();
  assert.equal(await setStoredLanguage("sv"), true);
  const blocked = device({ storage: blockedStorage() });
  assert.equal(await setStoredLanguage("sv"), false);
  assert.equal(blocked.server.settings.language, "sv", "the server still gets it");
});

test("entering a language reloads a device that holds it and re-addresses one that cannot", async () => {
  device();
  let visited = address("http://127.0.0.1:4167/?seed=7");
  await enterLanguage("sv");
  assert.deepEqual(visited, ["reload"]);
  assert.equal(getStoredLanguage(), "sv");

  const blocked = device({ storage: blockedStorage() });
  visited = address("http://127.0.0.1:4167/play/?seed=7#start");
  await enterLanguage("sv");
  assert.deepEqual(visited, ["http://127.0.0.1:4167/play/?seed=7&lang=sv#start"], "the same page, with the language named");
  assert.equal(getStoredLanguage(), "sv");
  assert.equal(blocked.server.settings.language, "sv");
  // And back: the parameter is replaced, not added twice.
  await enterLanguage("en");
  assert.equal(visited.at(-1), "http://127.0.0.1:4167/play/?seed=7&lang=en#start");
  assert.equal(getStoredLanguage(), "en");
});

test("a device with blocked storage follows the server's language through the address, once", async () => {
  device({ storage: blockedStorage(), settings: { language: "sv" } });
  const visited = address("http://127.0.0.1:4167/");
  assert.equal(getStoredLanguage(), "en");
  assert.equal(await syncLanguageFromServer(), false, "the navigation is the reload; the caller does not reload again");
  assert.deepEqual(visited, ["http://127.0.0.1:4167/?lang=sv"]);
  assert.equal(getStoredLanguage(), "sv");
  assert.equal(await syncLanguageFromServer(), false);
  assert.deepEqual(visited, ["http://127.0.0.1:4167/?lang=sv"], "no second navigation: the page would never settle");
});

test("a device on the in-memory stand-in does not count as holding the choice", async () => {
  // storageFallback.js replaces a blocked storage for the page: a value reads back now and is gone at the reload.
  const volatile = device({ storage: createVolatileStorage() });
  const visited = address("http://127.0.0.1:4167/");
  assert.equal(await setStoredLanguage("sv"), false);
  assert.equal(getStoredLanguage(), "sv", "this page reads it");
  await enterLanguage("sv");
  assert.deepEqual(visited, ["http://127.0.0.1:4167/?lang=sv"], "and the reload is carried by the address");
  assert.equal(volatile.server.settings.language, "sv");
  // After the reload the stand-in is empty and the address speaks.
  device({ storage: createVolatileStorage(), settings: { language: "sv" } });
  address("http://127.0.0.1:4167/?lang=sv");
  assert.equal(getStoredLanguage(), "sv");
  assert.equal(await syncLanguageFromServer(), false, "nothing more to do");
});
