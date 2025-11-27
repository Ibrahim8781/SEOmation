import base64
from typing import List, Dict, Any
from urllib.parse import quote_plus
import httpx

PLACEHOLDER = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg=="


def _placeholder(url_hint: str, size: str) -> Dict[str, Any]:
    data_url = f"data:image/png;base64,{PLACEHOLDER}"
    return {
        "url": data_url,
        "base64": PLACEHOLDER,
        "size": size,
        "provider": "mock",
        "source": url_hint,
    }


async def generate_images(prompt: str, style: str, sizes: List[str], count: int, language: str):
    """Lightweight image generation via a public model; falls back to placeholder when offline."""
    target_sizes = sizes or ["1024x1024"]
    images: List[Dict[str, Any]] = []

    for i in range(count or 1):
        size = target_sizes[i % len(target_sizes)]
        prompt_with_style = f"{prompt} in style: {style}" if style else prompt
        url = f"https://image.pollinations.ai/prompt/{quote_plus(prompt_with_style)}?size={size}"

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                b64 = base64.b64encode(resp.content).decode("utf-8")
                images.append(
                    {
                        "url": url,
                        "base64": b64,
                        "size": size,
                        "provider": "pollinations",
                        "altText": derive_alt_text(prompt, style, language),
                    }
                )
        except Exception as exc:  # noqa: BLE001
            images.append(
                {
                    **_placeholder(url, size),
                    "altText": derive_alt_text(prompt, style, language),
                    "error": str(exc),
                }
            )

    return {"images": images, "altText": derive_alt_text(prompt, style, language)}


def derive_alt_text(prompt: str, style: str, language: str) -> str:
    base = prompt.strip()
    if style:
        base = f"{base} - {style}"
    return f"{base} ({language or 'en'})"
