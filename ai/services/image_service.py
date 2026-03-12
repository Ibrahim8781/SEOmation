# ai/services/image_service.py

"""
AI Image Generation Service - Production Ready
Tier 1: FLUX.1-schnell via Together AI  - Best quality
Tier 2: kie.ai Seedream 3.0             - Good quality, cheap fallback
Tier 3: Stable Diffusion XL (HuggingFace) - Free, rate-limited
Tier 4: Placeholder                     - Always works
"""

import asyncio
import base64
import json
import logging
from typing import List, Dict, Optional
import httpx
from config import settings

logger = logging.getLogger(__name__)

# ============================================================================
# PLATFORM RESOLUTION MAPS
# ============================================================================

# Pixel resolution strings (used by Together AI / SDXL tiers)
RESOLUTIONS = {
    "instagram": "1024x1024",
    "linkedin":  "1080x1350",
    "blog":      "1920x1080",
    "default":   "1024x1024",
}

# kie.ai named sizes (Seedream 3.0 supported values)
PLATFORM_KIE_SIZE = {
    "instagram": "square_hd",
    "linkedin":  "portrait_4_3",
    "blog":      "landscape_16_9",
    "default":   "square_hd",
}

# Approximate pixel dims for kie.ai named sizes (metadata only)
KIE_SIZE_DIMS = {
    "square":         (1024, 1024),
    "square_hd":      (1024, 1024),
    "portrait_4_3":   (768,  1024),
    "portrait_3_2":   (768,  1152),
    "portrait_16_9":  (576,  1024),
    "landscape_4_3":  (1024, 768),
    "landscape_3_2":  (1152, 768),
    "landscape_16_9": (1024, 576),
    "landscape_21_9": (1024, 439),
}

KIE_BASE_URL   = "https://api.kie.ai/api/v1"
KIE_POLL_DELAY = 3   # seconds between polls
KIE_MAX_POLLS  = 30  # 90-second timeout total


def get_resolution_for_platform(platform: str) -> str:
    """Pixel-size string for the given platform."""
    return RESOLUTIONS.get(platform.lower(), RESOLUTIONS["default"])


def get_kie_size_for_platform(platform: str) -> str:
    return PLATFORM_KIE_SIZE.get(platform.lower(), PLATFORM_KIE_SIZE["default"])


def parse_resolution(size_str: str) -> tuple:
    """Parse '1920x1080' into (1920, 1080)."""
    try:
        w, h = size_str.lower().split('x')
        return (int(w), int(h))
    except Exception:
        return (1024, 1024)


# ============================================================================
# PROMPT ENGINEERING
# ============================================================================

def enhance_prompt_for_quality(prompt: str) -> str:
    """Add quality boosters to prompt."""
    boosters  = ["professional photography", "high quality", "4K resolution",
                 "natural lighting", "clean composition", "sharp focus"]
    negatives = ["no text", "no watermark", "no blurry", "no distortion"]
    return f"{prompt}, {', '.join(boosters)}, {', '.join(negatives)}"


# ============================================================================
# TIER 1: FLUX.1-schnell via Together AI — PRIMARY
# ============================================================================

