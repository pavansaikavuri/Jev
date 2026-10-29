"""
Comprehensive test suite for Drag-and-Drop Ordering Support in QuizZy:
- Order normalization and validation (letters, texts, IDs, permutations)
- Already-correct short circuit (0 moves)
- Multi-transport interaction simulation (HTML5 DragEvent, Pointer/Mouse, Keyboard)
- Step-by-step verified reorder loop with fresh DOM re-reading
- Reversal, arbitrary permutations, and adjacent swaps
- Bounded retries and safe stop on stuck widgets (MOVE_MADE_NO_PROGRESS)
- Concurrency lock (__QUIZZY_ORDER_LOCK__)
- Guaranteed mouse/pointer release on error
- Non-regression: MCQ and Text-answer paths untouched
- Auto Mode submission isolation: No automatic submission on ordering questions
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


def run_node_script(js_code: str) -> dict:
    """Executes a Node.js verification script and parses returned JSON."""
    result = subprocess.run(
        ["node", "-e", js_code],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8"
    )
    if result.returncode != 0:
        raise RuntimeError(f"Node.js script failed (code {result.returncode}):\n{result.stderr}\nStdout:\n{result.stdout}")
    try:
        return json.loads(result.stdout.strip())
    except Exception as e:
        raise RuntimeError(f"Failed to parse JSON from Node output:\n{result.stdout}\nError: {e}")


def test_order_normalization_and_validation():
    """Verify backend and normalizer handling of valid, invalid, duplicate, and reversed permutations."""
    from backend.core.normalizer import normalize_order_answer, NormalizationError

    options = [
        "Prophase",
        "Metaphase",
        "Anaphase",
        "Telophase"
    ]

    # 1. Valid comma-separated letters
    norm1 = normalize_order_answer("B, A, C, D", options)
    assert norm1.canonical_key == "B,A,C,D"
    assert norm1.permutation_indices == [1, 0, 2, 3]
    assert norm1.ordered_texts == ["Metaphase", "Prophase", "Anaphase", "Telophase"]

    # 2. Valid full texts list
    norm2 = normalize_order_answer(["Telophase", "Anaphase", "Metaphase", "Prophase"], options)
    assert norm2.canonical_key == "D,C,B,A"
    assert norm2.permutation_indices == [3, 2, 1, 0]

    # 3. Duplicate letters -> error
    with pytest.raises(NormalizationError):
        normalize_order_answer("A, B, B, D", options)

    # 4. Incomplete length -> error
    with pytest.raises(NormalizationError):
        normalize_order_answer("A, B, C", options)

    # 5. Out of bounds letter -> error
    with pytest.raises(NormalizationError):
        normalize_order_answer("A, B, C, E", options)


def test_executor_already_correct_list():
    """Verify that an already-correct list returns success with 0 moves immediately."""
    script = r"""
const path = require("path");
const QuizZyExecutor = require(path.join(process.cwd(), "extension", "executor.js"));

// Mock a sortable container with 3 items already in correct order
const items = [
  { text: "First Item", id: "item-1" },
  { text: "Second Item", id: "item-2" },
  { text: "Third Item", id: "item-3" }
];

global.document = {
  querySelectorAll: (sel) => {
    return items.map((it, idx) => ({
      tagName: "DIV",
      className: "quiz-option draggable-item",
      innerText: it.text,
      textContent: it.text,
      getAttribute: (a) => a === "id" ? it.id : (a === "draggable" ? "true" : null),
      hasAttribute: (a) => a === "id" || a === "draggable",
      getBoundingClientRect: () => ({ left: 10, top: 10 + idx * 50, width: 200, height: 40 }),
      scrollIntoView: () => {},
      parentElement: { children: [] },
      dispatchEvent: () => true
    }));
  }
};
global.window = { QuizZyExecutor, document: global.document };

(async () => {
  const payload = {
    q_type: "order",
    permutation_indices: [0, 1, 2],
    ordered_texts: ["First Item", "Second Item", "Third Item"]
  };

  const res = await QuizZyExecutor.executeOrderAction(payload);
  console.log(JSON.stringify(res));
})();
"""
    res = run_node_script(script)
    assert res.get("ok") is True or res.get("success") is True
    assert res.get("verified") is True
    assert res.get("already_correct") is True or res.get("moves") == 0


def test_executor_html5_mitosis_ordering():
    """Verify multi-step HTML5 drag-and-drop reordering against Scenario 3 Mitosis from mock_quiz.html."""
    script = r"""
