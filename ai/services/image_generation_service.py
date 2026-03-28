import asyncio
import base64
import json
import logging
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse

import httpx

from config import settings

logger = logging.getLogger(__name__)

PLATFORM_RESOLUTIONS = {
    "blog": "1920x1080",
    "wordpress": "1920x1080",
    "linkedin": "1200x628",
    "instagram": "1080x1080",
    "default": "1024x1024",
}

PLATFORM_KIE_SIZES = {
    "blog": "landscape_16_9",
    "wordpress": "landscape_16_9",
    "linkedin": "landscape_16_9",
    "instagram": "square_hd",
    "default": "square_hd",
}

KIE_SIZE_DIMS = {
    "square": (1024, 1024),
    "square_hd": (1024, 1024),
    "portrait_4_3": (768, 1024),
    "portrait_3_2": (768, 1152),
    "portrait_16_9": (576, 1024),
    "landscape_4_3": (1024, 768),
    "landscape_3_2": (1152, 768),
    "landscape_16_9": (1024, 576),
    "landscape_21_9": (1024, 439),
}

KIE_BASE_URL = "https://api.kie.ai/api/v1"
PLACEHOLDER_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQAB"
    "DQottAAAAABJRU5ErkJggg=="
)

PROMPT_BOOSTERS = [
    "professional editorial photography",
    "brand-safe composition",
    "clean subject separation",
    "natural lighting",
    "high detail",
    "sharp focus",
]
PROMPT_NEGATIVES = [
    "no text overlay",
    "no watermark",
    "no logo",
    "no blur",
    "no distortion",
]
STYLE_PRESET_HINTS = {
    "editorial": [
        "editorial magazine art direction",
        "premium branded composition",
        "modern marketing visual",
    ],
    "photorealistic": [
        "photorealistic image",
        "true-to-life textures",
        "realistic lighting",
    ],
    "illustration": [
        "polished digital illustration",
        "clean commercial artwork",
        "high-end illustrative style",
    ],
    "minimal": [
        "minimalist composition",
        "clean negative space",
        "refined simple aesthetic",
    ],
    "cinematic": [
        "cinematic lighting",
        "dramatic depth",
        "story-driven composition",
    ],
    "3d-render": [
        "premium 3D render",
        "studio-quality materials",
        "high-fidelity product visualization",
    ],
}


def normalize_platform(platform: Optional[str]) -> str:
    value = str(platform or "blog").strip().lower()
    if value in {"blog", "wordpress", "linkedin", "instagram"}:
        return value
    return "blog"


def get_resolution_for_platform(platform: Optional[str]) -> str:
    normalized = normalize_platform(platform)
    return PLATFORM_RESOLUTIONS.get(normalized, PLATFORM_RESOLUTIONS["default"])


def get_kie_size_for_platform(platform: Optional[str]) -> str:
    normalized = normalize_platform(platform)
    return PLATFORM_KIE_SIZES.get(normalized, PLATFORM_KIE_SIZES["default"])


def parse_resolution(size_str: Optional[str]) -> Tuple[int, int]:
    try:
        width_str, height_str = str(size_str or "").lower().split("x", 1)
        width = int(width_str)
        height = int(height_str)
        if width > 0 and height > 0:
            return width, height
    except (TypeError, ValueError):
        pass
    return 1024, 1024


def _normalize_multiple(value: int, divisor: int = 8) -> int:
    if value <= divisor:
        return divisor
    remainder = value % divisor
    if remainder == 0:
        return value
    lower = value - remainder
    upper = lower + divisor
    if lower < divisor:
        return divisor
    return lower if (value - lower) <= (upper - value) else upper


def normalize_huggingface_resolution(size_str: Optional[str]) -> Tuple[int, int]:
    requested_width, requested_height = parse_resolution(size_str)
    return _normalize_multiple(requested_width), _normalize_multiple(requested_height)


def extract_kie_result_urls(task_data: Dict) -> List[str]:
    if not isinstance(task_data, dict):
        raise RuntimeError("kie.ai returned a malformed task payload")

    direct_urls = task_data.get("resultUrls")
    if isinstance(direct_urls, list):
        filtered_urls = [url for url in direct_urls if isinstance(url, str) and url.strip()]
        if filtered_urls:
            return filtered_urls

    raw_result = task_data.get("resultJson")
    if isinstance(raw_result, dict):
        result_data = raw_result
    elif isinstance(raw_result, str) and raw_result.strip():
        try:
            parsed = json.loads(raw_result)
        except json.JSONDecodeError as exc:
            raise RuntimeError("kie.ai returned invalid resultJson") from exc
        result_data = parsed if isinstance(parsed, dict) else {}
    else:
        result_data = {}

    nested_urls = result_data.get("resultUrls") or result_data.get("images") or []
    if isinstance(nested_urls, list):
        filtered_urls = [url for url in nested_urls if isinstance(url, str) and url.strip()]
        if filtered_urls:
            return filtered_urls

    raise RuntimeError("kie.ai returned success without resultUrls")


