# ai/services/image_generation_service.py - NEW FILE

"""
AI Image Generation Service - Production Ready
Primary: FLUX.1-schnell (Together AI) - Best quality
Fallback: Stable Diffusion XL (Hugging Face) - Good quality
Final: Placeholder - Always works
"""

import base64
import logging
from typing import List, Dict, Optional
import httpx
from config import settings

logger = logging.getLogger(__name__)

# Platform-specific resolutions
RESOLUTIONS = {
    "instagram": "1024x1024",      # Square
    "linkedin": "1080x1350",       # Portrait (4:5 ratio)
    "blog": "1920x1080",           # Landscape (16:9 ratio)
    "default": "1024x1024"
}


def get_resolution_for_platform(platform: str) -> str:
    """Get optimal resolution for platform."""
    return RESOLUTIONS.get(platform.lower(), RESOLUTIONS["default"])


def parse_resolution(size_str: str) -> tuple:
    """Parse '1920x1080' into (1920, 1080)."""
    try:
        w, h = size_str.lower().split('x')
        return (int(w), int(h))
    except:
        return (1024, 1024)


# ============================================================================
# TIER 1: FLUX.1-schnell (Together AI) - PRIMARY
# ============================================================================

async def generate_with_flux(prompt: str, size: str) -> Dict:
    """
    Generate image using FLUX.1-schnell via Together AI.
    Best quality, fast (4 steps), free $25 credits.
    
    Returns:
        {
            "url": "data:image/png;base64,...",
            "base64": "iVBORw0KG...",
            "width": 1920,
            "height": 1080,
            "provider": "flux",
            "meta": {...}
        }
    """
    if not settings.TOGETHER_API_KEY:
        raise RuntimeError("TOGETHER_API_KEY not configured")
    
    width, height = parse_resolution(size)
    
    # Enhance prompt with quality boosters
    enhanced_prompt = enhance_prompt_for_quality(prompt)
    
    logger.info(f"flux_request: Generating {width}x{height} image for: {prompt[:50]}")
    
    headers = {
        "Authorization": f"Bearer {settings.TOGETHER_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "black-forest-labs/FLUX.1-schnell",
        "prompt": enhanced_prompt,
        "width": width,
        "height": height,
        "steps": 4,  # Fast mode (schnell)
        "n": 1,
        "response_format": "b64_json"  # Get base64 directly
    }
    
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.together.xyz/v1/images/generations",
                headers=headers,
                json=payload
            )
            
            if resp.status_code != 200:
                error_msg = resp.text[:300]
                raise RuntimeError(f"FLUX.1 API error {resp.status_code}: {error_msg}")
            
            data = resp.json()
            
            # Extract base64 from response
            if "data" in data and len(data["data"]) > 0:
                b64_data = data["data"][0]["b64_json"]
                
                # Create data URI
                data_uri = f"data:image/png;base64,{b64_data}"
                
                logger.info(f"flux_success: Generated {width}x{height} image ({len(b64_data)} chars)")
                
                return {
                    "url": data_uri,
                    "base64": b64_data,
                    "width": width,
                    "height": height,
                    "provider": "flux",
                    "meta": {
                        "source": "FLUX.1-schnell",
                        "model": "black-forest-labs/FLUX.1-schnell",
                        "steps": 4,
                        "original_prompt": prompt,
                        "enhanced_prompt": enhanced_prompt
                    }
                }
            else:
                raise RuntimeError("No image data in FLUX.1 response")
                
    except Exception as e:
        logger.warning(f"FLUX.1 generation failed: {e}")
        raise


# ============================================================================
# TIER 2: Stable Diffusion XL (Hugging Face) - FALLBACK
# ============================================================================

