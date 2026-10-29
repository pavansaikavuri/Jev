import asyncio
import httpx
import time
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from backend.core.llm_client import load_openrouter_api_keys

async def test_or_models():
    keys = load_openrouter_api_keys()
    if not keys:
        print("No openrouter keys!")
        return
    key = keys[0]
    
    models_to_test = [
        "nvidia/nemotron-3-ultra-550b-a55b:free",
        "nvidia/nemotron-3-super-120b-a12b:free",
        "google/gemma-4-31b-it:free",
        "google/gemma-4-26b-a4b-it:free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "qwen/qwen-2.5-72b-instruct:free",
    ]

    messages = [
        {"role": "user", "content": 'What is the powerhouse of the eukaryotic cell? Options: A: Nucleus, B: Mitochondrion. Output JSON: {"reason": "...", "answer": "B"}'}
    ]

    async with httpx.AsyncClient() as client:
        for m in models_to_test:
            t0 = time.perf_counter()
            try:
                r = await client.post("https://openrouter.ai/api/v1/chat/completions", headers={
                    "Authorization": f"Bearer {key}",
                    "HTTP-Referer": "https://github.com/quizzy-eval",
                    "X-Title": "QuizZy Evaluator",
                }, json={
                    "model": m,
                    "messages": messages,
                    "max_tokens": 200,
                }, timeout=8.0)
                el = (time.perf_counter() - t0)*1000
                if r.status_code == 200:
                    c = r.json()["choices"][0]["message"]["content"]
                    print(f"PASS {m} ({el:.0f}ms): {c.strip()[:100]}")
                else:
                    print(f"FAIL {m} (status {r.status_code}, {el:.0f}ms): {r.text[:100]}")
            except Exception as e:
                el = (time.perf_counter() - t0)*1000
                print(f"EXC {m} ({el:.0f}ms): {e}")

if __name__ == '__main__':
    asyncio.run(test_or_models())
