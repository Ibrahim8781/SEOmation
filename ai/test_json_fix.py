# ai/test_json_fix.py - NEW FILE

"""
Test script to verify robust JSON parsing.
Tests various problematic Gemini response formats.
"""

import asyncio
import json

# Simulate problematic Gemini responses
test_cases = [
    {
        "name": "Clean JSON",
        "response": '{"title": "Test", "value": 123}',
        "should_pass": True
    },
    {
        "name": "Markdown wrapped",
        "response": '```json\n{"title": "Test", "value": 123}\n```',
        "should_pass": True
    },
    {
        "name": "Markdown without json tag",
        "response": '```\n{"title": "Test", "value": 123}\n```',
        "should_pass": True
    },
    {
        "name": "Text before JSON",
        "response": 'Here is your JSON:\n{"title": "Test", "value": 123}',
        "should_pass": True
    },
    {
        "name": "Text after JSON",
        "response": '{"title": "Test", "value": 123}\nHere you go!',
        "should_pass": True
    },
    {
        "name": "Complex markdown (your error case)",
        "response": '```json\n{\n  "title": "Quick & Easy Cooking Tips",\n  "sections": [\n    {"heading": "Introduction"}\n  ]\n}\n```',
        "should_pass": True
    },
    {
        "name": "Nested objects",
        "response": '{"outer": {"inner": {"deep": "value"}}}',
        "should_pass": True
    },
    {
        "name": "Array with objects",
        "response": '{"items": [{"id": 1}, {"id": 2}]}',
        "should_pass": True
    },
]


def clean_json_response(raw_response: str) -> dict:
    """
    Simulates the fixed call_gemini_json cleaning logic.
    """
    import re
    
    # Multi-layer cleaning
    cleaned = raw_response.strip()
    
    # Layer 1: Remove markdown code blocks with newlines
    markdown_patterns = [
        r'```json\s*([\s\S]*?)\s*```',  # ```json ... ```
        r'```\s*([\s\S]*?)\s*```',       # ``` ... ```
    ]
    
    for pattern in markdown_patterns:
        match = re.search(pattern, cleaned)
        if match:
            cleaned = match.group(1)
            break
    
    # Layer 2: Remove any remaining markdown artifacts
    cleaned = re.sub(r'^```json\s*', '', cleaned)
    cleaned = re.sub(r'^```\s*', '', cleaned)
    cleaned = re.sub(r'\s*```$', '', cleaned)
    cleaned = cleaned.strip('`').strip()
    
    # Layer 3: Find JSON object boundaries
    first_brace = cleaned.find('{')
    last_brace = cleaned.rfind('}')
    
    if first_brace != -1 and last_brace != -1 and first_brace < last_brace:
        cleaned = cleaned[first_brace:last_brace + 1]
    
    # Layer 4: Try to parse
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        # Layer 5: Last resort - regex extraction
        json_pattern = r'\{(?:[^{}]|(?:\{(?:[^{}]|(?:\{[^{}]*\}))*\}))*\}'
        json_match = re.search(json_pattern, cleaned)
        
        if json_match:
            try:
                potential_json = json_match.group(0)
                return json.loads(potential_json)
            except json.JSONDecodeError:
                pass
        
        raise ValueError(f"Invalid JSON: {e}")


async def main():
    print("\n" + "="*70)
    print("JSON PARSING FIX - TEST SUITE")
    print("="*70 + "\n")
    
    passed = 0
    failed = 0
    
    for i, test in enumerate(test_cases, 1):
        print(f"[TEST {i}] {test['name']}")
        print(f"  Input: {test['response'][:60]}...")
        
        try:
            result = clean_json_response(test['response'])
            
            if test['should_pass']:
                print(f"  ✅ PASSED - Parsed: {json.dumps(result, indent=2)[:100]}...")
                passed += 1
            else:
                print(f"  ❌ FAILED - Should have failed but passed")
                failed += 1
                
        except Exception as e:
            if not test['should_pass']:
                print(f"  ✅ PASSED - Correctly failed with: {str(e)[:50]}")
                passed += 1
            else:
                print(f"  ❌ FAILED - Error: {str(e)[:100]}")
                failed += 1
        
        print()
    
    print("="*70)
    print(f"RESULTS: {passed}/{len(test_cases)} passed, {failed}/{len(test_cases)} failed")
    print("="*70 + "\n")
    
    if failed == 0:
        print("🎉 ALL TESTS PASSED! JSON parsing is robust.\n")
        return True
    else:
        print(f"⚠️  {failed} test(s) failed. Review implementation.\n")
        return False


if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)