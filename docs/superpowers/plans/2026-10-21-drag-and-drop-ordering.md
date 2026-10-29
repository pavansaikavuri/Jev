# Drag-and-Drop Ordering Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reliable drag-and-drop ordering execution support for sortable sequence quiz questions to QuizZy without modifying or regressing existing MCQ, multi-select, text, or code solving workflows.

**Architecture:**
- **Extractor Layer (`extension/extractor.js`):** Preserve read-only zero-DOM-mutation extraction of sortable ordering items, identifying drag handles and stable item identity attributes (`data-rbd-draggable-id`, `data-id`, `id`, `data-key`, or normalized clean text).
- **Executor Layer (`extension/executor.js`):** Implement `reorderSortableOptions(payload)` with an execution lock (`__QUIZZY_ORDER_LOCK__`), stable order validation, item-level re-reading, adaptive interaction strategy probing (Keyboard -> HTML5 DragEvent -> Pointer/Mouse), bounded async progress verification per move, and post-sort complete verification.
- **Controller/HUD Separation Gate (`extension/floating_hud.js`, `extension/sidepanel.js`):** Enforce that verified drag-and-drop questions halt/pause before submission, strictly requiring explicit user action to submit rather than triggering generic auto-submit.

**Tech Stack:** JavaScript (DOM APIs, Mouse/Pointer/DragEvent, KeyboardEvent, MutationObserver, Shadow DOM), Python 3.12, FastAPI, Pytest, Node.js v24.

**Spec:** User prompt requirements across Phases 1 through 10.

---

## Global Constraints

- Preserve all existing project work and uncommitted changes across `backend/`, `extension/`, `models.json`, and `progress.md`.
- Never execute destructive Git commands (`git reset`, `git clean`, `git checkout .`, `git stash`).
- Never automatically create commits (`git commit`).
- Never replace the current answer-generation pipeline or modify working MCQ / text / multi / code handlers.
- Never use direct DOM manipulation (`appendChild`, `insertBefore`, `innerHTML`) as a fake substitute for real user interaction.
- Never automatically click Submit/Next on drag-and-drop ordering questions in Auto Mode; require explicit user approval.
- Ensure strict zero-DOM-mutation during extraction on host quiz pages.
- Always guarantee pointer/mouse release on error or cancellation.

---

## Review Focus

1. **Already-ordered list:** If the host page items already match the desired order, return immediate success with 0 moves and zero synthetic events dispatched.
2. **Stale DOM references across sequential moves:** Each move in an $N$-item permutation shifts the DOM indices of subsequent elements; the executor must re-read DOM elements and recalculate bounding boxes after every move.
3. **Widget interaction mismatch:** Different quiz platforms use different libraries (HTML5 native draggable, react-beautiful-dnd keyboard handles, or pointer listeners like SortableJS/dnd-kit). The executor must probe and adapt to what the widget supports instead of firing conflicting events simultaneously.
4. **No-progress / stuck widget:** If synthetic events fail to reorder elements after bounded retries, safely abort with `MOVE_MADE_NO_PROGRESS` and return current vs target order without crashing or hanging.
5. **Accidental auto-submission:** Auto Mode must never advance or submit an ordering question automatically without explicit user confirmation.

---

## Tasks

### Task 1: Normalize & Validate Desired Order and Stable Identities
**Files:**
- Modify: `extension/executor.js:1830-1920`
- Test: `tests/test_drag_and_drop_ordering.py`

**Interfaces:**
- Consumes: `payload: { q_type: "order", permutation_indices?: number[], ordered_texts?: string[], desired_item_ids?: string[], optionsSelector?: string }`
- Produces: `normalizeAndValidateOrder(containerEl, payload)` -> `{ valid: boolean, alreadyCorrect: boolean, currentItems: ItemInfo[], desiredOrder: string[], error?: string }`

- [ ] **Step 1: Write unit test in `tests/test_drag_and_drop_ordering.py` for order validation and already-correct short circuit.**
- [ ] **Step 2: Run test with `python -m pytest tests/test_drag_and_drop_ordering.py` to confirm failure.**
- [ ] **Step 3: Implement stable item identity resolution and order validation in `extension/executor.js`.**
  - Extract stable attributes: `data-rbd-draggable-id`, `data-id`, `id`, `data-key`, or clean normalized text.
  - Detect duplicates or missing items in target sequence.
  - Return `alreadyCorrect: true` when current DOM order equals desired order.
