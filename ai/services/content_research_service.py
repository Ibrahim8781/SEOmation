import asyncio
import copy
import hashlib
import json
import logging
from typing import Any, Dict, List, Optional, Sequence

from config import settings
from services.live_search_service import extract_keywords_rag, search_and_scrape
from services.rag_service import ensure_index_async, quick_seed_now, retrieve_context, stable_namespace
from services.rag_strategy import (
    docs_to_snippets,
    merge_query_terms,
    merge_snippet_sources,
    should_use_indexed_content_context,
)
from utils.cache import get_if_fresh, set_with_ttl

logger = logging.getLogger(__name__)

RESEARCH_CACHE_TTL_SECONDS = min(settings.CACHE_TTL_SECONDS, 300)
_RESEARCH_IN_FLIGHT: Dict[str, asyncio.Task] = {}


def _normalize_persona(persona: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not isinstance(persona, dict):
        return {"role": "content reader", "pains": []}

    pains = [
        str(pain).strip()
        for pain in (persona.get("pains") or [])
        if str(pain).strip()
    ]
    role = str(persona.get("role") or "content reader").strip() or "content reader"
    return {"role": role, "pains": pains}


def _dedupe_queries(queries: Sequence[str]) -> List[str]:
    ordered: List[str] = []
    seen = set()
    for query in queries:
        cleaned = " ".join(str(query or "").split()).strip()
        if not cleaned:
            continue
        folded = cleaned.casefold()
        if folded in seen:
            continue
        seen.add(folded)
        ordered.append(cleaned)
    return ordered


def _build_research_cache_key(
    *,
    user_id: str,
    language: str,
    niche: str,
    topic_or_idea: str,
    focus_keyword: str,
    include_trend: bool,
    seed_keywords: Sequence[str],
    region: Optional[str],
    season: Optional[str],
    namespace: str,
    persona: Dict[str, Any],
) -> str:
    payload = {
        "userId": user_id,
        "language": language,
        "niche": niche,
        "topicOrIdea": topic_or_idea,
        "focusKeyword": focus_keyword,
        "includeTrend": include_trend,
        "seedKeywords": list(seed_keywords or []),
        "region": region or "",
        "season": season or "",
        "namespace": namespace,
        "persona": persona,
    }
    serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    digest = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
    return f"content-research:{digest}"


async def get_content_research_bundle(
    *,
    user_id: str,
    language: str,
    topic_or_idea: str,
    focus_keyword: str,
    include_trend: bool,
    niche: Optional[str],
    seed_keywords: Sequence[str],
    region: Optional[str],
    season: Optional[str],
    persona: Optional[Dict[str, Any]],
    namespace: Optional[str],
) -> Dict[str, Any]:
    resolved_niche = niche or focus_keyword or topic_or_idea
    resolved_persona = _normalize_persona(persona)
    resolved_namespace = namespace or stable_namespace(user_id, language, resolved_niche)
    cache_key = _build_research_cache_key(
        user_id=user_id,
        language=language,
        niche=resolved_niche,
        topic_or_idea=topic_or_idea,
        focus_keyword=focus_keyword,
        include_trend=include_trend,
        seed_keywords=seed_keywords,
        region=region,
        season=season,
        namespace=resolved_namespace,
        persona=resolved_persona,
    )

    cached = get_if_fresh(cache_key)
    if cached:
        logger.info("content_research cache HIT namespace=%s", resolved_namespace)
        return copy.deepcopy(cached)

    existing_task = _RESEARCH_IN_FLIGHT.get(cache_key)
    if existing_task and not existing_task.done():
        logger.info("content_research await_inflight namespace=%s", resolved_namespace)
        result = await existing_task
        return copy.deepcopy(result)

    task = asyncio.create_task(
        _build_content_research(
            user_id=user_id,
            language=language,
            topic_or_idea=topic_or_idea,
            focus_keyword=focus_keyword,
            include_trend=include_trend,
            niche=resolved_niche,
            seed_keywords=list(seed_keywords or []),
            region=region,
            season=season,
            persona=resolved_persona,
            namespace=resolved_namespace,
        )
    )
    _RESEARCH_IN_FLIGHT[cache_key] = task

    try:
        result = await task
        set_with_ttl(cache_key, result, RESEARCH_CACHE_TTL_SECONDS)
        return copy.deepcopy(result)
    finally:
        current_task = _RESEARCH_IN_FLIGHT.get(cache_key)
        if current_task is task:
            _RESEARCH_IN_FLIGHT.pop(cache_key, None)


async def _build_content_research(
    *,
    user_id: str,
    language: str,
    topic_or_idea: str,
    focus_keyword: str,
    include_trend: bool,
    niche: str,
    seed_keywords: List[str],
    region: Optional[str],
    season: Optional[str],
    persona: Dict[str, Any],
    namespace: str,
) -> Dict[str, Any]:
    use_indexed_context, indexed_policy = should_use_indexed_content_context(
        niche or "",
        topic_or_idea,
        focus_keyword,
        seed_keywords,
    )

    focus_anchor = focus_keyword or topic_or_idea or ""
    topic_anchor = merge_query_terms(focus_anchor, topic_or_idea or "")
    search_queries = _dedupe_queries(
        [
            topic_anchor or topic_or_idea,
            f"{focus_anchor} latest" if include_trend else f"{focus_anchor} tutorial",
            f"{topic_anchor or topic_or_idea} analysis preview"
            if include_trend
            else f"{topic_anchor or topic_or_idea} guide",
        ]
    )

    logger.info(
        "content_research_build namespace=%s use_indexed=%s queries=%s",
        namespace,
        use_indexed_context,
        len(search_queries),
    )

    try:
        scraped_data = await search_and_scrape(search_queries, max_urls=5)
    except Exception as exc:
        logger.error("content_research search failed namespace=%s error=%s", namespace, exc)
        scraped_data = []

    live_snippets = docs_to_snippets(scraped_data[:6])

    indexed_context = {"snippets": [], "usedRAG": False}
    if use_indexed_context:
        try:
            await quick_seed_now(
                user_id,
                language,
                niche,
                region,
                season,
                seed_keywords,
                namespace,
            )
            ensure_index_async(
                user_id,
                language,
                niche,
                region,
                season,
                seed_keywords,
                namespace,
            )
            indexed_context = await retrieve_context(
                user_id,
                language,
                niche,
                persona,
                topic_or_idea,
                focus_keyword,
                include_trend,
                namespace,
            )
        except Exception as exc:
            logger.warning("content_research indexed retrieval failed namespace=%s error=%s", namespace, exc)
    else:
        logger.info(
            "content_research indexed skipped namespace=%s reason=%s",
            namespace,
            indexed_policy.get("reason"),
        )

    rag_keywords = {"keywords": [], "themes": []}
    if scraped_data:
        try:
            rag_keywords = await extract_keywords_rag(scraped_data, top_n=15)
        except Exception as exc:
            logger.error("content_research keyword extraction failed namespace=%s error=%s", namespace, exc)

    merged_snippets = merge_snippet_sources(
        live_snippets,
        indexed_context.get("snippets", []),
        limit=12,
        text_limit=900,
    )

    if rag_keywords.get("keywords"):
        merged_snippets = [
            {
                "title": "Relevant angles",
                "url": "",
                "text": ", ".join(rag_keywords["keywords"][:15]),
            },
            *merged_snippets,
        ]

    retrieved_context = {
        "snippets": merged_snippets,
        "usedRAG": bool(merged_snippets),
        "liveSources": len(live_snippets),
        "indexedSources": len(indexed_context.get("snippets", [])),
        "keywords": rag_keywords.get("keywords", []),
    }

    bundle = {
        "retrievedContext": retrieved_context,
        "indexedPolicy": indexed_policy,
        "indexedNamespace": namespace,
        "useIndexedContext": use_indexed_context,
        "ragMode": "live+indexed" if use_indexed_context and indexed_context.get("snippets") else "live-only",
    }
    logger.info(
        "content_research_ready namespace=%s live=%s indexed=%s keywords=%s",
        namespace,
        retrieved_context["liveSources"],
        retrieved_context["indexedSources"],
        len(retrieved_context["keywords"]),
    )
    return bundle
