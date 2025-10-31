from fastapi import APIRouter, HTTPException
from models.requests import ContentGenerateRequest
from models.responses import ContentGenerateResponse
from services.rag_service import retrieve_context, stable_namespace
from services.llm_service import generate_content_json
from services.rag_service import quick_seed_now

router = APIRouter()

@router.post("/generate", response_model=ContentGenerateResponse)
async def generate_content(req: ContentGenerateRequest):
    ns = req.namespace or stable_namespace(req.userId, req.language, req.platform)
    await quick_seed_now(req.userId, req.language, req.platform, None, None, [], ns)
    ctx = await retrieve_context(
        req.userId, req.language, None, None,
        req.topicOrIdea, req.focusKeyword, req.includeTrend, ns
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
