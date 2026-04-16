# ai/services/llm_service.py - FIXED VERSION WITH SAFETY CHECKS

"""
LLM Service - Handles all LLM interactions
- Groq (fast) for topic generation
- Gemini (quality) for content generation
"""

import logging
import json
import re
from typing import Any, Dict, List, Tuple

import httpx
from langdetect import detect

from config import settings
from services.prompt_builder import build_topic_prompt, blog_system, linkedin_system, instagram_system
from services.render_service import (
    blog_to_html, blog_to_plain,
    linkedin_to_html, linkedin_to_plain,
    instagram_to_html, instagram_to_plain
)
from services.text_quality_service import score_content_metrics

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
    retrieved_context: Dict[str, Any],
    include_trends: bool = True,
    content_goals: str = "",
    preferred_content_types: List[str] | None = None
):
    """
    Generate topics using GROQ (optimized for speed).
    """
    # Build prompt with context
    snippets = retrieved_context.get("snippets", []) if retrieved_context else []
    context_lines = [f"[Source {i}] {sn.get('text', '')}" for i, sn in enumerate(snippets, 1)]
    
    system, user = build_topic_prompt(
        language,
        niche,
        persona,
        seed_keywords,
        region,
        season,
        count,
        context_lines,
        include_trends,
        content_goals,
        preferred_content_types or []
    )
    
    logger.info("llm_topics_start model=groq niche=%s count=%s", niche, count)
    
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
        raw_trend_tag = (it.get("trendTag") or it.get("tag") or "").strip().lower()
        trend_tag = raw_trend_tag or ("news-angle" if include_trends else "evergreen")
        if trend_tag in {"trending-q4", "trending", "q4", "seasonal"}:
            trend_tag = "seasonal-campaign"
        if trend_tag not in {"evergreen", "seasonal-campaign", "news-angle"}:
            trend_tag = "news-angle" if include_trends and "news" in trend_tag else "evergreen"
        return {
            "ideaText": t,
            "targetKeyword": (it.get("targetKeyword") or it.get("keyword") or "").strip()[:64],
            "rationale": (it.get("rationale") or it.get("why") or "").strip(),
            "trendTag": trend_tag,
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
    
    def _append_fallback(title: str, keyword: str, rationale: str, trend_tag: str) -> None:
        normalized_title = " ".join(str(title or "").split()).strip()
        if not normalized_title:
            return
        if len(normalized_title) < 20:
            normalized_title = f"{normalized_title} guide"
        if len(normalized_title) > 120:
            normalized_title = normalized_title[:117].rstrip() + "..."
        folded = normalized_title.casefold()
        if folded in seen:
            return
        seen.add(folded)
        filtered.append({
            "ideaText": normalized_title,
            "targetKeyword": keyword[:64],
            "rationale": rationale,
            "trendTag": trend_tag,
            "language": language,
        })

    fallback_keywords = [kw.strip() for kw in seed_keywords if kw and kw.strip()]
    if not fallback_keywords and niche and niche.strip():
        fallback_keywords = [niche.strip()]

    seasonal_label = season.strip() if season else "this season"
    fallback_patterns = [
        ("{keyword} practical guide for {niche}", "Relevant to {niche} audience", "evergreen"),
        ("How {keyword} changed over time", "Historical angle with clear search intent", "evergreen"),
        ("What marketers can learn from {keyword}", "Strategic perspective for broader content", "evergreen"),
    ]
    if include_trends:
        fallback_patterns.extend([
            ("Latest updates around {keyword}", "Timely news-angle topic for current interest", "news-angle"),
            ("Why {keyword} matters in {season}", "Seasonal/campaign angle connected to current interest", "seasonal-campaign"),
        ])

    while len(filtered) < count and fallback_keywords:
        for keyword in fallback_keywords:
            for template, rationale_template, trend_tag in fallback_patterns:
                if len(filtered) >= count:
                    break
                title = template.format(keyword=keyword.title(), niche=niche, season=seasonal_label)
                rationale = rationale_template.format(niche=niche, season=seasonal_label)
                _append_fallback(title, keyword, rationale, trend_tag)
            if len(filtered) >= count:
                break

    filtered = filtered[:count]
    
    diagnostics = {
        "usedRAG": retrieved_context.get("usedRAG", False) if retrieved_context else False,
        "clustersCount": len(clusters),
        "model": "groq"
    }
    
    logger.info("llm_topics_complete model=groq count=%s requested=%s", len(filtered), count)
    
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
    from services.gemini_service import call_gemini_json, get_last_llm_execution
    
    # Build context
    ctx_lines = []
    if retrieved_context:
        keywords = retrieved_context.get("keywords", [])
        if keywords:
            ctx_lines.append(f"Relevant keywords and angles: {', '.join(keywords[:15])}")
        snippets = retrieved_context.get("snippets", [])
        for i, sn in enumerate(snippets[:10], 1):
            if isinstance(sn, dict):
                title = sn.get("title", "")
                url = sn.get("url", "")
                text = sn.get('text', '')
                parts = [f"[Source {i}]"]
                if title:
                    parts.append(f"Title: {title}")
                if url:
                    parts.append(f"URL: {url}")
                if text:
                    parts.append(f"Excerpt: {text}")
                ctx_lines.append("\n".join(parts))
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
    
    logger.info(
        "llm_content_start model=%s platform=%s context_sources=%s",
        settings.GEMINI_MODEL,
        platform,
        len((retrieved_context or {}).get("snippets", [])),
    )
    
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
    
    repair_issues = []
    if platform == "blog":
        data, _normalization_notes, repair_issues = _prepare_blog_payload(
            data,
            topic_or_idea,
            focus_keyword,
            target_length,
        )
    
    # Check language
    sample_text = ""
    if platform == "blog":
        sample_text = (data.get("h1") or "") + " " + " ".join([s.get("h2", "") for s in data.get("sections", [])])
    elif platform == "linkedin":
        sample_text = data.get("body", "")
    else:
        sample_text = data.get("caption", "")
    
    expected_language = (language or "en").split("-")[0].lower()

    try:
        detected_language = detect(sample_text[:200]).lower() if sample_text else ""
        if detected_language and detected_language != expected_language:
            repair_issues.append(f"Output language must be {expected_language}")
    except Exception:
        pass
    
    # Repair if needed
    if repair_issues:
        logger.warning(f"content_repair: fixing {'; '.join(repair_issues)}")
        
        repair_prompt = f"""The previous response had these issues:
{'; '.join(repair_issues)}

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
            if platform == "blog":
                if "html" in data and "sections" not in data:
                    data["sections"] = [{"h2": "Introduction", "body": f"Content about {topic_or_idea}"}]
                    del data["html"]
                data, _normalization_notes, _ = _prepare_blog_payload(
                    data,
                    topic_or_idea,
                    focus_keyword,
                    target_length,
                )
                    
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
    
    llm_execution = get_last_llm_execution()
    diagnostics = {
        "usedRAG": (retrieved_context or {}).get("usedRAG", False),
        "repairAttempted": bool(repair_issues),
        "platform": platform,
        "model": llm_execution.get("model", settings.GEMINI_MODEL),
        "provider": llm_execution.get("provider", "gemini"),
        "liveSources": (retrieved_context or {}).get("liveSources", 0),
        "indexedSources": (retrieved_context or {}).get("indexedSources", 0)
    }
    metrics = score_content_metrics(packaged.get("html", ""), plain, language)
    
    logger.info(
        "llm_content_complete provider=%s model=%s platform=%s length=%s repair=%s",
        diagnostics["provider"],
        diagnostics["model"],
        platform,
        len(plain),
        bool(repair_issues),
    )
    
    return packaged, diagnostics, metrics


def _prepare_blog_payload(
    json_obj: Dict[str, Any],
    topic_or_idea: str,
    focus_kw: str,
    target_length: int,
) -> Tuple[Dict[str, Any], List[str], List[str]]:
    data = dict(json_obj if isinstance(json_obj, dict) else {})
    notes: List[str] = []
    repair_issues: List[str] = []

    title = " ".join(str(data.get("title") or topic_or_idea or focus_kw or "Generated Content").split()).strip()
    data["title"] = title or "Generated Content"
    data["h1"] = _ensure_focus_keyword_in_h1(data.get("h1"), data["title"], focus_kw)

    normalized_sections: List[Dict[str, str]] = []
    raw_sections = data.get("sections")
    if isinstance(raw_sections, list):
        for sec in raw_sections:
            if not isinstance(sec, dict):
                continue
            h2 = " ".join(str(sec.get("h2") or "").split()).strip()
            body = " ".join(str(sec.get("body") or "").split()).strip()
            if not h2 and not body:
                continue
            normalized_sections.append({
                "h2": h2 or "Section",
                "body": body,
            })

    if not normalized_sections:
        fallback_html = " ".join(str(data.get("html") or "").split()).strip()
        if fallback_html:
            normalized_sections = [{"h2": "Introduction", "body": fallback_html[:700]}]
        else:
            repair_issues.append("Sections must include body content")
    data["sections"] = normalized_sections

    meta = data.get("meta")
    meta_dict = meta if isinstance(meta, dict) else {}
    meta_dict["description"] = _normalize_meta_description(
        meta_dict.get("description"),
        data["title"],
        focus_kw,
        normalized_sections,
    )
    meta_dict["slug"] = _slugify(str(meta_dict.get("slug") or focus_kw or data["title"]))
    data["meta"] = meta_dict

    total_len = _blog_word_count(normalized_sections)
    if total_len and total_len < int(target_length * 0.65):
        repair_issues.append("Content is significantly shorter than target length")
    elif total_len and not (0.75 * target_length <= total_len <= 1.35 * target_length):
        notes.append("Length outside preferred range")

    return data, notes, repair_issues


def _ensure_focus_keyword_in_h1(h1: Any, title: str, focus_kw: str) -> str:
    resolved_h1 = " ".join(str(h1 or title or focus_kw or "Generated Content").split()).strip()
    if focus_kw and focus_kw.lower() not in resolved_h1.lower():
        resolved_h1 = f"{focus_kw}: {resolved_h1}"
    return resolved_h1 or "Generated Content"


def _normalize_meta_description(
    description: Any,
    title: str,
    focus_kw: str,
    sections: List[Dict[str, str]],
) -> str:
    candidate = " ".join(str(description or "").split()).strip()
    if not candidate:
        excerpt = _blog_excerpt(sections, max_words=28)
        candidate = " ".join(part for part in [focus_kw, title, excerpt] if part).strip()

    if focus_kw and focus_kw.lower() not in candidate.lower():
        candidate = f"{focus_kw} - {candidate}".strip(" -")

    if len(candidate) < 140:
        excerpt = _blog_excerpt(sections, max_words=120)
        if excerpt:
            candidate = " ".join(part for part in [candidate, excerpt] if part).strip()

    candidate = re.sub(r"\s+", " ", candidate).strip(" ,.-")
    if len(candidate) > 160:
        trimmed = candidate[:157].rsplit(" ", 1)[0].rstrip(" ,.-")
        candidate = f"{trimmed}..."

    if len(candidate) < 140:
        candidate = _pad_meta_description(candidate)

    if len(candidate) > 160:
        trimmed = candidate[:157].rsplit(" ", 1)[0].rstrip(" ,.-")
        candidate = f"{trimmed}..."

    return candidate or title[:157]


def _blog_excerpt(sections: List[Dict[str, str]], max_words: int = 40) -> str:
    words: List[str] = []
    for sec in sections:
        words.extend(str(sec.get("body") or "").split())
        if len(words) >= max_words:
            break
    return " ".join(words[:max_words]).strip()


def _blog_word_count(sections: List[Dict[str, str]]) -> int:
    return sum(len(str(sec.get("body") or "").split()) for sec in sections)


def _pad_meta_description(candidate: str, minimum_length: int = 140, maximum_length: int = 160) -> str:
    normalized = re.sub(r"\s+", " ", str(candidate or "")).strip(" ,.-")
    if len(normalized) >= minimum_length:
        return normalized[:maximum_length].rstrip(" ,.-")

    filler = " Practical insights, examples, and clear takeaways."
    while len(normalized) < minimum_length and len(normalized) < maximum_length:
        available = maximum_length - len(normalized)
        if available <= 0:
            break
        normalized = f"{normalized}{(filler * 4)[:available]}".strip(" ,.-")

    return normalized[:maximum_length].rstrip(" ,.-")


def _slugify(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", str(value or "").lower()).strip("-")
    return normalized or "generated-content"


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