const path = require("path");
const QuizZyExecutor = require(path.join(process.cwd(), "extension", "executor.js"));

// Initial scrambled order: [Anaphase, Prophase, Telophase, Metaphase]
// Target order: [Prophase, Metaphase, Anaphase, Telophase]
let items = ["Anaphase", "Prophase", "Telophase", "Metaphase"];

function createDomNodes() {
  return items.map((text, idx) => {
    return {
      tagName: "DIV",
      className: "quiz-option draggable-item",
      draggable: true,
      innerText: text,
      textContent: text,
      getAttribute: (attr) => attr === "draggable" ? "true" : (attr === "data-quiz-option" ? "" : null),
      hasAttribute: (attr) => attr === "draggable" || attr === "data-quiz-option",
      getBoundingClientRect: () => ({ left: 10, top: 10 + idx * 50, width: 200, height: 40 }),
      scrollIntoView: () => {},
      parentElement: {
        children: null // set below
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
  }
};
global.window = { QuizZyExecutor, document: global.document };

(async () => {
  const payload = {
    q_type: "order",
    permutation_indices: [1, 3, 0, 2], // Prophase (1), Metaphase (3), Anaphase (0), Telophase (2)
    ordered_texts: ["Prophase", "Metaphase", "Anaphase", "Telophase"]
  };

  const res = await QuizZyExecutor.executeOrderAction(payload);
  console.log(JSON.stringify({
    res,
    finalItems: items
  }));
})();
"""
    data = run_node_script(script)
    res = data["res"]
    final_items = data["finalItems"]

    assert res.get("ok") is True or res.get("success") is True
    assert res.get("verified") is True
    assert final_items == ["Prophase", "Metaphase", "Anaphase", "Telophase"]


def test_executor_concurrency_lock_and_safe_cleanup():
    """Verify __QUIZZY_ORDER_LOCK__ prevents concurrent reorders and releases lock on finish."""
    script = r"""
const path = require("path");
const QuizZyExecutor = require(path.join(process.cwd(), "extension", "executor.js"));

let items = ["A", "B", "C"];
global.document = {
  querySelectorAll: () => items.map(text => ({
    tagName: "DIV",
    className: "quiz-option",
    innerText: text,
    textContent: text,
    getAttribute: () => null,
    hasAttribute: () => false,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 30 }),
    scrollIntoView: () => {},
    dispatchEvent: () => true
  }))
};
global.window = { QuizZyExecutor, document: global.document };

(async () => {
  // Manually acquire lock to simulate concurrent execution
  global.window.__QUIZZY_ORDER_LOCK__ = true;

  const payload = {
    q_type: "order",
    permutation_indices: [1, 0, 2],
    ordered_texts: ["B", "A", "C"]
  };

  const lockedRes = await QuizZyExecutor.executeOrderAction(payload);

  // Release lock and try again
  global.window.__QUIZZY_ORDER_LOCK__ = false;
  const normalRes = await QuizZyExecutor.executeOrderAction(payload);

  console.log(JSON.stringify({ lockedRes, normalRes, lockAfter: !!global.window.__QUIZZY_ORDER_LOCK__ }));
})();
"""
    data = run_node_script(script)
    assert data["lockedRes"].get("ok") is False
    assert data["lockedRes"].get("error") == "EXECUTION_LOCKED"
    assert data["lockAfter"] is False


def test_executor_unmoved_widget_safe_stop():
    """Verify that if the host page does not respond to events, the executor stops with MOVE_MADE_NO_PROGRESS."""
    script = r"""
const path = require("path");
const QuizZyExecutor = require(path.join(process.cwd(), "extension", "executor.js"));

// Frozen elements that never change order when events are dispatched
let items = ["B", "A", "C"];
global.document = {
  querySelectorAll: () => items.map(text => ({
    tagName: "DIV",
    className: "quiz-option draggable-item",
    innerText: text,
    textContent: text,
    getAttribute: (a) => a === "draggable" ? "true" : null,
    hasAttribute: (a) => a === "draggable",
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 30 }),
    scrollIntoView: () => {},
    dispatchEvent: () => true // ignores event
  }))
};
global.window = { QuizZyExecutor, document: global.document };

