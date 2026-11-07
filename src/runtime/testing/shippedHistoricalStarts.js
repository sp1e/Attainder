import { HISTORICAL_BOOKMARKS } from '../historicalStarts.js';

// Test-only: the shipped historical starts, taken from the catalog so a new bookmark is covered without a test edit.
// John 1200 installs as the scenario `default`; its package folder and content id is john-1200.
const FOLDER_BY_START_ID = Object.freeze({ default: 'john-1200' });

export const SHIPPED_START_IDS = Object.freeze([...HISTORICAL_BOOKMARKS.map(({ id }) => id), 'default']);
export const startFolder = id => Object.hasOwn(FOLDER_BY_START_ID, id) ? FOLDER_BY_START_ID[id] : id;
// Folder names under server/seed/historical/, which are also each package's content id.
export const SHIPPED_START_FOLDERS = Object.freeze(SHIPPED_START_IDS.map(startFolder));
