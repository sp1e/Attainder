// What the page's dictionary leaves of a React element's text in English mode, the way runtime/translator.js reads
// the DOM: an element whose children are two or more text nodes is read as one run, and only when the run has no
// reading at all is each piece read alone (visitRun); any other text node is read on its own (visitPiece). A run the
// book reads in part keeps the rest of it in Swedish, which is what a check with this helper looks for.
//
// Function components are called, so their hooks must come from a stubbed react. Text under data-no-translate is
// left as it is, as the page leaves it.
import React from "react";
import { translateInTier } from "../../runtime/translatorMode.js";

const readValue = (book, value) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const translated = translateInTier(book, trimmed, "full");
  if (translated == null) return null;
  return value.slice(0, value.length - value.trimStart().length) + translated + value.slice(value.trimEnd().length);
};

// The nodes an element puts in the DOM as its children: fragments and function components add none of their own.
const domChildren = (children) => {
  const nodes = [];
  const add = (node) => {
    if (node === null || node === undefined || typeof node === "boolean" || node === "") return;
    if (Array.isArray(node)) return node.forEach(add);
    if (typeof node === "number") return nodes.push(String(node));
    if (typeof node === "string") return nodes.push(node);
    if (node.type === React.Fragment) return add(node.props.children);
    if (typeof node.type === "function") return add(node.type(node.props));
    nodes.push(node);
  };
  add(children);
  return nodes;
};

/** The text of `element` after the page's dictionary (a book from loadNativeBook) has read it. */
export function pageReading(element, book) {
  const readElement = (node) => {
    const children = domChildren(node.props?.children);
    if (node.props?.["data-no-translate"]) return children.map((child) => typeof child === "string" ? child : readElement(child)).join("");
    if (children.length >= 2 && children.every((child) => typeof child === "string")) {
      const whole = readValue(book, children.join(""));
      if (whole != null) return whole;
    }
    return children.map((child) => typeof child === "string" ? readValue(book, child) ?? child : readElement(child)).join("");
  };
  return domChildren(element).map((node) => typeof node === "string" ? readValue(book, node) ?? node : readElement(node)).join("");
}