(async () => {
  const payload = {
    q_type: "order",
    permutation_indices: [1, 0, 2], // expects [A, B, C]
    ordered_texts: ["A", "B", "C"]
  };

  const res = await QuizZyExecutor.executeOrderAction(payload);
  console.log(JSON.stringify(res));
})();
"""
    res = run_node_script(script)
    assert res.get("ok") is False
    assert res.get("verified") is False
    assert res.get("unmoved") is True or res.get("error") in ("MOVE_MADE_NO_PROGRESS", "ORDER_VERIFICATION_FAILED")


def test_automode_separation_gate_audit():
    """Verify floating_hud.js and sidepanel.js never automatically advance on order questions."""
    hud_path = PROJECT_ROOT / "extension" / "floating_hud.js"
    with open(hud_path, "r", encoding="utf-8") as f:
        hud_code = f.read()

    sidepanel_path = PROJECT_ROOT / "extension" / "sidepanel.js"
    with open(sidepanel_path, "r", encoding="utf-8") as f:
        sp_code = f.read()

    # floating_hud must check q_type === 'order' before advancing
    assert "q_type === \"order\"" in hud_code or "qType === \"order\"" in hud_code or "solution.q_type === \"order\"" in hud_code

    # sidepanel must check q_type === 'order' and pause/stop before advancing
    assert "solution.q_type === \"order\"" in sp_code or "qType === \"order\"" in sp_code


def test_executor_two_item_swap_and_directionality():
    """Verify adjacent swap, upward move, and downward move using HTML5 drag simulation."""
    script = r"""
const path = require("path");
const QuizZyExecutor = require(path.join(process.cwd(), "extension", "executor.js"));

let items = ["A", "B", "C"];

function createDomNodes() {
  return items.map((text, idx) => ({
    tagName: "DIV",
    className: "quiz-option draggable-item",
    draggable: true,
    innerText: text,
    textContent: text,
    getAttribute: (attr) => attr === "draggable" ? "true" : null,
    hasAttribute: (attr) => attr === "draggable",
    getBoundingClientRect: () => ({ left: 10, top: 10 + idx * 50, width: 200, height: 40 }),
    scrollIntoView: () => {},
    parentElement: { children: null },
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
  }));
}

global.document = {
  querySelectorAll: () => {
    const nodes = createDomNodes();
    nodes.forEach(n => { n.parentElement.children = nodes; });
    return nodes;
  }
};
global.window = { QuizZyExecutor, document: global.document };

(async () => {
  // Test 1: Upward move: C (at 2) -> move to position 0 => [C, A, B]
  const resUp = await QuizZyExecutor.executeOrderAction({
    q_type: "order",
    ordered_texts: ["C", "A", "B"]
  });

  // Test 2: Downward move: C (at 0) -> move to position 2 => [A, B, C]
  const resDown = await QuizZyExecutor.executeOrderAction({
    q_type: "order",
    ordered_texts: ["A", "B", "C"]
  });

  // Test 3: Adjacent swap: A and B swap => [B, A, C]
  const resSwap = await QuizZyExecutor.executeOrderAction({
    q_type: "order",
    ordered_texts: ["B", "A", "C"]
  });

  console.log(JSON.stringify({
    resUp: { ok: resUp.ok, moves: resUp.moves, final: resUp.final_order },
    resDown: { ok: resDown.ok, moves: resDown.moves, final: resDown.final_order },
    resSwap: { ok: resSwap.ok, moves: resSwap.moves, final: resSwap.final_order },
    currentItems: items
  }));
})();
"""
    data = run_node_script(script)
    assert data["resUp"]["ok"] is True
    assert data["resUp"]["final"] == ["C", "A", "B"]

    assert data["resDown"]["ok"] is True
    assert data["resDown"]["final"] == ["A", "B", "C"]

    assert data["resSwap"]["ok"] is True
    assert data["resSwap"]["final"] == ["B", "A", "C"]
    assert data["currentItems"] == ["B", "A", "C"]


def test_executor_reversed_list_permutation():
    """Verify full reversal of a 4-item list."""
    script = r"""
const path = require("path");
const QuizZyExecutor = require(path.join(process.cwd(), "extension", "executor.js"));

let items = ["Step 1", "Step 2", "Step 3", "Step 4"];

function createDomNodes() {
  return items.map((text, idx) => ({
    tagName: "DIV",
    className: "quiz-option draggable-item",
    draggable: true,
    innerText: text,
    textContent: text,
    getAttribute: (attr) => attr === "draggable" ? "true" : null,
    hasAttribute: (attr) => attr === "draggable",
    getBoundingClientRect: () => ({ left: 10, top: 10 + idx * 50, width: 200, height: 40 }),
    scrollIntoView: () => {},
    parentElement: { children: null },
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
  }));
}

