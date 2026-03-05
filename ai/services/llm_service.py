# ai/services/llm_service.py - FIXED VERSION WITH SAFETY CHECKS

"""
LLM Service - Handles all LLM interactions
- Groq (fast) for topic generation
- Gemini (quality) for content generation
"""

import json
import re
import logging
from typing import Any, Dict, List
from config import settings
import httpx
from langdetect import detect
from services.prompt_builder import build_topic_prompt, blog_system, linkedin_system, instagram_system
from services.render_service import (
    blog_to_html, blog_to_plain,
    linkedin_to_html, linkedin_to_plain,
    instagram_to_html, instagram_to_plain
)

logger = logging.getLogger(__name__)


async def chat_groq(messages: List[Dict[str, str]], max_tokens: int, temperature: float = 0.7) -> str:
    """Call Groq API (fast, for topics)"""
    if not settings.GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY missing")
    
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}", "Content-Type": "application/json"}
    
    payload = {
        "model": settings.GROQ_MODEL,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "response_format": {"type": "json_object"},
    }
    
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(url, headers=headers, json=payload)
        r.raise_for_status()
        data = r.json()
        return data["choices"][0]["message"]["content"]


async def generate_topics_json(
    language: str,
    niche: str,
    persona: Dict[str, Any],
    seed_keywords: List[str],
    region: str,
    season: str,
    count: int,
    retrieved_context: Dict[str, Any]
):
    """
    Generate topics using GROQ (optimized for speed).
    """
    # Build prompt with context
    snippets = retrieved_context.get("snippets", []) if retrieved_context else []
    context_lines = [f"[Source {i}] {sn.get('text', '')}" for i, sn in enumerate(snippets, 1)]
    
    system, user = build_topic_prompt(
        language, niche, persona, seed_keywords, region, season, count, context_lines
    )
    
    logger.info("llm_topics", extra={"model": "groq", "niche": niche})
    
    # Call Groq for speed
    raw = await chat_groq(
        [{"role": "system", "content": system}, user],
        max_tokens=900,
        temperature=0.7
    )
    
    # Parse JSON
    try:
        data = json.loads(raw)
    except Exception:
        # Fallback: extract JSON from response
        m = re.search(r"\{[\s\S]*\}\s*$", raw)
        if not m:
            raise ValueError(f"Invalid JSON from Groq: {raw[:200]}")
        data = json.loads(m.group(0))
    
    # Process ideas
    clusters = data.get("clusters", []) or []
    
    def _norm_idea_item(it: Any) -> Dict[str, Any]:
        if not isinstance(it, dict):
            return {}
        t = (it.get("ideaText") or it.get("title") or it.get("idea") or it.get("text") or "").strip()
        if not t:
            return {}
        return {
            "ideaText": t,
            "targetKeyword": (it.get("targetKeyword") or it.get("keyword") or "").strip()[:64],
            "rationale": (it.get("rationale") or it.get("why") or "").strip(),
            "trendTag": (it.get("trendTag") or it.get("tag") or "evergreen"),
        }
    
    candidates: List[Dict[str, Any]] = []
    
    for it in (data.get("ideas") or []):
        if isinstance(it, str):
            it = {"ideaText": it}
        norm = _norm_idea_item(it)
        if norm:
            candidates.append(norm)
    
    for cl in clusters:
        for it in (cl.get("ideas") or []):
            if isinstance(it, str):
                it = {"ideaText": it}
            norm = _norm_idea_item(it)
            if norm:
                candidates.append(norm)
    
    # Filter duplicates and validate
    from langdetect.lang_detect_exception import LangDetectException
    filtered, seen = [], set()
    
    for it in candidates:
        t = (it.get("ideaText") or "").strip()
        if not t:
            continue
        
        k = t.casefold()
        if k in seen:
            continue
        
        if len(t) < 20 or len(t) > 120:
            continue
        
        try:
            _ = detect(t)
        except LangDetectException:
            pass
        
        seen.add(k)
        filtered.append({
            "ideaText": t,
            "targetKeyword": it.get("targetKeyword", ""),
            "rationale": it.get("rationale", ""),
            "trendTag": it.get("trendTag", "evergreen"),
            "language": language,
        })
    
    # Fallback if no ideas
    if not filtered and seed_keywords:
        for sk in seed_keywords[:min(6, count)]:
            title = f"{sk.title()} — practical guide for {niche}"
            filtered.append({
                "ideaText": title,
                "targetKeyword": sk,
                "rationale": f"Relevant to {niche} audience",
                "trendTag": "evergreen",
                "language": language,
            })
    
    diagnostics = {
        "usedRAG": retrieved_context.get("usedRAG", False) if retrieved_context else False,
        "clustersCount": len(clusters),
        "model": "groq"
    }
    
    logger.info("topics_generated", extra={"count": len(filtered)})
    
    return clusters, filtered, diagnostics


