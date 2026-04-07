/**
 * Patch Radix UI for React 19 compatibility.
 *
 * Problem: @radix-ui/react-slot calls composeRefs() during render,
 * creating a NEW function ref every time. React 19 sees the new ref,
 * unmounts old (ref(null)) + mounts new (ref(node)). If one ref is
 * a state setter, this triggers re-render → new composeRefs → infinite loop.
 *
 * Fix: Patch SlotClone in every copy of react-slot to use a stable
 * ref via useRef + useCallback. Also patch compose-refs for safety.
 *
 * Run automatically via "postinstall" in package.json.
 */
const fs = require('fs');
const path = require('path');
// ── 1. Patch compose-refs ────────────────────────────────────────

const COMPOSE_REFS_ESM = `// Patched for React 19 compatibility
import * as React from "react";

function setRef(ref, value) {
  if (typeof ref === "function") {
    ref(value);
  } else if (ref !== null && ref !== void 0) {
    ref.current = value;
  }
}

function composeRefs(...refs) {
  return (node) => refs.forEach((ref) => setRef(ref, node));
}

function useComposedRefs(...refs) {
  const currentRefs = React.useRef(refs);
  currentRefs.current = refs;
  return React.useCallback((node) => {
    currentRefs.current.forEach((ref) => setRef(ref, node));
  }, []);
}

export { composeRefs, useComposedRefs };
`;

const composeRefsPath = path.join(
  __dirname, '..', 'node_modules', '@radix-ui', 'react-compose-refs', 'dist', 'index.mjs'
);

try {
  fs.writeFileSync(composeRefsPath, COMPOSE_REFS_ESM, 'utf8');
  console.log('[patch] compose-refs patched');
} catch (e) {
  console.warn('[patch] compose-refs skip:', e.message);
}

// ── 2. Patch every copy of react-slot ────────────────────────────
//
// Replace createSlotClone so that the composed ref is STABLE across
// renders (useRef + useCallback pattern, empty deps).

