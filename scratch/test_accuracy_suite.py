import asyncio
import httpx
import json
import time

BASE_URL = "http://127.0.0.1:8000"

TEST_CASES = [
    {
        "name": "1. Complex 8-Person Birth Year Logic Puzzle",
        "payload": {
            "subject": "General",
            "q_type": "mcq",
            "question": """Eight friends P, Q, R, S, T, U, V, and W are born in the same month of different years, i.e., 1978, 1984, 1990, 1994, 1998, 2002, 2007, and 2012, not necessarily in the same order. Their age is considered to be in the same month of 2032.

R was born in an even year after 1998.
R is not the youngest person.
The sum of the ages of P and Q is equal to V.
The difference in age between V and S is 12 years.
The difference in age between P and U is less than 6 years.
T is 8 years older than R.

Who is the oldest person in all?""",
            "options": ["S", "U", "P", "V", "None of these"],
            "bypass_cache": True
        },
        "expected_answer": "D",
        "expected_text": "V"
    },
    {
        "name": "2. Permutation with Repeated Letters (ARRANGE)",
        "payload": {
            "subject": "Mathematics",
            "q_type": "mcq",
            "question": "How many distinct arrangements can be made using all the letters of the word ARRANGE?",
            "options": ["2520", "1260", "5040", "840"],
            "bypass_cache": True
        },
        "expected_answer": "B",
        "expected_text": "1260"
    },
    {
        "name": "3. Negative Polarity Question (NOT / EXCEPT)",
        "payload": {
            "subject": "Chemistry",
            "q_type": "mcq",
            "question": "Which of the following is NOT a characteristic property of an acid?",
            "options": [
                "Turns blue litmus paper red",
                "Has a sour taste",
                "Has a pH value greater than 7",
                "Reacts with metals to produce hydrogen gas"
            ],
            "bypass_cache": True
        },
        "expected_answer": "C",
        "expected_text": "Has a pH value greater than 7"
    },
    {
        "name": "4. Multi-Option with 'None of these' (Valid concrete option)",
        "payload": {
            "subject": "Computer Science",
            "q_type": "mcq",
            "question": "Which data structure follows the Last In First Out (LIFO) principle?",
            "options": [
                "Queue",
                "Tree",
                "Stack",
                "Graph",
                "None of these"
            ],
            "bypass_cache": True
        },
        "expected_answer": "C",
        "expected_text": "Stack"
    },
    {
        "name": "5. Python List Comprehension Edge Case",
        "payload": {
            "subject": "Computer Science",
            "q_type": "mcq",
            "question": "What is the output of the Python expression: [x**2 for x in range(5) if x % 2 != 0]?",
            "options": ["[0, 1, 4]", "[1, 9]", "[1, 4, 9]", "[0, 4, 16]"],
            "bypass_cache": True
        },
        "expected_answer": "B",
        "expected_text": "[1, 9]"
    }
]

async def run_accuracy_suite():
    print("=" * 75)
    print("RUNNING COMPREHENSIVE ACCURACY VERIFICATION SUITE")
    print("=" * 75)
    
    passed = 0
    total = len(TEST_CASES)
    
    async with httpx.AsyncClient() as client:
        for idx, tc in enumerate(TEST_CASES, 1):
            t0 = time.perf_counter()
            try:
                r = await client.post(f"{BASE_URL}/solve", json=tc["payload"], timeout=15.0)
                el = (time.perf_counter() - t0) * 1000
                data = r.json()
                
                status = data.get("status")
                ans = data.get("answer")
                sel_text = data.get("selected_text")
                tier = data.get("confidence_tier")
                reason = data.get("reason", "")
                
                is_correct = (status == "ok" and ans == tc["expected_answer"])
                mark = "[PASS]" if is_correct else "[FAIL]"
                if is_correct:
                    passed += 1
                
                print(f"\n[{idx}/{total}] {tc['name']} -> {mark} ({el:.0f}ms)")
                print(f"       Expected: {tc['expected_answer']} ({tc['expected_text']})")
                print(f"       Got:      {ans} ({sel_text}) | Tier: {tier}")
                print(f"       Reason:   {reason[:120]}...")
                
            except Exception as e:
                el = (time.perf_counter() - t0) * 1000
                print(f"\n[{idx}/{total}] {tc['name']} -> [ERROR] ({el:.0f}ms): {e}")

    print("\n" + "=" * 75)
    print(f"ACCURACY SUITE RESULTS: {passed}/{total} CORRECT ({(passed/total)*100:.1f}%)")
    print("=" * 75)
    
    assert passed == total, f"Expected {total}/{total} correct, got {passed}/{total}"

if __name__ == "__main__":
    asyncio.run(run_accuracy_suite())
