import React from "react";

// Test-only: a small hook runtime for component tests without a DOM. It renders function components to a plain
// tree, keeps their state between renders (keyed by position in the tree), runs effects after each render and lets
// a test call the event handlers it finds. A ref on a host element receives a stand-in node whose focus() is recorded.
export function createHookDriver() {
  const store = new Map();
  const focused = [];
  let scope = null;
  let effects = [];
  const slot = () => {
    if (!scope) throw new Error("A hook was called outside a component render.");
    return `${scope.path}#${scope.counter++}`;
  };
  const hooks = {
    useState(initial) {
      const key = slot();
      if (!store.has(key)) store.set(key, typeof initial === "function" ? initial() : initial);
      return [store.get(key), (next) => store.set(key, typeof next === "function" ? next(store.get(key)) : next)];
    },
    useRef(initial) {
      const key = slot();
      if (!store.has(key)) store.set(key, { current: initial });
      return store.get(key);
    },
    useEffect(effect, deps) {
      const key = slot();
      const previous = store.get(key);
      const changed = !previous || !deps || deps.length !== previous.length || deps.some((value, index) => !Object.is(value, previous[index]));
      if (changed) { store.set(key, deps ?? []); effects.push(effect); }
    },
    useCallback: (callback) => callback,
    useMemo: (factory) => factory(),
  };

  function expand(node, path) {
    if (node === null || node === undefined || typeof node === "boolean") return null;
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map((child, index) => expand(child, `${path}.${child?.key ?? index}`));
    const { type, props } = node;
    if (type === React.Fragment) return expand(props.children, path);
    if (typeof type === "function") {
      const outer = scope;
      scope = { path: `${path}/${type.name || "Component"}`, counter: 0 };
      try { return expand(type(props), scope.path); } finally { scope = outer; }
    }
    const host = { type, props: { ...props } };
    host.props.children = expand(props.children, `${path}/${type}`);
    if (props.ref && typeof props.ref === "object") props.ref.current = { tag: type, props: host.props, focus: () => focused.push(host) };
    return host;
  }

  /** Renders the element, then runs the effects whose dependencies changed, the innermost first. */
  function render(element) {
    effects = [];
    const tree = expand(element, "root");
    const due = effects.reverse();
    effects = [];
    for (const effect of due) effect();
    return tree;
  }

  return { react: { ...React, ...hooks }, render, focused };
}

export const textOf = (node) => node === null || node === undefined ? ""
  : typeof node === "string" ? node : Array.isArray(node) ? node.map(textOf).join("") : textOf(node.props?.children);

export function findAll(node, predicate, found = []) {
  if (Array.isArray(node)) { for (const child of node) findAll(child, predicate, found); return found; }
  if (!node || typeof node !== "object") return found;
  if (predicate(node)) found.push(node);
  findAll(node.props?.children, predicate, found);
  return found;
}

/** The one button whose text is `label`; fails the test when there is none or more than one. */
export function buttonNamed(tree, label) {
  const matches = findAll(tree, (node) => node.type === "button" && textOf(node).trim() === label);
  if (matches.length !== 1) throw new Error(`Expected one button "${label}", found ${matches.length}.`);
  return matches[0];
}

/** Lets pending promise chains run to their end. */
export const settle = async () => { for (let round = 0; round < 25; round++) await new Promise((resolve) => setImmediate(resolve)); };
