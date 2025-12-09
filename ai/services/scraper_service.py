from typing import List, Dict, Set
import feedparser, httpx, logging
from bs4 import BeautifulSoup
from urllib.parse import quote_plus, urlparse
from urllib import robotparser
from config import settings

logger = logging.getLogger(__name__)

HEADERS = {"User-Agent": "SEOmationBot/1.0 (+https://example.com/bot)"}

# Small, curated RSS sets per broad niche; kept short to avoid noise.
TOP_RSS = {
    "seo": [
        "https://neilpatel.com/blog/feed/",
        "https://backlinko.com/blog/feed",
        "https://moz.com/blog/feed"
    ],
    "tech": [
        "https://www.theverge.com/rss/index.xml",
        "https://techcrunch.com/feed/"
    ],
    "business": [
        "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
        "https://www.forbes.com/most-popular/feed/"
    ],
    "sports": [
        "https://www.espn.com/espn/rss/news",
        "https://www.skysports.com/rss/12040"
    ],
    "general": [
        "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
        "https://feeds.bbci.co.uk/news/rss.xml"
    ]
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

async def fetch_rss(niche: str) -> List[Dict]:
    urls = TOP_RSS.get(niche.lower(), []) or TOP_RSS.get("general", [])
    items: List[Dict] = []
    for u in urls:
        try:
            fp = feedparser.parse(u)
            for e in fp.entries[:8]:
                items.append({"title": e.get("title", ""), "url": e.get("link", "")})
        except Exception:
            continue
    return items

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

async def extract_main_text(url: str) -> str:
    html = await fetch_html(url)
    if not html:
        return ""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script","style","nav","footer","header","noscript"]):
        tag.extract()
    text = " ".join([p.get_text(" ", strip=True) for p in soup.find_all(["p","li"])])[:6000]
    return text

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

    # Baseline RSS by niche/general
    rss = await fetch_rss(niche)
    urls.extend([it["url"] for it in rss if it.get("url")])

    logger.info("RAG candidate_urls", extra={"query": q, "serper": len(surls), "gnews": len(gitems), "rss": len(rss)})

    # Dedup
    seen: Set[str] = set()
    dedup: List[str] = []
    for u in urls:
        if not u or u in seen: continue
        seen.add(u); dedup.append(u)
    return dedup[:24]
