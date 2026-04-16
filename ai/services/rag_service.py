from typing import List, Dict, Any, Optional
from config import settings
from utils.text_processing import chunk_text
from services.scraper_service import candidate_urls
from services.embedding_service import embed_texts
from utils.cache import get_if_fresh, set_with_ttl
import asyncio, uuid, logging

logger = logging.getLogger(__name__)

_qdrant = None
_engine = None
_INDEX_BUILD_TASKS: Dict[str, asyncio.Task] = {}
_RECENT_INDEX_BUILD_TTL_SECONDS = min(settings.CACHE_TTL_SECONDS, 300)

def stable_namespace(user_id: str, language: str, scope: str) -> str:
    return f"{user_id}:{language}:{scope}".lower()

_MEMORY: Dict[str, List[Dict[str, Any]]] = {}

def _memory_upsert(ns: str, texts: List[str], metas: List[Dict[str, Any]], embs: List[List[float]]):
    entries = _MEMORY.setdefault(ns, [])
    for i, t in enumerate(texts):
        entries.append({"id": str(uuid.uuid4()), "text": t, "meta": metas[i], "vector": embs[i]})

def _memory_search(ns: str, qvec: List[float], top_k: int = 40) -> List[Dict[str, Any]]:
    from math import sqrt
    import numpy as np
    entries = _MEMORY.get(ns, [])
    if not entries:
        return []
    q = np.array(qvec, dtype=float)
    def cos(a, b):
        a, b = np.array(a), np.array(b)
        num = (a*b).sum()
        den = (sqrt((a*a).sum()) * sqrt((b*b).sum())) or 1.0
        return num/den
    ranked = sorted(entries, key=lambda e: cos(e["vector"], q), reverse=True)[:top_k]
    return [
        {
            "payload": {
                "url": e["meta"].get("url", "mem"),
                "snippet": e["meta"].get("snippet") or (e.get("text") or "")[:320],
            }
        }
        for e in ranked
    ]

def _qdrant_client():
    global _qdrant
    if _qdrant is not None:
        return _qdrant
    from qdrant_client import QdrantClient
    from qdrant_client.http import models as qm
    _qdrant = QdrantClient(url=settings.QDRANT_URL, api_key=settings.QDRANT_API_KEY, timeout=30.0)
    try:
        _qdrant.get_collection(settings.QDRANT_COLLECTION)
    except Exception:
        _qdrant.recreate_collection(
            collection_name=settings.QDRANT_COLLECTION,
            vectors_config=qm.VectorParams(size=settings.PGVECTOR_DIM, distance=qm.Distance.COSINE),
        )
    try:
        _qdrant.create_payload_index(settings.QDRANT_COLLECTION, field_name="namespace", field_schema=qm.PayloadSchemaType.KEYWORD)
    except Exception:
        pass
    return _qdrant

def _qdrant_upsert(ns: str, texts: List[str], metas: List[Dict[str, Any]], embs: List[List[float]]):
    from qdrant_client.http import models as qm
    c = _qdrant_client()
    batch = 64
    total = len(embs)
    for start in range(0, total, batch):
        points = []
        for i in range(start, min(start+batch, total)):
            meta = dict(metas[i]); meta["namespace"] = ns
            meta["snippet"] = meta.get("snippet") or (texts[i] or "")[:320]
            points.append(qm.PointStruct(id=str(uuid.uuid4()), vector=embs[i], payload=meta))
        c.upsert(collection_name=settings.QDRANT_COLLECTION, points=points, wait=True)

def _qdrant_search(ns: str, qvec: List[float], top_k: int = 40) -> List[Dict[str, Any]]:
    from qdrant_client.http import models as qm
    c = _qdrant_client()
    flt = qm.Filter(must=[qm.FieldCondition(key="namespace", match=qm.MatchValue(value=ns))])
    res = c.search(collection_name=settings.QDRANT_COLLECTION, query_vector=qvec, limit=top_k, query_filter=flt, with_payload=True)
    return [{"payload": r.payload} for r in res]

_engine_sql = None
def _pg_engine():
    global _engine, _engine_sql
    if settings.VECTOR_BACKEND != "pgvector":
        return None
    if _engine is not None:
        return _engine
    try:
        from sqlalchemy import create_engine, text
    except ImportError as exc:
        raise RuntimeError(
            "SQLAlchemy is required when VECTOR_BACKEND=pgvector. "
            "Install the optional pgvector dependencies from requirements-pgvector.txt."
        ) from exc
    _engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, future=True)
    _engine_sql = text
    with _engine.begin() as conn:
        conn.exec_driver_sql("CREATE EXTENSION IF NOT EXISTS vector;")
        conn.exec_driver_sql(f"""
        CREATE TABLE IF NOT EXISTS rag_chunks (
            id UUID PRIMARY KEY,
            namespace TEXT,
            url TEXT,
            language TEXT,
            niche TEXT,
            text TEXT,
            embedding VECTOR({settings.PGVECTOR_DIM})
        );""")
        conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS idx_ns ON rag_chunks(namespace);")
    return _engine