def normalize_style_preset(style: Optional[str]) -> Optional[str]:
    normalized = str(style or "").strip().lower().replace("_", "-").replace(" ", "-")
    if normalized in STYLE_PRESET_HINTS:
        return normalized
    return None


def enhance_prompt_for_quality(prompt: str, style: Optional[str] = None) -> str:
    cleaned_prompt = prompt.strip()
    style_hints = STYLE_PRESET_HINTS.get(normalize_style_preset(style) or "", [])
    segments = [cleaned_prompt, *style_hints, *PROMPT_BOOSTERS, *PROMPT_NEGATIVES]
    return ", ".join(part for part in segments if part)


def parse_provider_order() -> List[str]:
    configured = [part.strip().lower() for part in settings.IMAGE_PROVIDER_ORDER.split(",") if part.strip()]
    valid = ["together", "kie", "huggingface", "placeholder"]
    ordered = [provider for provider in configured if provider in valid]
    if "placeholder" not in ordered:
        ordered.append("placeholder")
    if not ordered:
        return ["together", "kie", "huggingface", "placeholder"]
    return ordered


def infer_remote_format(url: str) -> str:
    path = urlparse(url).path.lower()
    if path.endswith(".png"):
        return "png"
    if path.endswith(".webp"):
        return "webp"
    if path.endswith(".gif"):
        return "gif"
    if path.endswith(".jpg") or path.endswith(".jpeg"):
        return "jpeg"
    return "jpeg"


def has_usable_together_key() -> bool:
    key = str(settings.TOGETHER_API_KEY or "").strip()
    if not key:
        return False
    if key == "paste_your_key_here":
        return False
    if key.lower().startswith("paste_"):
        return False
    return True


