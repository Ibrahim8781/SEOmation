# # ai/services/live_search_service.py - NEW FILE

# """
# Live Search & RAG Service
# Performs real-time search, scraping, and keyword extraction without permanent storage.
# """

# import asyncio
# import logging
# from typing import List, Dict
# from collections import Counter
# import re

# logger = logging.getLogger(__name__)


# def expand_keywords(seed_keywords: List[str]) -> List[str]:
#     """
#     Expand user keywords into Google-style search queries.
    
#     Example:
#         Input: ["cooking", "homecook", "basics"]
#         Output: [
#             "cooking homecook basics fundamentals",
#             "cooking homecook basics 101",
#             "cooking homecook basics guide",
#             "home cooking basics tutorial"
#         ]
#     """
#     if not seed_keywords:
#         return []
    
#     # Clean and combine keywords
#     cleaned = [kw.strip().lower() for kw in seed_keywords if kw.strip()]
    
#     if not cleaned:
#         return []
    
#     # Limit to 3 keywords to avoid overly long queries
#     base_keywords = " ".join(cleaned[:3])
    
#     # Search query templates
#     templates = [
#         "{} fundamentals",
#         "{} 101",
#         "{} basics guide",
#         "{} tutorial",
#         "how to {}",
#         "{} tips"
#     ]
    
#     # Generate queries (limit to 4 for speed)
#     queries = []
#     for template in templates[:4]:
#         query = template.format(base_keywords)
#         queries.append(query)
    
#     logger.info("expand_keywords", extra={"seed": seed_keywords, "expanded": len(queries)})
#     return queries


# async def search_and_scrape(queries: List[str], max_urls: int = 5) -> List[Dict]:
#     """
#     Search DuckDuckGo and scrape top results in parallel.
    
#     Returns:
#         List[Dict]: [
#             {"url": "...", "content": "...", "title": "..."},
#             ...
#         ]
#     """
#     try:
#         from ddgs import DDGS
#     except ImportError:
#         logger.error("duckduckgo-search not installed. Run: pip install duckduckgo-search")
#         return []
    
#     all_urls = []
    
#     # OPTIMIZATION: Use DuckDuckGo (unlimited + fast)
#     logger.info("search_ddg", extra={"queries": len(queries)})
    
#     try:
#         with DDGS() as ddgs:
#             for query in queries[:3]:  # Limit to 3 queries for speed
#                 try:
#                     results = ddgs.text(
#                         query, 
#                         max_results=max_urls,
#                         region='wt-wt',  # Worldwide
#                         safesearch='moderate'
#                     )
                    
#                     for result in results:
#                         all_urls.append({
#                             "url": result.get("href", ""),
#                             "title": result.get("title", ""),
#                             "snippet": result.get("body", "")[:500]
#                         })
                        
#                 except Exception as e:
#                     logger.warning(f"DDG search failed for query '{query}': {e}")
#                     continue
                    
#     except Exception as e:
#         logger.error(f"DDG search error: {e}")
#         return []
    
#     # Remove duplicates (keep first occurrence)
#     seen_urls = set()
#     unique_results = []
#     for item in all_urls:
#         if item["url"] not in seen_urls and item["url"]:
#             seen_urls.add(item["url"])
#             unique_results.append(item)
    
#     # Limit to top 10 unique URLs
#     unique_results = unique_results[:10]
    
#     if not unique_results:
#         logger.warning("No search results found")
#         return []
    
#     logger.info("search_results", extra={"unique_urls": len(unique_results)})
    
#     # OPTIMIZATION: Parallel scraping
#     from services.scraper_service import fetch_multiple_urls_parallel
    
#     urls_to_scrape = [item["url"] for item in unique_results]
#     htmls = await fetch_multiple_urls_parallel(urls_to_scrape, max_concurrent=5)
    
#     scraped_data = []
    
#     for i, html in enumerate(htmls):
#         if not html or len(html) < 200:
#             # Fallback to snippet if scraping failed
#             if unique_results[i]["snippet"]:
#                 scraped_data.append({
#                     "url": unique_results[i]["url"],
#                     "content": unique_results[i]["snippet"],
#                     "title": unique_results[i]["title"]
#                 })
#             continue
        
