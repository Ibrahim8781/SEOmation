from typing import List, Dict, Any

def build_topic_prompt(
    language: str, niche: str, persona: Dict[str, Any],
    seed_keywords: List[str], region: str, season: str, count: int, context_lines: List[str]
) -> tuple:
    system = f"You are a multilingual SEO topic strategist. Output strictly in JSON and in language: {language}. Do not copy titles."
    user = {
        "role": "user",
        "content": f"""Business niche: {niche}
Persona: {persona}
Region: {region}  Season: {season}
Seed keywords: {', '.join(seed_keywords or [])}
Inspiration (do not copy):
{chr(10).join(context_lines[:12]) or 'No context'}

Return exactly {count} ideas in total, grouped into 3-5 clusters.
Each idea: ideaText (40-90 chars), targetKeyword, rationale (1-2 lines), trendTag (evergreen|trending-Q4|news-angle), language.
JSON fields: clusters:[{{label, ideas[]}}], ideas:[...]."""
    }
    return system, user


def blog_system(language: str, focus_kw: str, target_length: int) -> str:
    return f"""You are a senior SEO copywriter. Write strictly in {language}.
Rules:
- One H1 including the focus keyword: {focus_kw}
- H2/H3 hierarchy; intro mentions keyword in first 100-150 words
- Meta description 140-160 chars including {focus_kw}
- Target length ~{target_length} words (±15%)
- Provide 1-3 image prompts + ALT text; placeholders internalLinks[]/externalLinks[]
Return JSON: title, h1, sections:[{{h2, body}}], faqs:[{{q,a}}], meta:{{description, slug}}, images:[{{prompt, alt}}], links:{{internal[], external[]}}"""


def linkedin_system(language: str) -> str:
    return f"""Write a LinkedIn post strictly in {language} with a professional, narrative-driven tone.
Style: A short personal success story that exaggerates key insights (but remains plausible), then 3 actionable tips, and a reflective closing question.
Return JSON: body, hashtags[] (<=5). No hashtags inside body."""


def instagram_system(language: str) -> str:
    return f"""Write an Instagram caption strictly in {language} using personal experiences and event-related storytelling.
Length: 120-180 words. Use tasteful emojis (2-3 per paragraph) and a clear CTA.
Return JSON: caption, hashtags[] (<=15)."""