const SLOT_ESM = `// Patched for React 19 — stable composed ref in SlotClone
import * as React from "react";
import { Fragment as Fragment2, jsx } from "react/jsx-runtime";

function setRef(ref, value) {
  if (typeof ref === "function") ref(value);
  else if (ref !== null && ref !== void 0) ref.current = value;
}

var REACT_LAZY_TYPE = Symbol.for("react.lazy");
var use = React[" use ".trim().toString()];

function isPromiseLike(value) {
  return typeof value === "object" && value !== null && "then" in value;
}
function isLazyComponent(element) {
  return element != null && typeof element === "object" && "$$typeof" in element && element.$$typeof === REACT_LAZY_TYPE && "_payload" in element && isPromiseLike(element._payload);
}

function createSlot(ownerName) {
  const SlotClone = createSlotClone(ownerName);
  const Slot2 = React.forwardRef((props, forwardedRef) => {
    let { children, ...slotProps } = props;
    if (isLazyComponent(children) && typeof use === "function") {
      children = use(children._payload);
    }
    const childrenArray = React.Children.toArray(children);
    const slottable = childrenArray.find(isSlottable);
    if (slottable) {
      const newElement = slottable.props.children;
      const newChildren = childrenArray.map((child) => {
        if (child === slottable) {
          if (React.Children.count(newElement) > 1) return React.Children.only(null);
          return React.isValidElement(newElement) ? newElement.props.children : null;
        } else {
          return child;
        }
      });
      return jsx(SlotClone, { ...slotProps, ref: forwardedRef, children: React.isValidElement(newElement) ? React.cloneElement(newElement, void 0, newChildren) : null });
    }
    return jsx(SlotClone, { ...slotProps, ref: forwardedRef, children });
  });
  Slot2.displayName = ownerName + ".Slot";
  return Slot2;
}
var Slot = createSlot("Slot");

function createSlotClone(ownerName) {
  const SlotClone = React.forwardRef((props, forwardedRef) => {
    let { children, ...slotProps } = props;
    if (isLazyComponent(children) && typeof use === "function") {
      children = use(children._payload);
    }

    // ── PATCHED: stable composed ref ──
    const refsStore = React.useRef({ fwd: null, child: null });
    const stableRef = React.useCallback((node) => {
      setRef(refsStore.current.fwd, node);
      setRef(refsStore.current.child, node);
    }, []);

    if (React.isValidElement(children)) {
      const childrenRef = getElementRef(children);
      const props2 = mergeProps(slotProps, children.props);
      if (children.type !== React.Fragment) {
        refsStore.current.fwd = forwardedRef;
        refsStore.current.child = childrenRef;
        props2.ref = forwardedRef ? stableRef : childrenRef;
      }
      return React.cloneElement(children, props2);
    }
    return React.Children.count(children) > 1 ? React.Children.only(null) : null;
  });
  SlotClone.displayName = ownerName + ".SlotClone";
  return SlotClone;
}

var SLOTTABLE_IDENTIFIER = Symbol("radix.slottable");
function createSlottable(ownerName) {
  const Slottable2 = ({ children }) => {
    return jsx(Fragment2, { children });
  };
  Slottable2.displayName = ownerName + ".Slottable";
  Slottable2.__radixId = SLOTTABLE_IDENTIFIER;
  return Slottable2;
}
var Slottable = createSlottable("Slottable");

function isSlottable(child) {
  return React.isValidElement(child) && typeof child.type === "function" && "__radixId" in child.type && child.type.__radixId === SLOTTABLE_IDENTIFIER;
}
function mergeProps(slotProps, childProps) {
  const overrideProps = { ...childProps };
  for (const propName in childProps) {
    const slotPropValue = slotProps[propName];
    const childPropValue = childProps[propName];
    const isHandler = /^on[A-Z]/.test(propName);
    if (isHandler) {
      if (slotPropValue && childPropValue) {
        overrideProps[propName] = (...args) => {
          const result = childPropValue(...args);
          slotPropValue(...args);
          return result;
        };
      } else if (slotPropValue) {
        overrideProps[propName] = slotPropValue;
      }
    } else if (propName === "style") {
      overrideProps[propName] = { ...slotPropValue, ...childPropValue };
    } else if (propName === "className") {
      overrideProps[propName] = [slotPropValue, childPropValue].filter(Boolean).join(" ");
    }
  }
  return { ...slotProps, ...overrideProps };
}
function getElementRef(element) {
  let getter = Object.getOwnPropertyDescriptor(element.props, "ref")?.get;
  let mayWarn = getter && "isReactWarning" in getter && getter.isReactWarning;
  if (mayWarn) return element.ref;
  getter = Object.getOwnPropertyDescriptor(element, "ref")?.get;
  mayWarn = getter && "isReactWarning" in getter && getter.isReactWarning;
  if (mayWarn) return element.props.ref;
  return element.props.ref || element.ref;
}

export { Slot as Root, Slot, Slottable, createSlot, createSlottable };
`;

// Find all react-slot copies via recursive search
const nm = path.join(__dirname, '..', 'node_modules');
let patched = 0;

function findAllSlotFiles(dir) {
  const results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const full = path.join(dir, entry.name);
      if (entry.name === 'react-slot' && dir.includes('@radix-ui')) {
        const target = path.join(full, 'dist', 'index.mjs');
        if (fs.existsSync(target)) results.push(target);
      }
      if (entry.name === 'node_modules' || entry.name.startsWith('@radix-ui')) {
        results.push(...findAllSlotFiles(full));
      }
    }
  } catch {}
  return results;
}

for (const target of findAllSlotFiles(nm)) {
  try {
    fs.writeFileSync(target, SLOT_ESM, 'utf8');
    patched++;
  } catch (e) {
    console.warn('[patch] slot skip:', target, e.message);
  }
}
console.log('[patch] react-slot patched in ' + patched + ' locations');
