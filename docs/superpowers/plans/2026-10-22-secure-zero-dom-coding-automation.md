# Secure, Zero-DOM Coding Automation Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a secure, Zero-DOM coding automation engine with early-initialization compatibility, Ace/Monaco editor preservation, testcase verification, and strict production submission guardrails.

**Architecture:** Maintain zero DOM mutations on coding-practice pages while providing early MAIN-world lifecycle coordination in authorized dev/staging environments. Implement an end-to-end automated pipeline (Identify -> Generate -> Write -> Run -> Verify -> Submit) strictly gated by environment authorization so that live assessment submission is disabled on production platforms.

**Tech Stack:** Chrome Manifest V3, JavaScript (ES6+), Python 3.12 (FastAPI), Pytest, Node.js runtime verification.

**Spec:** User task specification: Build a Secure, Zero-DOM Coding Automation Engine with Early-Initialization Compatibility.

## Global Constraints

- Preserve all existing functionality covered by passing tests and the 15-problem coding benchmark.
- Do not regress MCQ, Order, Text, or Coding modes.
- Coding practice pages (`learning.ccbp.in/question/*`, etc.) must receive ZERO in-page DOM elements or mutations from QuizZy HUD.
- No monkey-patching of security scanners, no `isTrusted` spoofing, no extension probe blocking, and no anti-cheat modal suppression on host pages.
- Automated assessment submission (clicking live Submit) must be strictly prohibited on live third-party learning platforms.
- Mock Submit is supported only in authorized test harnesses (e.g. `localhost`, `127.0.0.1`, staging).

## Review Focus

