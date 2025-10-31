from fastapi import APIRouter, HTTPException
from models.requests import TopicSuggestRequest
from models.responses import TopicSuggestResponse
from services.llm_service import generate_topics_json
from services.rag_service import retrieve_context, ensure_index_async, quick_seed_now, stable_namespace

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
    try:
        clusters, ideas, diagnostics = await generate_topics_json(
            language=req.language, niche=req.niche, persona=req.persona.model_dump(),
            seed_keywords=req.seedKeywords, region=req.region or "", season=req.season or "",
            count=req.count, retrieved_context=ctx
        )
        diagnostics["namespace"] = ns
        return TopicSuggestResponse(clusters=clusters, ideas=ideas, diagnostics=diagnostics)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