async def generate_with_flux(prompt: str, size: str) -> Dict:
    """
    Generate image using FLUX.1-schnell via Together AI.
    Best quality, fast (4 steps).
    """
    if not settings.TOGETHER_API_KEY:
        raise RuntimeError("TOGETHER_API_KEY not configured")

    width, height = parse_resolution(size)
    enhanced_prompt = enhance_prompt_for_quality(prompt)

    logger.info(f"flux_request: {width}x{height} prompt='{prompt[:50]}'")

    headers = {
        "Authorization": f"Bearer {settings.TOGETHER_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "black-forest-labs/FLUX.1-schnell",
        "prompt": enhanced_prompt,
        "width": width,
        "height": height,
        "steps": 4,
        "n": 1,
        "response_format": "b64_json",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.together.xyz/v1/images/generations",
            headers=headers,
            json=payload,
        )

    if resp.status_code != 200:
        raise RuntimeError(f"FLUX.1 API error {resp.status_code}: {resp.text[:300]}")

    data = resp.json()
    if "data" in data and len(data["data"]) > 0:
        b64_data = data["data"][0]["b64_json"]
        logger.info(f"flux_success: {width}x{height} ({len(b64_data)} chars b64)")
        return {
            "url": f"data:image/png;base64,{b64_data}",
            "base64": b64_data,
            "width": width,
            "height": height,
            "provider": "flux",
            "meta": {
                "source": "FLUX.1-schnell",
                "model": "black-forest-labs/FLUX.1-schnell",
                "steps": 4,
                "original_prompt": prompt,
                "enhanced_prompt": enhanced_prompt,
            },
        }
    raise RuntimeError("No image data in FLUX.1 response")


# ============================================================================
# TIER 2: kie.ai Seedream 3.0 — SECOND PRIORITY
# ============================================================================

async def _kie_poll_task(task_id: str, headers: dict) -> dict:
    """
    Poll kie.ai task until success/fail.
    Returns the full task data dict on success.
    Raises RuntimeError on failure or timeout.
    """
    url = f"{KIE_BASE_URL}/jobs/recordInfo"
    async with httpx.AsyncClient(timeout=15) as client:
        for attempt in range(KIE_MAX_POLLS):
            await asyncio.sleep(KIE_POLL_DELAY)
            resp = await client.get(url, headers=headers, params={"taskId": task_id})
            if resp.status_code != 200:
                raise RuntimeError(f"kie.ai poll error {resp.status_code}: {resp.text[:200]}")
            body = resp.json()
            data = body.get("data", {})
            state = data.get("state", "")
            logger.debug(f"kie_poll attempt={attempt+1} state={state}")
            if state == "success":
                return data
            if state == "fail":
                raise RuntimeError(f"kie.ai task failed: {data.get('failMsg', 'unknown')}")
            # states: waiting / queuing / generating → keep polling
    raise RuntimeError(f"kie.ai task timed out after {KIE_MAX_POLLS * KIE_POLL_DELAY}s")


async def generate_with_kie(prompt: str, platform: str) -> Dict:
    """
    Generate image via kie.ai Seedream 3.0 (bytedance/seedream).
    Cheapest model on kie.ai at ~$0.02/image.

    Returns:
        {
            "url": "data:image/png;base64,...",
            "base64": "...",
            "width": int,
            "height": int,
            "provider": "kie_seedream3",
            "meta": {...}
        }
    """
    if not settings.KIE_API_KEY:
        raise RuntimeError("KIE_API_KEY not configured")

    image_size = get_kie_size_for_platform(platform)
    width, height = KIE_SIZE_DIMS.get(image_size, (1024, 1024))
    enhanced_prompt = enhance_prompt_for_quality(prompt)

    headers = {
        "Authorization": f"Bearer {settings.KIE_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": settings.KIE_MODEL,   # "bytedance/seedream"
        "input": {
            "prompt": enhanced_prompt,
            "image_size": image_size,
            "guidance_scale": 2.5,
            "enable_safety_checker": True,
        },
    }

    logger.info(f"kie_request: model={settings.KIE_MODEL} size={image_size} prompt='{prompt[:50]}'")

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            f"{KIE_BASE_URL}/jobs/createTask",
            headers=headers,
            json=payload,
        )

    if resp.status_code != 200:
        raise RuntimeError(f"kie.ai createTask error {resp.status_code}: {resp.text[:300]}")

    body = resp.json()
    task_id = body.get("data", {}).get("taskId")
    if not task_id:
        raise RuntimeError(f"kie.ai returned no taskId: {body}")

    logger.info(f"kie_task_created: taskId={task_id}")

    # Poll until done
    task_data = await _kie_poll_task(task_id, headers)

    # Parse resultJson → {"resultUrls": ["https://..."]}
    result_json_str = task_data.get("resultJson", "{}")
    result_json = json.loads(result_json_str) if result_json_str else {}
    result_urls = result_json.get("resultUrls", [])

    if not result_urls:
        raise RuntimeError(f"kie.ai success but no resultUrls: {task_data}")

    image_url = result_urls[0]
    logger.info(f"kie_image_url: {image_url[:80]}")

    # Download image and convert to base64 for consistent return format
    async with httpx.AsyncClient(timeout=30) as client:
        img_resp = await client.get(image_url)
    if img_resp.status_code != 200:
        raise RuntimeError(f"Failed to download kie.ai image: {img_resp.status_code}")

    b64_data = base64.b64encode(img_resp.content).decode()
    # Detect mime type (jpeg vs png from header)
    mime = "image/jpeg" if img_resp.content[:2] == b'\xff\xd8' else "image/png"
    data_uri = f"data:{mime};base64,{b64_data}"

    logger.info(f"kie_success: {width}x{height} {mime} ({len(b64_data)} chars b64)")

    return {
        "url": data_uri,
        "base64": b64_data,
        "width": width,
        "height": height,
        "provider": "kie_seedream3",
        "meta": {
            "source": "kie.ai Seedream 3.0",
            "model": settings.KIE_MODEL,
            "taskId": task_id,
            "image_size": image_size,
            "original_prompt": prompt,
            "enhanced_prompt": enhanced_prompt,
        },
    }


