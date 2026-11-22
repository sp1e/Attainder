// A price as the panel and the court write it: its cost, then its stress, each in an element of its own between
// separators. The page's dictionary reads an element's text as one run, and a run it reads only in part is never
// read again piece by piece: a cost of "10 silver ur ämbetets budget · 1 handling" beside a stress of
// "Tjänst: 0 · Klienter: 28" kept half its words in Swedish in English mode.
import React from "react";

/** The parts of a price that have text, in elements of their own; nothing when none has. */
export function PriceParts({ parts }) {
  return parts.filter(Boolean).map((part, index) => React.createElement(React.Fragment, { key: index },
    index > 0 ? " · " : null,
    React.createElement("span", null, part)));
}
