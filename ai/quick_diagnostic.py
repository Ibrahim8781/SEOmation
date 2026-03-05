# ai/quick_diagnostic.py - NEW FILE

"""
Quick diagnostic to identify hanging issues.
Tests each component individually with timeouts.
"""

import asyncio
import sys
from datetime import datetime

# Add timeout wrapper
async def run_with_timeout(coro, timeout, name):
    """Run a coroutine with timeout"""
    try:
        print(f"[{name}] Starting...")
        result = await asyncio.wait_for(coro, timeout=timeout)
        print(f"[{name}] ✅ Completed successfully")
        return result
    except asyncio.TimeoutError:
        print(f"[{name}] ⏱️  TIMEOUT after {timeout}s")
        return None
    except Exception as e:
        print(f"[{name}] ❌ ERROR: {str(e)[:100]}")
        return None


async def test_search():
    """Test DuckDuckGo search"""
    from services.live_search_service import search_ddg
    results = await search_ddg("cooking basics", max_results=3)
    return f"Found {len(results)} results"


async def test_scrape():
    """Test single URL scraping"""
    from services.live_search_service import scrape_url
    import httpx
    async with httpx.AsyncClient() as session:
        result = await scrape_url("https://www.bbcgoodfood.com/", session)
    return f"Scraped: {result['title'][:30] if result else 'Failed'}"


async def test_full_search_scrape():
    """Test full search + scrape pipeline"""
    from services.live_search_service import search_and_scrape
    results = await search_and_scrape(["cooking basics"], max_urls=3)
    return f"Scraped {len(results)} sources"


async def test_rag():
    """Test RAG extraction"""
    from services.live_search_service import search_and_scrape, extract_keywords_rag
    scraped = await search_and_scrape(["cooking basics"], max_urls=2)
    if scraped:
        keywords = await extract_keywords_rag(scraped, top_n=10)
        return f"Extracted {len(keywords['keywords'])} keywords"
    return "No data to extract from"


async def test_groq():
    """Test Groq LLM"""
    from services.llm_service import chat_groq
    response = await chat_groq(
        [{"role": "user", "content": "Say hello"}],
        max_tokens=50,
        temperature=0.7
    )
    return f"Response length: {len(response)} chars"


async def test_gemini():
    """Test Gemini LLM"""
    from services.gemini_service import call_gemini
    response = await call_gemini(
        [{"role": "user", "content": "Say hello"}],
        max_tokens=50,
        temperature=0.7
    )
    return f"Response length: {len(response)} chars"


async def main():
    print("\n" + "="*60)
    print("QUICK DIAGNOSTIC - Find Hanging Components")
    print("="*60)
    print(f"Started: {datetime.now().strftime('%H:%M:%S')}\n")
    
    # Test each component with timeout
    tests = [
        ("DuckDuckGo Search", test_search(), 15),
        ("Single URL Scrape", test_scrape(), 15),
        ("Full Search + Scrape", test_full_search_scrape(), 30),
        ("RAG Extraction", test_rag(), 45),
        ("Groq LLM", test_groq(), 10),
        ("Gemini LLM", test_gemini(), 10),
    ]
    
    for name, coro, timeout in tests:
        result = await run_with_timeout(coro, timeout, name)
        if result:
            print(f"  → {result}")
        print()
    
    print("="*60)
    print("Diagnostic complete!")
    print("="*60)


if __name__ == "__main__":
    asyncio.run(main())