# ============================================================================
# TIER 3: Stable Diffusion XL (Hugging Face) — THIRD PRIORITY
# ============================================================================

async def generate_with_sdxl(prompt: str, size: str) -> Dict:
    """
    Generate image using Stable Diffusion XL via Hugging Face.
    Free but rate-limited.
    """
    if not settings.HUGGINGFACE_API_KEY:
        raise RuntimeError("HUGGINGFACE_API_KEY not configured")

    width, height = parse_resolution(size)
    enhanced_prompt = enhance_prompt_for_quality(prompt)

    logger.info(f"sdxl_request: {width}x{height} prompt='{prompt[:50]}'")

    headers = {
        "Authorization": f"Bearer {settings.HUGGINGFACE_API_KEY}",
        "Content-Type": "application/json",
    }
    model_url = (
        "https://router.huggingface.co/hf-inference/models/"
        "stabilityai/stable-diffusion-xl-base-1.0"
    )
    payload = {
        "inputs": enhanced_prompt,
        "parameters": {
            "width": width,
            "height": height,
            "num_inference_steps": 25,
        },
    }

    async with httpx.AsyncClient(timeout=90) as client:
        resp = await client.post(model_url, headers=headers, json=payload)

    if resp.status_code == 429:
        raise RuntimeError("HuggingFace rate limit exceeded")
    if resp.status_code != 200:
        raise RuntimeError(f"SDXL error {resp.status_code}: {resp.text[:300]}")

    b64_data = base64.b64encode(resp.content).decode()
    data_uri = f"data:image/png;base64,{b64_data}"

    logger.info(f"sdxl_success: {width}x{height} ({len(b64_data)} chars b64)")

    return {
        "url": data_uri,
        "base64": b64_data,
        "width": width,
        "height": height,
        "provider": "sdxl",
        "meta": {
            "source": "Stable Diffusion XL",
            "model": "stabilityai/stable-diffusion-xl-base-1.0",
            "original_prompt": prompt,
            "enhanced_prompt": enhanced_prompt,
        },
    }


# ============================================================================
# TIER 4: Placeholder — ALWAYS WORKS
# ============================================================================

def generate_placeholder(prompt: str, size: str) -> Dict:
    """Minimal 1×1 transparent PNG placeholder. Never fails."""
    width, height = parse_resolution(size)
    placeholder_b64 = (
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQAB"
        "DQottAAAAABJRU5ErkJggg=="
    )
    logger.warning(f"placeholder: using placeholder for '{prompt[:50]}'")
    return {
        "url": f"data:image/png;base64,{placeholder_b64}",
        "base64": placeholder_b64,
        "width": width,
        "height": height,
        "provider": "placeholder",
        "meta": {"source": "Placeholder", "prompt": prompt,
                 "note": "All image generation services failed"},
    }


