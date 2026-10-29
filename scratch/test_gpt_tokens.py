import asyncio
import httpx
import time
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from backend.core.llm_client import load_groq_api_keys

async def test_gpt_tokens():
    keys = load_groq_api_keys()
    key = keys[0]
    q_text = """Eight friends P, Q, R, S, T, U, V, and W are born in the same month of different years, i.e., 1978, 1984, 1990, 1994, 1998, 2002, 2007, and 2012, not necessarily in the same order. Their age is considered to be in the same month of 2032.

R was born in an even year after 1998.
R is not the youngest person.
The sum of the ages of P and Q is equal to V.
The difference in age between V and S is 12 years.
The difference in age between P and U is less than 6 years.
T is 8 years older than R.

Who is the oldest person in all?
Options: A: S, B: U, C: P, D: V, E: None of these"""

    messages = [
        {"role": "system", "content": 'You are an expert puzzle and competitive exam solver. Solve step-by-step and return ONLY a JSON object: {"reason": "<deduction>", "answer": "<letter>"}.'},
        {"role": "user", "content": q_text}
    ]

    async with httpx.AsyncClient() as client:
        r = await client.post('https://api.groq.com/openai/v1/chat/completions', headers={'Authorization': f'Bearer {key}'}, json={
            'model': 'openai/gpt-oss-120b',
            'messages': messages,
            'reasoning_effort': 'low',
            'max_tokens': 1536,
        }, timeout=15.0)
        data = r.json()
        choice = data['choices'][0]
        print('finish_reason:', choice.get('finish_reason'))
        print('content length:', len(choice['message'].get('content') or ''))
        raw_c = choice['message'].get('content') or ''
        print('content:', raw_c.encode('ascii', errors='replace').decode('ascii'))
        print('reasoning length:', len(choice['message'].get('reasoning') or ''))
        print('usage:', data.get('usage'))
        print('reasoning snippet:', (choice['message'].get('reasoning') or '')[:300])

if __name__ == '__main__':
    asyncio.run(test_gpt_tokens())
