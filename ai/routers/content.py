# ai/routers/content.py - COMPLETE FILE (REPLACE ENTIRE FILE)

from fastapi import APIRouter, HTTPException
from models.requests import ContentGenerateRequest
from models.responses import ContentGenerateResponse
from services.llm_service import generate_content_json
from services.rag_strategy import (
    docs_to_snippets,
    merge_query_terms,
    merge_snippet_sources,
    should_use_indexed_content_context,
)
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
    from services.live_search_service import search_and_scrape, extract_keywords_rag
    from services.rag_service import (
        ensure_index_async,
        quick_seed_now,
        retrieve_context,
        stable_namespace,
    )
    
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
    use_indexed_context, indexed_policy = should_use_indexed_content_context(
        req.niche or "",
        req.topicOrIdea,
        req.focusKeyword,
        seed_keywords,
    )
    namespace = req.namespace or stable_namespace(req.userId, req.language, niche)

    logger.info(
        "content_rag_policy use_indexed=%s reason=%s overlap=%s namespace=%s",
        use_indexed_context,
        indexed_policy.get("reason"),
        ",".join(indexed_policy.get("overlapTerms", [])) or "none",
        namespace,
    )

    # STEP 1: Search for fresh topic content
    focus_anchor = req.focusKeyword or req.topicOrIdea or ""
    topic_anchor = merge_query_terms(focus_anchor, req.topicOrIdea or "")
    search_queries = [
        topic_anchor or req.topicOrIdea,
        f"{focus_anchor} latest" if req.includeTrend else f"{focus_anchor} tutorial",
        f"{topic_anchor or req.topicOrIdea} analysis preview" if req.includeTrend else f"{topic_anchor or req.topicOrIdea} guide"
    ]
    
    try:
        scraped_data = await search_and_scrape(search_queries, max_urls=5)
        logger.info("content_search_complete queries=%s scraped_docs=%s", len(search_queries), len(scraped_data))
    except Exception as e:
        logger.error(f"Search/scrape failed: {e}")
        scraped_data = []

    live_snippets = docs_to_snippets(scraped_data[:6])

    # STEP 2: Retrieve indexed niche context
    indexed_context = {"snippets": [], "usedRAG": False}
    if use_indexed_context:
        try:
            await quick_seed_now(
                req.userId,
                req.language,
                niche,
                req.region,
                req.season,
                seed_keywords,
                namespace
            )
            ensure_index_async(
                req.userId,
                req.language,
                niche,
                req.region,
                req.season,
                seed_keywords,
                namespace
            )
            indexed_context = await retrieve_context(
                req.userId,
                req.language,
                niche,
                persona,
                req.topicOrIdea,
                req.focusKeyword,
                req.includeTrend,
                namespace
            )
            logger.info(
                "content_indexed_context_complete namespace=%s snippets=%s usedRAG=%s",
                namespace,
                len(indexed_context.get("snippets", [])),
                indexed_context.get("usedRAG", False),
            )
        except Exception as e:
            logger.warning(f"Indexed RAG retrieval failed: {e}")
    else:
        logger.info(
            "content_indexed_context_skipped reason=%s namespace=%s",
            indexed_policy.get("reason"),
            namespace,
        )
    
    # STEP 3: Extract live keyword signals
    rag_keywords = {"keywords": [], "themes": []}
    if scraped_data:
        try:
            rag_keywords = await extract_keywords_rag(scraped_data, top_n=15)
            logger.info(
                "content_keyword_extraction_complete keywords=%s themes=%s",
                len(rag_keywords.get("keywords", [])),
                len(rag_keywords.get("themes", [])),
            )
        except Exception as e:
            logger.error(f"RAG extraction failed: {e}")
    
    # STEP 4: Merge fresh context with indexed context
    merged_snippets = merge_snippet_sources(
        live_snippets,
        indexed_context.get("snippets", []),
        limit=12,
        text_limit=900,
    )

    keyword_lines = []
    if rag_keywords.get("keywords"):
        keyword_lines.append({
            "title": "Relevant angles",
            "url": "",
            "text": ", ".join(rag_keywords["keywords"][:15])
        })
        merged_snippets = keyword_lines + merged_snippets
    
    logger.info(
        "content_context_ready live_sources=%s indexed_sources=%s keywords=%s merged_sources=%s",
        len(live_snippets),
        len(indexed_context.get("snippets", [])),
        len(rag_keywords["keywords"]),
        len(merged_snippets),
    )
    
    # STEP 5: Generate with Gemini
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
                "snippets": merged_snippets,
                "usedRAG": bool(merged_snippets),
                "liveSources": len(live_snippets),
                "indexedSources": len(indexed_context.get("snippets", [])),
                "keywords": rag_keywords.get("keywords", [])
            }
        )
    except Exception as e:
        logger.error(f"Content generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    diagnostics.update({
        "ragMode": "live+indexed" if use_indexed_context and indexed_context.get("snippets") else "live-only",
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
        diagnostics=diagnostics
    )
