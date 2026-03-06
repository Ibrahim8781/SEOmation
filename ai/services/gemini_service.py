# ai/services/gemini_service.py

import asyncio
import json
import logging
import os
import re
from typing import List, Dict
import httpx
from config import settings

logger = logging.getLogger(__name__)

# The google.genai SDK prefers GOOGLE_API_KEY over GEMINI_API_KEY when both are
# present in the environment. Since we pass the key explicitly, stomp any stale
# GOOGLE_API_KEY that may have leaked from the system environment so the SDK
# doesn't log a confusing warning or use the wrong project's quota.
os.environ.pop("GOOGLE_API_KEY", None)

try:
    import google.genai as genai
    GEMINI_AVAILABLE = True
    GENAI_NEW_VERSION = True
except ImportError:
    try:
        import google.generativeai as genai
        GEMINI_AVAILABLE = True
        GENAI_NEW_VERSION = False
    except ImportError:
        GEMINI_AVAILABLE = False
        GENAI_NEW_VERSION = False


MAX_RETRIES = 3
RETRY_DEFAULT_WAIT = 35  # seconds to wait if retry_delay not parseable from error


def _build_prompt(messages: List[Dict[str, str]]) -> str:
    """Convert chat messages list into a single prompt string."""
    parts = []
    for msg in messages:
        role = msg.get("role", "user").upper()
        content = msg.get("content", "")
        if role == "SYSTEM":
            parts.append(f"INSTRUCTIONS:\n{content}\n")
        elif role == "USER":
            parts.append(f"USER:\n{content}\n")
        elif role == "ASSISTANT":
            parts.append(f"ASSISTANT:\n{content}\n")
    return "\n".join(parts)


def _parse_retry_delay(error_str: str) -> int:
    """Extract retry_delay seconds from a 429 error message. Returns default if not found."""
    match = re.search(r'retry_delay\s*\{\s*seconds:\s*(\d+)', error_str)
    if match:
        return int(match.group(1)) + 3  # add 3s buffer
    # Also handle 'Please retry in X.Ys' or 'retryDelay: Xs' formats
    match2 = re.search(r'retry in (\d+(?:\.\d+)?)s', error_str, re.IGNORECASE)
    if match2:
        return int(float(match2.group(1))) + 3
    match3 = re.search(r'retryDelay["\s:]+(\d+)', error_str)
    if match3:
        return int(match3.group(1)) + 3
    return RETRY_DEFAULT_WAIT


async def _call_groq_fallback(messages: List[Dict[str, str]], max_tokens: int, temperature: float, json_mode: bool = False) -> str:
    """Call Groq as a fallback when Gemini quota is exhausted."""
    if not settings.GROQ_API_KEY:
        raise RuntimeError("Groq fallback failed: GROQ_API_KEY not configured")

    logger.warning("Gemini quota exhausted — falling back to Groq")
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.GROQ_MODEL,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(url, headers=headers, json=payload)
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]


def _is_daily_quota(error_str: str) -> bool:
    """Return True if the 429 is a per-day limit (not worth retrying)."""
    return "PerDay" in error_str or "per_day" in error_str.lower()


async def call_gemini(messages: List[Dict[str, str]], max_tokens: int = 2000, temperature: float = 0.7, json_mode: bool = False) -> str:
    if not GEMINI_AVAILABLE:
        logger.warning("Gemini not installed — falling back to Groq")
        return await _call_groq_fallback(messages, max_tokens, temperature, json_mode)

    if not settings.GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY not set — falling back to Groq")
        return await _call_groq_fallback(messages, max_tokens, temperature, json_mode)

    prompt = _build_prompt(messages)

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            if GENAI_NEW_VERSION:
                # google.genai (new SDK)
                client = genai.Client(api_key=settings.GEMINI_API_KEY)
                response = client.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=prompt,
                    config=genai.types.GenerateContentConfig(
                        max_output_tokens=max_tokens,
                        temperature=temperature,
                    ),
                )
                return response.text
            else:
                # google.generativeai (legacy SDK)
                genai.configure(api_key=settings.GEMINI_API_KEY)
                model = genai.GenerativeModel(
                    model_name=settings.GEMINI_MODEL,
                    generation_config={
                        "max_output_tokens": max_tokens,
                        "temperature": temperature,
                    },
                )
                response = model.generate_content(prompt)
                return response.text

        except Exception as e:
            error_str = str(e)
            is_quota = "429" in error_str or "quota" in error_str.lower() or "RESOURCE_EXHAUSTED" in error_str

            if is_quota:
                # Daily quota hit — no point waiting, fall back immediately
                if _is_daily_quota(error_str):
                    logger.warning("Gemini daily quota exhausted — falling back to Groq immediately")
                    return await _call_groq_fallback(messages, max_tokens, temperature, json_mode)

                # Per-minute rate limit — wait and retry
                if attempt < MAX_RETRIES:
                    wait = _parse_retry_delay(error_str)
                    logger.warning(
                        f"Gemini per-minute quota hit (attempt {attempt}/{MAX_RETRIES}). "
                        f"Waiting {wait}s before retry..."
                    )
                    await asyncio.sleep(wait)
                    continue
                else:
                    logger.warning("Gemini quota exhausted after all retries — falling back to Groq")
                    return await _call_groq_fallback(messages, max_tokens, temperature, json_mode)

            # Non-quota error — fail fast
            logger.error(f"Gemini API error: {error_str}")
            raise RuntimeError(f"Gemini generation failed: {error_str}")

    # Safeguard
    logger.warning("Gemini loop exited unexpectedly — falling back to Groq")
    return await _call_groq_fallback(messages, max_tokens, temperature, json_mode)