- [ ] **Step 4: Re-run test to verify it passes.**

---

### Task 2: Implement Interaction Transports (Keyboard, HTML5 DnD, Pointer Sequence)
**Files:**
- Modify: `extension/executor.js:1700-1840`
- Test: `tests/test_drag_and_drop_ordering.py`

**Interfaces:**
- Consumes: `sourceItem: Element`, `targetItem: Element`, `stepOffset: number`, `strategy: "keyboard" | "html5" | "pointer"`
- Produces: `dispatchMoveInteraction(sourceItem, targetItem, stepOffset, strategy)` -> `Promise<void>` with guaranteed pointer release in `finally`.

- [ ] **Step 1: Write test in `tests/test_drag_and_drop_ordering.py` for individual interaction transports.**
  - Test HTML5 DragEvent sequence with `preventDefault()` on `dragover`.
  - Test Keyboard accessibility sequence (`Space` lift, `Arrow` steps, `Space` drop).
  - Test Pointer/Mouse sequence with proper coordinates, scrolling, and safe release.
- [ ] **Step 2: Run test to confirm failure.**
- [ ] **Step 3: Implement `dispatchKeyboardMove`, `dispatchHtml5DragMove`, `dispatchPointerMove`, and safety cleanup in `extension/executor.js`.**
- [ ] **Step 4: Re-run test to verify it passes.**

---

### Task 3: Implement Verified Reorder Loop with State Settling & Adaptive Probing
**Files:**
- Modify: `extension/executor.js:1840-1925`
- Test: `tests/test_drag_and_drop_ordering.py`

**Interfaces:**
- Consumes: `executeOrderAction(payload)`
- Produces: `Promise<OrderActionResult>` with `{ ok: boolean, success: boolean, verified: boolean, moves: number, action: "order_reordered", error?: string }`

- [ ] **Step 1: Write test in `tests/test_drag_and_drop_ordering.py` for multi-step reordering, permutation transformations (2-item swap, reverse, arbitrary 4-item), and stuck widget detection.**
- [ ] **Step 2: Run test to confirm failure.**
- [ ] **Step 3: Implement the async verified reorder loop in `executeOrderAction`:**
  - Acquire `__QUIZZY_ORDER_LOCK__`.
  - Re-read DOM and locate the next misplaced item.
  - Execute move with active or probed strategy.
  - Wait for DOM order to settle (bounded polling up to 400ms).
  - Verify order changed; if not, retry with fallback strategy.
  - Complete all moves and verify final order matches 100%.
  - Release lock in `finally`.
- [ ] **Step 4: Re-run test to verify it passes.**

---

### Task 4: Separate Submission Gate for Ordering Questions in Auto Mode
**Files:**
- Modify: `extension/floating_hud.js:1435-1460`
- Modify: `extension/sidepanel.js:1270-1315`
- Test: `tests/test_drag_and_drop_ordering.py`

**Interfaces:**
- Consumes: Auto Mode step execution on `q_type === "order"`
- Produces: Verified ordering status reported to HUD/Sidepanel, pausing Auto Mode and prompting manual user submission without calling `clickNextOnPage` or `CLICK_NEXT_BUTTON`.

- [ ] **Step 1: Write tests verifying that Auto Mode does NOT call `clickNextButton` when `q_type === "order"`.**
- [ ] **Step 2: Run test to confirm failure.**
- [ ] **Step 3: Update `floating_hud.js` and `sidepanel.js` to halt Auto Mode upon successful order verification, notifying the user to review and submit manually.**
- [ ] **Step 4: Re-run test to verify it passes.**

---

### Task 5: Full Regression Testing & Live-Site Mock Verification
**Files:**
- Test: `tests/test_drag_and_drop_ordering.py`
- Test: `tests/test_live_site_compatibility.py`
- Test: `tests/test_three_question_models.py`
- Test: `tests/test_phase3_automode.py`

- [ ] **Step 1: Run complete pytest suite across the repository.**
- [ ] **Step 2: Verify `tests/mock_quiz.html` Scenario 3 (Mitosis 4-stage HTML5 drag-and-drop) end-to-end.**
- [ ] **Step 3: Verify existing MCQ, multi-select, and text paths are 100% identical and regression-free.**
- [ ] **Step 4: Audit `git diff` for zero unintended modifications or scope creep.**
