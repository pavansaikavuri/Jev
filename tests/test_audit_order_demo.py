"""
Test Suite: Audit Order Demo & Sample Questions (Kadane's Algorithm, Binary Search, SDLC)
Validates end-to-end functionality:
1. demo_kadane_order.html DOM structure matches live CCBP Question 5/15.
2. Extractor accurately parses all sample questions into q_type: "order" with clean option texts.
3. Normalizer validates and generates canonical order representations.
4. Executor executes reordering and verifies final DOM ordering against pre-submit gate.
"""

import json
import os
import subprocess
import sys
from pathlib import Path
import pytest

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

os.environ["QUIZZY_OFFLINE_TEST_MODE"] = "1"


def run_node_eval(script_code: str) -> dict:
    """Executes Node.js evaluation script and parses JSON output."""
    res = subprocess.run(
        ["node", "-e", script_code],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8"
    )
    if res.returncode != 0:
        raise RuntimeError(f"Node execution failed (code {res.returncode}):\n{res.stderr}\nStdout:\n{res.stdout}")
    try:
        return json.loads(res.stdout.strip())
    except Exception as e:
        raise RuntimeError(f"Failed to parse JSON output: {res.stdout}\nError: {e}")


def test_demo_file_exists_and_has_required_elements():
    """Verify demo_kadane_order.html exists and contains the exact CCBP drag-and-drop structure."""
    demo_path = PROJECT_ROOT / "demo_kadane_order.html"
    assert demo_path.is_file(), "demo_kadane_order.html must exist in project root."
    content = demo_path.read_text(encoding="utf-8")

    assert "Kadane's Algorithm" in content
    assert "Drag and Drop to Order" in content
    assert "sc-row-item" in content
    assert "sc-grip-handle" in content
    assert "maxSum" in content
    assert "curSum" in content
    assert "extension/extractor.js" in content
    assert "extension/executor.js" in content


