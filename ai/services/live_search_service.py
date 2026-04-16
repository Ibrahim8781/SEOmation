"""
Live search and RAG service for keyword extraction and content research.
Uses DuckDuckGo for unlimited searches and temporary RAG for keyword extraction.
"""

import asyncio
import httpx
import logging
from typing import List, Dict, Set
from bs4 import BeautifulSoup
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer
import re
from urllib.parse import urlparse

# Import ddgs conditionally (not always needed)
try:
    from ddgs import DDGS
    DDGS_AVAILABLE = True
except ImportError:
    DDGS_AVAILABLE = False

logger = logging.getLogger(__name__)

# Timeout settings
SEARCH_TIMEOUT = 10  # seconds per search
SCRAPE_TIMEOUT = 8   # seconds per URL
SCRAPE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
}

DISCOURAGED_SOURCE_DOMAINS = {
    "dispatchpressimages.com",
    "facebook.com",
    "grokipedia.com",
    "instagram.com",
    "linkedin.com",
    "msn.com",
    "newsnow.co.uk",
    "newsnow.com",
    "pinterest.com",
    "reddit.com",
    "tiktok.com",
    "twitter.com",
    "x.com",
    "youtube.com",
}

LOW_PRIORITY_REFERENCE_DOMAINS = {
    "wikipedia.org",
}

LOW_SIGNAL_URL_PATTERNS = (
    "/tag/",
    "/tags/",
    "/topic/",
    "/topics/",
    "/category/",
    "/categories/",
    "/search",
    "/rss",
)

QUERY_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "how",
    "in",
    "is",
    "latest",
    "news",
    "of",
    "on",
    "or",
    "the",
    "this",
    "to",
    "today",
    "vs",
    "what",
    "when",
    "with",
}

SIGNAL_TERMS = {
    "analysis",
    "guide",
    "preview",
    "price",
    "pricing",
    "result",
    "results",
    "review",
    "schedule",
    "stats",
}


def _base_domain(url: str) -> str:
    try:
        domain = (urlparse(url).netloc or "").lower()
    except Exception:
        return ""
    return domain[4:] if domain.startswith("www.") else domain


def _matches_domain(domain: str, candidates: Set[str]) -> bool:
    return any(domain == candidate or domain.endswith(f".{candidate}") for candidate in candidates)


def _tokenize_text(text: str) -> Set[str]:
    return {
        token
        for token in re.findall(r"[a-z0-9]+", text.lower())
        if len(token) >= 3 and token not in QUERY_STOPWORDS
    }


def _count_signal_terms(tokens: Set[str]) -> int:
    return len(tokens & SIGNAL_TERMS)


def _score_search_result(item: Dict, query: str, query_index: int) -> float:
    domain = _base_domain(item.get("url", ""))
    title = str(item.get("title", "")).lower()
    snippet = str(item.get("snippet", "")).strip()
    path = urlparse(item.get("url", "")).path.lower()
    query_tokens = _tokenize_text(query)
    title_tokens = _tokenize_text(title)
    snippet_tokens = _tokenize_text(snippet)
    path_tokens = _tokenize_text(path.replace("/", " "))
    score = max(0, 3 - query_index)

    if _matches_domain(domain, DISCOURAGED_SOURCE_DOMAINS):
        score -= 8
    if _matches_domain(domain, LOW_PRIORITY_REFERENCE_DOMAINS):
        score -= 2
    if any(pattern in path for pattern in LOW_SIGNAL_URL_PATTERNS):
        score -= 2

    if query_tokens:
        title_overlap = len(query_tokens & title_tokens)
        snippet_overlap = len(query_tokens & snippet_tokens)
        path_overlap = len(query_tokens & path_tokens)
        score += (title_overlap * 2.0) + (snippet_overlap * 0.75) + (path_overlap * 0.5)

        if title_overlap == 0 and snippet_overlap == 0:
            score -= 2

        # Reward results whose wording matches the query intent.
        query_signal_terms = _count_signal_terms(query_tokens)
        if query_signal_terms:
            signal_hits = _count_signal_terms(title_tokens | snippet_tokens)
            score += min(query_signal_terms, signal_hits) * 0.75

    if len(snippet) >= 120:
        score += 1.5
    elif len(snippet) >= 60:
        score += 0.5
    else:
        score -= 1

    return score


