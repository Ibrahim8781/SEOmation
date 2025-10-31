from typing import Dict, Any, List
import html

def _p(text: str) -> str:
    processed = html.escape(text or "").replace("\\n", "<br>")
    return f"<p>{processed}</p>"

def blog_to_html(data: Dict[str, Any]) -> str:
    title = html.escape(data.get("title", ""))
    h1 = html.escape(data.get("h1", ""))
    sections = data.get("sections", [])
    faqs = data.get("faqs", [])
    meta = data.get("meta", {}) or {}
    images = data.get("images", []) or []

    parts: List[str] = []
    if title:
        parts.append(f"<!-- title: {title} -->")
    if h1:
        parts.append(f"<h1>{h1}</h1>")
    for sec in sections:
        h2 = html.escape(sec.get("h2", ""))
        body = sec.get("body", "")
        if h2:
            parts.append(f"<h2>{h2}</h2>")
        if body:
            parts.append(_p(body))
    if faqs:
        parts.append("<section class='faqs'>")
        for f in faqs:
            q = html.escape(f.get("q", ""))
            a = html.escape(f.get("a", ""))
            parts.append(f"<h3>{q}</h3>{_p(a)}")
        parts.append("</section>")
    if meta.get("description"):
        parts.append(f"<!-- meta-description: {html.escape(meta['description'])} -->")
    if images:
        parts.append("<!-- image-prompts: " + html.escape(str(images)) + " -->")
    return "\n".join(parts)

def blog_to_plain(data: Dict[str, Any]) -> str:
    title = (data.get("title", "") or "").strip()
    h1 = (data.get("h1", "") or "").strip()
    sections = data.get("sections", []) or []
    faqs = data.get("faqs", []) or []
    lines: List[str] = []
    if title: lines.append(title)
    if h1: lines.append(h1)
    for sec in sections:
        h2 = (sec.get("h2", "") or "").strip()
        body = (sec.get("body", "") or "").strip()
        if h2: lines.append(h2)
        if body: lines.append(body)
    if faqs:
        lines.append("FAQs")
        for f in faqs:
            lines.append("Q: " + (f.get("q", "") or "").strip())
            lines.append("A: " + (f.get("a", "") or "").strip())
    return "\n\n".join([l for l in lines if l])

def linkedin_to_html(data: Dict[str, Any]) -> str:
    body = (data.get("body", "") or "").strip()
    hashtags = data.get("hashtags", []) or []
    parts = [_p(body)]
    if hashtags:
        parts.append("<p>" + " ".join(f"#{html.escape(tag)}" for tag in hashtags[:5]) + "</p>")
    return "\n".join(parts)

def linkedin_to_plain(data: Dict[str, Any]) -> str:
    body = (data.get("body", "") or "").strip()
    hashtags = data.get("hashtags", []) or []
    tag_line = " ".join(f"#{t}" for t in hashtags[:5])
    if tag_line:
        return body + "\n\n" + tag_line
    return body

def instagram_to_html(data: Dict[str, Any]) -> str:
    caption = (data.get("caption", "") or "").strip()
    hashtags = data.get("hashtags", []) or []
    parts = [_p(caption)]
    if hashtags:
        parts.append("<p>" + " ".join(f"#{html.escape(tag)}" for tag in hashtags[:15]) + "</p>")
    return "\n".join(parts)

def instagram_to_plain(data: Dict[str, Any]) -> str:
    caption = (data.get("caption", "") or "").strip()
    hashtags = data.get("hashtags", []) or []
    tag_line = " ".join(f"#{t}" for t in hashtags[:15])
    if tag_line:
        return caption + "\n\n" + tag_line
    return caption
