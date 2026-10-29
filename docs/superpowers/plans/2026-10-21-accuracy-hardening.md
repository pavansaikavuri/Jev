# Comprehensive Accuracy Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Maximize QuizZy's end-to-end solving accuracy across complex logic puzzles, quantitative aptitude, negative-constraint MCQs, coding, and ordering questions, ensuring zero false-positive timeouts, arithmetic mistakes, or consensus deadlocks.

**Architecture:** 
1. Prompt Engineering Hardening: Consistent reason-first CoT instructions, negative-polarity constraint guards, dynamic multi-option letter bounds (A-F), and arithmetic self-verification.
2. Model Tier & Fallback Optimization: Upgraded OpenRouter fallback pool to high-speed verified free models (`minimax-m3.1-flash`, `nemotron-3-nano-omni-30b-reasoning`, `nemotron-3-ultra-550b`, `cohere-north-mini-code`), eliminating 404/429 dead-ends.
3. Contrastive Arbiter & Tie-Breaker Logic: Rapid 1.5s 2-of-3 model consensus with contrastive re-derivation.
4. Comprehensive Verification: Regression tests and extensive benchmark validation.

**Tech Stack:** Python 3.12, FastAPI, Pydantic, Groq API, OpenRouter API, Pytest, Chrome MV3 Extension.

**Spec:** Direct requirements from user /goal request: improve accuracy, prevent mistakes, and eliminate halts.

## Global Constraints
- Must maintain 100% backward compatibility with all 49 existing test cases in `pytest tests/ -v`.
- Must keep overall solver latency within the 6000ms hard budget (target p95 <= 3000ms).
- Zero DOM mutations on coding routes (`learning.ccbp.in/question/*`).
- Never leak test stubs or mock keys into production runs.

## Review Focus
1. Logic puzzles with multiple numerical constraints (e.g. 8-person birth-year questions): Arithmetic calculations in `reason` must be 100% accurate.
2. Questions with negative polarity ("Which of the following is NOT true?"): Must select the false statement, not the true one.
3. Questions with 5+ options (A-E or A-F) including "None of these": Model must not be biased towards only A-D.
4. Disagreement resolution: Fallback models must respond within 2.5s and break ties accurately.
5. Cache integrity: Cached solutions must retain high confidence scores and verified derivations.

---

### Task 1: Prompt Hardening for Flawless Logic & Math Derivations

**Files:**
- Modify: `backend/core/prompts.py:20-120`
- Test: `tests/test_live_site_compatibility.py`

**Steps:**
- [ ] 1.1 In `backend/core/prompts.py`, update `SYSTEM_PROMPT` to add:
  - Explicit arithmetic double-check rule for age/year/time puzzles.
  - Negative polarity detection instruction ("NOT", "INCORRECT", "EXCEPT").
  - "None of these" / "All of the above" constraint validation.
- [ ] 1.2 In `build_user_prompt`, fix line 95 to put `"reason"` first (consistent with system prompt) and dynamically format the allowed letter range (`f"{letters[0]} to {letters[-1]}"` instead of hardcoded `"A, B, C, or D"`).
- [ ] 1.3 In `build_user_prompt`, detect negative polarity words in the question and append an explicit reminder if found.
- [ ] 1.4 Run pytest to verify prompt parsing remains 100% compatible.

---

### Task 2: Model Configuration & Active Fallback Pool Upgrade

**Files:**
- Modify: `models.json:20-80`
- Modify: `backend/core/llm_client.py:350-375`
- Test: `eval/run_eval.py --check-models`

**Steps:**
- [ ] 2.1 Update `models.json` fallback pool with active, responsive free models:
  - `minimax/minimax-m3.1-flash:free` (Priority 1, ~1.5s latency)
  - `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` (Priority 2, 30B reasoning)
  - `nvidia/nemotron-3-ultra-550b-a55b:free` (Priority 3, 550B flagship)
  - `cohere/north-mini-code:free` (Priority 4, code specialist)
  - Remove defunct 404 models (`nvidia/nemotron-3-super-120b-a12b:free`, etc.).
- [ ] 2.2 In `backend/core/llm_client.py`, ensure `call_single_completion` handles reasoning token allocation cleanly with `reasoning_effort: "low"` and generous `max_tokens` for reasoning models.
- [ ] 2.3 Verify connectivity and responsiveness using `python eval/run_eval.py --check-models`.

---

### Task 3: Fast Contrastive Arbiter & Multi-Model Consensus Hardening

**Files:**
- Modify: `backend/core/llm_client.py:1920-2070`
- Test: `tests/test_bugfix_selection_and_consensus.py`

**Steps:**
- [ ] 3.1 In `backend/core/llm_client.py` tie-breaker resolution, race the fast Groq arbiter with the fast OpenRouter `minimax-m3.1-flash` model.
- [ ] 3.2 If both primaries disagree, adopt the majority consensus (2-of-3) as soon as either arbiter or fast fallback confirms one of the candidate answers.
- [ ] 3.3 When single-primary succeeds, limit the fallback corroboration timeout to 1500ms so the surviving primary is returned promptly without waiting for slow networks.
- [ ] 3.4 Run unit tests in `tests/test_bugfix_selection_and_consensus.py` to verify consensus rules.

---

### Task 4: End-to-End Verification & Server Reload

**Files:**
- Modify: `backend/run_server.py` (live port 8000 daemon)
- Test: `scratch/test_accuracy_suite.py`
- Test: `eval/run_eval.py --self-test`
- Test: `pytest tests/ -v`

**Steps:**
- [ ] 4.1 Restart FastAPI server daemon on port 8000 with the upgraded model config and prompts.
- [ ] 4.2 Run a targeted accuracy test suite on logic puzzles, negative questions, combinatorics, and MCQs.
- [ ] 4.3 Run `eval/run_eval.py --self-test` to ensure 100% deterministic unit test pass.
- [ ] 4.4 Run `pytest tests/ -v` to ensure all 49 existing test cases pass.
- [ ] 4.5 Confirm goal completion and document the accuracy improvements.
