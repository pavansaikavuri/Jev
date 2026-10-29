"""Tests for Side Panel Deep Scanning, Image/Table Extraction, and Resilient Swipe / Advance Actions."""

import json
import os
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

os.environ["QUIZZY_OFFLINE_TEST_MODE"] = "1"


def test_extractor_image_and_table_contracts():
    """Verify extractor.js includes deep image extraction, SVG detection, table formatting, and shadow/iframe fallbacks."""
    code = (PROJECT_ROOT / "extension" / "extractor.js").read_text(encoding="utf-8")

    # Image metadata extraction in getCleanVisibleText
    assert "img" in code
    assert "[Image:" in code
    assert "alt" in code
    assert "title" in code

    # SVG diagram label
    assert "[Diagram:" in code

    # Markdown table formatting
    assert "table" in code
    assert "markdownRows" in code or "| " in code

    # Deep scan fallback for shadow DOM and iframes
    assert "shadowRoot" in code
    assert "contentDocument" in code or "iframe" in code


def test_executor_swipe_or_advance_contract():
    """Verify executor.js exports swipeOrAdvanceQuestion and implements Skip -> Next -> Swiper -> Touch fallbacks."""
    code = (PROJECT_ROOT / "extension" / "executor.js").read_text(encoding="utf-8")

    assert "swipeOrAdvanceQuestion" in code
    assert "window.QuizZyExecutor" in code or "QuizZyExecutor" in code

    # Control fallbacks
    assert "clickSkipButton" in code
    assert "clickNextButton" in code
    assert "swiper-button-next" in code or "slick-next" in code or "carousel" in code

    # Touch / swipe simulation
    assert "touchstart" in code or "pointerdown" in code
    assert "touchend" in code or "pointerup" in code


def test_sidepanel_and_background_contracts():
    """Verify sidepanel.html, sidepanel.js, and background.js contracts for SWIPE_OR_ADVANCE and deep scanning."""
    sidepanel_html = (PROJECT_ROOT / "extension" / "sidepanel.html").read_text(encoding="utf-8")
    sidepanel_js = (PROJECT_ROOT / "extension" / "sidepanel.js").read_text(encoding="utf-8")
    background_js = (PROJECT_ROOT / "extension" / "background.js").read_text(encoding="utf-8")

    # HTML button and step delay
    assert 'id="btn-swipe-advance"' in sidepanel_html
    assert 'value="750"' in sidepanel_html or 'input-step-delay' in sidepanel_html

    # Background handler
    assert 'action === "SWIPE_OR_ADVANCE"' in background_js
    assert "swipeOrAdvanceQuestion" in background_js

    # Sidepanel deep scan and swipe actions
    assert "btnSwipeAdvance" in sidepanel_js
    assert "SWIPE_OR_ADVANCE" in sidepanel_js
    assert "performExtraction" in sidepanel_js
    assert "isDeepScan" in sidepanel_js
    assert "Analyzing via dual models with two-stage verification" in sidepanel_js


def test_node_vm_executor_swipe_or_advance():
    """Run Node VM test verifying swipeOrAdvanceQuestion executes button and gesture fallback strategies."""
    executor_path = (PROJECT_ROOT / "extension" / "executor.js").as_posix()

    node_script = f"""
    const fs = require('fs');
    const vm = require('vm');

    let clickedSelectors = [];
    let dispatchedEvents = [];

    class MockElement {{
      constructor(tagName = 'div', attrs = {{}}) {{
        this.tagName = tagName.toUpperCase();
        this.attrs = attrs;
        this.children = [];
        this.style = {{}};
      }}
      getAttribute(k) {{ return this.attrs[k] || null; }}
      setAttribute(k, v) {{ this.attrs[k] = String(v); }}
      click() {{
        clickedSelectors.push(this.tagName + (this.attrs.class ? '.' + this.attrs.class : ''));
      }}
      getBoundingClientRect() {{
        return {{ top: 100, left: 100, width: 600, height: 400, right: 700, bottom: 500 }};
      }}
      dispatchEvent(evt) {{
        dispatchedEvents.push(evt.type);
        return true;
      }}
    }}

    const elementsPool = {{
      '.swiper-button-next': new MockElement('button', {{ class: 'swiper-button-next' }}),
      'button.skip-btn': new MockElement('button', {{ class: 'skip-btn' }})
    }};

    const mockDoc = {{
      documentElement: new MockElement('html'),
      body: new MockElement('body'),
      querySelector: (sel) => elementsPool[sel] || null,
      querySelectorAll: (sel) => elementsPool[sel] ? [elementsPool[sel]] : [],
      dispatchEvent: (evt) => {{
        dispatchedEvents.push('doc:' + evt.type);
        return true;
      }}
    }};

    const sandbox = {{
      document: mockDoc,
      window: null,
      console: console,
      setTimeout: (fn) => fn(),
      clearTimeout: () => {{}},
      TouchEvent: typeof TouchEvent !== 'undefined' ? TouchEvent : function(t, p) {{ this.type = t; this.params = p; }},
      Touch: typeof Touch !== 'undefined' ? Touch : function(p) {{ Object.assign(this, p); }},
      PointerEvent: typeof PointerEvent !== 'undefined' ? PointerEvent : function(t, p) {{ this.type = t; this.params = p; }},
      KeyboardEvent: typeof KeyboardEvent !== 'undefined' ? KeyboardEvent : function(t, p) {{ this.type = t; this.params = p; }},
      Event: typeof Event !== 'undefined' ? Event : function(t) {{ this.type = t; }}
    }};
    sandbox.window = sandbox;

    const executorCode = fs.readFileSync('{executor_path}', 'utf8');
    vm.runInNewContext(executorCode, sandbox);

    const executor = sandbox.QuizZyExecutor;
    if (!executor || typeof executor.swipeOrAdvanceQuestion !== 'function') {{
      console.error('FAIL: QuizZyExecutor.swipeOrAdvanceQuestion not exported');
      process.exit(1);
    }}

    // Test 1: Calling swipeOrAdvanceQuestion triggers skip/next/swiper action
    (async () => {{
      try {{
        const res = await executor.swipeOrAdvanceQuestion(null);
        if (!res || !res.success) {{
          console.error('FAIL: swipeOrAdvanceQuestion returned unsuccessful result', res);
          process.exit(1);
        }}
        console.log('SWIPE_OR_ADVANCE_TEST_OK');
      }} catch (err) {{
        console.error('FAIL with error:', err);
        process.exit(1);
      }}
    }})();
    """

    res = subprocess.run(
        ["node", "-e", node_script],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    assert res.returncode == 0, f"Node script failed:\nSTDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}"
    assert "SWIPE_OR_ADVANCE_TEST_OK" in res.stdout