async def call_gemini_json(messages: List[Dict[str, str]], max_tokens: int = 2000, temperature: float = 0.7) -> Dict:
    # Lower temperature for more consistent JSON
    temperature = min(temperature, 0.4)
    
    # Stronger JSON instruction
    json_instruction = """
CRITICAL: Return ONLY valid JSON. Rules:
1. NO markdown code blocks (no ``` or ```json)
2. All strings must use proper quotes with NO line breaks inside them
3. Escape special characters properly
4. Return the raw JSON object directly
"""
    
    if messages and messages[0].get("role") == "system":
        messages[0]["content"] += json_instruction
    else:
        messages.insert(0, {"role": "system", "content": json_instruction})
    
    # Try up to 2 times
    for attempt in range(2):
        try:
            raw_response = await call_gemini(messages, max_tokens, temperature, json_mode=True)
            cleaned = _clean_json_response(raw_response)
            return json.loads(cleaned)
        except json.JSONDecodeError as e:
            if attempt == 0:
                # Ask Gemini to fix it
                logger.warning(f"JSON parse failed (attempt {attempt+1}), asking Gemini to repair")
                messages = [
                    {"role": "system", "content": "You are a JSON validator. Fix the malformed JSON below. Return ONLY the corrected JSON, no explanation."},
                    {"role": "user", "content": f"Fix this JSON (remove newlines in strings, fix quotes):\n\n{raw_response[:2000]}"}
                ]
                temperature = 0.2  # Very low for repair
            else:
                # Last attempt: create minimal valid response
                logger.error(f"JSON repair failed: {e}")
                return _create_fallback_response(raw_response)
    
    raise ValueError("Failed to generate valid JSON after 2 attempts")


def _clean_json_response(raw: str) -> str:
    """Clean markdown and other artifacts from JSON response"""
    cleaned = raw.strip()
    
    # Remove markdown blocks
    patterns = [
        r'```json\s*([\s\S]*?)\s*```',
        r'```\s*([\s\S]*?)\s*```',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, cleaned)
        if match:
            cleaned = match.group(1)
            break
    
    # Remove remaining artifacts
    cleaned = re.sub(r'^```json\s*', '', cleaned)
    cleaned = re.sub(r'^```\s*', '', cleaned)
    cleaned = re.sub(r'\s*```$', '', cleaned)
    cleaned = cleaned.strip('`').strip()
    
    # Find JSON boundaries
    first = cleaned.find('{')
    last = cleaned.rfind('}')
    if first != -1 and last != -1 and first < last:
        cleaned = cleaned[first:last+1]
    
    # Fix common JSON errors
    # Remove newlines inside string values
    cleaned = re.sub(r':\s*"([^"]*)\n([^"]*)"', r': "\1 \2"', cleaned)
    
    return cleaned


def _create_fallback_response(raw: str) -> Dict:
    """Create a minimal valid response from malformed JSON"""
    logger.warning("Creating fallback response from malformed JSON")
    
    # Try to extract key fields
    title = re.search(r'"title"\s*:\s*"([^"]+)"', raw)
    h1 = re.search(r'"h1"\s*:\s*"([^"]+)"', raw)
    
    if title:
        return {
            "title": title.group(1),
            "h1": h1.group(1) if h1 else title.group(1),
            "sections": [
                {"h2": "Introduction", "body": "Content generated successfully. Please review and edit as needed."}
            ],
            "meta": {
                "description": title.group(1)[:160],
                "slug": re.sub(r'[^a-z0-9]+', '-', title.group(1).lower())
            },
            "images": []
        }
    
    # Ultimate fallback
    return {
        "title": "Generated Content",
        "h1": "Generated Content",
        "sections": [{"h2": "Content", "body": "Please review and edit."}],
        "meta": {"description": "Generated content", "slug": "content"},
        "images": []
    }