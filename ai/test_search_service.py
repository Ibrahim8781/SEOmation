# test_search_fallback.py

import asyncio
from services.search_service import google_search

async def test_search():
    print("\n=== Testing Multi-Tier Search ===\n")
    
    # Test query
    query = "Icc world cup t20 today's match between italy and Scotland result"
    
    print(f"🔍 Searching: {query}\n")
    results = await google_search(query, num_results=5)
    
    if results:
        print(f"✅ Success! Found {len(results)} results\n")
        for i, r in enumerate(results, 1):
            print(f"{i}. {r['title']}")
            print(f"   URL: {r['url']}")
            print(f"   Snippet: {r['snippet'][:80]}...")
            print()
    else:
        print("❌ No results found - all search methods failed")

if __name__ == "__main__":
    asyncio.run(test_search())