def _rank_search_results(results: List[Dict], max_urls: int) -> List[Dict]:
    if not results:
        return []

    scored = sorted(
        results,
        key=lambda item: (
            -float(item.get("_rankScore", 0.0)),
            int(item.get("_queryOrder", 99)),
            item.get("url", ""),
        ),
    )

    selected: List[Dict] = []
    seen_urls = set()
    seen_domains = set()

    for item in scored:
        url = item.get("url", "")
        domain = _base_domain(url)
        if not url or url in seen_urls:
            continue
        if domain and domain in seen_domains:
            continue
        seen_urls.add(url)
        if domain:
            seen_domains.add(domain)
        selected.append(item)
        if len(selected) >= max_urls:
            return selected

    for item in scored:
        url = item.get("url", "")
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        selected.append(item)
        if len(selected) >= max_urls:
            break

    return selected


def expand_keywords(keywords: List[str]) -> List[str]:
    """
    Expand user keywords into search-friendly queries.
    
    Args:
        keywords: List of seed keywords (e.g., ["cooking", "basics"])
    
    Returns:
        List of expanded queries (e.g., ["cooking basics fundamentals", "cooking basics 101"])
    """
    if not keywords:
        return []
    
    # Join keywords into base phrase
    base = " ".join(keywords)
    
    # Common expansion patterns
    expansions = [
        f"{base} fundamentals",
        f"{base} 101",
        f"{base} guide",
        f"{base} tips",
        f"{base} for beginners"
    ]
    
    # Return unique queries
    return list(set(expansions[:3]))  # Limit to 3 to avoid rate limits


async def search_ddg(query: str, max_results: int = 5) -> List[Dict]:
    """
    Search DuckDuckGo with timeout protection.
    
    Returns:
        List of {"title": str, "url": str, "snippet": str}
    """
    if not DDGS_AVAILABLE:
        logger.warning("DDGS not available, returning empty results")
        return []
    
    results = []
    
    try:
        # Run search in executor to add timeout
        loop = asyncio.get_event_loop()
        
        def _search():
            with DDGS() as ddgs:
                return list(ddgs.text(query, max_results=max_results))
        
        # Add timeout
        search_results = await asyncio.wait_for(
            loop.run_in_executor(None, _search),
            timeout=SEARCH_TIMEOUT
        )
        
        for r in search_results:
            results.append({
                "title": r.get("title", ""),
                "url": r.get("href", ""),
                "snippet": r.get("body", "")
            })
        
        logger.info(f"search_ddg: Found {len(results)} results for '{query}'")
        
    except asyncio.TimeoutError:
        logger.warning(f"search_ddg: Timeout after {SEARCH_TIMEOUT}s for query '{query}'")
    except Exception as e:
        logger.error(f"search_ddg error: {e}")
    
    return results


async def scrape_url(url: str, session: httpx.AsyncClient) -> Dict:
    """
    Scrape a single URL with timeout and error handling.
    
    Returns:
        {"url": str, "title": str, "content": str} or None if failed
    """
    try:
        response = await session.get(
            url,
            timeout=SCRAPE_TIMEOUT,
            follow_redirects=True,
            headers=SCRAPE_HEADERS,
        )
        
        if response.status_code != 200:
            if response.status_code in {401, 403, 429}:
                logger.info(f"scrape_url: Direct scraping blocked with status {response.status_code} for {url}")
            else:
                logger.warning(f"scrape_url: Got status {response.status_code} for {url}")
            return None
        
        # Parse HTML
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style", "nav", "footer", "header"]):
            script.decompose()
        
        # Extract title
        title = soup.find('title')
        title_text = title.get_text().strip() if title else url
        
        # Extract main content
        # Try common content containers
        content = ""
        for selector in ['article', 'main', '.content', '#content', '.post', '.entry']:
            container = soup.select_one(selector)
            if container:
                content = container.get_text(separator=' ', strip=True)
                break
        
        # Fallback to body
        if not content:
            body = soup.find('body')
            if body:
                content = body.get_text(separator=' ', strip=True)
        
        # Clean and truncate
        content = ' '.join(content.split())  # Normalize whitespace
        content = content[:5000]  # Limit to 5000 chars

        if len(content) < 200:
            logger.info(f"scrape_url: Insufficient extracted content for {url} ({len(content)} chars)")
            return None

        logger.info(f"scrape_url: Successfully scraped {url} ({len(content)} chars)")
        
        return {
            "url": url,
            "title": title_text,
            "content": content
        }
        
    except httpx.TimeoutException:
        logger.warning(f"scrape_url: Timeout after {SCRAPE_TIMEOUT}s for {url}")
    except httpx.HTTPError as e:
        logger.warning(f"scrape_url: HTTP error for {url}: {e}")
    except Exception as e:
        logger.error(f"scrape_url error for {url}: {e}")
    
    return None