async def generate_with_together(prompt: str, size: str, style: Optional[str] = None) -> Dict:
    if not has_usable_together_key():
        raise RuntimeError("TOGETHER_API_KEY is missing or still set to a placeholder value")

    width, height = parse_resolution(size)
    normalized_style = normalize_style_preset(style)
    enhanced_prompt = enhance_prompt_for_quality(prompt, normalized_style)
    payload = {
        "model": settings.TOGETHER_IMAGE_MODEL,
        "prompt": enhanced_prompt,
        "width": width,
        "height": height,
        "n": 1,
        "response_format": "b64_json",
    }
    if settings.TOGETHER_IMAGE_STEPS > 0:
        payload["steps"] = settings.TOGETHER_IMAGE_STEPS

    logger.info("image_provider=together model=%s size=%sx%s", settings.TOGETHER_IMAGE_MODEL, width, height)

    async with httpx.AsyncClient(timeout=settings.TOGETHER_IMAGE_TIMEOUT_SECONDS) as client:
        response = await client.post(
            "https://api.together.xyz/v1/images/generations",
            headers={
                "Authorization": f"Bearer {settings.TOGETHER_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
        )

    if response.status_code != 200:
        raise RuntimeError(f"Together image API error {response.status_code}: {response.text[:300]}")

    body = response.json()
    data = body.get("data") or []
    if not data or not data[0].get("b64_json"):
        raise RuntimeError("Together image API returned no image payload")

    b64_data = data[0]["b64_json"]
    logger.info("image_provider=together status=success bytes=%s", len(b64_data))
    return {
        "url": f"data:image/png;base64,{b64_data}",
        "base64": b64_data,
        "width": width,
        "height": height,
        "format": "png",
        "provider": "together",
        "meta": {
            "source": "Together",
            "model": settings.TOGETHER_IMAGE_MODEL,
            "timeoutSeconds": settings.TOGETHER_IMAGE_TIMEOUT_SECONDS,
            "original_prompt": prompt,
            "enhanced_prompt": enhanced_prompt,
            "style": normalized_style,
        },
    }


async def poll_kie_task(task_id: str, headers: Dict[str, str]) -> Dict:
    max_polls = max(1, settings.KIE_POLL_TIMEOUT_SECONDS // max(settings.KIE_POLL_DELAY_SECONDS, 1))
    async with httpx.AsyncClient(timeout=settings.KIE_POLL_REQUEST_TIMEOUT_SECONDS) as client:
        for attempt in range(max_polls):
            await asyncio.sleep(settings.KIE_POLL_DELAY_SECONDS)
            response = await client.get(
                f"{KIE_BASE_URL}/jobs/recordInfo",
                headers=headers,
                params={"taskId": task_id},
            )
            if response.status_code != 200:
                raise RuntimeError(f"kie.ai poll error {response.status_code}: {response.text[:200]}")

            body = response.json()
            data = body.get("data") or {}
            state = str(data.get("state") or "").lower()
            logger.debug("kie_poll taskId=%s attempt=%s state=%s", task_id, attempt + 1, state)

            if state == "success":
                return data
            if state == "fail":
                raise RuntimeError(f"kie.ai task failed: {data.get('failMsg', 'unknown')}")

    raise RuntimeError(f"kie.ai task timed out after {settings.KIE_POLL_TIMEOUT_SECONDS}s")


async def generate_with_kie(prompt: str, platform: str, style: Optional[str] = None) -> Dict:
    if not settings.KIE_API_KEY:
        raise RuntimeError("KIE_API_KEY not configured")

    image_size = get_kie_size_for_platform(platform)
    width, height = KIE_SIZE_DIMS.get(image_size, (1024, 1024))
    normalized_style = normalize_style_preset(style)
    enhanced_prompt = enhance_prompt_for_quality(prompt, normalized_style)
    headers = {
        "Authorization": f"Bearer {settings.KIE_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.KIE_MODEL,
        "input": {
            "prompt": enhanced_prompt,
            "image_size": image_size,
            "guidance_scale": settings.KIE_GUIDANCE_SCALE,
            "enable_safety_checker": True,
        },
    }

    logger.info("image_provider=kie model=%s size=%s", settings.KIE_MODEL, image_size)

    async with httpx.AsyncClient(timeout=settings.KIE_CREATE_TIMEOUT_SECONDS) as client:
        response = await client.post(
            f"{KIE_BASE_URL}/jobs/createTask",
            headers=headers,
            json=payload,
        )

    if response.status_code != 200:
        raise RuntimeError(f"kie.ai createTask error {response.status_code}: {response.text[:300]}")

    body = response.json()
    if body.get("code") not in {None, 200, "200"}:
        raise RuntimeError(f"kie.ai createTask failed: {body.get('msg') or body}")
    task_id = (body.get("data") or {}).get("taskId")
    if not task_id:
        raise RuntimeError(f"kie.ai returned no taskId: {body}")

    task_data = await poll_kie_task(task_id, headers)
    result_urls = extract_kie_result_urls(task_data)

    image_url = result_urls[0]
    image_format = infer_remote_format(image_url)
    logger.info("image_provider=kie status=success url=%s", image_url[:120])

    return {
        "url": image_url,
        "base64": None,
        "width": width,
        "height": height,
        "format": image_format,
        "provider": "kie",
        "meta": {
            "source": "kie.ai",
            "model": settings.KIE_MODEL,
            "taskId": task_id,
            "image_size": image_size,
            "timeoutSeconds": settings.KIE_POLL_TIMEOUT_SECONDS,
            "original_prompt": prompt,
            "enhanced_prompt": enhanced_prompt,
            "style": normalized_style,
            "sourceDetails": {
                "originalUrl": image_url,
                "isPublic": True,
            },
        },
    }


async def generate_with_huggingface(prompt: str, size: str, style: Optional[str] = None) -> Dict:
    if not settings.HUGGINGFACE_API_KEY:
        raise RuntimeError("HUGGINGFACE_API_KEY not configured")

    requested_width, requested_height = parse_resolution(size)
    width, height = normalize_huggingface_resolution(size)
    normalized_style = normalize_style_preset(style)
    enhanced_prompt = enhance_prompt_for_quality(prompt, normalized_style)
    model_url = (
        "https://router.huggingface.co/hf-inference/models/"
        f"{settings.HUGGINGFACE_IMAGE_MODEL}"
    )

    if (width, height) != (requested_width, requested_height):
        logger.info(
            "Adjusted HuggingFace image size from %sx%s to %sx%s to satisfy provider constraints",
            requested_width,
            requested_height,
            width,
            height,
        )

    logger.info("image_provider=huggingface model=%s size=%sx%s", settings.HUGGINGFACE_IMAGE_MODEL, width, height)

    async with httpx.AsyncClient(timeout=settings.HUGGINGFACE_IMAGE_TIMEOUT_SECONDS) as client:
        response = await client.post(
            model_url,
            headers={
                "Authorization": f"Bearer {settings.HUGGINGFACE_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "inputs": enhanced_prompt,
                "parameters": {
                    "width": width,
                    "height": height,
                    "num_inference_steps": settings.HUGGINGFACE_IMAGE_STEPS,
                },
            },
        )

    if response.status_code == 429:
        raise RuntimeError("HuggingFace rate limit exceeded")
    if response.status_code != 200:
        raise RuntimeError(f"HuggingFace image API error {response.status_code}: {response.text[:300]}")

    b64_data = base64.b64encode(response.content).decode()
    logger.info("image_provider=huggingface status=success bytes=%s", len(response.content))
    return {
        "url": f"data:image/png;base64,{b64_data}",
        "base64": b64_data,
        "width": width,
        "height": height,
        "format": "png",
        "provider": "huggingface",
        "meta": {
            "source": "HuggingFace",
            "model": settings.HUGGINGFACE_IMAGE_MODEL,
            "timeoutSeconds": settings.HUGGINGFACE_IMAGE_TIMEOUT_SECONDS,
            "original_prompt": prompt,
            "enhanced_prompt": enhanced_prompt,
            "style": normalized_style,
        },
    }


def generate_placeholder(prompt: str, size: str) -> Dict:
    width, height = parse_resolution(size)
    logger.warning("image_provider=placeholder reason=all_providers_failed")
    return {
        "url": f"data:image/png;base64,{PLACEHOLDER_B64}",
        "base64": PLACEHOLDER_B64,
        "width": width,
        "height": height,
        "format": "png",
        "provider": "placeholder",
        "meta": {
            "source": "Placeholder",
            "prompt": prompt,
            "note": "All configured image providers failed",
        },
    }


async def generate_alt_text(prompt: str, language: str = "en") -> str:
    if not settings.GROQ_API_KEY:
        return fallback_alt_text(prompt, language)

    system_prompt = (
        f"You write concise, SEO-friendly image alt text in {language}. "
        "Keep it under 14 words, describe the subject clearly, no quotes."
    )
    payload = {
        "model": settings.GROQ_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": 60,
        "temperature": 0.4,
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        if response.status_code == 200:
            return response.json()["choices"][0]["message"]["content"].strip()
        raise RuntimeError(f"Groq alt text error {response.status_code}")
    except Exception as exc:
        logger.warning("Groq alt text failed: %s", exc)
        return fallback_alt_text(prompt, language)


def fallback_alt_text(prompt: str, language: str = "en") -> str:
    return f"{prompt.strip()} ({language})"


async def generate_image(
    prompt: str,
    platform: str = "blog",
    language: str = "en",
    size: Optional[str] = None,
    style: Optional[str] = None,
) -> Dict:
    normalized_platform = normalize_platform(platform)
    normalized_style = normalize_style_preset(style)
    resolved_size = size or get_resolution_for_platform(normalized_platform)
    alt_text = await generate_alt_text(prompt, language)
    errors = []
    provider_order = parse_provider_order()
    logger.info(
        "image_generation_start platform=%s size=%s providers=%s",
        normalized_platform,
        resolved_size,
        ",".join(provider_order),
    )

    for provider in provider_order:
        try:
            if provider == "together":
                result = await generate_with_together(prompt, resolved_size, normalized_style)
            elif provider == "kie":
                result = await generate_with_kie(prompt, normalized_platform, normalized_style)
            elif provider == "huggingface":
                result = await generate_with_huggingface(prompt, resolved_size, normalized_style)
            else:
                result = generate_placeholder(prompt, resolved_size)

            result["altText"] = alt_text
            result["size"] = (
                f"{result['width']}x{result['height']}"
                if result.get("width") and result.get("height")
                else resolved_size
            )
            logger.info(
                "image_generation_complete provider=%s platform=%s size=%s",
                result.get("provider"),
                normalized_platform,
                result.get("size"),
            )
            return result
        except Exception as exc:
            errors.append({"provider": provider, "error": str(exc)})
            logger.warning("Image provider %s failed: %s", provider, exc)

    result = generate_placeholder(prompt, resolved_size)
    result["altText"] = alt_text
    result["size"] = resolved_size
    result.setdefault("meta", {})
    result["meta"]["errors"] = errors
    logger.error(
        "image_generation_complete provider=placeholder platform=%s size=%s errors=%s",
        normalized_platform,
        resolved_size,
        errors,
    )
    return result


async def generate_images(
    prompts: List[str],
    platform: str = "blog",
    language: str = "en",
    sizes: Optional[List[str]] = None,
    style: Optional[str] = None,
) -> List[Dict]:
    requested_sizes = list(sizes or [])

    def resolve_size(index: int) -> Optional[str]:
        if not requested_sizes:
            return None
        if index < len(requested_sizes):
            return requested_sizes[index]
        return requested_sizes[-1]

    tasks = [
        generate_image(prompt, platform=platform, language=language, size=resolve_size(index), style=style)
        for index, prompt in enumerate(prompts)
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    images = []
    for index, result in enumerate(results):
        if isinstance(result, Exception):
            fallback_size = resolve_size(index) or get_resolution_for_platform(platform)
            logger.error("Image %s failed unexpectedly: %s", index, result)
            placeholder = generate_placeholder(prompts[index], fallback_size)
            placeholder["altText"] = fallback_alt_text(prompts[index], language)
            placeholder["size"] = fallback_size
            images.append(placeholder)
        else:
            images.append(result)
    return images
