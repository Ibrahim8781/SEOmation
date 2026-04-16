# ai/routers/content.py - COMPLETE FILE (REPLACE ENTIRE FILE)

import logging

from fastapi import APIRouter, HTTPException

from models.requests import ContentGenerateRequest
from models.responses import ContentGenerateResponse
from services.content_research_service import get_content_research_bundle
from services.llm_service import generate_content_json

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/generate", response_model=ContentGenerateResponse)
async def generate_content(req: ContentGenerateRequest):
    """
    Generate content using live search + RAG + Gemini LLM.
    
    Flow:
    1. Search for topic-related content
    2. Scrape top articles
    3. Extract context via RAG
    4. Feed to Gemini for high-quality generation
    """
    logger.info(
        "content_request user=%s platform=%s topic=%s keyword=%s trend=%s",
        req.userId,
        req.platform,
        req.topicOrIdea,
        req.focusKeyword,
        req.includeTrend,
    )
    
    niche = req.niche or req.focusKeyword or req.topicOrIdea
    persona = req.persona.model_dump() if req.persona else {"role": "content reader", "pains": []}
    seed_keywords = list(req.seedKeywords or ([req.focusKeyword] if req.focusKeyword else []))

    research_bundle = await get_content_research_bundle(
        user_id=req.userId,
        language=req.language,
        topic_or_idea=req.topicOrIdea,
        focus_keyword=req.focusKeyword,
        include_trend=req.includeTrend,
        niche=niche,
        seed_keywords=seed_keywords,
        region=req.region,
        season=req.season,
        persona=persona,
        namespace=req.namespace,
    )
    retrieved_context = research_bundle["retrievedContext"]
    indexed_policy = research_bundle["indexedPolicy"]
    namespace = research_bundle["indexedNamespace"]

    logger.info(
        "content_rag_policy use_indexed=%s reason=%s overlap=%s namespace=%s",
        research_bundle["useIndexedContext"],
        indexed_policy.get("reason"),
        ",".join(indexed_policy.get("overlapTerms", [])) or "none",
        namespace,
    )
    
    # STEP 5: Generate with Gemini
    try:
        content, diagnostics, metrics = await generate_content_json(
            platform=req.platform,
            language=req.language,
            topic_or_idea=req.topicOrIdea,
            tone=req.tone,
            target_length=req.targetLength,
            focus_keyword=req.focusKeyword,
            style_guide=req.styleGuideBullets,
            retrieved_context=retrieved_context,
        )
    except Exception as e:
        logger.error(f"Content generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    diagnostics.update({
        "ragMode": research_bundle["ragMode"],
        "indexedPolicy": indexed_policy,
        "indexedNamespace": namespace,
    })
    
    logger.info(
        "content_complete platform=%s length=%s model=%s",
        req.platform,
        len(content.get("plainText", "")),
        diagnostics.get("model"),
    )
    
    return ContentGenerateResponse(
        contentForEditor=content,
        diagnostics=diagnostics,
        metrics=metrics,
    )