#         # Extract main content
#         try:
#             from bs4 import BeautifulSoup
            
#             soup = BeautifulSoup(html, "html.parser")
            
#             # Remove noise
#             for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript"]):
#                 tag.extract()
            
#             # Get text from main content areas
#             content_tags = soup.find_all(["p", "li", "h2", "h3", "article", "section"])
#             content = " ".join([
#                 tag.get_text(" ", strip=True) 
#                 for tag in content_tags
#             ])[:5000]  # Limit to 5000 chars per page
            
#             if len(content) > 200:  # Minimum viable content
#                 scraped_data.append({
#                     "url": unique_results[i]["url"],
#                     "content": content,
#                     "title": soup.title.string if soup.title else unique_results[i]["title"]
#                 })
                
#         except Exception as e:
#             logger.warning(f"Failed to parse HTML from {unique_results[i]['url']}: {e}")
#             continue
    
#     logger.info("scrape_complete", extra={"scraped": len(scraped_data), "total": len(unique_results)})
    
#     return scraped_data


# async def extract_keywords_rag(scraped_data: List[Dict], top_n: int = 20) -> Dict:
#     """
#     Use RAG to extract most relevant keywords from scraped content.
#     NO PERMANENT STORAGE - just in-memory processing.
    
#     Returns:
#         {
#             "keywords": ["cooking technique", "home chef", ...],
#             "themes": ["basics", "fundamentals", ...]
#         }
#     """
#     if not scraped_data:
#         logger.warning("No data to extract keywords from")
#         return {"keywords": [], "themes": []}
    
#     # Combine all content
#     all_texts = [item["content"] for item in scraped_data]
    
#     # Extract sentences (better for keyword extraction)
#     sentences = []
#     for text in all_texts:
#         # Split by period, limit per document
#         doc_sentences = [s.strip() for s in text.split(". ") if len(s.strip()) > 20]
#         sentences.extend(doc_sentences[:20])  # Max 20 sentences per doc
    
#     if len(sentences) < 5:
#         # Too few sentences, fallback to simple extraction
#         keywords = extract_noun_phrases(" ".join(all_texts))
#         return {
#             "keywords": list(set(keywords))[:top_n],
#             "themes": []
#         }
    
#     logger.info("rag_embed", extra={"sentences": len(sentences)})
    
#     # OPTIMIZATION: Batch embed
#     try:
#         from services.embedding_service import embed_texts
#         embeddings = embed_texts(sentences)
#     except Exception as e:
#         logger.error(f"Embedding failed: {e}")
#         # Fallback to regex extraction
#         keywords = extract_noun_phrases(" ".join(all_texts))
#         return {
#             "keywords": list(set(keywords))[:top_n],
#             "themes": []
#         }
    
#     # Find semantic clusters using K-means
#     try:
#         from sklearn.cluster import KMeans
#         import numpy as np
        
#         n_clusters = min(5, max(2, len(sentences) // 10))  # 2-5 clusters
        
#         kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
#         clusters = kmeans.fit_predict(embeddings)
        
#         logger.info("rag_cluster", extra={"clusters": n_clusters})
        
#         # Extract representative keywords from each cluster
#         keywords = []
#         themes = []
        
#         for cluster_id in range(n_clusters):
#             cluster_sentences = [
#                 sentences[i] for i in range(len(sentences)) 
#                 if clusters[i] == cluster_id
#             ]
            
#             if not cluster_sentences:
#                 continue
            
#             # Get most common noun phrases from this cluster
#             cluster_text = " ".join(cluster_sentences[:5])  # Top 5 sentences
#             phrases = extract_noun_phrases(cluster_text)
            
#             # Add top phrases from this cluster
#             keywords.extend(phrases[:4])  # Top 4 per cluster
#             themes.append(f"theme_{cluster_id}")
        
#         # Deduplicate and limit
#         unique_keywords = list(dict.fromkeys(keywords))[:top_n]
        
#         logger.info("rag_complete", extra={"keywords": len(unique_keywords), "themes": len(themes)})
        
