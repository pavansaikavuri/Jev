"""
Phase 7 Stealth Defense & Anti-Detection Test Suite:
Verifies MAIN-World Stealth Shield, Zero-DOM Enforcement on live coding pages,
SPA Route Unmounting, Boilerplate Preservation (#include, namespace, struct Node),
and Run / Submit / Testcase Drawer Automation.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

# Ensure workspace root is in sys.path
WORKSPACE_ROOT = Path(__file__).resolve().parent.parent
if str(WORKSPACE_ROOT) not in sys.path:
    sys.path.insert(0, str(WORKSPACE_ROOT))

os.environ["QUIZZY_OFFLINE_TEST_MODE"] = "1"

import pytest


def test_1_stealth_shield_blocks_extension_probing_and_spoofs_is_trusted():
    """
    Test 1: Early-Initialization MAIN-World Lifecycle & Coordination Shield.
    Verifies that stealth_shield.js running in the MAIN world:
    a) Leaves browser globals (fetch, XMLHttpRequest, HTMLImageElement, Event.isTrusted) untouched (zero tampering),
    b) Deterministically evaluates authorized dev/staging environments vs unauthorized production platforms,
    c) Gating: isAutomationAuthorized() is true only in authorized testing environments,
    d) Provides diagnostic recording for security scanner events without interfering with the host site.
    """
    print("\n[Stealth Defense - Test 1] Verifying MAIN-world Early-Init Coordination & Authorization...")

    shield_path = (WORKSPACE_ROOT / "extension" / "stealth_shield.js").as_posix()

    node_script = f"""
    const fs = require('fs');

    // 1. Setup mock environment before shield runs
    const origFetch = async () => ({{ ok: true }});
    global.window = {{
      fetch: origFetch,
      location: {{
        href: "http://localhost:3000/question/demo-test",
        hostname: "localhost",
        origin: "http://localhost:3000",
        pathname: "/question/demo-test"
      }}
    }};

    class MockXHR {{}}
    global.XMLHttpRequest = MockXHR;
    global.window.XMLHttpRequest = MockXHR;

    class MockImage {{}}
    global.HTMLImageElement = MockImage;
    global.window.HTMLImageElement = MockImage;

    class MockEvent {{
      constructor(type) {{
        this.type = type;
      }}
    }}
    Object.defineProperty(MockEvent.prototype, "isTrusted", {{
      get: function() {{ return false; }},
      configurable: true
    }});
    global.Event = MockEvent;
    global.window.Event = MockEvent;

    global.document = {{
      documentElement: {{}},
      body: {{ style: {{}} }},
      querySelectorAll: () => [],
      querySelector: () => null,
      addEventListener: () => {{}}
    }};

    // 2. Load stealth_shield.js
    const shieldCode = fs.readFileSync('{shield_path}', 'utf8');
    eval(shieldCode);

    // 3. Verify zero tampering with global browser APIs
    if (window.fetch !== origFetch) {{
      console.error("FAIL: window.fetch was monkey-patched by stealth_shield.js!");
      process.exit(1);
    }}
    if (global.XMLHttpRequest !== MockXHR) {{
      console.error("FAIL: XMLHttpRequest was altered!");
      process.exit(1);
    }}
    const testEv = new MockEvent("click");
    if (testEv.isTrusted !== false) {{
      console.error("FAIL: Event.prototype.isTrusted was falsified!");
      process.exit(1);
    }}

    // 4. Verify coordination interface exists
    const coord = window.__QUIZZY_COORDINATION__;
    if (!coord) {{
      console.error("FAIL: __QUIZZY_COORDINATION__ was not exposed on window!");
      process.exit(1);
    }}

    // 5. Test environment authorization logic
    if (!coord.isAutomationAuthorized()) {{
      console.error("FAIL: Expected isAutomationAuthorized() === true for localhost!");
      process.exit(1);
    }}

    const prodLoc = {{
      href: "https://learning.ccbp.in/question/625aef64-b820-482e-9168-5191191daa88",
      hostname: "learning.ccbp.in",
      origin: "https://learning.ccbp.in",
      pathname: "/question/625aef64-b820-482e-9168-5191191daa88"
    }};
    if (coord.isAuthorizedEnvironment(prodLoc)) {{
      console.error("FAIL: learning.ccbp.in must NOT be recognized as an authorized dev/staging environment!");
      process.exit(1);
    }}

    const stagingLoc = {{
      href: "https://qa.staging.quizzy.internal/test-harness",
      hostname: "qa.staging.quizzy.internal",
      origin: "https://qa.staging.quizzy.internal"
    }};
    if (!coord.isAuthorizedEnvironment(stagingLoc)) {{
      console.error("FAIL: Expected staging.quizzy.internal to be authorized!");
      process.exit(1);
    }}

    // 6. Test diagnostic recording
    coord.recordDiagnostic({{ event: "host_scanner_check", detected: true }});
    const diags = coord.getDiagnostics();
    if (!diags || diags.length !== 1 || diags[0].data.event !== "host_scanner_check") {{
      console.error("FAIL: recordDiagnostic failed to record event for diagnosis:", diags);
      process.exit(1);
    }}

    console.log("SUCCESS: Early-init coordination verified with zero global tampering and strict environment authorization");
    """

    res = subprocess.run(
        ["node", "-e", node_script],
        cwd=str(WORKSPACE_ROOT),
        capture_output=True,
        text=True
    )
    if res.returncode != 0:
        print("Node stdout:", res.stdout)
        print("Node stderr:", res.stderr)
    assert res.returncode == 0, f"Stealth shield test failed with exit code {res.returncode}"
    print("  -> Passed MAIN-World Early-Init Coordination and Authorization Verification")


def test_2_zero_dom_stealth_on_real_coding_practice_dom():
    """
    Test 2: Zero-DOM Stealth on Realistic Coding Practice Page.
    Simulates learning.ccbp.in/question/625aef64-... with CODING PRACTICE header,
    Ace/Monaco editor, and Submit button. Verifies floating_hud.js causes exactly 0
    DOM mutations and refuses to mount in-page elements.
    """
    print("\n[Stealth Defense - Test 2] Verifying Zero-DOM Footprint on Coding Practice DOM...")

    floating_hud_path = (WORKSPACE_ROOT / "extension" / "floating_hud.js").as_posix()

    node_script = f"""
    const fs = require('fs');

    const mutations = [];

    class MockNode {{
      constructor(tag) {{
        this.tagName = tag.toUpperCase();
        this.nodeType = 1;
        this.childNodes = [];
        this.attributes = {{}};
        this.className = "";
        this.parentElement = null;
      }}
      appendChild(c) {{
        mutations.push({{ type: "appendChild", target: this.tagName, child: c.tagName }});
        this.childNodes.push(c);
        c.parentElement = this;
        return c;
      }}
      setAttribute(k, v) {{
        mutations.push({{ type: "setAttribute", key: k, val: v }});
        this.attributes[k] = v;
      }}
      getAttribute(k) {{ return this.attributes[k] || null; }}
    }}

    const docElement = new MockNode("html");
    const body = new MockNode("body");
    docElement.appendChild(body);

    // Realistic CCBP Coding Practice text containing "CODING PRACTICE | ...", "Submit", and "▶ Run"
    body.innerText = `CODING PRACTICE | Deletion At Head - Doubly Linked List
Given the head of a doubly linked list, remove the head node and return the new head.
Your Task: Complete the function deleteHead(head).
Constraints: 1 <= N <= 10^5
Submit
▶ Run`;

    global.window = {{
      location: {{
        hostname: "learning.ccbp.in",
        pathname: "/question/625aef64-b820-482e-9168-5191191daa88",
        href: "https://learning.ccbp.in/question/625aef64-b820-482e-9168-5191191daa88"
      }},
      addEventListener: () => {{}},
      removeEventListener: () => {{}}
    }};

    global.document = {{
      documentElement: docElement,
      body: body,
      getElementById: (id) => null,
      querySelector: (sel) => {{
        if (sel.includes("ace") || sel.includes("monaco")) return {{ className: "ace_editor" }};
        return null;
      }},
      querySelectorAll: (sel) => {{
        if (sel.includes("radio") || sel.includes("checkbox")) return [];
        if (sel.includes("button")) return [
          {{ innerText: "Submit", textContent: "Submit", closest: () => null }},
          {{ innerText: "▶ Run", textContent: "▶ Run", closest: () => null }}
        ];
        return [];
      }},
      createElement: (tag) => new MockNode(tag)
    }};

    global.chrome = {{
      runtime: {{
        sendMessage: () => {{}},
        onMessage: {{ addListener: () => {{}} }}
      }}
    }};

    mutations.length = 0;

    delete require.cache[require.resolve('{floating_hud_path}')];
    const hudModule = require('{floating_hud_path}');

    if (mutations.length !== 0) {{
      console.error("FAIL: floating_hud.js mutated DOM on coding page! Mutations:", mutations);
      process.exit(1);
    }}

    if (hudModule.mounted === true) {{
      console.error("FAIL: floating_hud.js reported mounted === true on coding page");
      process.exit(1);
    }}

    console.log("SUCCESS: Exactly 0 DOM mutations recorded on CCBP Coding Practice page");
    """

    res = subprocess.run(
        ["node", "-e", node_script],
        cwd=str(WORKSPACE_ROOT),
        capture_output=True,
        text=True
    )
    if res.returncode != 0:
        print("Node stdout:", res.stdout)
        print("Node stderr:", res.stderr)
    assert res.returncode == 0, f"Zero-DOM test failed with exit code {res.returncode}"
    print("  -> Passed Zero-DOM Verification on Live Coding Practice DOM")


def test_3_spa_route_transition_unmounts_leaked_hud():
    """
    Test 3: Active SPA Route Transition Unmount.
    Verifies that if an in-page HUD was mounted on an MCQ page, navigating to /question/*
    via client-side SPA routing immediately unmounts and removes the HUD host from the DOM.
    """
    print("\n[Stealth Defense - Test 3] Verifying SPA Route Transition Unmount...")

    floating_hud_path = (WORKSPACE_ROOT / "extension" / "floating_hud.js").as_posix()

    node_script = f"""
    let hostRemoved = false;
    const mockHost = {{
      id: "__quizzy_hud_host__",
      remove: () => {{ hostRemoved = true; }},
      parentNode: {{
        removeChild: (el) => {{ if (el === mockHost) hostRemoved = true; }}
      }}
    }};

    let currentPath = "/course/mcq-practice/123";

    global.window = {{
      location: {{
        get pathname() {{ return currentPath; }}
      }},
      addEventListener: (ev, fn) => {{
        if (ev === "popstate") global.window._popstateFn = fn;
      }}
    }};

    global.document = {{
      body: {{ innerText: "MCQ Quiz Page" }},
      getElementById: (id) => {{
        if (id === "__quizzy_hud_host__") return hostRemoved ? null : mockHost;
        return null;
      }},
      querySelector: () => null,
      querySelectorAll: (sel) => sel.includes("radio") ? [{{}}, {{}}] : []
    }};

    global.chrome = {{
      runtime: {{ sendMessage: () => {{}}, onMessage: {{ addListener: () => {{}} }} }}
    }};

    delete require.cache[require.resolve('{floating_hud_path}')];
    const hud = require('{floating_hud_path}');

    // Simulate SPA navigation to coding practice route /question/625aef64-...
    currentPath = "/question/625aef64-b820-482e-9168-5191191daa88";
    global.document.body.innerText = "CODING PRACTICE | Deletion At Head";

    // Trigger popstate listener
    if (global.window._popstateFn) {{
      global.window._popstateFn();
    }}

    // Check if host was removed
    if (!hostRemoved) {{
      // Test destroyInPageHudIfPresent directly if popstate was not fired
      delete require.cache[require.resolve('{floating_hud_path}')];
      require('{floating_hud_path}');
    }}

    if (!hostRemoved) {{
      console.error("FAIL: __quizzy_hud_host__ was NOT removed from DOM on coding route!");
      process.exit(1);
    }}

    console.log("SUCCESS: In-page HUD cleanly unmounted and destroyed on SPA navigation to /question/*");
    """

    res = subprocess.run(
        ["node", "-e", node_script],
        cwd=str(WORKSPACE_ROOT),
        capture_output=True,
        text=True
    )
    if res.returncode != 0:
        print("Node stdout:", res.stdout)
        print("Node stderr:", res.stderr)
    assert res.returncode == 0, f"SPA unmount test failed with exit code {res.returncode}"
    print("  -> Passed SPA Route Transition Unmount Verification")


def test_4_boilerplate_and_comment_preservation_in_editor_typing():
    """
    Test 4: Boilerplate & Comment Preservation (#include, namespace, struct Node).
    Verifies that lines 1-20 containing includes, namespaces, and data structures are
    strictly preserved when writing code into Ace or Monaco editors.
    """
    print("\n[Stealth Defense - Test 4] Verifying Boilerplate & Comment Preservation...")

    executor_path = (WORKSPACE_ROOT / "extension" / "executor.js").as_posix()

    node_script = f"""
    const initialBuffer = `#include<bits/stdc++.h>
using namespace std;

/*
class Node {{
    int data;
    Node* next;
    Node* prev;
    Node(int val) {{
        data = val;
        next = nullptr;
        prev = nullptr;
    }}
}};
*/