def test_audit_three_sample_questions_extraction():
    """
    Audit 3 sample questions (Kadane, Binary Search, SDLC) against extractor.js
    Verifies 100% extraction success, q_type: 'order', option cleanliness, and code preservation.
    """
    audit_script = r"""
const fs = require('fs');
const path = require('path');
const vm = require('vm');

class MockNode {
  constructor(tag, cls = '', attrs = {}, children = []) {
    this.tagName = tag.toUpperCase();
    this.className = cls;
    this.attributes = { ...attrs };
    this.childNodes = [];
    this.children = [];
    this.parentElement = null;
    this.parentNode = null;
    this.style = {};
    this.draggable = attrs.draggable === 'true';

    children.forEach(c => {
      if (typeof c === 'string') {
        const textNode = {
          nodeType: 3,
          textContent: c,
          innerText: c,
          nodeValue: c,
          parentElement: this,
          parentNode: this
        };
        this.childNodes.push(textNode);
      } else if (c) {
        c.parentElement = this;
        c.parentNode = this;
        this.childNodes.push(c);
        this.children.push(c);
      }
    });
  }

  get nodeType() { return 1; }

  getAttribute(name) {
    if (name === 'class') return this.className;
    return this.attributes[name] !== undefined ? this.attributes[name] : null;
  }

  setAttribute(name, val) {
    this.attributes[name] = String(val);
    if (name === 'class') this.className = String(val);
  }

  hasAttribute(name) {
    if (name === 'class') return !!this.className;
    return this.attributes[name] !== undefined;
  }

  get innerText() {
    return this.childNodes.map(c => c.innerText || c.textContent || c.nodeValue || '').join(' ');
  }

  get textContent() {
    return this.childNodes.map(c => c.textContent || c.nodeValue || '').join('');
  }

  get previousElementSibling() {
    if (!this.parentElement) return null;
    const siblings = this.parentElement.children;
    const idx = siblings.indexOf(this);
    return idx > 0 ? siblings[idx - 1] : null;
  }

  get nextElementSibling() {
    if (!this.parentElement) return null;
    const siblings = this.parentElement.children;
    const idx = siblings.indexOf(this);
    return (idx >= 0 && idx < siblings.length - 1) ? siblings[idx + 1] : null;
  }

  getBoundingClientRect() {
    let idx = 0;
    let curr = this;
    while (curr && curr.parentElement) {
      const siblings = curr.parentElement.children;
      idx += siblings.indexOf(curr) * 50;
      curr = curr.parentElement;
      idx += 30;
    }
    return { left: 10, top: idx, width: 400, height: 40, bottom: idx + 40 };
  }

  querySelectorAll(sel) {
    const results = [];
    const walk = (node) => {
      for (const child of node.children) {
        if (matchesSelector(child, sel)) results.push(child);
        walk(child);
      }
    };
    walk(this);
    return results;
  }

  querySelector(sel) {
    const all = this.querySelectorAll(sel);
    return all.length ? all[0] : null;
  }

  contains(other) {
    let curr = other;
    while (curr) {
      if (curr === this) return true;
      curr = curr.parentElement;
    }
    return false;
  }
}

function matchesSelector(el, sel) {
  if (!sel || !el) return false;
  const parts = sel.split(',').map(s => s.trim());
  for (const p of parts) {
    if (p === '*') return true;
    if (p.startsWith('.')) {
      const cls = p.slice(1);
      if (el.className && el.className.split(/\s+/).includes(cls)) return true;
    } else if (p.startsWith('#')) {
      const id = p.slice(1);
      if (el.getAttribute('id') === id) return true;
    } else if (p.startsWith("[class*='") && p.includes("']")) {
      const target = p.slice(9, p.indexOf("']"));
      if (el.className && el.className.toLowerCase().includes(target.toLowerCase())) return true;
    } else if (p.toLowerCase() === el.tagName.toLowerCase()) {
      return true;
    }
  }
  return false;
}

const el = (tag, cls = '', attrs = {}, children = []) => new MockNode(tag, cls, attrs, children);

function buildDoc(topic, statement, items) {
  const rowNodes = items.map((item, idx) => {
    return el('div', 'sc-row-item sc-gKclnd', { draggable: 'true' }, [
      el('span', 'sc-slot-number sc-iBPRYJ', {}, [String(idx + 1)]),
      el('div', 'sc-item-box sc-fjdhpX', { tabindex: '0' }, [
        el('div', 'sc-grip-handle', {}, [
          el('svg', 'sc-svg-icon', {}, [])
        ]),
        el('span', 'sc-text', {}, item)
      ])
    ]);
  });

  const doc = el('html', '', {}, [
    el('head'),
    el('body', 'sc-app-body', {}, [
      el('div', 'sc-topbar sc-jTzLTM', {}, [
        el('span', 'sc-title', {}, ['← MCQ PRACTICE | ' + topic]),
        el('span', 'sc-score', {}, ['SCORE: 4']),
        el('span', 'sc-attempted', {}, ['QUESTIONS ATTEMPTED: 5/15'])
      ]),
      el('div', 'sc-card sc-bczRLJ', {}, [
        el('div', 'sc-q-header', {}, [
          el('p', 'sc-statement', {}, [statement])
        ]),
        el('hr', 'sc-divider'),
        el('p', 'sc-subheader', {}, ['Drag and Drop to Order']),
        el('div', 'sc-ordering-list sc-list-container', {}, rowNodes),
        el('div', 'sc-buttons-container', {}, [
          el('button', 'sc-btn-show', {}, ['SHOW ANSWER']),
          el('button', 'sc-btn-submit', {}, ['SUBMIT']),
          el('button', 'sc-btn-skip', {}, ['SKIP'])
        ])
      ])
    ])
  ]);
  doc.body = doc.childNodes[1];
  doc.documentElement = doc;
  return doc;
}

const questions = [
  {
    topic: "LARGEST SUBARRAY SUM",
    statement: "Rearrange the following steps of Kadane's Algorithm in the correct order:",
    items: [
      ["Update ", el("code", "sc-code-pill", {}, ["maxSum"]), " to be the maximum of ", el("code", "sc-code-pill", {}, ["maxSum"]), " and ", el("code", "sc-code-pill", {}, ["curSum"]), " ."],
      ["Initialize ", el("code", "sc-code-pill", {}, ["curSum"]), " to ", el("code", "sc-code-pill", {}, ["0"]), " and ", el("code", "sc-code-pill", {}, ["maxSum"]), " to negative infinity."],
      ["If ", el("code", "sc-code-pill", {}, ["curSum"]), " becomes negative, reset it to ", el("code", "sc-code-pill", {}, ["0"]), " ."],
      ["Iterate through each element of the array, adding the current element to ", el("code", "sc-code-pill", {}, ["curSum"]), " ."],
      ["Return ", el("code", "sc-code-pill", {}, ["maxSum"]), " ."]
    ]
  },
  {
    topic: "BINARY SEARCH ALGORITHM",
    statement: "Arrange the steps of Binary Search in the correct sequential order from first to last:",
    items: [
      ["If target equals ", el("code", "sc-code-pill", {}, ["arr[mid]"]), ", return ", el("code", "sc-code-pill", {}, ["mid"]), "."],
      ["Initialize ", el("code", "sc-code-pill", {}, ["low = 0"]), " and ", el("code", "sc-code-pill", {}, ["high = n - 1"]), "."],
      ["If ", el("code", "sc-code-pill", {}, ["low > high"]), ", element is not present; return ", el("code", "sc-code-pill", {}, ["-1"]), "."],
      ["Calculate ", el("code", "sc-code-pill", {}, ["mid = low + (high - low) / 2"]), "."],
      ["If target < ", el("code", "sc-code-pill", {}, ["arr[mid]"]), ", set ", el("code", "sc-code-pill", {}, ["high = mid - 1"]), "; otherwise set ", el("code", "sc-code-pill", {}, ["low = mid + 1"]), "."]
    ]
  },
  {
    topic: "SOFTWARE ENGINEERING",
    statement: "Arrange the stages of the Software Development Life Cycle (SDLC) in chronological sequence:",
    items: [
      ["Implementation & Coding"],
      ["Requirements Gathering & Analysis"],
      ["Operations & Maintenance"],
      ["Architecture & System Design"],
      ["Integration & Quality Assurance Testing"]
    ]
  }
];

const extractorCode = fs.readFileSync('extension/extractor.js', 'utf8');

const results = questions.map(q => {
  const doc = buildDoc(q.topic, q.statement, q.items);
  const sandbox = {
    window: { location: { href: 'https://learning.ccbp.in/primitive-coding/practice' } },
    document: doc,
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1', cursor: 'grab' }),
    Date, String, Number, Boolean, Array, Object, Set, RegExp, console
  };
  sandbox.window.document = doc;
  sandbox.window.window = sandbox.window;

  const vmContext = vm.createContext(sandbox);
  vm.runInContext(extractorCode, vmContext);
  const Extractor = sandbox.window.QuizZyExtractor;
  return Extractor.extractQuizFromDom(doc);
});

console.log(JSON.stringify(results));
"""
    results = run_node_eval(audit_script)
    assert len(results) == 3, "Expected 3 audited question extraction results."

    # Question 1: Kadane
    kadane = results[0]
    assert kadane["success"] is True
    assert kadane["q_type"] == "order"
    assert "Kadane's Algorithm" in kadane["question"]
    assert len(kadane["options"]) == 5
    assert kadane["options"][0].startswith("Update maxSum")
    assert "curSum" in kadane["options"][0]
    assert not kadane["options"][0].startswith("1 ")  # Stripped slot number

    # Question 2: Binary Search
    bsearch = results[1]
    assert bsearch["success"] is True
    assert bsearch["q_type"] == "order"
    assert "Binary Search" in bsearch["question"]
    assert len(bsearch["options"]) == 5
    assert "arr[mid]" in bsearch["options"][0]

    # Question 3: SDLC
    sdlc = results[2]
    assert sdlc["success"] is True
    assert sdlc["q_type"] == "order"
    assert "Software Development Life Cycle" in sdlc["question"]
    assert len(sdlc["options"]) == 5
    assert "Implementation & Coding" in sdlc["options"]