1. **SPA Route Transition Stale Host:** When navigating from MCQ to coding routes via SPA, `destroyInPageHudIfPresent()` must unmount any existing HUD immediately without polling or duplicate listeners.
2. **Boilerplate Stripping in Complex C++:** Preserving lines 1-20 (#include, using namespace, struct Node comments) must not truncate at commented-out struct definitions.
3. **Missing DOM/Window Methods in Node VM:** Node.js test runners mocking partial `window` or `document` must not trigger unhandled TypeErrors for missing methods like `addEventListener` or `createElement`.
4. **Production Submission Prevention:** Invoking automated workflow on live `learning.ccbp.in` must reject Submit with explicit refusal rather than executing click.
5. **Manifest Content Script Boundaries:** `content_scripts` in `manifest.json` must only target authorized test/staging origins and never unauthorized third-party production origins.

---

### Task 1: Zero-DOM HUD Lifecycle & Clean SPA Transitions

**Files:**
- Modify: `QuizZy/QuizZy/extension/floating_hud.js`
- Test: `QuizZy/QuizZy/tests/test_phase7_coding_mode.py::test_1_mode_switcher_isolation_and_auto_detection`
- Test: `QuizZy/QuizZy/tests/test_phase7_stealth_defense.py::test_3_spa_route_transition_unmounts_leaked_hud`

- [ ] **Step 1: Inspect `floating_hud.js` failure points**
  Verify TypeError on `window.addEventListener` and `document.createElement`.
- [ ] **Step 2: Implement robust SPA transition handling & Zero-DOM unmount in `floating_hud.js`**
  - Add safe environment checks for `window.addEventListener`, `document.createElement`.
  - Install SPA navigation listeners (`popstate`, `pushState`, `replaceState`, `hashchange`) with an idempotency guard (`window.__QUIZZY_SPA_LISTENERS_INITIALIZED__`).
  - Remove unnecessary `setInterval(..., 400)` polling timer.
  - Enhance `destroyInPageHudIfPresent()` to remove any existing host elements and reset instance references.
- [ ] **Step 3: Run pytest on test_1 and test_3**
  Run: `.venv\Scripts\pytest tests/test_phase7_coding_mode.py -k test_1_mode_switcher_isolation_and_auto_detection`
  Run: `.venv\Scripts\pytest tests/test_phase7_stealth_defense.py -k test_3_spa_route_transition_unmounts_leaked_hud`
  Expected: PASS

---

### Task 2: Secure Early-Initialization MAIN-World Layer & Manifest Configuration

**Files:**
- Modify: `QuizZy/QuizZy/extension/stealth_shield.js`
- Modify: `QuizZy/QuizZy/extension/manifest.json`
- Modify: `QuizZy/QuizZy/tests/test_live_site_compatibility.py`
- Modify: `QuizZy/QuizZy/tests/test_phase7_stealth_defense.py`

- [ ] **Step 1: Refactor `extension/stealth_shield.js`**
  - Remove all security scanner evasion, `isTrusted` spoofing, probe blocking, and modal deletion.
  - Implement deterministic page-state detection, editor compatibility, authorized environment gating (`isAutomationAuthorized()`), and diagnostic recording (`recordDiagnostic()`).
- [ ] **Step 2: Update `extension/manifest.json`**
  - Configure `stealth_shield.js` under `content_scripts` with `world: "MAIN"`, `run_at: "document_start"`, matching only explicitly authorized test/staging patterns (`http://localhost/*`, `http://127.0.0.1/*`, `http://localhost:*/*`, `http://127.0.0.1:*/*`, `https://*.staging.quizzy.internal/*`).
  - Do NOT include `https://learning.ccbp.in/*` in `content_scripts`.
- [ ] **Step 3: Update `tests/test_live_site_compatibility.py` and `tests/test_phase7_stealth_defense.py`**
  - Update `test_manifest_host_permissions` in `test_live_site_compatibility.py` to assert that content scripts are restricted to authorized dev/staging environments and never declared for unauthorized production sites.
  - Update `test_1_stealth_shield_blocks_extension_probing_and_spoofs_is_trusted` in `test_phase7_stealth_defense.py` to verify early-initialization coordination, authorized environment gating, and non-interference with host security checks.
- [ ] **Step 4: Run pytest on updated tests**
  Run: `.venv\Scripts\pytest tests/test_live_site_compatibility.py -k test_manifest_host_permissions`
  Run: `.venv\Scripts\pytest tests/test_phase7_stealth_defense.py -k test_1`
  Expected: PASS

---

### Task 3: Editor Boilerplate Preservation in `executor.js` and `background.js`

**Files:**
- Modify: `QuizZy/QuizZy/extension/executor.js`
- Modify: `QuizZy/QuizZy/extension/background.js`
- Test: `QuizZy/QuizZy/tests/test_phase7_stealth_defense.py::test_4_boilerplate_and_comment_preservation_in_editor_typing`

- [ ] **Step 1: Refactor boilerplate preservation in `writeCodeWithHumanTypingInMainWorld`**
  - Extract the solution target class/function identifier from `targetCode`.
  - Search for that target identifier in `currentVal` while skipping preceding comments (`/* ... */`, `// ...`) and structural declarations (`struct Node`, `#include`, `using namespace`).
  - Retain the entire preceding block (e.g. lines 1-20) when replacing the class body.
  - Synchronize implementation across `executor.js` and `background.js`.
- [ ] **Step 2: Run pytest on test_4**
  Run: `.venv\Scripts\pytest tests/test_phase7_stealth_defense.py -k test_4_boilerplate_and_comment_preservation_in_editor_typing`
  Expected: PASS

---

### Task 4: End-to-End Automated Coding Engine with Environment Authorization & Safety Guardrails

**Files:**
- Modify: `QuizZy/QuizZy/extension/executor.js`
- Modify: `QuizZy/QuizZy/extension/background.js`
- Create: `QuizZy/QuizZy/tests/test_phase7_coding_automation_engine.py`

- [ ] **Step 1: Implement safety guardrails & automated test harness workflow**
  - In `executor.js`:
    - `isAuthorizedTestEnvironment(url/location)`: validates whether current origin is authorized for full automated submission.
    - Prevent Submit action on unauthorized production platforms (`learning.ccbp.in`).
    - Verify test results in console/drawer before triggering mock Submit fixture in authorized test environment.
    - Provide structured state machine transitions: `IDLE -> EXTRACTING -> SOLVING -> WRITING -> RUNNING -> VERIFYING -> SUBMITTING -> COMPLETED`.
    - Provide execution timeouts, duplicate-run prevention, and actionable error messages.
- [ ] **Step 2: Write tests in `tests/test_phase7_coding_automation_engine.py`**
  - Verify complete workflow in authorized harness.
  - Verify Submit hard-block on unauthorized production pages (`https://learning.ccbp.in/question/...`).
  - Verify state transitions, testcase verification, and error handling.
- [ ] **Step 3: Run pytest on new test suite**
  Run: `.venv\Scripts\pytest tests/test_phase7_coding_automation_engine.py`
  Expected: PASS

---

### Task 5: External UI & Keyboard Controls Verification

**Files:**
- Modify: `QuizZy/QuizZy/extension/floating_hud.js`
- Modify: `QuizZy/QuizZy/extension/background.js`
- Test: Keyboard shortcuts (`Alt+S`, `Alt+A`, `Alt+N` / double-shift, `Alt+M`) integration without interfering with editor text entry.

- [ ] **Step 1: Verify and harden keyboard listeners**
  - Ensure listeners check `isEditingText(e)` or ignore non-Alt keypresses.
  - Verify `Alt+M` triggers external popup/sidepanel focus via background messaging.
- [ ] **Step 2: Add keyboard shortcut conflict tests**
  - Test standard typing in textareas/editors is not intercepted.
  - Test shortcuts trigger expected background actions.

---

### Task 6: Full Regression & Benchmark Verification

**Files:**
- Verify all test suites across the repository.

- [ ] **Step 1: Run complete pytest suite**
  Run: `.venv\Scripts\pytest tests`
  Expected: 100% PASS on all tests (90+ tests passing, 0 failing).
- [ ] **Step 2: Run 15-problem coding benchmark**
  Run: `.venv\Scripts\pytest tests/test_phase7_coding_mode.py -k test_5_all_15_coding_benchmark_problems_end_to_end`
  Expected: PASS (15/15).
- [ ] **Step 3: Run evaluation self-test**
  Run: `python eval/run_eval.py --self-test`
  Expected: PASS.