async def generate_with_sdxl(prompt: str, size: str) -> Dict:
    """
    Generate image using Stable Diffusion XL via Hugging Face.
    Good quality, free, rate limited.
    
    Returns same structure as generate_with_flux()
    """
    if not settings.HUGGINGFACE_API_KEY:
        raise RuntimeError("HUGGINGFACE_API_KEY not configured")
    
    width, height = parse_resolution(size)
    
    # Enhance prompt
    enhanced_prompt = enhance_prompt_for_quality(prompt)
    
    logger.info(f"sdxl_request: Generating {width}x{height} image for: {prompt[:50]}")
    
    headers = {
        "Authorization": f"Bearer {settings.HUGGINGFACE_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Use SDXL model
    model_url = "https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0"
    
    payload = {
        "inputs": enhanced_prompt,
        "parameters": {
            "width": width,
            "height": height,
            "num_inference_steps": 25,  # Balance quality/speed
        }
    }
    
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(model_url, headers=headers, json=payload)
            
            if resp.status_code != 200:
                error_msg = resp.text[:300]
                
                # Check for rate limit
                if resp.status_code == 429:
                    raise RuntimeError("Hugging Face rate limit exceeded")
                
                raise RuntimeError(f"SDXL API error {resp.status_code}: {error_msg}")
            
            # Response is image bytes
            image_bytes = resp.content
            
            # Convert to base64
            b64_data = base64.b64encode(image_bytes).decode()
            data_uri = f"data:image/png;base64,{b64_data}"
            
            logger.info(f"sdxl_success: Generated {width}x{height} image ({len(b64_data)} chars)")
            
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
                    "enhanced_prompt": enhanced_prompt
                }
            }
            
    except Exception as e:
        logger.warning(f"SDXL generation failed: {e}")
        raise


# ============================================================================
# TIER 3: Placeholder - ALWAYS WORKS
# ============================================================================

def generate_placeholder(prompt: str, size: str) -> Dict:
    """
    Generate a simple placeholder image.
    Always succeeds, minimal quality.
    """
    width, height = parse_resolution(size)
    
    # Minimal 1x1 transparent PNG
    placeholder_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg=="
    data_uri = f"data:image/png;base64,{placeholder_b64}"
    
    logger.warning(f"placeholder: Returning placeholder for: {prompt[:50]}")
    
    return {
        "url": data_uri,
        "base64": placeholder_b64,
        "width": width,
        "height": height,
        "provider": "placeholder",
        "meta": {
            "source": "Placeholder",
            "prompt": prompt,
            "note": "All image generation services failed"
        }
    }


# ============================================================================
# PROMPT ENGINEERING
# ============================================================================

def enhance_prompt_for_quality(prompt: str) -> str:
    """
    Enhance user prompt with quality boosters and style guidance.
    
    Examples:
        "cooking pasta" → "cooking pasta, professional food photography, 
        high quality, natural lighting, appetizing presentation, clean 
        composition, no text, no watermark"
    """
    # Quality boosters
    boosters = [
        "professional photography",
        "high quality",
        "4K resolution",
        "natural lighting",
        "clean composition",
        "sharp focus"
    ]
    
    # Negative prompts (what to avoid)
    negatives = [
        "no text",
        "no watermark",
        "no blurry",
        "no distortion"
    ]
    
    # Combine
    enhanced = f"{prompt}, {', '.join(boosters)}, {', '.join(negatives)}"
    
    return enhanced


# ============================================================================
# ALT TEXT GENERATION (using Groq)
# ============================================================================

async def generate_alt_text(prompt: str, language: str = "en") -> str:
    """
    Generate SEO-friendly alt text using Groq.
    Falls back to simple description if Groq unavailable.
    """
    if not settings.GROQ_API_KEY:
        return fallback_alt_text(prompt, language)
    
    system_prompt = (
        f"You write concise, SEO-friendly image alt text in {language}. "
        "Keep it under 14 words, describe the subject clearly, no quotes."
    )
    
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": settings.GROQ_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
        "max_tokens": 60,
        "temperature": 0.4
    }
    
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers,
                json=payload
            )
            
            if resp.status_code == 200:
                data = resp.json()
                alt_text = data["choices"][0]["message"]["content"].strip()
                return alt_text
            else:
                raise RuntimeError(f"Groq error {resp.status_code}")
                
    except Exception as e:
        logger.warning(f"Groq alt text failed: {e}")
        return fallback_alt_text(prompt, language)