def _pg_upsert(ns: str, texts: List[str], metas: List[Dict[str, Any]], embs: List[List[float]]):
    eng = _pg_engine()
    if eng is None:
        return
    import uuid as _uuid
    with eng.begin() as conn:
        for i, t in enumerate(texts):
            m = metas[i]
            conn.exec_driver_sql(
                "INSERT INTO rag_chunks(id, namespace, url, language, niche, text, embedding) VALUES (%s,%s,%s,%s,%s,%s,%s)",
                (str(_uuid.uuid4()), ns, m.get("url","seed"), m.get("language",""), m.get("niche",""), t, f"[{','.join(str(x) for x in embs[i])}]")
            )

def _pg_search(ns: str, qvec: List[float], top_k: int = 40) -> List[Dict[str, Any]]:
    eng = _pg_engine()
    if eng is None:
        return []
    vec = f"[{','.join(str(x) for x in qvec)}]"
    with eng.begin() as conn:
        rows = conn.exec_driver_sql(
            f"SELECT url, text, 1 - (embedding <=> {vec}) as score FROM rag_chunks WHERE namespace=%s ORDER BY embedding <=> {vec} ASC LIMIT {top_k}",
            (ns,)
        ).fetchall()
    return [{"payload": {"url": r[0], "snippet": (r[1] or '')[:320]}} for r in rows]

async def quick_seed_now(
    user_id: str, language: str, niche: str,
    region: Optional[str], season: Optional[str],
    seed_keywords: List[str], namespace: str
):
    """
    ULTRA-OPTIMIZED: Uses cached snippets from SerpAPI.
    Cache prevents redundant API calls and embedding operations.
    Falls back to synthetic seed data if API unavailable.
    """
    key = f"seeded:{namespace}"
    if get_if_fresh(key):
        logger.info("quick_seed cache HIT", extra={"namespace": namespace})
        return  # Already seeded, skip all work
    
    texts, metas = [], []
    
    # Try search API first (FAST path - uses pre-extracted snippets)
    try:
        from services.search_service import google_search
        
        # OPTIMIZATION: Reduced from unlimited to 3 keywords max for speed
        query = f"{niche} {' '.join(seed_keywords[:2])}"
        results = await google_search(query, num_results=3)  # Reduced from 5 to 3
        
        if results:
            for result in results:
                snippet = result.get('snippet', '')
                if snippet and len(snippet) > 50:  # Ensure meaningful content
                    texts.append(snippet)
                    metas.append({
                        "url": result['url'],
                        "language": language,
                        "niche": niche,
                        "source": "google_search",
                        "snippet": snippet[:320]
                    })
            
            logger.info("quick_seed_search_api", extra={"namespace": namespace, "results": len(texts)})
    except Exception as e:
        logger.warning(f"Search API unavailable: {e}")
    
    # Fallback to synthetic seed data if needed
    if not texts:
        base = [niche] + (seed_keywords or [])[:2]  # Reduced from 4 to 2
        for sk in base[:3]:  # Reduced from 6 to 3
            txt = f"{niche} primer on '{sk}': practical steps, pitfalls, KPIs, examples. Language={language}."
            texts.append(txt)
            metas.append({"url": f"seed:{sk}", "language": language, "niche": niche, "source": "seed", "snippet": txt[:320]})
    
    # OPTIMIZATION: Embed in ONE batch call (Cohere supports batch)
    if texts:
        embs = embed_texts(texts)
        _store(namespace, texts, metas, embs)
    
    # Cache for 6 hours to avoid redundant work
    set_with_ttl(key, True, settings.CACHE_TTL_SECONDS)
    logger.info("quick_seed COMPLETE", extra={"namespace": namespace, "chunks": len(texts)})

def ensure_index_async(
    user_id: str, language: str, niche: str,
    region: Optional[str], season: Optional[str],
    seed_keywords: List[str], namespace: str
):
    recent_build_key = f"index-build:{namespace}"
    existing_task = _INDEX_BUILD_TASKS.get(namespace)
    if existing_task and not existing_task.done():
        logger.info("ensure_index_async skipped_inflight", extra={"ns": namespace})
        return existing_task

    if get_if_fresh(recent_build_key):
        logger.info("ensure_index_async skipped_recent", extra={"ns": namespace})
        return None

    logger.info("ensure_index_async scheduled", extra={"ns": namespace, "niche": niche, "language": language})
    task = asyncio.create_task(
        _run_index_build(user_id, language, niche, region, season, seed_keywords, namespace, recent_build_key)
    )
    _INDEX_BUILD_TASKS[namespace] = task
    return task


async def _run_index_build(
    user_id: str,
    language: str,
    niche: str,
    region: Optional[str],
    season: Optional[str],
    seed_keywords: List[str],
    namespace: str,
    recent_build_key: str,
):
    try:
        await _build_index(user_id, language, niche, region, season, seed_keywords, namespace)
        set_with_ttl(recent_build_key, True, _RECENT_INDEX_BUILD_TTL_SECONDS)
    finally:
        current_task = _INDEX_BUILD_TASKS.get(namespace)
        if current_task is asyncio.current_task():
            _INDEX_BUILD_TASKS.pop(namespace, None)