class solution {{
  public:
    Node* deleteHead(Node* head) {{
        // Write your code here
    }}
}};`;

    const targetCode = `class solution {{
  public:
    Node* deleteHead(Node* head) {{
        if (head == nullptr || head->next == nullptr) return nullptr;
        Node* newHead = head->next;
        newHead->prev = nullptr;
        return newHead;
    }}
}};`;

    let writtenVal = initialBuffer;
    const mockAce = {{
      getValue: () => writtenVal,
      setValue: (v) => {{ writtenVal = v; }},
      session: {{
        doc: {{ setValue: (v) => {{ writtenVal = v; }} }}
      }}
    }};

    global.window = {{ ace: {{ edit: () => mockAce }} }};
    global.document = {{
      querySelector: (sel) => sel.includes(".ace_editor") ? {{ className: "ace_editor" }} : null,
      querySelectorAll: () => []
    }};

    const QuizZyExecutor = require('{executor_path}');
    const res = QuizZyExecutor.writeCodeWithHumanTypingInMainWorld({{ code: targetCode }});

    if (!res || !res.success) {{
      console.error("FAIL: writeCodeWithHumanTypingInMainWorld failed:", res);
      process.exit(1);
    }}

    const finalCode = mockAce.getValue();
    if (!finalCode.includes("#include<bits/stdc++.h>")) {{
      console.error("FAIL: #include<bits/stdc++.h> was stripped! Got:", finalCode);
      process.exit(1);
    }}
    if (!finalCode.includes("using namespace std;")) {{
      console.error("FAIL: using namespace std; was stripped! Got:", finalCode);
      process.exit(1);
    }}
    if (!finalCode.includes("class Node")) {{
      console.error("FAIL: class Node data structure definition was stripped! Got:", finalCode);
      process.exit(1);
    }}
    if (!finalCode.includes("newHead->prev = nullptr")) {{
      console.error("FAIL: Solution body missing from written value! Got:", finalCode);
      process.exit(1);
    }}

    console.log("SUCCESS: Lines 1-20 boilerplate (#include, namespace, class Node) 100% preserved");
    """

    res = subprocess.run(
        ["node", "-e", node_script],
        cwd=str(WORKSPACE_ROOT),
        capture_output=True,
        text=True
    )
    if res.returncode != 0:
        print("Node stdout:", res.stdout)
        print("Node stderr:", res.stderr)
    assert res.returncode == 0, f"Boilerplate preservation test failed with exit code {res.returncode}"
    print("  -> Passed Lines 1-20 Boilerplate & Data Structure Preservation")


def test_5_run_and_submit_buttons_and_testcases_drawer():
    """
    Test 5: Live Button Anatomy & Testcases Drawer Detection.
    Verifies findCompileAndRunButton matches '▶ Run' and 'Run',
    findCodingSubmitButton matches 'Submit', and pollOutputConsole detects
    testcase results in drawer.
    """
    print("\n[Stealth Defense - Test 5] Verifying Run & Submit Buttons & Testcases Drawer...")

    executor_path = (WORKSPACE_ROOT / "extension" / "executor.js").as_posix()

    node_script = f"""
    const QuizZyExecutor = require('{executor_path}');

    // Mock DOM with live buttons
    const mockRunBtn = {{
      tagName: "BUTTON",
      nodeType: 1,
      innerText: "▶ Run",
      textContent: "▶ Run",
      closest: () => null
    }};
    const mockSubmitBtn = {{
      tagName: "BUTTON",
      nodeType: 1,
      innerText: "Submit",
      textContent: "Submit",
      closest: () => null
    }};

    const mockDoc = {{
      querySelectorAll: (sel) => {{
        if (sel.includes("button")) return [mockRunBtn, mockSubmitBtn];
        if (sel.includes("testcase") || sel.includes("drawer")) return [
          {{ innerText: "Testcase 1: Passed\\nTestcase 2: Passed\\nAll Test Cases Passed", closest: () => null }}
        ];
        return [];
      }}
    }};

    const foundRun = QuizZyExecutor.findCompileAndRunButton(mockDoc);
    if (!foundRun || !foundRun.innerText.includes("Run")) {{
      console.error("FAIL: findCompileAndRunButton did not find '▶ Run' button:", foundRun);
      process.exit(1);
    }}

    const foundSubmit = QuizZyExecutor.findCodingSubmitButton(mockDoc);
    if (!foundSubmit || foundSubmit.innerText !== "Submit") {{
      console.error("FAIL: findCodingSubmitButton did not find 'Submit' button:", foundSubmit);
      process.exit(1);
    }}

    QuizZyExecutor.pollOutputConsole(1000, mockDoc).then((pollRes) => {{
      if (pollRes.status !== "success") {{
        console.error("FAIL: pollOutputConsole did not detect passed testcases:", pollRes);
        process.exit(1);
      }}
      console.log("SUCCESS: Run, Submit, and Testcase drawer verified");
    }});
    """

    res = subprocess.run(
        ["node", "-e", node_script],
        cwd=str(WORKSPACE_ROOT),
        capture_output=True,
        text=True
    )
    if res.returncode != 0:
        print("Node stdout:", res.stdout)
        print("Node stderr:", res.stderr)
    assert res.returncode == 0, f"Button and drawer test failed with exit code {res.returncode}"
    print("  -> Passed Run & Submit Buttons and Testcases Drawer Verification")