def fallback_alt_text(prompt: str, language: str = "en") -> str:
    """Simple fallback alt text."""
    return f"{prompt.strip()} ({language})"


# ============================================================================
# MAIN API: Multi-Tier Generation with Fallback
# ============================================================================

async def generate_image(
    prompt: str,
    platform: str = "blog",
    language: str = "en"
) -> Dict:
    """
    Generate a single image with multi-tier fallback strategy.
    
    Args:
        prompt: Image description (e.g., "cooking pasta in modern kitchen")
        platform: Target platform (instagram, linkedin, blog)
        language: Language for alt text
    
    Returns:
        {
            "url": "data:image/png;base64,...",  # For PostgreSQL storage
            "base64": "iVBORw0KG...",
            "width": 1920,
            "height": 1080,
            "altText": "SEO-friendly description",
            "provider": "flux" | "sdxl" | "placeholder",
            "meta": {...}
        }
    """
    size = get_resolution_for_platform(platform)
    
    logger.info(f"generate_image: prompt='{prompt[:50]}', platform={platform}, size={size}")
    
    # Generate alt text (async, runs in parallel later if needed)
    alt_text = await generate_alt_text(prompt, language)
    
    # Try FLUX.1 first (best quality)
    try:
        result = await generate_with_flux(prompt, size)
        result["altText"] = alt_text
        result["size"] = size
        logger.info(f"✅ Image generated with FLUX.1")
        return result
    except Exception as e:
        logger.warning(f"FLUX.1 failed, trying SDXL fallback: {e}")
    
    # Try SDXL fallback (good quality)
    try:
        result = await generate_with_sdxl(prompt, size)
        result["altText"] = alt_text
        result["size"] = size
        logger.info(f"⚠️ Image generated with SDXL (fallback)")
        return result
    except Exception as e:
        logger.warning(f"SDXL failed, using placeholder: {e}")
    
    # Final fallback (always works)
    result = generate_placeholder(prompt, size)
    result["altText"] = alt_text
    result["size"] = size
    logger.warning(f"⚠️ Using placeholder image (all services failed)")
    return result


async def generate_images(
    prompts: List[str],
    platform: str = "blog",
    language: str = "en"
) -> List[Dict]:
    """
    Generate multiple images in parallel.
    
    Args:
        prompts: List of image descriptions
        platform: Target platform
        language: Language for alt text
    
    Returns:
        List of image dictionaries (same structure as generate_image)
    """
    import asyncio
    
    tasks = [generate_image(prompt, platform, language) for prompt in prompts]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Filter out exceptions
    images = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            logger.error(f"Image {i} generation failed: {result}")
            # Generate placeholder for failed image
            images.append(generate_placeholder(prompts[i], get_resolution_for_platform(platform)))
        else:
            images.append(result)
    
    return images


# ============================================================================
# USAGE EXAMPLES
# ============================================================================

"""
EXAMPLE 1: Generate single image for blog post

image = await generate_image(
    prompt="modern kitchen with pasta cooking on stove",
    platform="blog",
    language="en"
)

# Save to database
image_record = {
    "userId": user_id,
    "prompt": "modern kitchen with pasta cooking",
    "url": image["url"],  # data:image/png;base64,... (ready for DB)
    "altText": image["altText"],
    "width": image["width"],
    "height": image["height"],
    "format": "png",
    "provider": image["provider"],
    "aiMeta": image["meta"]
}


EXAMPLE 2: Generate multiple images for Instagram carousel

prompts = [
    "cooking pasta step 1: boiling water",
    "cooking pasta step 2: adding salt",
    "cooking pasta step 3: draining pasta"
]

images = await generate_images(
    prompts=prompts,
    platform="instagram",
    language="en"
)

# All images are 1024x1024 (Instagram square)


EXAMPLE 3: LinkedIn featured image

image = await generate_image(
    prompt="professional business meeting with laptop",
    platform="linkedin",
    language="en"
)

# Image is 1080x1350 (LinkedIn portrait)
"""