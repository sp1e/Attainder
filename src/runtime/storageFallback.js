// A stand-in for the browser's storage when it is blocked.
// Spec: docs/superpowers/specs/2026-11-18-english-first-design.md (ruling 8, backlog row 31).
//
// With site data blocked, reading `localStorage` throws. The game reads it in some fifty places, many of them while
// a view is drawn, so the whole world view stopped with "storage is blocked" before a player saw anything. Imported
// first by src/main.jsx: where a storage cannot be written, it is replaced for this page by one kept in memory.
// What is put there lasts until the page is left; `ohVolatile` says so, and a reader that needs a value to
// outlive a reload (the language, src/runtime/i18n.js) asks.

export const createVolatileStorage = () => {
  const values = new Map();
  const storage = {
    getItem: (key) => (values.has(String(key)) ? values.get(String(key)) : null),
    setItem: (key, value) => { values.set(String(key), String(value)); },
    removeItem: (key) => { values.delete(String(key)); },
    clear: () => { values.clear(); },
    key: (index) => [...values.keys()][index] ?? null,
  };
  Object.defineProperty(storage, "length", { get: () => values.size });
  Object.defineProperty(storage, "ohVolatile", { value: true });
  return storage;
};

// A storage that is full refuses a write and still holds what the player stored: it is not blocked.
const isQuotaError = (error) =>
  error?.name === "QuotaExceededError" || error?.name === "NS_ERROR_DOM_QUOTA_REACHED" || error?.code === 22 || error?.code === 1014;

// True when the storage can be used: a value can be written and taken away again, or the storage is only full
// and can still be read.
const usable = (target, name) => {
  const probe = "oh:storage-probe";
  try {
    const storage = target[name];
    if (!storage) return false;
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return true;
  } catch (error) {
    if (!isQuotaError(error)) return false;
    try {
      target[name].getItem(probe);
      return true;
    } catch {
      return false;
    }
  }
};

// Replaces each storage of `target` that cannot be used. Returns the names it replaced.
export const installStorageFallback = (target) => {
  const replaced = [];
  for (const name of ["localStorage", "sessionStorage"]) {
    if (usable(target, name)) continue;
    try {
      Object.defineProperty(target, name, { value: createVolatileStorage(), configurable: true, writable: true });
      replaced.push(name);
    } catch {
      // The page cannot replace it: the game is as it was before this module.
    }
  }
  return replaced;
};

// Whether what is stored on this device is gone at the next reload.
export const storageIsVolatile = () => {
  try {
    return typeof localStorage !== "undefined" && localStorage?.ohVolatile === true;
  } catch {
    return false;
  }
};

if (typeof window !== "undefined") {
  const replaced = installStorageFallback(window);
  if (replaced.length) {
    console.warn(`[storage] ${replaced.join(" and ")} cannot be written on this device; settings last until the page is left.`);
  }
}
