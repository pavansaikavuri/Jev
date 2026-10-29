"""
Phase 7 Self-Healing Complete Verification Suite:
Covers Deep Problem Reasoning Prompts (Mode 1 & Mode 2 Root-Cause Repair),
Backend Cache Bypass & Cache Self-Healing on Retry,
Language & Unfolded Problem Extraction,
Structured Error Drawer & Stale-DOM Epoch Protection,
and End-to-End Attempt 1 -> Failure -> Attempt 2 Bounded Self-Healing Loop.
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
from fastapi.testclient import TestClient
from backend.app import app
from backend.cache import cache_solution, get_cached_solution, init_db
from backend.core.prompts import build_code_prompts, CODING_SYSTEM_PROMPT


# -----------------------------------------------------------------------------
# Test 1: Prompt Engineering Mode 1 (First Attempt) & Mode 2 (Forensic Repair)
# -----------------------------------------------------------------------------
def test_1_prompt_engineering_mode1_and_mode2():
    """
    Test 1: Verify Mode 1 prompts (deep reasoning, example walkthrough, signature binding)
    and Mode 2 prompts (forensic error injection, root-cause diagnosis, targeted fix).
    """
    print("\n[Self-Healing - Test 1] Verifying Deep Problem Reasoning & Forensic Prompts...")

    q_dict = {
        "question": "Given the head of a singly linked list, delete the middle node and return head.",
        "starter_code": "/**\n * struct ListNode {\n *   int val;\n *   ListNode *next;\n * };\n */\nclass Solution {\npublic:\n    ListNode* deleteMiddle(ListNode* head) {\n        \n    }\n};",
        "language": "cpp",
        "options": []
    }

    # 1. Mode 1: First Attempt (error_context is None)
    msgs_mode1 = build_code_prompts(
        subject="General",
        question=q_dict["question"],
        language=q_dict["language"],
        starter_code=q_dict["starter_code"],
        error_context=None
    )
    prompt_mode1 = "\n".join(m.get("content", "") for m in msgs_mode1)
    assert "Think deeply about the problem" in prompt_mode1
    assert "brief, problem-specific explanation" in prompt_mode1
    assert "complete, optimal, executable cpp code" in prompt_mode1
    assert "starter function/class/method signature provided in starter_code" in prompt_mode1
    assert "head == NULL" in prompt_mode1 or "head->next == NULL" in prompt_mode1
    assert "cpp" in prompt_mode1
    assert "ListNode* deleteMiddle" in prompt_mode1

    # System prompt contract
    assert "You are QuizZy's expert programming engine" in CODING_SYSTEM_PROMPT
    assert "<think>...</think>" in CODING_SYSTEM_PROMPT
    assert '"reason"' in CODING_SYSTEM_PROMPT and '"answer"' in CODING_SYSTEM_PROMPT

    # 2. Mode 2: Second Attempt Forensic Self-Healing (error_context provided)
    error_context = (
        "ERROR_TYPE: WRONG_ANSWER\n\n"
        "ATTEMPT_1_CODE:\n"
        "class Solution {\npublic:\n    ListNode* deleteMiddle(ListNode* head) {\n        return head->next;\n    }\n};\n\n"
        "DIAGNOSTICS / COMPILER_OUTPUT:\n"
        "Wrong Answer: Failed on Testcase 2\n\n"
        "FAILED_TESTCASE:\n"
        "Testcase: Case 2\n"
        "Input: head = [1,2,3,4]\n"
        "Your Output: [2,3,4]\n"
        "Expected Output: [1,2,4]"
    )

    msgs_mode2 = build_code_prompts(
        subject="General",
        question=q_dict["question"],
        language=q_dict["language"],
        starter_code=q_dict["starter_code"],
        error_context=error_context
    )
    prompt_mode2 = "\n".join(m.get("content", "") for m in msgs_mode2)
    assert "Second Attempt (Forensic Root-Cause Self-Healing Repair)" in prompt_mode2
    assert "Analyze Failure Evidence" in prompt_mode2
    assert "Your Output: [2,3,4]" in prompt_mode2
    assert "Expected Output: [1,2,4]" in prompt_mode2
    assert "root-cause diagnosis BEFORE coding" in prompt_mode2
    assert "Diagnose why Attempt 1 failed" in prompt_mode2
    assert "complete, corrected cpp source code" in prompt_mode2
    assert "Strictly forbid repeating Attempt 1's unchanged broken implementation" in prompt_mode2

    print("  -> Passed Prompt Engineering Mode 1 and Mode 2 Verification")


# -----------------------------------------------------------------------------
# Test 2: Backend Cache Bypass & Cache Self-Healing on Retry
# -----------------------------------------------------------------------------
def test_2_backend_cache_bypass_and_self_healing_on_retry():
    """
    Test 2: Verify that /solve forces bypass_cache=True whenever error_context is present,
    preventing Attempt 1 stale failure re-serving, and updates the cache on verified retry.
    """
    print("\n[Self-Healing - Test 2] Verifying Cache Bypass & Self-Healing on Retry...")
    init_db()

    client = TestClient(app)

    question_text = "Return true if the number n is power of two, otherwise false."
    options = []
    starter = "bool isPowerOfTwo(int n) {\n    \n}"

    # 1. Seed cache with an initial "broken" Attempt 1 answer
    broken_code = "bool isPowerOfTwo(int n) { return n == 2; }"
    from backend.schemas import SolveResponse
    dummy_solver_res = SolveResponse(
        status="ok",
        q_type="code",
        answer=broken_code,
        confidence_tier="HIGH_BOTH_AGREE",
        confidence_label="high",
        confidence_score=0.98,
        auto_eligible=True,
        cache_hit=False,
        latency_ms=45.0,
        language="cpp"
    )

    cache_res = cache_solution(
        subject="General",
        q_type="code",
        question=question_text,
        options=options,
        solver_res=dummy_solver_res,
        language="cpp",
        starter_code=starter
    )
    assert cache_res is True

    cached_before = get_cached_solution(
        subject="General",
        q_type="code",
        question=question_text,
        options=options,
        language="cpp",
        starter_code=starter
    )
    assert cached_before is not None
    assert cached_before["answer"] == broken_code

    # 2. Call /solve with error_context but WITHOUT bypass_cache explicitly set
    # The backend must automatically detect error_context and bypass cache on read!
    retry_payload = {
        "subject": "General",
        "q_type": "code",
        "question": question_text,
        "options": options,
        "starter_code": starter,
        "language": "cpp",
        "error_context": "ERROR_TYPE: WRONG_ANSWER\nInput: 4\nYour Output: false\nExpected Output: true",
        "bypass_cache": False  # Explicitly false to test automatic bypass when error_context is present
    }

    res = client.post("/solve", json=retry_payload)
    assert res.status_code == 200, f"Backend returned {res.status_code}: {res.text}"
    data = res.json()

    # The returned solution must NOT be from cache (cache_hit == False)
    assert data["cache_hit"] is False, "Expected cache_hit to be False when error_context is present!"
    assert data["q_type"] == "code"
    assert "answer" in data and len(data["answer"]) > 0

    # 3. Cache Self-Healing: The cache must now contain the updated Attempt 2 solution
    cached_after = get_cached_solution(
        subject="General",
        q_type="code",
        question=question_text,
        options=options,
        language="cpp",
        starter_code=starter
    )
    assert cached_after is not None
    # Ensure cache was refreshed
    assert cached_after["answer"] == data["answer"]
    assert cached_after["confidence_tier"] in ("HIGH_BOTH_AGREE", "MEDIUM_TIEBREAKER_AGREE", "SINGLE_PRIMARY_PASSED")

    print("  -> Passed Backend Cache Bypass & Cache Self-Healing on Retry")


# -----------------------------------------------------------------------------
# Test 3: Language & Unfolded Problem Extraction (extension/extractor.js)
# -----------------------------------------------------------------------------
def test_3_language_and_unfolded_problem_extraction():
    """
    Test 3: Verify language detection across C++, Python, Java, JavaScript
    and extraction of problem title, description, constraints, and unfolded starter code.
    """
    print("\n[Self-Healing - Test 3] Verifying Language & Problem Extraction...")
    extractor_path = (WORKSPACE_ROOT / "extension" / "extractor.js").as_posix()

    node_script = f"""
    const QuizZyExtractor = require('{extractor_path}');

    // 1. Language Detection Tests
    const testCases = [
      {{ hint: "cpp", expected: "cpp" }},
      {{ hint: "python", expected: "python" }},
      {{ hint: "java", expected: "java" }},
      {{ hint: "javascript", expected: "javascript" }}
    ];

    testCases.forEach(tc => {{
      const mockDoc = {{
        querySelector: (sel) => {{
          if (sel.includes("select") || sel.includes("lang")) {{
            return {{ value: tc.hint, textContent: tc.hint }};
          }}
          return null;
        }},
        querySelectorAll: () => []
      }};
      const detected = QuizZyExtractor.detectCodingLanguage(mockDoc, "");
      if (detected !== tc.expected) {{
        console.error(`FAIL: Expected language '${{tc.expected}}', got '${{detected}}'`);
        process.exit(1);
      }}
    }});

    // Syntax-based language detection from starter code
    const syntaxCases = [
      {{ code: "#include <iostream>\\nusing namespace std;\\nint main() {{}}", expected: "cpp" }},
      {{ code: "def maxSubArray(nums: list[int]) -> int:\\n    pass", expected: "python" }},
      {{ code: "public class Solution {{\\n    public static void main(String[] args) {{}}\\n}}", expected: "java" }},
      {{ code: "function twoSum(nums, target) {{\\n  const map = new Map();\\n}}", expected: "javascript" }}
    ];

    syntaxCases.forEach(sc => {{
      const detected = QuizZyExtractor.detectCodingLanguage(null, sc.code);
      if (detected !== sc.expected) {{
        console.error(`FAIL: Syntax detection expected '${{sc.expected}}', got '${{detected}}'`);
        process.exit(1);
      }}
    }});

    // 2. Full Problem Extraction Test
    const mockProblemDoc = {{
      querySelector: (sel) => {{
        if (sel.includes("description") || sel.includes("problem")) {{
          return {{
            innerText: "Title: Kadane's Algorithm\\nFind maximum subarray sum.\\nConstraints: 1 <= N <= 10^5\\nSample 1:\\nInput: [-2,1,-3,4,-1,2,1,-5,4]\\nOutput: 6"
          }};
        }}
        if (sel.includes("editor") || sel.includes("ace")) {{
          return {{
            env: {{
              editor: {{
                getValue: () => "int maxSubarraySum(int arr[], int n) {{ return 0; }}"
              }}
            }}
          }};
        }}
        return null;
      }},
      querySelectorAll: (sel) => {{
        if (sel.includes("select") || sel.includes("lang")) {{
          return [{{ value: "cpp", textContent: "C++" }}];
        }}
        return [];
      }},
      body: {{
        innerText: "Kadane's Algorithm Problem Pane"
      }}
    }};

    const extracted = QuizZyExtractor.extractCodingProblem(mockProblemDoc);
    if (!extracted || extracted.q_type !== "code") {{
      console.error("FAIL: Extracted object missing q_type === 'code':", extracted);
      process.exit(1);
    }}
    if (extracted.language !== "cpp") {{
      console.error("FAIL: Expected language 'cpp', got:", extracted.language);
      process.exit(1);
    }}
    if (!extracted.question.includes("Kadane's Algorithm")) {{
      console.error("FAIL: Extracted question missing title/description:", extracted.question);
      process.exit(1);
    }}
    if (!extracted.starter_code.includes("maxSubarraySum")) {{
      console.error("FAIL: Extracted starter_code missing:", extracted.starter_code);
      process.exit(1);
    }}

    console.log("SUCCESS: Language & Unfolded Problem Extraction verified");
    """

    res = subprocess.run(["node", "-e", node_script], cwd=str(WORKSPACE_ROOT), capture_output=True, text=True)
    if res.returncode != 0:
        print("Node stdout:", res.stdout)
        print("Node stderr:", res.stderr)
    assert res.returncode == 0, f"Test 3 failed with code {res.returncode}"
    print("  -> Passed Language & Unfolded Problem Extraction")


# -----------------------------------------------------------------------------
# Test 4: Structured Error Drawer & Stale-DOM Epoch Protection
# -----------------------------------------------------------------------------
def test_4_structured_error_drawer_and_stale_dom_protection():
    """
    Test 4: Verify extraction of Compilation Error, Runtime Error, and Wrong Answer
    and verify that preRunSignature prevents reading stale Attempt 1 errors on Attempt 2.
    """
    print("\n[Self-Healing - Test 4] Verifying Error Extraction & Stale-DOM Protection...")
    executor_path = (WORKSPACE_ROOT / "extension" / "executor.js").as_posix()

    node_script = f"""
    const QuizZyExecutor = require('{executor_path}');

    // 1. Test Compilation Error Extraction
    const mockCompileErrDoc = {{
      querySelectorAll: (sel) => [{{
        className: "console-output",
        innerText: "solution.cpp:12:5: error: expected ';' before 'return'\\n   12 |     return 0;\\n      |     ^~~~~~"
      }}]
    }};
    const compRes = QuizZyExecutor.extractCodingExecutionResult(mockCompileErrDoc, "int main() {{ return 0 }}");
    if (compRes.status !== "COMPILATION_ERROR" || !compRes.diagnostics.includes("error: expected ';'")) {{
      console.error("FAIL: Compilation error not extracted accurately:", compRes);
      process.exit(1);
    }}
    if (!compRes.error_context.includes("ERROR_TYPE: COMPILATION_ERROR")) {{
      console.error("FAIL: error_context missing ERROR_TYPE: COMPILATION_ERROR");
      process.exit(1);
    }}

    // 2. Test Runtime Error Extraction
    const mockRuntimeErrDoc = {{
      querySelectorAll: (sel) => [{{
        className: "testcase-output",
        innerText: "Runtime Error:\\nTraceback (most recent call last):\\n  File 'solution.py', line 5, in solve\\n    return arr[100]\\nIndexError: list index out of range"
      }}]
    }};
    const rtRes = QuizZyExecutor.extractCodingExecutionResult(mockRuntimeErrDoc, "def solve(arr): return arr[100]");
    if (rtRes.status !== "RUNTIME_ERROR" || !rtRes.diagnostics.includes("IndexError")) {{
      console.error("FAIL: Runtime error not extracted accurately:", rtRes);
      process.exit(1);
    }}

    // 3. Test Wrong Answer Extraction
    const mockWrongAnswerDoc = {{
      querySelectorAll: (sel) => [{{
        className: "output-console",
        innerText: "Wrong Answer\\nFailed on Testcase 1\\nInput: [1, 2, 3]\\nYour Output: 5\\nExpected Output: 6"
      }}]
    }};
    const waRes = QuizZyExecutor.extractCodingExecutionResult(mockWrongAnswerDoc, "def solve(nums): return sum(nums) - 1");
    if (waRes.status !== "WRONG_ANSWER") {{
      console.error("FAIL: Wrong answer status not detected:", waRes);
      process.exit(1);
    }}
    if (!waRes.diagnostics.includes("Your Output: 5") || !waRes.diagnostics.includes("Expected Output: 6")) {{
      console.error("FAIL: Failed testcase details missing from diagnostics:", waRes.diagnostics);
      process.exit(1);
    }}

    // 4. Test Pre-Run DOM Epoch Snapshot & Stale-DOM Protection
    let outputState = "ATTEMPT_1_ERROR";
    const dynamicDoc = {{
      querySelectorAll: (sel) => {{
        if (outputState === "ATTEMPT_1_ERROR") {{
          return [{{ className: "console-output", innerText: "Compilation Error: line 4" }}];
        }} else if (outputState === "IN_FLIGHT_COMPILING") {{
          return [{{ className: "console-output", innerText: "Compiling and Running..." }}];
        }} else if (outputState === "ATTEMPT_2_PASSED") {{
          return [{{ className: "console-output", innerText: "All test cases passed." }}];
        }}
        return [];
      }}
    }};

    // Capture snapshot while Attempt 1 error is in DOM
    const sig1 = QuizZyExecutor.capturePreRunSignature(dynamicDoc);
    if (!sig1.text.includes("Compilation Error")) {{
      console.error("FAIL: PreRunSignature failed to capture Attempt 1 text:", sig1);
      process.exit(1);
    }}

    // While still in ATTEMPT_1_ERROR, pollOutputConsole should NOT return immediately as fresh result
    // Trigger transition to in-flight then passed
    setTimeout(() => {{
      outputState = "IN_FLIGHT_COMPILING";
      setTimeout(() => {{
        outputState = "ATTEMPT_2_PASSED";
      }}, 50);
    }}, 40);

    QuizZyExecutor.pollOutputConsole(1500, dynamicDoc, sig1).then(pollRes => {{
      if (pollRes.status !== "success" || !pollRes.outputText.includes("All test cases passed")) {{
        console.error("FAIL: pollOutputConsole did not safely synchronize to fresh output:", pollRes);
        process.exit(1);
      }}
      console.log("SUCCESS: Structured error drawer & stale-DOM protection verified");
    }}).catch(err => {{
      console.error("ERROR:", err);
      process.exit(1);
    }});
    """

    res = subprocess.run(["node", "-e", node_script], cwd=str(WORKSPACE_ROOT), capture_output=True, text=True)
    if res.returncode != 0:
        print("Node stdout:", res.stdout)
        print("Node stderr:", res.stderr)
    assert res.returncode == 0, f"Test 4 failed with code {res.returncode}"
    print("  -> Passed Structured Error Drawer & Stale-DOM Epoch Protection")


# -----------------------------------------------------------------------------
# Test 5: End-to-End Attempt 1 -> Failure -> Attempt 2 Self-Healing Loop
# -----------------------------------------------------------------------------
def test_5_end_to_end_attempt1_fail_attempt2_self_healing_bounded():
    """
    Test 5: Full simulation of Attempt 1 producing Wrong Answer, triggering
    self-healing retry with error_context, typing Attempt 2 repaired code,
    verifying fresh passing output, and enforcing verified_no_submit_production_guardrail.
    Also verifies bounded retry termination if Attempt 2 fails.
    """
    print("\n[Self-Healing - Test 5] Verifying End-to-End Bounded Self-Healing Workflow...")
    executor_path = (WORKSPACE_ROOT / "extension" / "executor.js").as_posix()

    node_script = f"""
    const QuizZyExecutor = require('{executor_path}');

    // A. Verify Happy Path: Attempt 1 fails -> Attempt 2 passes -> Verified Guardrail
    let runCount = 0;
    let submitClickedOnProd = false;
    let editorBuffer = "def solve(): return 1";

    const prodMockDoc = {{
      querySelector: (sel) => {{
        if (sel.includes("textarea") || sel.includes("ace_text-input")) {{
          return {{ focus: () => {{}}, dispatchEvent: () => {{}} }};
        }}
        if (sel.includes(".ace_editor")) {{
          return {{
            env: {{
              editor: {{
                getValue: () => editorBuffer,
                setValue: (v) => {{ editorBuffer = v; }},
                session: {{ doc: {{ setValue: (v) => {{ editorBuffer = v; }} }} }}
              }}
            }}
          }};
        }}
        return null;
      }},
      querySelectorAll: (sel) => {{
        if (sel.includes("button") || sel.includes("input")) {{
          return [
            {{
              innerText: "Compile & Run",
              textContent: "Compile & Run",
              click: () => {{
                runCount++;
              }}
            }},
            {{
              innerText: "Submit",
              textContent: "Submit",
              click: () => {{
                submitClickedOnProd = true;
              }}
            }}
          ];
        }}
        if (sel.includes("console") || sel.includes("output")) {{
          if (runCount === 1) {{
            return [{{
              className: "console-output",
              innerText: "Wrong Answer\\nTestcase 1 failed\\nInput: 5\\nYour Output: 1\\nExpected Output: 120"
            }}];
          }} else if (runCount >= 2) {{
            return [{{
              className: "console-output",
              innerText: "All 5 test cases passed. Compilation successful."
            }}];
          }}
          return [];
        }}
        return [];
      }}
    }};

    // Simulate third-party proctored host
    global.window = {{
      document: prodMockDoc,
      location: {{
        hostname: "learning.ccbp.in",
        href: "https://learning.ccbp.in/question/test-id-123"
      }}
    }};
    global.document = prodMockDoc;

    let retryPayloadCaptured = null;
    async function mockSolveCallback(payload) {{
      retryPayloadCaptured = payload;
      return {{
        answer: "def solve(): return 120",
        status: "ok"
      }};
    }}

    QuizZyExecutor.autoCompileAndSubmitLoop({{
      code: editorBuffer,
      language: "python",
      starter_code: "def solve():\\n    pass"
    }}, mockSolveCallback, prodMockDoc).then((res) => {{
      if (submitClickedOnProd) {{
        console.error("CRITICAL GUARDRAIL FAILURE: Submit button clicked on live platform!");
        process.exit(1);
      }}
      if (res.status !== "verified_no_submit_production_guardrail") {{
        console.error("FAIL: Expected 'verified_no_submit_production_guardrail', got:", res.status);
        process.exit(1);
      }}
      if (!retryPayloadCaptured || !retryPayloadCaptured.error_context) {{
        console.error("FAIL: Retry was not invoked with error_context:", retryPayloadCaptured);
        process.exit(1);
      }}
      if (retryPayloadCaptured.bypass_cache !== true) {{
        console.error("FAIL: bypass_cache must be true on self-healing retry");
        process.exit(1);
      }}
      if (!retryPayloadCaptured.error_context.includes("WRONG_ANSWER")) {{
        console.error("FAIL: error_context missing WRONG_ANSWER classification");
        process.exit(1);
      }}
      console.log("SUCCESS: Attempt 1 -> Failure -> Attempt 2 Self-Healing verified with guardrail");
    }}).catch(err => {{
      console.error("ERROR in happy path:", err);
      process.exit(1);
    }});
    """

    res = subprocess.run(["node", "-e", node_script], cwd=str(WORKSPACE_ROOT), capture_output=True, text=True)
    if res.returncode != 0:
        print("Node stdout:", res.stdout)
        print("Node stderr:", res.stderr)
    assert res.returncode == 0, f"Test 5 failed with code {res.returncode}"
    print("  -> Passed End-to-End Attempt 1 -> Failure -> Attempt 2 Self-Healing Loop")


# -----------------------------------------------------------------------------
# Test 6: Bounded Retry Termination on Repeated Failure
# -----------------------------------------------------------------------------
def test_6_bounded_retry_termination_on_repeated_failure():
    """
    Test 6: Verify that if Attempt 2 ALSO fails, the engine stops cleanly
    as FAILED (no infinite loops, bounded to 1 retry).
    """
    print("\n[Self-Healing - Test 6] Verifying Bounded Retry Termination...")
    executor_path = (WORKSPACE_ROOT / "extension" / "executor.js").as_posix()

    node_script = f"""
    const QuizZyExecutor = require('{executor_path}');

    let runCount = 0;
    let retryCalls = 0;
    let editorBuffer = "int main() {{ return 1; }}";

    const alwaysFailingDoc = {{
      querySelector: (sel) => {{
        if (sel.includes("textarea") || sel.includes("ace_text-input")) {{
          return {{ focus: () => {{}}, dispatchEvent: () => {{}} }};
        }}
        if (sel.includes(".ace_editor")) {{
          return {{
            env: {{
              editor: {{
                getValue: () => editorBuffer,
                setValue: (v) => {{ editorBuffer = v; }},
                session: {{ doc: {{ setValue: (v) => {{ editorBuffer = v; }} }} }}
              }}
            }}
          }};
        }}
        return null;
      }},
      querySelectorAll: (sel) => {{
        if (sel.includes("button") || sel.includes("input")) {{
          return [{{
            innerText: "Compile & Run",
            textContent: "Compile & Run",
            click: () => {{ runCount++; }}
          }}];
        }}
        if (sel.includes("console") || sel.includes("output")) {{
          return [{{
            className: "console-output",
            innerText: "Compilation Error: persistent syntax flaw"
          }}];
        }}
        return [];
      }}
    }};

    global.window = {{ document: alwaysFailingDoc, location: {{ hostname: "localhost" }} }};
    global.document = alwaysFailingDoc;

    async function mockFailingSolveCallback(payload) {{
      retryCalls++;
      return {{
        answer: "int main() {{ return 2; }}", // Still broken
        status: "ok"
      }};
    }}

    QuizZyExecutor.autoCompileAndSubmitLoop({{
      code: editorBuffer
    }}, mockFailingSolveCallback, alwaysFailingDoc).then((res) => {{
      if (res.success !== false || res.status !== "FAILED") {{
        console.error("FAIL: Expected status 'FAILED' on repeated error, got:", res);
        process.exit(1);
      }}
      if (retryCalls !== 1) {{
        console.error("FAIL: Expected exactly 1 retry call (bounded), got:", retryCalls);
        process.exit(1);
      }}
      if (runCount !== 2) {{
        console.error("FAIL: Expected exactly 2 runs (attempt 1 + attempt 2), got:", runCount);
        process.exit(1);
      }}
      console.log("SUCCESS: Bounded retry terminated cleanly as FAILED after max 1 retry");
    }}).catch(err => {{
      console.error("ERROR in bounded retry:", err);
      process.exit(1);
    }});
    """

    res = subprocess.run(["node", "-e", node_script], cwd=str(WORKSPACE_ROOT), capture_output=True, text=True)
    if res.returncode != 0:
        print("Node stdout:", res.stdout)
        print("Node stderr:", res.stderr)
    assert res.returncode == 0, f"Test 6 failed with code {res.returncode}"
    print("  -> Passed Bounded Retry Termination on Repeated Failure")
