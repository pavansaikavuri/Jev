"""
Automated Verification & Regression Test Suite:
Selection Parity, Pre-Submit Verification Gate, Leaf Option Deduplication,
Math Normalizer Equivalence, and Zero-UNCERTAIN Consensus Hardening.
"""

import asyncio
import json
import os
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
os.environ["QUIZZY_OFFLINE_TEST_MODE"] = "1"

from backend.core.normalizer import normalize_mcq_answer, NormalizedAnswer
from backend.core.llm_client import solve_question, SolverResponse, ModelResponse


class TestSelectionAndConsensusHardening(unittest.IsolatedAsyncioTestCase):

    def test_test1_react_option_selection_and_pre_submit_verification_gate(self):
        """
        Test 1: Node.js runtime simulation of React learning.ccbp.in MCQ DOM.
        - Verifies full pointerdown -> mousedown -> mouseup -> click cascade triggers selection.
        - Verifies executeQuizAction detects selection and returns ok: true, selected: true.
        - Simulates a broken/locked DOM where click does NOT update state, verifying executeQuizAction
          returns ok: false, selected: false, error: 'OPTION_SELECTION_FAILED', and Auto Mode refuses to click SUBMIT.
        """
        js_test = r"""
const path = require("path");
const fs = require("fs");
const vm = require("vm");

class MockEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.bubbles = init && init.bubbles !== undefined ? init.bubbles : true;
    this.cancelable = init && init.cancelable !== undefined ? init.cancelable : true;
  }
}

class MockNode {
  constructor(tagName, isText = false) {
    this.tagName = isText ? "#text" : String(tagName).toUpperCase();
    this.nodeType = isText ? 3 : 1;
    this.nodeValue = isText ? tagName : "";
    this.className = "";
    this.id = "";
    this.type = isText ? "" : String(tagName).toLowerCase();
    this.value = "";
    this.checked = false;
    this.disabled = false;
    this.childNodes = [];
    this.parentElement = null;
    this.listeners = {};
    this.attributes = {};
  }
  setAttribute(k, v) { this.attributes[k] = String(v); if (k === "id") this.id = String(v); if (k === "class") this.className = String(v); }
  getAttribute(k) { return this.attributes[k] || (k === "id" ? this.id : (k === "class" ? this.className : null)); }
  hasAttribute(k) { return k in this.attributes; }
  appendChild(c) { c.parentElement = this; this.childNodes.push(c); return c; }
  get textContent() { return this.nodeType === 3 ? this.nodeValue : this.childNodes.map(c => c.textContent).join(""); }
  get innerText() { return this.textContent; }
  get firstElementChild() { return this.childNodes.find(c => c.nodeType === 1) || null; }
  get lastElementChild() { const els = this.childNodes.filter(c => c.nodeType === 1); return els.length ? els[els.length - 1] : null; }
  get nextElementSibling() {
    if (!this.parentElement) return null;
    const siblings = this.parentElement.childNodes.filter(c => c.nodeType === 1);
    const idx = siblings.indexOf(this);
    return (idx !== -1 && idx + 1 < siblings.length) ? siblings[idx + 1] : null;
  }
  get previousElementSibling() {
    if (!this.parentElement) return null;
    const siblings = this.parentElement.childNodes.filter(c => c.nodeType === 1);
    const idx = siblings.indexOf(this);
    return (idx > 0) ? siblings[idx - 1] : null;
  }
  get children() { return this.childNodes.filter(c => c.nodeType === 1); }
  get classList() {
    return {
      contains: (cls) => (this.className || "").split(/\s+/).includes(cls),
      add: (cls) => { if (!this.classList.contains(cls)) this.className = (this.className + " " + cls).trim(); },
      remove: (cls) => { this.className = (this.className || "").split(/\s+/).filter(c => c !== cls).join(" "); }
    };
  }
  addEventListener(type, fn) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(fn);
  }
  dispatchEvent(event) {
    const evType = typeof event === "string" ? event : event.type;
    const evObj = typeof event === "string" ? { type: event, bubbles: true, target: this } : event;
    if (!evObj.target) evObj.target = this;
    if (this.listeners[evType]) {
      for (const fn of this.listeners[evType]) {
        fn.call(this, evObj);
      }
    }
    if (evObj.bubbles && this.parentElement) {
      this.parentElement.dispatchEvent(evObj);
    }
    return true;
  }
  click() {
    this.dispatchEvent({ type: "click", bubbles: true, cancelable: true, target: this });
  }
  focus() {}
  scrollIntoView() {}
  getBoundingClientRect() { return { left: 100, top: 200, width: 300, height: 48 }; }
  contains(other) {
    let cur = other;
    while (cur) {
      if (cur === this) return true;
      cur = cur.parentElement;
    }
    return false;
  }
  matches(sel) {
    if (!sel || this.nodeType !== 1) return false;
    const parts = sel.split(",").map(s => s.trim()).filter(Boolean);
    for (const p of parts) {
      if (this.matchesSingle(p)) return true;
    }
    return false;
  }
  matchesSingle(p) {
    if (p === "*") return true;
    if (p.includes(":nth-of-type(")) {
      p = p.replace(/:nth-of-type\(\d+\)/g, "");
      if (!p) return true;
    }
    if (p.includes(" > ")) {
      const segs = p.split(" > ");
      return this.matchesSingle(segs[segs.length - 1]);
    }
    if (p.includes(" ")) {
      const segs = p.split(/\s+/);
      return this.matchesSingle(segs[segs.length - 1]);
    }

    let elTag = this.tagName.toLowerCase();
    let rem = p;

    const tagMatch = rem.match(/^([a-zA-Z0-9_-]+)/);
    if (tagMatch) {
      if (tagMatch[1].toLowerCase() !== elTag) return false;
      rem = rem.slice(tagMatch[1].length);
      if (!rem) return true;
    }

    const classMatch = rem.match(/^\.([a-zA-Z0-9_-]+)/);
    if (classMatch) {
      if (!this.classList.contains(classMatch[1])) return false;
      rem = rem.slice(classMatch[0].length);
      if (!rem) return true;
    }

    const idMatch = rem.match(/^#([a-zA-Z0-9_-]+)/);
    if (idMatch) {
      if (this.id !== idMatch[1]) return false;
      rem = rem.slice(idMatch[0].length);
      if (!rem) return true;
    }

    const attrContainsMatch = rem.match(/^\[([a-zA-Z0-9_-]+)\*=['"]?([^'"\]]+)['"]?\]/);
    if (attrContainsMatch) {
      const attr = attrContainsMatch[1];
      const val = attrContainsMatch[2];
      const actualVal = attr === "class" ? (this.className || "") : (this.getAttribute(attr) || "");
      if (!actualVal.includes(val)) return false;
      rem = rem.slice(attrContainsMatch[0].length);
      if (!rem) return true;
    }

    const attrExactMatch = rem.match(/^\[([a-zA-Z0-9_-]+)=['"]?([^'"\]]+)['"]?\]/);
    if (attrExactMatch) {
      const attr = attrExactMatch[1];
      const val = attrExactMatch[2];
      const actualVal = attr === "class" ? (this.className || "") : (this.getAttribute(attr) || "");
      if (actualVal !== val) return false;
      rem = rem.slice(attrExactMatch[0].length);
      if (!rem) return true;
    }

    const attrExistsMatch = rem.match(/^\[([a-zA-Z0-9_-]+)\]/);
    if (attrExistsMatch) {
      const attr = attrExistsMatch[1];
      if (!this.hasAttribute(attr)) return false;
      rem = rem.slice(attrExistsMatch[0].length);
      if (!rem) return true;
    }

    if (rem.startsWith(".")) return this.classList.contains(rem.slice(1));
    if (rem.startsWith("#")) return this.id === rem.slice(1);

    return false;
  }
  querySelectorAll(sel) {
    const results = [];
    function check(node) {
      if (node.nodeType === 1 && node.matches(sel)) results.push(node);
      for (const child of node.childNodes) check(child);
    }
    for (const child of this.childNodes) check(child);
    return results;
  }
  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  }
}

function el(tag, className = "", attrs = {}, children = []) {
  const node = new MockNode(tag);
  node.className = className;
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "disabled") node.disabled = Boolean(v);
    else if (k === "type") { node.type = String(v); node.setAttribute(k, v); }
    else node.setAttribute(k, v);
  }
  for (const c of children) {
    if (typeof c === "string") node.appendChild(new MockNode(c, true));
    else if (c) node.appendChild(c);
  }
  return node;
}

const executorPath = path.resolve(process.cwd(), "extension/executor.js");
const executorCode = fs.readFileSync(executorPath, "utf8");

// --- CASE A: React Option Selection with Cascade Verification ---
let optEventsFired = [];
let optSelectedState = false;

const circleEl = el("div", "sc-circle");
const textEl = el("div", "sc-opt-text", {}, ["Option 3: 42"]);
const rowEl2 = el("div", "sc-opt-row", {}, [circleEl, textEl]);

// Simulated React component listening to pointerdown -> mousedown -> mouseup -> click
["pointerdown", "mousedown", "mouseup", "click"].forEach(evType => {
  rowEl2.addEventListener(evType, () => {
    optEventsFired.push(evType);
    if (evType === "click") {
      optSelectedState = true;
      rowEl2.className = "sc-opt-row selected";
      circleEl.className = "sc-circle checked";
    }
  });
});

const docA = el("html", "", {}, [
  el("head"),
  el("body", "", {}, [
    el("div", "sc-card", {}, [
      el("p", "sc-q", {}, ["What is the answer to everything?"]),
      el("div", "sc-opts", {}, [
        el("div", "sc-opt-row", {}, [el("div", "sc-circle"), el("div", "sc-opt-text", {}, ["10"])]),
        el("div", "sc-opt-row", {}, [el("div", "sc-circle"), el("div", "sc-opt-text", {}, ["20"])]),
        rowEl2,
        el("div", "sc-opt-row", {}, [el("div", "sc-circle"), el("div", "sc-opt-text", {}, ["50"])])
      ]),
      el("button", "btn-submit", { type: "submit" }, ["SUBMIT"])
    ])
  ])
]);
docA.body = docA.childNodes[1];
docA.documentElement = docA;
docA.querySelector = (sel) => docA.body.querySelector(sel);
docA.querySelectorAll = (sel) => docA.body.querySelectorAll(sel);
docA.elementFromPoint = (x, y) => rowEl2;

const sandboxA = {
  window: null,
  document: docA,
  getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1" }),
  Event: MockEvent,
  MouseEvent: MockEvent,
  PointerEvent: MockEvent,
  HTMLInputElement: { prototype: {} }
};
sandboxA.window = sandboxA;

const executorA = vm.runInNewContext(executorCode, sandboxA);
const resA = executorA.executeQuizAction({
  q_type: "mcq",
  selected_index: 2,
  targetText: "Option 3: 42"
});

if (!resA || !resA.ok || !resA.selected || !resA.success) {
  throw new Error("Case A Failed: executeQuizAction did not return ok: true, selected: true! " + JSON.stringify(resA));
}
if (!optEventsFired.includes("pointerdown") || !optEventsFired.includes("click")) {
  throw new Error("Case A Failed: Human pointer event cascade was not fully dispatched! Events: " + JSON.stringify(optEventsFired));
}
if (!optSelectedState) {
  throw new Error("Case A Failed: optSelectedState did not transition to true!");
}

// --- CASE B: Broken / Locked DOM (Click changes nothing) ---
const lockedRow2 = el("div", "sc-opt-row", {}, [el("div", "sc-circle"), el("div", "sc-opt-text", {}, ["42"])]);
// No click listeners change className, aria, or inputs
const docB = el("html", "", {}, [
  el("head"),
  el("body", "", {}, [
    el("div", "sc-card", {}, [
      el("p", "sc-q", {}, ["Locked question?"]),
      el("div", "sc-opts", {}, [
        el("div", "sc-opt-row", {}, [el("div", "sc-circle"), el("div", "sc-opt-text", {}, ["10"])]),
        el("div", "sc-opt-row", {}, [el("div", "sc-circle"), el("div", "sc-opt-text", {}, ["20"])]),
        lockedRow2,
        el("div", "sc-opt-row", {}, [el("div", "sc-circle"), el("div", "sc-opt-text", {}, ["50"])])
      ]),
      el("button", "btn-submit", { type: "submit" }, ["SUBMIT"])
    ])
  ])
]);
docB.body = docB.childNodes[1];
docB.documentElement = docB;
docB.querySelector = (sel) => docB.body.querySelector(sel);
docB.querySelectorAll = (sel) => docB.body.querySelectorAll(sel);
docB.elementFromPoint = (x, y) => lockedRow2;

const sandboxB = {
  window: null,
  document: docB,
  getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1" }),
  Event: MockEvent,
  MouseEvent: MockEvent,
  PointerEvent: MockEvent,
  HTMLInputElement: { prototype: {} }
};
sandboxB.window = sandboxB;

const executorB = vm.runInNewContext(executorCode, sandboxB);
const resB = executorB.executeQuizAction({
  q_type: "mcq",
  selected_index: 2,
  targetText: "42"
});

// HARD ABORT VERIFICATION: Must fail selection verification
if (resB.ok !== false || resB.selected !== false || resB.error !== "OPTION_SELECTION_FAILED") {
  throw new Error("Case B Failed: Broken DOM did not fail selection verification! Got: " + JSON.stringify(resB));
}

// Auto Mode Simulation: Ensure clickNextButton is NEVER called when resB.selected is false
let submitClicked = false;
docB.querySelector(".btn-submit").addEventListener("click", () => { submitClicked = true; });

let autoHaltedReason = null;
if (!resB || resB.ok === false || resB.selected === false || !resB.success) {
  autoHaltedReason = "STOPPED_SELECTION_FAILED (Did not click Submit)";
} else {
  // Would have clicked submit
  docB.querySelector(".btn-submit").click();
}

if (autoHaltedReason !== "STOPPED_SELECTION_FAILED (Did not click Submit)") {
  throw new Error("Case B Failed: Auto mode did not halt with STOPPED_SELECTION_FAILED!");
}
if (submitClicked) {
  throw new Error("Case B Failed: Auto mode clicked SUBMIT when selection failed!");
}

console.log("TEST1_SUCCESS");
process.exit(0);
""";
        res = subprocess.run(
            ["node", "-e", js_test],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
            encoding="utf-8"
        )
        self.assertEqual(res.returncode, 0, f"Test 1 Node.js failed:\nSTDOUT: {res.stdout}\nSTDERR: {res.stderr}")
        self.assertIn("TEST1_SUCCESS", res.stdout)

    def test_test2_leaf_option_deduplication_and_button_exclusion(self):
        """
        Test 2: Leaf Option Deduplication and Button Exclusion in Node.js.
        DOM with nested div.sc-card > div.sc-opt-wrapper > div.sc-opt-text
        plus SHOW ANSWER, SUBMIT, SKIP buttons extracts exactly 4 options
        with zero duplicate parent/child entries and zero button labels.
        """
        js_test = r"""
const path = require("path");
const fs = require("fs");
const vm = require("vm");

class MockNode {
  constructor(tagName, isText = false) {
    this.tagName = isText ? "#text" : String(tagName).toUpperCase();
    this.nodeType = isText ? 3 : 1;
    this.nodeValue = isText ? tagName : "";
    this.className = "";
    this.id = "";
    this.childNodes = [];
    this.parentElement = null;
    this.attributes = {};
  }
  setAttribute(k, v) { this.attributes[k] = String(v); if (k === "id") this.id = String(v); if (k === "class") this.className = String(v); }
  getAttribute(k) { return this.attributes[k] || (k === "id" ? this.id : (k === "class" ? this.className : null)); }
  hasAttribute(k) { return k in this.attributes; }
  appendChild(c) { c.parentElement = this; this.childNodes.push(c); return c; }
  get textContent() { return this.nodeType === 3 ? this.nodeValue : this.childNodes.map(c => c.textContent).join(""); }
  get innerText() { return this.textContent; }
  get firstElementChild() { return this.childNodes.find(c => c.nodeType === 1) || null; }
  get lastElementChild() { const els = this.childNodes.filter(c => c.nodeType === 1); return els.length ? els[els.length - 1] : null; }
  get previousElementSibling() {
    if (!this.parentElement) return null;
    const siblings = this.parentElement.childNodes.filter(c => c.nodeType === 1);
    const idx = siblings.indexOf(this);
    return (idx > 0) ? siblings[idx - 1] : null;
  }
  get nextElementSibling() {
    if (!this.parentElement) return null;
    const siblings = this.parentElement.childNodes.filter(c => c.nodeType === 1);
    const idx = siblings.indexOf(this);
    return (idx !== -1 && idx + 1 < siblings.length) ? siblings[idx + 1] : null;
  }
  get children() { return this.childNodes.filter(c => c.nodeType === 1); }
  get classList() {
    return {
      contains: (cls) => (this.className || "").split(/\s+/).includes(cls)
    };
  }
  contains(other) {
    let cur = other;
    while (cur) {
      if (cur === this) return true;
      cur = cur.parentElement;
    }
    return false;
  }
  matches(sel) {
    if (!sel || this.nodeType !== 1) return false;
    const parts = sel.split(",").map(s => s.trim()).filter(Boolean);
    for (const p of parts) {
      if (this.matchesSingle(p)) return true;
    }
    return false;
  }
  matchesSingle(p) {
    if (p === "*") return true;
    if (p.includes(":nth-of-type(")) {
      p = p.replace(/:nth-of-type\(\d+\)/g, "");
      if (!p) return true;
    }
    if (p.includes(" > ")) {
      const segs = p.split(" > ");
      return this.matchesSingle(segs[segs.length - 1]);
    }
    if (p.includes(" ")) {
      const segs = p.split(/\s+/);
      return this.matchesSingle(segs[segs.length - 1]);
    }

    let elTag = this.tagName.toLowerCase();
    let rem = p;

    const tagMatch = rem.match(/^([a-zA-Z0-9_-]+)/);
    if (tagMatch) {
      if (tagMatch[1].toLowerCase() !== elTag) return false;
      rem = rem.slice(tagMatch[1].length);
      if (!rem) return true;
    }

    const classMatch = rem.match(/^\.([a-zA-Z0-9_-]+)/);
    if (classMatch) {
      if (!this.classList.contains(classMatch[1])) return false;
      rem = rem.slice(classMatch[0].length);
      if (!rem) return true;
    }

    const idMatch = rem.match(/^#([a-zA-Z0-9_-]+)/);
    if (idMatch) {
      if (this.id !== idMatch[1]) return false;
      rem = rem.slice(idMatch[0].length);
      if (!rem) return true;
    }

    const attrContainsMatch = rem.match(/^\[([a-zA-Z0-9_-]+)\*=['"]?([^'"\]]+)['"]?\]/);
    if (attrContainsMatch) {
      const attr = attrContainsMatch[1];
      const val = attrContainsMatch[2];
      const actualVal = attr === "class" ? (this.className || "") : (this.getAttribute(attr) || "");
      if (!actualVal.includes(val)) return false;
      rem = rem.slice(attrContainsMatch[0].length);
      if (!rem) return true;
    }

    const attrExactMatch = rem.match(/^\[([a-zA-Z0-9_-]+)=['"]?([^'"\]]+)['"]?\]/);
    if (attrExactMatch) {
      const attr = attrExactMatch[1];
      const val = attrExactMatch[2];
      const actualVal = attr === "class" ? (this.className || "") : (this.getAttribute(attr) || "");
      if (actualVal !== val) return false;
      rem = rem.slice(attrExactMatch[0].length);
      if (!rem) return true;
    }

    const attrExistsMatch = rem.match(/^\[([a-zA-Z0-9_-]+)\]/);
    if (attrExistsMatch) {
      const attr = attrExistsMatch[1];
      if (!this.hasAttribute(attr)) return false;
      rem = rem.slice(attrExistsMatch[0].length);
      if (!rem) return true;
    }

    if (rem.startsWith(".")) return this.classList.contains(rem.slice(1));
    if (rem.startsWith("#")) return this.id === rem.slice(1);

    return false;
  }
  querySelectorAll(sel) {
    const results = [];
    function check(node) {
      if (node.nodeType === 1 && node.matches(sel)) results.push(node);
      for (const child of node.childNodes) check(child);
    }
    for (const child of this.childNodes) check(child);
    return results;
  }
  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  }
}

function el(tag, className = "", attrs = {}, children = []) {
  const node = new MockNode(tag);
  node.className = className;
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) {
    if (typeof c === "string") node.appendChild(new MockNode(c, true));
    else if (c) node.appendChild(c);
  }
  return node;
}

const extractorPath = path.resolve(process.cwd(), "extension/extractor.js");
const extractorCode = fs.readFileSync(extractorPath, "utf8");

// DOM with nested wrappers, outer container, and action buttons
const opt0 = el("div", "sc-opt-wrapper", {}, [el("div", "sc-opt-circle"), el("div", "sc-opt-text", {}, ["Option Alpha"])]);
const opt1 = el("div", "sc-opt-wrapper", {}, [el("div", "sc-opt-circle"), el("div", "sc-opt-text", {}, ["Option Beta"])]);
const opt2 = el("div", "sc-opt-wrapper", {}, [el("div", "sc-opt-circle"), el("div", "sc-opt-text", {}, ["Option Gamma"])]);
const opt3 = el("div", "sc-opt-wrapper", {}, [el("div", "sc-opt-circle"), el("div", "sc-opt-text", {}, ["Option Delta"])]);

const btnShow = el("button", "sc-btn-show", {}, ["SHOW ANSWER"]);
const btnSubmit = el("button", "sc-btn-sub", {}, ["SUBMIT"]);
const btnSkip = el("button", "sc-btn-skip", {}, ["SKIP"]);

const cardEl = el("div", "sc-card", {}, [
  el("div", "sc-q-header", {}, [el("h2", "", {}, ["Select the primary biological unit:"])]),
  el("div", "sc-opts-container", {}, [opt0, opt1, opt2, opt3]),
  el("div", "sc-actions", {}, [btnShow, btnSubmit, btnSkip])
]);

const doc = el("html", "", {}, [el("head"), el("body", "", {}, [cardEl])]);
doc.body = doc.childNodes[1];
doc.documentElement = doc;
doc.querySelector = (sel) => doc.body.querySelector(sel);
doc.querySelectorAll = (sel) => doc.body.querySelectorAll(sel);

const sandbox = {
  window: null,
  document: doc,
  getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1" })
};
sandbox.window = sandbox;

const extractor = vm.runInNewContext(extractorCode, sandbox);
const result = extractor.extractQuizFromDom();

if (!result || !result.success) {
  throw new Error("Extraction failed: " + JSON.stringify(result));
}

// Exactly 4 options
if (result.options.length !== 4) {
  throw new Error(`Expected exactly 4 options, got ${result.options.length}: ${JSON.stringify(result.options)}`);
}

// Zero duplicate entries
const expected = ["Option Alpha", "Option Beta", "Option Gamma", "Option Delta"];
if (JSON.stringify(result.options) !== JSON.stringify(expected)) {
  throw new Error(`Options content mismatch! Expected ${JSON.stringify(expected)}, got: ${JSON.stringify(result.options)}`);
}

// Zero buttons leaked
const buttonLabels = ["SHOW ANSWER", "SUBMIT", "SKIP"];
for (const b of buttonLabels) {
  if (result.options.includes(b)) {
    throw new Error(`Action button '${b}' leaked into extracted options!`);
  }
}

// Deterministic locator metadata
if (!Array.isArray(result.optionSelectors) || result.optionSelectors.length !== 4) {
  throw new Error("optionSelectors metadata missing or invalid length: " + JSON.stringify(result.optionSelectors));
}

console.log("TEST2_SUCCESS");
process.exit(0);
""";
        res = subprocess.run(
            ["node", "-e", js_test],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
            encoding="utf-8"
        )
        self.assertEqual(res.returncode, 0, f"Test 2 Node.js failed:\nSTDOUT: {res.stdout}\nSTDERR: {res.stderr}")
        self.assertIn("TEST2_SUCCESS", res.stdout)

    def test_test3_math_fraction_equivalence_and_prefix_normalization(self):
        """
        Test 3: Math Fraction Equivalence & Prefix Normalization in Normalizer.
        - Option D: 2/36 -> D
        - 1/18 -> D (mathematically equivalent to 2/36)
        - 0.0555556 -> D (decimal representation of 2/36)
        """
        options = ["1/36", "1/6", "1/12", "2/36"]

        # 1. Prefix normalization
        norm_prefix = normalize_mcq_answer("Option D: 2/36", options)
        self.assertEqual(norm_prefix.canonical_key, "D")
        self.assertEqual(norm_prefix.selected_index, 3)
        self.assertEqual(norm_prefix.selected_text, "2/36")

        # 2. Reduced fraction mathematical equivalence
        norm_reduced = normalize_mcq_answer("1/18", options)
        self.assertEqual(norm_reduced.canonical_key, "D")
        self.assertEqual(norm_reduced.selected_index, 3)
        self.assertEqual(norm_reduced.selected_text, "2/36")

        # 3. Decimal equivalence fallback
        norm_decimal = normalize_mcq_answer("0.05555555555555555", options)
        self.assertEqual(norm_decimal.canonical_key, "D")
        self.assertEqual(norm_decimal.selected_index, 3)

        # 4. Standard letter prefix variants
        self.assertEqual(normalize_mcq_answer("B) 1/6", options).canonical_key, "B")
        self.assertEqual(normalize_mcq_answer("(A)", options).canonical_key, "A")
        self.assertEqual(normalize_mcq_answer("[C]", options).canonical_key, "C")
        self.assertEqual(normalize_mcq_answer("Choice B", ["Apples", "Bananas", "Cherries"]).canonical_key, "B")

    async def test_test4_zero_uncertain_on_disagreement_and_single_primary_rescue(self):
        """
        Test 4: Zero UNCERTAIN on OpenRouter 429 during Disagreement or Single-Primary Failure.
        - Subtest A: primary_a and primary_b disagree, OpenRouter returns 429 -> Groq Judge resolves to MEDIUM_TIEBREAKER_AGREE.
        - Subtest B: primary_a succeeds, primary_b times out, OpenRouter returns 429 -> primary_a rescued as MEDIUM_TIEBREAKER_AGREE.
        """
        # SUBTEST A: Disagreement + OpenRouter 429 -> Groq Judge Tiebreaker Resolution
        with patch("backend.core.llm_client.call_groq_primary") as mock_groq_pri, \
             patch("backend.core.llm_client.run_groq_arbiter_fallback") as mock_groq_judge, \
             patch("backend.core.llm_client.run_hedged_openrouter_fallback") as mock_or:

            # primary_a returns "A", primary_b returns "B" (disagreement)
            mock_groq_pri.side_effect = [
                (ModelResponse(answer="A", reason="Reason A"), 120.0, None),
                (ModelResponse(answer="B", reason="Reason B"), 140.0, None),
            ]

            # OpenRouter 429 rate limit
            mock_or.return_value = (None, ["openrouter:free"], {"status": "rate_limited_429"})

            # Groq Tie-Breaker Judge succeeds and agrees with Candidate 1 ("A")
            mock_groq_judge.return_value = (
                SolverResponse(
                    status="OK",
                    confidence_tier="MEDIUM_TIEBREAKER_AGREE",
                    canonical_key="A",
                    selected_index=0,
                    selected_text="Option Alpha",
                    reason="Groq Judge verified Candidate A step-by-step.",
                    latency_ms=210.0,
                    models_called=["groq:llama-3.3-70b-versatile"]
                ),
                ["groq:llama-3.3-70b-versatile"],
                {"canonical_key": "A", "verified": True}
            )

            res = await solve_question(
                subject="Physics",
                q_type="mcq",
                question="What is the speed of light in vacuum?",
                options=["Option Alpha", "Option Beta", "Option Gamma", "Option Delta"],
                bypass_cache=True
            )

            self.assertEqual(res.status, "OK")
            self.assertNotEqual(res.status, "UNCERTAIN")
            self.assertEqual(res.confidence_tier, "MEDIUM_TIEBREAKER_AGREE")
            self.assertEqual(res.canonical_key, "A")
            self.assertEqual(res.selected_index, 0)

        # SUBTEST B: Single Primary Success + primary_b fail + OpenRouter 429 -> Surviving Primary Rescue
        with patch("backend.core.llm_client.call_groq_primary") as mock_groq_pri, \
             patch("backend.core.llm_client.run_hedged_openrouter_fallback") as mock_or:

            # primary_a succeeds ("C"), primary_b times out
            mock_groq_pri.side_effect = [
                (ModelResponse(answer="C", reason="Primary A derivation."), 150.0, None),
                (None, 2000.0, "TIMEOUT_GROQ"),
            ]

            # OpenRouter fallback fails / times out / 429s
            mock_or.return_value = (None, ["openrouter:free"], {"error": "HTTP 429 Rate Limit"})

            res_single = await solve_question(
                subject="Chemistry",
                q_type="mcq",
                question="What is the atomic number of Carbon?",
                options=["4", "5", "6", "7"],
                bypass_cache=True
            )

            self.assertEqual(res_single.status, "OK")
            self.assertNotEqual(res_single.status, "UNCERTAIN")
            self.assertEqual(res_single.confidence_tier, "MEDIUM_TIEBREAKER_AGREE")
            self.assertEqual(res_single.canonical_key, "C")
            self.assertEqual(res_single.selected_index, 2)
            self.assertEqual(res_single.selected_text, "6")

    def test_test5_row_container_option_resolution_and_cascade_selection(self):
        """
        Test 5: Per-Option Row-Container Resolution & Event Cascade Selection
        - DOM structure: <div class="sc-row"><div class="sc-radio-dot"></div><div class="sc-leaf-text">Option Text</div></div>
        - Clicking only sets backgroundColor on .sc-row when .sc-row or .sc-radio-dot receives the click cascade.
        - Verifies extractor.js records the .sc-row selector in optionSelectors.
        - Verifies executor.js selects and verifies it on the first attempt (retry/elementFromPoint is not triggered).
        """
        js_test = r"""
const path = require("path");
const fs = require("fs");
const vm = require("vm");

class MockEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.bubbles = init && init.bubbles !== undefined ? init.bubbles : true;
    this.cancelable = init && init.cancelable !== undefined ? init.cancelable : true;
    this.target = null;
  }
}

class MockNode {
  constructor(tagName, isText = false) {
    this.tagName = isText ? "#text" : String(tagName).toUpperCase();
    this.nodeType = isText ? 3 : 1;
    this.nodeValue = isText ? tagName : "";
    this.className = "";
    this.id = "";
    this.childNodes = [];
    this.parentElement = null;
    this.listeners = {};
    this.attributes = {};
    this.style = {};
  }
  setAttribute(k, v) { this.attributes[k] = String(v); if (k === "id") this.id = String(v); if (k === "class") this.className = String(v); }
  getAttribute(k) { return this.attributes[k] || (k === "id" ? this.id : (k === "class" ? this.className : null)); }
  hasAttribute(k) { return k in this.attributes; }
  appendChild(c) { c.parentElement = this; this.childNodes.push(c); return c; }
  get textContent() { return this.nodeType === 3 ? this.nodeValue : this.childNodes.map(c => c.textContent).join(""); }
  get innerText() { return this.textContent; }
  get firstElementChild() { return this.childNodes.find(c => c.nodeType === 1) || null; }
  get lastElementChild() { const els = this.childNodes.filter(c => c.nodeType === 1); return els.length ? els[els.length - 1] : null; }
  get children() { return this.childNodes.filter(c => c.nodeType === 1); }
  get previousElementSibling() {
    if (!this.parentElement) return null;
    const siblings = this.parentElement.childNodes.filter(c => c.nodeType === 1);
    const idx = siblings.indexOf(this);
    return (idx > 0) ? siblings[idx - 1] : null;
  }
  get nextElementSibling() {
    if (!this.parentElement) return null;
    const siblings = this.parentElement.childNodes.filter(c => c.nodeType === 1);
    const idx = siblings.indexOf(this);
    return (idx !== -1 && idx + 1 < siblings.length) ? siblings[idx + 1] : null;
  }
  get classList() {
    return {
      contains: (cls) => (this.className || "").split(/\s+/).includes(cls),
      add: (cls) => { if (!this.classList.contains(cls)) this.className = (this.className + " " + cls).trim(); },
      remove: (cls) => { this.className = (this.className || "").split(/\s+/).filter(c => c !== cls).join(" "); }
    };
  }
  addEventListener(type, fn) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(fn);
  }
  dispatchEvent(event) {
    const evType = typeof event === "string" ? event : event.type;
    const evObj = typeof event === "string" ? { type: event, bubbles: true, target: this } : event;
    if (!evObj.target) evObj.target = this;
    if (this.listeners[evType]) {
      for (const fn of this.listeners[evType]) {
        fn.call(this, evObj);
      }
    }
    if (evObj.bubbles && this.parentElement) {
      this.parentElement.dispatchEvent(evObj);
    }
    return true;
  }
  click() {
    this.dispatchEvent({ type: "click", bubbles: true, cancelable: true, target: this });
  }
  focus() {
    this.dispatchEvent({ type: "focus", bubbles: false, cancelable: true, target: this });
  }
  scrollIntoView() {}
  getBoundingClientRect() { return { left: 100, top: 200, width: 300, height: 48 }; }
  contains(other) {
    let cur = other;
    while (cur) {
      if (cur === this) return true;
      cur = cur.parentElement;
    }
    return false;
  }
  matches(sel) {
    if (!sel || this.nodeType !== 1) return false;
    const parts = sel.split(",").map(s => s.trim()).filter(Boolean);
    for (const p of parts) {
      if (this.matchesSingle(p)) return true;
    }
    return false;
  }
  matchesSingle(p) {
    if (p === "*") return true;
    if (p.includes(" > ")) {
      const segs = p.split(" > ");
      return this.matchesSingle(segs[segs.length - 1]);
    }
    if (p.includes(" ")) {
      const segs = p.split(/\s+/);
      return this.matchesSingle(segs[segs.length - 1]);
    }
    const nthMatch = p.match(/:nth-of-type\((\d+)\)/);
    if (nthMatch) {
      const expectedNth = parseInt(nthMatch[1], 10);
      if (this.parentElement) {
        const siblings = this.parentElement.childNodes.filter(c => c.nodeType === 1 && c.tagName === this.tagName);
        const actualNth = siblings.indexOf(this) + 1;
        if (actualNth !== expectedNth) return false;
      }
      p = p.replace(/:nth-of-type\(\d+\)/g, "");
      if (!p) return true;
    }

    let elTag = this.tagName.toLowerCase();
    let rem = p;

    const tagMatch = rem.match(/^([a-zA-Z0-9_-]+)/);
    if (tagMatch) {
      if (tagMatch[1].toLowerCase() !== elTag) return false;
      rem = rem.slice(tagMatch[1].length);
      if (!rem) return true;
    }

    const classMatch = rem.match(/^\.([a-zA-Z0-9_-]+)/);
    if (classMatch) {
      if (!this.classList.contains(classMatch[1])) return false;
      rem = rem.slice(classMatch[0].length);
      if (!rem) return true;
    }

    const idMatch = rem.match(/^#([a-zA-Z0-9_-]+)/);
    if (idMatch) {
      if (this.id !== idMatch[1]) return false;
      rem = rem.slice(idMatch[0].length);
      if (!rem) return true;
    }

    return false;
  }
  querySelectorAll(sel) {
    const results = [];
    function check(node) {
      if (node.nodeType === 1 && node.matches(sel)) results.push(node);
      for (const child of node.childNodes) check(child);
    }
    for (const child of this.childNodes) check(child);
    return results;
  }
  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  }
}

function el(tag, className = "", attrs = {}, children = []) {
  const node = new MockNode(tag);
  node.className = className;
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) {
    if (typeof c === "string") node.appendChild(new MockNode(c, true));
    else if (c) node.appendChild(c);
  }
  return node;
}

// 1. Build option rows with exact styled-components structure:
// <div class="sc-row"><div class="sc-radio-dot"></div><div class="sc-leaf-text">Option Text</div></div>
const row0 = el("div", "sc-row", {}, [el("div", "sc-radio-dot"), el("div", "sc-leaf-text", {}, ["Option Alpha"])]);
const row1 = el("div", "sc-row", {}, [el("div", "sc-radio-dot"), el("div", "sc-leaf-text", {}, ["Option Beta"])]);
const row2 = el("div", "sc-row", {}, [el("div", "sc-radio-dot"), el("div", "sc-leaf-text", {}, ["Option Gamma"])]);
const row3 = el("div", "sc-row", {}, [el("div", "sc-radio-dot"), el("div", "sc-leaf-text", {}, ["Option Delta"])]);
const rows = [row0, row1, row2, row3];

let rowDirectEvents = [];
let dotDirectEvents = [];
let leafDirectEvents = [];
let retryAttemptTriggered = false;

// 2. Attach click handlers: ONLY setting backgroundColor on .sc-row when .sc-row or .sc-radio-dot receives the click cascade
rows.forEach((row) => {
  const dot = row.childNodes[0];
  const leaf = row.childNodes[1];

  function handleEvent(e) {
    if (e.target === row) {
      rowDirectEvents.push(e.type);
      if (e.type === "click") {
        row.style.backgroundColor = "rgb(34, 197, 94)"; // #22c55e
        row.classList.add("selected");
      }
    } else if (e.target === dot) {
      dotDirectEvents.push(e.type);
      if (e.type === "click") {
        row.style.backgroundColor = "rgb(34, 197, 94)"; // #22c55e
        row.classList.add("selected");
      }
    } else if (e.target === leaf) {
      leafDirectEvents.push(e.type);
      // NOTE: Clicking leaf alone does NOT set backgroundColor on .sc-row!
    }
  }

  ["pointerdown", "mousedown", "focus", "pointerup", "mouseup", "click"].forEach((evType) => {
    row.addEventListener(evType, handleEvent);
    dot.addEventListener(evType, handleEvent);
    leaf.addEventListener(evType, handleEvent);
  });
});

const optsContainer = el("div", "sc-options-container", {}, [row0, row1, row2, row3]);
const cardEl = el("div", "sc-card", {}, [
  el("h2", "sc-question", {}, ["What is the primary power source of stars?"]),
  optsContainer,
  el("button", "btn-submit", {}, ["SUBMIT"])
]);

const doc = el("html", "", {}, [el("head"), el("body", "", {}, [cardEl])]);
doc.body = doc.childNodes[1];
doc.documentElement = doc;
doc.querySelector = (sel) => doc.body.querySelector(sel);
doc.querySelectorAll = (sel) => doc.body.querySelectorAll(sel);
doc.elementFromPoint = (x, y) => {
  // Retry fallback mechanism in executor.js calls elementFromPoint on Attempt 2
  retryAttemptTriggered = true;
  return row2;
};

const sandbox = {
  window: null,
  document: doc,
  getComputedStyle: (node) => ({
    display: "block",
    visibility: "visible",
    opacity: "1",
    backgroundColor: (node && node.style && node.style.backgroundColor) || "rgba(0, 0, 0, 0)",
    borderColor: (node && node.style && node.style.borderColor) || "rgba(0, 0, 0, 0)",
    boxShadow: (node && node.style && node.style.boxShadow) || "none"
  }),
  Event: MockEvent,
  MouseEvent: MockEvent,
  PointerEvent: MockEvent,
  HTMLInputElement: { prototype: {} }
};
sandbox.window = sandbox;

const extractorCode = fs.readFileSync(path.resolve(process.cwd(), "extension/extractor.js"), "utf8");
const executorCode = fs.readFileSync(path.resolve(process.cwd(), "extension/executor.js"), "utf8");

const extractor = vm.runInNewContext(extractorCode, sandbox);
const executor = vm.runInNewContext(executorCode, sandbox);

// STEP A: Extractor verification
const extRes = extractor.extractQuizFromDom();
if (!extRes || !extRes.success) {
  throw new Error("Extractor failed: " + JSON.stringify(extRes));
}
if (!Array.isArray(extRes.options) || extRes.options.length !== 4) {
  throw new Error("Extractor did not return 4 options! Got: " + JSON.stringify(extRes.options));
}
if (!Array.isArray(extRes.optionSelectors) || extRes.optionSelectors.length !== 4) {
  throw new Error("Extractor did not return 4 optionSelectors! Got: " + JSON.stringify(extRes.optionSelectors));
}

// Assert that extractor.js records the .sc-row selector for every option
for (let i = 0; i < 4; i++) {
  const sel = extRes.optionSelectors[i];
  if (!sel.includes("sc-row")) {
    throw new Error(`Selector index ${i} ('${sel}') does NOT point to .sc-row row container!`);
  }
  const resolved = doc.querySelector(sel);
  if (resolved !== rows[i]) {
    throw new Error(`Selector index ${i} ('${sel}') did not resolve to rows[${i}]!`);
  }
}

// STEP B: Executor selection and verification on first attempt
const execRes = executor.executeQuizAction({
  q_type: "mcq",
  selected_index: 2,
  targetText: "Option Gamma",
  optionSelectors: extRes.optionSelectors
});

if (!execRes || !execRes.ok || !execRes.selected || !execRes.success) {
  throw new Error("Executor action failed! Got: " + JSON.stringify(execRes));
}

// Assert .sc-row received background color change
if (row2.style.backgroundColor !== "rgb(34, 197, 94)") {
  throw new Error(`Row 2 backgroundColor not updated to #22c55e! Actual: ${row2.style.backgroundColor}`);
}
if (!row2.classList.contains("selected")) {
  throw new Error("Row 2 does not contain 'selected' class!");
}

// Assert event cascade reached row or dot
if (!rowDirectEvents.includes("click") && !dotDirectEvents.includes("click")) {
  throw new Error(`Direct click cascade did not reach .sc-row or .sc-radio-dot! rowEvents: ${JSON.stringify(rowDirectEvents)}, dotEvents: ${JSON.stringify(dotDirectEvents)}`);
}

// Assert selection succeeded on the FIRST attempt (retry was NOT triggered)
if (retryAttemptTriggered) {
  throw new Error("Selection verification fell back to retry (elementFromPoint)! Selection did not verify on first attempt.");
}

console.log("TEST5_SUCCESS");
process.exit(0);
"""
        res = subprocess.run(
            ["node", "-e", js_test],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
            encoding="utf-8"
        )
        self.assertEqual(res.returncode, 0, f"Test 5 Node.js failed:\nSTDOUT: {res.stdout}\nSTDERR: {res.stderr}")
        self.assertIn("TEST5_SUCCESS", res.stdout)


if __name__ == "__main__":
    unittest.main()

