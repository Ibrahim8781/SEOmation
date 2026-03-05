# ai/debug_content_generation.py - NEW FILE

"""
Debug script to find why content HTML is empty.
Tests the full content generation pipeline step by step.
"""

import asyncio
import httpx
import json

BASE_URL = "http://127.0.0.1:8001"

async def test_content_generation_detailed():
    """Test content generation with detailed output"""
    
    print("\n" + "="*70)
    print("CONTENT GENERATION DEBUG")
    print("="*70 + "\n")
    
    payload = {
        "userId": "test",
        "platform": "blog",
        "language": "en",
        "topicOrIdea": "Quick cooking tips for beginners",
        "tone": "friendly",
        "targetLength": 800,
        "focusKeyword": "cooking tips"
    }
    
    print("📤 Sending request...")
    print(f"  Topic: {payload['topicOrIdea']}")
    print(f"  Length: {payload['targetLength']} words")
    print(f"  Platform: {payload['platform']}")
    
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{BASE_URL}/content/generate",
                json=payload
            )
        
        print(f"\n📥 Response Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ Error Response:")
            print(json.dumps(resp.json(), indent=2))
            return False
        
        data = resp.json()
        
        print(f"\n✅ Response Keys: {list(data.keys())}")
        
        # Check contentForEditor
        if "contentForEditor" in data:
            editor_content = data["contentForEditor"]
            print(f"\n📝 contentForEditor Keys: {list(editor_content.keys())}")
            
            # Check each field
            for key in editor_content.keys():
                value = editor_content[key]
                if isinstance(value, str):
                    length = len(value)
                    preview = value[:100] if length > 0 else "[EMPTY]"
                    print(f"\n  {key}:")
                    print(f"    Length: {length} chars")
                    print(f"    Preview: {preview}...")
                elif isinstance(value, list):
                    print(f"\n  {key}:")
                    print(f"    Items: {len(value)}")
                    if len(value) > 0:
                        print(f"    First item: {value[0]}")
                else:
                    print(f"\n  {key}: {value}")
            
            # Specific HTML check
            html = editor_content.get("html", "")
            if not html or html.strip() == "":
                print(f"\n❌ PROBLEM FOUND: HTML field is empty!")
                print(f"   This is why the test fails.")
                
                # Check if other fields have content
                markdown = editor_content.get("markdown", "")
                sections = editor_content.get("sections", [])
                
                if markdown and markdown.strip():
                    print(f"   BUT: markdown field has {len(markdown)} chars")
                    print(f"   → Converter might be failing")
                
                if sections and len(sections) > 0:
                    print(f"   BUT: sections has {len(sections)} items")
                    print(f"   → Content is generated, HTML conversion failing")
                
                return False
            else:
                print(f"\n✅ HTML field has content ({len(html)} chars)")
                return True
        else:
            print(f"\n❌ Missing 'contentForEditor' in response")
            return False
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_gemini_directly():
    """Test Gemini service directly"""
    
    print("\n" + "="*70)
    print("DIRECT GEMINI TEST")
    print("="*70 + "\n")
    
    try:
        from services.gemini_service import call_gemini_json
        
        messages = [
            {
                "role": "system",
                "content": "You are a content writer. Generate blog content in JSON format."
            },
            {
                "role": "user",
                "content": """
Generate a blog post about "cooking tips for beginners".

Return JSON with this structure:
{
  "title": "...",
  "html": "<h1>Title</h1><p>Content here...</p>",
  "sections": [
    {"heading": "...", "content": "..."}
  ]
}

IMPORTANT: The html field must contain actual HTML tags.
"""
            }
        ]
        
        print("📤 Calling Gemini...")
        result = await call_gemini_json(messages, max_tokens=2000, temperature=0.7)
        
        print(f"\n✅ Gemini returned JSON")
        print(f"   Keys: {list(result.keys())}")
        
        # Check HTML field
        if "html" in result:
            html = result["html"]
            print(f"\n   HTML field:")
            print(f"     Length: {len(html)} chars")
            print(f"     Preview: {html[:200]}...")
            
            if not html or html.strip() == "":
                print(f"\n   ❌ PROBLEM: Gemini returning empty HTML!")
                print(f"      Need to fix the prompt in content generation route")
            else:
                print(f"\n   ✅ HTML has content")
        
        return result
        
    except Exception as e:
        print(f"\n❌ Gemini test failed: {e}")
        import traceback
        traceback.print_exc()
        return None


async def main():
    print("\n🔍 DEBUGGING CONTENT GENERATION\n")
    
    # Test 1: Direct Gemini call
    print("="*70)
    print("TEST 1: Testing Gemini service directly")
    print("="*70)
    
    gemini_result = await test_gemini_directly()
    
    if gemini_result:
        print("\n✅ Gemini service working")
    else:
        print("\n❌ Gemini service has issues")
    
    # Test 2: Full API call
    print("\n" + "="*70)
    print("TEST 2: Testing full content generation API")
    print("="*70)
    
    api_success = await test_content_generation_detailed()
    
    # Summary
    print("\n" + "="*70)
    print("DIAGNOSIS SUMMARY")
    print("="*70)
    
    if gemini_result and api_success:
        print("\n✅ Everything working!")
    elif gemini_result and not api_success:
        print("\n⚠️  Gemini works, but API route has issues")
        print("   → Need to check content.py route")
        print("   → Prompt might not be asking for HTML correctly")
    elif not gemini_result:
        print("\n❌ Gemini service has issues")
        print("   → Need to fix gemini_service.py")
    
    print("\n" + "="*70 + "\n")


if __name__ == "__main__":
    asyncio.run(main())