def _build_snippet_fallback(item: Dict) -> Dict | None:
    snippet = " ".join(str(item.get("snippet", "")).split()).strip()
    if not snippet:
        return None

    return {
        "url": item.get("url", ""),
        "title": item.get("title") or item.get("url") or "Search result",
        "content": snippet[:1000],
        "snippetOnly": True,
    }


async def search_and_scrape(queries: List[str], max_urls: int = 10) -> List[Dict]:
    """
    Search multiple queries and scrape top results in parallel.
    
    Args:
        queries: List of search queries
        max_urls: Maximum URLs to scrape (distributed across queries)
    
    Returns:
        List of {"url": str, "title": str, "content": str}
    """
    logger.info(f"search_and_scrape: Processing {len(queries)} queries, max_urls={max_urls}")
    
    # Step 1: Search all queries concurrently
    all_urls = []
    seen_urls = set()

    limited_queries = list(queries[:3])  # Limit to 3 queries to avoid rate limits
    search_results = await asyncio.gather(
        *(search_ddg(query, max_results=5) for query in limited_queries),
        return_exceptions=True,
    )

    for query_index, query in enumerate(limited_queries):
        results = search_results[query_index]
        if isinstance(results, Exception):
            logger.error(f"search_and_scrape: Search failed for '{query}': {results}")
            continue
        for r in results:
            url = r.get("url", "")
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            r["_queryOrder"] = query_index
            r["_rankScore"] = _score_search_result(r, query, query_index)
            all_urls.append(r)
    
    if not all_urls:
        logger.warning("search_and_scrape: No search results found")
        return []
    
    # Rank URLs before scraping so stronger sources win first.
    all_urls = _rank_search_results(all_urls, max_urls=max_urls)
    
    logger.info(
        "search_and_scrape: Scraping %s ranked URLs domains=%s",
        len(all_urls),
        [ _base_domain(item.get("url", "")) for item in all_urls ],
    )
    
    # Step 2: Scrape URLs in parallel (5 concurrent)
    scraped = []
    snippet_fallbacks = 0
    
    async with httpx.AsyncClient() as session:
        # Process in batches of 5
        for i in range(0, len(all_urls), 5):
            batch = all_urls[i:i+5]
            
            tasks = [scrape_url(item["url"], session) for item in batch]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for item, result in zip(batch, results):
                if isinstance(result, dict) and result:
                    scraped.append(result)
                    continue

                snippet_doc = _build_snippet_fallback(item)
                if snippet_doc:
                    snippet_fallbacks += 1
                    scraped.append(snippet_doc)
                    logger.info(f"search_and_scrape: Using snippet fallback for {item['url']}")
    
    logger.info(
        f"search_and_scrape: Prepared {len(scraped)} usable sources from {len(all_urls)} URLs "
        f"({snippet_fallbacks} snippet fallbacks)"
    )
    
    return scraped


def extract_noun_phrases(text: str) -> List[str]:
    """
    Extract noun phrases using simple regex patterns.
    Avoids heavy NLP libraries for speed.
    """
    # Simple pattern: adjective? + noun + noun+
    phrases = []
    
    # Split into sentences
    sentences = re.split(r'[.!?]', text)
    
    for sent in sentences[:50]:  # Limit to first 50 sentences
        # Find 2-4 word phrases
        words = sent.lower().split()
        for i in range(len(words) - 1):
            phrase = ' '.join(words[i:i+3])  # 3-word phrases
            if len(phrase) > 10 and phrase.count(' ') >= 1:
                phrases.append(phrase)
    
    return phrases


