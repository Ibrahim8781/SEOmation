# ai/services/live_search_service.py - NEW FILE

"""
Live Search & RAG Service
Performs real-time search, scraping, and keyword extraction without permanent storage.
"""

import asyncio
import logging
from typing import List, Dict
from collections import Counter
import re

logger = logging.getLogger(__name__)


def expand_keywords(seed_keywords: List[str]) -> List[str]:
    """
    Expand user keywords into Google-style search queries.
    
    Example:
        Input: ["cooking", "homecook", "basics"]
        Output: [
            "cooking homecook basics fundamentals",
            "cooking homecook basics 101",
            "cooking homecook basics guide",
            "home cooking basics tutorial"
        ]
    """
    if not seed_keywords:
        return []
    
    # Clean and combine keywords
    cleaned = [kw.strip().lower() for kw in seed_keywords if kw.strip()]
    
    if not cleaned:
        return []
    
    # Limit to 3 keywords to avoid overly long queries
    base_keywords = " ".join(cleaned[:3])
    
    # Search query templates
    templates = [
        "{} fundamentals",
        "{} 101",
        "{} basics guide",
        "{} tutorial",
        "how to {}",
        "{} tips"
    ]
    
    # Generate queries (limit to 4 for speed)
    queries = []
    for template in templates[:4]:
        query = template.format(base_keywords)
        queries.append(query)
    
    logger.info("expand_keywords", extra={"seed": seed_keywords, "expanded": len(queries)})
    return queries


async def search_and_scrape(queries: List[str], max_urls: int = 5) -> List[Dict]:
    """
    Search DuckDuckGo and scrape top results in parallel.
    
    Returns:
        List[Dict]: [
            {"url": "...", "content": "...", "title": "..."},
            ...
        ]
    """
    try:
        from ddgs import DDGS
    except ImportError:
        logger.error("duckduckgo-search not installed. Run: pip install duckduckgo-search")
        return []
    
    all_urls = []
    
    # OPTIMIZATION: Use DuckDuckGo (unlimited + fast)
    logger.info("search_ddg", extra={"queries": len(queries)})
    
    try:
        with DDGS() as ddgs:
            for query in queries[:3]:  # Limit to 3 queries for speed
                try:
                    results = ddgs.text(
                        query, 
                        max_results=max_urls,
                        region='wt-wt',  # Worldwide
                        safesearch='moderate'
                    )
                    
                    for result in results:
                        all_urls.append({
                            "url": result.get("href", ""),
                            "title": result.get("title", ""),
                            "snippet": result.get("body", "")[:500]
                        })
                        
                except Exception as e:
                    logger.warning(f"DDG search failed for query '{query}': {e}")
                    continue
                    
    except Exception as e:
        logger.error(f"DDG search error: {e}")
        return []
    
    # Remove duplicates (keep first occurrence)
    seen_urls = set()
    unique_results = []
    for item in all_urls:
        if item["url"] not in seen_urls and item["url"]:
            seen_urls.add(item["url"])
            unique_results.append(item)
    
    # Limit to top 10 unique URLs
    unique_results = unique_results[:10]
    
    if not unique_results:
        logger.warning("No search results found")
        return []
    
    logger.info("search_results", extra={"unique_urls": len(unique_results)})
    
    # OPTIMIZATION: Parallel scraping
    from services.scraper_service import fetch_multiple_urls_parallel
    
    urls_to_scrape = [item["url"] for item in unique_results]
    htmls = await fetch_multiple_urls_parallel(urls_to_scrape, max_concurrent=5)
    
    scraped_data = []
    
    for i, html in enumerate(htmls):
        if not html or len(html) < 200:
            # Fallback to snippet if scraping failed
            if unique_results[i]["snippet"]:
                scraped_data.append({
                    "url": unique_results[i]["url"],
                    "content": unique_results[i]["snippet"],
                    "title": unique_results[i]["title"]
                })
            continue
        
        # Extract main content
        try:
            from bs4 import BeautifulSoup
            
            soup = BeautifulSoup(html, "html.parser")
            
            # Remove noise
            for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript"]):
                tag.extract()
            
            # Get text from main content areas
            content_tags = soup.find_all(["p", "li", "h2", "h3", "article", "section"])
            content = " ".join([
                tag.get_text(" ", strip=True) 
                for tag in content_tags
            ])[:5000]  # Limit to 5000 chars per page
            
            if len(content) > 200:  # Minimum viable content
                scraped_data.append({
                    "url": unique_results[i]["url"],
                    "content": content,
                    "title": soup.title.string if soup.title else unique_results[i]["title"]
                })
                
        except Exception as e:
            logger.warning(f"Failed to parse HTML from {unique_results[i]['url']}: {e}")
            continue
    
    logger.info("scrape_complete", extra={"scraped": len(scraped_data), "total": len(unique_results)})
    
    return scraped_data