# ============================================================================
# ALT TEXT (via Groq)
# ============================================================================

async def generate_alt_text(prompt: str, language: str = "en") -> str:
    if not settings.GROQ_API_KEY:
        return fallback_alt_text(prompt, language)

    system_prompt = (
        f"You write concise, SEO-friendly image alt text in {language}. "
        "Keep it under 14 words, describe the subject clearly, no quotes."
    )
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.GROQ_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": prompt},
        ],
        "max_tokens": 60,
        "temperature": 0.4,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers,
                json=payload,
            )
        if resp.status_code == 200:
            return resp.json()["choices"][0]["message"]["content"].strip()
        raise RuntimeError(f"Groq {resp.status_code}")
    except Exception as e:
        logger.warning(f"Groq alt text failed: {e}")
        return fallback_alt_text(prompt, language)


def fallback_alt_text(prompt: str, language: str = "en") -> str:
    return f"{prompt.strip()} ({language})"


# ============================================================================
# PUBLIC API
# ============================================================================

async def generate_image(
    prompt: str,
    platform: str = "blog",
    language: str = "en",
) -> Dict:
    """
    Generate a single image with 4-tier fallback:
      1. Together AI FLUX.1-schnell  (primary  — best quality)
      2. kie.ai Seedream 3.0         (second   — good quality, cheap)
      3. HuggingFace SDXL            (third    — free, rate-limited)
      4. Placeholder                 (emergency — always succeeds)

    Returns:
        {
            "url"      : "data:image/png;base64,...",
            "base64"   : "...",
            "width"    : int,
            "height"   : int,
            "altText"  : "SEO alt text",
            "provider" : "flux" | "kie_seedream3" | "sdxl" | "placeholder",
            "meta"     : {...}
        }
    """
    size = get_resolution_for_platform(platform)

    logger.info(f"generate_image: prompt='{prompt[:50]}' platform={platform}")

    alt_text = await generate_alt_text(prompt, language)

    # --- Tier 1: Together AI FLUX.1-schnell ---
    try:
        result = await generate_with_flux(prompt, size)
        result["altText"] = alt_text
        result["size"] = size
        logger.info("Image generated via Together AI FLUX.1-schnell")
        return result
    except Exception as e:
        logger.warning(f"FLUX.1 failed, trying kie.ai: {e}")

    # --- Tier 2: kie.ai Seedream 3.0 ---
    try:
        result = await generate_with_kie(prompt, platform)
        result["altText"] = alt_text
        result["size"] = "{width}x{height}".format(**result)
        logger.info("Image generated via kie.ai Seedream 3.0 (2nd tier)")
        return result
    except Exception as e:
        logger.warning(f"kie.ai failed, trying HuggingFace SDXL: {e}")

    # --- Tier 3: HuggingFace SDXL ---
    try:
        result = await generate_with_sdxl(prompt, size)
        result["altText"] = alt_text
        result["size"] = size
        logger.info("Image generated via HuggingFace SDXL (3rd tier)")
        return result
    except Exception as e:
        logger.warning(f"SDXL failed, using placeholder: {e}")

    # --- Tier 4: Placeholder ---
    result = generate_placeholder(prompt, size)
    result["altText"] = alt_text
    result["size"] = size
    logger.warning("Using placeholder image (all services failed)")
    return result


async def generate_images(
    prompts: List[str],
    platform: str = "blog",
    language: str = "en",
) -> List[Dict]:
    """Generate multiple images in parallel."""
    tasks = [generate_image(p, platform, language) for p in prompts]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    images = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            logger.error(f"Image {i} failed: {result}")
            size = get_resolution_for_platform(platform)
            images.append(generate_placeholder(prompts[i], size))
        else:
            images.append(result)
    return images