# ai/test_all_components.py - NEW FILE

"""
Comprehensive diagnostic test for SEOmation AI service.
Tests every component: Search, RAG, Groq, Gemini, Integration.
"""

import httpx
import asyncio
import json
import sys
from datetime import datetime

BASE_URL = "http://127.0.0.1:8001"
TIMEOUT = 120  # 2 minutes


class TestRunner:
    def __init__(self):
        self.passed = []
        self.failed = []
        self.timings = {}
    
    def log_success(self, test_name, duration=None):
        self.passed.append(test_name)
        if duration:
            self.timings[test_name] = duration
        print(f"  ✅ {test_name} - PASSED" + (f" ({duration:.2f}s)" if duration else ""))
    
    def log_failure(self, test_name, error):
        self.failed.append((test_name, str(error)))
        print(f"  ❌ {test_name} - FAILED")
        print(f"     Error: {str(error)[:200]}")
    
    def print_summary(self):
        print("\n" + "="*70)
        print("TEST SUMMARY")
        print("="*70)
        print(f"✅ PASSED: {len(self.passed)}/{len(self.passed) + len(self.failed)}")
        print(f"❌ FAILED: {len(self.failed)}/{len(self.passed) + len(self.failed)}")
        
        if self.timings:
            print("\n📊 PERFORMANCE TIMINGS:")
            for test, duration in self.timings.items():
                print(f"  {test}: {duration:.2f}s")
        
        if self.failed:
            print("\n❌ FAILED TESTS:")
            for test, error in self.failed:
                print(f"  • {test}")
                print(f"    {error[:150]}")
        
        print("="*70 + "\n")
        
        return len(self.failed) == 0


runner = TestRunner()


async def test_health():
    """Test 1: Basic health check"""
    print("\n[TEST 1] Health Check")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{BASE_URL}/health")
            assert resp.status_code == 200
            assert resp.json().get("ok") == True
            runner.log_success("Health Check")
    except Exception as e:
        runner.log_failure("Health Check", e)


async def test_live_search():
    """Test 2: Live search (DuckDuckGo)"""
    print("\n[TEST 2] Live Search & Scraping")
    try:
        from services.live_search_service import expand_keywords, search_and_scrape
        
        # Test keyword expansion
        keywords = ["cooking", "basics"]
        expanded = expand_keywords(keywords)
        assert len(expanded) > 0
        print(f"  → Expanded keywords: {expanded[:2]}")
        runner.log_success("Keyword Expansion")
        
        # Test search & scrape
        start = datetime.now()
        scraped = await search_and_scrape(expanded[:2], max_urls=3)
        duration = (datetime.now() - start).total_seconds()
        
        assert len(scraped) > 0
        print(f"  → Scraped {len(scraped)} sources")
        print(f"  → Sample title: {scraped[0]['title'][:50]}...")
        runner.log_success("Live Search & Scrape", duration)
        
    except Exception as e:
        runner.log_failure("Live Search", e)


async def test_rag_extraction():
    """Test 3: RAG keyword extraction"""
    print("\n[TEST 3] RAG Keyword Extraction")
    try:
        from services.live_search_service import search_and_scrape, extract_keywords_rag
        
        # Get some data
        queries = ["home cooking basics"]
        scraped = await search_and_scrape(queries, max_urls=3)
        
        if not scraped:
            raise Exception("No data to extract keywords from")
        
        # Test RAG extraction
        start = datetime.now()
        keywords = await extract_keywords_rag(scraped, top_n=15)
        duration = (datetime.now() - start).total_seconds()
        
        assert "keywords" in keywords
        assert len(keywords["keywords"]) > 0
        
        print(f"  → Extracted {len(keywords['keywords'])} keywords")
        print(f"  → Sample keywords: {keywords['keywords'][:5]}")
        runner.log_success("RAG Extraction", duration)
        
    except Exception as e:
        runner.log_failure("RAG Extraction", e)


async def test_groq_llm():
    """Test 4: Groq LLM (for topics)"""
    print("\n[TEST 4] Groq LLM (Topics)")
    try:
        from services.llm_service import chat_groq
        
        start = datetime.now()
        response = await chat_groq(
            [
                {"role": "system", "content": "You are a helpful assistant. Return JSON only."},
                {"role": "user", "content": '{"test": "Generate a simple JSON response"}'}
            ],
            max_tokens=100,
            temperature=0.7
        )
        duration = (datetime.now() - start).total_seconds()
        
        assert response
        data = json.loads(response)
        print(f"  → Groq response received")
        print(f"  → Sample: {str(data)[:50]}...")
        runner.log_success("Groq LLM", duration)
        
    except Exception as e:
        runner.log_failure("Groq LLM", e)