def test_order_normalizer_accuracy():
    """Verify backend normalizer maps permutations and text sequences accurately."""
    from backend.core.normalizer import normalize_order_answer

    kadane_options = [
        "Update maxSum to be the maximum of maxSum and curSum .",
        "Initialize curSum to 0 and maxSum to negative infinity.",
        "If curSum becomes negative, reset it to 0 .",
        "Iterate through each element of the array, adding the current element to curSum .",
        "Return maxSum ."
    ]

    # Letters permutation: B, D, A, C, E
    norm_letters = normalize_order_answer("B, D, A, C, E", kadane_options)
    assert norm_letters.canonical_key == "B,D,A,C,E"
    assert norm_letters.permutation_indices == [1, 3, 0, 2, 4]
    assert norm_letters.ordered_texts[0].startswith("Initialize curSum")
    assert norm_letters.ordered_texts[1].startswith("Iterate through")
    assert norm_letters.ordered_texts[2].startswith("Update maxSum")
    assert norm_letters.ordered_texts[3].startswith("If curSum becomes")
    assert norm_letters.ordered_texts[4].startswith("Return maxSum")

    # Arrow-separated string: "B -> D -> A -> C -> E"
    norm_arrows = normalize_order_answer("B -> D -> A -> C -> E", kadane_options)
    assert norm_arrows.canonical_key == "B,D,A,C,E"
    assert norm_arrows.permutation_indices == [1, 3, 0, 2, 4]


