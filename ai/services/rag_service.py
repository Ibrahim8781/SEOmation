from typing import List, Dict, Any, Optional
from config import settings
from utils.text_processing import chunk_text
from services.scraper_service import candidate_urls, extract_main_text
from services.embedding_service import embed_texts
from utils.cache import get_if_fresh, set_with_ttl
import asyncio, uuid, logging

logger = logging.getLogger(__name__)

_qdrant = None
_engine = None

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
    from sqlalchemy import create_engine, text
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
    key = f"seeded:{namespace}"
    if get_if_fresh(key):
        return
    texts, metas = [], []
    base = [niche] + (seed_keywords or [])[:4]
    for sk in base[:6]:
        txt = f"{niche} primer on '{sk}': practical steps, pitfalls, KPIs, examples. Language={language}."
        texts.append(txt)
        metas.append({"url": f"seed:{sk}", "language": language, "niche": niche, "source": "seed", "snippet": txt[:320]})
    embs = embed_texts(texts)
    _store(namespace, texts, metas, embs)
    set_with_ttl(key, True, settings.CACHE_TTL_SECONDS)

def ensure_index_async(
    user_id: str, language: str, niche: str,
    region: Optional[str], season: Optional[str],
    seed_keywords: List[str], namespace: str
):
    logger.info("ensure_index_async scheduled", extra={"ns": namespace, "niche": niche, "language": language})
    asyncio.create_task(_build_index(user_id, language, niche, region, season, seed_keywords, namespace))

async def _build_index(
    user_id: str, language: str, niche: str,
    region: Optional[str], season: Optional[str],
    seed_keywords: List[str], namespace: str
):
    urls = await candidate_urls(niche, seed_keywords or [], language, region or "")
    texts, metas = [], []
    for u in urls:
        txt = await extract_main_text(u)
        if not txt or len(txt) < 200:
            continue
        chunks = chunk_text(txt, max_words=120)
        for c in chunks:
            texts.append(c)
            metas.append({"url": u, "language": language, "niche": niche, "source": "web", "snippet": c[:320]})
        if len(texts) >= 200:
            break
    if not texts:
        base = [niche] + (seed_keywords or [])[:4]
        for sk in base[:6]:
            synthetic = f"{niche} quick guide about '{sk}': concepts, steps, pitfalls, KPIs. Language={language}."
            texts.append(synthetic)
            metas.append({"url": f"seed:{sk}", "language": language, "niche": niche, "source": "seed", "snippet": synthetic[:320]})
    embs = embed_texts(texts)
    _store(namespace, texts, metas, embs)
    logger.info("build_index_complete", extra={"ns": namespace, "urls": len(urls), "chunks": len(texts)})

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
    topic: str, focus_keyword: Optional[str], include_trends: bool, namespace: str
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

    hits = _search(namespace, q_vec, top_k=30)
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