async def extract_keywords_rag(scraped_data: List[Dict], top_n: int = 20) -> Dict:
    """
    Use RAG to extract most relevant keywords from scraped content.
    NO PERMANENT STORAGE - just in-memory processing.
    
    Returns:
        {
            "keywords": ["cooking technique", "home chef", ...],
            "themes": ["basics", "fundamentals", ...]
        }
    """
    if not scraped_data:
        logger.warning("No data to extract keywords from")
        return {"keywords": [], "themes": []}
    
    # Combine all content
    all_texts = [item["content"] for item in scraped_data]
    
    # Extract sentences (better for keyword extraction)
    sentences = []
    for text in all_texts:
        # Split by period, limit per document
        doc_sentences = [s.strip() for s in text.split(". ") if len(s.strip()) > 20]
        sentences.extend(doc_sentences[:20])  # Max 20 sentences per doc
    
    if len(sentences) < 5:
        # Too few sentences, fallback to simple extraction
        keywords = extract_noun_phrases(" ".join(all_texts))
        return {
            "keywords": list(set(keywords))[:top_n],
            "themes": []
        }
    
    logger.info("rag_embed", extra={"sentences": len(sentences)})
    
    # OPTIMIZATION: Batch embed
    try:
        from services.embedding_service import embed_texts
        embeddings = embed_texts(sentences)
    except Exception as e:
        logger.error(f"Embedding failed: {e}")
        # Fallback to regex extraction
        keywords = extract_noun_phrases(" ".join(all_texts))
        return {
            "keywords": list(set(keywords))[:top_n],
            "themes": []
        }
    
    # Find semantic clusters using K-means
    try:
        from sklearn.cluster import KMeans
        import numpy as np
        
        n_clusters = min(5, max(2, len(sentences) // 10))  # 2-5 clusters
        
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        clusters = kmeans.fit_predict(embeddings)
        
        logger.info("rag_cluster", extra={"clusters": n_clusters})
        
        # Extract representative keywords from each cluster
        keywords = []
        themes = []
        
        for cluster_id in range(n_clusters):
            cluster_sentences = [
                sentences[i] for i in range(len(sentences)) 
                if clusters[i] == cluster_id
            ]
            
            if not cluster_sentences:
                continue
            
            # Get most common noun phrases from this cluster
            cluster_text = " ".join(cluster_sentences[:5])  # Top 5 sentences
            phrases = extract_noun_phrases(cluster_text)
            
            # Add top phrases from this cluster
            keywords.extend(phrases[:4])  # Top 4 per cluster
            themes.append(f"theme_{cluster_id}")
        
        # Deduplicate and limit
        unique_keywords = list(dict.fromkeys(keywords))[:top_n]
        
        logger.info("rag_complete", extra={"keywords": len(unique_keywords), "themes": len(themes)})
        
        return {
            "keywords": unique_keywords,
            "themes": themes
        }
        
    except Exception as e:
        logger.error(f"Clustering failed: {e}")
        # Fallback to simple extraction
        keywords = extract_noun_phrases(" ".join(all_texts))
        return {
            "keywords": list(set(keywords))[:top_n],
            "themes": []
        }


def extract_noun_phrases(text: str, top_n: int = 30) -> List[str]:
    """
    Simple noun phrase extraction using regex patterns.
    No heavy NLP libraries needed.
    """
    if not text:
        return []
    
    text = text.lower()
    
    # Pattern 1: Capitalized words (usually important nouns)
    # Pattern 2: Common noun phrase patterns
    patterns = [
        r'\b[a-z]+(?:\s+[a-z]+){1,2}\b',  # 2-3 word phrases
    ]
    
    phrases = []
    for pattern in patterns:
        matches = re.findall(pattern, text)
        phrases.extend(matches)
    
    # Filter out common stopwords and short phrases
    stopwords = {
        'the', 'and', 'for', 'with', 'this', 'that', 'from', 'have', 
        'will', 'can', 'are', 'was', 'were', 'been', 'has', 'had'
    }
    
    filtered_phrases = []
    for phrase in phrases:
        words = phrase.split()
        # Keep if no stopwords and length is good
        if (len(phrase) >= 8 and len(phrase) <= 40 and 
            not any(word in stopwords for word in words)):
            filtered_phrases.append(phrase)
    
    # Return most frequent
    phrase_counts = Counter(filtered_phrases)
    return [phrase for phrase, _ in phrase_counts.most_common(top_n)]


def build_llm_context(scraped_data: List[Dict], keywords: List[str]) -> str:
    """
    Format scraped content + keywords for LLM consumption.
    """
    if not scraped_data and not keywords:
        return ""
    
    context_parts = [
        "=== TRENDING TOPICS & KEYWORDS ===",
        ", ".join(keywords[:15]) if keywords else "No keywords extracted",
        "",
        "=== TOP CONTENT REFERENCES ===",
    ]
    
    for i, item in enumerate(scraped_data[:5], 1):  # Top 5 sources
        context_parts.append(f"{i}. {item['title']}")
        context_parts.append(f"   {item['content'][:300]}...")
        context_parts.append("")
    
    return "\n".join(context_parts)