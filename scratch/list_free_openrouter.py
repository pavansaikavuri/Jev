import asyncio
import httpx
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from backend.core.llm_client import load_openrouter_api_keys

async def list_free_models():
    keys = load_openrouter_api_keys()
    key = keys[0]
    async with httpx.AsyncClient() as client:
        r = await client.get("https://openrouter.ai/api/v1/models", headers={"Authorization": f"Bearer {key}"})
        data = r.json()
        models = data.get("data", [])
        free_models = [m["id"] for m in models if ":free" in m.get("id", "")]
        print("Total free models found:", len(free_models))
        for m in sorted(free_models):
            print(" -", m)

if __name__ == '__main__':
    asyncio.run(list_free_models())
