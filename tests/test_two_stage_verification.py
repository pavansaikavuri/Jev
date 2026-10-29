"""Tests for Two-Stage Verification Prompt Architecture and Parser Integration."""

import pytest
from backend.core.parser import (
    ParsedLLMResponse,
    ParseError,
    extract_json_candidate,
    parse_llm_response,
)
from backend.core.prompts import (
    CODING_SYSTEM_PROMPT,
    SYSTEM_PROMPT,
    build_code_prompts,
    build_prompt_messages,
    build_user_prompt,
)


def test_system_prompt_two_stage_contract():
    """Verify SYSTEM_PROMPT contains the XML Two-Stage Verification contract and directives."""
    assert "<system_role>" in SYSTEM_PROMPT
    assert "Core Verification and Assessment Engine for QuizZy" in SYSTEM_PROMPT
    assert "<core_directives>" in SYSTEM_PROMPT
    assert "ZERO PREMATURE COMMITMENT" in SYSTEM_PROMPT
    assert "DISTRACTOR AUDIT" in SYSTEM_PROMPT
    assert "ADVERSARIAL SELF-CHECK" in SYSTEM_PROMPT
    assert "POINTER INTEGRITY" in SYSTEM_PROMPT
    assert "<output_contract>" in SYSTEM_PROMPT
    assert "<verification_workspace>" in SYSTEM_PROMPT
    assert "<verified_json>" in SYSTEM_PROMPT
    # Security preservation
    assert "CRITICAL SECURITY INSTRUCTION" in SYSTEM_PROMPT
    assert "CRITICAL SEARCH CONTEXT INSTRUCTION" in SYSTEM_PROMPT
    assert "<untrusted_quiz_data>" in SYSTEM_PROMPT
    assert "<untrusted_search_context>" in SYSTEM_PROMPT


def test_coding_system_prompt_contract():
    """Verify CODING_SYSTEM_PROMPT adheres to the verification contract."""
    assert "<system_role>" in CODING_SYSTEM_PROMPT
    assert "ZERO PREMATURE COMMITMENT" in CODING_SYSTEM_PROMPT
    assert "<verification_workspace>" in CODING_SYSTEM_PROMPT
    assert "<verified_json>" in CODING_SYSTEM_PROMPT
    assert "CRITICAL SECURITY INSTRUCTION" in CODING_SYSTEM_PROMPT


def test_user_prompt_no_think_removed_and_two_stage_guided():
    """Verify build_user_prompt has no /no_think and guides model to complete verification workspace first."""
    prompt = build_user_prompt(
        subject="Computer Science",
        q_type="mcq",
        question="What is 2 + 2?",
        options=["3", "4", "5", "6"],
    )
    assert "/no_think" not in prompt
    assert "<verification_workspace>" in prompt
    assert "<verified_json>" in prompt


def test_parser_extracts_two_stage_response():
    """Verify parser extracts verification_workspace and parsed JSON."""
    raw = """
<verification_workspace>
1. [Problem Deconstruction]: Find 2 + 2.
2. [First-Principles Derivation]: 2 + 2 = 4.
3. [Option-by-Option Audit]:
   - Option A: 3 -> False (2+2 is 4)
   - Option B: 4 -> True (Matches derivation)
   - Option C: 5 -> False
   - Option D: 6 -> False
4. [Adversarial Critic]: Exactly one correct answer. Option B = 4.
</verification_workspace>

<verified_json>
{
  "reason": "Calculated 2+2=4 which corresponds to option B.",
  "answer": "B"
}
</verified_json>
"""
    parsed = parse_llm_response(raw)
    assert parsed.answer == "B"
    assert "option B" in parsed.reason
    assert parsed.verification_workspace is not None
    assert "First-Principles Derivation" in parsed.verification_workspace
    assert "Option-by-Option Audit" in parsed.verification_workspace


def test_parser_handles_alternative_keys():
    """Verify parser maps explanation/reasoning_summary -> reason and correctAnswer/correctOptionId -> answer."""
    raw1 = """
<verification_workspace>
Auditing options: A is correct.
</verification_workspace>
<verified_json>
{
  "explanation": "Derived option A from first principles.",
  "correctAnswer": "A"
}
</verified_json>
"""
    p1 = parse_llm_response(raw1)
    assert p1.answer == "A"
    assert p1.reason == "Derived option A from first principles."
    assert p1.verification_workspace == "Auditing options: A is correct."

    raw2 = """
<verification_workspace>
Option C is the only valid solution.
</verification_workspace>
<verified_json>
{
  "reasoning_summary": "Option C satisfies all invariants.",
  "correctOptionId": "C"
}
</verified_json>
"""
    p2 = parse_llm_response(raw2)
    assert p2.answer == "C"
    assert p2.reason == "Option C satisfies all invariants."


def test_parser_backward_compatible_raw_json():
    """Verify parser still handles legacy responses without XML tags."""
    raw = '{"reason": "Direct derivation without XML", "answer": "D"}'
    parsed = parse_llm_response(raw)
    assert parsed.answer == "D"
    assert parsed.reason == "Direct derivation without XML"
    assert parsed.verification_workspace is None


def test_parser_handles_markdown_inside_verified_json():
    """Verify parser handles markdown code blocks inside <verified_json>."""
    raw = """
<verification_workspace>
Derivation steps...
</verification_workspace>
<verified_json>
```json
{
  "reason": "Fenced JSON derivation",
  "answer": "A"
}
```
</verified_json>
"""
    parsed = parse_llm_response(raw)
    assert parsed.answer == "A"
    assert parsed.reason == "Fenced JSON derivation"

