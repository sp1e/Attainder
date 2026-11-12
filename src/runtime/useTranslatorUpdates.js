import { useEffect, useState } from 'react';
import { nativeReading } from './translator.js';

// Draws a component again when the page translator announces new translations ("i18n:updated", as the map's labels
// listen for), and returns how many announcements it has seen. In English mode the native book can arrive after the
// component is on screen, and text it builds with the book (a search over the start rows, a name inside an
// accessible label) needs the book's readings.
export const useTranslatorUpdates = () => {
  const [updates, setUpdates] = useState(0);
  useEffect(() => {
    const onUpdated = () => setUpdates(count => count + 1);
    window.addEventListener('i18n:updated', onUpdated);
    return () => window.removeEventListener('i18n:updated', onUpdated);
  }, []);
  return updates;
};

// The native book's reading of `text`. `updates` is the count from useTranslatorUpdates. The build's React Compiler
// keeps a call's result until one of its arguments changes, so the count goes in as an argument: without it a
// component drawn before the book arrived keeps the Swedish text after the announcement.
export const readNative = (text, updates) => {
  void updates;
  return nativeReading(text);
};
