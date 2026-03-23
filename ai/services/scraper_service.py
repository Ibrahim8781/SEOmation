from typing import List, Dict, Set
import feedparser, httpx, logging, asyncio
from urllib.parse import quote_plus, urlparse
from urllib import robotparser
from config import settings

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
}

def _allowed(url: str) -> bool:
    try:
        rp = robotparser.RobotFileParser()
        base = f"{urlparse(url).scheme}://{urlparse(url).netloc}/robots.txt"
        rp.set_url(base)
        rp.read()
        return rp.can_fetch(HEADERS["User-Agent"], url)
    except Exception:
        return True

async def fetch_html(url: str) -> str:
    if not _allowed(url):
        return ""
    try:
        async with httpx.AsyncClient(headers=HEADERS, timeout=20) as client:
            r = await client.get(url)
            r.raise_for_status()
            return r.text
    except Exception:
        return ""

async def fetch_multiple_urls_parallel(urls: List[str], max_concurrent: int = 5) -> List[str]:
    """Fetch multiple URLs in parallel with concurrency limit"""
    semaphore = asyncio.Semaphore(max_concurrent)
    
    async def fetch_with_limit(url: str) -> str:
        async with semaphore:
            return await fetch_html(url)
    
    tasks = [fetch_with_limit(url) for url in urls[:10]]  # Limit to top 10
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Filter out errors
    return [r for r in results if isinstance(r, str) and r]

async def google_news_items(query: str) -> List[Dict]:
    q = quote_plus(query)
    url = f"https://news.google.com/rss/search?q={q}&hl={settings.GN_HL}&gl={settings.GN_GL}&ceid={settings.GN_CEID}"
    try:
        fp = feedparser.parse(url)
        return [{"title": e.get("title",""), "url": e.get("link","")} for e in fp.entries[:10]]
    except Exception:
        return []

async def serper_urls(query: str, num: int = 10) -> List[str]:
    key = settings.SERPER_API_KEY or ""
    if not key:
        return []
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(
                "https://google.serper.dev/search",
                headers={"X-API-KEY": key, "Content-Type": "application/json"},
                json={"q": query, "num": num}
            )
            r.raise_for_status()
            data = r.json()
            urls: List[str] = []
            for k in ("news", "organic"):
                for it in data.get(k, [])[:num]:
                    u = it.get("link") or it.get("url")
                    if u: urls.append(u)
            return urls[:num]
    except Exception:
        return []

async def candidate_urls(niche: str, seed_keywords: List[str], language: str, region: str) -> List[str]:
    q = f"{niche} {(' '.join(seed_keywords)) if seed_keywords else ''}".strip()
    urls: List[str] = []

    # Prefer Serper if available for fresher/broader coverage
    surls = await serper_urls(q, num=10)
    urls.extend(surls)

    # Google News RSS fallback
    gitems = await google_news_items(q)
    urls.extend([it["url"] for it in gitems if it.get("url")])

    logger.info("RAG candidate_urls", extra={"query": q, "serper": len(surls), "gnews": len(gitems)})

    # Dedup
    seen: Set[str] = set()
    dedup: List[str] = []
    for u in urls:
        if not u or u in seen: continue
        seen.add(u); dedup.append(u)
    return dedup[:24]