def test_executor_live_dom_reorder_and_verification_gate():
    """Verify executor reorders HTML5 sortable DOM items and verifies final order."""
    exec_script = r"""
const path = require("path");
const QuizZyExecutor = require(path.join(process.cwd(), "extension", "executor.js"));

// Initial scrambled Kadane order: [A, B, C, D, E]
let items = [
  "Update maxSum to be the maximum of maxSum and curSum .",
  "Initialize curSum to 0 and maxSum to negative infinity.",
  "If curSum becomes negative, reset it to 0 .",
  "Iterate through each element of the array, adding the current element to curSum .",
  "Return maxSum ."
];

function createDomNodes() {
  return items.map((text, idx) => {
    return {
      tagName: "DIV",
      className: "sc-row-item draggable-item",
      draggable: true,
      innerText: text,
      textContent: text,
      getAttribute: (attr) => attr === "draggable" ? "true" : (attr === "data-id" ? "row-" + (idx + 1) : null),
      hasAttribute: (attr) => attr === "draggable" || attr === "data-id",
      getBoundingClientRect: () => ({ left: 10, top: 10 + idx * 50, width: 300, height: 40 }),
      scrollIntoView: () => {},
      parentElement: {
        children: null
      },
      dispatchEvent: function(event) {
        if (event.type === "dragstart") {
          global.__draggedItemText = text;
        } else if (event.type === "drop") {
          const srcText = global.__draggedItemText;
          const targetText = text;
          if (srcText && srcText !== targetText) {
            const srcIdx = items.indexOf(srcText);
            const tgtIdx = items.indexOf(targetText);
            items.splice(srcIdx, 1);
            items.splice(tgtIdx, 0, srcText);
          }
        }
        return true;
      }
    };
  });
}

global.document = {
  querySelectorAll: (sel) => {
    const nodes = createDomNodes();
    nodes.forEach(n => { n.parentElement.children = nodes; });
    return nodes;
  },
  querySelector: (sel) => {
    const all = global.document.querySelectorAll(sel);
    return all.length ? all[0] : null;
  }
};
global.window = { QuizZyExecutor, document: global.document };

(async () => {
  const payload = {
    q_type: "order",
    question_type: "order",
    answer: "B,D,A,C,E",
    permutation_indices: [1, 3, 0, 2, 4],
    ordered_indices: [1, 3, 0, 2, 4],
    ordered_texts: [
      "Initialize curSum to 0 and maxSum to negative infinity.",
      "Iterate through each element of the array, adding the current element to curSum .",
      "Update maxSum to be the maximum of maxSum and curSum .",
      "If curSum becomes negative, reset it to 0 .",
      "Return maxSum ."
    ],
    options: [
      "Update maxSum to be the maximum of maxSum and curSum .",
      "Initialize curSum to 0 and maxSum to negative infinity.",
      "If curSum becomes negative, reset it to 0 .",
      "Iterate through each element of the array, adding the current element to curSum .",
      "Return maxSum ."
    ]
  };

  const res = await QuizZyExecutor.executeOrderAction(payload);
  console.log(JSON.stringify({ executorResult: res, finalOrder: items }));
})();
"""
    out = run_node_eval(exec_script)
    res = out["executorResult"]
    assert res["ok"] is True or res["success"] is True, f"Expected ok: true, got {res}"
    assert res["verified_order"] is True or res["verified"] is True
    final_order = out["finalOrder"]
    assert final_order[0].startswith("Initialize curSum")
    assert final_order[1].startswith("Iterate through")
    assert final_order[2].startswith("Update maxSum")
    assert final_order[3].startswith("If curSum becomes")
    assert final_order[4].startswith("Return maxSum")
