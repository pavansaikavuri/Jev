import asyncio
import httpx
import time
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from backend.core.llm_client import load_openrouter_api_keys

async def test_free_candidates():
    keys = load_openrouter_api_keys()
    key = keys[0]
    
    candidates = [
        "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
        "minimax/minimax-m3.1-flash:free",
        "nvidia/nemotron-3.5-lightning:free",
        "cohere/north-mini-code:free",
        "thinkingmachines/inkling:free",
    ]

    messages = [
        {"role": "user", "content": 'What is 15 * 14? Options: A: 210, B: 200, C: 220, D: 190. Return ONLY valid JSON: {"reason": "15*14=210", "answer": "A"}'}
    ]

    async with httpx.AsyncClient() as client:
        for m in candidates:
            t0 = time.perf_counter()
            try:
                r = await client.post("https://openrouter.ai/api/v1/chat/completions", headers={
                    "Authorization": f"Bearer {key}",
                    "HTTP-Referer": "https://github.com/quizzy-eval",
                    "X-Title": "QuizZy Evaluator",
                }, json={
                    "model": m,
                    "messages": messages,
                    "max_tokens": 150,
                }, timeout=8.0)
                el = (time.perf_counter() - t0)*1000
                if r.status_code == 200:
                    c = r.json()["choices"][0]["message"]["content"]
                    print(f"PASS {m} ({el:.0f}ms): {c.strip()[:100]}")
                else:
                    print(f"FAIL {m} ({r.status_code}, {el:.0f}ms): {r.text[:120]}")
            except Exception as e:
                el = (time.perf_counter() - t0)*1000
                print(f"TIMEOUT/ERR {m} ({el:.0f}ms): {e}")

if __name__ == '__main__':
    asyncio.run(test_free_candidates())
