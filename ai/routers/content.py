from fastapi import APIRouter, HTTPException
from models.requests import ContentGenerateRequest
from models.responses import ContentGenerateResponse
from services.rag_service import retrieve_context, stable_namespace, ensure_index_async
from services.llm_service import generate_content_json
from services.rag_service import quick_seed_now
from config import settings

router = APIRouter()

@router.post("/generate", response_model=ContentGenerateResponse)
async def generate_content(req: ContentGenerateRequest):
    ns = req.namespace or stable_namespace(req.userId, req.language, req.platform)
    
    # OPTIMIZATION: Quick seed uses cache, so it's fast if already seeded
    await quick_seed_now(req.userId, req.language, req.platform, None, None, [], ns)
    
    # OPTIMIZATION: Run async background indexing only if needed (don't wait)
    if settings.RAG_BUILD_ON_CONTENT:
        ensure_index_async(req.userId, req.language, req.platform, None, None, [], ns)
    
    # OPTIMIZATION: Limit RAG context retrieval to top 5 most relevant chunks (was 40)
    ctx = await retrieve_context(
        req.userId, req.language, None, None,
        req.topicOrIdea, req.focusKeyword, req.includeTrend, ns, top_k=5
    )
    
    try:
        content, diagnostics = await generate_content_json(
            platform=req.platform, language=req.language, topic_or_idea=req.topicOrIdea, tone=req.tone,
            target_length=req.targetLength, focus_keyword=req.focusKeyword,
            style_guide=req.styleGuideBullets, retrieved_context=ctx
        )
        return ContentGenerateResponse(contentForEditor=content, diagnostics=diagnostics)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
