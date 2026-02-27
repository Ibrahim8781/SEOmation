# ai/routers/content.py - COMPLETE FILE (REPLACE ENTIRE FILE)

from fastapi import APIRouter, HTTPException
from models.requests import ContentGenerateRequest
from models.responses import ContentGenerateResponse
from services.llm_service import generate_content_json
import logging

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
    from services.live_search_service import (
        search_and_scrape,
        extract_keywords_rag,
        build_llm_context
    )
    
    logger.info("content_request", extra={
        "user": req.userId,
        "platform": req.platform,
        "topic": req.topicOrIdea
    })
    
    # STEP 1: Search for topic content
    search_queries = [
        req.topicOrIdea,
        f"{req.topicOrIdea} guide",
        f"{req.focusKeyword} tutorial"
    ]
    
    try:
        scraped_data = await search_and_scrape(search_queries, max_urls=5)
    except Exception as e:
        logger.error(f"Search/scrape failed: {e}")
        scraped_data = []
    
    # STEP 2: Extract context via RAG
    rag_keywords = {"keywords": [], "themes": []}
    if scraped_data:
        try:
            rag_keywords = await extract_keywords_rag(scraped_data, top_n=15)
        except Exception as e:
            logger.error(f"RAG extraction failed: {e}")
    
    # STEP 3: Build context
    llm_context = build_llm_context(scraped_data, rag_keywords["keywords"])
    
    logger.info("rag_context", extra={
        "sources": len(scraped_data),
        "keywords": len(rag_keywords["keywords"])
    })
    
    # STEP 4: Generate with Gemini
    try:
        content, diagnostics = await generate_content_json(
            platform=req.platform,
            language=req.language,
            topic_or_idea=req.topicOrIdea,
            tone=req.tone,
            target_length=req.targetLength,
            focus_keyword=req.focusKeyword,
            style_guide=req.styleGuideBullets,
            retrieved_context={
                "snippets": [{"text": llm_context}] if llm_context else [],
                "usedRAG": bool(scraped_data)
            }
        )
    except Exception as e:
        logger.error(f"Content generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
    logger.info("content_complete", extra={"length": len(content.get("plainText", ""))})
    
    return ContentGenerateResponse(
        contentForEditor=content,
        diagnostics=diagnostics
    )