async def extract_keywords_rag(scraped_data: List[Dict], top_n: int = 20) -> Dict:
    """
    Extract keywords using temporary RAG (K-means clustering).
    
    Args:
        scraped_data: List of {"url": str, "title": str, "content": str}
        top_n: Number of keywords to extract
    
    Returns:
        {"keywords": List[str], "sources": List[str]}
    """
    if not scraped_data:
        logger.warning("extract_keywords_rag: No data to process")
        return {"keywords": [], "sources": []}
    
    logger.info(f"extract_keywords_rag: Processing {len(scraped_data)} documents")
    
    # Extract all text
    all_text = []
    for doc in scraped_data:
        text = f"{doc['title']} {doc['content']}"
        all_text.append(text)
    
    # Extract noun phrases from all docs
    all_phrases = []
    for text in all_text:
        phrases = extract_noun_phrases(text)
        all_phrases.extend(phrases)
    
    if not all_phrases:
        logger.warning("extract_keywords_rag: No phrases extracted")
        return {"keywords": [], "sources": [d["url"] for d in scraped_data]}
    
    # Remove duplicates while preserving order
    unique_phrases = []
    seen = set()
    for phrase in all_phrases:
        if phrase not in seen and len(phrase.split()) >= 2:  # At least 2 words
            unique_phrases.append(phrase)
            seen.add(phrase)
    
    # Limit to top 100 for clustering
    unique_phrases = unique_phrases[:100]
    
    if len(unique_phrases) < 5:
        logger.warning("extract_keywords_rag: Too few phrases, returning all")
        return {
            "keywords": unique_phrases[:top_n],
            "sources": [d["url"] for d in scraped_data]
        }
    
    try:
        # TF-IDF vectorization
        vectorizer = TfidfVectorizer(max_features=50, stop_words='english')
        tfidf_matrix = vectorizer.fit_transform(unique_phrases)
        
        # K-means clustering (2-5 clusters)
        n_clusters = min(5, max(2, len(unique_phrases) // 10))
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        kmeans.fit(tfidf_matrix)
        
        # Get top phrases from each cluster
        keywords = []
        for cluster_id in range(n_clusters):
            cluster_phrases = [unique_phrases[i] for i in range(len(unique_phrases)) if kmeans.labels_[i] == cluster_id]
            
            # Take top 4 from each cluster
            keywords.extend(cluster_phrases[:4])
        
        # Deduplicate and limit
        keywords = list(dict.fromkeys(keywords))[:top_n]
        
        logger.info(f"extract_keywords_rag: Extracted {len(keywords)} keywords from {n_clusters} clusters")
        
        return {
            "keywords": keywords,
            "sources": [d["url"] for d in scraped_data]
        }
        
    except Exception as e:
        logger.error(f"extract_keywords_rag clustering error: {e}")
        # Fallback: return top phrases by length
        fallback = sorted(unique_phrases, key=len, reverse=True)[:top_n]
        return {
            "keywords": fallback,
            "sources": [d["url"] for d in scraped_data]
        }


def build_llm_context(scraped_data: List[Dict], keywords: List[str]) -> str:
    """
    Build context string for LLM from scraped data and keywords.
    
    Args:
        scraped_data: List of scraped documents
        keywords: Extracted keywords
    
    Returns:
        Formatted context string
    """
    context_parts = []
    
    # Add keywords section
    if keywords:
        context_parts.append("RELEVANT KEYWORDS:")
        context_parts.append(", ".join(keywords[:15]))  # Top 15 keywords
        context_parts.append("")
    
    # Add source summaries (top 5 sources)
    if scraped_data:
        context_parts.append("REFERENCE SOURCES:")
        for i, doc in enumerate(scraped_data[:5], 1):
            context_parts.append(f"\n[Source {i}] {doc['title']}")
            # Add first 500 chars of content
            snippet = doc['content'][:500]
            context_parts.append(snippet + "...")
    
    return "\n".join(context_parts)
