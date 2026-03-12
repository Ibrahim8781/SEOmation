"""
Quick test for kie.ai Seedream 3.0 image generation.
Run from the ai/ folder: python test_kie.py
"""

import asyncio
import json
import os
import sys

# Load .env manually (no extra deps needed)
from dotenv import load_dotenv
load_dotenv()

KIE_API_KEY = os.getenv("KIE_API_KEY", "")
KIE_MODEL   = os.getenv("KIE_MODEL", "bytedance/seedream")
KIE_BASE    = "https://api.kie.ai/api/v1"

if not KIE_API_KEY:
    print("ERROR: KIE_API_KEY is empty in .env")
    sys.exit(1)


async def check_credits():
    import httpx
    headers = {"Authorization": f"Bearer {KIE_API_KEY}"}
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{KIE_BASE}/chat/credit", headers=headers)
    print(f"\n--- Credit Check ---")
    print(f"Status: {resp.status_code}")
    print(json.dumps(resp.json(), indent=2))


async def test_generate():
    import httpx

    headers = {
        "Authorization": f"Bearer {KIE_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": KIE_MODEL,
        "input": {
            "prompt": "a cozy coffee shop interior with warm lighting, high quality photo",
            "image_size": "square_hd",
            "guidance_scale": 2.5,
            "enable_safety_checker": True,
        },
    }

    print(f"\n--- Creating task (model={KIE_MODEL}) ---")
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(f"{KIE_BASE}/jobs/createTask", headers=headers, json=payload)

    print(f"Status: {resp.status_code}")
    body = resp.json()
    print(json.dumps(body, indent=2))

    if resp.status_code != 200 or body.get("code") != 200:
        print("\nFAILED: task was not created. Check the error message above.")
        return

    task_id = body["data"]["taskId"]
    print(f"\nTask created! taskId = {task_id}")
    print("Polling for result (up to 90s)...")

    # Poll
    for i in range(30):
        await asyncio.sleep(3)
        async with httpx.AsyncClient(timeout=10) as client:
            poll = await client.get(
                f"{KIE_BASE}/jobs/recordInfo",
                headers=headers,
                params={"taskId": task_id},
            )
        data = poll.json().get("data", {})
        state = data.get("state", "unknown")
        print(f"  [{i+1:2d}] state = {state}")

        if state == "success":
            result_json = json.loads(data.get("resultJson", "{}"))
            urls = result_json.get("resultUrls", [])
            print(f"\nSUCCESS! Image URL(s):")
            for url in urls:
                print(f"  {url}")
            print("\nYou can paste any URL above into your browser to see the image.")
            return

        if state == "fail":
            print(f"\nFAILED: {data.get('failMsg', 'no message')}")
            return

    print("\nTIMEOUT: task didn't finish in 90s")


async def main():
    await check_credits()
    await test_generate()


asyncio.run(main())
