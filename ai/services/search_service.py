# services/search_service.py - PRODUCTION READY

import httpx
import logging
import asyncio
from typing import List, Dict
from config import settings

logger = logging.getLogger(__name__)

async def google_search(query: str, num_results: int = 5) -> List[Dict[str, str]]:
    """
    Multi-tier search with automatic fallback:
    1. SerpAPI (best quality, 100/month limit)
    2. DuckDuckGo (unlimited, decent quality)
    3. Google News RSS (backup for news content)
    """
    
    # Tier 1: Try SerpAPI first (best quality)
    serpapi_key = getattr(settings, 'SERPAPI_KEY', None)
    if serpapi_key:
        try:
            results = await _serpapi_search(query, num_results, serpapi_key)
            if results:
                logger.info("search_source", extra={"source": "serpapi", "query": query, "results": len(results)})
                return results
        except Exception as e:
            logger.warning(f"SerpAPI failed: {str(e)}, falling back to DuckDuckGo")
    
    # Tier 2: DuckDuckGo fallback (unlimited, always works)
    try:
        results = await _duckduckgo_search(query, num_results)
        if results:
            logger.info("search_source", extra={"source": "duckduckgo", "query": query, "results": len(results)})
            return results
    except Exception as e:
        logger.warning(f"DuckDuckGo failed: {str(e)}, falling back to Google News RSS")
    
    # Tier 3: Google News RSS fallback (for content discovery)
    try:
        results = await _google_news_search(query, num_results)
        if results:
            logger.info("search_source", extra={"source": "google_news_rss", "query": query, "results": len(results)})
            return results
    except Exception as e:
        logger.error(f"All search methods failed: {str(e)}")
    
    # Final fallback: return empty (graceful degradation)
    logger.error("all_search_failed", extra={"query": query})
    return []

async def _serpapi_search(query: str, num_results: int, api_key: str) -> List[Dict[str, str]]:
    """SerpAPI search (100/month free)"""
    url = "https://serpapi.com/search"
    params = {
        "engine": "google",
        "q": query,
        "api_key": api_key,
        "num": min(num_results, 10)
    }
    
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        # Check for error responses
        if "error" in data:
            raise Exception(f"SerpAPI error: {data['error']}")
        
        results = []
        for item in data.get("organic_results", [])[:num_results]:
            snippet = item.get("snippet", "")
            results.append({
                "title": item.get("title", ""),
                "url": item.get("link", ""),
                "snippet": snippet,
                "body": snippet
            })
        
        return results

async def _duckduckgo_search(query: str, num_results: int) -> List[Dict[str, str]]:
    """
    DuckDuckGo search - unlimited and free
    Uses ddgs library in thread pool to avoid blocking
    """
    try:
        from ddgs import DDGS  # noqa: F401
    except ImportError:
        logger.error("ddgs not installed. Run: pip install -r requirements.txt")
        return []
    
    # Run sync DDG search in thread pool
    loop = asyncio.get_event_loop()
    results = await loop.run_in_executor(None, _sync_ddg_search, query, num_results)
    return results

def _sync_ddg_search(query: str, num_results: int) -> List[Dict[str, str]]:
    """Synchronous DuckDuckGo search (called in thread pool)"""
    from ddgs import DDGS
    
    results = []
    with DDGS() as ddgs:
        search_results = ddgs.text(
            query, 
            max_results=num_results,
            region='wt-wt',  # Worldwide
            safesearch='moderate'
        )
        
        for item in search_results:
            snippet = item.get("body", "")
            results.append({
                "title": item.get("title", ""),
                "url": item.get("href", ""),
                "snippet": snippet,
                "body": snippet
            })
    
    return results

async def _google_news_search(query: str, num_results: int) -> List[Dict[str, str]]:
    """Google News RSS fallback"""
    import feedparser
    from urllib.parse import quote_plus
    
    q = quote_plus(query)
    url = f"https://news.google.com/rss/search?q={q}&hl=en&gl=US&ceid=US:en"
    
    fp = feedparser.parse(url)
    results = []
    
    for entry in fp.entries[:num_results]:
        title = entry.get("title", "")
        link = entry.get("link", "")
        # RSS doesn't have snippets, use title as snippet
        snippet = entry.get("summary", title)
        
        results.append({
            "title": title,
            "url": link,
            "snippet": snippet[:300],
            "body": snippet[:300]
        })
    
    return results

async def google_search_urls(query: str, num_results: int = 10) -> List[str]:
    """Convenience function to get just URLs"""
    results = await google_search(query, num_results)
    return [r["url"] for r in results if r.get("url")]
