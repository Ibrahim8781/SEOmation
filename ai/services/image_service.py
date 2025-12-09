import base64
import logging
import urllib.parse
from typing import List, Dict, Any, Optional

import httpx
from config import settings

logger = logging.getLogger(__name__)

PLACEHOLDER = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg=="
PEXELS_API = "https://api.pexels.com/v1/search"


def _placeholder(source_hint: str, size: str) -> Dict[str, Any]:
    data_url = f"data:image/png;base64,{PLACEHOLDER}"
    return {
        "url": data_url,
        "base64": PLACEHOLDER,
        "size": size,
        "provider": "mock",
        "meta": {"source": source_hint},
    }


def _orientation_from_size(size: Optional[str]) -> Optional[str]:
    if not size or "x" not in size:
        return None
    try:
        w_str, h_str = size.lower().split("x")
        w, h = int(w_str), int(h_str)
        if w == h:
            return "square"
        return "landscape" if w > h else "portrait"
    except Exception:
        return None


async def _fetch_from_pexels(prompt: str, count: int, size_hint: str) -> List[Dict[str, Any]]:
    api_key = settings.PEXELS_API_KEY
    if not api_key:
        raise RuntimeError("PEXELS_API_KEY is missing")

    # Simple keyword set to filter obviously irrelevant hits (e.g., airline photos for "cricket team").
    keywords = {w.lower() for w in prompt.split() if len(w) >= 4}
    keywords = {k for k in keywords if k.isalpha()}

    orientation = _orientation_from_size(size_hint)
    params = {
        "query": prompt,
        "per_page": max(count, 3),
        "size": "large",
    }
    if orientation:
        params["orientation"] = orientation

    headers = {"Authorization": api_key}
    results: List[Dict[str, Any]] = []

    async with httpx.AsyncClient(timeout=45) as client:
        resp = await client.get(PEXELS_API, params=params, headers=headers)
        if not resp.is_success:
            raise RuntimeError(f"Pexels failed {resp.status_code}: {resp.text[:300]}")

        data = resp.json()
        photos = data.get("photos") or []
        for photo in photos[:count * 2]:  # allow extra to pass relevance filter
            alt_text = (photo.get("alt") or "").lower()
            overlap = keywords.intersection(set(alt_text.split()))
            if keywords and not overlap:
                # Skip clearly unrelated images
                continue

            src = photo.get("src") or {}
            src_url = src.get("large2x") or src.get("large") or src.get("original")
            if not src_url:
                continue
            try:
                img_resp = await client.get(src_url)
                img_resp.raise_for_status()
                b64 = base64.b64encode(img_resp.content).decode()
            except Exception as exc:  # noqa: BLE001
                logger.warning("Failed to download Pexels image %s: %s", src_url, exc)
                continue

            results.append(
                {
                    "url": src_url,
                    "base64": b64,
                    "size": size_hint,
                    "provider": "pexels",
                    "meta": {
                        "source": "PEXELS",
                        "sourceDetails": {
                            "pexelsId": str(photo.get("id")),
                            "photographer": photo.get("photographer"),
                            "photographerUrl": photo.get("photographer_url"),
                            "originalUrl": src_url,
                            "orientation": orientation,
                        },
                    },
                }
            )
            if len(results) >= count:
                break
    return results


async def _generate_with_pollinations(prompt: str, style: Optional[str], size: str) -> Dict[str, Any]:
    safe_prompt = prompt.strip() or "abstract illustration"
    if style:
        safe_prompt = f"{safe_prompt}, style: {style}"
    encoded = urllib.parse.quote(safe_prompt)
    size_param = size or "1024x1024"
    url = f"https://image.pollinations.ai/prompt/{encoded}?size={size_param}&nologo=true"

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.get(url)
        if not resp.is_success:
            raise RuntimeError(f"Pollinations failed {resp.status_code}: {resp.text[:300]}")
        b64 = base64.b64encode(resp.content).decode()
        return {
            "url": url,
            "base64": b64,
            "size": size_param,
            "provider": "pollinations",
            "meta": {
                "source": "POLLINATIONS",
                "sourceDetails": {
                    "promptUsed": safe_prompt,
                    "originalUrl": url,
                },
            },
        }


async def _generate_alt_text(prompt: str, style: Optional[str], language: str) -> str:
    system_prompt = (
        f"You write concise, SEO-friendly image alt text in {language or 'en'}. "
        "Keep it under 14 words, describe the subject clearly, no quotes."
    )
    user_content = prompt.strip()
    if style:
        user_content = f"{user_content} (style: {style})"

    if not settings.GROQ_API_KEY:
        return _fallback_alt_text(prompt, style, language)

    headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": settings.GROQ_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        "max_tokens": 60,
        "temperature": 0.4,
    }

    try:
        async with httpx.AsyncClient(timeout=45) as client:
            resp = await client.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"].strip()
            return content
    except Exception as exc:  # noqa: BLE001
        logger.warning("Groq alt text failed, falling back: %s", exc)
        return _fallback_alt_text(prompt, style, language)


def _fallback_alt_text(prompt: str, style: Optional[str], language: str) -> str:
    base = prompt.strip() or "generated image"
    if style:
        base = f"{base} - {style}"
    return f"{base} ({language or 'en'})"


async def generate_images(prompt: str, style: str, sizes: List[str], count: int, language: str):
    """Generate images using Pexels first, then Pollinations as fallback; alt text via Groq.
    If both providers fail, raise an error (no mock)."""
    target_sizes = sizes or ["1024x1024"]
    total = count or 1
    images: List[Dict[str, Any]] = []
    errors: List[str] = []

    # Try Pexels first (single fetch for efficiency)
    pexels_images: List[Dict[str, Any]] = []
    try:
        pexels_images = await _fetch_from_pexels(prompt, total, target_sizes[0])
        if pexels_images:
            logger.info("Using Pexels images (count=%s) for prompt '%s'", len(pexels_images), prompt)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Pexels fetch failed, will fallback to Pollinations: %s", exc)
        errors.append(f"Pexels: {exc}")

    alt_text = await _generate_alt_text(prompt, style, language)

    for i in range(total):
        size = target_sizes[i % len(target_sizes)]
        # Reuse Pexels if available, otherwise fallback to Pollinations
        if i < len(pexels_images):
            img = pexels_images[i]
            img["size"] = size or img.get("size") or "1024x1024"
            img["altText"] = alt_text
            images.append(img)
            continue

        try:
            generated = await _generate_with_pollinations(prompt, style, size)
            generated["altText"] = alt_text
            images.append(generated)
        except Exception as exc:  # noqa: BLE001
            errors.append(f"Pollinations: {exc}")

    if not images:
        raise RuntimeError(f"Image generation failed. Attempts: {' | '.join(errors) or 'none'}")
    return {"images": images, "altText": alt_text}
