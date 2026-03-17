from fastapi import APIRouter, HTTPException
from models.requests import TopicSuggestRequest
from models.responses import TopicSuggestResponse
from services.llm_service import generate_topics_json
from services.rag_service import retrieve_context, ensure_index_async, quick_seed_now, stable_namespace
from services.rag_strategy import build_topic_live_queries, docs_to_snippets, merge_snippet_sources

router = APIRouter()

@router.post("/suggest", response_model=TopicSuggestResponse)
async def suggest_topics(req: TopicSuggestRequest):
    ns = req.namespace or stable_namespace(req.userId, req.language, req.niche)

    # Fast seed so usedRAG becomes true on first call
    await quick_seed_now(req.userId, req.language, req.niche, req.region, req.season, req.seedKeywords, ns)
    # Full RAG build in background (Google News + optional Serper + baseline RSS)
    ensure_index_async(req.userId, req.language, req.niche, req.region, req.season, req.seedKeywords, ns)

    ctx = await retrieve_context(
        req.userId, req.language, req.niche, req.persona.model_dump(),
        req.niche, None, req.includeTrends, ns
    )

    live_topic_snippets = []
    if req.includeTrends:
        try:
            from services.live_search_service import search_and_scrape

            live_queries = build_topic_live_queries(
                req.niche,
                req.seedKeywords,
                req.region or "",
                req.season or "",
                req.includeTrends,
            )
            live_docs = await search_and_scrape(live_queries, max_urls=4)
            live_topic_snippets = docs_to_snippets(live_docs[:4], text_limit=700)
        except Exception:
            live_topic_snippets = []

    merged_topic_snippets = merge_snippet_sources(
        live_topic_snippets,
        ctx.get("snippets", []),
        limit=12,
        text_limit=700,
    )
    ctx = {
        **ctx,
        "snippets": merged_topic_snippets,
        "liveSources": len(live_topic_snippets),
        "indexedSources": len(ctx.get("snippets", [])),
        "usedRAG": bool(merged_topic_snippets),
    }

    try:
        clusters, ideas, diagnostics = await generate_topics_json(
            language=req.language, niche=req.niche, persona=req.persona.model_dump(),
            seed_keywords=req.seedKeywords, region=req.region or "", season=req.season or "",
            count=req.count,
            retrieved_context=ctx,
            include_trends=req.includeTrends,
            content_goals=req.contentGoals or "",
            preferred_content_types=req.preferredContentTypes or []
        )
        diagnostics["namespace"] = ns
        diagnostics["liveSources"] = len(live_topic_snippets)
        diagnostics["indexedSources"] = ctx.get("indexedSources", 0)
        diagnostics["ragMode"] = "indexed+live" if live_topic_snippets else "indexed"
        return TopicSuggestResponse(clusters=clusters, ideas=ideas, diagnostics=diagnostics)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
