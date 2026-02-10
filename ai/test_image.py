# ai/test_providers_debug.py

import asyncio
from services.image_service import (
    _generate_with_fal,
    _generate_with_segmind,
    _generate_with_pollinations
)

async def test_all_providers():
    print("\n" + "="*70)
    print("🔍 DIAGNOSTIC TEST - Checking Each Provider")
    print("="*70 + "\n")
    
    prompt = "modern office workspace"
    style = "professional photography"
    size = "1024x1024"
    
    # Test FAL.ai
    print("1️⃣ Testing FAL.ai...")
    try:
        result = await _generate_with_fal(prompt, style, size, 0)
        print(f"   ✅ FAL.ai SUCCESS!")
        print(f"   Provider: {result['provider']}")
        print(f"   Image size: {len(result['base64'])} chars\n")
    except Exception as e:
        print(f"   ❌ FAL.ai FAILED")
        print(f"   Error: {str(e)}\n")
    
    # Test Segmind
    print("2️⃣ Testing Segmind...")
    try:
        result = await _generate_with_segmind(prompt, style, size, 0)
        print(f"   ✅ Segmind SUCCESS!")
        print(f"   Provider: {result['provider']}")
        print(f"   Image size: {len(result['base64'])} chars\n")
    except Exception as e:
        print(f"   ❌ Segmind FAILED")
        print(f"   Error: {str(e)}\n")
    
    # Test Pollinations (should always work)
    print("3️⃣ Testing Pollinations...")
    try:
        result = await _generate_with_pollinations(prompt, style, size, 0)
        print(f"   ✅ Pollinations SUCCESS!")
        print(f"   Provider: {result['provider']}")
        print(f"   Image size: {len(result['base64'])} chars\n")
    except Exception as e:
        print(f"   ❌ Pollinations FAILED")
        print(f"   Error: {str(e)}\n")
    
    print("="*70)

asyncio.run(test_all_providers())