async def test_gemini_llm():
    """Test 5: Gemini LLM (for content)"""
    print("\n[TEST 5] Gemini LLM (Content)")
    try:
        from services.gemini_service import call_gemini
        
        start = datetime.now()
        response = await call_gemini(
            [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Say 'Hello from Gemini' and nothing else."}
            ],
            max_tokens=50,
            temperature=0.7
        )
        duration = (datetime.now() - start).total_seconds()
        
        assert response
        assert "gemini" in response.lower() or "hello" in response.lower()
        print(f"  → Gemini response: {response[:50]}...")
        runner.log_success("Gemini LLM", duration)
        
    except Exception as e:
        runner.log_failure("Gemini LLM", e)
        print("\n  ⚠️  GEMINI KEY ISSUE DETECTED!")
        print("  → Get new key: https://aistudio.google.com/app/apikey")
        print("  → Update ai/.env: GEMINI_API_KEY=your_new_key")


async def test_topic_generation_api():
    """Test 6: Full topic generation API"""
    print("\n[TEST 6] Topic Generation API (Full Flow)")
    try:
        payload = {
            "userId": "test",
            "language": "en",
            "niche": "home cooking",
            "persona": {"role": "home chef", "pains": ["time"]},
            "seedKeywords": ["cooking", "basics"],
            "count": 6
        }
        
        start = datetime.now()
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(f"{BASE_URL}/topic/suggest", json=payload)
        duration = (datetime.now() - start).total_seconds()
        
        assert resp.status_code == 200
        data = resp.json()
        
        assert "ideas" in data
        assert len(data["ideas"]) > 0
        
        print(f"  → Generated {len(data['ideas'])} topics")
        print(f"  → Sample: {data['ideas'][0]['ideaText'][:50]}...")
        print(f"  → Used RAG: {data['diagnostics'].get('usedRAG', False)}")
        runner.log_success("Topic Generation API", duration)
        
        # Performance check
        if duration > 7:
            print(f"  ⚠️  Warning: Slower than target (7s), got {duration:.1f}s")
        
    except Exception as e:
        runner.log_failure("Topic Generation API", e)


async def test_content_generation_api():
    """Test 7: Full content generation API"""
    print("\n[TEST 7] Content Generation API (Full Flow)")
    try:
        payload = {
            "userId": "test",
            "platform": "blog",
            "language": "en",
            "topicOrIdea": "Quick cooking tips for beginners",
            "tone": "friendly",
            "targetLength": 800,  # Shorter for faster test
            "focusKeyword": "cooking tips"
        }
        
        start = datetime.now()
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                resp = await client.post(f"{BASE_URL}/content/generate", json=payload)
        except httpx.TimeoutException:
            raise Exception(f"Request timed out after {TIMEOUT}s")
        except httpx.RequestError as e:
            raise Exception(f"Request failed: {str(e)}")
        
        duration = (datetime.now() - start).total_seconds()
        
        # Better error handling
        if resp.status_code != 200:
            error_detail = resp.text[:500]
            raise Exception(f"API returned {resp.status_code}: {error_detail}")
        
        data = resp.json()
        
        if "contentForEditor" not in data:
            raise Exception(f"Missing 'contentForEditor' in response. Keys: {list(data.keys())}")
        
        content = data["contentForEditor"]
        
        if "html" not in content:
            raise Exception(f"Missing 'html' in contentForEditor. Keys: {list(content.keys())}")
        
        if len(content["html"]) == 0:
            raise Exception("Generated HTML is empty")
        
        print(f"  → Generated content ({len(content['html'])} chars)")
        print(f"  → Sample: {content['html'][:80]}...")
        print(f"  → Used RAG: {data.get('diagnostics', {}).get('usedRAG', False)}")
        runner.log_success("Content Generation API", duration)
        
        # Performance check
        if duration > 35:
            print(f"  ⚠️  Warning: Slower than target (30s), got {duration:.1f}s")
        
    except Exception as e:
        runner.log_failure("Content Generation API", e)


async def test_embedding_service():
    """Test 8: Embedding service (Cohere)"""
    print("\n[TEST 8] Embedding Service")
    try:
        from services.embedding_service import embed_texts
        
        texts = ["cooking tips", "home chef guide", "kitchen basics"]
        
        start = datetime.now()
        embeddings = embed_texts(texts)
        duration = (datetime.now() - start).total_seconds()
        
        assert len(embeddings) == len(texts)
        assert len(embeddings[0]) > 0  # Has dimensions
        
        print(f"  → Embedded {len(texts)} texts")
        print(f"  → Dimension: {len(embeddings[0])}")
        runner.log_success("Embedding Service", duration)
        
    except Exception as e:
        runner.log_failure("Embedding Service", e)


async def main():
    print("\n" + "="*70)
    print("SEOmation AI - COMPREHENSIVE DIAGNOSTIC TEST")
    print("="*70)
    print(f"Target: {BASE_URL}")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Run all tests
    await test_health()
    await test_live_search()
    await test_rag_extraction()
    await test_groq_llm()
    await test_gemini_llm()
    await test_embedding_service()
    await test_topic_generation_api()
    await test_content_generation_api()
    
    # Print summary
    all_passed = runner.print_summary()
    
    if all_passed:
        print("🎉 ALL TESTS PASSED! System is fully operational.")
        sys.exit(0)
    else:
        print("⚠️  Some tests failed. Review errors above.")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())