#         return {
#             "keywords": unique_keywords,
#             "themes": themes
#         }
        
#     except Exception as e:
#         logger.error(f"Clustering failed: {e}")
#         # Fallback to simple extraction
#         keywords = extract_noun_phrases(" ".join(all_texts))
#         return {
#             "keywords": list(set(keywords))[:top_n],
#             "themes": []
#         }


# def extract_noun_phrases(text: str, top_n: int = 30) -> List[str]:
#     """
#     Simple noun phrase extraction using regex patterns.
#     No heavy NLP libraries needed.
#     """
#     if not text:
#         return []
    
#     text = text.lower()
    
#     # Pattern 1: Capitalized words (usually important nouns)
#     # Pattern 2: Common noun phrase patterns
#     patterns = [
#         r'\b[a-z]+(?:\s+[a-z]+){1,2}\b',  # 2-3 word phrases
#     ]
    
#     phrases = []
#     for pattern in patterns:
#         matches = re.findall(pattern, text)
#         phrases.extend(matches)
    
#     # Filter out common stopwords and short phrases
#     stopwords = {
#         'the', 'and', 'for', 'with', 'this', 'that', 'from', 'have', 
#         'will', 'can', 'are', 'was', 'were', 'been', 'has', 'had'
#     }
    
#     filtered_phrases = []
#     for phrase in phrases:
#         words = phrase.split()
#         # Keep if no stopwords and length is good
#         if (len(phrase) >= 8 and len(phrase) <= 40 and 
#             not any(word in stopwords for word in words)):
#             filtered_phrases.append(phrase)
    
#     # Return most frequent
#     phrase_counts = Counter(filtered_phrases)
#     return [phrase for phrase, _ in phrase_counts.most_common(top_n)]


# def build_llm_context(scraped_data: List[Dict], keywords: List[str]) -> str:
#     """
#     Format scraped content + keywords for LLM consumption.
#     """
#     if not scraped_data and not keywords:
#         return ""
    
#     context_parts = [
#         "=== TRENDING TOPICS & KEYWORDS ===",
#         ", ".join(keywords[:15]) if keywords else "No keywords extracted",
#         "",
#         "=== TOP CONTENT REFERENCES ===",
#     ]
    
#     for i, item in enumerate(scraped_data[:5], 1):  # Top 5 sources
#         context_parts.append(f"{i}. {item['title']}")
#         context_parts.append(f"   {item['content'][:300]}...")
#         context_parts.append("")
    
#     return "\n".join(context_parts)

# ai/services/live_search_service.py - UPDATED WITH BETTER TIMEOUT HANDLING

"""
Live search and RAG service for keyword extraction and content research.
Uses DuckDuckGo for unlimited searches and temporary RAG for keyword extraction.
"""

import asyncio
import httpx
import logging
from typing import List, Dict
from bs4 import BeautifulSoup
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer
import re

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
MAX_RETRIES = 2


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
            follow_redirects=True
        )
        
        if response.status_code != 200:
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
    
    # Step 1: Search all queries
    all_urls = []
    
    for query in queries[:3]:  # Limit to 3 queries to avoid rate limits
        results = await search_ddg(query, max_results=5)
        for r in results:
            if r["url"] not in [u["url"] for u in all_urls]:
                all_urls.append(r)
    
    if not all_urls:
        logger.warning("search_and_scrape: No search results found")
        return []
    
    # Limit URLs
    all_urls = all_urls[:max_urls]
    
    logger.info(f"search_and_scrape: Scraping {len(all_urls)} unique URLs")
    
    # Step 2: Scrape URLs in parallel (5 concurrent)
    scraped = []
    
    async with httpx.AsyncClient() as session:
        # Process in batches of 5
        for i in range(0, len(all_urls), 5):
            batch = all_urls[i:i+5]
            
            tasks = [scrape_url(item["url"], session) for item in batch]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for result in results:
                if isinstance(result, dict) and result:
                    scraped.append(result)
    
    logger.info(f"search_and_scrape: Successfully scraped {len(scraped)}/{len(all_urls)} URLs")
    
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