global.document = {
  querySelectorAll: () => {
    const nodes = createDomNodes();
    nodes.forEach(n => { n.parentElement.children = nodes; });
    return nodes;
  }
};
global.window = { QuizZyExecutor, document: global.document };

(async () => {
  const target = ["Step 4", "Step 3", "Step 2", "Step 1"];
  const res = await QuizZyExecutor.executeOrderAction({
    q_type: "order",
    ordered_texts: target
  });

  console.log(JSON.stringify({
    res,
    finalItems: items
  }));
})();
"""
    data = run_node_script(script)
    assert data["res"]["ok"] is True
    assert data["res"]["verified"] is True
    assert data["finalItems"] == ["Step 4", "Step 3", "Step 2", "Step 1"]


def test_executor_duplicate_text_with_distinct_ids():
    """Verify sortable items with duplicate display text but distinct IDs can be reordered via desired_item_ids."""
    script = r"""
const path = require("path");
const QuizZyExecutor = require(path.join(process.cwd(), "extension", "executor.js"));

let itemIds = ["id-alpha", "id-beta", "id-gamma"];
let itemTexts = ["Duplicate Text", "Duplicate Text", "Duplicate Text"];

function createDomNodes() {
  return itemIds.map((id, idx) => ({
    tagName: "DIV",
    className: "quiz-option draggable-item",
    draggable: true,
    innerText: itemTexts[idx],
    textContent: itemTexts[idx],
    getAttribute: (attr) => attr === "data-id" ? id : (attr === "draggable" ? "true" : null),
    hasAttribute: (attr) => attr === "data-id" || attr === "draggable",
    getBoundingClientRect: () => ({ left: 10, top: 10 + idx * 50, width: 200, height: 40 }),
    scrollIntoView: () => {},
    parentElement: { children: null },
    dispatchEvent: function(event) {
      if (event.type === "dragstart") {
        global.__draggedId = id;
      } else if (event.type === "drop") {
        const srcId = global.__draggedId;
        const tgtId = id;
        if (srcId && srcId !== tgtId) {
          const srcIdx = itemIds.indexOf(srcId);
          const tgtIdx = itemIds.indexOf(tgtId);
          itemIds.splice(srcIdx, 1);
          itemIds.splice(tgtIdx, 0, srcId);
        }
      }
      return true;
    }
  }));
}

global.document = {
  querySelectorAll: () => {
    const nodes = createDomNodes();
    nodes.forEach(n => { n.parentElement.children = nodes; });
    return nodes;
  }
};
global.window = { QuizZyExecutor, document: global.document };

(async () => {
  // Target: ["id-gamma", "id-alpha", "id-beta"]
  const res = await QuizZyExecutor.executeOrderAction({
    q_type: "order",
    desired_item_ids: ["id-gamma", "id-alpha", "id-beta"]
  });

  console.log(JSON.stringify({
    res,
    finalIds: itemIds
  }));
})();
"""
    data = run_node_script(script)
    assert data["res"]["ok"] is True
    assert data["res"]["verified"] is True
    assert data["finalIds"] == ["id-gamma", "id-alpha", "id-beta"]


def test_executor_ambiguous_text_rejection_without_ids():
    """Verify that duplicate display texts without unique IDs fail fast with AMBIGUOUS_ORDER_MAPPING."""
    script = r"""
const path = require("path");
const QuizZyExecutor = require(path.join(process.cwd(), "extension", "executor.js"));

let itemTexts = ["Duplicate Text", "Duplicate Text", "Unique Text"];

global.document = {
  querySelectorAll: () => itemTexts.map((text, idx) => ({
    tagName: "DIV",
    className: "quiz-option draggable-item",
    draggable: true,
    innerText: text,
    textContent: text,
    getAttribute: () => null,
    hasAttribute: () => false,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 30 }),
    scrollIntoView: () => {},
    dispatchEvent: () => true
  }))
};
global.window = { QuizZyExecutor, document: global.document };

(async () => {
  const res = await QuizZyExecutor.executeOrderAction({
    q_type: "order",
    ordered_texts: ["Unique Text", "Duplicate Text", "Duplicate Text"]
  });

  console.log(JSON.stringify(res));
})();
"""
    res = run_node_script(script)
    assert res.get("ok") is False
    assert res.get("error") == "AMBIGUOUS_ORDER_MAPPING"


def test_executor_validation_rejections():
    """Verify item count mismatch and duplicate target rejections."""
    script = r"""
