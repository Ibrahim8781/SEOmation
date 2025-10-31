import json, re
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

async def chat_json(messages: List[Dict[str, str]], max_tokens: int, temperature: float = 0.7, model: str = None) -> str:
    if not settings.GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY missing")
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": model or settings.GROQ_MODEL,
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

async def generate_topics_json(language: str, niche: str, persona: Dict[str, Any],
                               seed_keywords: List[str], region: str, season: str,
                               count: int, retrieved_context: Dict[str, Any]):
    # Build prompt with any retrieved context
    snippets = retrieved_context.get("snippets", []) if retrieved_context else []
    context_lines = [f"[c{i}] {sn['url']}" for i, sn in enumerate(snippets, 1)]
    system, user = build_topic_prompt(language, niche, persona, seed_keywords, region, season, count, context_lines)

    # Call LLM
    raw = await chat_json([{"role": "system", "content": system}, user], max_tokens=900, temperature=0.7)
    try:
        data = json.loads(raw)
    except Exception:
        m = re.search(r"\{[\s\S]*\}\s*$", raw)
        if not m:
            raise
        data = json.loads(m.group(0))

    # Keep clusters for UI grouping
    clusters = data.get("clusters", []) or []

    # --- Robust idea collection (same as before, just no counters) ---
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

    # Filtering (relaxed)
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
            _ = detect(t)  # soft check; never hard-drop
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

    # Fallback synthesis so UI never sees 0 ideas
    if not filtered:
        for sk in (seed_keywords or [])[:max(3, min(6, count))]:
            title = f"{sk.title()} — practical tips and examples for {niche}"
            filtered.append({
                "ideaText": title,
                "targetKeyword": sk,
                "rationale": f"Relevant to {niche} audience; actionable.",
                "trendTag": "evergreen",
                "language": language,
            })

    # Diagnostics now minimal
    diagnostics = {
        "usedRAG": retrieved_context.get("usedRAG", False) if retrieved_context else False,
        "clustersCount": len(clusters)
        # no ideasBefore / ideasAfter
    }
    return clusters, filtered, diagnostics


def _validate_blog(json_obj: Dict[str, Any], focus_kw: str, target_length: int) -> List[str]:
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

async def generate_content_json(platform: str, language: str, topic_or_idea: str, tone: str,
                                target_length: int, focus_keyword: str, style_guide: List[str],
                                retrieved_context: Dict[str, Any]):
    ctx_lines = [f"[c{i}] {sn['url']}" for i, sn in enumerate((retrieved_context or {}).get("snippets", []), 1)]
    context_block = "\n".join(ctx_lines[:10]) or "No context"

    if platform == "blog":
        system = blog_system(language, focus_keyword, target_length); max_tokens = 1800
    elif platform == "linkedin":
        system = linkedin_system(language); max_tokens = 800
    else:
        system = instagram_system(language); max_tokens = 700

    user_content = f"""Topic: {topic_or_idea}
Tone: {tone}
Style guide: {style_guide}
Context references (do not copy):
{context_block}
"""

    raw = await chat_json(
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user_content}],
        max_tokens=max_tokens, temperature=0.7
    )
    try:
        data = json.loads(raw)
    except Exception:
        m = re.search(r"\{[\s\S]*\}\s*$", raw)
        if not m:
            raise
        data = json.loads(m.group(0))

    issues = []
    if platform == "blog":
        issues = _validate_blog(data, focus_keyword, target_length)

    sample_text = (
        (data.get("h1") or "") + " " + " ".join([s.get("h2", "") for s in data.get("sections", [])])
        if platform == "blog" else
        (data.get("body", "") if platform == "linkedin" else data.get("caption", ""))
    )
    try:
        if sample_text and detect(sample_text[:200]) != language:
            issues.append(f"Output language must be {language}")
    except Exception:
        pass

    if issues:
        repair = await chat_json(
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_content},
                {"role": "user", "content": "Fix issues: " + "; ".join(issues)},
                {"role": "user", "content": "Return valid JSON only."},
            ],
            max_tokens=max_tokens, temperature=0.4
        )
        try:
            data = json.loads(repair)
        except Exception:
            pass

    # Render HTML + plain for all platforms
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

    diagnostics = {
        "usedRAG": (retrieved_context or {}).get("usedRAG", False),
        "repairAttempted": bool(issues),
        "platform": platform
    }
    return packaged, diagnostics
