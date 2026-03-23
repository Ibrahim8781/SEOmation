# ai/services/prompt_builder.py - FIXED VERSION

from typing import List, Dict, Any

def _topic_mix_instruction(include_trends: bool, season: str, preferred_content_types: List[str]) -> str:
    if include_trends:
        seasonal_line = (
            f"- Around 30% should connect to the seasonal focus '{season}'."
            if season
            else "- Around 30% should have a seasonal or campaign angle."
        )
        return "\n".join([
            "Topic mix requirements:",
            "- Around 50% should be evergreen, durable, and educational.",
            seasonal_line,
            "- Around 20% should be timely news-angle or trend-reactive ideas.",
            "- Spread the ideas across different formats and user intents."
        ])

    content_type_line = (
        f"- Favor these content styles when relevant: {', '.join(preferred_content_types[:4])}."
        if preferred_content_types
        else "- Favor durable educational and strategic formats."
    )
    return "\n".join([
        "Topic mix requirements:",
        "- Around 80% should be evergreen, practical, and reusable.",
        "- Around 20% can have a light seasonal or campaign angle, but avoid fast-expiring news hooks.",
        content_type_line
    ])


def build_topic_prompt(
    language: str, niche: str, persona: Dict[str, Any],
    seed_keywords: List[str], region: str, season: str, count: int, context_lines: List[str],
    include_trends: bool = True, content_goals: str = "", preferred_content_types: List[str] | None = None
) -> tuple:
    preferred_content_types = preferred_content_types or []
    trend_tag_rule = "evergreen | seasonal-campaign | news-angle"
    mix_instruction = _topic_mix_instruction(include_trends, season, preferred_content_types)
    system = f"You are a multilingual SEO topic strategist. Output strictly in JSON and in language: {language}. Do not copy titles."
    user = {
        "role": "user",
        "content": f"""Business niche: {niche}
Persona: {persona}
Region: {region}  Season: {season}
Seed keywords: {', '.join(seed_keywords or [])}
Content goals: {content_goals or 'Not specified'}
Preferred content types: {', '.join(preferred_content_types) or 'Not specified'}
Inspiration (do not copy):
{chr(10).join(context_lines[:12]) or 'No context'}

{mix_instruction}

Return exactly {count} ideas in total, grouped into 3-5 clusters.
Each idea: ideaText (40-90 chars), targetKeyword, rationale (1-2 lines), trendTag ({trend_tag_rule}), language.
JSON fields: clusters:[{{label, ideas[]}}], ideas:[...]."""
    }
    return system, user


def blog_system(language: str, focus_kw: str, target_length: int) -> str:
    return f"""You are a senior SEO copywriter. Write strictly in {language}.

CRITICAL: You MUST return JSON in EXACTLY this structure (do not add an "html" field):

{{
  "title": "...",
  "h1": "...",
  "sections": [
    {{"h2": "...", "body": "..."}},
    {{"h2": "...", "body": "..."}}
  ],
  "meta": {{"description": "...", "slug": "..."}},
  "images": [{{"prompt": "...", "alt": "..."}}]
}}

Rules:
- One H1 including the focus keyword: {focus_kw}
- H2/H3 hierarchy; intro mentions keyword in first 100-150 words
- Meta description 140-160 chars including {focus_kw}
- Target length ~{target_length} words (±15%)
- Use the primary keyword naturally (avoid stuffing); sprinkle secondary keywords if helpful
- Provide 1-3 image prompts + ALT text; no links required

DO NOT include an "html" field in the JSON. Only return: title, h1, sections, meta, images."""


def linkedin_system(language: str) -> str:
    return f"""Write a LinkedIn post strictly in {language} with a professional, narrative-driven tone.

CRITICAL: Return JSON in EXACTLY this structure:

{{
  "body": "...",
  "hashtags": ["tag1", "tag2"]
}}

Style: A short personal success story that exaggerates key insights (but remains plausible), then 3 actionable tips, and a reflective closing question.
Hashtags: Maximum 5 tags.
No hashtags inside body text."""


def instagram_system(language: str) -> str:
    return f"""Write an Instagram caption strictly in {language} using personal experiences and event-related storytelling.

CRITICAL: Return JSON in EXACTLY this structure:

{{
  "caption": "...",
  "hashtags": ["tag1", "tag2"]
}}

Length: 120-180 words. Use tasteful emojis (2-3 per paragraph) and a clear CTA.
Hashtags: Maximum 15 tags."""