async def _build_index(
    user_id: str, language: str, niche: str,
    region: Optional[str], season: Optional[str],
    seed_keywords: List[str], namespace: str
):
    """
    OPTIMIZED: Uses SerpAPI for fast content discovery.
    Falls back to parallel scraping if needed.
    """
    texts, metas = [], []
    
    # Try SerpAPI first (FAST path - no scraping needed!)
    try:
        from services.search_service import google_search
        
        query = f"{niche} {' '.join(seed_keywords[:3])}"
        results = await google_search(query, num_results=10)
        
        if results:
            for result in results:
                snippet = result.get('snippet', '')
                if snippet and len(snippet) > 100:
                    # Use Google's snippet directly - no need to scrape!
                    texts.append(snippet)
                    metas.append({
                        "url": result['url'],
                        "language": language,
                        "niche": niche,
                        "source": "google_search",
                        "snippet": snippet[:320]
                    })
            
            logger.info("build_index_serpapi", extra={"namespace": namespace, "snippets": len(texts)})
    except Exception as e:
        logger.warning(f"SerpAPI unavailable in build_index: {e}")
    
    # Fallback to traditional scraping with parallel fetching if Google CSE unavailable
    if not texts:
        urls = await candidate_urls(niche, seed_keywords or [], language, region or "")
        
        # OPTIMIZED: Parallel fetching instead of sequential
        from services.scraper_service import fetch_multiple_urls_parallel
        htmls = await fetch_multiple_urls_parallel(urls[:10], max_concurrent=5)
        
        for i, html in enumerate(htmls):
            if html and len(html) > 200:
                # Extract text from HTML
                from bs4 import BeautifulSoup
                soup = BeautifulSoup(html, "html.parser")
                for tag in soup(["script","style","nav","footer","header","noscript"]):
                    tag.extract()
                txt = " ".join([p.get_text(" ", strip=True) for p in soup.find_all(["p","li"])])[:6000]
                
                if txt:
                    chunks = chunk_text(txt, max_words=120)
                    for c in chunks:
                        texts.append(c)
                        metas.append({
                            "url": urls[i] if i < len(urls) else "unknown",
                            "language": language,
                            "niche": niche,
                            "source": "web",
                            "snippet": c[:320]
                        })
            
            if len(texts) >= 200:
                break
    
    # Final fallback to synthetic seed data
    if not texts:
        base = [niche] + (seed_keywords or [])[:4]
        for sk in base[:6]:
            synthetic = f"{niche} quick guide about '{sk}': concepts, steps, pitfalls, KPIs. Language={language}."
            texts.append(synthetic)
            metas.append({"url": f"seed:{sk}", "language": language, "niche": niche, "source": "seed", "snippet": synthetic[:320]})
    
    # OPTIMIZED: Batch embedding in optimized chunks
    embs = embed_texts(texts)
    _store(namespace, texts, metas, embs)
    logger.info("build_index_complete", extra={"ns": namespace, "chunks": len(texts)})

def _store(ns: str, texts: List[str], metas: List[Dict[str, Any]], embs: List[List[float]]):
    backend = settings.VECTOR_BACKEND.lower()
    if backend == "qdrant":
        _qdrant_upsert(ns, texts, metas, embs)
    elif backend == "pgvector":
        _pg_upsert(ns, texts, metas, embs)
    else:
        _memory_upsert(ns, texts, metas, embs)

async def retrieve_context(
    user_id: str, language: str, niche: Optional[str], persona: Optional[Dict[str, Any]],
    topic: str, focus_keyword: Optional[str], include_trends: bool, namespace: str, top_k: int = 30
) -> Dict[str, Any]:
    query_text = f"{topic}. Language: {language}. "
    if persona:
        query_text += f"Audience: {persona.get('role','')}. "
    if focus_keyword:
        query_text += f"Focus keyword: {focus_keyword}. "
    try:
        q_vec = embed_texts([query_text])[0]
    except Exception:
        return {"snippets": [], "usedRAG": False}

    hits = _search(namespace, q_vec, top_k=top_k)
    seen, snippets = set(), []
    for h in hits:
        url = h.get("payload", {}).get("url")
        snippet = (h.get("payload", {}).get("snippet") or "")[:280]
        if not url or url in seen:
            continue
        seen.add(url)
        snippets.append({"url": url, "text": snippet or "(excerpt omitted)"})
        if len(snippets) >= 12:
            break
    logger.info("retrieve_context", extra={"namespace": namespace, "hits": len(snippets), "usedRAG": len(snippets) > 0})
    return {"snippets": snippets, "usedRAG": len(snippets) > 0}

def _search(ns: str, qvec: List[float], top_k: int):
    backend = settings.VECTOR_BACKEND.lower()
    if backend == "qdrant":
        return _qdrant_search(ns, qvec, top_k)
    elif backend == "pgvector":
        return _pg_search(ns, qvec, top_k)
    else:
        return _memory_search(ns, qvec, top_k)