async def generate_content_json(
    platform: str,
    language: str,
    topic_or_idea: str,
    tone: str,
    target_length: int,
    focus_keyword: str,
    style_guide: List[str],
    retrieved_context: Dict[str, Any]
):
    """
    Generate content using GEMINI (optimized for quality).
    """
    # Import Gemini service
    from services.gemini_service import call_gemini_json
    
    # Build context
    ctx_lines = []
    if retrieved_context:
        snippets = retrieved_context.get("snippets", [])
        for i, sn in enumerate(snippets[:10], 1):
            if isinstance(sn, dict):
                ctx_lines.append(f"[Source {i}] {sn.get('text', '')}")
            else:
                ctx_lines.append(f"[Source {i}] {str(sn)}")
    
    context_block = "\n".join(ctx_lines) or "No additional context"
    
    # Select system prompt
    if platform == "blog":
        system = blog_system(language, focus_keyword, target_length)
        max_tokens = 2000
    elif platform == "linkedin":
        system = linkedin_system(language)
        max_tokens = 800
    else:  # instagram
        system = instagram_system(language)
        max_tokens = 700
    
    user_content = f"""Topic: {topic_or_idea}
Tone: {tone}
Style guide: {style_guide}

Research context (use for ideas, don't copy):
{context_block}
"""
    
    logger.info("llm_content", extra={"model": "gemini", "platform": platform})
    
    # Call Gemini for quality
    data = await call_gemini_json(
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user_content}
        ],
        max_tokens=max_tokens,
        temperature=0.7
    )
    
    # SAFETY CHECK: Fix incorrect Gemini response structure
    # Sometimes Gemini returns {"html": "...", "title": "..."} instead of the structured format
    if platform == "blog":
        if "html" in data and ("h1" not in data or "sections" not in data):
            logger.warning("gemini_wrong_structure: Gemini returned HTML field, attempting to fix")
            
            # Extract structured data from the HTML if possible
            # Or create minimal valid structure
            if "h1" not in data:
                data["h1"] = data.get("title", topic_or_idea)
            
            if "sections" not in data:
                # Try to parse HTML into sections (minimal fallback)
                html_content = data.get("html", "")
                data["sections"] = [{
                    "h2": "Introduction",
                    "body": html_content[:500] if html_content else f"Content about {topic_or_idea}"
                }]
            
            if "meta" not in data:
                data["meta"] = {
                    "description": f"{topic_or_idea} - {focus_keyword}",
                    "slug": focus_keyword.lower().replace(" ", "-")
                }
            
            # Remove the incorrect html field
            if "html" in data:
                del data["html"]
    
    # Validate blog content
    issues = []
    if platform == "blog":
        issues = _validate_blog(data, focus_keyword, target_length)
    
    # Check language
    sample_text = ""
    if platform == "blog":
        sample_text = (data.get("h1") or "") + " " + " ".join([s.get("h2", "") for s in data.get("sections", [])])
    elif platform == "linkedin":
        sample_text = data.get("body", "")
    else:
        sample_text = data.get("caption", "")
    
    try:
        if sample_text and detect(sample_text[:200]) != language:
            issues.append(f"Output language must be {language}")
    except Exception:
        pass
    
    # Repair if needed
    if issues:
        logger.warning("content_repair", extra={"issues": issues})
        
        repair_prompt = f"""The previous response had these issues:
{'; '.join(issues)}

Please fix these issues and return the corrected JSON in the EXACT structure specified."""
        
        try:
            data = await call_gemini_json(
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_content},
                    {"role": "assistant", "content": json.dumps(data)},
                    {"role": "user", "content": repair_prompt}
                ],
                max_tokens=max_tokens,
                temperature=0.4
            )
            
            # Apply safety check again after repair
            if platform == "blog" and "html" in data and "sections" not in data:
                if "sections" not in data:
                    data["sections"] = [{"h2": "Introduction", "body": f"Content about {topic_or_idea}"}]
                if "html" in data:
                    del data["html"]
                    
        except Exception as e:
            logger.warning(f"Repair failed: {e}, using original")
    
    # Render HTML + plain text using your existing renderers
    if platform == "blog":
        html = blog_to_html(data)
        plain = blog_to_plain(data)
        packaged = {"structured": data, "html": html, "plainText": plain}
    elif platform == "linkedin":
        html = linkedin_to_html(data)
        plain = linkedin_to_plain(data)
        packaged = {"structured": data, "html": html, "plainText": plain}
    else:
        html = instagram_to_html(data)
        plain = instagram_to_plain(data)
        packaged = {"structured": data, "html": html, "plainText": plain}
    
    # Final safety check
    if not packaged.get("html") or not packaged.get("html").strip():
        logger.error("content_empty_html: HTML is empty after rendering!")
        logger.error(f"Data structure: {list(data.keys())}")
        logger.error(f"Structured data: {json.dumps(data, indent=2)[:500]}")
        raise RuntimeError("Generated HTML is empty - check prompt and data structure")
    
    diagnostics = {
        "usedRAG": (retrieved_context or {}).get("usedRAG", False),
        "repairAttempted": bool(issues),
        "platform": platform,
        "model": "gemini"
    }
    
    logger.info("content_generated", extra={"platform": platform, "length": len(plain)})
    
    return packaged, diagnostics


def _validate_blog(json_obj: Dict[str, Any], focus_kw: str, target_length: int) -> List[str]:
    """Validate blog content structure."""
    issues = []
    
    h1 = (json_obj.get("h1") or "").lower()
    if focus_kw.lower() not in h1:
        issues.append("H1 must include focus keyword")
    
    meta = (json_obj.get("meta", {}) or {}).get("description", "")
    if not (140 <= len(meta) <= 160):
        issues.append("Meta description must be 140-160 chars")
    
    total_len = sum(len((sec.get("body") or "").split()) for sec in json_obj.get("sections", []))
    if not (0.85 * target_length <= total_len <= 1.15 * target_length):
        issues.append("Length ±15% of target")
    
    return issues