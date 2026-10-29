# Three Question Models Hardening Implementation Plan (Drag-and-Sequence, Multi-Select Checkboxes, Fill-in-the-Box)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Achieve 100% zero-error solve rate across the three core CCBP quiz models:
1. **Drag-and-sequence questions:** Detect "Drag and Drop to Order" lists, generate correct sequence, simulate accessible drag/keyboard reordering, and verify DOM order matches before submit.
2. **Multiple-choice questions with several correct answers:** Detect square checkboxes, prompt models for multi-select true/false evaluation, click ALL correct options, and verify every checkbox state before submit.
3. **Fill-in-the-box questions:** Detect textarea/inputs (e.g. "Enter your answer"), compute exact numerical/symbolic answers, set value via React descriptors, and verify input value before submit.

**Architecture:**
- **Extractor (`extension/extractor.js`):** Add robust detection for "Drag and Drop to Order" containers and grab handles (`::`), square checkboxes (`[role='checkbox']`, `input[type='checkbox']`, square indicator elements), and fill-in-the-box textareas/inputs with placeholder matching ("Enter your answer"). Prevent `findClasslessOptionElements` from misclassifying text questions.
- **Backend Schemas & Prompts (`backend/schemas.py`, `backend/core/prompts.py`, `backend/core/normalizer.py`, `backend/core/llm_client.py`):** Add first-class support for `q_type: "multi"` (or multi-select MCQ), returning `selected_indices: List[int]`, `selected_texts: List[str]`, and comma-separated answer `"A, D"`. Enhance step-by-step arithmetic prompts for multiplication hashing ($h(k) = \lfloor m(kA \bmod 1)\rfloor$) and algorithmic ordering.
- **Executor (`extension/executor.js`):** Implement verified multi-checkbox clicking with complete parity check, enhanced drag reordering (supporting `react-beautiful-dnd` space/arrow lift-and-drop as well as pointer events), and verified text entry.
- **Floating HUD & Sidepanel (`extension/floating_hud.js`, `extension/sidepanel.js`):** Fix stale answer persistence across question transitions; display multi-option badges (`[A, D]`) and ordering sequences (`2 → 3 → 1`); ensure pre-submit verification gate enforces 100% match before any submit action.

**Tech Stack:** JavaScript (DOM, React Events, Shadow DOM), Python 3.12, FastAPI, Pydantic v2, Pytest.

**Spec:** User prompt and 5 live CCBP screenshots (`learning.ccbp.in/primitive-coding/practice/...`).

---

## Global Constraints
- Preserve 100% backward compatibility with all 49 existing pytest tests and 8 offline deterministic self-tests.
- Maintain zero-DOM-mutation stealth on proctored coding pages (`isProctoredCodingPage()`).
- Never click Submit if pre-submit verification fails (`OPTION_SELECTION_FAILED`, `ORDER_VERIFICATION_FAILED`, `TEXT_VERIFICATION_FAILED`).

---

## File Structure
- `backend/schemas.py`: Add `multi` to `q_type` literals, add `selected_indices: Optional[List[int]]` and `selected_texts: Optional[List[str]]` to `SolveResponse`.
- `backend/core/normalizer.py`: Add `normalize_multi_mcq_answer` to parse comma-separated or list-based multi-answers and return indices and canonical keys.
- `backend/core/prompts.py`: Add multi-select system prompt instructions and formula calculations (multiplication method hashing).
- `backend/core/llm_client.py`: Support `multi` type in dual-primary consensus, arbiter, and fallbacks.
- `extension/extractor.js`: Detect "Drag and Drop to Order" handles, square checkboxes, and fill-in-the-box textareas.
- `extension/executor.js`: Implement `executeMultiMcqAction`, accessible drag reordering, and verified text fill.
- `extension/floating_hud.js`: Stale state reset on question change, badge rendering for `[A, D]`, and multi-action support.
- `extension/sidepanel.js`: Multi-select option highlighting and display.
- `tests/test_three_question_models.py`: Comprehensive test suite for all 3 models.

---

## Tasks

### Task 1: Backend Schemas, Multi-Select Normalizer & Prompts
- [ ] In `backend/schemas.py`, update `q_type: Literal["mcq", "order", "text", "code", "multi"]` for `SolveRequest` and `SolveResponse`. Add `selected_indices: Optional[List[int]] = None` and `selected_texts: Optional[List[str]] = None` to `SolveResponse`.
- [ ] In `backend/core/normalizer.py`, implement `normalize_multi_mcq_answer(answer_raw, options)` to parse multiple selected options (`"A, D"`, `["A", "D"]`, `"A and D"`, or option text matches), returning list of indices and canonical keys.
- [ ] In `backend/core/prompts.py`, add prompt instructions for `multi` questions requiring the LLM to evaluate every option and return all valid letters.
- [ ] In `backend/core/llm_client.py`, update consensus check to compare sorted canonical keys for multi-select questions (e.g. `["A", "D"] == ["A", "D"]`).

### Task 2: Extractor Hardening for Drag-to-Order, Checkboxes, and Fill-in-the-Box
- [ ] In `extension/extractor.js`, detect "Drag and Drop to Order" text and grab handles (`::`), extracting order items cleanly even when styled with classless components.
- [ ] In `extension/extractor.js`, detect square checkboxes (`input[type='checkbox']`, `[role='checkbox']`, square indicator elements) or multi-select phrases ("Which of the following are", "Select all"), setting `q_type = "multi"`.
- [ ] In `extension/extractor.js`, detect fill-in-the-box `<textarea>` or `<input>` with placeholder "Enter your answer" when no options are present, preventing `findClasslessOptionElements` from falsely finding options.

### Task 3: Executor Execution & Pre-Submit Verification Gate
- [ ] In `extension/executor.js`, implement `executeMultiMcqAction(payload)`:
  - Clicks all target option checkboxes.
  - Unchecks any non-target option checkboxes.
  - Verifies that all and only target options are checked before returning `ok: true`.
- [ ] In `extension/executor.js`, enhance `executeOrderAction(payload)`:
  - Add accessible keyboard drag sequence (Space to lift, ArrowDown/Up to move, Space to drop) for `react-beautiful-dnd` containers.
  - Verify DOM element order matches `ordered_texts` before returning `ok: true`.
- [ ] In `extension/executor.js`, update `executeTextAction(payload)`:
  - Ensure placeholder-based textarea discovery.
  - Verify that `inputEl.value` matches `textVal` before returning `ok: true`.

### Task 4: Floating HUD & Sidepanel Multi-Select & Stale State Elimination
- [ ] In `extension/floating_hud.js`, reset `latestSolution` and badge immediately when question signature changes so stale answers never persist across questions.
- [ ] In `extension/floating_hud.js`, render multi-select badges like `[A, D]` and order indicators like `[ORDER]`.
- [ ] In `extension/floating_hud.js`, update `applyCurrentSolution` to dispatch `executeMultiMcqAction` when `q_type === "multi"`.

### Task 5: Comprehensive Automated Testing & Live Port 8000 Verification
- [ ] Create `tests/test_three_question_models.py` covering:
  1. Drag-and-sequence parsing, normalization, and keyboard drag simulation.
  2. Multi-select double hashing question (`A, D`), checkbox verification, and partial-answer rejection.
  3. Fill-in-the-box multiplication method calculation ($h(123) = 0$), input verification, and blank rejection.
- [ ] Run `pytest tests/ -v` and ensure all 50+ tests pass.
- [ ] Run `eval/run_eval.py --self-test` to ensure 8/8 pass.
- [ ] Test live against running Port 8000 backend.