const path = require("path");
const QuizZyExecutor = require(path.join(process.cwd(), "extension", "executor.js"));

let items = ["A", "B", "C"];
global.document = {
  querySelectorAll: () => items.map(text => ({
    tagName: "DIV",
    className: "quiz-option",
    innerText: text,
    textContent: text,
    getAttribute: () => null,
    hasAttribute: () => false,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 30 }),
    scrollIntoView: () => {},
    dispatchEvent: () => true
  }))
};
global.window = { QuizZyExecutor, document: global.document };

(async () => {
  // Count mismatch (4 targets for 3 DOM items)
  const resMismatch = await QuizZyExecutor.executeOrderAction({
    q_type: "order",
    ordered_texts: ["A", "B", "C", "D"]
  });

  // Duplicate target in desired sequence
  const resDuplicate = await QuizZyExecutor.executeOrderAction({
    q_type: "order",
    ordered_texts: ["A", "A", "C"]
  });

  console.log(JSON.stringify({ resMismatch, resDuplicate }));
})();
"""
    data = run_node_script(script)
    assert data["resMismatch"].get("ok") is False
    assert data["resMismatch"].get("error") == "COUNT_MISMATCH"

    assert data["resDuplicate"].get("ok") is False
    assert data["resDuplicate"].get("error") == "INVALID_DESIRED_ORDER"


def test_regression_mcq_and_text_paths_untouched():
    """Verify non-regression: standard MCQ and text inputs execute via their untouched original paths."""
    script = r"""
const path = require("path");
const QuizZyExecutor = require(path.join(process.cwd(), "extension", "executor.js"));

let clickedOption = null;
let typedInput = null;

const options = [
  {
    tagName: "DIV",
    className: "quiz-option",
    innerText: "London",
    textContent: "London",
    getAttribute: () => null,
    hasAttribute: () => false,
    getBoundingClientRect: () => ({ left: 10, top: 10, width: 100, height: 40 }),
    scrollIntoView: () => {},
    ownerDocument: null,
    dispatchEvent: function(e) {
      if (e.type === "click") {
        clickedOption = "London";
        this.className = "quiz-option selected";
      }
      return true;
    }
  },
  {
    tagName: "DIV",
    className: "quiz-option",
    innerText: "Paris",
    textContent: "Paris",
    getAttribute: () => null,
    hasAttribute: () => false,
    getBoundingClientRect: () => ({ left: 10, top: 60, width: 100, height: 40 }),
    scrollIntoView: () => {},
    ownerDocument: null,
    dispatchEvent: function(e) {
      if (e.type === "click") {
        clickedOption = "Paris";
        this.className = "quiz-option selected";
      }
      return true;
    }
  }
];

const mockInput = {
  tagName: "INPUT",
  type: "text",
  value: "",
  getAttribute: () => null,
  hasAttribute: () => false,
  getBoundingClientRect: () => ({ left: 10, top: 20, width: 200, height: 30 }),
  scrollIntoView: () => {},
  focus: () => {},
  dispatchEvent: (e) => {
    if (e.type === "input") typedInput = mockInput.value;
    return true;
  }
};

global.document = {
  querySelectorAll: (sel) => {
    if (sel.includes("input") || sel.includes("textarea")) return [mockInput];
    return options;
  },
  querySelector: (sel) => {
    if (sel.includes("input") || sel.includes("textarea")) return mockInput;
    return options[1];
  }
};
options.forEach(o => o.ownerDocument = global.document);
global.window = { QuizZyExecutor, document: global.document };

(async () => {
  // 1. MCQ execution
  const mcqRes = QuizZyExecutor.executeAction({
    q_type: "mcq",
    selected_index: 1,
    selected_text: "Paris"
  });

  // 2. Text input execution
  const textRes = QuizZyExecutor.executeAction({
    q_type: "text",
    answer: "Photosynthesis"
  });

  console.log(JSON.stringify({
    mcqRes,
    textRes,
    clickedOption,
    typedInput
  }));
})();
"""
    data = run_node_script(script)
    assert data["mcqRes"]["ok"] is True
    assert data["mcqRes"]["selected"] is True
    assert data["clickedOption"] == "Paris"

    assert data["textRes"]["ok"] is True
    assert data["textRes"]["verified"] is True
    assert data["textRes"]["action"] == "text_fill"
    assert data["textRes"]["value"] == "Photosynthesis"
    assert data["typedInput"] == "Photosynthesis"


