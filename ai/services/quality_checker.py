from typing import List, Tuple, Dict
import re

def _strip_html(html: str) -> str:
    return re.sub(r"<[^>]+>", " ", html or "")


def _to_words(text: str) -> List[str]:
    return [w.strip() for w in re.sub(r"[^a-zA-Z0-9\s'-]+", " ", text or "").split() if w.strip()]


def _severity(score: float, max_score: float) -> str:
    if not max_score:
        return "warn"
    pct = score / max_score
    if pct >= 0.8:
        return "ok"
    if pct >= 0.5:
        return "warn"
    return "error"


def _count_occurrences(text: str, keyword: str) -> int:
    if not keyword:
        return 0
    return len(re.findall(rf"\b{re.escape(keyword)}\b", text, flags=re.IGNORECASE))


def _heading_structure_score(html: str):
    h1 = len(re.findall(r"<h1[^>]*>", html, flags=re.IGNORECASE))
    h2 = len(re.findall(r"<h2[^>]*>", html, flags=re.IGNORECASE))
    h3 = len(re.findall(r"<h3[^>]*>", html, flags=re.IGNORECASE))
    has_hierarchy = h1 >= 1 and (h2 + h3) >= 2
    if h1 == 0:
        return 0, "Add an H1 with your primary keyword.", 15
    if not has_hierarchy:
        return 7, "Add subheadings (H2/H3) to structure the article.", 15
    return 13, "Heading structure looks solid.", 15


def _image_alt_score(html: str, images: List[Dict]) -> Tuple[int, str, int]:
    alts_html = re.findall(r"<img[^>]*alt=['\"]([^'\"]+)['\"][^>]*>", html or "", flags=re.IGNORECASE)
    combined = alts_html + [img.get("altText") for img in images or [] if img.get("altText")]
    if not combined:
        return 4, "Add images with descriptive alt text.", 10
    descriptive = [t for t in combined if t and len(t.strip()) >= 6]
    score = max(5, min(round((len(descriptive) / len(combined)) * 10), 10))
    msg = "All images have descriptive alt text." if len(descriptive) == len(combined) else "Some images need better alt text."
    return score, msg, 10


def _keyword_score(text: str, primary: str, secondary: List[str]):
    words = _to_words(text)
    word_count = len(words) or 1
    density = ( _count_occurrences(text, primary) / word_count ) * 100 if primary else 0
    if not primary:
        return 0, "Provide a primary keyword for better targeting.", 15, density
    if density < 0.8:
        base = 6
        msg = "Use the primary keyword a bit more naturally."
    elif density > 3.5:
        base = 8
        msg = "Keyword density is high; avoid stuffing."
    else:
        base = 12
        msg = "Keyword density looks healthy."
    secondary_hits = sum(_count_occurrences(text, kw) for kw in secondary or [])
    base = min(base + (2 if secondary_hits > 0 else 0), 15)
    return base, msg, 15, round(density, 2)


def _length_score(word_count: int):
    # Short-form friendly thresholds; generation prompt can still target higher lengths.
    if word_count >= 400:
        return 15, "Great depth; article is long enough.", 15
    if word_count >= 300:
        return 13, "Solid length for SEO.", 15
    if word_count >= 250:
        return 11, "Consider expanding sections for depth.", 15
    if word_count >= 150:
        return 9, "Content is a bit short; add more detail.", 15
    if word_count >= 100:
        return 7, "Content is short; expand sections.", 15
    return 4, "Very short content; expand significantly.", 15


def seo_score_and_hints(platform: str, language: str, focus_keyword: str, content: str, images: List[Dict]=None) -> Tuple[int, List[Dict[str,str]]]:
    html = content or ""
    text = _strip_html(html)
    words = _to_words(text)
    word_count = len(words)

    components = []

    # Title (best effort: derive from heading tag or fallback to first line)
    first_heading = ""
    m = re.search(r"<h1[^>]*>([^<]+)</h1>", html, flags=re.IGNORECASE)
    if m:
        first_heading = m.group(1).strip()
    elif text:
        first_heading = text.split(".")[0][:90]
    t_len = len(first_heading)
    title_score = 0
    title_msg = ""
    title_max = 15
    if t_len == 0:
        title_msg = "Add a clear title."
    else:
        if 45 <= t_len <= 70:
            title_score += 8
            title_msg = "Title length is optimal."
        elif 30 <= t_len <= 90:
            title_score += 6
            title_msg = "Slightly adjust title length for best results."
        else:
            title_score += 4
            title_msg = "Title too short/long for search snippets."
        if focus_keyword and focus_keyword.lower() in first_heading.lower():
            title_score += 5
        else:
            title_msg += " Include the primary keyword in the title."
    components.append({"id": "title", "label": "Title", "score": min(title_score, title_max), "max": title_max, "message": title_msg.strip(), "severity": _severity(title_score, title_max)})

    # Meta description: best effort from HTML comments/meta tags
    meta_desc = ""
    m2 = re.search(r'meta\s+name=["\']description["\']\s+content=["\']([^"\']+)["\']', html, flags=re.IGNORECASE)
    if m2:
        meta_desc = m2.group(1).strip()
    m3 = re.search(r"meta-description:\s*(.+)", html, flags=re.IGNORECASE)
    if m3:
        meta_desc = m3.group(1).strip()
    meta_max = 10
    meta_score = 0
    meta_msg = ""
    m_len = len(meta_desc)
    if m_len == 0:
        meta_msg = "Add a meta description (140-160 characters)."
    else:
        if 140 <= m_len <= 165:
            meta_score += 6
            meta_msg = "Meta description length is solid."
        elif 110 <= m_len <= 180:
            meta_score += 4
            meta_msg = "Meta description could be tightened to 140-160 chars."
        else:
            meta_score += 2
            meta_msg = "Meta description far from ideal length."
        if focus_keyword and focus_keyword.lower() in meta_desc.lower():
            meta_score += 4
        else:
            meta_msg += " Include the primary keyword in the description."
    components.append({"id": "meta", "label": "Meta description", "score": min(meta_score, meta_max), "max": meta_max, "message": meta_msg.strip(), "severity": _severity(meta_score, meta_max)})

    # Headings
    h_score, h_msg, h_max = _heading_structure_score(html)
    components.append({"id": "headings", "label": "Headings", "score": h_score, "max": h_max, "message": h_msg, "severity": _severity(h_score, h_max)})

    # Keywords
    k_score, k_msg, k_max, k_density = _keyword_score(text, focus_keyword, [])
    components.append({"id": "keywords", "label": "Keyword usage", "score": k_score, "max": k_max, "message": k_msg, "severity": _severity(k_score, k_max)})

    # Length
    l_score, l_msg, l_max = _length_score(word_count)
    components.append({"id": "length", "label": "Content length", "score": l_score, "max": l_max, "message": l_msg, "severity": _severity(l_score, l_max)})

    # Images
    img_score, img_msg, img_max = _image_alt_score(html, images or [])
    components.append({"id": "images", "label": "Image alt text", "score": img_score, "max": img_max, "message": img_msg, "severity": _severity(img_score, img_max)})

    total_max = sum(c["max"] for c in components)
    total_score = sum(c["score"] for c in components)
    percent = int(round((total_score / total_max) * 100)) if total_max else 0

    # Hints: surface non-OK items
    hints: List[Dict[str, str]] = []
    for comp in components:
        if comp["severity"] != "ok":
            hints.append({"type": comp["id"], "msg": comp["message"]})

    return percent, hints
